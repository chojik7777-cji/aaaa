'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require('/tmp/note-modal-browser/node_modules/playwright');
for(const [name,engine]of [['Chromium',chromium],['WebKit',webkit]])test(name+': left and right counting groups remain physically side by side on phones',async t=>{
 const browser=await engine.launch({headless:true});t.after(()=>browser.close());const p=await browser.newPage({viewport:{width:320,height:844}});
 await p.route('**/*',route=>{const u=new URL(route.request().url());if(u.pathname==='/api/math-control')return route.fulfill({json:{ok:true,locked:false,version:1,questionLimit:0}});if(['/math-junior.html','/math-junior-problems.js'].includes(u.pathname))return route.fulfill({body:fs.readFileSync(path.join(__dirname,'..',u.pathname)),contentType:u.pathname.endsWith('.js')?'application/javascript':'text/html'});return route.abort();});
 await p.goto('http://fixture.local/math-junior.html');await p.waitForFunction(()=>controlReady);await p.selectOption('#trackSelect','k-compare');await p.click('#startBtn');
 const groups=await p.locator('#visual span').evaluateAll(es=>es.map(e=>({x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,w:e.getBoundingClientRect().width})));
 assert.equal(groups.length,2);assert(groups[1].x>groups[0].x,'오른쪽은 왼쪽의 오른편에 있어야 합니다');assert(Math.abs(groups[0].y-groups[1].y)<2);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
});
