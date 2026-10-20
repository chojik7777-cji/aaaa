'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.join(__dirname, '..');
async function openGame(t, name, storage = {}, control = {}, realHelper = false) {
    const browser = await chromium.launch({headless:true});
    t.after(() => browser.close());
    const context = await browser.newContext();
    const calls = [];
    await context.addInitScript(({storage,realHelper}) => {
        if (!sessionStorage.getItem('fixture-seeded')) {
            for (const [key,value] of Object.entries(storage)) localStorage.setItem(key, JSON.stringify(value));
            sessionStorage.setItem('fixture-seeded','1');
        }
        if (!realHelper) window.GameTransfer = { mount(options) { window.transfer = options; } };
    }, {storage,realHelper});
    await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/'+name+'.html') return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,name+'.html'),'utf8')});
        if (url.pathname === '/game-transfer.js') return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(root,'game-transfer.js'),'utf8')+(realHelper?'':';GameTransfer.mount=options=>{window.transfer=options;};')});
        if (url.pathname === '/math-problems.js') return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(root,'math-problems.js'),'utf8')});
        if (url.pathname.startsWith('/api/')) {
            calls.push({url:url.pathname+url.search,method:route.request().method()});
            return route.fulfill({json:{ok:true,version:9,locked:false,questionLimit:5,...control}});
        }
        return route.fulfill({body:''});
    });
    const page = await context.newPage();
    await page.goto('http://fixture.local/'+name+'.html');
    await page.waitForTimeout(60);
    return {page,calls};
}
test('yut rejects stalled phase/pending/throw combinations in both current board and undo history',async t=>{
 const {page}=await openGame(t,'yut');await page.locator('#startBtn').click();
 const result=await page.evaluate(()=>{const original=transfer.capture(),before=JSON.stringify(original),attacks=[g=>{g.phase='move';g.pending=[];g.throwsLeft=0},g=>{g.phase='throw';g.throwsLeft=0},g=>{g.phase='move';g.pending=[-1];g.throwsLeft=0},g=>{g.phase='over';g.winner=0},g=>{g.players[0].pieces[0]={path:'B',idx:0,done:false}}];let rejected=0;
  for(const attack of attacks)for(const history of [false,true]){const raw=structuredClone(original),target=history?structuredClone(raw.game):raw.game;attack(target);if(history)raw.history=[target];try{transfer.restore(transfer.validate(raw))}catch(e){rejected++}}
  return {rejected,unchanged:before===JSON.stringify(transfer.capture())};});assert.equal(result.rejected,10);assert.equal(result.unchanged,true);
});
test('yut first player winning state stays exportable and can resume as a finished board',async t=>{
 const {page}=await openGame(t,'yut');await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#startBtn').click();
 await page.evaluate(()=>{const d=transfer.capture(),finish=[-1,...Array.from({length:19},(_,i)=>i+1),0].length;d.game.players[0].pieces=[{path:'OUT',idx:finish,done:true},{path:'OUT',idx:finish-1,done:false}];d.game.phase='move';d.game.pending=[1];d.game.throwsLeft=0;transfer.restore(transfer.validate(d));});
 await page.locator('#board .token[data-node="0"]').click();await page.locator('#options button').first().click();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('이겼습니다'));
 const result=await page.evaluate(()=>{const data=transfer.capture();transfer.restore(transfer.validate(data));return {phase:data.game.phase,winner:data.game.winner}});assert.deepEqual(result,{phase:'over',winner:0});
});
const progress = (asked=2) => ({theta:7.2,nextLevel:7,asked,correct:Math.min(2,asked),streak:2,uncertainty:2.1,history:[{q:'1+1',answer:2,level:1,correct:true,seconds:3,theta:7.2,expected:40}]});
test('math transfer roundtrip persists educational progress and start setting, never grants', async t => {
    const {page} = await openGame(t,'math-level',{'math-level-game-v1':progress()});
    const snapshot = await page.evaluate(() => {
        if (!window.transfer) throw new Error('GameTransfer adapter missing');
        document.getElementById('startLevel').value='12';
        return transfer.capture();
    });
    assert.equal(snapshot.progress.asked,2);
    assert.equal(snapshot.startLevel,12);
    assert.equal(/password|unlock|bypass|auth/i.test(JSON.stringify(snapshot)),false);
    await page.evaluate(snapshot => transfer.restore(transfer.validate(snapshot)),snapshot);
    await page.reload();
    assert.deepEqual(await page.evaluate(() => transfer.capture()),snapshot);
});

