'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),{spawn}=require('node:child_process');
test('real local portal covers math settings and both student gates with private alerts and visitor locks',async t=>{
 const home=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'portal-math-safety-'))),root=path.join(__dirname,'..');t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
 const admin='fixture-admin-only',student='fixture-student-only',limit='fixture-limit-only';fs.writeFileSync(path.join(home,'admin'),admin,{mode:0o600});
 const env={...process.env,HOME:home,HOST:'127.0.0.1',PORT:'0',NOTE_DIR:path.join(home,'note'),NOTE2_DIR:path.join(home,'note2'),NOTE_AUTH_FILE:path.join(home,'private','auth.json'),NOTE_ADMIN_PASSWORD_FILE:path.join(home,'admin'),NOTE_PASSWORD:'fixture-note-only',NOTE2_PASSWORD:'fixture-note-only',MATH_UNLOCK_PASSWORD:student,MATH_LIMIT_PASSWORD:limit};delete env.VERCEL;
 const child=spawn(process.execPath,['portal-server.js'],{cwd:root,env,stdio:['ignore','pipe','pipe']});
 t.after(async()=>{if(child.exitCode===null&&child.signalCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill('SIGTERM')})});
 const base=await new Promise((resolve,reject)=>{let out='';const timeout=setTimeout(()=>reject(new Error('isolated portal readiness timeout')),15000);child.stdout.on('data',c=>{out+=c;const m=out.match(/Game portal server: (http:\/\/127\.0\.0\.1:\d+)/);if(m){clearTimeout(timeout);resolve(m[1])}});child.once('exit',()=>{clearTimeout(timeout);reject(new Error('isolated portal startup failed'))})});
 function request(url,body,ip='203.0.113.10',token){return new Promise((resolve,reject)=>{const headers={Host:'inn-analytical-split-juice.trycloudflare.com','CF-Connecting-IP':ip,'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;const r=http.request(base+url,{method:body?'POST':'GET',headers},res=>{let s='';res.on('data',c=>s+=c);res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(s)}))});r.on('error',reject);r.end(body?JSON.stringify(body):undefined)})}
 const login=await request('/api/note-admin/login',{password:admin},'203.0.113.99');assert.equal(login.status,200);const token=login.data.token;
 assert.equal((await request('/api/math-control?action=status')).status,200);
 for(let i=0;i<5;i++)assert.equal((await request('/api/math-control/set',{adminPassword:'wrong'})).status,i===4?429:403);
 assert.equal((await request('/api/note-admin/login',{password:admin})).status,429,'math administrator lock must carry across administrator endpoints');
 assert.equal((await request('/api/math-control?action=set',{adminPassword:admin,locked:true,questionLimit:8},'203.0.113.20')).status,200);
 for(const [action,password]of [['unlock',student],['limit-unlock',limit]]){
  for(let i=0;i<5;i++)assert.equal((await request('/api/math-control?action='+action,{password:'wrong'})).status,i===4?429:403);
  assert.equal((await request('/api/math-control/'+action,{password})).status,429);
  assert.equal((await request('/api/math-control?action='+action,{password},'203.0.113.20')).status,200);
 }
 const history=await request('/api/security-audit',undefined,'203.0.113.99',token);assert.equal(history.status,200);
 for(const [page,room]of [['math-control.html',null],['math-level.html','control-unlock'],['math-level.html','question-limit']])assert.ok(history.data.records.some(e=>e.page===page&&e.room===room&&e.ip==='203.0.113.10'&&e.alertEligible&&e.count===5));
 const raw=fs.readFileSync(path.join(home,'.config','aaaa','math-control.json'),'utf8');assert.equal(raw.includes(student)||raw.includes(limit),false);
 assert.equal((await request('/api/math-control?action=status')).data.questionLimit,8);
});
