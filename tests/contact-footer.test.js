'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pages = [
  'intro.html',
  'index.html',
  'cafe.html',
  'church.html',
  'math-academy.html',
  'math-level.html',
  'math-control.html',
  'omok.html',
  'omok-dashboard.html',
  'baduk.html',
  'baduk-dashboard.html',
  'yut.html',
  'yut-dashboard.html',
  'note.html',
  'note2.html',
  'detail-admin-jik-2026.html',
  'ladder.html',
];

for (const page of pages) {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  assert.match(html, /문의\s*:/, `${page} 최하단에 문의 표시가 있어야 합니다`);
  assert.match(html, /chojeongik@naver\.com/, `${page} 최하단에 문의 이메일이 있어야 합니다`);
  assert.match(html, /mailto:chojeongik@naver\.com/, `${page} 문의 이메일은 메일 링크여야 합니다`);
}

console.log('contact footer tests passed');
