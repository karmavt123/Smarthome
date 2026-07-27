const humps = require('humps');

function caseConversion(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = humps.decamelizeKeys(req.body);
  }
  // req.query is NOT handled here: in Express 5, `req.query` is a getter with no
  // setter (and re-parses `req.url` on every access), so `req.query = ...` silently
  // no-ops. Query-string decamelization is done upstream via `app.set('query parser', ...)`
  // in app.js instead.

  const originalJson = res.json.bind(res);
  res.json = (data) => originalJson(humps.camelizeKeys(data));

  next();
}

module.exports = caseConversion;
