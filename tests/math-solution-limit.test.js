'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'/tmp/note-modal-browser/node_modules/playwright');const root=path.resolve(__dirname,'..');
test('last permitted question stays readable during status polls; only explicit next asks for password',async t=>{
 const browser=await chromium.launch({headless:true});t.after(()=>browser.close());const page=await browser.newPage();await page.route('**/*',r=>{const p=new URL(r.request().url()).pathname;if(p.startsWith('/api/'))return r.fulfill({json:{ok:true,locked:false,questionLimit:1,version:4}});return r.fulfill({contentType:p.endsWith('.js')?'text/javascript':'text/html',body:fs.readFileSync(path.join(root,p))});});
 await page.goto('http://limit-review.test/math-level.html');await page.waitForFunction(()=>lastControlVersion===4);await page.click('#startBtn');
 const answer=await page.evaluate(()=>current.answer);await page.locator('#choiceGrid button[data-choice="'+answer+'"]').click();
 await page.evaluate(()=>applyMathControl({ok:true,locked:false,questionLimit:1,version:4}));
 assert.equal(await page.locator('#questionLimitOverlay').evaluate(e=>e.classList.contains('show')),false,'마지막 허용 문제의 풀이를 읽는 중에는 제한 창을 띄우지 않습니다');
 await page.click('#solutionBtn');assert.equal(await page.locator('#solutionPanel').isVisible(),true);await page.click('#nextProblemBtn');
 assert.equal(await page.locator('#questionLimitOverlay').evaluate(e=>e.classList.contains('show')),true);assert.equal(await page.evaluate(()=>state.asked),1);
});
