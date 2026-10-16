'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
for(const name of ['note.html','note2.html'])test(name+' name example is neutral 홍길동',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..',name),'utf8');
 const input=html.match(/<input\b[^>]*\bid="userName"[^>]*>/)?.[0];
 assert.ok(input);assert.ok(input.includes('placeholder="예: 홍길동"'),'내 이름 예시는 예: 홍길동이어야 합니다.');assert.ok(!input.includes('정익'));
});
