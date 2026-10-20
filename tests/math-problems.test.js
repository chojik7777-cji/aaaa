'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const modulePath = path.join(__dirname, '..', 'math-problems.js');

test('CommonJS exposes isolated generator factory and default generation', () => {
    assert.ok(fs.existsSync(modulePath), 'math-problems.js must exist');
    const api = require(modulePath);
    assert.equal(typeof api.createGenerator, 'function');
    assert.equal(typeof api.generate, 'function');
    const p = api.generate(1);
    assert.deepEqual(Object.keys(p).sort(), ['answer', 'difficulty', 'hint', 'level', 'templateId', 'text', 'type']);
    assert.equal(p.level, 1);
    assert.equal(p.difficulty, 1);
    assert.ok(Number.isFinite(p.answer));
});

function seeded(seed) {
    return () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };
}
// Numbers are read from the actual question, never from generator internals.
function numbers(p) { return (p.text.match(/-?\d+(?:\.\d+)?/g) || []).map(Number); }
function close(actual, expected, message) {
    assert.ok(Number.isFinite(expected));
    assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: got ${actual}, expected ${expected}`);
}
const levelIds = new Map();
const oracles = {
    'integer-add': ([a,b]) => a+b,
    'integer-subtract': ([a,b]) => a-b,
    'integer-multiply': ([a,b]) => a*b,
    'integer-divide': ([a,b]) => a/b,
    'expression-linear': ([x,a,b]) => a*x+b,
    'expression-square': ([x,a,b]) => a*x*x+b,
    'expression-distribute': ([x,a,b]) => a*(x+b),
    'expression-two-variables': ([x,y,a,b]) => a*x+b*y,
    'equation-linear': ([a,b,c]) => (c-b)/a,
    'equation-both-sides': ([a,b,c,d]) => (d-b)/(a-c),
    'equation-brackets': ([a,b,c]) => c/a-b,
    'equation-fraction': ([a,b,c]) => a*(c-b)
};
checkLevel(1, ['integer-add','integer-subtract','integer-multiply','integer-divide']);
checkLevel(2, ['expression-linear','expression-square','expression-distribute','expression-two-variables']);
checkLevel(3, ['equation-linear','equation-both-sides','equation-brackets','equation-fraction']);
Object.assign(oracles, {
    'rational-add': ([a,b,c,d]) => a/b+c/d,
    'rational-multiply': ([a,b,c,d]) => (a*c)/(b*d),
    'decimal-fraction': ([a]) => a/100,
    'repeating-decimal': ([a]) => a/9,
    'system-x': n => solveSystem(n)[0],
    'system-y': n => solveSystem(n)[1],
    'system-sum': n => solveSystem(n).reduce((a,b) => a+b),
    'system-difference': n => { const [x,y]=solveSystem(n); return x-y; },
    'linear-value': ([a,b,x]) => a*x+b,
    'linear-slope': ([x,y,u,v]) => (v-y)/(u-x),
    'linear-intercept': ([a,x,y]) => y-a*x,
    'linear-inverse': ([a,b,y]) => (y-b)/a
});
function solveSystem([a,b,c,d,e,f]) {
    const determinant=a*e-b*d;
    assert.notEqual(determinant, 0, 'system must have a unique solution');
    return [(c*e-b*f)/determinant, (a*f-c*d)/determinant];
}
checkLevel(4, ['rational-add','rational-multiply','decimal-fraction','repeating-decimal']);
checkLevel(5, ['system-x','system-y','system-sum','system-difference']);
checkLevel(6, ['linear-value','linear-slope','linear-intercept','linear-inverse']);
Object.assign(oracles, {
    'root-principal': ([a]) => Math.sqrt(a),
    'root-square': ([a]) => Math.abs(a),
    'root-product': ([a,b]) => Math.sqrt(a*b),
    'root-sum': ([a,b]) => Math.sqrt(a)+Math.sqrt(b),
    'quadratic-root-sum': ([b,c]) => -b,
    'quadratic-root-product': ([b,c]) => c,
    'quadratic-larger-root': ([b,c]) => (-b+Math.sqrt(b*b-4*c))/2,
    'factor-evaluate': ([a,b,x]) => (x-a)*(x-b),
    'parabola-value': ([a,b,x]) => a*x*x+b,
    'parabola-axis': ([a,h,k]) => h,
    'parabola-extreme': ([a,h,k]) => k,
    'parabola-intercept': ([a,h,k]) => a*h*h+k
});
checkLevel(7, ['root-principal','root-square','root-product','root-sum']);
checkLevel(8, ['quadratic-root-sum','quadratic-root-product','quadratic-larger-root','factor-evaluate']);
checkLevel(9, ['parabola-value','parabola-axis','parabola-extreme','parabola-intercept']);
Object.assign(oracles, {
    'remainder-quadratic': ([a,b,c,k]) => a*k*k+b*k+c,
    'remainder-cubic': ([a,b,k]) => a*k*k*k+b,
    'polynomial-product': ([a,b,c,d]) => a*d+b*c,
    'remainder-recover-constant': ([a,b,k,value]) => value-a*k*k-b*k,
    'root-distance': ([b,c]) => Math.sqrt(b*b-4*c),
    'linear-inequality-count': ([a,b,c]) => { let count=0; for(let x=1;x<=100;x++) if(a*x+b<c) count++; return count; },
    'quadratic-discriminant': ([a,b,c]) => b*b-4*a*c,
    'quadratic-inequality-count': ([a,b]) => { let count=0; for(let x=-50;x<=50;x++) if((x-a)*(x-b)<=0) count++; return count; },
    'permutation': ([n,k]) => factorial(n)/factorial(n-k),
    'combination': ([n,k]) => factorial(n)/(factorial(k)*factorial(n-k)),
    'function-compose': ([a,b,c,d,x]) => a*(c*x+d)+b,
    'function-inverse': ([a,b,y]) => (y-b)/a
});
function factorial(n) { let answer=1; for(let i=2;i<=n;i++) answer*=i; return answer; }
checkLevel(10, ['remainder-quadratic','remainder-cubic','polynomial-product','remainder-recover-constant']);
checkLevel(11, ['root-distance','linear-inequality-count','quadratic-discriminant','quadratic-inequality-count']);
checkLevel(12, ['permutation','combination','function-compose','function-inverse']);
Object.assign(oracles, {
    'exponent-product': ([a,m,b,n]) => { assert.equal(a,b); return a**m*b**n; },
    'exponent-quotient': ([a,m,b,n]) => a**m/b**n,
    'logarithm-value': ([a,b]) => Math.log(b)/Math.log(a),
    'exponential-equation': ([a,b]) => Math.log(b)/Math.log(a),
    'trig-sine': ([a]) => Math.sin(a*Math.PI/180),
    'trig-cosine': ([a]) => Math.cos(a*Math.PI/180),
    'trig-tangent': ([a]) => Math.tan(a*Math.PI/180),
    'trig-triangle': ([length,angle]) => length*Math.sin(angle*Math.PI/180),
    'arithmetic-nth': ([a,d,n]) => { for(let i=1;i<n;i++) a+=d; return a; },
    'arithmetic-sum': ([a,d,n]) => { let sum=0; for(let i=0;i<n;i++) sum+=a+i*d; return sum; },
    'arithmetic-recover-d': ([a,n,last]) => (last-a)/(n-1),
    'arithmetic-recover-a': ([d,n,sum]) => { let offsets=0; for(let i=0;i<n;i++) offsets+=i*d; return (sum-offsets)/n; },
    'geometric-nth': ([a,r,n]) => { for(let i=1;i<n;i++) a*=r; return a; },
    'geometric-sum': ([a,r,n]) => { let sum=0; for(let i=0;i<n;i++) { sum+=a; a*=r; } return sum; }
});
checkLevel(13, ['exponent-product','exponent-quotient','logarithm-value','exponential-equation']);
checkLevel(14, ['trig-sine','trig-cosine','trig-tangent','trig-triangle']);
checkLevel(15, ['arithmetic-nth','arithmetic-sum','arithmetic-recover-d','arithmetic-recover-a','geometric-nth','geometric-sum']);
Object.assign(oracles, {
    'derivative-cubic': ([a,b,c,x]) => { const f=t=>a*t**3+b*t*t+c*t; return (f(x+1)-f(x-1))/2-a; },
    'derivative-tangent-slope': ([a,b,c,x]) => { const f=t=>a*t*t+b*t+c; return (f(x+1)-f(x-1))/2; },
    'derivative-stationary': ([a,b,c]) => -b/(2*a),
    'derivative-second': ([a,b,c,x]) => { const f=t=>a*t**3+b*t*t+c*t; return f(x+1)-2*f(x)+f(x-1); },
    'integral-linear': ([lo,hi,a,b]) => ((a*lo+b)+(a*hi+b))*(hi-lo)/2,
    'probability-single': ([success,total]) => success/total,
    'probability-without-replacement': ([success,total]) => (success*(success-1))/(total*(total-1)),
    'vector-dot': ([a,b,c,d]) => a*c+b*d,
    'composite-derivative-shift': ([a,b,c,x]) => { const f=t=>a*t*t+b*t; return (f(x+1)-f(x-1))/2+c; },
    'composite-tangent-intercept': ([a,b,c,x]) => { const f=t=>a*t*t+b*t+c; return f(x)-x*(f(x+1)-f(x-1))/2; },
    'composite-integral-derivative': ([a,b,lo,hi]) => { const f=t=>a*t*t+b*t; return f(hi)-f(lo); },
    'composite-sequence-function': ([a,d,n,c,b]) => { let term=a; for(let i=1;i<n;i++) term+=d; return c*term*term+b; }
});
checkLevel(16, ['derivative-cubic','derivative-tangent-slope','derivative-stationary','derivative-second']);
checkLevel(17, ['integral-linear','probability-single','probability-without-replacement','vector-dot']);
checkLevel(18, ['composite-derivative-shift','composite-tangent-intercept','composite-integral-derivative','composite-sequence-function']);
function checkLevel(level, expectedIds) {
    levelIds.set(level, expectedIds);
    test(`level ${level}: every template has independently verified Korean question and answer`, () => {
        const { createGenerator } = require(modulePath);
        const seen = new Set();
        for (const random of [seeded(level), () => 0, () => 0.999999999999]) {
            const g = createGenerator({ random });
            for (let i = 0; i < expectedIds.length * 20; i++) {
                const p = g.generate(level);
                assert.equal(p.level, level);
                assert.equal(p.difficulty, level);
                assert.ok(expectedIds.includes(p.templateId), p.templateId);
                seen.add(p.templateId);
                assert.match(p.text, /[가-힣]/);
                assert.match(p.hint, /[가-힣]/);
                assert.ok(p.type.length > 0);
                assert.doesNotMatch(p.text + p.hint, /undefined|NaN|Infinity/);
                close(p.answer, oracles[p.templateId](numbers(p), p.text), `${p.templateId}: ${p.text}`);
            }
        }
        assert.deepEqual([...seen].sort(), expectedIds.slice().sort());
    });
}

test('shuffled bags cover each template exactly once per cycle, including interleaved levels', () => {
    const { createGenerator } = require(modulePath);
    for (const random of [() => 0, () => 0.999999999999, seeded(47), seeded(281)]) {
        const g = createGenerator({ random });
        const last = new Map();
        for (let cycle=0; cycle<50; cycle++) {
            const batches = new Map([...levelIds].map(([level]) => [level, []]));
            for (let i=0; i<6; i++) for (const [level, ids] of levelIds) {
                if (i>=ids.length) continue;
                const p=g.generate(level);
                assert.notEqual(p.templateId, last.get(level), `immediate repeat at level ${level}`);
                last.set(level, p.templateId);
                batches.get(level).push(p.templateId);
                close(p.answer, oracles[p.templateId](numbers(p), p.text), p.text);
            }
            for (const [level, batch] of batches) assert.deepEqual(batch.sort(), levelIds.get(level).slice().sort());
        }
    }
});

test('same seed reproduces full questions; instances and default generator do not share bags', () => {
    const api=require(modulePath);
    const a=api.createGenerator({random:seeded(923)}), b=api.createGenerator({random:seeded(923)});
    for(let i=0;i<300;i++) {
        const level=i%18+1;
        const first=a.generate(level);
        api.generate(level);
        assert.deepEqual(first,b.generate(level));
    }
    const c=api.createGenerator({random:()=>0}), d=api.createGenerator({random:()=>0});
    c.generate(15); c.generate(15); c.reset();
    assert.deepEqual(c.generate(15),d.generate(15));
});

test('browser script publishes window.MathProblems without CommonJS or DOM APIs', () => {
    const context={}; context.window=context;
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(modulePath,'utf8'),context);
    const api=context.window.MathProblems;
    assert.equal(typeof api.createGenerator,'function');
    assert.equal(typeof api.reset,'function');
    for(let level=1;level<=18;level++) {
        const p=api.generate(level);
        assert.equal(p.level,level);
        close(p.answer,oracles[p.templateId](numbers(p),p.text),p.text);
    }
});

test('finite numeric levels round and clamp to the supported curriculum', () => {
    const {createGenerator}=require(modulePath);
    const g=createGenerator({random:()=>0});
    for(const [input,expected] of [[-20,1],[0,1],[1.49,1],[1.5,2],[18.7,18],[900,18],['15',15]]) {
        assert.equal(g.generate(input).level,expected);
    }
});

test('invalid levels are rejected instead of returning malformed or NaN questions', () => {
    const g=require(modulePath).createGenerator();
    for(const input of [undefined,null,NaN,Infinity,-Infinity,'bad','',{},[]]) {
        assert.throws(()=>g.generate(input), {name:'RangeError'});
    }
});

test('injected RNG must be callable and produce finite values in [0, 1)', () => {
    const {createGenerator}=require(modulePath);
    for(const random of [null,0,7,'rng',{}]) assert.throws(()=>createGenerator({random}), {name:'TypeError'});
    for(const value of [NaN,Infinity,-Infinity,-0.1,1,1.1,'0.5',undefined]) {
        assert.throws(()=>createGenerator({random:()=>value}).generate(15), {name:'RangeError'});
    }
});
