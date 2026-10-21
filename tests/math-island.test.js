'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'math-island.html'), 'utf8');
assert.match(html, /<title>수학 모험섬<\/title>/);
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const sandbox = { module: { exports: {} } };
vm.runInNewContext(script, sandbox);
const { GAMES, frogPads, sum, mulberry32 } = sandbox.module.exports;

for (const age of [0, 1, 2]) {
  for (let seed = 1; seed <= 400; seed++) {
    const rnd = mulberry32(seed * 7 + age);
    for (const key of ['fish', 'balloon', 'race']) {
      const q = GAMES[key](rnd, age);
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0, `${key} 정답은 0 이상 정수`);
      assert.ok(q.choices.includes(q.answer), `${key} 보기에 정답 포함`);
      assert.strictEqual(new Set(q.choices).size, q.choices.length, `${key} 보기 중복 없음`);
      assert.ok(q.choices.every((v) => Number.isInteger(v) && v >= 0), `${key} 보기는 0 이상 정수`);
      assert.ok(q.choices.length >= 2);
      if (age === 0) assert.ok(q.answer <= 10, '유아는 10 이하');
      if (age === 1) assert.ok(q.answer <= 20, '초등 1~2는 20 이하');
    }
    const f = GAMES.frog(rnd, age);
    assert.strictEqual(f.answer, f.start + f.step);
    assert.ok(f.answer >= 0 && f.answer <= f.max);
    assert.ok(f.choices.includes(f.answer));
    const pads = frogPads(f);
    assert.strictEqual(pads.length, 11);
    for (const v of [f.start, f.answer, ...f.choices]) assert.ok(pads.includes(v), `연잎에 ${v}가 보여야 함 (age ${age})`);

    const p = GAMES.pair(rnd, age);
    assert.strictEqual(p.tiles.length, 8, '짝꿍 카드 8장');
    // 카드를 모두 짝지을 수 있어야 함
    const left = p.tiles.slice();
    while (left.length) {
      const a = left.shift();
      const i = left.indexOf(p.target - a);
      assert.ok(i >= 0, `짝 없음: ${a} (목표 ${p.target})`);
      left.splice(i, 1);
    }

    const s = GAMES.shop(rnd, age);
    assert.ok(s.price > 0 && s.price % 10 === 0, '가격은 10원 단위');
    assert.ok(s.coins.includes(10), '10원으로 항상 딱 맞게 낼 수 있음');
    assert.ok(s.price / 10 <= 300);
  }
}
assert.strictEqual(sum([10, 50, 100]), 160);

// 메뉴 링크와 하단 문의
assert.match(fs.readFileSync(path.join(__dirname, '..', 'intro.html'), 'utf8'), /href="math-island\.html"/);
assert.match(html, /mailto:chojeongik@naver\.com/);
console.log('math-island ok');
