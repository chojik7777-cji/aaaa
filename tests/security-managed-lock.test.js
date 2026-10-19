'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{Readable}=require('node:stream');
function req(page,ip,password){const r=Readable.from([Buffer.from(JSON.stringify({password,page}))]);Object.assign(r,{method:'POST',url:'/api/dashboard-auth',headers:{host:'inn-analytical-split-juice.trycloudflare.com','cf-connecting-ip':ip},socket:{remoteAddress:'127.0.0.1'}});return r;}
async function call(h,r){let text='';const res={setHeader(){},end(v){text=v}};await h(r,res);return {status:res.statusCode,body:JSON.parse(text)};}
const service={login:async(id,p)=>p==='fixture-correct'?'fixture-token':null};
test('all administrator gates enforce fifth-failure IP lock across page switches without blocking another visitor',async()=>{
 const events=[],options={audit:{record:(r,d)=>events.push(d)}};
 // A shared explicit lock keeps isolated factories deterministic once implemented.
 try{options.lock=require('../server/password-lock').createPasswordLock();}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
 const dashboard=require('../server/dashboard-auth').createDashboardAuth(()=>service,options),admin=require('../server/note-admin').createAdminHandler(()=>service,options);
 for(let i=0;i<4;i++)assert.equal((await call(dashboard,req('omok-dashboard.html','203.0.113.1','wrong'))).status,403);
 const fifth=req('detail-admin-jik-2026.html','203.0.113.1','wrong');fifth.url='/api/note-admin?action=login';
 assert.equal((await call(admin,fifth)).status,429,'fifth actual failure across admin gates locks visitor');
 for(const page of ['omok-dashboard.html','baduk-dashboard.html','yut-dashboard.html','math-control.html'])assert.equal((await call(dashboard,req(page,'203.0.113.1','fixture-correct'))).status,429);
 const b=req('detail-admin-jik-2026.html','203.0.113.2','fixture-correct');b.url='/api/note-admin/login';assert.equal((await call(admin,b)).status,200);
 assert.equal(events.filter(e=>e.outcome==='failure').length,5);
});
test('managed math authentication failures enter private history',t=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'audit-math-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const audit=require('../server/security-audit').createSecurityAudit({dir:path.join(dir,'private')});
 for(const page of ['math-control.html','math-level.html'])for(let i=0;i<5;i++)audit.record(req(page,'203.0.113.8','unused'),{page,outcome:'failure'});
 assert.equal(audit.latest().filter(e=>e.alertEligible).length,2);
});
test('switching administrator pages still emits the fifth-failure alert',t=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'audit-admin-scope-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const audit=require('../server/security-audit').createSecurityAudit({dir:path.join(dir,'private')});
 const pages=['omok-dashboard.html','baduk-dashboard.html','yut-dashboard.html','detail-admin-jik-2026.html','omok-dashboard.html'];
 for(const page of pages)audit.record(req(page,'203.0.113.9','unused'),{page,scope:'admin',outcome:'failure'});
 const pending=JSON.parse(fs.readFileSync(path.join(dir,'private','audit.json'),'utf8')).outbox;assert.equal(pending.length,1);assert.equal(pending[0].count,5);assert.equal(pending[0].page,'omok-dashboard.html');
});
