// End-to-end verification against a real, ephemeral in-memory MongoDB
// (mongodb-memory-server) — no real MONGODB_URI/JWT_SECRET is ever read or
// touched by this suite. Run with: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

let mongod;
let app;
let resetRateLimiters;

test.before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-only-secret-not-real';
  process.env.JWT_ACCESS_TTL = '15m';
  process.env.JWT_REFRESH_TTL_DAYS = '30';
  delete process.env.ANTHROPIC_API_KEY; // intentionally unset for the analyze regression check below

  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const { createApp } = require('../src/app');
  app = createApp();
  resetRateLimiters = require('../src/middleware/rateLimiters')._resetForTests;
});

test.after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

// Each test exercises the auth routes many times; without this, one test's
// requests can trip the (deliberately strict) login/register rate limit
// before an unrelated later test even starts. The dedicated rate-limiting
// test below re-verifies the real threshold in isolation.
test.beforeEach(async () => {
  await resetRateLimiters();
});

test('GET /health is unchanged', async () => {
  const res = await request(app).get('/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true });
});

test('POST /api/analyze — missing fields still returns the original 400 + message', async () => {
  const res = await request(app).post('/api/analyze').send({});
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Sawir iyo weydiin waa loo baahan yahay.');
});

test('POST /api/analyze — missing API key still returns the original 500 + message', async () => {
  const res = await request(app).post('/api/analyze').send({ image: 'abc', prompt: 'hi' });
  assert.equal(res.status, 500);
  assert.equal(res.body.error, 'ANTHROPIC_API_KEY lama dejin server-ka.');
});

test('full auth lifecycle: register -> login -> me -> refresh rotation -> change-password revokes -> logout', async () => {
  const email = `farmer${Date.now()}@example.com`;
  const password = 'correct-horse-1';

  // register
  const reg = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Beeralay Test', email, password });
  assert.equal(reg.status, 201);
  assert.equal(reg.body.user.email, email);
  assert.ok(reg.body.accessToken);
  assert.ok(reg.body.refreshToken);

  // duplicate register is rejected
  const dupe = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Someone Else', email, password: 'whatever12' });
  assert.equal(dupe.status, 409);

  // login
  const login = await request(app).post('/api/auth/login').send({ email, password });
  assert.equal(login.status, 200);
  const { accessToken, refreshToken } = login.body;

  // wrong password is rejected with a generic message (no enumeration)
  const badLogin = await request(app).post('/api/auth/login').send({ email, password: 'wrong-pass' });
  assert.equal(badLogin.status, 401);
  const noSuchUserLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'nobody-here@example.com', password: 'whatever12' });
  assert.equal(noSuchUserLogin.status, 401);
  assert.equal(badLogin.body.error, noSuchUserLogin.body.error); // identical message either way

  // GET /me requires auth
  const meNoAuth = await request(app).get('/api/auth/me');
  assert.equal(meNoAuth.status, 401);

  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`);
  assert.equal(me.status, 200);
  assert.equal(me.body.email, email);

  // refresh rotates the token
  const refreshed = await request(app).post('/api/auth/refresh').send({ refreshToken });
  assert.equal(refreshed.status, 200);
  assert.ok(refreshed.body.accessToken);
  assert.ok(refreshed.body.refreshToken);
  assert.notEqual(refreshed.body.refreshToken, refreshToken);

  // reusing the OLD (already-rotated) refresh token is rejected — reuse detection
  const reuseOld = await request(app).post('/api/auth/refresh').send({ refreshToken });
  assert.equal(reuseOld.status, 401);

  // the NEW refresh token from that reuse-detection revocation is now also dead
  // (whole family revoked), confirming compromise handling revokes the chain
  const newRefreshDeadToo = await request(app)
    .post('/api/auth/refresh')
    .send({ refreshToken: refreshed.body.refreshToken });
  assert.equal(newRefreshDeadToo.status, 401);

  // log in again fresh to get a clean token pair for the rest of the test
  const login2 = await request(app).post('/api/auth/login').send({ email, password });
  const accessToken2 = login2.body.accessToken;
  const refreshToken2 = login2.body.refreshToken;

  // change password revokes all outstanding refresh tokens
  const changePw = await request(app)
    .post('/api/auth/change-password')
    .set('Authorization', `Bearer ${accessToken2}`)
    .send({ currentPassword: password, newPassword: 'new-password-1' });
  assert.equal(changePw.status, 200);

  const refreshAfterPwChange = await request(app)
    .post('/api/auth/refresh')
    .send({ refreshToken: refreshToken2 });
  assert.equal(refreshAfterPwChange.status, 401);

  // login with new password works, old password doesn't
  const loginNew = await request(app).post('/api/auth/login').send({ email, password: 'new-password-1' });
  assert.equal(loginNew.status, 200);
  const loginOld = await request(app).post('/api/auth/login').send({ email, password });
  assert.equal(loginOld.status, 401);

  // logout revokes the presented refresh token
  const accessToken3 = loginNew.body.accessToken;
  const refreshToken3 = loginNew.body.refreshToken;
  const logout = await request(app)
    .post('/api/auth/logout')
    .set('Authorization', `Bearer ${accessToken3}`)
    .send({ refreshToken: refreshToken3 });
  assert.equal(logout.status, 200);

  const refreshAfterLogout = await request(app).post('/api/auth/refresh').send({ refreshToken: refreshToken3 });
  assert.equal(refreshAfterLogout.status, 401);
});

test('forgot-password / reset-password structure', async () => {
  const email = `reset${Date.now()}@example.com`;
  await request(app).post('/api/auth/register').send({ name: 'Reset Test', email, password: 'original-pw1' });

  // unknown email still returns ok:true (no enumeration) and no dev token
  const forgotUnknown = await request(app)
    .post('/api/auth/forgot-password')
    .send({ email: 'not-registered@example.com' });
  assert.equal(forgotUnknown.status, 200);
  assert.equal(forgotUnknown.body.ok, true);
  assert.equal(forgotUnknown.body.devResetToken, undefined);

  const forgot = await request(app).post('/api/auth/forgot-password').send({ email });
  assert.equal(forgot.status, 200);
  assert.ok(forgot.body.devResetToken); // only present because NODE_ENV !== 'production' in this test run

  const reset = await request(app)
    .post('/api/auth/reset-password')
    .send({ token: forgot.body.devResetToken, newPassword: 'brand-new-pw1' });
  assert.equal(reset.status, 200);

  const loginNew = await request(app).post('/api/auth/login').send({ email, password: 'brand-new-pw1' });
  assert.equal(loginNew.status, 200);

  // token can't be reused
  const reuseReset = await request(app)
    .post('/api/auth/reset-password')
    .send({ token: forgot.body.devResetToken, newPassword: 'another-pw1' });
  assert.equal(reuseReset.status, 400);
});

test('diagnosis history: create/list/get/favorite/delete, scoped per user', async () => {
  const emailA = `usera${Date.now()}@example.com`;
  const emailB = `userb${Date.now()}@example.com`;
  const regA = await request(app).post('/api/auth/register').send({ name: 'A', email: emailA, password: 'password-a1' });
  const regB = await request(app).post('/api/auth/register').send({ name: 'B', email: emailB, password: 'password-b1' });
  const tokenA = regA.body.accessToken;
  const tokenB = regB.body.accessToken;

  const created = await request(app)
    .post('/api/diagnoses')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      mode: 'leaf',
      cropName: 'Bariis',
      cropEmoji: '🍚',
      title: 'Cudur la helay',
      cls: 'sick',
      badge: 'Faafa',
      result: { magaca_so: 'Tusaale', kalsooni: 87 },
    });
  assert.equal(created.status, 201);
  const recordId = created.body.record._id;

  // no auth at all
  const noAuth = await request(app).get('/api/diagnoses');
  assert.equal(noAuth.status, 401);

  // owner can list/get it
  const listA = await request(app).get('/api/diagnoses').set('Authorization', `Bearer ${tokenA}`);
  assert.equal(listA.status, 200);
  assert.equal(listA.body.total, 1);

  const getA = await request(app).get(`/api/diagnoses/${recordId}`).set('Authorization', `Bearer ${tokenA}`);
  assert.equal(getA.status, 200);

  // a different logged-in user cannot see or access it
  const listB = await request(app).get('/api/diagnoses').set('Authorization', `Bearer ${tokenB}`);
  assert.equal(listB.status, 200);
  assert.equal(listB.body.total, 0);

  const getB = await request(app).get(`/api/diagnoses/${recordId}`).set('Authorization', `Bearer ${tokenB}`);
  assert.equal(getB.status, 404);

  const deleteB = await request(app).delete(`/api/diagnoses/${recordId}`).set('Authorization', `Bearer ${tokenB}`);
  assert.equal(deleteB.status, 404); // can't delete someone else's record

  // owner can favorite it
  const favorite = await request(app)
    .patch(`/api/diagnoses/${recordId}`)
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ favorite: true });
  assert.equal(favorite.status, 200);
  assert.equal(favorite.body.record.favorite, true);

  // owner can delete it
  const del = await request(app).delete(`/api/diagnoses/${recordId}`).set('Authorization', `Bearer ${tokenA}`);
  assert.equal(del.status, 200);

  const getAfterDelete = await request(app).get(`/api/diagnoses/${recordId}`).set('Authorization', `Bearer ${tokenA}`);
  assert.equal(getAfterDelete.status, 404);
});

test('rate limiting: login is throttled after the configured threshold', async () => {
  const email = `ratelimit${Date.now()}@example.com`;
  let lastStatus;
  for (let i = 0; i < 11; i++) {
    const res = await request(app).post('/api/auth/login').send({ email, password: 'whatever12' });
    lastStatus = res.status;
  }
  assert.equal(lastStatus, 429);
});