test('math import keeps current question budget and server locks, rejects invalid input atomically and renders text safely', async t => {
    const {page,calls} = await openGame(t,'math-level',{'math-level-game-v1':progress(6)}, {locked:true});
    const result = await page.evaluate(() => {
        const before = localStorage.getItem('math-level-game-v1');
        const good = transfer.capture();
        let rejected = 0;
        for (const mutate of [d=>d.progress.theta=NaN,d=>d.progress.nextLevel=19,d=>d.progress.correct=-1,
            d=>d.progress.history[0].seconds=Infinity,d=>d.progress.history=Array(81).fill(d.progress.history[0]),
            d=>d.progress.history[0].q='x'.repeat(501)]) {
            const bad = structuredClone(good); mutate(bad);
            try { transfer.restore(transfer.validate(bad)); } catch (e) { if (/[가-힣]/.test(e.message)) rejected++; }
        }
        const unchanged = localStorage.getItem('math-level-game-v1')===before;
        const older = structuredClone(good); older.progress.asked=2; older.progress.correct=1;
        older.progress.history[0].q='<img src=x onerror="window.transferXss=1">';
        older.progress.centralLocked=false; older.localLimitUnlockVersion=9;
        transfer.restore(transfer.validate(older));
        return {rejected,unchanged,asked:transfer.capture().progress.asked,
            lock:document.getElementById('mathLockOverlay').classList.contains('show'),
            noImages:document.querySelectorAll('#log img').length===0,
            grants:[localStorage.getItem('math-level-control-bypass-v1'),sessionStorage.getItem('math-level-limit-unlock-v1')],
            disabled:[...document.querySelectorAll('#choiceGrid button')].every(b=>b.disabled)};
    });
    assert.equal(result.rejected,6); assert.equal(result.unchanged,true);
    assert.equal(result.asked,6); assert.equal(result.lock,true); assert.equal(result.disabled,true);
    assert.deepEqual(result.grants,[null,null]); assert.equal(result.noImages,true);
    assert.equal(calls.some(c=>c.method==='POST'),false);
    await page.reload();
    assert.equal(await page.evaluate(()=>transfer.capture().progress.asked),6);
});
test('math import cannot clear an existing question-limit overlay', async t => {
    const {page} = await openGame(t,'math-level',{'math-level-game-v1':progress(6)});
    await page.evaluate(() => {const d=transfer.capture();d.progress.asked=2;d.progress.correct=1;transfer.restore(transfer.validate(d));});
    assert.equal(await page.locator('#questionLimitOverlay').evaluate(e=>e.classList.contains('show')),true);
    assert.equal(await page.evaluate(()=>transfer.capture().progress.asked),6);
});

test('yut local board, throw and undo history roundtrip and resume after reload', async t => {
    const {page,calls} = await openGame(t,'yut');
    await page.selectOption('#ptype1','human');
    await page.click('#startBtn');
    await page.evaluate(()=>{const values=[0.9,0.1,0.1,0.9];Math.random=()=>values.shift()??0.9;});
    await page.click('#throwBtn');
    await page.waitForTimeout(650);
    await page.locator('#options button').first().click();
    await page.waitForTimeout(650);
    const snapshot=await page.evaluate(()=>{if(!window.transfer) throw new Error('GameTransfer adapter missing');return transfer.capture();});
    assert.equal(snapshot.mode,'local'); assert.equal(snapshot.history.length,2);
    assert.equal(snapshot.game.players[0].pieces[0].idx,2);
    assert.equal(await page.locator('#tokenLayer .token').count(),1);
    assert.equal(snapshot.game.players.length,2);
    assert.equal(/roomId|playerId|token|membership|connection/i.test(JSON.stringify(snapshot)),false);
    await page.evaluate(s=>transfer.restore(transfer.validate(s)),snapshot);
    await page.reload();
    assert.deepEqual(await page.evaluate(()=>transfer.capture()),snapshot);
    assert.equal(await page.locator('#undoBtn').isEnabled(),true);
    await page.click('#undoBtn');
    assert.equal((await page.evaluate(()=>transfer.capture())).history.length,1);
    await page.click('#undoBtn');
    assert.equal((await page.evaluate(()=>transfer.capture())).history.length,0);
    assert.equal(calls.length,0);
    await page.reload();
    assert.equal((await page.evaluate(()=>transfer.capture())).history.length,0);
});

