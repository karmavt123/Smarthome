const prisma = require('../config/prisma');
const HttpError = require('../utils/http-error');
const { createDeviceCommand } = require('./device-command.service');
const { requireHome } = require('./ownership.service');
const voiceIntentClient = require('./voice-intent-client.service');

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Action verbs, articles, device-type nouns and room-type nouns. These say WHAT to do and
// to WHICH KIND of thing, never WHICH one, so they are excluded from name scoring on both
// sides. "phòng"/"room" belongs here for the same reason "đèn"/"light" does: every room is
// a "phòng", so the word on its own picks out nothing. Leaving it out was why
// "bật đèn phòng bếp" scored 1 for "Đèn phòng khách" and won a tie it should have lost.
const GENERIC_WORDS = new Set([
  'bat', 'tat', 'mo', 'dong', 'khoa', 'on', 'off', 'open', 'close', 'lock',
  'start', 'stop', 'den', 'light', 'lights', 'quat', 'fan', 'fans',
  'cua', 'door', 'doors',
  'turn', 'switch', 'set', 'the', 'please',
  'phong', 'room',
  // Ordinal markers. They introduce a label rather than being one, so the qualifier run
  // must pass THROUGH them to reach the number: without this, "bật đèn số 2" stopped dead
  // at "số", the "2" fell outside the run, and a home whose only light is "Đèn phòng
  // khách" happily switched it on for a light number 2 that does not exist.
  'so', 'thu', 'number',
]);

// The device-type nouns out of the set above. A command is built around one of these, and
// the words that pick out WHICH device sit right next to it — see `qualifierRun`.
const DEVICE_NOUNS = new Set([
  'den', 'light', 'lights', 'quat', 'fan', 'fans', 'cua', 'door', 'doors',
]);

// Room words safe to recognise on their own. The list is deliberately CLOSED, and the
// entries are chosen for one property: after `normalizeText` strips the diacritics, the
// result must not collide with a common everyday word. Vietnamese loses a lot of
// information in that step, and an earlier version of this list cost four normal commands:
//   'tang'  — "tăng quạt lên"     collides with "tầng" (floor)
//   'lau'   — "đèn bật lâu rồi"   collides with "lầu"  (upper floor)
//   'choi'  — "bật đèn chơi"      collides with "phòng chơi"
//   'ho'    — "mở đèn hộ em"      collides with "hồ bơi"
//   'cong'  — "bật công tắc đèn"  collides with "ban công" / "cổng"
//   'nha'   — "tắt đèn trong nhà" collides with "nhà bếp"
// Those places are still recognised, just never from a single bare word: they live in
// PLACE_PHRASES below, where the neighbouring word disambiguates them.
const PLACE_WORDS = new Set([
  // Not rooms, but the same job: words that pick out WHICH door/light when a home has
  // several. "mở cửa chính" must not open the kitchen door. 'truoc'/'sau'/'back' are
  // deliberately absent — "turn the light back on" and "trước khi đi" would be refused.
  'chinh', 'phu', 'main',
  'khach', 'ngu', 'bep', 'tam', 'an', 'kho', 'hoc', 'giat', 'tho', 'sinh',
  'wc', 'toilet', 'gara', 'garage', 'san', 'vuon', 'tret', 'gac',
  'living', 'bedroom', 'bed', 'kitchen', 'bathroom', 'bath', 'dining',
  'office', 'study', 'garden', 'yard', 'hall', 'hallway', 'porch',
  'balcony', 'basement', 'attic', 'closet', 'laundry', 'patio', 'restroom',
  'lobby', 'corridor', 'pantry', 'upstairs', 'downstairs', 'outdoor', 'indoor',
]);

// Places whose single words are ambiguous but whose full phrase is not. Matched as a
// contiguous run of words, so "ban công" is a balcony while "bật công tắc" is a switch.
const PLACE_PHRASES = [
  'hanh lang', 'ban cong', 'cau thang', 'ho boi', 'ap mai', 'nha xe',
  'nha kho', 've sinh', 'lam viec', 'san thuong', 'san vuon', 'nha bep',
  'phong tro', 'tang tret', 'tang lau',
  'living room', 'dining room', 'game room', 'laundry room', 'utility room',
  'front door', 'back door',
];

