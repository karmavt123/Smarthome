// Downloads the face-api.js model weights used for client-side face detection
// (auto-capture in AddFaceProfileForm/UnlockFaceId). Not bundled in the
// face-api.js npm package — same reason the backend has its own
// scripts/download-face-models.js (see docs/FACE-ID-USAGE.md).
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BASE_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'models');

const FILES = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_tiny_model-weights_manifest.json',
  'face_landmark_68_tiny_model-shard1',
];

async function download(file) {
  const res = await fetch(`${BASE_URL}/${file}`);
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(path.join(OUT_DIR, file), buffer);
  console.log(`  ${file} (${buffer.length} bytes)`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`Downloading face-api.js models to ${OUT_DIR}`);
  for (const file of FILES) {
    await download(file);
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error('Failed to download face-api.js models:', err.message);
  console.error('Run again with network access, or manually place files in public/models/.');
  process.exit(1);
});