test('yut online exports only a read-only board, blocks joined-room import and never replays server commands', async t => {
    const {page} = await openGame(t,'yut');
    await page.click('#startBtn');
    const board=await page.evaluate(()=>transfer.capture().game);
    board.players.forEach((p,i)=>Object.assign(p,{name:i?'파랑':'빨강',color:i?'#3182ce':'#e53e3e'}));
    const onlineCalls=[];
    await page.route('**/api/yut/**',route=>{
        onlineCalls.push(route.request().url());
        return route.fulfill({json:{ok:true,playerId:'SECRET-PLAYER',playerIndex:0,role:'team',room:{roomId:'SECRET-ROOM',game:board,teamCounts:[1,0]}}});
    });
    await page.click('#newGame'); await page.click('#createRoomBtn');
    await page.locator('#game').waitFor({state:'visible'});
    const snapshot=await page.evaluate(()=>transfer.capture());
    assert.equal(snapshot.mode,'offline-view');
    assert.equal(JSON.stringify(snapshot).includes('SECRET'),false);
    assert.match(await page.evaluate(()=>transfer.canImport()),/온라인.*나간/);
    assert.equal(await page.evaluate(s=>{try{transfer.restore(s);return false;}catch(e){return /온라인/.test(e.message);}},snapshot),true);
    await page.reload();
    snapshot.game.players[0].ai=true;
    await page.evaluate(s=>transfer.restore(transfer.validate(s)),snapshot);
    assert.match(await page.locator('#status').textContent(),/불러온 기록\(오프라인 보기\)/);
    assert.equal(await page.locator('#throwBtn').isDisabled(),true);
    assert.equal(await page.locator('#undoBtn').isDisabled(),true);
    await page.waitForTimeout(1100);
    assert.deepEqual(await page.evaluate(()=>transfer.capture()),snapshot);
    await page.reload();
    assert.match(await page.locator('#status').textContent(),/불러온 기록\(오프라인 보기\)/);
    assert.equal(onlineCalls.length,1);
    await page.click('#transferExitView');
    assert.equal(await page.locator('#setup').isVisible(),true);
    await page.reload();
    assert.equal(await page.locator('#setup').isVisible(),true);
});
test('yut rejects invalid nested state without altering saved board and ignores identity/style fields', async t => {
    const {page} = await openGame(t,'yut');
    await page.selectOption('#ptype1','human'); await page.click('#startBtn');
    const result=await page.evaluate(()=>{
        const good=transfer.capture();transfer.restore(good);
        const before=localStorage.getItem('yut-transfer-save-v1');let rejected=0;
        for(const change of [d=>d.game.players[0].pieces[0].idx=Infinity,d=>d.game.cur=9,
            d=>d.game.players[0].pieces[0].path='__proto__',d=>d.game.pending=[0],
            d=>d.game.log=['x'.repeat(501)],d=>d.history=Array(31).fill(d.game)]){
            const bad=structuredClone(good);change(bad);try{transfer.restore(transfer.validate(bad));}catch(e){if(/[가-힣]/.test(e.message))rejected++;}
        }
        const unchanged=before===localStorage.getItem('yut-transfer-save-v1');
        good.game.players[0].name='<img src=x onerror="window.xss=1">';good.game.players[0].color='url(x)';good.roomId='secret';
        transfer.restore(transfer.validate(good));
        return {rejected,unchanged,safe:!document.querySelector('#players img'),snapshot:transfer.capture()};
    });
    assert.equal(result.rejected,6);assert.equal(result.unchanged,true);assert.equal(result.safe,true);
    assert.equal(JSON.stringify(result.snapshot).includes('secret'),false);
});

for (const name of ['yut','math-level']) test(name+' real shared helper downloads and imports backup using bottom-only controls',async t=>{
    const storage=name==='math-level'?{'math-level-game-v1':progress()}:{};
    const {page,calls}=await openGame(t,name,storage,{},true);
    page.on('dialog',d=>d.accept());
    if(name==='yut'){await page.selectOption('#ptype1','human');await page.click('#startBtn');}
    assert.equal(await page.locator('#game-transfer-panel').count(),1);
    const downloaded=page.waitForEvent('download');await page.click('#game-export-btn');
    const artifact=await downloaded;
    const payload=JSON.parse(fs.readFileSync(await artifact.path(),'utf8'));
    assert.equal(payload.game,name);assert.equal(payload.version,1);
    await page.setInputFiles('#game-import-file',{name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))});
    await page.waitForFunction(()=>document.getElementById('game-transfer-status').textContent==='게임 데이터를 불러왔습니다.');
    await page.reload();
    assert.equal(await page.locator('#game-transfer-panel').count(),1);
    assert.equal(calls.some(c=>c.method==='POST'),false);
});

test('math existing save without transfer settings retains original estimated start level',async t=>{
    const {page}=await openGame(t,'math-level',{'math-level-game-v1':progress()});
    assert.equal(await page.locator('#startLevel').inputValue(),'7');
});
