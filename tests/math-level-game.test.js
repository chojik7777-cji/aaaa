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
assert.match(game, /id="estimateLevel"/, '추정 레벨 표시가 있어야 합니다');
assert.match(game, /id="confidenceText"/, '수렴/신뢰도 표시가 있어야 합니다');
assert.match(game, /function generateProblem\(level/, '레벨 기반 문제 생성 함수가 있어야 합니다');
assert.match(game, /function updateAbility\(correct/, '결과 기반 능력치 갱신 함수가 있어야 합니다');
assert.match(game, /function chooseNextLevel\(/, '다음 문제 난이도 선택 함수가 있어야 합니다');
assert.match(game, /1 \/ \(1 \+ Math\.exp\(-\(state\.theta - difficulty\)\)\)/, '정답 확률 예측으로 난이도를 조정해야 합니다');
assert.match(game, /state\.theta \+=/, '풀이 결과에 따라 추정 레벨이 갱신되어야 합니다');
assert.match(game, /localStorage\.setItem\(SAVE_KEY/, '진행 기록이 저장되어야 합니다');
assert.match(game, /최근 풀이 흐름/, '풀이 흐름 시각화가 있어야 합니다');
assert.match(intro, /href="math-level\.html">수학 문제풀이 레벨 게임<\/a>/, '소개 페이지에 수학 문제풀이 레벨 게임 링크가 있어야 합니다');

console.log('math level game tests passed');
