const humps = require('humps');

function caseConversion(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = humps.decamelizeKeys(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = humps.decamelizeKeys(req.query);
  }

  const originalJson = res.json.bind(res);
  res.json = (data) => originalJson(humps.camelizeKeys(data));

  next();
}

module.exports = caseConversion;
