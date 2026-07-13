// Builds and exports the Express app with no side effects (no app.listen,
// no DB connection) so it can be required directly by tests. server.js is
// the only place that actually boots the process.
const express = require('express');
const path = require('path');

const analyzeRoutes = require('./routes/analyze.routes');
const authRoutes = require('./routes/auth.routes');
const diagnosesRoutes = require('./routes/diagnoses.routes');
const { generalLimiter } = require('./middleware/rateLimiters');
const { errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  // Render sits behind a reverse proxy — required for express-rate-limit to
  // see each client's real IP instead of Render's proxy IP for everyone.
  app.set('trust proxy', 1);

  app.use(express.json({ limit: '15mb' }));                     // sawirrada waaweyn
  app.use(express.static(path.join(__dirname, '..', 'public'))); // app-ka front-end

  // --- Endpoint-ka baaritaanka (unchanged contract) ---
  app.use(analyzeRoutes);

  app.get('/health', (_req, res) => res.json({ ok: true }));

  // --- New auth + diagnosis-history endpoints ---
  app.use('/api/auth', generalLimiter, authRoutes);
  app.use('/api/diagnoses', generalLimiter, diagnosesRoutes);

  // Must be mounted last.
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
