const {
  normalizeText,
  scoreDeviceName,
  unmatchedQualifiers,
  selectDevice,
} = require('../src/services/voice-command.service');

describe('voice command text helpers', () => {
  test('normalizes Vietnamese diacritics', () => {
    expect(normalizeText('Bật đèn phòng khách!')).toBe('bat den phong khach');
  });

  test('prefers a device name mentioned in the command', () => {
    expect(scoreDeviceName('Living Room Light', 'turn on living room light')).toBeGreaterThan(
      scoreDeviceName('Kitchen Light', 'turn on living room light')
    );
  });
});

// Regression cover for the "wrong device" bug. Three attempts were needed, and each
// earlier one passed its own tests while still leaking — the device sets below are chosen
// specifically to break the earlier rules:
//   attempt 1: "refuse when the top score is 0" — missed `lightsSamePrefix`, because every
//              Vietnamese device name contains "phòng" so nothing ever scores 0.
//   attempt 2: "...and there is a tie"          — missed `lightsAsymmetric`, where one name
//              contains "phòng" and the other does not, so there is a clear winner on a
//              word that identifies neither device.
describe('selectDevice', () => {
  const lightsSamePrefix = [{ name: 'Den phong khach' }, { name: 'Den phong ngu' }];
  const lightsAsymmetric = [{ name: 'Den phong khach' }, { name: 'Den san vuon' }];
  const lightsKitchen = [{ name: 'Den phong khach' }, { name: 'Den bep' }];
  const lightsNumbered = [{ name: 'Den 1' }, { name: 'Den 2' }, { name: 'Den 3' }];
  const lightsEnglish = [{ name: 'Living Room Light' }, { name: 'Bedroom Light' }];
  const lightsLetters = [{ name: 'Den B' }, { name: 'Den A' }];
  const fans = [{ name: 'Quat phong khach' }, { name: 'Quat phong ngu' }];
  const doors = [{ name: 'Cua chinh' }, { name: 'Cua servo' }];
  const oneLight = [{ name: 'Den phong khach' }];

  const pick = (text, devices, vocabulary = []) => {
    const device = selectDevice(devices, normalizeText(text), vocabulary.map(normalizeText));
    return device ? device.name : null;
  };

  test.each([
    // Names no place at all — any device of that type is a fair answer.
    ['bat den', lightsSamePrefix, 'Den phong khach'],
    ['bat den giup toi', lightsSamePrefix, 'Den phong khach'],
    ['cho toi bat cai den len', lightsSamePrefix, 'Den phong khach'],
    ['lam on mo den giup toi', lightsSamePrefix, 'Den phong khach'],
    ['tat het den trong nha', lightsSamePrefix, 'Den phong khach'],
    ['sang den len', lightsSamePrefix, 'Den phong khach'],
    ['toi den di', lightsSamePrefix, 'Den phong khach'],
    ['bat quat len', fans, 'Quat phong khach'],
    ['cho quat chay di', fans, 'Quat phong khach'],
    ['dung quat lai', fans, 'Quat phong khach'],
    ['mo cua ra', doors, 'Cua chinh'],
    ['dong cua lai giup toi', doors, 'Cua chinh'],
    ['khoa cua', doors, 'Cua chinh'],
    // Names a place that exists — that exact device wins.
    ['bat den phong khach', lightsSamePrefix, 'Den phong khach'],
    ['bat den phong ngu', lightsSamePrefix, 'Den phong ngu'],
    ['tat quat phong ngu', fans, 'Quat phong ngu'],
    // A clear winner survives stray time words around it.
    ['bat den phong khach ngay bay gio', lightsSamePrefix, 'Den phong khach'],
    // Single-character labels must survive tokenising: "Đèn 1"/"Đèn 2" is how people
    // name identical devices, and dropping "1"/"2" sent every one of these to Den 1.
    ['bat den 1', lightsNumbered, 'Den 1'],
    ['bat den 2', lightsNumbered, 'Den 2'],
    ['bat den 3', lightsNumbered, 'Den 3'],
    // Word-level matching, not substring: "room" must not match inside "bedroom".
    ['switch on bedroom light', lightsEnglish, 'Bedroom Light'],
    ['turn on the light', lightsEnglish, 'Living Room Light'],
    ['turn on the living room lights', lightsEnglish, 'Living Room Light'],
    ['turn on living room light now', lightsEnglish, 'Living Room Light'],
    // "a" must stay OUT of the generic set: attempt 3 put it there to absorb the English
    // article, which made "bat den a" resolve to "Den B" (first by score tie).
    ['bat den a', lightsLetters, 'Den A'],
    ['bat den b', lightsLetters, 'Den B'],
    ['turn on a light', lightsEnglish, 'Living Room Light'],
    // A qualifier that names one device must beat a qualifier-shaped prefix on another.
    // Attempt 3 pooled qualifiers across every candidate, so "bep" counted as "matched"
    // because it belonged to the OTHER device, and the 1-1 tie fell through to the first.
    ['bat den phong bep', lightsKitchen, 'Den bep'],
    ['bat den phong khach', lightsKitchen, 'Den phong khach'],
    // Ordinary phrasing must survive. A filler whitelist could never cover this, which is
    // why the rule was inverted: only a known place word or a real name here can refuse.
    ['bat den phong khach nhanh len', lightsSamePrefix, 'Den phong khach'],
    ['bat den phong khach mot chut xiu nua', lightsSamePrefix, 'Den phong khach'],
    ['bat den phong khach giup em voi', lightsSamePrefix, 'Den phong khach'],
    ['ban co the bat den phong khach duoc khong', lightsSamePrefix, 'Den phong khach'],
    ['bat den phong khach di ma', lightsSamePrefix, 'Den phong khach'],
  ])('%j -> %s', (text, devices, expected) => {
    expect(pick(text, devices)).toBe(expected);
  });

  test.each([
    ['bat den nha bep', lightsSamePrefix],
    ['bat den phong bep', lightsSamePrefix],
    ['mo den phong tam', lightsSamePrefix],
    ['bat den phong an', lightsSamePrefix],
    ['tat quat phong bep', fans],
    ['mo cua so', doors],
    // These four leaked past attempt 2: asymmetric names give a clear winner.
    ['bat den phong tam', lightsAsymmetric],
    ['bat den phong bep', lightsAsymmetric],
    ['bat den phong ngu', lightsAsymmetric],
    ['tat den phong an', lightsAsymmetric],
    ['bat den phong ngu', lightsKitchen],
    // A home with exactly one device of a type is what seed.js and bootstrap-board.js
    // actually create, and attempt 3 short-circuited on `devices.length === 1` BEFORE the
    // guard ran — so on the project's own data the fix did nothing. "bat den nha bep" was
    // asserted here as a correct resolution; it never was.
    ['bat den nha bep', oneLight],
    ['bat den phong ngu', oneLight],
    ['bat den phong tam', oneLight],
    ['bat den 2', oneLight],
  ])('refuses %j — the place named does not exist in this home', (text, devices) => {
    expect(pick(text, devices)).toBeNull();
  });

  // Rooms and devices of OTHER types widen the vocabulary. A word that names something
  // real in this home must be able to refuse, even when no device of the asked-for type
  // carries it — otherwise "bat den phong ngu" in a home whose bedroom has only a fan
  // silently switches on the living-room light.
  test.each([
    ['bat den phong ngu', oneLight, ['Quat phong ngu']],
    ['bat den phong tho', oneLight, ['Phong tho']],
  ])('refuses %j when %j names something else in this home', (text, devices, vocabulary) => {
    expect(pick(text, devices, vocabulary)).toBeNull();
  });

  test('a compound that names a different object is not a device command', () => {
    // "cua so" is a window. Blacklisting the bare word "so" instead broke "bat den so 2".
    expect(pick('mo cua so', doors)).toBeNull();
    expect(pick('bat den so 2', lightsNumbered)).toBe('Den 2');
    // ...but "cua so 2" is door number 2. "sổ" and "số" are the same token once the tones
    // are stripped; a following number is what tells them apart.
    expect(pick('mo cua so 2', [{ name: 'Cua 1' }, { name: 'Cua 2' }])).toBe('Cua 2');
  });

  // Everything below is the project's REAL data. prisma/seed.js and prisma/bootstrap-board.js
  // give each home ONE device per type, with rooms the devices do not all live in — the exact
  // shape every earlier attempt got wrong.
  const seedHome = {
    devices: [{ name: 'Đèn phòng khách' }],
    rooms: ['Phòng khách', 'Phòng ngủ', 'Nhà bếp'],
  };

  test.each([
    ['bật đèn phòng ngủ'],
    ['bật đèn nhà bếp'],
    ['bật đèn phòng tắm'],
    ['mở đèn phòng ăn'],
    ['bật đèn ban công'],
    ['bật đèn số 2'],
  ])('real seed data refuses %j', (text) => {
    expect(pick(text, seedHome.devices, seedHome.rooms)).toBeNull();
  });

  // The mirror image, and the reason attempt 4 was thrown away: it refused 14 of these.
  // Vietnamese with the tones stripped collides constantly — "ngủ"(sleep)/"phòng ngủ",
  // "nhá"(particle)/"nhà bếp", "tăng"/"tầng", "lâu"/"lầu", "công tắc"/"ban công" — so a
  // word list alone can never decide. Position does: a qualifier sits NEXT TO the device
  // noun, and "rồi", "cho", "cảm" break that run.
  test.each([
    ['bật đèn'],
    ['tắt hết đèn trong nhà'],
    ['bật đèn cho sáng'],
    ['mở đèn lên cho sáng nhà'],
    ['bật đèn phòng khách nhá anh'],
    ['tắt đèn rồi đi ngủ'],
    ['tắt đèn đi ngủ thôi'],
    ['tắt tạm cái đèn'],
    ['tắt đèn lâu rồi bật lại đi'],
    ['bật công tắc đèn'],
    ['bật công tắc đèn phòng khách'],
    ['bật đèn cảm ơn bạn'],
    ['bật đèn chơi cho vui'],
    ['bật đèn giúp anh với'],
    ['mở đèn hộ em cái'],
    ['bật đèn nhá'],
    ['bật đèn phòng khách ngay bây giờ'],
  ])('real seed data still resolves %j', (text) => {
    expect(pick(text, seedHome.devices, seedHome.rooms)).toBe('Đèn phòng khách');
  });
});

