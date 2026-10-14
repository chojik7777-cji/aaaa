'use strict';

const assert = require('assert');
const { fileHeaders } = require('../note-preview.js');

// 사진·PDF·텍스트는 inline 미리보기
let h = fileHeaders('사진.JPG', 'image/jpeg', true);
assert.strictEqual(h['Content-Type'], 'image/jpeg');
assert.ok(h['Content-Disposition'].startsWith('inline'));
assert.ok(fileHeaders('a.pdf', '', true)['Content-Disposition'].startsWith('inline'));
assert.strictEqual(fileHeaders('memo.txt', 'text/plain', true)['Content-Type'], 'text/plain; charset=utf-8');

// html·svg는 inline 요청이어도 다운로드 (같은 사이트에서 실행 방지)
for (const [name, type] of [['x.html', 'text/html'], ['x.svg', 'image/svg+xml'], ['x.png.html', 'image/png'], ['x', 'text/html']]) {
  h = fileHeaders(name, type, true);
  assert.ok(h['Content-Disposition'].startsWith('attachment'), name);
  assert.strictEqual(h['X-Content-Type-Options'], 'nosniff');
}
// inline 요청이 없으면 항상 다운로드
assert.ok(fileHeaders('사진.jpg', 'image/jpeg', false)['Content-Disposition'].startsWith('attachment'));
console.log('note-preview ok');
