'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const game = fs.readFileSync(path.join(root, 'math-level.html'), 'utf8');
const intro = fs.readFileSync(path.join(root, 'intro.html'), 'utf8');

assert.match(game, /<title>수학 레벨 진단 게임<\/title>/, '수학 레벨 진단 게임 페이지 제목이 있어야 합니다');
assert.match(game, /id="startLevel"/, '시작 레벨 선택 UI가 있어야 합니다');
assert.match(game, /id="questionText"/, '문제 표시 영역이 있어야 합니다');
assert.match(game, /id="answerInput"/, '답 입력칸이 있어야 합니다');
assert.match(game, /id="submitBtn"/, '정답 제출 버튼이 있어야 합니다');
assert.match(game, /id="pauseBtn"/, '문제 풀이를 멈추고 재개하는 버튼이 있어야 합니다');
assert.match(game, /id="menuBtn"/, '문제 풀이 중 메뉴로 돌아가는 버튼이 있어야 합니다');
assert.match(game, /id="estimateLevel"/, '추정 레벨 표시가 있어야 합니다');
assert.match(game, /id="confidenceText"/, '수렴/신뢰도 표시가 있어야 합니다');
assert.match(game, /function generateProblem\(level/, '레벨 기반 문제 생성 함수가 있어야 합니다');
assert.match(game, /function updateAbility\(correct/, '결과 기반 능력치 갱신 함수가 있어야 합니다');
assert.match(game, /function chooseNextLevel\(/, '다음 문제 난이도 선택 함수가 있어야 합니다');
assert.match(game, /function togglePause\(/, '멈춤\/재개 함수가 있어야 합니다');
assert.match(game, /function goMenu\(/, '메뉴 복귀 함수가 있어야 합니다');
assert.match(game, /pausedTotal/, '멈춘 시간을 문제 풀이 시간에서 제외해야 합니다');
assert.match(game, /menuBtn'\)\.addEventListener\('click', goMenu\)/, '메뉴 버튼에 goMenu 이벤트가 연결되어야 합니다');
assert.match(game, /MAX_LEVEL = 18/, '중1부터 고3까지 18단계 레벨 체계여야 합니다');
assert.match(game, /const CURRICULUM = \[/, '교과과정 레벨 메타데이터가 있어야 합니다');
for (const label of ['중1', '중2', '중3', '고1', '고2', '고3']) {
  assert.match(game, new RegExp(label), `${label} 과정이 포함되어야 합니다`);
}
for (const topic of ['정수와 유리수', '연립방정식', '이차함수', '수열', '미분', '적분', '확률과 통계', '기하', '수능 종합']) {
  assert.match(game, new RegExp(topic), `${topic} 단원이 포함되어야 합니다`);
}
assert.match(game, /1 \/ \(1 \+ Math\.exp\(-\(state\.theta - difficulty\)\)\)/, '정답 확률 예측으로 난이도를 조정해야 합니다');
assert.match(game, /state\.theta \+=/, '풀이 결과에 따라 추정 레벨이 갱신되어야 합니다');
assert.match(game, /localStorage\.setItem\(SAVE_KEY/, '진행 기록이 저장되어야 합니다');
assert.match(game, /최근 풀이 흐름/, '풀이 흐름 시각화가 있어야 합니다');
assert.match(game, /function curriculumLabel\(/, '추정 레벨을 교과 라벨로 바꾸는 함수가 있어야 합니다');
assert.match(intro, /href="math-level\.html">수학 문제풀이 레벨 게임<\/a>/, '소개 페이지에 수학 문제풀이 레벨 게임 링크가 있어야 합니다');

console.log('math level game tests passed');
