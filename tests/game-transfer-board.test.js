'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.join(__dirname, '..');
async function open(t, game, real = false) {
 const browser = await chromium.launch({headless:true}); t.after(()=>browser.close());
 const context = await browser.newContext(); const page = await context.newPage();
 await context.route('**/*', route => {
  const name = new URL(route.request().url()).pathname.slice(1);
  if(name === 'game-transfer.js') return route.fulfill({contentType:'text/javascript',body: fs.readFileSync(path.join(root,name),'utf8')+';const mount=GameTransfer.mount;GameTransfer.mount=opts=>{window.adapter=opts;'+(real?'return mount(opts);':'')+'};'});
  if(name === game+'.html') return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,name))});
  return route.fulfill({status:404,body:''});
 });
 await page.goto('http://board-transfer.test/'+game+'.html'); return page;
}
for(const game of ['omok','baduk']) test(game+' rejects malformed and inconsistent states without mutation',async t=>{
 const page=await open(t,game);
 const checks=await page.evaluate(game=>{
  const before=adapter.capture(); const mutations=[s=>s.board[0]='bad',s=>s.mode='net',s=>s.level=99,s=>s.human=0,
   s=>{if(game==='omok')s.turn=2;else s.toMove=2;},s=>{s.moves=game==='omok'?[{x:99,y:0}]:[999];},
   s=>{s.moves=game==='omok'?[{x:0,y:0}]:[0];},s=>{if(game==='omok')s.tally.a=-1;else s.caps[1]=-1;},
   s=>{if(game==='omok')s.winner=1;else s.phase='evil';}];
  return mutations.map(m=>{const s=structuredClone(before);m(s);try{adapter.restore(adapter.validate(s));return false;}catch(e){return /[가-힣]/.test(e.message)&&JSON.stringify(before)===JSON.stringify(adapter.capture());}});
 },game);
 assert.deepEqual(checks,checks.map(()=>true));
});
for(const game of ['omok','baduk']) test(game+' nonempty history roundtrip, undo and subsequent persistence',async t=>{
 const page=await open(t,game);
 await page.evaluate(game=>{const s=adapter.capture();s.mode='pvp';adapter.restore(adapter.validate(s));
  if(game==='omok'){play(0,0);play(1,0);}else{doMove(0);doMove(1);}
 },game);
 const saved=await page.evaluate(()=>adapter.capture());
 await page.reload();assert.deepEqual(await page.evaluate(()=>adapter.capture()),saved);
 await page.evaluate(()=>adapter.restore(adapter.validate(adapter.capture())));
 assert.deepEqual(await page.evaluate(()=>adapter.capture()),saved);
 await page.reload();assert.deepEqual(await page.evaluate(()=>adapter.capture()),saved);
 await page.evaluate(()=>undo());const undone=await page.evaluate(()=>adapter.capture());assert.equal(undone.moves.length,1);
});
for(const game of ['omok','baduk']) test(game+' online snapshot strips membership and refuses restore',async t=>{
 const page=await open(t,game);
 const result=await page.evaluate(game=>{const original=adapter.capture();NET.active=true;NET.roomId='SECRET';NET.playerId='TOKEN';NET.playerIndex=0;
  if(game==='omok')modeEl.value='net';else G.mode='net';
  const s=adapter.capture(),reason=adapter.canImport();let blocked=false;try{adapter.restore(original);}catch(e){blocked=/온라인/.test(e.message);}
  return {s,reason,blocked,room:NET.roomId};},game);
 assert.equal(result.s.mode,'pvp');assert.doesNotMatch(JSON.stringify(result.s),/SECRET|TOKEN|playerId|roomId/);
 assert.equal(typeof result.reason,'string');assert.equal(result.blocked,true);assert.equal(result.room,'SECRET');
});
test('baduk cancels pending scoring callbacks on import',async t=>{
 const page=await open(t,'baduk');
 const before=await page.evaluate(()=>{const s=adapter.capture();s.mode='pvp';adapter.restore(adapter.validate(s));startScoring();adapter.restore(adapter.validate(s));return adapter.capture();});
 await page.waitForTimeout(1000);assert.deepEqual(await page.evaluate(()=>adapter.capture()),before);
});
test('baduk preserves resumed pass count and imports pending scoring safely',async t=>{
 const page=await open(t,'baduk');
 const resumed=await page.evaluate(()=>{let s=adapter.capture();s.mode='pvp';adapter.restore(adapter.validate(s));doMove(-1,true);doMove(-1,true);G.passes=0;save();s=adapter.capture();adapter.restore(adapter.validate(s));return {expected:s,actual:adapter.capture()};});
 assert.deepEqual(resumed.actual,resumed.expected);
 await page.reload();assert.deepEqual(await page.evaluate(()=>adapter.capture()),resumed.expected);
 const score=await page.evaluate(()=>{newGameSilent({...settings(),mode:'pvp'});startScoring();const s=adapter.capture();adapter.restore(adapter.validate(s));return {dead:!!G.dead,phase:G.phase};});
 assert.deepEqual(score,{dead:true,phase:'score'});
});
for(const game of ['omok','baduk']) test(game+' real helper downloads and imports JSON, invalid file preserves state, panel below board',async t=>{
 const page=await open(t,game,true);page.on('dialog',d=>d.accept());
 await page.evaluate(game=>{const s=adapter.capture();s.mode='pvp';adapter.restore(adapter.validate(s));if(game==='omok')play(0,0);else doMove(0);},game);
 const saved=await page.evaluate(()=>adapter.capture());
 const downloadPromise=page.waitForEvent('download');await page.locator('#game-export-btn').click();const download=await downloadPromise;
 const text=fs.readFileSync(await download.path(),'utf8'),envelope=JSON.parse(text);assert.equal(envelope.game,game);assert.deepEqual(envelope.data,saved);
 await page.evaluate(game=>game==='omok'?resetGame():startNew(),game);
 await page.locator('#game-import-file').setInputFiles({name:'roundtrip.json',mimeType:'application/json',buffer:Buffer.from(text)});
 await page.waitForFunction(()=>document.getElementById('game-transfer-status').textContent.includes('불러왔습니다'));
 assert.deepEqual(await page.evaluate(()=>adapter.capture()),saved);
 envelope.data.board=[];
 await page.locator('#game-import-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(envelope))});
 await page.waitForFunction(()=>!document.getElementById('game-import-btn').disabled);
 assert.deepEqual(await page.evaluate(()=>adapter.capture()),saved);
 const board=await page.locator('#board').boundingBox(),panel=await page.locator('#game-transfer-panel').boundingBox();assert.ok(panel.y>=board.y+board.height,'backup panel must be below the board');
});
test('omok cancels queued fallback AI computation rather than only ignoring delivery',async t=>{
 const page=await open(t,'omok');
 const remaining=await page.evaluate(()=>{worker=null;const original=setTimeout,clear=clearTimeout,pending=new Set();
  window.setTimeout=(fn,ms)=>{const id=original(fn,ms);pending.add(id);return id;};window.clearTimeout=id=>{pending.delete(id);clear(id);};
  const s=adapter.capture();s.mode='pvp';thinking=true;requestAi();adapter.restore(adapter.validate(s));return pending.size;});
 assert.equal(remaining,0);
});
for(const game of ['omok','baduk']) test(game+' imported AI settings resume only fresh computation, unknown fields stripped',async t=>{
 const page=await open(t,game);
 await page.evaluate(game=>{const s=adapter.capture();s.mode='pvp';s.admin=true;s.roomId='NO';s.token='NO';const norm=adapter.validate(s);
  if('admin' in norm||'roomId' in norm||'token' in norm)throw Error('extra keys retained');adapter.restore(norm);
  const a=adapter.capture();a.mode='ai';a.level=1;a.human=2;adapter.restore(adapter.validate(a));
  const target=adapter.capture();target.mode='pvp';adapter.restore(adapter.validate(target));},game);
 const before=await page.evaluate(()=>adapter.capture());await page.waitForTimeout(600);assert.deepEqual(await page.evaluate(()=>adapter.capture()),before);
});
for(const game of ['omok','baduk']) test(game+' adapter mounts, exports a detached safe board and restores across reload',async t=>{
 const page=await open(t,game);
 assert.equal(await page.evaluate(()=>!!window.adapter),true,'missing GameTransfer adapter');
 const initial=await page.evaluate(()=>adapter.capture());
 assert.equal(initial.mode,'ai');
 assert.equal(await page.evaluate(()=>adapter.canImport()),true);
 await page.evaluate(()=>{const s=adapter.capture();s.mode='pvp';adapter.restore(adapter.validate(s));});
 const saved=await page.evaluate(()=>adapter.capture()); assert.equal(saved.mode,'pvp');
 assert.doesNotMatch(JSON.stringify(saved),/playerId|roomId|token|roomKey|admin/);
 await page.reload(); assert.deepEqual(await page.evaluate(()=>adapter.capture()),saved);
});
