'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {createGenerator} = require('../math-problems.js');
function seeded(seed) { return () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0)/4294967296); }
function factorial(n) { let v=1; for(let i=2;i<=n;i++) v*=i; return v; }
const specs = {
 'integer-add': [([a,b])=>a+b,/부호|절댓값/],
 'integer-subtract': [([a,b])=>a-b,/부호.*바꾸|반대/],
 'integer-multiply': [([a,b])=>a*b,/부호|음수|양수/],
 'integer-divide': [([a,b])=>a/b,/역연산|곱셈|부호/],
 'expression-linear': [([x,a,b])=>a*x+b,/대입/],
 'expression-square': [([x,a,b])=>a*x*x+b,/제곱/],
 'expression-distribute': [([x,a,b])=>a*(x+b),/괄호/],
 'expression-two-variables': [([x,y,a,b])=>a*x+b*y,/각각|대입/],
 'equation-linear': [([a,b,c])=>(c-b)/a,/양변|이항/],
 'equation-both-sides': [([a,b,c,d])=>(d-b)/(a-c),/양변|이항/],
 'equation-brackets': [([a,b,c])=>c/a-b,/양변/],
 'equation-fraction': [([a,b,c])=>a*(c-b),/양변/],
 'rational-add': [([a,b,c,d])=>a/b+c/d,/통분/],
 'rational-multiply': [([a,b,c,d])=>a*c/(b*d),/분자.*분모/],
 'decimal-fraction': [([a])=>a/100,/100|백/],
 'repeating-decimal': [([a])=>a/9,/10x.*x|10배/],
 'system-x': [n=>system(n)[0],/두.*식|둘째.*첫째/],
 'system-y': [n=>system(n)[1],/대입/],
 'system-sum': [n=>system(n)[0]+system(n)[1],/대입/],
 'system-difference': [n=>system(n)[0]-system(n)[1],/대입/],
 'linear-value': [([a,b,x])=>a*x+b,/대입/],
 'linear-slope': [([x,y,u,v])=>(v-y)/(u-x),/변화량/],
 'linear-intercept': [([a,x,y])=>y-a*x,/절편|y=ax/],
 'linear-inverse': [([a,b,y])=>(y-b)/a,/양변|이항/],
 'root-principal': [([a])=>Math.sqrt(a),/음이 아닌|0 이상/],
 'root-square': [([a])=>Math.abs(a),/절댓값/],
 'root-product': [([a,b])=>Math.sqrt(a)*Math.sqrt(b),/음이 아닌|0 이상/],
 'root-sum': [([a,b])=>Math.sqrt(a)+Math.sqrt(b),/각|각각/],
 'quadratic-root-sum': [([b])=>-b,/인수|계수/],
 'quadratic-root-product': [([b,c])=>c,/인수|계수/],
 'quadratic-larger-root': [([b,c])=>(-b+Math.sqrt(b*b-4*c))/2,/큰|비교/],
 'factor-evaluate': [([a,b,x])=>(x-a)*(x-b),/인수/],
 'parabola-value': [([a,b,x])=>a*x*x+b,/제곱/],
 'parabola-axis': [([a,h])=>h,/꼭짓점|대칭/],
 'parabola-extreme': [([a,h,k])=>k,/최솟값|최댓값/],
 'parabola-intercept': [([a,h,k])=>a*h*h+k,/x=0/],
 'remainder-quadratic': [([a,b,c,k])=>a*k*k+b*k+c,/나머지정리/],
 'remainder-cubic': [([a,b,k])=>a*k*k*k+b,/나머지정리/],
 'polynomial-product': [([a,b,c,d])=>a*d+b*c,/일차항/],
 'remainder-recover-constant': [([a,b,k,v])=>v-a*k*k-b*k,/나머지정리/],
 'root-distance': [([b,c])=>Math.sqrt(b*b-4*c),/절댓값/],
 'linear-inequality-count': [([a,b,c])=>Math.ceil((c-b)/a)-1,/양의 정수/],
 'quadratic-discriminant': [([a,b,c])=>b*b-4*a*c,/판별식/],
 'quadratic-inequality-count': [([a,b])=>b-a+1,/끝.*포함|경계.*포함/],
 'permutation': [([n,k])=>factorial(n)/factorial(n-k),/순서/],
 'combination': [([n,k])=>factorial(n)/factorial(k)/factorial(n-k),/순서|중복/],
 'function-compose': [([a,b,c,d,x])=>a*(c*x+d)+b,/안쪽|먼저/],
 'function-inverse': [([a,b,y])=>(y-b)/a,/입력|역함수/],
 'exponent-product': [([a,m,b,n])=>a**m*b**n,/지수.*더/],
 'exponent-quotient': [([a,m,b,n])=>a**m/b**n,/지수.*(?:빼|뺍)/],
 'logarithm-value': [([a,b])=>Math.log(b)/Math.log(a),/정의|거듭제곱/],
 'exponential-equation': [([a,b])=>Math.log(b)/Math.log(a),/밑/],
 'trig-sine': [([a])=>Math.sin(a*Math.PI/180),/단위원/],
 'trig-cosine': [([a])=>Math.cos(a*Math.PI/180),/단위원/],
 'trig-tangent': [([a])=>Math.tan(a*Math.PI/180),/sin.*cos|사인.*코사인/],
 'trig-triangle': [([l])=>l/2,/대변.*빗변/],
 'arithmetic-nth': [([a,d,n])=>a+(n-1)*d,/공차/],
 'arithmetic-sum': [([a,d,n])=>n*(2*a+(n-1)*d)/2,/마지막|끝항/],
 'arithmetic-recover-d': [([a,n,last])=>(last-a)/(n-1),/간격/],
 'arithmetic-recover-a': [([d,n,sum])=>(2*sum/n-(n-1)*d)/2,/합.*공식/],
 'geometric-nth': [([a,q,n])=>a*q**(n-1),/공비/],
 'geometric-sum': [([a,q,n])=>a*(q**n-1)/(q-1),/합|공비/],
 'derivative-cubic': [([a,b,c,x])=>3*a*x*x+2*b*x+c,/도함수|미분/],
 'derivative-tangent-slope': [([a,b,c,x])=>2*a*x+b,/접선.*미분계수/],
 'derivative-stationary': [([a,b])=>-b/(2*a),/도함수/],
 'derivative-second': [([a,b,c,x])=>6*a*x+2*b,/두 번|이계/],
 'integral-linear': [([lo,hi,a,b])=>(a*(lo+hi)/2+b)*(hi-lo),/원시함수/],
 'probability-single': [([s,t])=>s/t,/전체|동일/],
 'probability-without-replacement': [([s,t])=>s*(s-1)/(t*(t-1)),/조건부|남은/],
 'vector-dot': [([a,b,c,d])=>a*c+b*d,/성분/],
 'composite-derivative-shift': [([a,b,c,x])=>2*a*x+b+c,/도함수/],
 'composite-tangent-intercept': [([a,b,c,x])=>c-a*x*x,/접점|접선/],
 'composite-integral-derivative': [([a,b,lo,hi])=>a*(hi*hi-lo*lo)+b*(hi-lo),/기본정리/],
 'composite-sequence-function': [([a,d,n,c,b])=>c*(a+(n-1)*d)**2+b,/공차|등차/]
};
function system([a,b,c,d,e,f]) { return [(c*e-b*f)/(a*e-b*d),(a*f-c*d)/(a*e-b*d)]; }
function nums(text) { return (text.match(/-?\d+(?:\.\d+)?/g)||[]).map(Number); }
function close(a,b,label) { assert.ok(Math.abs(a-b)<1e-8,`${label}: ${a} != ${b}`); }
// Independently evaluate numeric equalities printed in prose (never use the builder's draw data).
// Only this restricted arithmetic alphabet is accepted; symbolic equations are checked by specs.
function numericEqualities(steps, id) {
 let checked=0;
 const evaluate = raw => {
  if(!/\d/.test(raw)||!/^[\d\s.()+*/^²³−×÷-]+$/.test(raw)) return null;
  const expression=raw.trim().replace(/−/g,'-').replace(/×/g,'*').replace(/÷/g,'/').replace(/\^/g,'**').replace(/²/g,'**2').replace(/³/g,'**3');
  try { const result=Function(`"use strict";return (${expression})`)(); return Number.isFinite(result)?result:null; }
  catch { return null; } // Unbalanced fragments belong to a symbolic expression, not a numeric equality.
 };
 for(const step of steps) {
  const parts=step.split('=');
  for(let i=0;i<parts.length-1;i++) {
   const left=parts[i].match(/(?:^|\s)([\d\s.()+*/^²³−×÷-]+)$/);
   const right=parts[i+1].match(/^\s*([\d\s.()+*/^²³−×÷-]+)/);
   if(!left||!right||/^[A-Za-z_{₀-₉°]/.test(parts[i+1].slice(right[0].length))) continue;
   if(/[A-Za-z₀-₉²³)]$/.test(parts[i].slice(0,left.index).trim())) continue;
   const a=evaluate(left[1]),b=evaluate(right[1]);
   if(a===null||b===null) continue;
   close(a,b,`${id}: numeric equality in ${step}`); checked++;
  }
 }
 return checked;
}
const fractional = new Set(['rational-add','rational-multiply','decimal-fraction','repeating-decimal','probability-single','probability-without-replacement']);

