'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function mockReq(method, url, body = {}) {
  return { method, url, headers: { host: 'localhost' }, body };
}
function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(x) { this.body = x || ''; },
  };
}
async function call(handler, method, url, body = {}) {
  const res = mockRes();
  await handler(mockReq(method, url, body), res);
  let data;
  try { data = JSON.parse(res.body || '{}'); } catch (e) { data = { parseError: e.message, raw: res.body }; }
  return { status: res.statusCode, data, headers: res.headers };
}

(async () => {
  process.env.DASHBOARD_PW = 'admin-test';
  const pwFile = path.join(__dirname, '.tmp-math-control-pw');
  fs.writeFileSync(pwFile, 'admin-test');
  process.env.DASHBOARD_PW_FILE = pwFile;
  delete require.cache[require.resolve('../api/math-control.js')];
  const handler = require('../api/math-control.js');

  const initial = await call(handler, 'GET', '/api/math-control?action=status');
  assert.strictEqual(initial.status, 200, 'status endpoint works');
  assert.strictEqual(initial.data.ok, true);
  assert.strictEqual(initial.data.locked, false, 'default unlocked');
  assert.strictEqual(initial.data.questionLimit, 5, 'default question limit is 5');
  assert.ok(!('unlockPassword' in initial.data), 'public status must not expose unlock password');
  assert.ok(!('limitPassword' in initial.data), 'public status must not expose limit password');

  const denied = await call(handler, 'POST', '/api/math-control?action=set', { adminPassword: 'bad', locked: true });
  assert.strictEqual(denied.status, 403, 'bad admin password denied');

  const locked = await call(handler, 'POST', '/api/math-control?action=set', {
    adminPassword: 'admin-test',
    locked: true,
    message: '선생님 확인 후 계속하세요',
    unlockPassword: '2468',
    questionLimit: 7,
    limitPassword: '1414',
  });
  assert.strictEqual(locked.status, 200, 'admin can lock');
  assert.strictEqual(locked.data.locked, true);
  assert.strictEqual(locked.data.message, '선생님 확인 후 계속하세요');
  assert.strictEqual(locked.data.questionLimit, 7, 'admin can change question limit');
  assert.ok(!('unlockPassword' in locked.data), 'set response must not expose unlock password');
  assert.ok(!('limitPassword' in locked.data), 'set response must not expose limit password');

  const publicLocked = await call(handler, 'GET', '/api/math-control?action=status');
  assert.strictEqual(publicLocked.data.locked, true, 'public sees locked state');

  const wrongUnlock = await call(handler, 'POST', '/api/math-control?action=unlock', { password: '1111' });
  assert.strictEqual(wrongUnlock.status, 403, 'wrong unlock denied');

  const unlocked = await call(handler, 'POST', '/api/math-control?action=unlock', { password: '2468' });
  assert.strictEqual(unlocked.status, 200, 'student unlock password works');
  assert.strictEqual(unlocked.data.unlocked, true);

  const wrongLimitUnlock = await call(handler, 'POST', '/api/math-control?action=limit-unlock', { password: '1111' });
  assert.strictEqual(wrongLimitUnlock.status, 403, 'wrong question limit unlock denied');

  const limitUnlocked = await call(handler, 'POST', '/api/math-control?action=limit-unlock', { password: '1414' });
  assert.strictEqual(limitUnlocked.status, 200, 'question limit unlock password works');
  assert.strictEqual(limitUnlocked.data.limitUnlocked, true);

  const root = path.resolve(__dirname, '..');
  const game = fs.readFileSync(path.join(root, 'math-level.html'), 'utf8');
  const admin = fs.readFileSync(path.join(root, 'math-control.html'), 'utf8');
  const vercel = fs.readFileSync(path.join(root, 'vercel.json'), 'utf8');
  assert.match(game, /id="mathLockOverlay"/, 'game must have central lock overlay');
  assert.match(game, /function pollMathControl\(/, 'game must poll central lock state');
  assert.match(game, /CONTROL_BYPASS_KEY/, 'student unlock must remember the unlocked control version locally');
  assert.match(game, /localStorage\.setItem\(CONTROL_BYPASS_KEY/, 'successful student unlock must store bypass version');
  assert.match(game, /\/api\/math-control\?action=status/, 'game must call central status API');
  assert.match(game, /\/api\/math-control\?action=unlock/, 'game must call unlock API');
  assert.match(game, /\/api\/math-control\?action=limit-unlock/, 'game must call question limit unlock API');
  assert.match(admin, /id="lockOnBtn"/, 'admin page must have lock button');
  assert.match(admin, /id="questionLimit"/, 'admin page must configure question limit');
  assert.match(admin, /id="limitPassword"/, 'admin page must configure question limit password');
  assert.match(admin, /id="applySettingsBtn"/, 'admin page must have a settings apply button for changing limits without toggling lock');
  assert.match(admin, /applySettingsBtn'\)\.addEventListener\('click', \(\) => applySettings\(\)/, 'settings apply button must save current settings');
  assert.match(admin, /\/api\/math-control\?action=set/, 'admin page must set central lock state');
  assert.match(vercel, /api\/math-control\/:action/, 'vercel rewrites must support math-control actions');

  fs.rmSync(pwFile, { force: true });
  console.log('math control tests passed');
})().catch((err) => {
  console.error(err.stack || err);
  process.exit(1);
});
