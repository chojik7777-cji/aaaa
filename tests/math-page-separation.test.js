'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
test('math playground and math game have independent identities and menu entries',()=>{
 const junior=read('math-junior.html'),senior=read('math-level.html');
 assert.match(junior,/<title>수학놀이터<\/title>/);
 assert.match(senior,/<title>수학게임<\/title>/);
 assert.match(junior,/<h1>🌱 수학놀이터<\/h1>/);
 assert.match(senior,/<h1>🧠 수학게임<\/h1>/);
 assert.doesNotMatch(junior,/href="math-level\.html"/);
 assert.doesNotMatch(senior,/href="math-junior\.html"/);
 for(const name of ['intro.html','detail-admin-jik-2026.html']){
  const html=read(name);
  assert.match(html,/<a href="math-junior\.html">수학놀이터 · 유아·초등<\/a>/);
  assert.match(html,/<a href="math-level\.html">수학게임 · 중등·고등<\/a>/);
 }
});