test('numeric intermediate checker rejects a wrong calculation even when a final answer is unchanged', () => {
 assert.equal(numericEqualities(['분자의 곱은 3 × 4 = 12입니다.','정답: 0.75'],'probe'),1);
 assert.throws(()=>numericEqualities(['분자의 곱은 3 × 4 = 13입니다.','정답: 0.75'],'probe'),/12 != 13/);
 assert.equal(numericEqualities(['문자식은 x + (-7) = (3) + (-7) = -4입니다.'],'probe'),1);
});

test('74 templates teach a numeric worked derivation and independently verified displayed answer', () => {
 assert.equal(Object.keys(specs).length,74);
 const seen=new Set();
 for(const random of [seeded(19),seeded(8721),seeded(998),()=>0,()=>0.999999999999]) {
  const g=createGenerator({random});
  for(let level=1;level<=18;level++) for(let i=0;i<120;i++) {
   const p=g.generate(level), id=p.templateId, n=nums(p.text), expected=specs[id][0](n);
   seen.add(id);
   assert.ok(Array.isArray(p.solutionSteps),`${id}: solutionSteps must exist`);
   assert.ok(p.solutionSteps.length>=3,`${id}: at least principle, substitution, conclusion`);
   for(const s of p.solutionSteps) {
    assert.equal(typeof s,'string'); assert.match(s,/[가-힣]/);
    assert.doesNotMatch(s,/undefined|NaN|Infinity|<\/?[a-z][^>]*>/i);
   }
   const body=p.solutionSteps.join('\n');
   const calculations=numericEqualities(p.solutionSteps,id);
   if(!id.startsWith('trig-')) assert.ok(calculations>0,`${id}: independently evaluated numeric intermediate`);
   assert.match(body,specs[id][1],`${id}: mathematical principle`);
   assert.ok(p.solutionSteps.slice(0,-1).some(s=>/\d/.test(s)&&/[=÷×+−]|대입/.test(s)),`${id}: numeric intermediate calculation`);
   // The rendered conclusion, not just answer metadata, must be mathematically correct.
   const conclusion=p.solutionSteps.at(-1);
   assert.match(conclusion,/정답/);
   const shown=nums(conclusion).at(-1);
   close(shown,fractional.has(id)?Math.round(expected*100)/100:expected,`${id}: displayed conclusion`);
   close(p.answer,expected,`${id}: legacy answer`);
   if(p.solutionAnswer!==undefined) close(p.solutionAnswer,expected,`${id}: solution answer`);
   if(fractional.has(id)) {
    assert.match(body,/\d+\/\d+/); assert.match(body,/≈/);
    assert.match(body,/소수.*셋째.*반올림.*둘째/);
    const exact=body.match(/정확한 분수는 (\d+)\/(\d+) = (\d+)\/(\d+)/);
    assert.ok(exact,`${id}: exact fraction and reduction`);
    const [num,den,reducedNum,reducedDen]=exact.slice(1).map(Number);
    close(num/den,expected,`${id}: exact unreduced fraction`);
    close(reducedNum/reducedDen,expected,`${id}: exact reduced fraction`);
    const gcd=(a,b)=>b?gcd(b,a%b):a;
    assert.equal(gcd(reducedNum,reducedDen),1,`${id}: simplest fraction`);
   }
  }
 }
 assert.deepEqual([...seen].sort(),Object.keys(specs).sort());
});

