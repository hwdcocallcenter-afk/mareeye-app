// ============================================================
//  Mareeye — Backend Server (proxy ammaan ah)
//  Furaha API-ga wuxuu ku jiraa server-ka KELIYA — app-ka ma galo.
// ============================================================
require('dotenv').config();

const { createApp } = require('./src/app');
const { connectDb } = require('./src/config/db');

const app = createApp();
const PORT = process.env.PORT || 3000;

// /api/analyze and /health must keep working even if the database is down
// or slow to connect — so the HTTP server starts immediately and DB
// connection happens independently. Only the new auth/diagnoses routes
// depend on Mongo; if a request hits them before it's connected (or while
// it's down), Mongoose surfaces an error that errorHandler turns into a
// generic 500 — the process itself never crashes or blocks on this.
app.listen(PORT, () => console.log('Mareeye server wuu shaqeynayaa — port ' + PORT));

connectDb()
  .then(() => console.log('MongoDB waa ku xidhan yahay.'))
  .catch((e) => console.error('MongoDB xidhashadiisu way fashilantay:', e.message));
