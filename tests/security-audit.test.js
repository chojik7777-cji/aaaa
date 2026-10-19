'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const auditModule=()=>require('../server/security-audit');
function fixture(t){const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'audit-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
test('IP attribution only accepts validated CF IP for loopback and exact trusted host; dashboard targets stay local',()=>{
 const {requestInfo,dashboardPage}=auditModule();const tunnel='inn-analytical-split-juice.trycloudflare.com';
 const make=(peer,host,cf)=>({socket:{remoteAddress:peer},headers:{host,'cf-connecting-ip':cf,'x-forwarded-for':'6.6.6.6'},url:'/api/login?password=SECRET'});
 assert.equal(requestInfo(make('127.0.0.1',tunnel,'203.0.113.4')).ip,'203.0.113.4');
 for(const r of [make('192.0.2.1',tunnel,'203.0.113.4'),make('127.0.0.1',tunnel+'.evil','203.0.113.4'),make('127.0.0.1',tunnel,'bad'),make('127.0.0.1','localhost','203.0.113.4')])assert.equal(requestInfo(r).ip,r.socket.remoteAddress);
 const r=make('::1',tunnel,'2001:db8::1');r.headers.referer='https://'+tunnel+'/omok-dashboard.html?secret=SECRET';assert.equal(dashboardPage(r,{}),'omok-dashboard.html');
 r.headers.referer='https://evil.test/omok-dashboard.html';assert.equal(dashboardPage(r,{page:'https://evil.test/yut-dashboard.html'}),'dashboard');
 assert.equal(dashboardPage(r,{page:'yut-dashboard.html'}),'yut-dashboard.html');
});
test('bounded durable state, rate-limit distinction, retention and unsafe paths',async t=>{
 const dir=fixture(t);let time=Date.UTC(2026,0,1);const a=auditModule().createSecurityAudit({dir,now:()=>time,maxEvents:3,maxKeys:2,maxTimes:5});
 for(let i=0;i<12;i++)await a.record({socket:{remoteAddress:'127.0.0.1'},headers:{'user-agent':'x'.repeat(500)},url:'/api/x?secret=SECRET'},{page:'note.html',room:'default',outcome:'failure'});
 await a.record(req,{page:'note.html',room:'default',outcome:'rate_limit'});
 assert.equal((await a.latest()).length,3);assert.equal((await a.latest())[0].outcome,'rate_limit');assert.equal((await a.latest())[0].alertEligible,false);
 await a.record(req,{page:'note.html',room:'a',outcome:'failure'});
 assert.throws(()=>a.record(req,{page:'note.html',room:'b',outcome:'failure'}),/capacity/);
 const state=JSON.parse(fs.readFileSync(path.join(dir,'audit.json')));assert.ok(Object.keys(state.counters).length<=2);assert.ok(Object.values(state.counters).every(c=>c.times.length<=5));
 time+=31*86400000;assert.equal((await a.latest()).length,0);
 const link=path.join(dir,'link');fs.symlinkSync(dir,link);assert.throws(()=>auditModule().createSecurityAudit({dir:link}).latest());
 const unsafe=path.join(dir,'unsafe');fs.mkdirSync(unsafe,{mode:0o700});fs.symlinkSync(path.join(dir,'audit.json'),path.join(unsafe,'audit.json'));assert.throws(()=>auditModule().createSecurityAudit({dir:unsafe}).latest());
});
test('default per-key samples capped at 100 and interleaved instances retain fifth; audit errors do not change auth',async t=>{
 const dir=fixture(t),{createSecurityAudit,recordAuth}=auditModule(),a=createSecurityAudit({dir}),b=createSecurityAudit({dir});
 for(let i=0;i<101;i++)(i%2?a:b).record(req,{page:'note.html',outcome:'failure'});
 assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'audit.json'))).counters[JSON.stringify(['127.0.0.1','note.html',null])].times.length,100);
 assert.equal(a.latest(100).filter(e=>e.alertEligible).length,1);
 const original=console.error,errors=[];console.error=x=>errors.push(x);try{assert.doesNotThrow(()=>recordAuth(req,{password:'SECRET'},{record(){throw new Error('SECRET');}}));}finally{console.error=original;}
 assert.equal(errors.length,1);assert.ok(!errors[0].includes('SECRET'));
});
const req={url:'/api/note/login?token=SECRET',headers:{host:'localhost','user-agent':'browser'},socket:{remoteAddress:'127.0.0.1'}};
test('fifth actual failure is durable and alert eligible; success resets scoped sliding window',async t=>{
 const dir=fixture(t);let time=Date.UTC(2026,0,1);const make=()=>auditModule().createSecurityAudit({dir,now:()=>time});let a=make();
 const attempt=(outcome,room='church')=>a.record(req,{page:'note.html',room,outcome,password:'SECRET'});
 for(let i=0;i<4;i++)await attempt('failure');assert.equal((await a.latest()).length,0);
 a=make();await attempt('failure');let events=await a.latest();assert.equal(events[0].count,5);assert.equal(events[0].alertEligible,true);assert.equal(events[0].time,'2026-01-01T00:00:00.000Z');assert.match(events[0].timeKst,/09:00:00/);
 await attempt('failure');assert.equal((await a.latest())[0].alertEligible,false);
 await attempt('success');for(let i=0;i<4;i++)await attempt('failure');assert.equal((await a.latest()).length,2);
 await attempt('failure','other');assert.equal((await a.latest()).length,2);
 time+=15*60*1000+1;await attempt('failure');assert.equal((await a.latest()).length,2);
 assert.ok(!fs.readFileSync(path.join(dir,'audit.json'),'utf8').includes('SECRET'));
 assert.equal(fs.statSync(dir).mode&0o777,0o700);assert.equal(fs.statSync(path.join(dir,'audit.json')).mode&0o777,0o600);
});
