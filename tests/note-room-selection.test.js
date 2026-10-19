'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
let chromium;try{({chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'));}catch{}
const browserTest=chromium?test:test.skip;
async function fixture(t){
 const root=path.join(__dirname,'..'),rooms=['default',...Array.from({length:8},(_,i)=>'room-'+i)],calls=[];let failure=0;
 const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost');res.setHeader('Cache-Control','no-store');
  if(u.pathname==='/note-password-admin.js'){res.setHeader('Content-Type','application/javascript');return res.end(fs.readFileSync(path.join(root,'note-password-admin.js')))}
  if(u.pathname==='/api/security-audit'){res.setHeader('Content-Type','application/json');return res.end('{"records":[]}')}
  if(u.pathname==='/api/note-admin'){
   const action=u.searchParams.get('action');calls.push({action,method:req.method});res.setHeader('Content-Type','application/json');
   if(action==='login')return res.end('{"token":"fixture-token"}');
   if(action!=='status'){res.statusCode=500;return res.end('{"error":"unexpected mutation"}')}
   if(failure){res.statusCode=failure;return res.end(JSON.stringify({error:failure===401?'관리자 인증이 만료되었습니다.':'시험용 조회 오류입니다.'}))}
   const room=u.searchParams.get('room')||'default';return res.end(JSON.stringify({notes:['note','note2'].map(id=>({id,room,revision:'fixture-'+id+'-'+room,updated_at:'2026-01-01T00:00:00Z'})),rooms,noteRooms:rooms}));
  }
  res.setHeader('Content-Type','text/html');res.end(fs.readFileSync(path.join(root,'detail-admin-jik-2026.html')));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const browser=await chromium.launch({headless:true});t.after(()=>browser.close());const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.setDefaultTimeout(3000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/detail-admin-jik-2026.html');await page.locator('#note-admin-login input').fill('fixture-only');await page.locator('#note-admin-login button').click();await page.locator('#note-admin-panel').waitFor({state:'visible'});
 return {page,calls,errors,setFailure:status=>{failure=status}};
}
browserTest('A/B room buttons visibly open the selected password form without changing any password',async t=>{
 const f=await fixture(t),{page}=f;
 for(const [list,id]of [['#note-a-room-list','note'],['#note2-room-list','note2']]){
  await page.locator('#note-password-form input[name=password]').fill('unsaved-draft');
  const card=page.locator(list+' .room-card').filter({has:page.locator('strong',{hasText:/^room-0$/})});
  await card.getByRole('button',{name:'이 방 선택 / 비밀번호 변경',exact:true}).click();
  await page.waitForFunction(()=>document.activeElement===document.querySelector('#note-password-form input[name=password]'),{},{timeout:1500});
  await page.waitForFunction(()=>{const r=document.querySelector('#note-password-form input[name=password]').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight},{},{timeout:1500});
  assert.equal(await page.locator('#note-password-form select').inputValue(),id);assert.equal(await page.locator('#note-password-form input[name=room]').inputValue(),'room-0');
  assert.equal(await page.locator('#note-password-form input[name=password]').inputValue(),'');
  await page.waitForFunction(()=>document.getElementById('note-password-selection-status')?.textContent.includes('새 비밀번호 저장'),{},{timeout:1500});
  assert.ok((await page.locator('#note-password-selection').textContent()).includes('room-0'));
  assert.ok(!(await page.locator('#note-admin-message').textContent()).includes('처리 중'));
 }
 assert.ok(f.calls.every(c=>c.action==='login'||c.action==='status'));assert.deepEqual(f.errors,[]);
});
browserTest('default-room shortcut uses the same visible selection flow',async t=>{
 const {page}=await fixture(t);await page.locator('#note-a-select-password').click();
 await page.waitForFunction(()=>document.getElementById('note-password-selection-status')?.textContent.includes('새 비밀번호 저장'),{},{timeout:1500});
 assert.equal(await page.locator('#note-password-form input[name=room]').inputValue(),'default');
 assert.ok((await page.locator('#note-password-selection').textContent()).includes('노트 A'));
});
browserTest('logout removes stale selected-room feedback before the next administrator login',async t=>{
 const {page}=await fixture(t);await page.locator('#note2-room-list .room-card').filter({has:page.locator('strong',{hasText:/^room-0$/})}).getByRole('button',{name:'이 방 선택 / 비밀번호 변경',exact:true}).click();
 await page.waitForFunction(()=>document.getElementById('note-password-selection-status')?.textContent.includes('새 비밀번호 저장'),{},{timeout:1500});
 await page.locator('#note-admin-logout').click();
 assert.ok(!(await page.locator('#note-password-selection').textContent()).includes('room-0'));
 assert.ok(!(await page.locator('#note-password-selection-status').textContent()).includes('선택했습니다'));
});
for(const status of [401,503])browserTest('failed room lookup '+status+' never claims successful selection or mutates credentials',async t=>{
 const f=await fixture(t);f.setFailure(status);
 await f.page.locator('#note2-room-list .room-card').first().getByRole('button',{name:'이 방 선택 / 비밀번호 변경',exact:true}).click();
 await f.page.waitForFunction(()=>!document.getElementById('note-admin-message').textContent.includes('처리 중'),{},{timeout:1500});
 assert.ok(!(await f.page.locator('#note-admin-message').textContent()).includes('선택했습니다'));
 if(status===401)assert.equal(await f.page.locator('#note-admin-panel').isHidden(),true);
 else assert.ok((await f.page.locator('#note-password-selection-status').textContent()).includes('조회 오류'));
 assert.ok(f.calls.every(c=>c.action==='login'||c.action==='status'));assert.deepEqual(f.errors,[]);
});
