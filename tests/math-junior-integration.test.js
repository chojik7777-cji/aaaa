'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('existing math setup visibly links the junior track without replacing levels',()=>{
 const old=fs.readFileSync(path.join(__dirname,'../math-level.html'),'utf8');
 assert.match(old,/<a[^>]+href="math-junior\.html"[^>]*>[^<]*유아·초등 수학/);
 assert.match(old,/중1~고3의 대표 학습 영역/);
 assert.equal((old.match(/<option value="\d+"/g)||[]).length,18);
});