// Compounds that read like a device command but name a different object entirely.
// "cửa sổ" is a window, not a door — without this, "mở cửa sổ" opened the front door.
// Matched as a whole phrase so it can never fire on "số 2" / "thứ 2", which is what an
// earlier attempt at blacklisting the bare word "số" did.
const NON_DEVICE_PHRASES = ['cua so', 'cua hang', 'cua ham', 'window'];

// A following number cancels the match: "mở cửa số 2" is door number 2, not a window.
// Vietnamese "sổ" and "số" are the same token once the tones are gone, so the phrase alone
// cannot tell them apart — but "cửa sổ" is never followed by a bare number, and "cửa số"
// always is. Blacklisting the bare word "số" instead, an earlier attempt, broke
// "bật đèn số 2" as well.
function namesNonDevice(normalizedText) {
  const tokens = String(normalizedText).split(' ').filter(Boolean);
  return NON_DEVICE_PHRASES.some((phrase) => {
    const words = phrase.split(' ');
    for (let start = 0; start + words.length <= tokens.length; start += 1) {
      let hit = true;
      for (let k = 0; k < words.length; k += 1) {
        if (tokens[start + k] !== words[k]) { hit = false; break; }
      }
      const next = tokens[start + words.length];
      if (hit && !(next && /^[0-9]+$/.test(next))) return true;
    }
    return false;
  });
}

// Tokens of the utterance, as a set. Word-level matching, not substring: `includes`
// made "room" match inside "bedroom", so "switch on bedroom light" scored 1 for BOTH
// "Living Room Light" and "Bedroom Light" and came out ambiguous.
function wordsOf(text) {
  return new Set(String(text).split(' ').filter(Boolean));
}

function nameWords(name) {
  return normalizeText(name).split(' ').filter(Boolean);
}

// How many of a device's distinguishing words the utterance actually contains.
// Single-character tokens are kept on purpose: "Đèn 1" / "Đèn 2" is the most common way
// people name several identical devices, and dropping "1"/"2" made every such command
// resolve to whichever device happened to come first.
function scoreDeviceName(deviceName, commandText) {
  const spoken = wordsOf(commandText);
  return nameWords(deviceName)
    .filter((word) => !GENERIC_WORDS.has(word) && spoken.has(word))
    .length;
}

// Every way this home's places can be named: the rooms and the candidate devices, each as
// a PHRASE rather than a bag of words, plus the fixed lexicons above.
//
// Phrases, not words, because a word bag over-matches badly. The seed home has a room
// "Nhà bếp", which as a bag contributes "nha" — and "nhà"/"nhá" are the same token once
// diacritics are gone, so "bật đèn phòng khách nhá anh" was read as naming the kitchen and
// refused. As a phrase, "nha bep" has to actually appear.
function placePhrases(names) {
  const phrases = [];
  names.forEach((name) => {
    const words = nameWords(name).filter((word) => !GENERIC_WORDS.has(word));
    if (words.length) phrases.push(words);
  });
  PLACE_PHRASES.forEach((phrase) => phrases.push(phrase.split(' ')));
  PLACE_WORDS.forEach((word) => phrases.push([word]));
  return phrases;
}

// Which tokens participate in a named place, or are a bare number ("đèn 2").
function markPlaceTokens(tokens, phrases) {
  const marked = new Array(tokens.length).fill(false);
  tokens.forEach((token, index) => {
    if (/^[0-9]+$/.test(token)) marked[index] = true;
  });
  phrases.forEach((phrase) => {
    if (!phrase.length) return;
    for (let start = 0; start + phrase.length <= tokens.length; start += 1) {
      let hit = true;
      for (let k = 0; k < phrase.length; k += 1) {
        if (tokens[start + k] !== phrase[k]) { hit = false; break; }
      }
      if (hit) for (let k = 0; k < phrase.length; k += 1) marked[start + k] = true;
    }
  });
  return marked;
}

