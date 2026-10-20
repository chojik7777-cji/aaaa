'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_PATH||'/tmp/note-modal-browser/node_modules/playwright');
const root=path.resolve(__dirname,'..');
async function open(t,engine=chromium){
 const browser=await engine.launch({headless:true});t.after(()=>browser.close());
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname.startsWith('/api/'))return r.fulfill({json:{ok:true,locked:false,version:1,questionLimit:0}});
 const p=path.join(root,u.pathname);if(fs.existsSync(p)&&fs.statSync(p).isFile())return r.fulfill({contentType:p.endsWith('.js')?'application/javascript':'text/html',body:fs.readFileSync(p)});return r.fulfill({status:404,body:''});});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://fixture.local/math-level.html');return {page,errors};
}
test('fixed grade stays within selected high1 across correct/incorrect answers and reload',async t=>{
 const {page,errors}=await open(t);
 assert.equal(await page.locator('#practiceMode').count(),1,'출제 방식 선택이 필요합니다');
 await page.selectOption('#practiceMode','grade');await page.selectOption('#startLevel','10');await page.click('#startBtn');
 const levels=await page.evaluate(()=>{const out=[];for(let i=0;i<120;i++){state.theta=i%2?18:1;state.asked=i;state.streak=i%2?8:-8;out.push(chooseNextLevel());}saveState();return out;});
 assert(levels.every(x=>x>=10&&x<=12));assert.equal(new Set(levels).size,3);
 await page.reload();await page.evaluate(()=>render());assert.equal(await page.evaluate(()=>state.practiceMode),'grade');assert.match(await page.locator('#analysisText').innerText(),/학년 고정/);assert.equal(await page.evaluate(()=>state.gradeLevel),10);assert.equal(await page.inputValue('#startLevel'),'10');
 const snapshot=await page.evaluate(()=>window.GameTransfer?validateMathTransfer({progress:state,startLevel:10}):null);assert.equal(snapshot.progress.practiceMode,'grade');
 await page.evaluate(s=>{s.progress.practiceMode='bad';window.bad=s;},snapshot);
 assert.equal(await page.evaluate(()=>{try{validateMathTransfer(window.bad);return false}catch{return true}}),true);
 assert.deepEqual(errors,[]);
});

for(const [name,engine] of [['Chromium',chromium],['WebKit',webkit]]) test(name+' every fixed grade is bounded, adaptive still moves, mobile stays in viewport',async t=>{
 const {page,errors}=await open(t,engine);
 const results=await page.evaluate(()=>{
  const out=[];
  for(let start=1;start<=18;start++){
   state=newState(start,'grade');const levels=[];
   for(let i=0;i<30;i++){state.asked=i;state.theta=i%2?18:1;levels.push(chooseNextLevel());}
   const first=Math.floor((start-1)/3)*3+1;out.push(levels.every(x=>x>=first&&x<=first+2)&&levels[0]===start&&new Set(levels).size===3);
  }
  state=newState(10);state.asked=20;state.theta=17;state.uncertainty=0.45;const adaptive=chooseNextLevel();
  return {out,adaptive,overflow:document.documentElement.scrollWidth>innerWidth};
 });
 assert(results.out.every(Boolean));assert.equal(results.adaptive,17);assert.equal(results.overflow,false);assert.deepEqual(errors,[]);
});

test('game uses varied generator with unique correct choices for all levels',async t=>{
 const {page,errors}=await open(t);
 const report=await page.evaluate(()=>{
  const rows=[];
  document.getElementById('gamePanel').hidden=false;
  for(let level=1;level<=18;level++){
   const samples=Array.from({length:36},()=>generateProblem(level));
   const fits = samples.every(q=>{document.getElementById('questionText').textContent=q.text;return document.documentElement.scrollWidth<=innerWidth;});
   rows.push({level,fits,types:new Set(samples.map(q=>q.templateId)).size,
    valid:samples.every(q=>Number.isFinite(q.answer)&&q.choices.length===4&&q.choices.filter(c=>c.correct).length===1&&new Set(q.choices.map(c=>c.label)).size===4),
    noRepeat:samples.every((q,i)=>i===0||q.templateId!==samples[i-1].templateId)});
  }
  return rows;
 });
 for(const row of report){assert(row.types>=(row.level===15?6:4),'레벨 '+row.level+' 유형 부족');assert(row.valid,'보기/정답 오류 '+row.level);assert(row.fits,'모바일 가로 넘침 '+row.level);assert(row.noRepeat,'연속 중복 '+row.level);}
 assert.deepEqual(errors,[]);
});

test('fixed grade resume constrains imported or stale nextLevel before showing a problem',async t=>{
 const {page}=await open(t);
 const level=await page.evaluate(()=>{state=newState(10,'grade');state.nextLevel=18;nextProblem(true);return current.level;});
 assert(level>=10&&level<=12,'복원 직후에도 고1만 출제해야 합니다');
});

test('reload waits for actual server question limit instead of locking at stale default five',async t=>{
 const {page}=await open(t);
 await page.evaluate(()=>{state=newState(10,'grade');state.asked=6;state.correct=6;saveState();});
 await page.reload();await page.waitForFunction(()=>lastControlVersion!==null);
 assert.equal(await page.locator('#questionLimitOverlay').evaluate(e=>e.classList.contains('show')),false,'서버 제한 0인데 임시 기본값 5로 잠기면 안 됩니다');
 assert.equal(await page.evaluate(()=>current.level),10);
});

test('rounded fractional choices explicitly tell students the rounding rule',async t=>{
 const {page}=await open(t);
 const checks=await page.evaluate(()=>Array.from({length:24},()=>generateProblem(4)).filter(q=>Math.abs(q.answer-Math.round(q.answer*100)/100)>1e-9).map(q=>q.hint.includes('소수 셋째 자리에서 반올림')));
 assert(checks.length>0);assert(checks.every(Boolean));
});
