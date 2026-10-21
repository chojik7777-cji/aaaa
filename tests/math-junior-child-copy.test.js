'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('playground bottom description uses short child-friendly copy without technical terms',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../math-junior.html'),'utf8');
 assert(html.includes("description:'저장하기를 누르면 공부한 기록을 간직해요. 불러오기를 누르면 저장한 기록을 다시 꺼내요.'"));
 assert(html.includes("transfer.panel.querySelector('h2').textContent='내 공부 기록'"));
 const description=html.match(/description:'([^']*)'/)[1];
 assert.doesNotMatch(description,/JSON|비밀번호|잠금|횟수|브라우저|데이터|복원/);
});
