'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
test('game backup helper is served and built without opening private source paths',t=>{
 const {publicPath}=require('../server/static-policy');assert.equal(publicPath('/game-transfer.js'),true);
 for(const p of ['/server/note-local.js','/server/security-audit.js','/package.json','/game-transfer.js/../server/note-local.js'])assert.equal(publicPath(p),false);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'game-transfer-build-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));require('../scripts/build-static').build(dir);
 assert.deepEqual(fs.readFileSync(path.join(dir,'game-transfer.js')),fs.readFileSync(path.join(__dirname,'../game-transfer.js')));
 assert.equal(fs.existsSync(path.join(dir,'server')),false);
});
