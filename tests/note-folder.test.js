'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createNoteFolderHandler } = require('../note-folder.js');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'note-family-'));
let clock = 1_000_000;
let password = '0000';
const handler = createNoteFolderHandler(dir, { password: () => password, now: () => clock });
let tok = '';

function mockRes() {
  const { PassThrough } = require('stream');
  const res = new PassThrough();
  res.statusCode = 0; res.headers = {};
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.done = new Promise((r) => res.on('finish', () => r(Buffer.concat(chunks))));
  return res;
}
async function call(method, url, body, ip = '1.1.1.1') {
  const res = mockRes();
  await handler({ method, url, headers: { host: 'localhost', 'x-note-token': tok, 'cf-connecting-ip': ip }, body: body || (method === 'POST' ? {} : undefined) }, res);
  const buf = await res.done;
  const type = res.headers['content-type'] || '';
  return type.includes('application/json') ? { status: res.statusCode, data: JSON.parse(buf.toString()) } : { status: res.statusCode, headers: res.headers, body: buf };
}

(async () => {
  // 비밀번호 없이는 막힘
  let r = await call('GET', '/api/note/state?room=default');
  assert.strictEqual(r.status, 401);
  assert.strictEqual(r.data.authRequired, true);

  // 4번 틀리고 맞추면 통과 (실패 횟수 초기화)
  for (let i = 0; i < 4; i++) assert.strictEqual((await call('POST', '/api/note/login', { password: 'x' })).status, 401);
  r = await call('POST', '/api/note/login', { password: '0000' });
  assert.strictEqual(r.status, 200);
  tok = r.data.token;
  assert.ok(tok);

  // 다른 IP가 5번 틀리면 1시간 잠금 (맞는 비번도 거부), 1시간 뒤 풀림
  for (let i = 0; i < 4; i++) await call('POST', '/api/note/login', { password: 'x' }, '2.2.2.2');
  r = await call('POST', '/api/note/login', { password: 'x' }, '2.2.2.2');
  assert.strictEqual(r.status, 429);
  r = await call('POST', '/api/note/login', { password: '0000' }, '2.2.2.2');
  assert.strictEqual(r.status, 429);
  assert.strictEqual((await call('POST', '/api/note/login', { password: '0000' }, '3.3.3.3')).status, 200, '다른 접속은 영향 없음');
  clock += 60 * 60 * 1000 + 1;
  assert.strictEqual((await call('POST', '/api/note/login', { password: '0000' }, '2.2.2.2')).status, 200);

  // 다운로드 링크용 ?token= 도 허용
  const saved = tok; tok = '';
  r = await call('GET', `/api/note/state?room=default&token=${saved}`);
  assert.strictEqual(r.status, 200);
  tok = saved;

  r = await call('GET', '/api/note/state?room=default');
  assert.strictEqual(r.data.storage, 'folder');
  assert.strictEqual(r.data.files.length, 0);

  r = await call('POST', '/api/note/save?room=default', { text: '가족 메모', user: 'A' });
  assert.strictEqual(r.data.version, 1);
  assert.strictEqual(fs.readFileSync(path.join(dir, '.note-memo.txt'), 'utf8'), '가족 메모');

  r = await call('POST', '/api/note/upload?room=default', { name: '사진.txt', dataUrl: 'data:text/plain;base64,7JWI64WV', user: 'B' });
  assert.strictEqual(r.data.files.length, 1);
  assert.strictEqual(r.data.files[0].uploadedBy, 'B');
  assert.ok(fs.existsSync(path.join(dir, '사진.txt')), '폴더에 실제 파일로 저장');

  // 같은 이름은 덮어쓰지 않고 (1) 붙이기
  r = await call('POST', '/api/note/upload?room=default', { name: '사진.txt', dataUrl: 'data:text/plain;base64,7JWI64WV', user: 'B' });
  assert.deepStrictEqual(r.data.files.map((f) => f.name).sort(), ['사진 (1).txt', '사진.txt']);

  // Finder로 직접 넣은 파일도 목록에 보임, 숨김 파일과 하위 폴더는 안 보임
  fs.writeFileSync(path.join(dir, 'finder.pdf'), 'x');
  fs.mkdirSync(path.join(dir, 'sub'));
  r = await call('GET', '/api/note/state?room=default');
  assert.deepStrictEqual(r.data.files.map((f) => f.name).sort(), ['finder.pdf', '사진 (1).txt', '사진.txt']);

  r = await call('GET', `/api/note/file?room=default&id=${encodeURIComponent('사진.txt')}`);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.toString(), '안녕');

  // 폴더 밖이나 숨김 파일 접근 차단
  for (const id of ['../etc/passwd', '.note-memo.txt', 'sub']) {
    r = await call('GET', `/api/note/file?room=default&id=${encodeURIComponent(id)}`);
    assert.strictEqual(r.status, 404, id);
  }
  r = await call('POST', '/api/note/upload?room=default', { name: '../../evil.txt', dataUrl: 'data:text/plain;base64,eA==' });
  assert.ok(fs.existsSync(path.join(dir, 'evil.txt')));
  assert.ok(!fs.existsSync(path.join(dir, '..', 'evil.txt')));

  r = await call('POST', '/api/note/delete-file?room=default', { id: 'finder.pdf', user: 'A' });
  assert.ok(!fs.existsSync(path.join(dir, 'finder.pdf')));

  // 다른 room은 하위 폴더
  r = await call('POST', '/api/note/save?room=trip', { text: '여행', user: 'A' });
  assert.strictEqual(fs.readFileSync(path.join(dir, 'trip', '.note-memo.txt'), 'utf8'), '여행');

  // 비밀번호를 바꾸면 기존 토큰은 무효
  password = '9999';
  assert.strictEqual((await call('GET', '/api/note/state?room=default')).status, 401);
  // .note-password 같은 숨김 파일은 목록·다운로드 불가
  password = '0000';
  fs.writeFileSync(path.join(dir, '.note-password'), 'secret');
  r = await call('GET', '/api/note/state?room=default');
  assert.ok(!r.data.files.some((f) => f.name.startsWith('.')));
  assert.strictEqual((await call('GET', '/api/note/file?room=default&id=.note-password')).status, 404);

  // 비밀번호 설정이 없으면 기본 비밀번호 1313
  password = '';
  assert.strictEqual((await call('POST', '/api/note/login', { password: '0000' }, '4.4.4.4')).status, 401);
  assert.strictEqual((await call('POST', '/api/note/login', { password: '1313' }, '4.4.4.4')).status, 200);

  fs.rmSync(dir, { recursive: true, force: true });
  console.log('note-folder ok');
})().catch((e) => { console.error(e); process.exit(1); });
