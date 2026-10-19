'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'),root=path.join(__dirname,'..');
for(const game of ['omok','baduk','church','math-academy','math-level','yut'])test(game+': storage failure never reports import success or partially replaces current game',async t=>{
 const browser=await chromium.launch();t.after(()=>browser.close());const context=await browser.newContext();const page=await context.newPage();
 await page.route('**/*',route=>{const p=new URL(route.request().url()).pathname.slice(1);if(p.startsWith('api/'))return route.fulfill({json:{ok:true,locked:false,questionLimit:5,version:1}});let body=fs.readFileSync(path.join(root,p),'utf8');if(p==='game-transfer.js')body+=';const mountOriginal=GameTransfer.mount;GameTransfer.mount=a=>{window.fixtureAdapter=a;return mountOriginal(a)};';return route.fulfill({contentType:p.endsWith('.html')?'text/html':'application/javascript',body})});
 await page.goto('http://atomic-transfer.test/'+game+'.html');
 for(const failAt of (['omok','yut'].includes(game)?[1]:[1,2])){
  const prepared=await page.evaluate(({game,failAt})=>{
   localStorage.setItem('note-token','private-sentinel');const before=fixtureAdapter.capture(),storage={...localStorage},data=structuredClone(before);
   if(game==='omok'||game==='baduk')data.mode='pvp';else if(game==='church'){data.name='복원한 이름';data.state.budget+=100;}else if(game==='math-academy'){data.name='복원한 이름';data.state.money+=100;}else if(game==='math-level')data.startLevel=2;else data.settings.count=3;
   fixtureAdapter.validate(data);window.originalSetItem=Storage.prototype.setItem;let writes=0;Storage.prototype.setItem=function(k,v){if(++writes===failAt)throw new DOMException('quota','QuotaExceededError');return originalSetItem.call(this,k,v)};
   return {before,storage,payload:{format:'aaaa-game-backup',version:1,game,data}};
  },{game,failAt});
  page.once('dialog',d=>d.accept());await page.locator('#game-import-file').setInputFiles({name:'quota.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(prepared.payload))});await page.waitForFunction(()=>!document.getElementById('game-import-btn').disabled);
  const after=await page.evaluate(()=>{Storage.prototype.setItem=originalSetItem;return {data:fixtureAdapter.capture(),storage:{...localStorage},message:document.getElementById('game-transfer-status').textContent}});
  assert.doesNotMatch(after.message,/불러왔습니다/,game+' must surface write failure');assert.deepEqual(after.data,prepared.before,game+' current memory state unchanged');assert.deepEqual(after.storage,prepared.storage,game+' persisted state unchanged');
 }
});
