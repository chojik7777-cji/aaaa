'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('temporary note authentication server has its own HOME so audit events never enter operator alerts',()=>{
 const source=fs.readFileSync(path.join(__dirname,'note-local-integration.test.js'),'utf8');
 assert.match(source,/const env=\{[^\n]*HOME:dir[,}]/,'test child HOME must be the disposable fixture directory, not the real operator HOME');
});
