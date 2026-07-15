const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');

const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { hashPassword, verifyPassword } = require('../utils/password');
const { signAccessToken } = require('../utils/jwt');
const { generateOpaqueToken, hashToken, newTokenFamily } = require('../utils/tokens');
const { requireAuth } = require('../middleware/requireAuth');
const { authLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

const REFRESH_TTL_DAYS = Number(process.env.JWT_REFRESH_TTL_DAYS || 30);
// A real (but useless — no matching user) bcrypt hash, generated once at
// startup, so login/forgot-password can run a bcrypt.compare even when no
// such user exists — keeps response timing from leaking whether an email
// is registered.
const DUMMY_HASH = bcrypt.hashSync('no-such-user-timing-guard', 12);

function validateRequest(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(400).json({ error: result.array()[0].msg });
  }
  next();
}

function toPublicUser(user) {
  return { id: String(user._id), name: user.name, email: user.email, createdAt: user.createdAt };
}

async function issueTokenPair(userId, family) {
  const accessToken = signAccessToken(userId);
  const rawRefresh = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  await RefreshToken.create({
    user: userId,
    tokenHash: hashToken(rawRefresh),
    family: family || newTokenFamily(),
    expiresAt,
  });
  return { accessToken, refreshToken: rawRefresh };
}

async function revokeAllUserTokens(userId) {
  await RefreshToken.updateMany(
    { user: userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

// --- POST /api/auth/register ---
router.post(
  '/register',
  authLimiter,
  [
    body('name').trim().notEmpty().withMessage('Fadlan geli magacaaga'),
    body('email').trim().isEmail().withMessage('Email-ku ma saxna').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Ugu yaraan 8 xaraf'),
  ],
  validateRequest,
  async (req, res, next) => {
    // TEMPORARY TRACE LOGGING — request-level tracing for the login/signup
    // spinner investigation. Remove once resolved.
    const t0 = Date.now();
    console.log(`[TRACE] register: request received (email=${req.body?.email})`);
    try {
      const { name, email, password } = req.body;
      console.log(`[TRACE] register: validation passed (+${Date.now() - t0}ms)`);
      const existing = await User.findOne({ email });
      console.log(`[TRACE] register: MongoDB findOne query done, existing=${!!existing} (+${Date.now() - t0}ms)`);
      if (existing) {
        console.log(`[TRACE] register: responding 409 duplicate (+${Date.now() - t0}ms)`);
        return res.status(409).json({ error: 'Email-kan horey ayaa loo isticmaalay.' });
      }
      const passwordHash = await hashPassword(password);
      console.log(`[TRACE] register: password hashed (+${Date.now() - t0}ms)`);
      const user = await User.create({ name, email, passwordHash });
      console.log(`[TRACE] register: MongoDB create done, id=${user._id} (+${Date.now() - t0}ms)`);
      const tokens = await issueTokenPair(user._id);
      console.log(`[TRACE] register: JWT generated (+${Date.now() - t0}ms)`);
      res.status(201).json({ user: toPublicUser(user), ...tokens });
      console.log(`[TRACE] register: response sent, status=201 (+${Date.now() - t0}ms)`);
    } catch (e) {
      console.log(`[TRACE] register: EXCEPTION (+${Date.now() - t0}ms): ${e.message}`);
      next(e);
    }
  }
);

// --- POST /api/auth/login ---
router.post(
  '/login',
  authLimiter,
  [
    body('email').trim().isEmail().withMessage('Email-ku ma saxna').normalizeEmail(),
    body('password').notEmpty().withMessage('Fadlan geli password-ka'),
  ],
  validateRequest,
  async (req, res, next) => {
    // TEMPORARY TRACE LOGGING — same purpose as /register above. Remove
    // once resolved.
    const t0 = Date.now();
    console.log(`[TRACE] login: request received (email=${req.body?.email})`);
    try {
      const { email, password } = req.body;
      console.log(`[TRACE] login: validation passed (+${Date.now() - t0}ms)`);
      const user = await User.findOne({ email }).select('+passwordHash');
      console.log(`[TRACE] login: MongoDB query done, found=${!!user} (+${Date.now() - t0}ms)`);
      const hashToCompare = user ? user.passwordHash : DUMMY_HASH;
      const ok = await verifyPassword(password, hashToCompare);
      console.log(`[TRACE] login: password verification done, ok=${ok} (+${Date.now() - t0}ms)`);
      if (!user || !ok) {
        console.log(`[TRACE] login: responding 401 (+${Date.now() - t0}ms)`);
        return res.status(401).json({ error: 'Email ama password-ku waa khalad.' });
      }
      const tokens = await issueTokenPair(user._id);
      console.log(`[TRACE] login: JWT generated (+${Date.now() - t0}ms)`);
      res.json({ user: toPublicUser(user), ...tokens });
      console.log(`[TRACE] login: response sent, status=200 (+${Date.now() - t0}ms)`);
    } catch (e) {
      console.log(`[TRACE] login: EXCEPTION (+${Date.now() - t0}ms): ${e.message}`);
      next(e);
    }
  }
);

// --- POST /api/auth/refresh ---
router.post(
  '/refresh',
  [body('refreshToken').notEmpty().withMessage('refreshToken waa loo baahan yahay')],
  validateRequest,
  async (req, res, next) => {
    try {
      const { refreshToken } = req.body;
      const tokenHash = hashToken(refreshToken);
      const record = await RefreshToken.findOne({ tokenHash });

      if (!record || record.expiresAt < new Date()) {
        return res.status(401).json({ error: 'Fasax lama helin.' });
      }

      if (record.revokedAt) {
        // Reuse of an already-rotated/revoked token — treat as a possible
        // compromise and revoke the whole rotation family.
        await RefreshToken.updateMany(
          { family: record.family, revokedAt: null },
          { $set: { revokedAt: new Date() } }
        );
        return res.status(401).json({ error: 'Fasax lama helin.' });
      }

      const rawNewRefresh = generateOpaqueToken();
      const newHash = hashToken(rawNewRefresh);
      const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

      record.revokedAt = new Date();
      record.replacedByHash = newHash;
      await record.save();

      await RefreshToken.create({
        user: record.user,
        tokenHash: newHash,
        family: record.family,
        expiresAt,
      });

      const accessToken = signAccessToken(record.user);
      res.json({ accessToken, refreshToken: rawNewRefresh });
    } catch (e) {
      next(e);
    }
  }
);

// --- POST /api/auth/logout ---
router.post(
  '/logout',
  requireAuth,
  [body('refreshToken').notEmpty().withMessage('refreshToken waa loo baahan yahay')],
  validateRequest,
  async (req, res, next) => {
    try {
      const tokenHash = hashToken(req.body.refreshToken);
      await RefreshToken.updateOne(
        { tokenHash, user: req.userId, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  }
);

// --- GET /api/auth/me ---
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'Isticmaalaha lama helin.' });
    res.json(toPublicUser(user));
  } catch (e) {
    next(e);
  }
});

// --- PATCH /api/auth/me ---
router.patch(
  '/me',
  requireAuth,
  [
    body('name').optional().trim().notEmpty().withMessage('Magaca ma noqon karo faaruq'),
    body('email').optional().trim().isEmail().withMessage('Email-ku ma saxna').normalizeEmail(),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const { name, email } = req.body;
      if (email) {
        const existing = await User.findOne({ email, _id: { $ne: req.userId } });
        if (existing) return res.status(409).json({ error: 'Email-kan horey ayaa loo isticmaalay.' });
      }
      const user = await User.findById(req.userId);
      if (!user) return res.status(404).json({ error: 'Isticmaalaha lama helin.' });
      if (name) user.name = name;
      if (email) user.email = email;
      await user.save();
      res.json({ user: toPublicUser(user) });
    } catch (e) {
      next(e);
    }
  }
);

