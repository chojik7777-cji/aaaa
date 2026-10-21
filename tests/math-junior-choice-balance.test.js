'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {generate} = require('../math-junior-problems');
test('place-value choices use competing digits at the requested place, not unit offsets', () => {
 for (const randomValue of [0, 0.2, 0.4, 0.6, 0.8, 0.999]) {
  const q = generate('e4', 0, () => randomValue);
  const unit = 10 ** (4 - q.givens.position);
  assert.equal(new Set(q.choices).size, 4);
  for (const value of q.choices.map(Number)) {
   assert.equal(value % unit, 0, `${value} must be a multiple of ${unit}`);
   assert(value >= (q.answer === 0 ? 0 : unit) && value <= 9 * unit, 'nonzero place-value choices stay at the same magnitude');
  }
 }
});
test('angle choices are possible adjacent angles on the same ten-degree scale', () => {
 for (const randomValue of [0, 0.2, 0.5, 0.999]) {
  const q = generate('e4', 1, () => randomValue);
  assert.equal(new Set(q.choices).size, 4);
  for (const value of q.choices.map(Number)) {
   assert.equal(value % 10, 0, `${value} gives away the only round angle`);
   assert(value > 0 && value < 180);
  }
 }
});
test('alternating patterns vary the next symbol and length while exposing the actual sequence', () => {
 let seed = 17;
 const rng = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
 const answers = new Set(), lengths = new Set(), pairs = new Set();
 for (let i = 0; i < 120; i++) {
  const q = generate('k-compare', 1, rng);
  const shown = q.visual.symbols.slice(0, -1);
  assert.equal(q.visual.symbols.at(-1), '?');
  assert.deepEqual(q.givens.symbols, shown, 'givens contain the shown sequence for independent checks');
  assert.notEqual(shown[0], shown[1]);
  shown.forEach((symbol, index) => assert.equal(symbol, shown[index % 2]));
  assert.equal(q.answer, shown.at(-2), 'next item repeats the item two positions before it');
  assert(q.solutionSteps.at(-1).includes(q.answer));
  assert.equal(new Set(q.choices).size, 4);
  assert(q.choices.includes(q.answer));
  answers.add(q.answer); lengths.add(shown.length); pairs.add(shown.slice(0, 2).join(''));
 }
 assert(answers.size >= 2, 'always choosing circle must not solve every pattern');
 assert(lengths.size >= 2, 'sequence lengths should vary');
 assert(pairs.size >= 2, 'starting pairs should vary');
});
for (const [topic, track, index, valid] of [
 ['decimal sums', 'e4', 2, q => q.choices.some(value => !Number.isInteger(Number(value))) && q.choices.every(value => Math.abs(Number(value) - q.answer) <= 0.301)],
 ['perimeters', 'e4', 3, q => q.choices.every(value => Number(value) % 2 === 0)],
 ['circle areas', 'e6', 1, q => q.choices.every(value => Math.abs(Number(value) / 3.14 - Math.round(Number(value) / 3.14)) < 1e-8)]
]) {
 test(`${topic} choices retain the topic-specific numeric scale`, () => {
  for (const randomValue of [0, 0.2, 0.5, 0.999]) {
   assert(valid(generate(track, index, () => randomValue)), `${topic}: scale mismatch at RNG ${randomValue}`);
  }
 });
}
test('numeric distractors do not consistently reveal the answer as the smallest choice', () => {
 let seed = 17;
 const rng = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
 let notSmallest = 0;
 for (let i=0;i<120;i++) {
  const q = generate('e2',i,rng);
  if (typeof q.answer !== 'number') continue;
  const nums = q.choices.map(Number);
  assert(nums.every(Number.isFinite));
  assert.equal(new Set(q.choices).size,4);
  if (q.answer > Math.min(...nums)) notSmallest++;
 }
 assert(notSmallest > 20, '정답보다 작은 오답도 있어야 최솟값 찍기를 방지합니다');
});