describe('unmatchedQualifiers', () => {
  const devices = [{ name: 'Den phong khach' }, { name: 'Den phong ngu' }];

  test('a bare command names nothing specific', () => {
    expect(unmatchedQualifiers(normalizeText('bat den'), devices)).toEqual([]);
  });

  test('politeness, scope and time words are not device qualifiers', () => {
    expect(unmatchedQualifiers(normalizeText('bat den giup toi'), devices)).toEqual([]);
    expect(unmatchedQualifiers(normalizeText('tat het den trong nha'), devices)).toEqual([]);
    expect(unmatchedQualifiers(normalizeText('bat den ngay bay gio'), devices)).toEqual([]);
  });

  test('a place that matches no device is reported', () => {
    expect(unmatchedQualifiers(normalizeText('bat den phong bep'), devices)).toContain('bep');
  });
});

describe('scoreDeviceName', () => {
  test('matches whole words, not substrings', () => {
    // "room" is a substring of "bedroom"; a substring match made both English lights
    // score equally and the command came out ambiguous.
    const spoken = normalizeText('switch on bedroom light');
    expect(scoreDeviceName('Bedroom Light', spoken)).toBeGreaterThan(
      scoreDeviceName('Living Room Light', spoken)
    );
  });

  test('counts single-character labels', () => {
    expect(scoreDeviceName('Den 2', normalizeText('bat den 2'))).toBe(1);
    expect(scoreDeviceName('Den 1', normalizeText('bat den 2'))).toBe(0);
  });
});