// The words that actually qualify the device, as opposed to words that merely look like
// place names somewhere else in the sentence.
//
// This is the second half of the fix, and it is what a pure lexicon can never do. Vietnamese
// with the tones stripped is full of collisions — "ngủ" (sleep) and "phòng ngủ" (bedroom)
// are the SAME token, so no word list can tell "tắt đèn rồi đi ngủ" from "tắt đèn phòng
// ngủ". Position can: a qualifier sits next to the device noun, in an unbroken run of
// generic and place words. "rồi" breaks that run, "phòng" does not.
function qualifierRun(tokens, marked) {
  let anchor = -1;
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    if (DEVICE_NOUNS.has(tokens[i])) { anchor = i; break; }
  }

  let low = 0;
  let high = tokens.length - 1;
  if (anchor !== -1) {
    low = anchor;
    high = anchor;
    const partOfRun = (i) => GENERIC_WORDS.has(tokens[i]) || marked[i];
    while (low - 1 >= 0 && partOfRun(low - 1)) low -= 1;
    while (high + 1 < tokens.length && partOfRun(high + 1)) high += 1;
  }

  const qualifiers = [];
  for (let i = low; i <= high; i += 1) {
    if (marked[i] && !GENERIC_WORDS.has(tokens[i]) && !qualifiers.includes(tokens[i])) {
      qualifiers.push(tokens[i]);
    }
  }
  return qualifiers;
}

function qualifiersOf(normalizedText, devices, vocabulary) {
  const tokens = String(normalizedText).split(' ').filter(Boolean);
  const phrases = placePhrases([
    ...devices.map((device) => device.name),
    ...vocabulary,
  ]);
  return qualifierRun(tokens, markPlaceTokens(tokens, phrases));
}

// Words that point at a specific place but match no device in the home at all.
// Exported for tests, and for the reason it was written: it is the one signal separating
// "the user asked for something this home does not have" from "the user just talked".
function unmatchedQualifiers(commandText, devices, vocabulary = []) {
  const known = new Set(devices.flatMap((device) => nameWords(device.name)));
  return qualifiersOf(commandText, devices, vocabulary).filter(
    (word) => !known.has(word),
  );
}

// Picks the device an utterance refers to, or null when it cannot be told apart.
//
// `.sort()[0]` always returns something, so "bật đèn nhà bếp" (no kitchen light exists)
// used to turn on the living-room light and report success. FOUR earlier attempts each
// passed their own tests and still leaked:
//   1. "refuse when the top score is 0"  — missed "bật đèn phòng bếp": nearly every
//      Vietnamese device name contains "phòng", so nothing ever scored 0.
//   2. "...and there is a tie"           — missed asymmetric names, where a clear winner
//      emerged on a word identifying neither device.
//   3. "refuse on any unmatched word, pooled across all device names, unless only one
//      device exists" — pooling let a WRONG room word count as matched because it belonged
//      to a different device's name; and the single-device shortcut ran before the guard,
//      voiding the fix entirely on this project's own seed data (one device per type).
//      It also leaned on a hand-written filler whitelist and refused 11 of 15 normal
//      phrases, because filler in a natural language is unbounded and a whitelist is not.
//   4. "a word may only refuse if it is a known place word or a name in this home" —
//      right idea, wrong granularity. Word bags over-matched ("Nhà bếp" made every "nhá"
//      a kitchen reference; "Cảm biến ánh sáng bếp" made "ánh" and "sáng" place names),
//      and single place words collided with everyday speech once tones were stripped.
//
// Attempt 5 keeps the polarity of 4 — only a real place refuses, everything unknown is
// assumed to be filler and ignored — and fixes the granularity three ways: places are
// matched as PHRASES, only tokens in the run ADJACENT TO THE DEVICE NOUN count, and the
// vocabulary is drawn from rooms and same-type devices only, never from sensors.
function selectDevice(devices, normalizedText, vocabulary = []) {
  if (devices.length === 0) return null;

  // "mở cửa sổ" is a window, not the front door.
  if (namesNonDevice(normalizedText)) return null;

  const ranked = devices
    .map((candidate) => ({
      candidate,
      score: scoreDeviceName(candidate.name, normalizedText),
    }))
    .sort((left, right) => right.score - left.score);
  const outright = ranked.length === 1 || ranked[0].score > ranked[1].score;

  const qualifiers = qualifiersOf(normalizedText, devices, vocabulary);

  // Nothing next to the device noun points at a particular device — "bật đèn", "tắt hết
  // đèn trong nhà", "cho quạt chạy đi". Take a clear winner if the names give one (English
  // puts the qualifier BEFORE the noun, e.g. "switch on bedroom light"), else any device
  // of that type is a fair answer.
  if (qualifiers.length === 0) return outright ? ranked[0].candidate : devices[0];

  // Two devices fit equally well — "bật đèn phòng khách và phòng ngủ", or a qualifier
  // belonging to neither. Guessing here is exactly the original bug.
  if (!outright) return null;

  // The user named a place, and the best-matching device is not in it.
  const winnerWords = new Set(nameWords(ranked[0].candidate.name));
  if (qualifiers.some((word) => !winnerWords.has(word))) return null;

  return ranked[0].candidate;
}

