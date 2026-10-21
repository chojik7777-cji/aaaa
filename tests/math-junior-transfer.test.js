'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require('/tmp/note-modal-browser/node_modules/playwright');const root=path.resolve(__dirname,'..');
async function open(t,engine=chromium,width=390){const browser=await engine.launch({headless:true});t.after(()=>browser.close());const p=await browser.newPage({viewport:{width,height:844}});let policy={ok:true,locked:false,version:4,questionLimit:0};const requests=[],errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());await p.route('**/*',route=>{const u=new URL(route.request().url());requests.push({path:u.pathname,method:route.request().method()});if(u.pathname==='/api/math-control')return route.fulfill({json:policy});if(['/math-junior.html','/math-junior-problems.js','/game-transfer.js'].includes(u.pathname))return route.fulfill({body:fs.readFileSync(path.join(root,u.pathname)),contentType:u.pathname.endsWith('.js')?'application/javascript':'text/html'});return route.abort();});await p.goto('http://fixture.local/math-junior.html');await p.waitForFunction(()=>controlReady);t.after(()=>assert.deepEqual(errors,[]));return {p,requests,setPolicy:v=>policy=v};}
async function upload(p,payload){await p.locator('#game-import-file').setInputFiles({name:'math-junior.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))});await p.waitForFunction(()=>!document.querySelector('#game-import-file').disabled);}
for(const [name,engine]of [['Chromium',chromium],['WebKit',webkit]])test(name+': bottom save/load downloads a real file and restores independent progress without refunding quota',async t=>{
 const {p,requests}=await open(t,engine);
 assert.equal(await p.locator('#game-export-btn').count(),1,'하단 저장하기 버튼이 필요합니다');
 assert.equal(await p.locator('#game-export-btn').textContent(),'저장하기');assert.equal(await p.locator('#game-import-btn').textContent(),'불러오기');
 await p.selectOption('#trackSelect','e3');await p.click('#startBtn');await p.evaluate(()=>answer(current.answer));
 const before=await p.evaluate(()=>JSON.stringify(progress));
 const [download]=await Promise.all([p.waitForEvent('download'),p.click('#game-export-btn')]);
 const payload=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(payload.game,'math-junior');assert.equal(payload.data.progress.selected,'e3');assert.equal(payload.data.progress.tracks.e3.correct,1);
 await p.click('#nextBtn');await p.click('#skipBtn');const budget=await p.evaluate(()=>readBudget());
 await p.click('#solutionBtn');await upload(p,payload);assert.match(await p.locator('#game-transfer-status').textContent(),/불러왔습니다/);
 assert.equal(await p.evaluate(()=>JSON.stringify(progress)),before);assert.equal(await p.evaluate(()=>readBudget()),budget);assert.equal(await p.locator('#setupPanel').isVisible(),true);assert.equal(await p.locator('#solutionPanel').isVisible(),false);assert.equal(await p.locator('#trackSelect').inputValue(),'e3');
 await p.reload();await p.waitForFunction(()=>controlReady);assert.equal(await p.evaluate(()=>JSON.stringify(progress)),before);assert.equal(await p.evaluate(()=>readBudget()),budget);
 const geometry=await p.evaluate(()=>({main:document.querySelector('main').getBoundingClientRect().toJSON(),panel:document.querySelector('#game-transfer-panel').getBoundingClientRect().toJSON(),overflow:document.documentElement.scrollWidth>innerWidth}));assert(geometry.panel.top>=geometry.main.bottom);assert.equal(geometry.overflow,false);assert(geometry.main.width>=350);
 assert(requests.every(r=>r.method==='GET'),'파일 저장·복원은 서버에 변경 요청을 보내면 안 됩니다');
});
test('invalid records are rejected atomically, including inconsistent recent result totals',async t=>{
 const {p}=await open(t);await p.click('#startBtn');await p.evaluate(()=>answer(current.answer));
 const data=await p.evaluate(()=>validateJuniorTransfer({progress,issued:1}));
 const cases=[];for(const mutate of [d=>d.progress.selected='bad',d=>d.progress.tracks['k-count'].correct=9,d=>d.progress.tracks['k-count'].issued=-1,d=>d.progress.tracks['k-count'].history[0].correct='true',d=>d.progress.tracks['k-count'].history[0].seconds=-1,d=>d.progress.tracks['k-count'].correct=0]){const d=structuredClone(data);mutate(d);cases.push(d);}
 const before=await p.evaluate(()=>({progress:JSON.stringify(progress),storage:JSON.stringify(localStorage),question:current.text}));
 for(const bad of cases){const rejected=await p.evaluate(raw=>{try{restoreJuniorTransfer(raw);return false;}catch{return true;}},bad);assert.equal(rejected,true);assert.deepEqual(await p.evaluate(()=>({progress:JSON.stringify(progress),storage:JSON.stringify(localStorage),question:current.text})),before);}
});
for(const [name,engine]of [['Chromium',chromium],['WebKit',webkit]])test(name+': imported records never import authority or clear current locks and render history as text',async t=>{
 const {p,requests,setPolicy}=await open(t,engine);await p.click('#startBtn');await p.evaluate(()=>answer(current.answer));
 const backup=await p.evaluate(()=>GameTransfer.makeBackup({gameId:'math-junior',capture:()=>({progress,issued:1}),validate:validateJuniorTransfer}));
 backup.data.controlGrant=999;backup.data.limitGrant=999;backup.data.policy={locked:false,questionLimit:0};backup.data.progress.tracks['k-count'].history[0].text='<img src=x onerror="window.pwned=1">';
 await p.evaluate(()=>{localStorage.setItem('unrelated-auth-test','keep');localStorage.setItem('math-level-game-v1',JSON.stringify({asked:2,correct:2}));});
 const locked={ok:true,locked:true,version:5,questionLimit:1};setPolicy(locked);await p.evaluate(policy=>applyPolicy(policy),locked);
 await upload(p,backup);assert.equal(await p.locator('#gate').isVisible(),true);assert.equal(await p.locator('#startBtn').isDisabled(),true);assert.deepEqual(await p.evaluate(()=>({controlGrant,limitGrant,centralLocked})),{controlGrant:-1,limitGrant:-1,centralLocked:true});
 assert.equal(await p.locator('#history img').count(),0);assert.match(await p.locator('#history').textContent(),/<img src=x/);assert.equal(await p.evaluate(()=>window.pwned),undefined);
 assert.equal(await p.evaluate(()=>localStorage.getItem('unrelated-auth-test')),'keep');assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('math-level-game-v1')).asked),2);
 const out=await p.evaluate(()=>validateJuniorTransfer({progress,issued:1}));assert.deepEqual(Object.keys(out).sort(),['issued','progress']);
 const limited={ok:true,locked:false,version:6,questionLimit:1};setPolicy(limited);await p.evaluate(policy=>applyPolicy(policy),limited);await upload(p,backup);assert.equal(await p.evaluate(()=>limitLocked),true);assert.equal(await p.locator('#gateMessage').textContent(),'비번입력');assert(requests.every(r=>r.method==='GET'));
});
test('wrong-game, cancellation and failed storage leave current records unchanged',async t=>{
 const {p}=await open(t);await p.click('#startBtn');await p.evaluate(()=>answer(current.answer));
 const payload=await p.evaluate(()=>GameTransfer.makeBackup({gameId:'math-junior',capture:()=>({progress,issued:1}),validate:validateJuniorTransfer}));
 const snapshot=()=>p.evaluate(()=>({progress:JSON.stringify(progress),storage:JSON.stringify(localStorage),question:current?.text}));const before=await snapshot();
 await upload(p,{...payload,game:'math-level'});assert.deepEqual(await snapshot(),before);assert.match(await p.locator('#game-transfer-status').textContent(),/이 게임/);
 p.removeAllListeners('dialog');p.on('dialog',d=>d.dismiss());await upload(p,payload);assert.deepEqual(await snapshot(),before);assert.match(await p.locator('#game-transfer-status').textContent(),/취소/);
 const result=await p.evaluate(raw=>{const proto=Object.getPrototypeOf(localStorage),original=proto.setItem;proto.setItem=function(k,v){if(k==='math-junior-issued-v1')throw Error('fixture storage full');return original.call(this,k,v);};try{restoreJuniorTransfer(raw);return false;}catch{return true;}finally{proto.setItem=original;}},payload.data);assert.equal(result,true);assert.deepEqual(await snapshot(),before);
});
module.exports={open,upload};
