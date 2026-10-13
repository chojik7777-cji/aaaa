'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const portal = fs.readFileSync(path.resolve(__dirname, '..', 'portal-server.js'), 'utf8');

assert.match(portal, /createNoteFolderHandler\(NOTE_DIR/, '로컬 포털 서버는 note.html을 맥미니 note/family 폴더 저장 API로 연결해야 합니다');
assert.match(portal, /createNoteFolderHandler\(NOTE2_DIR/, '로컬 포털 서버는 note2.html을 맥미니 note2/<room> 폴더 저장 API로 연결해야 합니다');
assert.match(portal, /pathname === '\/api\/note'/, '로컬 포털 서버는 /api/note 요청을 처리해야 합니다');
assert.match(portal, /pathname\.startsWith\('\/api\/note\/'\)/, '로컬 포털 서버는 /api/note/<action> 요청을 처리해야 합니다');
assert.match(portal, /pathname === '\/api\/note2'/, '로컬 포털 서버는 /api/note2 요청을 처리해야 합니다');
assert.match(portal, /pathname\.startsWith\('\/api\/note2\/'\)/, '로컬 포털 서버는 /api/note2/<action> 요청을 처리해야 합니다');
assert.match(portal, /inside\(NOTE_DIR\).*inside\(NOTE_BASE\).*inside\(OLD_NOTE_DIR\).*inside\(NOTE2_DIR\)/s, '공유노트 저장 폴더는 정적 파일로 직접 노출되면 안 됩니다');

console.log('portal server note route tests passed');
