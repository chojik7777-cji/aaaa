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
const { LEVELS, GAMES, BASIC, isPair, fmtDec, fmtFrac, gcd, lcm, mulberry32 } = sandbox.module.exports;

assert.deepStrictEqual(Array.from(LEVELS), ['유아', '1학년', '2학년', '3학년', '4학년', '5학년', '6학년']);
for (let lv = 0; lv <= 6; lv++) assert.ok(html.includes(`data-age="${lv}"`), `${LEVELS[lv]} 버튼`);

// 표시 형식
assert.strictEqual(fmtDec(38, 10), '3.8');
assert.strictEqual(fmtDec(1256, 100), '12.56');
assert.strictEqual(fmtDec(30, 10), '3');
assert.strictEqual(fmtFrac(5, 4), '1 1/4');
assert.strictEqual(fmtFrac(2, 4), '1/2');
assert.strictEqual(fmtFrac(6, 3), '2');

// 보기 글자 → 수
function val(label) {
  const m = String(label).match(/^(\d+) (\d+)\/(\d+)$/);
  if (m) return +m[1] + m[2] / m[3];
  const f = String(label).match(/^(\d+)\/(\d+)$/);
  if (f) return f[1] / f[2];
  return Number(label);
}
// 식으로 된 문제는 직접 계산해서 정답 확인
function check(q, where) {
  assert.ok(typeof q.answer === 'string' && q.answer.length, `${where} 정답 글자`);
  assert.ok(q.choices.includes(q.answer), `${where} 보기에 정답 포함: ${q.text}`);
  assert.strictEqual(new Set(q.choices).size, q.choices.length, `${where} 보기 중복: ${q.choices}`);
  for (const c of q.choices) {
    assert.ok(/^\d+(\.\d+)?$|^\d+\/\d+$|^\d+ \d+\/\d+$/.test(c), `${where} 보기 형식 이상: "${c}" (${q.text})`);
    assert.ok(val(c) >= 0 && Number.isFinite(val(c)));
  }
  const t = q.text;
  if (/^[\d./ +−×÷]+$/.test(t)) {
    const expr = t.replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/');
    const v = Function(`return (${expr})`)();
    assert.ok(Math.abs(v - val(q.answer)) < 1e-9, `${where} 계산 틀림: ${t} = ${v}, 정답 ${q.answer}`);
  }
  let m;
  if ((m = t.match(/^(\d+)[와과] (\d+)의 최대공약수$/))) assert.strictEqual(+q.answer, gcd(+m[1], +m[2]));
  if ((m = t.match(/^(\d+)[와과] (\d+)의 최소공배수$/))) assert.strictEqual(+q.answer, lcm(+m[1], +m[2]));
  if ((m = t.match(/^(\d+)의 (\d+)%$/))) assert.strictEqual(+q.answer, m[1] * m[2] / 100);
  if ((m = t.match(/^(\d+) : (\d+) = (\d+) : \?$/))) assert.strictEqual(+q.answer, m[2] * m[3] / m[1]);
  if ((m = t.match(/^반지름 (\d+)cm/))) assert.ok(Math.abs(val(q.answer) - 3.14 * m[1] * m[1]) < 1e-9);
}

for (let lv = 0; lv <= 6; lv++) {
  for (let seed = 1; seed <= 500; seed++) {
    const rnd = mulberry32(seed * 13 + lv);
    for (const key of ['fish', 'balloon', 'race']) {
      const q = GAMES[key](rnd, lv);
      check(q, `${LEVELS[lv]} ${key}`);
      if (lv === 0) assert.ok(val(q.answer) <= 10, '유아는 10 이하');
      if (lv === 1) assert.ok(val(q.answer) <= 99, '1학년은 100보다 작은 수');
    }
    const f = GAMES.frog(rnd, lv);
    assert.strictEqual(f.pads.length, 11);
    assert.notStrictEqual(f.start, f.end);
    assert.ok(f.start >= 0 && f.end >= 0 && f.start <= 10 && f.end <= 10, `연잎 범위 ${f.start}→${f.end}`);
    assert.strictEqual(f.answer, f.pads[f.end]);
    assert.ok(f.choices.includes(f.answer) && f.choices.every((c) => f.pads.includes(c)));
    assert.strictEqual(new Set(f.choices).size, 4);

    const p = GAMES.pair(rnd, lv);
    assert.strictEqual(p.tiles.length, 8, '짝꿍 카드 8장');
    const left = p.tiles.slice();
    while (left.length) {
      const a = left.shift();
      const i = left.findIndex((b) => isPair(a, b, p.target));
      assert.ok(i >= 0, `짝 없음: ${a.label} (목표 ${p.target})`);
      left.splice(i, 1);
    }

    const s = GAMES.shop(rnd, lv);
    assert.ok(s.price > 0 && s.price % 10 === 0, `가격은 10원 단위: ${s.price}`);
    assert.ok(s.coins.includes(10));
    const big = [...s.coins].sort((a, b) => b - a);
    let rest = s.price, count = 0;
    for (const c of big) while (rest >= c) { rest -= c; count++; }
    assert.ok(count <= 30, `동전 30개 안에 낼 수 있어야 함: ${s.price}`);
  }
  // 학년별 문제 종류를 하나하나 직접 확인
  BASIC[lv].forEach((gen, k) => {
    for (let seed = 1; seed <= 300; seed++) check(gen(mulberry32(seed * 31 + k)), `${LEVELS[lv]} 종류${k + 1}`);
  });
}

// 메뉴 링크와 하단 문의
assert.match(fs.readFileSync(path.join(__dirname, '..', 'intro.html'), 'utf8'), /href="math-island\.html"/);
assert.match(html, /mailto:chojeongik@naver\.com/);
console.log('math-island ok');
