'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {requestInfo}=require('../server/security-audit');
const req=(ua,headers={})=>({headers:{'user-agent':ua,...headers},socket:{remoteAddress:'127.0.0.1'},url:'/api/test?token=never-log'});
test('bounded deterministic browser and OS metadata handles competing and iOS UA tokens',()=>{
 const cases=[
  ['Mozilla Windows NT 10.0 Chrome/120 Safari/537 Edg/120','Edge','Windows'],
  ['Mozilla Windows Chrome/120 OPR/90','Opera','Windows'],
  ['Mozilla Android Chrome/120 SamsungBrowser/24','Samsung Internet','Android'],
  ['Mozilla Linux Android Chrome/120','Chrome','Android'],
  ['Mozilla Macintosh Mac OS X Version/17 Safari/605','Safari','macOS'],
  ['Mozilla Linux Firefox/120','Firefox','Linux'],
  ['Mozilla iPhone like Mac OS X CriOS/120 Safari/605','Chrome','iOS'],
  ['Mozilla iPad like Mac OS X FxiOS/120','Firefox','iOS'],
  ['Mozilla iPhone EdgiOS/120','Edge','iOS'],
  ['Mozilla iPhone OPiOS/120','Opera','iOS'],
  ['node','node','unknown'],['arbitrary secret <script>','unknown','unknown'],
  [null,'unknown','unknown']
 ];
 for(const [ua,browser,os]of cases){const info=requestInfo(req(ua));assert.equal(info.browser,browser,ua);assert.equal(info.os,os,ua);assert.equal(info.deviceId,null);}
 const info=requestInfo(req('x'.repeat(3000)+' Chrome/120'));assert.equal(info.browser,'unknown');assert.ok(info.userAgent.length<=256);assert.equal(info.endpoint,'/api/test');
});

