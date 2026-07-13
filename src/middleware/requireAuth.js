const { verifyAccessToken } = require('../utils/jwt');

// Verifies the Bearer access token and attaches req.userId. Only used by the
// new auth-gated routes — /api/analyze and /health are never touched by this.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Fasax lama helin.' });
  }
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    next();
  } catch (_e) {
    res.status(401).json({ error: 'Fasax lama helin.' });
  }
}

module.exports = { requireAuth };
