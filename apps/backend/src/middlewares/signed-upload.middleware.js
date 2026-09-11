const crypto = require("crypto");

// Face images are biometric data, but they are rendered by plain <img src="...">
// tags, which cannot send an Authorization header. So instead of a bearer token we
// sign each URL: the API hands out /uploads/faces/<file>?exp=<ts>&sig=<hmac> and this
// middleware refuses anything without a valid, unexpired signature.
//
// Why not just put the access token in the query string? Because that token opens the
// whole API (including the door), it would end up in proxy logs and browser history,
// and it is far longer-lived than a page view needs. A per-file signature only ever
// grants "read this one image until <exp>".
const SIGNED_URL_TTL_MS = Number(process.env.UPLOAD_URL_TTL_MS) || 60 * 60 * 1000;

// The expiry is snapped to a 5-minute grid so the same image keeps the same URL across
// requests. Without this, SecurityPage's 5-second poll would mint a new `exp` (and so a
// new URL) every time, defeating the browser cache and making every face thumbnail
// re-download and flicker. Real validity is therefore TTL..TTL+5min.
const EXPIRY_BUCKET_MS = 5 * 60 * 1000;

function signingKey() {
  // Derived from a secret validateEnv() already guarantees exists and is >=32 chars.
  return process.env.JWT_ACCESS_SECRET;
}

function signUploadPath(relativePath, expiresAtMs) {
  return crypto
    .createHmac("sha256", signingKey())
    .update(`${relativePath}:${expiresAtMs}`)
    .digest("hex");
}

function buildSignedUploadUrl(req, relativePath) {
  const exp =
    Math.ceil((Date.now() + SIGNED_URL_TTL_MS) / EXPIRY_BUCKET_MS) * EXPIRY_BUCKET_MS;
  const sig = signUploadPath(relativePath, exp);

  // The verifier runs decodeURIComponent on req.path, so the URL handed out has to be
  // encoded to match. Filenames are UUIDs today, but an un-encoded name containing a
  // space or a non-ASCII character produced a URL that is not even valid, and one
  // containing '#' or '%' produced a 401 on a file the API had just authorised.
  // Per segment, so the '/' separators survive.
  const encodedPath = relativePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${req.protocol}://${req.get("host")}/uploads/${encodedPath}?exp=${exp}&sig=${sig}`;
}

function requireSignedUpload(req, res, next) {
  const { exp, sig } = req.query;
  if (!exp || !sig) return res.status(401).json({ message: "Missing signature" });

  const expiresAtMs = Number(exp);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) {
    return res.status(401).json({ message: "Signature expired" });
  }

  // req.path here is relative to the /uploads mount and starts with "/".
  // decodeURIComponent throws URIError on a malformed escape ("%E0%A4%A"), which would
  // surface as a 500 plus a console.error for every scanner probe. A path we cannot even
  // decode is by definition not one we signed, so answer 401 like any other bad request.
  let relativePath;
  try {
    relativePath = decodeURIComponent(req.path).replace(/^\/+/, "");
  } catch {
    return res.status(401).json({ message: "Invalid signature" });
  }

  const expected = signUploadPath(relativePath, expiresAtMs);

  const provided = Buffer.from(String(sig), "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  // timingSafeEqual throws on length mismatch, so guard on length first.
  if (
    provided.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(provided, expectedBuf)
  ) {
    return res.status(401).json({ message: "Invalid signature" });
  }

  next();
}

module.exports = { requireSignedUpload, buildSignedUploadUrl };
