'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const {createGenerator}=require('../math-problems');
test('terminating fractions longer than two decimal places are not described as unchanged by rounding',()=>{
 let seed=1922;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};const g=createGenerator({random});let q;
 for(let i=0;i<5000;i++){const candidate=g.generate(17);if(candidate.templateId==='probability-single'&&candidate.answer===0.375){q=candidate;break;}}
 assert(q,'deterministic 3/8 probability case');const text=q.solutionSteps.join('\n');assert.match(text,/3\/8 ≈ 0\.38/);assert.doesNotMatch(text,/이미 정확한 유한소수이면 값은 변하지 않습니다/);assert.match(text,/소수 둘째 자리 이내의 유한소수/);
});
