'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('island return buttons explicitly identify the game menu',()=>{const s=fs.readFileSync(path.join(__dirname,'../math-island.html'),'utf8');assert.match(s,/<button[^>]*id="backBtn"[^>]*>← 메뉴로 돌아가기<\/button>/);assert.match(s,/<button[^>]*id="homeBtn"[^>]*>🏝️ 메뉴로 돌아가기<\/button>/);});
