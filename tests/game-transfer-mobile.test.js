'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const ROOT=path.join(__dirname,'..'),games=['omok','baduk','yut','church','math-academy','math-level'];
for(const [name,engine] of [['Chromium',chromium],['WebKit',webkit]])test(name+' mobile: every newly supported game has bottom touch-safe working export/import',async t=>{
 const browser=await engine.launch();t.after(()=>browser.close());
 for(const width of [390,1280]) for(const game of games){
  const context=await browser.newContext({viewport:{width,height:844},acceptDownloads:true});const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname!=='transfer-mobile.test')return route.fulfill({body:''});if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,locked:false,questionLimit:5,version:1}});const filename=u.pathname.slice(1);if(!games.map(g=>g+'.html').concat(['game-transfer.js']).includes(filename))return route.fulfill({status:404,body:''});return route.fulfill({contentType:filename.endsWith('.html')?'text/html':'application/javascript',body:fs.readFileSync(path.join(ROOT,filename))});});
  await page.goto('http://transfer-mobile.test/'+game+'.html');await page.locator('#game-transfer-panel').waitFor();await page.locator('#game-export-btn').scrollIntoViewIfNeeded();
  const geometry=await page.evaluate(()=>{const p=document.getElementById('game-transfer-panel'),r=p.getBoundingClientRect(),flow=[...document.body.children].filter(e=>{const s=getComputedStyle(e);return e.getBoundingClientRect().height>0&&!['fixed','absolute'].includes(s.position)});return {top:r.top,mainBottom:Math.max(...flow.filter(e=>e!==p).map(e=>e.getBoundingClientRect().bottom)),left:r.left,right:r.right,last:flow.at(-1)===p,buttons:[...p.querySelectorAll('.game-transfer-actions button')].map(b=>b.getBoundingClientRect().height),width:innerWidth}});
  assert.ok(geometry.top>=geometry.mainBottom-1,game+' width '+width+' backup must be physically below the whole game card, never beside it');assert.equal(geometry.last,true,game+' panel is last visible flow element');assert.ok(geometry.left>=0&&geometry.right<=geometry.width,game+' panel inside mobile width');assert.ok(geometry.buttons.every(h=>h>=44),game+' touch targets >=44px');
  const pending=page.waitForEvent('download');await page.locator('#game-export-btn').click();const download=await pending,text=fs.readFileSync(await download.path(),'utf8'),payload=JSON.parse(text);assert.equal(payload.game,game);
  page.once('dialog',d=>d.accept());await page.locator('#game-import-file').setInputFiles({name:'roundtrip.json',mimeType:'application/json',buffer:Buffer.from(text)});await page.waitForFunction(()=>document.getElementById('game-transfer-status').textContent.includes('불러왔습니다'));
  assert.deepEqual(errors,[],game+' no JS errors');await context.close();
 }
});
