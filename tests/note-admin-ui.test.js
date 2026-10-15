'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
test('Korean admin page offers separate authentication, new password and confirmation without revealing passwords',()=>{
 const html=fs.readFileSync(path.join(root,'detail-admin-jik-2026.html'),'utf8');
 assert.match(html,/id="note-admin-login"/);
 assert.match(html,/id="note-password-form"/);
 assert.match(html,/name="confirmation"[^>]*type="password"/);
 assert.match(html,/현재 비밀번호는 표시하지 않습니다/);
 assert.match(html,/Mac mini 로컬 전용/);
 assert.match(html,/Vercel에는 동기화되지 않습니다/);
 assert.doesNotMatch(html,/Mac mini와 Vercel에 함께 적용/);
 assert.match(html,/<script src="note-password-admin.js" defer><\/script>/);
});