test('random draws and original question fields remain byte-for-byte compatible with original builders', () => {
 // Fixed pre-change fingerprints include all seven legacy fields and cumulative RNG calls.
 // These stay meaningful after a commit and run without Git or access to repository history.
 const hashes = new Map([
  [1,'92e3d4edc0205246f4360628284ae0824ebf65293b678effe4c7ebdafb903563'],
  [29,'43d23d4cb2facca3146aad319a6798f2118112bed5da2a4531f84926c550f543'],
  [873,'54c3fdab65004aa7e8ccba72a1fed376848dda644dd1779a9bc6d7d427519071']
 ]);
 for(const [seed,expected] of hashes) {
  let calls=0; const random=seeded(seed), trace=[];
  const g=createGenerator({random:()=>{calls++; return random();}});
  for(let i=0;i<500;i++) {
   const p=g.generate(i%18+1);
   trace.push([...['text','answer','type','hint','templateId','level','difficulty'].map(k=>p[k]),calls]);
  }
  const hash=require('node:crypto').createHash('sha256').update(JSON.stringify(trace)).digest('hex');
  assert.equal(hash,expected,`legacy fields / RNG trace for seed ${seed}`);
 }
});

test('boundary explanations respect negative bounds, root signs, discriminant and trig axes/quadrants', () => {
 const seen=new Set();
 for(const random of [()=>0,()=>0.999999999999,seeded(801)]) {
  const g=createGenerator({random});
  for(const level of [7,8,9,11,14,17,18]) for(let i=0;i<160;i++) {
   const p=g.generate(level), n=nums(p.text), body=p.solutionSteps.join('\n'); seen.add(p.templateId);
   if(p.templateId==='quadratic-inequality-count') {
    assert.ok(body.includes(`${n[0]} ≤ x ≤ ${n[1]}`));
    assert.ok(body.includes(`${n[1]} − (${n[0]}) + 1 = ${p.answer}`));
   }
   if(p.templateId==='linear-inequality-count') assert.match(body,/미포함|포함하지|제외/);
   if(p.templateId==='quadratic-discriminant') {
    assert.match(body,/D\s*=.*b².*4ac/);
    assert.match(body,p.answer<0?/실근.*없/:p.answer===0?/중근/:/서로 다른.*실근/);
   }
   if(p.templateId==='root-square') assert.ok(body.includes(`|${n[0]}|`));
   if(p.templateId.startsWith('trig-')&&p.templateId!=='trig-triangle') {
    assert.match(body,n[0]%90===0?/축/:/사분면/);
    assert.ok(body.includes(`${n[0]}°`));
   }
   if(p.templateId==='integral-linear'||p.templateId==='composite-integral-derivative') {
    const [lo,hi]=p.templateId==='integral-linear'?n:n.slice(2);
    assert.ok(body.includes(`(${lo})`)); assert.ok(body.includes(`(${hi})`));
    assert.match(body,/위끝.*아래끝|상한.*하한/);
   }
  }
 }
 assert.ok(seen.size>20);
});
