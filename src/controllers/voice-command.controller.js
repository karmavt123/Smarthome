const voiceCommandService = require('../services/voice-command.service');
const serialize = require('../utils/serialize');

async function create(req, res) {
  const result = await voiceCommandService.executeVoiceCommand(
    req.user.sub,
    req.body.recognized_text
  );
  res.status(result.action ? 202 : 200).json(serialize(result));
}

module.exports = { create };
