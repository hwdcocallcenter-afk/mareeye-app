const { rateLimit, MemoryStore } = require('express-rate-limit');

// Same {error} shape as the rest of the API, instead of express-rate-limit's
// default plain-text body.
const jsonRateLimitHandler = (_req, res) => {
  res.status(429).json({ error: 'Codsiyo aad u badan. Fadlan sug oo isku day mar dambe.' });
};

// Stores are kept as named references (not just inlined into each rateLimit()
// call) so the test suite can reset them between unrelated test cases —
// production server.js never touches these, only test/backend.test.js does.
const authStore = new MemoryStore();
const analyzeStore = new MemoryStore();
const generalStore = new MemoryStore();

// Brute-force / enumeration protection on the sensitive auth surface.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler,
  store: authStore,
});

// Cost control on the one route that spends real Anthropic API credit per call —
// the original developer handoff doc explicitly flagged this as missing.
const analyzeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler,
  store: analyzeStore,
});

// Generic baseline safety net for everything else.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler,
  store: generalStore,
});

module.exports = {
  authLimiter,
  analyzeLimiter,
  generalLimiter,
  // Test-only escape hatch — resets hit counters between unrelated test
  // cases so one test's requests don't trip another's rate limit.
  _resetForTests: async () => {
    await authStore.resetAll();
    await analyzeStore.resetAll();
    await generalStore.resetAll();
  },
};
