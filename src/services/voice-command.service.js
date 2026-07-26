const prisma = require('../config/prisma');
const HttpError = require('../utils/http-error');
const { createDeviceCommand } = require('./device-command.service');

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

function parseVoiceIntent(text) {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  let deviceType;
  if (/\b(den|light)\b/.test(normalized)) deviceType = 'light';
  else if (/\b(quat|fan)\b/.test(normalized)) deviceType = 'fan';
  else if (/\b(cua|door)\b/.test(normalized)) deviceType = 'door';
  else return null;

  let action;
  if (deviceType === 'door' && /\b(mo|open)\b/.test(normalized)) action = 'open';
  else if (deviceType === 'door' && /\b(dong|khoa|close|lock)\b/.test(normalized)) action = 'close';
  else if (deviceType !== 'door' && /\b(bat|on|start)\b/.test(normalized)) action = 'turn_on';
  else if (deviceType !== 'door' && /\b(tat|off|stop)\b/.test(normalized)) action = 'turn_off';
  else return null;

  return { normalized, deviceType, action };
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

async function executeVoiceCommand(userId, recognizedText) {
  if (typeof recognizedText !== 'string' || !recognizedText.trim()) {
    throw new HttpError(400, 'recognizedText is required');
  }

  const intent = parseVoiceIntent(recognizedText);
  if (!intent) {
    const voiceCommand = await prisma.voice_commands.create({
      data: {
        user_id: Number(userId),
        recognized_text: recognizedText.trim(),
        execution_status: 'unknown_command',
      },
    });
    return { voiceCommand, action: null };
  }

  const devices = await prisma.devices.findMany({
    where: {
      device_type: intent.deviceType,
      homes: { user_id: Number(userId) },
    },
    orderBy: { id: 'asc' },
  });

  const device = devices
    .map((candidate) => ({
      candidate,
      score: scoreDeviceName(candidate.name, intent.normalized),
    }))
    .sort((left, right) => right.score - left.score)[0]?.candidate;

  if (!device) {
    const voiceCommand = await prisma.voice_commands.create({
      data: {
        user_id: Number(userId),
        recognized_text: recognizedText.trim(),
        intent: `${intent.action}:${intent.deviceType}`,
        confidence_score: 0.5,
        execution_status: 'unknown_command',
      },
    });
    return { voiceCommand, action: null };
  }

  const voiceCommand = await prisma.voice_commands.create({
    data: {
      user_id: Number(userId),
      device_id: device.id,
      recognized_text: recognizedText.trim(),
      intent: `${intent.action}:${intent.deviceType}`,
      confidence_score: 0.9,
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

module.exports = { normalizeText, parseVoiceIntent, scoreDeviceName, executeVoiceCommand };
