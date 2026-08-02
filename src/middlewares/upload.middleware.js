const multer = require('multer');
const HttpError = require('../utils/http-error');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];
const MAX_VERIFY_FRAMES = 5;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter(req, file, cb) {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new HttpError(422, 'image must be a jpeg or png file'));
    }
    cb(null, true);
  },
});

function faceImageUpload(req, res, next) {
  upload.single('image')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(new HttpError(422, `image must be smaller than ${MAX_IMAGE_BYTES / 1024 / 1024}MB`));
    }
    return next(error);
  });
}

// verify-face sends 1-5 consecutive camera frames (field "images") instead of a single
// still photo — multiple frames is the ai-service's baseline defense against video replay.
function faceFramesUpload(req, res, next) {
  upload.array('images', MAX_VERIFY_FRAMES)(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(new HttpError(422, `each image must be smaller than ${MAX_IMAGE_BYTES / 1024 / 1024}MB`));
    }
    if (error instanceof multer.MulterError && error.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(new HttpError(400, `at most ${MAX_VERIFY_FRAMES} image frames allowed`));
    }
    return next(error);
  });
}

module.exports = {
  faceImageUpload,
  faceFramesUpload,
  MAX_IMAGE_BYTES,
  MAX_VERIFY_FRAMES,
  ALLOWED_MIME_TYPES,
};
