// Stateless access-token signing/verification. Refresh/reset tokens are opaque
// (see tokens.js) — only the short-lived access token is a real JWT.
const jwt = require('jsonwebtoken');

const ACCESS_TTL = process.env.JWT_ACCESS_TTL || '15m';

function signAccessToken(userId) {
  const secret = requireSecret();
  return jwt.sign({ sub: String(userId) }, secret, { expiresIn: ACCESS_TTL });
}

function verifyAccessToken(token) {
  const secret = requireSecret();
  return jwt.verify(token, secret); // throws on invalid/expired
}

function requireSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET lama dejin server-ka.');
  return secret;
}

module.exports = { signAccessToken, verifyAccessToken };