async function recordUnknownCommand(userId, recognizedText, intent) {
  const voiceCommand = await prisma.voice_commands.create({
    data: {
      user_id: Number(userId),
      recognized_text: recognizedText,
      intent: intent ? `${intent.action}:${intent.deviceType}` : undefined,
      confidence_score: intent ? intent.confidence : undefined,
      execution_status: 'unknown_command',
    },
  });
  return { voiceCommand, action: null };
}

async function executeVoiceCommand(userId, recognizedText, homeId) {
  if (typeof recognizedText !== 'string' || !recognizedText.trim()) {
    throw new HttpError(400, 'text is required');
  }
  if (!homeId) {
    throw new HttpError(400, 'homeId is required');
  }
  const home = await requireHome(userId, homeId);
  const trimmedText = recognizedText.trim();

  let intent;
  try {
    intent = await voiceIntentClient.classifyIntent(trimmedText);
  } catch (error) {
    if (error instanceof HttpError && error.status === 422) {
      return recordUnknownCommand(userId, trimmedText, null);
    }
    throw error;
  }

  const normalized = normalizeText(trimmedText);
  // Candidate devices plus every room name. The rooms feed the place vocabulary, so a
  // command naming a room that exists but holds no device of this type is refused rather
  // than silently redirected to whichever device happens to come first.
  const [homeDevices, rooms] = await Promise.all([
    prisma.devices.findMany({
      where: { home_id: home.id, device_type: intent.deviceType },
      orderBy: { id: 'asc' },
    }),
    prisma.rooms.findMany({
      where: { home_id: home.id },
      select: { name: true },
    }),
  ]);
  const devices = homeDevices;
  // Rooms only — NOT the names of other devices. Sensors in particular are never the
  // target of a voice command, and their names are long and descriptive: the seed home's
  // "Cảm biến ánh sáng bếp" put "ánh" and "sáng" into the place vocabulary, so "bật đèn
  // cho sáng" was read as naming a place and refused. Rooms already carry every place a
  // device can be in, which is the only thing this vocabulary is for.
  const vocabulary = rooms.map((room) => room.name);

  const device = selectDevice(devices, normalized, vocabulary);

  if (!device) {
    return recordUnknownCommand(userId, trimmedText, intent);
  }

  // Doors don't open on voice alone — recognize the intent but require the caller to
  // confirm via face/PIN (POST /api/door-access/verify-face|verify-pin) before it's queued.
  if (device.device_type === 'door') {
    const voiceCommand = await prisma.voice_commands.create({
      data: {
        user_id: Number(userId),
        device_id: device.id,
        recognized_text: trimmedText,
        intent: `${intent.action}:${intent.deviceType}`,
        confidence_score: intent.confidence,
        execution_status: 'requires_verification',
      },
    });
    return { voiceCommand, action: null, device, requiresVerification: true };
  }

  const voiceCommand = await prisma.voice_commands.create({
    data: {
      user_id: Number(userId),
      device_id: device.id,
      recognized_text: trimmedText,
      intent: `${intent.action}:${intent.deviceType}`,
      confidence_score: intent.confidence,
      execution_status: 'success',
    },
  });

  let command;
  try {
    command = await createDeviceCommand(userId, device.id, intent.action, 'voice');
  } catch (error) {
    await prisma.voice_commands.update({
      where: { id: voiceCommand.id },
      data: { execution_status: 'failed' },
    });
    throw error;
  }

  return { voiceCommand, action: command.action, device };
}

module.exports = {
  normalizeText,
  scoreDeviceName,
  unmatchedQualifiers,
  selectDevice,
  executeVoiceCommand,
};
