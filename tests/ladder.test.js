'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'ladder.html'), 'utf8');
const intro = fs.readFileSync(path.join(root, 'intro.html'), 'utf8');

assert.match(html, /<title>사다리 게임<\/title>/, '사다리 게임 페이지 제목이 있어야 합니다');
assert.match(intro, /href="ladder\.html"/, '자기소개 메뉴에 사다리 게임 링크가 있어야 합니다');

// 페이지 스크립트의 사다리 규칙 함수를 꺼내 검사
const script = html.split('<script>')[1].split('</script>')[0];
const mod = { exports: {} };
new Function('module', 'document', script)(mod, undefined);
const { makeLadder, tracePath } = mod.exports;

for (let n = 2; n <= 10; n++) {
  for (let seed = 1; seed <= 300; seed++) {
    const rungs = makeLadder(n, seed);
    // 같은 높이에서 가로줄이 붙어 있으면 길이 갈라지므로 안 됨
    for (const row of rungs) {
      assert.strictEqual(row.length, n - 1);
      for (let g = 1; g < row.length; g++) assert.ok(!(row[g] && row[g - 1]), `n=${n} seed=${seed}: 붙어 있는 가로줄`);
    }
    // 모든 칸에 가로줄이 최소 1개
    for (let g = 0; g < n - 1; g++) assert.ok(rungs.some(row => row[g]), `n=${n} seed=${seed}: ${g}번 칸에 가로줄 없음`);
    // 출발점마다 도착점이 모두 달라야 함 (1:1 대응)
    const ends = Array.from({ length: n }, (_, i) => tracePath(rungs, i).end);
    assert.deepStrictEqual(ends.slice().sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i), `n=${n} seed=${seed}: 결과가 겹침`);
  }
}
// 같은 시드면 같은 사다리 (공유 링크)
assert.deepStrictEqual(makeLadder(6, 12345), makeLadder(6, 12345), '같은 시드는 같은 사다리여야 합니다');
assert.notDeepStrictEqual(makeLadder(6, 12345), makeLadder(6, 54321), '다른 시드는 다른 사다리여야 합니다');

console.log('ladder tests passed');
