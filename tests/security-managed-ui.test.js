'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const gates = ['intro.html', 'detail-admin-jik-2026.html', 'omok-dashboard.html', 'baduk-dashboard.html', 'yut-dashboard.html'];
const lockKey = 'dashboard-auth-lock-v1';
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
}
function gate(file, { hostname = 'wifi.trycloudflare.com', legacy = { fails: 4, last: Date.now(), until: Date.now() + 3600000 }, responses = [{ status: 200, data: { ok: true } }] } = {}) {
  const html = read(file), start = html.indexOf("const AUTH_KEY ="), end = html.indexOf('</script>', start);
  const script = html.slice(start, end).split(/\n\s*(?:document\.querySelectorAll\('\.dashboard-link'\)|const GAME =|const \$ =)/)[0];
  const alerts = [], calls = [], localStorage = storage({ [lockKey]: JSON.stringify(legacy) });
  let prompts = 0;
  const context = vm.createContext({ location: { hostname, pathname: '/' + file }, localStorage, sessionStorage: storage(), Date, URL,
    alert: message => alerts.push(message), prompt: () => prompts++ < responses.length ? 'fixture-input' : null,
    fetch: async (...args) => { calls.push(args); const response = responses.shift(); return { status: response.status, ok: response.status === 200, json: async () => response.data }; }
  });
  // Preserve input count independently of the mutable response queue.
  const inputs = responses.length;
  context.prompt = () => prompts++ < inputs ? 'fixture-input' : null;
  vm.runInContext(script, context, { filename: file });
  return { context, alerts, calls, localStorage, run: () => context.requireDashboardPassword() };
}
test('managed portal includes math descendants and documents shared real-IP policy', () => {
  const html = read('detail-admin-jik-2026.html');
  assert.match(html, /href="math-control\.html" class="dashboard-link">수학관리<\/a>/);
  assert.match(html, /href="math-level\.html">수학게임<\/a>/);
  assert.match(html, /관리자.*현황판.*노트 A\/B.*수학관리.*수학게임/);
  assert.match(html, /동일.*IP.*5회.*1시간/);
  assert.match(read('math-control.html'), /동일.*IP.*5회.*1시간/);
});
test('math admin set displays server 429 error without a local budget', async () => {
  const elements = new Map();
  const context = vm.createContext({ document: { getElementById: id => { if (!elements.has(id)) elements.set(id, { value: 'fixture-input' }); return elements.get(id); } },
    fetch: async () => ({ ok: false, status: 429, json: async () => ({ error: '해당 IP의 로그인이 1시간 동안 잠겼습니다.' }) })
  });
  vm.runInContext(read('math-control.html').split('<script>')[1].split("$('lockOnBtn').addEventListener")[0], context);
  await assert.rejects(context.setLock(true), /해당 IP의 로그인이 1시간 동안 잠겼습니다/);
});
function mathFixture(hostname = 'wifi.trycloudflare.com') {
  const elements = new Map(), alerts = [], calls = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '', textContent: '', innerHTML: '', style: {}, focus() {}, classList: { add() {}, remove() {}, toggle() {} } });
    return elements.get(id);
  };
  const context = vm.createContext({ location: { hostname }, localStorage: storage({ 'math-level-control-bypass-v1': '7' }), sessionStorage: storage({ 'math-level-limit-unlock-v1': '7' }),
    document: { getElementById: element, querySelectorAll: () => [] }, Date, Math, setTimeout: () => 0, clearTimeout() {},
    alert: message => alerts.push(message), fetch: async (...args) => { calls.push(args); return { ok: false, status: 429, json: async () => ({ error: '해당 IP의 로그인이 1시간 동안 잠겼습니다.' }) }; }
  });
  const source = read('math-level.html').split('<script>')[1].split("$('startBtn').addEventListener")[0];
  vm.runInContext(source, context);
  return { context, element, alerts, calls, eval: source => vm.runInContext(source, context) };
}
test('math local stale browser permissions cannot bypass either server lock', () => {
  const f = mathFixture();
  f.eval('applyMathControl({ok:true,locked:true,version:7,questionLimit:5}); state.asked=5');
  assert.equal(f.eval('centralLocked'), true);
  assert.equal(f.eval('shouldShowQuestionLimitLock()'), true);
});
test('math local successful server grants survive polls but expire on a different control version', async () => {
  const f = mathFixture();
  f.eval('applyMathControl({ok:true,locked:true,version:7,questionLimit:5}); state.asked=5; nextProblem=()=>{}');
  f.context.fetch = async () => ({ ok: true, json: async () => ({ ok: true, unlocked: true, limitUnlocked: true, version: 7 }) });
  await f.context.unlockMathControl();
  await f.context.unlockQuestionLimit();
  f.eval('applyMathControl({ok:true,locked:true,version:7,questionLimit:5})');
  assert.equal(f.eval('centralLocked'), false);
  assert.equal(f.eval('shouldShowQuestionLimitLock()'), false);
  for (const version of [8, 6]) {
    f.eval(`applyMathControl({ok:true,locked:true,version:${version},questionLimit:5})`);
    assert.equal(f.eval('centralLocked'), true);
    assert.equal(f.eval('shouldShowQuestionLimitLock()'), true);
  }
});
for (const status of [429, 404]) test(`math ${status} cannot unlock using browser permissions or a client password`, async () => {
  const f = mathFixture();
  f.eval('applyMathControl({ok:true,locked:true,version:7,questionLimit:5}); state.asked=5');
  const message = status === 429 ? '해당 IP의 로그인이 1시간 동안 잠겼습니다.' : '지원하지 않는 요청입니다.';
  f.context.fetch = async () => ({ ok: false, status, json: async () => ({ error: message }) });
  await f.context.unlockMathControl();
  await f.context.unlockQuestionLimit();
  assert.equal(f.element('mathUnlockError').textContent, message);
  assert.equal(f.element('questionLimitError').textContent, message);
  assert.equal(f.eval('centralLocked'), true);
  assert.equal(f.eval('shouldShowQuestionLimitLock()'), true);
});
test('math Vercel retains existing browser permission fallback', () => {
  const f = mathFixture('fixture.vercel.app');
  f.eval('applyMathControl({ok:true,locked:true,version:7,questionLimit:5}); state.asked=5');
  assert.equal(f.eval('centralLocked'), false);
  assert.equal(f.eval('shouldShowQuestionLimitLock()'), false);
});
// Browser-only checks use the same local Playwright installation as existing UI tests.
test('browser: simulated Wi-Fi IP lock then LTE success ignores the unchanged legacy lock on every managed gate', async t => {
  const { chromium } = require('/tmp/note-modal-browser/node_modules/playwright');
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  for (const file of gates) {
    const page = await browser.newPage(), errors = [], alerts = [], calls = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', async dialog => { if (dialog.type() === 'prompt') await dialog.accept('fixture-input'); else { alerts.push(dialog.message()); await dialog.accept(); } });
    let lockedIp = true;
    await page.addInitScript(() => {
      sessionStorage.setItem('dashboard-auth-v1', 'ok');
      localStorage.setItem('dashboard-auth-lock-v1', JSON.stringify({ fails: 4, until: Date.now() + 3600000, last: Date.now() }));
    });
    await page.route('http://managed-fixture.test/**', route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/dashboard-auth') {
        calls.push(url.pathname);
        return route.fulfill({ status: lockedIp ? 429 : 200, contentType: 'application/json', body: JSON.stringify(lockedIp ? { ok: false, error: '해당 IP의 로그인이 1시간 동안 잠겼습니다.', remaining: 0 } : { ok: true }) });
      }
      if (url.pathname.startsWith('/api/')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, rooms: [], events: [], notes: [] }) });
      const resource = url.pathname.slice(1);
      if (/^[a-z0-9.-]+\.(html|js)$/.test(resource) && fs.existsSync(path.join(root, resource))) return route.fulfill({ contentType: resource.endsWith('.js') ? 'text/javascript' : 'text/html', body: read(resource) });
      return route.fulfill({ status: 404, body: '' });
    });
    await page.goto('http://managed-fixture.test/' + file);
    const before = await page.evaluate(() => localStorage.getItem('dashboard-auth-lock-v1'));
    await page.evaluate(() => sessionStorage.removeItem('dashboard-auth-v1'));
    assert.equal(await page.evaluate(() => requireDashboardPassword(location.pathname)), false, file);
    assert.deepEqual(alerts, ['해당 IP의 로그인이 1시간 동안 잠겼습니다.'], file);
    lockedIp = false; // API now represents another real IP; browser storage is untouched.
    assert.equal(await page.evaluate(() => requireDashboardPassword(location.pathname)), true, file);
    assert.equal(calls.length, 2, file);
    assert.equal(await page.evaluate(() => localStorage.getItem('dashboard-auth-lock-v1')), before, file);
    assert.deepEqual(errors, [], file);
    await page.close();
  }
});
for (const file of gates) {
  test(`${file}: local 403 uses server remaining despite four stale browser failures`, async () => {
    const f = gate(file, { legacy: { fails: 4, last: Date.now(), until: 0 }, responses: [{ status: 403, data: { ok: false, error: '비밀번호가 맞지 않습니다.', remaining: 2 } }] });
    const before = f.localStorage.getItem(lockKey);
    assert.equal(await f.run(), false);
    assert.deepEqual(f.alerts, ['비밀번호가 맞지 않습니다. (남은 기회 2번)']);
    assert.equal(f.localStorage.getItem(lockKey), before);
  });
  test(`${file}: Vercel preserves legacy lock precheck and failure counter`, async () => {
    const locked = gate(file, { hostname: 'fixture.vercel.app' });
    assert.equal(await locked.run(), false);
    assert.equal(locked.calls.length, 0);
    const f = gate(file, { hostname: 'fixture.vercel.app', legacy: { fails: 3, last: Date.now(), until: 0 }, responses: [{ status: 403, data: { remaining: 4 } }] });
    await f.run();
    assert.match(f.alerts[0], /남은 기회 1번/);
    assert.equal(JSON.parse(f.localStorage.getItem(lockKey)).fails, 4);
  });
  for (const status of [400, 503]) test(`${file}: ${status} never consumes a local attempt`, async () => {
    const f = gate(file, { legacy: { fails: 4, last: Date.now(), until: 0 }, responses: [{ status, data: { error: '일시 오류' } }] });
    const before = f.localStorage.getItem(lockKey);
    assert.equal(await f.run(), false);
    assert.equal(f.localStorage.getItem(lockKey), before);
    assert.equal(f.calls.length, 1);
  });
  test(`${file}: server 429 is displayed verbatim and stops without a browser budget`, async () => {
    const message = '비밀번호를 5회 틀려 해당 IP의 로그인이 1시간 동안 잠겼습니다.';
    const f = gate(file, { legacy: { fails: 4, last: Date.now(), until: 0 }, responses: [{ status: 429, data: { ok: false, error: message, remaining: 0 } }, { status: 200, data: { ok: true } }] });
    const before = f.localStorage.getItem(lockKey);
    assert.equal(await f.run(), false);
    assert.deepEqual(f.alerts, [message]);
    assert.equal(f.calls.length, 1);
    assert.equal(f.localStorage.getItem(lockKey), before);
  });
  test(`${file}: local network change ignores legacy browser lock and does not rewrite it`, async () => {
    const f = gate(file), before = f.localStorage.getItem(lockKey);
    assert.equal(await f.run(), true);
    assert.equal(f.calls.length, 1);
    assert.equal(f.localStorage.getItem(lockKey), before);
    assert.equal(f.context.sessionStorage.getItem('dashboard-auth-v1'), 'ok');
  });
}
