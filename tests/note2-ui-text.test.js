'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'note2.html'), 'utf8');

assert.match(html, /<title>공동메모장<\/title>/, 'note2.html 브라우저 제목은 공동메모장이어야 합니다');
assert.match(html, /<h1>📝 공동메모장<\/h1>/, 'note2.html 화면 제목은 공동메모장이어야 합니다');
assert.doesNotMatch(html, /공동 메모장 B|공동메모장B/, 'note2.html에는 공동메모장B 표기가 남아 있으면 안 됩니다');
assert.doesNotMatch(html, /같은 URL을 공유하면 여러 명이 텍스트와 첨부파일을 함께 관리할 수 있습니다/, '제목 바로 아래 설명 문구는 삭제되어야 합니다');
assert.doesNotMatch(html, /주소 끝\s*<b>\?room=이름<\/b>마다 따로 관리돼요\./, 'room 설명 문구는 삭제되어야 합니다');
assert.doesNotMatch(html, /폴더에 저장/, '하단 저장소 안내에 폴더에 저장 문구가 표시되면 안 됩니다');
assert.doesNotMatch(html, /d\.folder/, '저장소 안내 UI가 실제 폴더 경로를 노출하면 안 됩니다');

console.log('note2 UI text tests passed');
