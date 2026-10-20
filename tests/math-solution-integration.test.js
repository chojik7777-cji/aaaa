'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_PATH||'/tmp/note-modal-browser/node_modules/playwright');const root=path.resolve(__dirname,'..');
for(const [name,engine] of [['Chromium',chromium],['WebKit',webkit]]) test(name+' real explanations render all 74 templates below the button without changing records',async t=>{
 const browser=await engine.launch({headless:true});t.after(()=>browser.close());const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.route('**/*',route=>{const p=new URL(route.request().url()).pathname;if(p.startsWith('/api/'))return route.fulfill({json:{ok:true,locked:false,questionLimit:0,version:7}});const file=path.join(root,p);if(!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({contentType:p.endsWith('.js')?'text/javascript':'text/html',body:fs.readFileSync(file)});});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://solutions.test/math-level.html');await page.waitForFunction(()=>lastControlVersion!==null);
 assert.equal(await page.locator('#solutionBtn').count(),1,'풀이과정 버튼이 필요합니다');
 const results=await page.evaluate(()=>{
  document.getElementById('setupPanel').hidden=true;document.getElementById('gamePanel').hidden=false;const results=[];
  for(let level=1;level<=18;level++){
   state=newState(level);const seen=new Set();
   for(let n=0;n<(level===15?6:4);n++){
    nextProblem(true);const id=current.templateId;seen.add(id);const before=JSON.stringify(state);
    document.getElementById('solutionBtn').click();const panel=document.getElementById('solutionPanel');const button=document.getElementById('solutionBtn');
    results.push({level,id,hasSteps:Array.isArray(current.solutionSteps)&&current.solutionSteps.length>=3,allShown:current.solutionSteps?.every(s=>panel.textContent.includes(s)),shown:!panel.hidden,unchanged:JSON.stringify(state)===before,below:panel.getBoundingClientRect().top>=button.getBoundingClientRect().bottom,overflow:document.documentElement.scrollWidth>innerWidth,text:panel.textContent});
    button.click();
   }
  }
  return results;
 });
 assert.equal(new Set(results.map(r=>r.id)).size,74);
 for(const r of results){assert(r.hasSteps,r.id+' detailed steps');assert(r.allShown,r.id+' real steps rendered');assert(r.shown,r.id+' visible');assert(r.unchanged,r.id+' records changed');assert(r.below,r.id+' must be below button');assert.equal(r.overflow,false,r.id+' horizontal overflow');assert.doesNotMatch(r.text,/undefined|NaN|준비 중/);}
 assert.deepEqual(errors,[]);
});
