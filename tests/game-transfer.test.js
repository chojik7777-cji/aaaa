'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
let chromium;try{({chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'));}catch{}
const browserTest=chromium?test:test.skip;
async function fixture(t){
 const server=http.createServer((req,res)=>{if(req.url.startsWith('/game-transfer.js')){res.setHeader('Content-Type','application/javascript');return res.end(fs.readFileSync(path.join(__dirname,'../game-transfer.js')))}res.end('<html><head><meta charset="UTF-8"></head><body><main style="height:1400px">Fixture game</main><script src="/game-transfer.js"></script><script>window.value=3;localStorage.setItem("note-token","keep-private");GameTransfer.mount({gameId:"sample",title:"시험 게임",capture:()=>({counter:window.value}),validate:x=>{if(!x||!Number.isInteger(x.counter)||x.counter<0||x.counter>100)throw new Error("잘못된 값입니다.");return {counter:x.counter}},restore:x=>{localStorage.setItem("sample-game",JSON.stringify(x));window.value=x.counter},canImport:()=>window.block?"온라인 방에서 나간 뒤 불러와 주세요.":true});</script></body></html>')});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const b=await chromium.launch();t.after(()=>b.close());const page=await b.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(2000);await page.goto('http://127.0.0.1:'+server.address().port);return page;
}
browserTest('bottom controls download and restore only game data, reject invalid input and respect cancellation/online locks',async t=>{
 const page=await fixture(t);await page.locator('#game-export-btn').waitFor();
 assert.ok(await page.locator('#game-transfer-panel').evaluate(e=>e.previousElementSibling!==null&&e.parentElement===document.body));
 const pending=page.waitForEvent('download');await page.locator('#game-export-btn').click();const download=await pending,payload=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
 assert.equal(payload.game,'sample');assert.deepEqual(payload.data,{counter:3});assert.ok(!JSON.stringify(payload).includes('keep-private'));
 const file=x=>({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(typeof x==='string'?x:JSON.stringify(x))});
 for(const bad of ['invalid-json',{...payload,game:'other'},{...payload,data:{counter:-1}}]){await page.locator('#game-import-file').setInputFiles(file(bad));await page.waitForFunction(()=>!document.getElementById('game-import-btn').disabled);assert.equal(await page.evaluate(()=>value),3)}
 page.once('dialog',d=>d.dismiss());await page.locator('#game-import-file').setInputFiles(file({...payload,data:{counter:9}}));await page.waitForFunction(()=>!document.getElementById('game-import-btn').disabled);assert.equal(await page.evaluate(()=>value),3);
 page.once('dialog',d=>d.accept());await page.locator('#game-import-file').setInputFiles(file({...payload,data:{counter:9}}));await page.waitForFunction(()=>window.value===9);assert.equal(await page.evaluate(()=>localStorage.getItem('note-token')),'keep-private');
 await page.evaluate(()=>window.block=true);await page.locator('#game-import-file').setInputFiles(file({...payload,data:{counter:10}}));await page.waitForFunction(()=>!document.getElementById('game-import-btn').disabled);assert.equal(await page.evaluate(()=>value),9);assert.ok((await page.locator('#game-transfer-status').textContent()).includes('온라인'));
});
test('game storage commit rolls back its own keys when a later write fails',()=>{
 const {persist}=require('../game-transfer'),data=new Map([['game','old'],['pref','before'],['auth','private']]);let attempt=0;
 const storage={getItem:k=>data.has(k)?data.get(k):null,setItem(k,v){if(++attempt===2)throw new Error('quota');data.set(k,v)},removeItem:k=>data.delete(k)};
 assert.throws(()=>persist({game:'new',pref:'after'},storage),/[가-힣]/);assert.deepEqual([...data],[['game','old'],['pref','before'],['auth','private']]);
 persist({game:'new',pref:'after'},storage);assert.equal(data.get('game'),'new');assert.equal(data.get('auth'),'private');
});
test('game backup envelope roundtrips only its own game and validates finite safe JSON',()=>{
 const {makeBackup,parseBackup}=require('../game-transfer');
 const adapter={gameId:'sample',capture:()=>({level:3,title:'게임'}),validate:x=>{if(!Number.isInteger(x.level))throw new Error('invalid');return {level:x.level,title:x.title}}};
 const file=makeBackup(adapter);assert.equal(file.format,'aaaa-game-backup');assert.equal(file.version,1);assert.equal(file.game,'sample');assert.deepEqual(parseBackup(JSON.stringify(file),'sample'),{level:3,title:'게임'});
 for(const x of [{...file,game:'other'},{...file,version:2},{...file,format:'other'},null,[]])assert.throws(()=>parseBackup(JSON.stringify(x),'sample'));
 assert.throws(()=>parseBackup('{"format":"aaaa-game-backup","version":1,"game":"sample","data":{"__proto__":{"polluted":true}}}','sample'));
 assert.throws(()=>parseBackup('{"format":"aaaa-game-backup","version":1,"game":"sample","data":{"n":1e999}}','sample'));
 assert.throws(()=>parseBackup('x'.repeat(2*1024*1024+1),'sample'));assert.equal({}.polluted,undefined);
});
