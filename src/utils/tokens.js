// Opaque (non-JWT) tokens for refresh and password-reset flows. Only the
// SHA-256 hash is ever persisted — the raw token is the bearer credential
// and exists only in the response sent to the client.
const crypto = require('crypto');

function generateOpaqueToken() {
  return crypto.randomBytes(48).toString('hex');
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function newTokenFamily() {
  return crypto.randomUUID();
}

module.exports = { generateOpaqueToken, hashToken, newTokenFamily };
