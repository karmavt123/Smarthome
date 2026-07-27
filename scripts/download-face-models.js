const fs = require('fs');
const path = require('path');
const https = require('https');

const MODELS_DIR = path.join(__dirname, '..', 'weights', 'face-api');
const BASE_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';

const FILES = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'ssd_mobilenetv1_model-shard2',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
];

function download(url, destination) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`${response.statusCode} for ${url}`));
          return;
        }
        const file = fs.createWriteStream(destination);
        response.pipe(file);
        file.on('finish', () => file.close(resolve));
      })
      .on('error', reject);
  });
}

async function main() {
  fs.mkdirSync(MODELS_DIR, { recursive: true });

  const missing = FILES.filter((name) => !fs.existsSync(path.join(MODELS_DIR, name)));
  if (missing.length === 0) {
    console.log('face-api.js model weights already present, skipping download.');
    return;
  }

  console.log(`Downloading ${missing.length} face-api.js model file(s) into ${MODELS_DIR} ...`);
  for (const name of missing) {
    try {
      await download(`${BASE_URL}/${name}`, path.join(MODELS_DIR, name));
      console.log(`  ok: ${name}`);
    } catch (error) {
      console.warn(`  failed: ${name} (${error.message})`);
      console.warn('Face ID enrollment/verification will fail to load models until this is retried.');
      console.warn('Retry with: node scripts/download-face-models.js');
    }
  }
}

main();
