const axios = require('axios');
const FormData = require('form-data');
const HttpError = require('../utils/http-error');

const DEFAULT_MATCH_THRESHOLD = 0.6;

function baseUrl() {
  return process.env.AI_SERVICE_URL;
}

function headers(form) {
  return { ...form.getHeaders(), 'X-API-Key': process.env.AI_SERVICE_API_KEY };
}

function matchThreshold() {
  const configured = Number(process.env.FACE_MATCH_THRESHOLD);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MATCH_THRESHOLD;
}

async function isFaceIdReady() {
  try {
    const res = await axios.get(`${baseUrl()}/api/face-id/health`, { timeout: 3000 });
    return res.data.status === 'ok' && res.data.modelsLoaded === true;
  } catch {
    return false;
  }
}

// 422 = a real, user-facing detection problem (no face / multiple faces) — pass it through.
// Anything else (400/401 = Node-side bug, 500/timeout/connection error = service down) is not
// the caller's fault; surface it uniformly as "Face ID unavailable" so callers fall back to PIN
// without counting it toward the failed-attempt lockout.
function rethrowAiServiceError(err) {
  if (err.response && err.response.status === 422) {
    const data = err.response.data || {};
    throw new HttpError(422, data.message || 'Face detection failed', data.details);
  }

  console.error(
    'ai-service face-id error:',
    err.response ? `${err.response.status} ${JSON.stringify(err.response.data)}` : err.message
  );
  throw new HttpError(503, 'Face ID hiện không khả dụng, dùng mã PIN để mở cửa', { faceIdUnavailable: true });
}

async function enrollFace(imageBuffer, filename = 'face.jpg', contentType = 'image/jpeg') {
  const form = new FormData();
  form.append('image', imageBuffer, { filename, contentType });

  try {
    const res = await axios.post(`${baseUrl()}/api/face-id/enroll`, form, {
      headers: headers(form),
      timeout: 5000,
    });
    return res.data.embedding;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    rethrowAiServiceError(err);
  }
}

async function verifyFace(frameBuffers, candidates, threshold = matchThreshold()) {
  const form = new FormData();
  frameBuffers.forEach((buf, i) => form.append('images', buf, { filename: `frame${i}.jpg`, contentType: 'image/jpeg' }));
  form.append('threshold', String(threshold));
  form.append('candidates', JSON.stringify(candidates));

  try {
    const res = await axios.post(`${baseUrl()}/api/face-id/verify`, form, {
      headers: headers(form),
      timeout: 8000,
    });
    return res.data; // { isLive, livenessScore, matched: {id, distance} | null, distance }
  } catch (err) {
    if (err instanceof HttpError) throw err;
    rethrowAiServiceError(err);
  }
}

module.exports = { isFaceIdReady, enrollFace, verifyFace, matchThreshold };
