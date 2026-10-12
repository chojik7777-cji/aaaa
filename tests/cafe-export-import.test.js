'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'cafe.html'), 'utf8');

assert.match(html, /id="exportStateBtn"/, '카페게임에 현재상태 export 버튼이 있어야 합니다');
assert.match(html, /id="importStateBtn"/, '카페게임에 현재상태 import 버튼이 있어야 합니다');
assert.match(html, /id="importStateFile"[^>]*type="file"/, '카페게임에 JSON 파일 import 입력이 있어야 합니다');
assert.match(html, /function createExportPayload\(/, '내보내기 payload 생성 함수가 있어야 합니다');
assert.match(html, /function exportState\(/, '현재상태 export 함수가 있어야 합니다');
assert.match(html, /function importStateFromFile\(/, '파일에서 현재상태 import 함수가 있어야 합니다');
assert.match(html, /function applyImportedState\(/, '불러온 상태 적용 함수가 있어야 합니다');
assert.match(html, /version:\s*1/, 'export payload에는 버전이 포함되어야 합니다');
assert.match(html, /cafe-game-state-/, '다운로드 파일명은 카페게임 상태 파일임을 알 수 있어야 합니다');
assert.match(html, /불러오면 현재 저장된 카페 상태가 바뀝니다/, 'import 전에 기존 상태 변경 경고가 있어야 합니다');
assert.match(html, /Object\.assign\(base\.recommend, imported\.recommend \|\| \{\}\)/, 'import 시 추천 설정을 기본값과 병합해야 합니다');
assert.match(html, /if \(G && !G\.over\)/, '영업 중 import는 중단 확인/방어 처리가 있어야 합니다');

console.log('cafe export/import tests passed');
