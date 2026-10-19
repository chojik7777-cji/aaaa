'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {createSecurityAudit}=require('../server/security-audit');
test('rate-limit log flood cannot evict an unsent fifth-failure alert',t=>{
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'audit-outbox-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const a=createSecurityAudit({dir,maxEvents:3}),req={url:'/api/note/login',headers:{},socket:{remoteAddress:'127.0.0.1'}};
 for(let i=0;i<5;i++)a.record(req,{page:'note.html',room:'default',outcome:'failure'});
 for(let i=0;i<12;i++)a.record(req,{page:'note.html',room:'default',outcome:'rate_limit'});
 assert.equal(a.latest().length,3);
 const r=spawnSync(process.execPath,[path.join(__dirname,'../scripts/security-audit-snapshot.js'),dir],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);const alerts=JSON.parse(r.stdout);assert.equal(alerts.length,1);assert.equal(alerts[0].count,5);
});
