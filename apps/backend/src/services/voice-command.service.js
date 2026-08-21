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

function scoreDeviceName(deviceName, commandText) {
  const ignored = new Set([
    'bat', 'tat', 'mo', 'dong', 'khoa', 'on', 'off', 'open', 'close', 'lock',
    'start', 'stop', 'den', 'light', 'quat', 'fan', 'cua', 'door',
  ]);
  return normalizeText(deviceName)
    .split(' ')
    .filter((word) => word.length > 1 && !ignored.has(word) && commandText.includes(word))
    .length;
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
  const devices = await prisma.devices.findMany({
    where: {
      device_type: intent.deviceType,
      home_id: home.id,
    },
    orderBy: { id: 'asc' },
  });

  const device = devices
    .map((candidate) => ({
      candidate,
      score: scoreDeviceName(candidate.name, normalized),
    }))
    .sort((left, right) => right.score - left.score)[0]?.candidate;

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

module.exports = { normalizeText, scoreDeviceName, executeVoiceCommand };
