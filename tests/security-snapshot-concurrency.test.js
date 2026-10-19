'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {createSecurityAudit}=require('../server/security-audit');
test('read-only notification snapshot does not contend with authentication writer lock',t=>{
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'security-snapshot-')));fs.chmodSync(dir,0o700);t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const audit=createSecurityAudit({dir});
 for(let i=0;i<5;i++)audit.record({headers:{},socket:{remoteAddress:'127.0.0.1'},url:'/api/note/login'},{page:'note.html',room:'default',outcome:'failure'});
 const lock=path.join(dir,'audit.lock');fs.writeFileSync(lock,'writer lock',{mode:0o600});
 const result=spawnSync(process.execPath,[path.join(__dirname,'../scripts/security-audit-snapshot.js'),dir],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 assert.equal(JSON.parse(result.stdout).length,1);
 assert.equal(fs.readFileSync(lock,'utf8'),'writer lock');
});