// --- POST /api/auth/change-password ---
router.post(
  '/change-password',
  requireAuth,
  [
    body('currentPassword').notEmpty().withMessage('Fadlan geli password-kaaga hadda'),
    body('newPassword').isLength({ min: 8 }).withMessage('Ugu yaraan 8 xaraf'),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = await User.findById(req.userId).select('+passwordHash');
      if (!user) return res.status(404).json({ error: 'Isticmaalaha lama helin.' });
      const ok = await verifyPassword(currentPassword, user.passwordHash);
      if (!ok) return res.status(401).json({ error: 'Password-ka hadda waa khalad.' });
      user.passwordHash = await hashPassword(newPassword);
      await user.save();
      await revokeAllUserTokens(user._id);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  }
);

// --- POST /api/auth/forgot-password ---
router.post(
  '/forgot-password',
  authLimiter,
  [body('email').trim().isEmail().withMessage('Email-ku ma saxna').normalizeEmail()],
  validateRequest,
  async (req, res, next) => {
    try {
      const { email } = req.body;
      const user = await User.findOne({ email });

      // Always run a bcrypt compare, even with no user, so response timing
      // doesn't reveal whether the email exists.
      await verifyPassword('dummy-timing-guard', DUMMY_HASH);

      let devToken;
      if (user) {
        const rawToken = generateOpaqueToken();
        user.passwordResetTokenHash = hashToken(rawToken);
        user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await user.save();
        if (process.env.NODE_ENV !== 'production') devToken = rawToken;
      }

      // Structure-only: no email provider is wired up yet (see plan §8), so
      // there is currently no way to deliver this token to the user in
      // production. Always respond 200 regardless of whether the email
      // exists, to avoid leaking account existence.
      const payload = { ok: true };
      if (devToken) payload.devResetToken = devToken; // non-production convenience only
      res.json(payload);
    } catch (e) {
      next(e);
    }
  }
);

// --- POST /api/auth/reset-password ---
router.post(
  '/reset-password',
  authLimiter,
  [
    body('token').notEmpty().withMessage('token waa loo baahan yahay'),
    body('newPassword').isLength({ min: 8 }).withMessage('Ugu yaraan 8 xaraf'),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const { token, newPassword } = req.body;
      const tokenHash = hashToken(token);
      const user = await User.findOne({
        passwordResetTokenHash: tokenHash,
        passwordResetExpires: { $gt: new Date() },
      }).select('+passwordResetTokenHash +passwordResetExpires');

      if (!user) {
        return res.status(400).json({ error: 'Token-ku waa khalad ama wuu dhacay.' });
      }

      user.passwordHash = await hashPassword(newPassword);
      user.passwordResetTokenHash = null;
      user.passwordResetExpires = null;
      await user.save();
      await revokeAllUserTokens(user._id);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  }
);

module.exports = router;
