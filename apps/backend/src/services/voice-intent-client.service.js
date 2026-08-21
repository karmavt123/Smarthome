const axios = require('axios');
const HttpError = require('../utils/http-error');

function baseUrl() {
  return process.env.AI_SERVICE_URL;
}

function headers() {
  return { 'X-API-Key': process.env.AI_SERVICE_API_KEY };
}

// 422 = ai-service understood the request but couldn't classify an intent confidently —
// a real business result, pass it through. Everything else (400/401 = Node-side bug,
// 500/timeout/connection refused = service down) is not the caller's fault, so it's
// collapsed to a uniform 503 the caller can surface without treating it as a bad command.
function rethrowAiServiceError(err) {
  if (err.response && err.response.status === 422) {
    const data = err.response.data || {};
    throw new HttpError(422, data.message || 'Voice command intent not recognized', data.details);
  }

  console.error(
    'ai-service voice-intent error:',
    err.response ? `${err.response.status} ${JSON.stringify(err.response.data)}` : err.message
  );
  throw new HttpError(503, 'Nhận diện lệnh giọng nói hiện không khả dụng', { voiceIntentUnavailable: true });
}

async function classifyIntent(text) {
  try {
    const res = await axios.post(
      `${baseUrl()}/api/voice/intent`,
      { text },
      { headers: headers(), timeout: 3000 }
    );
    return res.data; // { deviceType, action, confidence }
  } catch (err) {
    if (err instanceof HttpError) throw err;
    rethrowAiServiceError(err);
  }
}

module.exports = { classifyIntent };