const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),{spawn}=require('node:child_process');
test('isolated real portal assigns first-failure ID, logs fifth metadata, and never lets device IDs reset IP locks',async t=>{
 const home=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'aaaa-device-test-'))),root=path.join(__dirname,'..');
 t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
 fs.writeFileSync(path.join(home,'admin'),'fixture-device-admin',{mode:0o600});
 const env={...process.env,HOME:home,HOST:'127.0.0.1',PORT:'0',NOTE_DIR:path.join(home,'note'),NOTE2_DIR:path.join(home,'note2'),NOTE_AUTH_FILE:path.join(home,'private','auth.json'),NOTE_ADMIN_PASSWORD_FILE:path.join(home,'admin'),NOTE_PASSWORD:'fixture-note',NOTE2_PASSWORD:'fixture-note',MATH_UNLOCK_PASSWORD:'fixture-student',MATH_LIMIT_PASSWORD:'fixture-limit'};delete env.VERCEL;
 const child=spawn(process.execPath,['portal-server.js'],{cwd:root,env,stdio:['ignore','pipe','pipe']});let stderr='';child.stderr.on('data',c=>stderr+=c);
 t.after(async()=>{if(child.exitCode===null&&child.signalCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill('SIGTERM');});});
 const base=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(new Error('isolated portal readiness timeout')),15000);child.stdout.on('data',c=>{out+=c;const match=out.match(/Game portal server: (http:\/\/127\.0\.0\.1:\d+)/);if(match){clearTimeout(timer);resolve(match[1]);}});child.once('exit',()=>{clearTimeout(timer);reject(new Error('isolated portal exited'));});});
 const ua='Mozilla Windows NT 10.0 Chrome/120 Safari/537 Edg/120';
 function request(url,body,cookie){return new Promise((resolve,reject)=>{const headers={'User-Agent':ua,'Content-Type':'application/json','X-Forwarded-For':'203.0.113.99','CF-Connecting-IP':'203.0.113.98'};if(cookie)headers.Cookie=cookie;const r=http.request(base+url,{method:body?'POST':'GET',headers},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text}));});r.on('error',reject);r.end(body?JSON.stringify(body):undefined);});}
 let first=await request('/api/dashboard-auth',{password:'fixture-wrong-secret',page:'omok-dashboard.html'});
 assert.equal(first.status,403);assert.ok(first.headers['set-cookie'],'first failure must issue cookie');
 const cookie=first.headers['set-cookie'][0].split(';')[0],id=cookie.split('=')[1];assert.match(id,uuidRE);
 assert.equal((await request('/api/health',null,cookie)).headers['set-cookie'],undefined);
 for(let i=2;i<=5;i++)assert.equal((await request('/api/dashboard-auth',{password:'fixture-wrong-secret',page:'omok-dashboard.html'},cookie)).status,i===5?429:403);
 const auditFile=path.join(home,'.config','aaaa','security','audit.json');let data=JSON.parse(fs.readFileSync(auditFile));const event=data.events.find(e=>e.alertEligible);
 assert.equal(event.deviceId,id);assert.equal(event.browser,'Edge');assert.equal(event.os,'Windows');assert.equal(event.ip,'127.0.0.1');assert.equal(event.ipSource,'socket');assert.equal(event.count,5);
 const other='aaaa-audit-device-v1=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 assert.equal((await request('/api/dashboard-auth',{password:'fixture-device-admin',page:'omok-dashboard.html'},other)).status,429);
 assert.equal((await request('/api/security-audit',null,other)).status,401,'device cookie grants no authorization');
 const malformed=await request('/api/dashboard-auth',{password:'fixture-wrong-secret',page:'omok-dashboard.html'},'auth=fixture-auth-secret; aaaa-audit-device-v1=<script>');assert.equal(malformed.status,429);
 data=JSON.parse(fs.readFileSync(auditFile));assert.match(data.events.at(-1).deviceId,uuidRE);
 const raw=fs.readFileSync(auditFile,'utf8');for(const secret of ['<script>','fixture-auth-secret','fixture-wrong-secret'])assert.equal(raw.includes(secret)||stderr.includes(secret),false);
 const {chromium}=require(process.env.PLAYWRIGHT_PATH||'/tmp/note-modal-browser/node_modules/playwright');const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext(),page=await context.newPage();await page.goto(base+'/note.html');
  const cookies=await context.cookies(),stored=cookies.find(c=>c.name==='aaaa-audit-device-v1');assert.ok(stored);assert.equal(stored.httpOnly,true);assert.equal(stored.sameSite,'Lax');
  assert.equal(await page.evaluate(()=>document.cookie.includes('aaaa-audit-device-v1')),false);
  await page.evaluate(async()=>{await fetch('/api/dashboard-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'fixture-browser-wrong',page:'omok-dashboard.html'})});});
  const latest=JSON.parse(fs.readFileSync(auditFile)).events.at(-1);assert.equal(latest.deviceId,stored.value,'same-origin HTML fetch automatically includes audit cookie');assert.equal(latest.browser,'Chrome');
  const separate=await browser.newContext();await separate.newPage().then(p=>p.goto(base+'/index.html'));assert.notEqual((await separate.cookies()).find(c=>c.name==='aaaa-audit-device-v1').value,stored.value);
  await context.clearCookies();await page.reload();assert.notEqual((await context.cookies()).find(c=>c.name==='aaaa-audit-device-v1').value,stored.value);
 }finally{await browser.close();}
});
const device=require('../server/audit-device');
const cookieName='aaaa-audit-device-v1',uuid='12345678-1234-4234-8234-123456789abc';
const uuidRE=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
test('device cookie accepts only one canonical UUIDv4 and never reflects invalid cookie material',()=>{
 assert.equal(requestInfo(req('',{cookie:cookieName+'='+uuid})).deviceId,uuid);
 for(const cookie of [cookieName+'=<script>',cookieName+'='+uuid.toUpperCase(),cookieName+'='+uuid+'; '+cookieName+'='+uuid,cookieName+'=%31'+uuid.slice(1),'x='.repeat(5000),[cookieName+'='+uuid],cookieName+'='+uuid+'=extra']){
  assert.equal(device.cookieDeviceId(cookie),null);
 }
 assert.equal(device.cookieDeviceId('auth=secret; '+cookieName+'='+uuid),uuid);
});
test('middleware issues private advisory UUID cookie once and preserves existing Set-Cookie values',()=>{
 for(const existing of [undefined,'auth=secret',['auth=secret','other=value']]){
  const r=req('');let header=existing;const res={getHeader:()=>header,setHeader:(key,value)=>{assert.equal(key,'Set-Cookie');header=value;}};
  device.auditDevice(r,res);const id=requestInfo(r).deviceId;assert.match(id,uuidRE);
  const cookies=Array.isArray(header)?header:[header],issued=cookies.at(-1);
  assert.equal(issued,cookieName+'='+id+'; Max-Age=31536000; Path=/; HttpOnly; SameSite=Lax');
  assert.deepEqual(cookies.slice(0,-1),existing===undefined?[]:Array.isArray(existing)?existing:[existing]);
  device.auditDevice(r,res);assert.equal((Array.isArray(header)?header:[header]).length,cookies.length);
  const next=req('',{cookie:cookieName+'='+id});device.auditDevice(next,{setHeader:()=>assert.fail('must not reissue')});assert.equal(requestInfo(next).deviceId,id);
 }
});
test('Secure cookie depends only on HTTPS or existing trusted-local tunnel assumption',()=>{
 for(const [headers,encrypted,secure]of [[{},false,false],[{'x-forwarded-proto':'https'},false,false],[{},true,true],[{host:'inn-analytical-split-juice.trycloudflare.com','cf-connecting-ip':'203.0.113.4'},false,true],[{host:'inn-analytical-split-juice.trycloudflare.com'},false,false]]){
  const r=req('',headers);r.socket.encrypted=encrypted;let value;device.auditDevice(r,{setHeader:(_,v)=>value=v});assert.equal(value.at(-1).endsWith('; Secure'),secure);
 }
 const r=req('',{cookie:cookieName+'=malicious'});device.auditDevice(r,{headersSent:true,setHeader:()=>assert.fail()});assert.match(requestInfo(r).deviceId,uuidRE);
 const r2=req('');device.auditDevice(r2,{setHeader:()=>{throw new Error('closed headers')}});assert.match(requestInfo(r2).deviceId,uuidRE);
});
