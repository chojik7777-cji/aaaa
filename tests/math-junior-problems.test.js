'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const modulePath = path.join(__dirname, '../math-junior-problems.js');
function rng(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
test('all nine tracks provide age-appropriate varied templates and exact answers', () => {
 const m = require(modulePath);
 assert.equal(m.tracks.length, 9);
 const oracles = {
  count: g=>g.n, compare:g=>g.a>g.b?'왼쪽':'오른쪽', pattern:g=>g.symbols[g.symbols.length%2], shape:g=>g.name,
  add:g=>g.items.reduce((a,b)=>a+b,0), subtract:g=>g.a-g.b, tens:g=>Number(`${g.tens}${g.ones}`), sides:g=>g.sides,
  multiply:g=>Array(g.b).fill(g.a).reduce((a,b)=>a+b,0), clock:g=>g.hour+':30', length:g=>g.m*100+g.cm,
  divide:g=>g.a/g.b, fraction:g=>g.total/g.den*g.num, perimeter:g=>[g.w,g.h,g.w,g.h].reduce((a,b)=>a+b,0),
  place:g=>String(g.n)[g.position]*10**(String(g.n).length-g.position-1), angle:g=>180-g.a,
  decimalAdd:g=>(g.a+g.b)/10, area:g=>Array(g.h).fill(g.w).reduce((a,b)=>a+b,0),
  mean:g=>g.items.reduce((a,b)=>a+b,0)/g.items.length, volume:g=>g.w*g.h*g.d,
  ratio:g=>g.whole*g.percent/100, circle:g=>g.r*g.r*3.14
 };
 for(const track of m.tracks) {
  const types=new Set();
  for(let i=0;i<120;i++) {
   const p=m.generate(track.id,i,rng(i+1)); types.add(p.template);
   const expected=oracles[p.template](p.givens);
   if(typeof expected==='number') assert(Math.abs(Number(p.answer)-expected)<1e-8, p.template);
   else assert.equal(p.answer,expected);
   assert.equal(p.choices.length,4); assert.equal(new Set(p.choices).size,4);
   assert(p.choices.includes(String(p.answer))); assert(p.solutionSteps.length>=2);
   assert(p.solutionSteps.every(s=>typeof s==='string' && s.length>5));
   if(track.id.startsWith('k-')) assert(p.visual);
   assert.deepEqual(p,m.generate(track.id,i,rng(i+1)));
  }
  assert(types.size >= (track.id.startsWith('e')?4:track.id==='k-compare'?2:1),track.id);
 }
 assert.throws(()=>m.generate('bad'),RangeError);
});
test('kindergarten counting: pure seeded visual questions with four distinct choices', () => {
 assert(fs.existsSync(modulePath), 'junior generator module must exist');
 const m = require(modulePath);
 const a = m.generate('k-count', 0, rng(12));
 assert.deepEqual(a, m.generate('k-count', 0, rng(12)));
 assert.equal(a.answer, a.visual.symbols.length);
 assert.equal(a.choices.length, 4);
 assert.equal(new Set(a.choices).size, 4);
 assert(a.choices.includes(String(a.answer)));
 assert(a.solutionSteps.length >= 2);
});
