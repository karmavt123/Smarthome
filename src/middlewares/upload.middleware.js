const multer = require('multer');
const HttpError = require('../utils/http-error');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];

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

module.exports = { faceImageUpload, MAX_IMAGE_BYTES, ALLOWED_MIME_TYPES };
