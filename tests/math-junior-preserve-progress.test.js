'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('/tmp/note-modal-browser/node_modules/playwright');
const root=path.resolve(__dirname,'..');
test('junior quota is shared without changing any middle/high progress fields',async t=>{
 const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
 const page=await browser.newPage();
 const legacy={practiceMode:'grade',gradeLevel:10,theta:10,nextLevel:10,asked:2,correct:2,streak:2,uncertainty:2,history:[]};
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.pathname==='/api/math-control')return route.fulfill({json:{ok:true,locked:false,version:1,questionLimit:3}});
  if(['/math-junior.html','/math-junior-problems.js','/math-level.html','/math-problems.js','/game-transfer.js'].includes(u.pathname))return route.fulfill({body:fs.readFileSync(path.join(root,u.pathname)),contentType:u.pathname.endsWith('.js')?'application/javascript':'text/html'});
  return route.abort();
 });
 await page.goto('http://fixture.local/math-junior.html');
 await page.evaluate(saved=>localStorage.setItem('math-level-game-v1',JSON.stringify(saved)),legacy);
 await page.waitForFunction(()=>controlReady);
 await page.click('#startBtn');
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('math-level-game-v1'))),legacy,'유아·초등 출제가 중·고등 정답률/추정수준 기록을 바꾸면 안 됩니다');
 await page.goto('http://fixture.local/math-level.html');
 await page.waitForFunction(()=>lastControlVersion===1);
 assert.equal(await page.evaluate(()=>shouldShowQuestionLimitLock()),true,'중·고등으로 이동해도 사용한 유아·초등 횟수를 합산해야 합니다');
 assert.equal(await page.evaluate(()=>state.asked),2);
});
