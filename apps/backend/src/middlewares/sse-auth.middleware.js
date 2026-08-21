const jwt = require('jsonwebtoken');

// EventSource can't set custom headers, so the access token also arrives via
// ?token= on the stream URL. Kept separate from auth.middleware.js's
// requireAuth so every other route still requires a real Authorization header.
function requireAuthSSE(req, res, next) {
  const header = req.headers.authorization;
  const headerToken = header && header.startsWith('Bearer ') ? header.slice(7) : null;
  const token = headerToken || req.query.token;

  if (!token) return res.status(401).json({ message: 'Missing access token' });

  try {
    req.user = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired access token' });
  }
}

module.exports = requireAuthSSE;
