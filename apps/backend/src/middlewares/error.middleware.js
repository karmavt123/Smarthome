const serialize = require('../utils/serialize');

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const status = error.status || 500;
  if (status >= 500) console.error(error);

  return res.status(status).json(
    serialize({
      message: status >= 500 ? 'Internal server error' : error.message,
      ...(error.details ? { details: error.details } : {}),
    })
  );
}

module.exports = errorHandler;
