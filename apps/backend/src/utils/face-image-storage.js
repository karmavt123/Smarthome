const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads', 'faces');
const EXT_BY_MIME = { 'image/jpeg': '.jpg', 'image/png': '.png' };

function saveFaceImage(buffer, mimetype) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const filename = `${crypto.randomUUID()}${EXT_BY_MIME[mimetype] || '.jpg'}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
  return filename;
}

function deleteFaceImage(filename) {
  if (!filename) return;
  fs.rm(path.join(UPLOADS_DIR, filename), { force: true }, () => {});
}

function faceImageUrl(req, filename) {
  return `${req.protocol}://${req.get('host')}/uploads/faces/${filename}`;
}

module.exports = { saveFaceImage, deleteFaceImage, faceImageUrl };
