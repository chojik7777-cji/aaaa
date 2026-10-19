'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
let chromium;try{({chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'));}catch{}
const browserTest=chromium?test:test.skip;
async function fixture(t){
 const root=path.join(__dirname,'..'),rooms={note:['default','alpha','beta'],note2:['default','alpha','beta']},calls=[];let failDelete=false;
 const server=http.createServer(async(req,res)=>{const url=new URL(req.url,'http://localhost');res.setHeader('Cache-Control','no-store');
  if(url.pathname==='/note-password-admin.js'){res.setHeader('Content-Type','application/javascript');return res.end(fs.readFileSync(path.join(root,'note-password-admin.js')))}
  if(url.pathname==='/api/security-audit'){res.setHeader('Content-Type','application/json');return res.end('{"records":[]}')}
  if(url.pathname==='/api/note-admin'){
   let raw='';for await(const c of req)raw+=c;const body=raw?JSON.parse(raw):null,action=url.searchParams.get('action'),room=url.searchParams.get('room')||'default';calls.push({action,body,room,id:url.searchParams.get('id')});res.setHeader('Content-Type','application/json');
   if(action==='login')return res.end('{"token":"fixture-token"}');
   if(action==='delete-room'){if(failDelete){res.statusCode=409;return res.end('{"error":"다른 변경이 있습니다. 다시 조회해 주세요."}')}rooms[body.id]=rooms[body.id].filter(r=>r!==room);return res.end(JSON.stringify({ok:true,id:body.id,room}))}
   if(action==='status')return res.end(JSON.stringify({rooms:rooms.note2,noteRooms:rooms.note,notes:['note','note2'].map(id=>({id,room,revision:'fixture-'+id+'-'+room,updatedAt:new Date().toISOString()}))}));
   res.statusCode=500;return res.end('{"error":"unexpected mutation"}');
  }
  res.setHeader('Content-Type','text/html');res.end(fs.readFileSync(path.join(root,'detail-admin-jik-2026.html')));
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const browser=await chromium.launch();t.after(()=>browser.close());const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(3000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/detail-admin-jik-2026.html');await page.locator('#note-admin-login input').fill('fixture');await page.locator('#note-admin-login button').click();await page.locator('#note-admin-panel').waitFor({state:'visible'});
 const card=(id,room)=>page.locator((id==='note'?'#note-a-room-list':'#note2-room-list')+' .room-card').filter({has:page.locator('strong',{hasText:new RegExp('^'+room+'$')})});
 return {page,card,calls,errors,setConflict:()=>{failDelete=true}};
}
browserTest('A/B delete buttons protect default, cancellation and wrong name without sending deletion',async t=>{
 const f=await fixture(t);for(const id of ['note','note2']){
  assert.equal(await f.card(id,'default').getByRole('button',{name:'방 삭제',exact:true}).isDisabled(),true);
  f.page.once('dialog',d=>d.dismiss());await f.card(id,'alpha').getByRole('button',{name:'방 삭제',exact:true}).click();
  f.page.once('dialog',d=>d.accept('not-alpha'));await f.card(id,'alpha').getByRole('button',{name:'방 삭제',exact:true}).click();
  assert.ok((await f.card(id,'alpha').textContent()).includes('일치하지'));
 }assert.equal(f.calls.filter(c=>c.action==='delete-room').length,0);assert.deepEqual(f.errors,[]);
});
for(const id of ['note','note2'])browserTest(id+' explicit deletion sends exact scoped revision, refreshes only intended list, and keeps other note',async t=>{
 const f=await fixture(t);await f.card(id,'alpha').getByRole('button',{name:'이 방 선택 / 비밀번호 변경',exact:true}).click();
 await f.page.waitForFunction(()=>document.getElementById('note-password-selection-status').textContent.includes('새 비밀번호 저장'));
 f.page.once('dialog',d=>d.accept('alpha'));await f.card(id,'alpha').getByRole('button',{name:'방 삭제',exact:true}).click();
 await f.page.waitForFunction(()=>document.getElementById('note-admin-message').textContent.includes('삭제했습니다'));
 assert.equal(await f.card(id,'alpha').count(),0);assert.equal(await f.card(id==='note'?'note2':'note','alpha').count(),1);
 assert.equal(await f.page.locator('#note-password-form input[name=room]').inputValue(),'default');
 const deletion=f.calls.find(c=>c.action==='delete-room');assert.deepEqual(deletion.body,{id,room:'alpha',confirmation:'alpha',revision:'fixture-'+id+'-alpha'});
 assert.ok(f.calls.some(c=>c.action==='status'&&c.room==='alpha'&&c.id===id));
 assert.ok(!f.calls.some(c=>['rotate','reset-content','create'].includes(c.action)));assert.deepEqual(f.errors,[]);
});
browserTest('server conflict leaves the room present and displays error beside the delete control',async t=>{
 const f=await fixture(t);f.setConflict();f.page.once('dialog',d=>d.accept('alpha'));await f.card('note2','alpha').getByRole('button',{name:'방 삭제',exact:true}).click();
 await f.page.waitForFunction(()=>[...document.querySelectorAll('#note2-room-list .room-card')].find(c=>c.querySelector('strong')?.textContent==='alpha')?.querySelector('.room-delete-status')?.textContent.includes('다른 변경'));
 assert.equal(await f.card('note2','alpha').count(),1);assert.ok(!(await f.page.locator('#note-admin-message').textContent()).includes('삭제했습니다'));assert.deepEqual(f.errors,[]);
});
