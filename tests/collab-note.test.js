'use strict';

const assert = require('assert');
const handler = require('../api/note.js');

function mockReq(method, url, body = {}) {
  return { method, url, headers: { host: 'localhost' }, body };
}
function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: Buffer.alloc(0),
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(x) { this.body = Buffer.isBuffer(x) ? x : Buffer.from(x || ''); },
  };
}
async function call(method, url, body = {}) {
  const res = mockRes();
  await handler(mockReq(method, url, body), res);
  const type = res.headers['content-type'] || '';
  if (type.includes('application/json')) return { status: res.statusCode, headers: res.headers, data: JSON.parse(res.body.toString()) };
  return { status: res.statusCode, headers: res.headers, body: res.body };
}

(async () => {
  const room = `test_${Date.now()}`;
  let r = await call('GET', `/api/note/state?room=${room}`);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.ok, true);
  assert.strictEqual(r.data.text, '');
  assert.strictEqual(r.data.version, 0);

  r = await call('POST', `/api/note/save?room=${room}`, { room, text: '첫 공동 메모', user: 'A' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.text, '첫 공동 메모');
  assert.strictEqual(r.data.version, 1);
  assert.strictEqual(r.data.updatedBy, 'A');

  r = await call('POST', `/api/note/upload?room=${room}`, {
    room,
    name: 'hello.txt',
    type: 'text/plain',
    dataUrl: 'data:text/plain;base64,7JWI64WV',
    user: 'B',
  });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.files.length, 1);
  assert.strictEqual(r.data.files[0].name, 'hello.txt');
  const fileId = r.data.files[0].id;

  r = await call('GET', `/api/note/file?room=${room}&id=${fileId}`);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.headers['content-type'], 'text/plain');
  assert.strictEqual(r.body.toString(), '안녕');

  r = await call('POST', `/api/note/delete-file?room=${room}`, { room, id: fileId, user: 'A' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.files.length, 0);

  console.log('collab note api tests passed');
})().catch((err) => {
  console.error(err.stack || err);
  process.exit(1);
});
