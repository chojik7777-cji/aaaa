'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createNoteFolderHandler } = require('../note-folder.js');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'note-family-'));
const handler = createNoteFolderHandler(dir);

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
async function call(method, url, body) {
  const res = mockRes();
  await handler({ method, url, headers: { host: 'localhost' }, body: body || (method === 'POST' ? {} : undefined) }, res);
  const buf = await res.done;
  const type = res.headers['content-type'] || '';
  return type.includes('application/json') ? { status: res.statusCode, data: JSON.parse(buf.toString()) } : { status: res.statusCode, headers: res.headers, body: buf };
}

(async () => {
  let r = await call('GET', '/api/note/state?room=default');
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

  fs.rmSync(dir, { recursive: true, force: true });
  console.log('note-folder ok');
})().catch((e) => { console.error(e); process.exit(1); });
