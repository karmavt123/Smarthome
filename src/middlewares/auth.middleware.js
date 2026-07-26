const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  console.log("header", header);
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing access token" });
  }

  const token = header.slice("Bearer ".length);
  try {
    req.user = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired access token" });
  }
}

module.exports = requireAuth;
