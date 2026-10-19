'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let engine;try{engine=require(process.env.PLAYWRIGHT_PATH||'playwright')[process.env.PLAYWRIGHT_BROWSER||'chromium'];}catch{}
async function fixture(browser,file,width=390){
 const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});
 const f={id:'fixture',name:'<img src=x onerror="window.xss=1"> 자료.TXT',size:10,uploadedAt:1};
 const state={denied:false,conflict:false,version:1,files:[f],writes:[],errors:[],dialogs:0};
 page.on('pageerror',e=>state.errors.push(e.message));page.on('dialog',async d=>{state.dialogs++;await d.dismiss();});
 await page.addInitScript(()=>{localStorage.setItem('note-token:alpha','fixture-token');localStorage.setItem('note2-token:alpha','fixture-token');});
 await page.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(u.protocol==='blob:')return route.continue();
  if(u.pathname.startsWith('/api/')){
   if(u.pathname.endsWith('/file'))return route.fulfill({contentType:'text/plain',body:'fixture preview'});
   if(u.pathname.endsWith('/rename-file')){state.writes.push({url:u.pathname,body:req.postDataJSON(),token:req.headers()['x-note-token']});if(state.delayRename)await new Promise(resolve=>{state.releaseRename=resolve;});if(state.conflict)return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({ok:false,error:'같은 이름의 파일이 있습니다.'})});const name=req.postDataJSON().name;state.files=[{...f,id:file==='note.html'?name:f.id,name}];state.version++;}
   return route.fulfill({status:state.denied?401:200,contentType:'application/json',body:JSON.stringify({ok:!state.denied,version:state.version,text:'server text',files:state.files})});
  }
  const n=u.pathname.slice(1);if(!['note.html','note2.html','note-attachment-preview.js'].includes(n))return route.fulfill({status:404,body:''});
  return route.fulfill({contentType:n.endsWith('.js')?'text/javascript':'text/html',body:fs.readFileSync(path.join(__dirname,'..',n))});
 });
 await page.goto('http://rename.test/'+file+'?room=alpha');await page.locator('#fileList .file').waitFor();return {page,state,f};
}
test('filename editing uses a safe page dialog, fixed extension and exact rename API, updates local/cloud IDs without crowding actions',{skip:!engine},async t=>{
 const browser=await engine.launch({headless:true});t.after(()=>browser.close());
 for(const file of ['note.html','note2.html'])for(const width of [320,390]){
  const {page,state,f}=await fixture(browser,file,width);const trigger=page.getByRole('button',{name:'이름변경',exact:true});
  assert.equal(await trigger.count(),1);assert.equal(await trigger.evaluate(e=>e.getBoundingClientRect().height),44,'rename shares action-button height');assert.deepEqual(await page.locator('.file-actions button').allTextContents(),['미리보기','이름변경','다운로드','삭제']);
  await trigger.click();const dialog=page.getByRole('dialog',{name:'파일명 변경',exact:true});await dialog.waitFor();
  const input=dialog.getByRole('textbox',{name:'파일명',exact:true});assert.equal(await input.inputValue(),f.name.slice(0,-4));assert.equal(await dialog.locator('.attachment-rename-extension').textContent(),'.TXT');assert.equal(await dialog.locator('input').count(),1);assert.equal(await page.evaluate(()=>window.xss),undefined);
  const box=await dialog.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width&&box.height<=844*.8);assert.equal(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth),true);
  await input.fill('새 자료');await page.evaluate(()=>{document.getElementById('editor').value='unsaved draft';dirty=true;lastLocalEdit=Date.now();});
  await dialog.getByRole('button',{name:'저장',exact:true}).evaluate(e=>{e.click();e.click();});await dialog.waitFor({state:'hidden'});
  assert.equal(state.writes.length,1);assert.deepEqual(state.writes[0],{url:file==='note.html'?'/api/note/rename-file':'/api/note2/rename-file',body:{room:'alpha',id:'fixture',name:'새 자료.TXT',user:'익명'},token:'fixture-token'});
  const id=file==='note.html'?'새 자료.TXT':'fixture';assert.equal(await page.locator('[download]').getAttribute('download'),'새 자료.TXT');assert.equal(new URL(await page.locator('[download]').getAttribute('href'),'http://rename.test').searchParams.get('id'),id);assert.equal(await page.locator('[data-delete]').getAttribute('data-delete'),id);
  assert.equal(await page.locator('#editor').inputValue(),'unsaved draft');await page.locator('[data-preview-button]').click();await page.locator('.attachment-preview pre').waitFor();assert.equal(await page.locator('.attachment-preview h2').textContent(),'새 자료.TXT');const pv=await page.locator('.attachment-preview').boundingBox();assert.ok(Math.abs(pv.width-width*.8)<2);await page.keyboard.press('Escape');
  const actions=await page.locator('.file-actions button').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {y:r.y,h:r.height,right:r.right};}));assert.ok(actions.every(a=>a.h===44&&a.y===actions[0].y&&a.right<=width));assert.equal(state.dialogs,0);assert.deepEqual(state.errors,[]);await page.close();
 }
});
test('rename validation rejects unsafe/oversized stems before POST; cancellation, polling, conflicts and auth lock stay safe',{skip:!engine},async t=>{
 const browser=await engine.launch({headless:true});t.after(()=>browser.close());
 for(const file of ['note.html','note2.html']){
 const {page,state,f}=await fixture(browser,file,320),trigger=page.locator('[data-rename]');
 await trigger.click();const dialog=page.getByRole('dialog',{name:'파일명 변경',exact:true}),input=dialog.getByRole('textbox',{name:'파일명',exact:true}),save=dialog.getByRole('button',{name:'저장',exact:true});
 for(const invalid of ['','   ','../escape','a/b','a\\b','.hidden','x:bad','new..name','가'.repeat(90),'a'.repeat(161)]){
  await input.fill(invalid);await save.click();assert.equal(state.writes.length,0,'invalid stem must not reach rename API: '+invalid);assert.equal(await dialog.isVisible(),true);assert.ok((await dialog.locator('[role=status]').textContent()).length>0);
 }
 await input.fill('editing draft');state.files=[{...f,size:11}];await page.waitForFunction(()=>document.querySelector('#fileList small')?.textContent.includes('11B'));assert.equal(await input.inputValue(),'editing draft');
 await dialog.getByRole('button',{name:'취소',exact:true}).click();assert.equal(state.writes.length,0);
 for(const cancel of ['escape','backdrop','pagehide']){await trigger.click();if(cancel==='escape')await page.keyboard.press('Escape');else if(cancel==='backdrop')await page.mouse.click(1,1);else await page.evaluate(()=>dispatchEvent(new Event('pagehide')));assert.equal(await dialog.isVisible(),false);assert.equal(state.writes.length,0);}
 await trigger.click();state.conflict=true;await input.fill('duplicate');await save.click();await dialog.locator('[role=status]').filter({hasText:'같은 이름'}).waitFor();assert.equal(await input.isEnabled(),true);assert.equal(await input.inputValue(),'duplicate');assert.equal(state.writes.length,1);
 state.conflict=false;await input.fill('retry');await save.click();await dialog.waitFor({state:'hidden'});assert.equal(state.writes.length,2);
 await trigger.click();state.denied=true;await page.waitForFunction(()=>!document.getElementById('lock').hidden);assert.equal(await dialog.isVisible(),false);assert.equal(state.writes.length,2);assert.equal(state.dialogs,0);assert.deepEqual(state.errors,[]);await page.close();
 }
 });
 test('a late response from a cancelled save never closes or overwrites a newer rename dialog',{skip:!engine},async t=>{
 const browser=await engine.launch({headless:true});t.after(()=>browser.close());
 for(const file of ['note.html','note2.html']){
 const {page,state}=await fixture(browser,file);state.delayRename=true;
 const trigger=page.locator('[data-rename]');await trigger.click();const dialog=page.getByRole('dialog',{name:'파일명 변경',exact:true}),input=dialog.getByRole('textbox',{name:'파일명',exact:true});
 await input.fill('first');await dialog.getByRole('button',{name:'저장',exact:true}).click();
 await page.waitForRequest(r=>r.url().includes('/state'));assert.equal(state.writes.length,1);
 await dialog.getByRole('button',{name:'취소',exact:true}).click();await trigger.click();await input.fill('newer unsaved name');
 state.releaseRename();await page.waitForFunction(()=>document.querySelector('[download]')?.download==='first.TXT');
 assert.equal(await dialog.isVisible(),true,'old request must not close a new edit session');assert.equal(await input.inputValue(),'newer unsaved name');assert.equal(state.writes.length,1);await page.close();
 }
 });
