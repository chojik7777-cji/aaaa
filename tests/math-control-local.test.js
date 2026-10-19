'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createMathControl}=require('../server/math-control');
function fixture(t,options={}){
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'math-local-')));fs.chmodSync(dir,0o700);
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const events=[],calls=[];let time=1000000;
 const getService=()=>({async login(...args){calls.push(args);return args[1]==='administrator-test'?'grant':null;}});
 const config={dir,getService,audit:{record(_req,event){events.push(event);}},now:()=>time,env:{MATH_UNLOCK_PASSWORD:'student-test',MATH_LIMIT_PASSWORD:'limit-test'},...options};
 return {dir,events,calls,config,handler:createMathControl(config),advance(ms){time+=ms;}};
}
async function call(handler,action='status',body={},ip='192.0.2.10',method=action==='status'?'GET':'POST',extra={}){
 const req={method,url:'/api/math-control?action='+action,headers:{host:'localhost'},socket:{remoteAddress:ip},body,...extra};
 const res={statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v;},end(value){this.body=value;}};
 await handler(req,res);return {status:res.statusCode,data:JSON.parse(res.body||'{}'),headers:res.headers};
}
test('admin settings authenticate existing service and persist only scrypt verifiers',async t=>{
 const f=fixture(t);
 const denied=await call(f.handler,'set',{adminPassword:'wrong',locked:true});assert.equal(denied.status,403);
 const body={adminPassword:'administrator-test',locked:true,message:'New notice',questionLimit:9,unlockPassword:'new-student',limitPassword:'new-limit'};
 const r=await call(f.handler,'set',body);assert.equal(r.status,200);assert.equal(r.data.locked,true);assert.equal(r.data.questionLimit,9);assert.equal(r.data.message,'New notice');assert.equal(r.data.version,1);
 assert.deepEqual(f.calls.at(-1),['admin','administrator-test','default','192.0.2.10']);
 const file=path.join(f.dir,'math-control.json'),raw=fs.readFileSync(file,'utf8');
 for(const secret of Object.values(f.config.env).concat([body.adminPassword,body.unlockPassword,body.limitPassword]))assert.equal(raw.includes(secret),false);
 const saved=JSON.parse(raw);assert.equal(saved.unlockVerifier.algorithm,'scrypt');assert.equal(saved.limitVerifier.algorithm,'scrypt');
 assert.equal(fs.statSync(file).mode&0o777,0o600);
 const restarted=createMathControl(f.config);assert.deepEqual((await call(restarted)).data,r.data);
 assert.deepEqual(f.events.map(e=>e.outcome),['failure','success']);assert.equal(f.events[0].page,'math-control.html');
});
test('student gates verify separately, audit distinct rooms, and never change game state',async t=>{
 const f=fixture(t),initial=(await call(f.handler)).data;
 for(const [action,password,field,room]of [['unlock','student-test','unlocked','control-unlock'],['limit-unlock','limit-test','limitUnlocked','question-limit']]){
  assert.equal((await call(f.handler,action,{password:'wrong'})).status,403);
  const r=await call(f.handler,action,{password});assert.equal(r.status,200);assert.equal(r.data[field],true);
  assert.deepEqual(f.events.at(-1),{page:'math-level.html',room,outcome:'success'});
 }
 assert.deepEqual((await call(f.handler)).data,initial);assert.equal(f.calls.length,0);
});
test('every password gate locks visitor IP after fifth failure for one hour with accurate audit outcomes',async t=>{
 const f=fixture(t);
 const gates=[['set',{adminPassword:'administrator-test',locked:true},{adminPassword:'wrong'}],['unlock',{password:'student-test'},{password:'wrong'}],['limit-unlock',{password:'limit-test'},{password:'wrong'}]];
 for(const [action,good,bad]of gates){
  for(let n=1;n<=5;n++){const r=await call(f.handler,action,bad);assert.equal(r.status,n===5?429:403,`${action} attempt ${n}`);assert.equal(f.events.at(-1).outcome,'failure');}
  assert.equal((await call(f.handler,action,good)).status,429);assert.equal(f.events.at(-1).outcome,'rate_limit');
  assert.equal((await call(f.handler,action,good,'192.0.2.11')).status,200);
 }
 f.advance(60*60*1000);
 for(const [action,good]of gates)assert.equal((await call(f.handler,action,good)).status,200);
});
test('invalid requests never consume password budgets and bounded JSON streams support path aliases',async t=>{
 const f=fixture(t);
 for(const body of [null,[],{}, {password:42},{password:'x'.repeat(257)}])assert.equal((await call(f.handler,'unlock',body)).status,400);
 assert.equal((await call(f.handler,'set',{adminPassword:'wrong',unlockPassword:42})).status,400);
 assert.equal((await call(f.handler,'set',{adminPassword:'wrong',questionLimit:'bad'})).status,400);
 assert.equal((await call(f.handler,'unlock',{password:'wrong'},undefined,'GET')).status,405);
 assert.equal((await call(f.handler,'nonsense',{password:'wrong'})).status,404);
 assert.equal(f.events.length,0);assert.equal(f.calls.length,0);
 const {Readable}=require('node:stream');
 const streamed=Readable.from([JSON.stringify({password:'student-test'})]);
 const r=await call(f.handler,'unlock',undefined,undefined,'POST',{body:undefined,url:'/api/math-control/unlock',[Symbol.asyncIterator]:streamed[Symbol.asyncIterator].bind(streamed)});
 assert.equal(r.status,200);assert.equal(r.data.unlocked,true);
 const bad=Readable.from(['{']);assert.equal((await call(f.handler,'unlock',undefined,undefined,'POST',{body:undefined,[Symbol.asyncIterator]:bad[Symbol.asyncIterator].bind(bad)})).status,400);
 const huge=Readable.from(['x'.repeat(16385)]);assert.equal((await call(f.handler,'unlock',undefined,undefined,'POST',{body:undefined,[Symbol.asyncIterator]:huge[Symbol.asyncIterator].bind(huge)})).status,413);
 assert.equal(f.events.length,1);
});
test('private storage fails closed on unsafe modes, links, corruption and repository paths without counting failures',async t=>{
 const f=fixture(t);await call(f.handler);const file=path.join(f.dir,'math-control.json'),original=fs.readFileSync(file);
 fs.chmodSync(f.dir,0o755);assert.equal((await call(f.handler,'unlock',{password:'wrong'})).status,503);fs.chmodSync(f.dir,0o700);
 fs.chmodSync(file,0o644);assert.equal((await call(f.handler)).status,503);fs.chmodSync(file,0o600);
 fs.unlinkSync(file);const target=path.join(f.dir,'target');fs.writeFileSync(target,original,{mode:0o600});fs.symlinkSync(target,file);assert.equal((await call(f.handler)).status,503);fs.unlinkSync(file);
 fs.writeFileSync(file,JSON.stringify({...JSON.parse(original),unlockPassword:'must-not-accept'}),{mode:0o600});assert.equal((await call(f.handler)).status,503);
 fs.writeFileSync(file,'{broken');assert.equal((await call(f.handler)).status,503);
 fs.writeFileSync(file,original);const linked=path.join(f.dir,'alias');fs.symlinkSync(f.dir,linked);assert.equal((await call(createMathControl({...f.config,dir:linked}))).status,503);
 const repo=path.resolve(__dirname,'..');assert.equal((await call(createMathControl({...f.config,dir:repo}))).status,503);
 assert.equal(f.events.length,0);
});
test('simultaneous handler instances preserve version increments and respect an exclusive storage lock',async t=>{
 const f=fixture(t);await call(f.handler);const second=createMathControl(f.config);
 const results=await Promise.all([call(f.handler,'set',{adminPassword:'administrator-test',locked:true}),call(second,'set',{adminPassword:'administrator-test',locked:false})]);
 assert.deepEqual(results.map(r=>r.status),[200,200]);assert.equal((await call(f.handler)).data.version,2);
 const file=path.join(f.dir,'math-control.json.lock');fs.writeFileSync(file,'',{mode:0o600});
 const before=f.events.length;assert.equal((await call(f.handler,'unlock',{password:'wrong'})).status,503);assert.equal(f.events.length,before);fs.unlinkSync(file);
});
test('visitor IP comes from trusted CF proxy only, not spoofed forwarding headers',async t=>{
 const f=fixture(t),headers=ip=>({host:'inn-analytical-split-juice.trycloudflare.com','cf-connecting-ip':ip,'x-forwarded-for':'203.0.113.99'});
 for(let i=0;i<5;i++)await call(f.handler,'unlock',{password:'wrong'},'127.0.0.1','POST',{headers:headers('198.51.100.1')});
 assert.equal((await call(f.handler,'unlock',{password:'student-test'},'127.0.0.1','POST',{headers:headers('198.51.100.1')})).status,429);
 assert.equal((await call(f.handler,'unlock',{password:'student-test'},'127.0.0.1','POST',{headers:headers('198.51.100.2')})).status,200);
 for(let i=0;i<5;i++)await call(f.handler,'set',{adminPassword:'wrong'},'192.0.2.50','POST',{headers:headers(`198.51.100.${i+1}`)});
 assert.equal((await call(f.handler,'set',{adminPassword:'administrator-test'},'192.0.2.50','POST',{headers:headers('198.51.100.80')})).status,429);
});
test('successful verification resets failures and storage/service faults do not consume attempts',async t=>{
 const f=fixture(t);let unavailable=false;
 const service=f.config.getService();f.handler=createMathControl({...f.config,getService:()=>{if(unavailable)throw {status:503};return service;}});
 for(let n=0;n<4;n++)assert.equal((await call(f.handler,'set',{adminPassword:'wrong'})).status,403);
 assert.equal((await call(f.handler,'set',{adminPassword:'administrator-test'})).status,200);
 unavailable=true;const events=f.events.length;
 for(let n=0;n<6;n++)assert.equal((await call(f.handler,'set',{adminPassword:'wrong'})).status,503);
 assert.equal(f.events.length,events);unavailable=false;
 for(let n=0;n<4;n++)assert.equal((await call(f.handler,'set',{adminPassword:'wrong'})).status,403);
 assert.equal((await call(f.handler,'set',{adminPassword:'wrong'})).status,429);
});
test('real note service authenticates admin without legacy fallback; game defaults survive initialization',async t=>{
 const {createService,hashPassword}=require('../server/note-local'),crypto=require('node:crypto');
 const row={id:'admin',revision:'test-revision',token_key:crypto.randomBytes(32).toString('hex'),verifier:await hashPassword('administrator-test')};
 const service=createService({get:async()=>row,consumeAdminAttempt:async()=>true});
 const f=fixture(t,{getService:()=>service,env:{}});
 assert.equal((await call(f.handler,'set',{adminPassword:'administrator-test',locked:true})).status,200);
 // Read legacy source constants, not runtime credentials or the legacy global handler.
 const legacy=fs.readFileSync(path.join(__dirname,'../api/math-control.js'),'utf8');
 for(const [action,name]of [['unlock','unlockPassword'],['limit-unlock','limitPassword']]){
  const password=legacy.match(new RegExp(name+": '([^']+)'"))[1];
  assert.equal((await call(f.handler,action,{password})).status,200);
 }
 const before=(await call(f.handler)).data;
 const settings=await call(f.handler,'set',{adminPassword:'administrator-test',locked:true,unlockPassword:'',limitPassword:'',message:' '.repeat(10),questionLimit:1001});
 assert.equal(settings.data.questionLimit,999);assert.equal(settings.data.message,'비번을 입력하세요');assert.equal(settings.data.version,before.version+1);
});
test('verifier rate limits are recorded separately and never reported as storage faults',async t=>{
 const f=fixture(t,{getService:()=>({login:async()=>{throw {status:429}}})});
 const r=await call(f.handler,'set',{adminPassword:'fixture-any'});
 assert.equal(r.status,429);assert.match(r.data.error,/15분/);assert.equal(f.events.at(-1).outcome,'rate_limit');
});
test('public status preserves game contract without exposing credentials',async t=>{
 const f=fixture(t),r=await call(f.handler);
 assert.equal(r.status,200);assert.deepEqual(r.data,{ok:true,locked:false,message:'비번을 입력하세요',questionLimit:5,version:0,updatedAt:1000000});
 assert.equal(r.headers['Cache-Control'],'no-store');assert.equal(f.calls.length,0);
 assert.equal(/password|verifier|salt|hash/i.test(JSON.stringify(r.data)),false);
});
