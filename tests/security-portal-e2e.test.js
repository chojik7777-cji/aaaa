'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const root=path.join(__dirname,'..'),tunnel='inn-analytical-split-juice.trycloudflare.com';
test('real isolated portal: fifth dashboard/note failure, admin-only history, restart persistence',async t=>{
 const home=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'portal-security-e2e-')));
 t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
 const password='e2e-fixture-admin-only',notePassword='e2e-fixture-note-only';
 fs.writeFileSync(path.join(home,'admin-password'),password,{mode:0o600});
 const env={...process.env,HOME:home,HOST:'127.0.0.1',PORT:'0',NOTE_DIR:path.join(home,'note'),NOTE2_DIR:path.join(home,'note2'),NOTE_AUTH_FILE:path.join(home,'private','auth.json'),NOTE_ADMIN_PASSWORD_FILE:path.join(home,'admin-password'),NOTE_PASSWORD:notePassword,NOTE2_PASSWORD:notePassword};
 delete env.VERCEL;
 let child;
 async function start(){
  child=spawn(process.execPath,['portal-server.js'],{cwd:root,env,stdio:['ignore','pipe','pipe']});
  let output='';
  const url=await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(new Error('isolated portal startup timeout')),12000);
   child.stdout.on('data',chunk=>{output+=chunk;const m=output.match(/Game portal server: (http:\/\/127\.0\.0\.1:\d+)/);if(m){clearTimeout(timeout);resolve(m[1]);}});
   child.once('exit',code=>{clearTimeout(timeout);reject(new Error('isolated portal exited '+code));});
  });return url;
 }
 async function stop(){if(child.exitCode!==null||child.signalCode!==null)return;await new Promise(resolve=>{child.once('exit',resolve);child.kill('SIGTERM');});}
 t.after(async()=>{if(child&&child.exitCode===null)await stop();});
 let base=await start();
 const headers={Host:tunnel,'CF-Connecting-IP':'203.0.113.71','Content-Type':'application/json','User-Agent':'security-e2e-browser'};
 async function post(url,body,visitor='203.0.113.71'){return new Promise((resolve,reject)=>{const request=require('node:http').request(base+url,{method:'POST',headers:{...headers,'CF-Connecting-IP':visitor}},response=>{const chunks=[];response.on('data',c=>chunks.push(c));response.on('end',()=>resolve({status:response.statusCode,json:async()=>JSON.parse(Buffer.concat(chunks).toString())}));});request.on('error',reject);request.end(JSON.stringify(body));});}
 const login=await post('/api/note-admin?action=login',{password});assert.equal(login.status,200);
 const token=(await login.json()).token;
 const events=async()=>{const r=await fetch(base+'/api/security-audit',{headers:{...headers,Authorization:'Bearer '+token}});assert.equal(r.status,200);return (await r.json()).records;};
 assert.equal((await fetch(base+'/api/security-audit')).status,401);
 assert.deepEqual(await events(),[]);
 for(let i=1;i<=5;i++){
  const r=await post('/api/dashboard-auth',{password:'e2e-wrong-never-log-this',page:'/omok-dashboard.html'});assert.equal(r.status,403);
  const list=await events();assert.equal(list.filter(e=>e.outcome==='failure').length,i<5?0:1);
 }
 let list=await events();assert.equal(list[0].page,'omok-dashboard.html');assert.equal(list[0].ip,'203.0.113.71');assert.equal(list[0].count,5);assert.equal(list[0].alertEligible,true);
 for(const id of ['note','note2']){
  for(let i=1;i<=5;i++){
   const r=await post('/api/'+id+'/login?room=default',{password:'e2e-wrong-never-log-this'});assert.equal(r.status,i<5?401:429);
  }
  assert.equal((await post('/api/'+id+'/login?room=default',{password:notePassword})).status,429,'locked visitor A stays locked');
  assert.equal((await post('/api/'+id+'/login?room=default',{password:notePassword},'203.0.113.72')).status,200,'visitor B through same proxy can login');
  assert.ok((await events()).some(e=>e.page===id+'.html'&&e.ip==='203.0.113.71'&&e.count===5&&e.alertEligible));
 }
 list=await events();assert.ok(list.some(e=>e.page==='note.html'&&e.count===5&&e.alertEligible));
 await post('/api/note/login?room=default',{password:'e2e-wrong-never-log-this'});
 assert.ok((await events()).some(e=>e.page==='note.html'&&e.outcome==='rate_limit'));
 assert.equal((await fetch(base+'/server/security-audit.js')).status,403);
 const audit=path.join(home,'.config','aaaa','security','audit.json');assert.ok(!fs.readFileSync(audit,'utf8').includes('e2e-wrong-never-log-this'));
 const {chromium}=require('/tmp/note-modal-browser/node_modules/playwright');
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/detail-admin-jik-2026.html');
  await page.locator('#note-admin-login input').fill(password);await page.locator('#note-admin-login button').click();
  await page.locator('#note-admin-panel').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('#security-audit-status').textContent.includes('건입니다.')||document.querySelector('#security-audit-status').textContent.includes('없습니다.'));
  assert.ok(await page.locator('#security-audit-list .security-event').count()>0,'actual API records must appear in admin UI');
  assert.deepEqual(errors,[]);await page.locator('#note-admin-logout').click();assert.equal(await page.locator('#security-audit-list').textContent(),'');
 }finally{await browser.close();}
 const saved=await events();await stop();base=await start();assert.deepEqual(await events(),saved);
 await stop();
});
