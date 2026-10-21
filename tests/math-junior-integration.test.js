'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('middle/high math stays independent without replacing established levels',()=>{
 const old=fs.readFileSync(path.join(__dirname,'../math-level.html'),'utf8');
 assert.doesNotMatch(old,/href="math-junior\.html"/);
 assert.match(old,/중1~고3의 대표 학습 영역/);
 assert.equal((old.match(/<option value="\d+"/g)||[]).length,18);
});
