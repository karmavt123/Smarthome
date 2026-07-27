const path = require('path');
const { Canvas, Image, ImageData, loadImage } = require('canvas');
const faceapi = require('face-api.js');
const HttpError = require('../utils/http-error');

faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const MODELS_DIR = path.join(__dirname, '..', '..', 'weights', 'face-api');
const DEFAULT_MATCH_THRESHOLD = 0.6;

let modelsLoaded = null;

function matchThreshold() {
  const configured = Number(process.env.FACE_MATCH_THRESHOLD);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MATCH_THRESHOLD;
}

async function loadModels() {
  if (!modelsLoaded) {
    modelsLoaded = Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_DIR),
      faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_DIR),
      faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_DIR),
    ]);
  }
  return modelsLoaded;
}

async function computeFaceDescriptor(imageBuffer) {
  await loadModels();

  const image = await loadImage(imageBuffer).catch(() => {
    throw new HttpError(422, 'Không đọc được ảnh, kiểm tra định dạng và thử lại');
  });

  const detections = await faceapi
    .detectAllFaces(image)
    .withFaceLandmarks()
    .withFaceDescriptors();

  if (detections.length === 0) {
    throw new HttpError(422, 'Không phát hiện khuôn mặt trong ảnh, chụp lại');
  }
  if (detections.length > 1) {
    throw new HttpError(422, 'Ảnh có nhiều hơn 1 khuôn mặt, chụp lại');
  }

  return Array.from(detections[0].descriptor);
}

function euclideanDistance(embeddingA, embeddingB) {
  if (embeddingA.length !== embeddingB.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < embeddingA.length; i += 1) {
    sum += (embeddingA[i] - embeddingB[i]) ** 2;
  }
  return Math.sqrt(sum);
}

function findBestMatch(candidateEmbedding, profiles) {
  let best = null;
  for (const profile of profiles) {
    const embedding = JSON.parse(profile.face_embedding);
    const distance = euclideanDistance(candidateEmbedding, embedding);
    if (!best || distance < best.distance) best = { profile, distance };
  }
  return best;
}

module.exports = {
  matchThreshold,
  loadModels,
  computeFaceDescriptor,
  euclideanDistance,
  findBestMatch,
};
