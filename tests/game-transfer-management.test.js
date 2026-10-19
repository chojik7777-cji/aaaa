'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.join(__dirname, '..');
const games = [
  { id: 'church', save: 'church-game-save-v1', name: 'church-game-name-v1', audio: 'church-game-audio-v1', label: 'deptName', money: 'budget' },
  { id: 'math-academy', save: 'math-academy-save-v2', name: 'math-academy-name-v1', audio: 'math-academy-audio-v1', label: 'acName', money: 'money' }
];
async function fixture(t, game, realHelper = false) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  await context.route('**/*', route => {
    const filename = new URL(route.request().url()).pathname.slice(1);
    if (!realHelper && filename === 'game-transfer.js') return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(root,filename),'utf8')+';GameTransfer.mount=adapter=>{window.transferAdapter=adapter;};' });
    const file = path.join(root, filename);
    return route.fulfill({ status: fs.existsSync(file) ? 200 : 404, contentType: filename.endsWith('.html') ? 'text/html' : 'text/javascript', body: fs.existsSync(file) ? fs.readFileSync(file) : '' });
  });
  await context.addInitScript(({ mock }) => {
    localStorage.setItem('unrelated-auth', 'keep-secret');
    if (mock) window.GameTransfer = { mount(adapter) { window.transferAdapter = adapter; } };
  }, { mock: !realHelper });
  await page.goto(`http://transfer.test/${game.id}.html`);
  return page;
}
test('church: birthday celebration completion survives export and restore',async t=>{
 const page=await fixture(t,games[0]);
 const result=await page.evaluate(()=>{const data=transferAdapter.capture();data.state.students[0].bdayDone=true;transferAdapter.restore(transferAdapter.validate(data));return {captured:transferAdapter.capture().state.students[0].bdayDone,stored:JSON.parse(localStorage.getItem('church-game-save-v1')).students[0].bdayDone};});
 assert.deepEqual(result,{captured:true,stored:true});
});
for (const game of games) test(`${game.id}: adapter roundtrip persists only game progress, name and audio across reload`, async t => {
  const page = await fixture(t, game);
  assert.equal(await page.evaluate(() => !!window.transferAdapter), true, 'game must mount a transfer adapter');
  const result = await page.evaluate(game => {
    const a = window.transferAdapter;
    const data = a.capture();
    data.name = '복원한 이름'; data.state[game.money] = 7654321;
    data.state.students[0].name = '테스트학생';
    data.audio = { music: false, sfx: false };
    const normalized = a.validate(data); a.restore(normalized);
    return { captured: a.capture(), stored: JSON.parse(localStorage.getItem(game.save)), name: localStorage.getItem(game.name), secret: localStorage.getItem('unrelated-auth'), text: document.body.innerText };
  }, game);
  assert.equal(result.stored[game.money], 7654321);
  assert.equal(result.name, '복원한 이름');
  assert.match(result.text, /테스트학생/);
  assert.equal(result.secret, 'keep-secret');
  assert.doesNotMatch(JSON.stringify(result.captured), /keep-secret|unrelated-auth/);
  await page.reload();
  const reloaded = await page.evaluate(() => window.transferAdapter.capture());
  assert.deepEqual(reloaded, result.captured);
});
for (const game of games) test(`${game.id}: strict nested schema rejects corruption before any writes and strips unknown credentials`, async t => {
  const page = await fixture(t, game);
  const result = await page.evaluate(game => {
    const a = window.transferAdapter, original = a.capture();
    const attacks = [
      d => { d.name = '<img src=x onerror=alert(1)>'; },
      d => { d.state.students[0].name = '\" onclick=alert(1)'; },
      d => { d.state.students[0].look.skin = 'red'; },
      d => { d.state.students[0].id = -1; },
      d => { d.state.students[0].grade = '대학교'; },
      d => { d.state[game.money] = Infinity; },
      d => { d.state.students = Array(501).fill(d.state.students[0]); },
      d => { d.state.students.push({ ...d.state.students[0] }); },
      d => { d.audio.music = 'true'; },
      d => { d.state.nextId = 1; },
      d => { d.state.history = [{ week: 1, month: 1, att: '<b>x</b>', total: 2, retreat: false, net: NaN, students: 1, rep: 20 }]; }
    ];
    const before = JSON.stringify(localStorage);
    const errors = attacks.map(attack => { const data = structuredClone(original); attack(data); try { a.restore(data); return null; } catch (e) { return e.message; } });
    const injected = structuredClone(original); injected.token = 'private'; injected.state.password = 'private'; injected.state.students[0].secret = 'private';
    const normalized = a.validate(injected);
    return { errors, unchanged: before === JSON.stringify(localStorage), normalized };
  }, game);
  assert.ok(result.errors.every(error => typeof error === 'string' && /[가-힣]/.test(error)), JSON.stringify(result.errors));
  assert.equal(result.unchanged, true);
  assert.doesNotMatch(JSON.stringify(result.normalized), /private|password|token|secret/);
});
for (const game of games) test(`${game.id}: import is blocked during live simulation or dialogs with no stale timer writes`, async t => {
  const page = await fixture(t, game);
  const data = await page.evaluate(() => window.transferAdapter.capture());
  page.on('dialog', dialog => dialog.accept());
  await page.click(game.id === 'church' ? '#sundayBtn' : '#classBtn');
  const blocked = await page.evaluate(data => {
    const a = window.transferAdapter, before = JSON.stringify(localStorage);
    let rejected = false; try { a.restore(data); } catch (e) { rejected = /[가-힣]/.test(e.message); }
    return { allowed: a.canImport(), rejected, unchanged: before === JSON.stringify(localStorage) };
  }, data);
  assert.equal(typeof blocked.allowed, 'string');
  assert.equal(blocked.rejected, true);
  assert.equal(blocked.unchanged, true);
  await page.reload();
  await page.click(game.id === 'church' ? '#renameBtn' : '[data-act="teach"]');
  assert.equal(typeof await page.evaluate(() => window.transferAdapter.canImport()), 'string');
});
test('church: relationship focus and history survive normalized capture', async t => {
  const page = await fixture(t, games[0]);
  assert.equal(await page.evaluate(() => {
    const a = window.transferAdapter, data = a.capture();
    data.state.focus = 'relation'; data.state.meetingDone = true;
    data.state.week = 5; data.state.history = [{ week: 1, att: 7, total: 10, retreat: false }];
    a.restore(a.validate(data)); return a.capture().state.focus;
  }), 'relation');
});
for (const game of games) test(`${game.id}: noninitial identity counter and completed progress survive reload`, async t => {
  const page = await fixture(t, game);
  const expected = await page.evaluate(game => {
    const a = window.transferAdapter, data = a.capture();
    data.state.nextId = 800;
    data.state.students[0].id = 700;
    if (game.id === 'church') {
      data.state.week = 6; data.state.meetingDone = true; data.state.focus = 'relation';
      data.state.history = [{ week: 1, att: 8, total: 10, retreat: false }];
    } else {
      data.state.month = 6; data.state.fac.room = 2;
      data.state.teachers = [{ id: 750, name: '김선생', style: 'kind', skill: 85, salary: 2200000, months: 5, look: data.state.students[0].look }];
      data.state.history = [{ month: 1, net: -150000, students: 8, rep: 35 }];
      data.state.consulted = [700];
    }
    a.restore(a.validate(data)); return a.capture();
  }, game);
  await page.reload();
  assert.deepEqual(await page.evaluate(() => window.transferAdapter.capture()), expected);
});
for (const game of games) test(`${game.id}: ending snapshots and delayed dialogs do not overwrite a later import`, async t => {
  const page = await fixture(t, game);
  const result = await page.evaluate(game => {
    const a = window.transferAdapter, original = a.capture(), ending = structuredClone(original);
    if (game.id === 'church') {
      ending.state.week = 12; ending.state.meetingDone = true;
    } else {
      ending.state.month = 12;
      ending.state.consulted = [ending.state.students[0].id];
      ending.state.students.shift(); // 졸업/퇴원한 원생 상담 ID도 기존 저장에는 남습니다.
    }
    ending.state.over = true;
    a.restore(a.validate(ending));
    const captured = a.capture();
    a.restore(a.validate(original));
    return { captured, restored: a.capture(), original: a.validate(original) };
  }, game);
  assert.equal(result.captured.state.over, true);
  assert.deepEqual(result.restored, result.original);
  await page.waitForTimeout(450);
  assert.deepEqual(await page.evaluate(() => window.transferAdapter.capture()), result.original);
});
for (const game of games) test(`${game.id}: stale scheduled meeting/scout cannot reopen after import`, async t => {
  const page = await fixture(t, game);
  const original = await page.evaluate(() => window.transferAdapter.capture());
  await page.evaluate(({ game, original }) => {
    const scheduled = structuredClone(original);
    if (game.id === 'church') { scheduled.state.week = 4; scheduled.state.meetingDone = false; }
    else {
      const teacher = { id: 700, name: '김선생', style: 'kind', skill: 80, salary: 2500000, months: 2, look: scheduled.state.students[0].look };
      scheduled.state.teachers = [teacher]; scheduled.state.nextId = 800;
      scheduled.state.pending = { type: 'scout', id: 700 };
    }
    localStorage.setItem(game.save, JSON.stringify(scheduled.state));
  }, { game, original });
  await page.reload();
  await page.evaluate(original => window.transferAdapter.restore(original), original);
  await page.waitForTimeout(450);
  assert.equal(await page.evaluate(() => document.getElementById('modalBg').hidden), true);
  assert.deepEqual(await page.evaluate(() => window.transferAdapter.capture()), original);
});
for (const game of games) test(`${game.id}: real bottom panel download/file import/cancel/wrong-game roundtrip`, async t => {
  const page = await fixture(t, game, true);
  await page.locator('#game-transfer-panel').waitFor();
  assert.equal(await page.evaluate(() => document.body.lastElementChild.id), 'game-transfer-panel');
  await page.click('#renameBtn'); await page.fill('#nameInput', '백업한 이름'); await page.click('#nameSave');
  await page.click(game.id === 'church' ? '[data-act="lesson"]' : '[data-act="promo"]');
  const saved = await page.evaluate(game => JSON.parse(localStorage.getItem(game.save)), game);
  const downloadPromise = page.waitForEvent('download'); await page.click('#game-export-btn');
  const download = await downloadPromise, payload = fs.readFileSync(await download.path(), 'utf8'), backup = JSON.parse(payload);
  assert.equal(backup.game, game.id); assert.equal(backup.version, 1);
  assert.doesNotMatch(payload, /keep-secret|unrelated-auth/);
  const input = page.locator('#game-import-file');
  const before = await page.evaluate(() => JSON.stringify(localStorage));
  await input.setInputFiles({ name: 'wrong.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...backup, game: 'not-this-game' })) });
  await page.waitForFunction(() => !document.querySelector('#game-import-file').disabled);
  assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), before);
  page.once('dialog', dialog => dialog.dismiss());
  await input.setInputFiles({ name: 'cancel.json', mimeType: 'application/json', buffer: Buffer.from(payload) });
  await page.waitForFunction(() => document.querySelector('#game-transfer-status').textContent.includes('취소'));
  assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), before);
  page.once('dialog', dialog => dialog.accept()); await page.click('#resetBtn');
  page.once('dialog', dialog => dialog.accept());
  await input.setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(payload) });
  await page.waitForFunction(() => document.querySelector('#game-transfer-status').textContent === '게임 데이터를 불러왔습니다.');
  const imported = await page.evaluate(game => ({ state: JSON.parse(localStorage.getItem(game.save)), name: localStorage.getItem(game.name), auth: localStorage.getItem('unrelated-auth') }), game);
  for (const key of Object.keys(saved)) assert.deepEqual(imported.state[key], saved[key], key);
  assert.equal(imported.name, '백업한 이름'); assert.equal(imported.auth, 'keep-secret');
  await page.reload(); assert.match(await page.locator('body').innerText(), /백업한 이름/);
  assert.deepEqual(await page.evaluate(game => JSON.parse(localStorage.getItem(game.save)), game), imported.state);
});
