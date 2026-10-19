'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {initialize,createFileStore,createService}=require('../server/note-local');
const {createAdminHandler}=require('../server/note-admin');
async function fixture(t){
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'note-reset-'))),root=path.join(dir,'rooms');
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));fs.mkdirSync(path.join(root,'alpha'),{recursive:true});
 const env={NOTE_AUTH_FILE:path.join(dir,'private','auth.json'),NOTE_ADMIN_PASSWORD_FILE:path.join(dir,'admin'),NOTE_PASSWORD:'fixture-note',NOTE2_PASSWORD:'fixture-template'};
 fs.writeFileSync(env.NOTE_ADMIN_PASSWORD_FILE,'fixture-admin');await initialize(env);
 const service=createService(createFileStore(env),Date.now,{roomRoot:root}),token=await service.login('admin','fixture-admin'),handler=createAdminHandler(()=>service,{roomRoot:root,noteDir:path.join(dir,'note')});
 async function call(body={id:'note2',room:'alpha'},auth=token,method='POST',query=''){
  const res={setHeader(){},end(v){this.data=JSON.parse(v);}};
  await handler({url:'/api/note-admin?action=reset-content'+query,method,headers:{authorization:auth?'Bearer '+auth:''},body},res);return res;
 }
 return {dir,root,env,service,token,handler,call};
}
test('reset removes body and every attachment, resets metadata, preserves room, credentials and grants',async t=>{
 const {root,env,service,call}=await fixture(t),room=path.join(root,'alpha');
 await service.createRoom(await service.login('admin','fixture-admin'),'beta','beta-password','beta-password',root);
 const grant=await service.login('note2','fixture-template','alpha'),auth=fs.readFileSync(env.NOTE_AUTH_FILE);
 for(const [name,value]of Object.entries({'.note-memo.txt':'body','.note-meta.json':JSON.stringify({version:12,uploads:{'file.txt':'user'},updatedAt:123,updatedBy:'user'}),'file.txt':'uploaded','finder.bin':'manual','.note-password':'legacy-secret'}))fs.writeFileSync(path.join(room,name),value);
 fs.mkdirSync(path.join(room,'nested'));fs.writeFileSync(path.join(room,'nested','attachment'),'data');
 const result=await call();assert.equal(result.statusCode,200);assert.equal(result.data.version,0);
 assert.equal(fs.existsSync(room),true);assert.equal(fs.existsSync(path.join(room,'.note-memo.txt')),false);
 assert.deepEqual(fs.readdirSync(room).sort(),['.note-meta.json','.note-password']);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(room,'.note-meta.json'))),{version:0,updatedAt:0,updatedBy:'',uploads:{}});
 assert.deepEqual(fs.readFileSync(env.NOTE_AUTH_FILE),auth);assert.equal(fs.readFileSync(path.join(room,'.note-password'),'utf8'),'legacy-secret');assert.ok(await service.tokenOk('note2',grant,'alpha'));
 assert.equal((await call({id:'note2',room:'beta'})).statusCode,200);assert.ok(await service.login('note2','beta-password','beta'));
});
test('reset rejects unauthorized, invalid, missing and non-note2 requests without mutation',async t=>{
 const {root,call}=await fixture(t),memo=path.join(root,'alpha','.note-memo.txt');fs.writeFileSync(memo,'keep');
 for(const auth of ['', 'invalid'])assert.equal((await call({id:'note2',room:'alpha'},auth)).statusCode,401);
 assert.equal((await call({id:'note',room:'alpha'})).statusCode,404);
 assert.equal((await call({id:'note2',room:'missing'})).statusCode,404);
 for(const room of ['../alpha','ALPHA','__proto__',''])assert.equal((await call({id:'note2',room})).statusCode,400);
 assert.equal((await call({id:'note2',room:'alpha'},undefined,'POST','&room=beta')).statusCode,400);
 assert.equal((await call(undefined,undefined,'GET')).statusCode,405);
 assert.equal(fs.readFileSync(memo,'utf8'),'keep');
 const guarded=createAdminHandler(()=>({tokenOk:async()=>false}),{roomRoot:'/nonexistent/no-access'}),res={setHeader(){},end(){}};
 await guarded({method:'POST',url:'/api/note-admin?action=reset-content',headers:{authorization:'Bearer invalid'},body:{room:'../bad',id:'note2'}},res);assert.equal(res.statusCode,401);
});
test('isolated portal routes reset and serializes it with saves while retaining note2 login',async t=>{
 const {dir,root,env}=await fixture(t),{spawn}=require('node:child_process');
 const child=spawn(process.execPath,['portal-server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,...env,VERCEL:'',HOST:'127.0.0.1',PORT:'0',NOTE_DIR:path.join(dir,'note'),NOTE2_DIR:root},stdio:['ignore','pipe','pipe']});
 t.after(()=>new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);child.kill('SIGTERM');}));
 const base=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(new Error('fixture portal did not become ready')),10000);child.once('exit',()=>{clearTimeout(timer);reject(new Error('fixture portal exited'));});child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/Game portal server: (http:\/\/127\.0\.0\.1:\d+)/);if(match){clearTimeout(timer);resolve(match[1]);}});});
 async function api(route,body,headers={}){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
 assert.equal((await fetch(base+'/detail-admin-jik-2026.html')).status,200);
 const admin=(await api('/api/note-admin?action=login',{password:'fixture-admin'})).data.token;
 const grant=(await api('/api/note2/login?room=alpha',{password:'fixture-template'})).data.token,headers={'x-note-token':grant},adminHeaders={Authorization:'Bearer '+admin};
 assert.ok(grant);await api('/api/note2/save?room=alpha',{text:'seed'},headers);await api('/api/note2/upload?room=alpha',{name:'upload.txt',dataUrl:'data:text/plain;base64,Zml4dHVyZQ=='},headers);
 const reset=()=>api('/api/note-admin/reset-content',{id:'note2',room:'alpha'},adminHeaders);
 assert.equal((await reset()).status,200);const state=await api('/api/note2/state?room=alpha',undefined,headers);
 assert.equal(state.status,200);assert.equal(state.data.version,0);assert.equal(state.data.text,'');assert.deepEqual(state.data.files,[]);
 const results=await Promise.all([reset(),api('/api/note2/save?room=alpha',{text:'concurrent'},headers)]);assert.ok(results.every(r=>r.status===200));
 const final=(await api('/api/note2/state?room=alpha',undefined,headers)).data;assert.ok((final.version===0&&final.text==='')||(final.version===1&&final.text==='concurrent'));
 const script=await (await fetch(base+'/note-password-admin.js')).text();assert.match(script,/내용·파일 초기화/);
});
let chromium;try{({chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'));}catch{}
test('isolated Chromium: room reset confirmation, cancel, success refresh and 401 logout',{skip:!chromium},async t=>{
 const {root,handler}=await fixture(t),http=require('node:http'),repo=path.join(__dirname,'..'),room=path.join(root,'alpha');
 fs.writeFileSync(path.join(room,'.note-memo.txt'),'browser-body');fs.writeFileSync(path.join(room,'attachment.txt'),'browser-file');
 let denied=false,resets=0,statuses=0;
 const html=fs.readFileSync(path.join(repo,'detail-admin-jik-2026.html'),'utf8').match(/<section class="note-admin"[\s\S]*?<\/section>(?=\s*<script src="note-password-admin)/)[0];
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://fixture');
  if(url.pathname==='/api/note-admin'){
   if(url.searchParams.get('action')==='status')statuses++;
   if(url.searchParams.get('action')==='reset-content'){resets++;if(denied){res.writeHead(401,{'Content-Type':'application/json'}).end(JSON.stringify({error:'다시 로그인해 주세요.'}));return;}}
   return handler(req,res);
  }
  res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/html');
  res.end(url.pathname.endsWith('.js')?fs.readFileSync(path.join(repo,'note-password-admin.js')):'<!doctype html><meta charset="utf-8">'+html+'<script src="/note-password-admin.js"></script>');
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const browser=await chromium.launch({headless:true});t.after(()=>browser.close());const page=await browser.newPage();
 await page.goto('http://127.0.0.1:'+server.address().port+'/detail-admin-jik-2026.html');
 await page.locator('#note-admin-login input').fill('fixture-admin');await page.getByRole('button',{name:'관리자 로그인',exact:true}).click();
 await page.locator('#note-admin-panel').waitFor({state:'visible'});
 const reset=page.locator('#note2-room-list .room-card').filter({has:page.locator('strong',{hasText:/^alpha$/})}).getByRole('button',{name:'내용·파일 초기화',exact:true});assert.equal(await reset.count(),1);
 page.once('dialog',async dialog=>{assert.match(dialog.message(),/alpha/);assert.match(dialog.message(),/본문/);assert.match(dialog.message(),/첨부파일/);assert.match(dialog.message(),/백업은 유지/);await dialog.dismiss();});
 await reset.click();assert.equal(resets,0);assert.equal(fs.readFileSync(path.join(room,'.note-memo.txt'),'utf8'),'browser-body');
 const previous=statuses;page.once('dialog',d=>d.accept());await reset.click();
 await page.waitForFunction(()=>document.getElementById('note-admin-message').textContent.includes('초기화되었습니다'));
 assert.equal(resets,1);assert.ok(statuses>previous);assert.equal(fs.existsSync(path.join(room,'attachment.txt')),false);assert.equal(JSON.parse(fs.readFileSync(path.join(room,'.note-meta.json'))).version,0);
 denied=true;page.once('dialog',d=>d.accept());await reset.click();await page.locator('#note-admin-login').waitFor({state:'visible'});assert.equal(await page.locator('#note-admin-panel').isVisible(),false);
});
test('unsafe metadata links reject before deletion; attachment links never affect targets',async t=>{
 const {dir,root,call}=await fixture(t),room=path.join(root,'alpha'),outside=path.join(dir,'outside');fs.mkdirSync(outside);fs.writeFileSync(path.join(outside,'keep'),'keep');fs.writeFileSync(path.join(room,'file.txt'),'keep');
 for(const name of ['.note-meta.json','.note-memo.txt']){
  fs.symlinkSync(path.join(outside,'keep'),path.join(room,name));assert.equal((await call()).statusCode,400);
  assert.equal(fs.readFileSync(path.join(room,'file.txt'),'utf8'),'keep');fs.unlinkSync(path.join(room,name));
 }
 fs.symlinkSync(outside,path.join(room,'linked-directory'));fs.symlinkSync(path.join(outside,'keep'),path.join(room,'linked.txt'));
 assert.equal((await call()).statusCode,200);assert.equal(fs.readFileSync(path.join(outside,'keep'),'utf8'),'keep');
 fs.symlinkSync(outside,path.join(root,'escape'));assert.equal((await call({id:'note2',room:'escape'})).statusCode,400);
});
