'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'/tmp/note-modal-browser/node_modules/playwright');
const root=path.join(__dirname,'..');
const deviceId='12345678-1234-4123-8123-123456789abc';
test('device metadata cards show labels, legacy fallback and advisory safely at mobile and desktop widths',async t=>{
 const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const malicious='<img src=x onerror="window.pwned=true">'+'x'.repeat(400);
 const events=[{browser:'Chrome 142.0',os:'Windows 11',deviceId},{},{browser:malicious,os:malicious,deviceId:malicious}];
 await page.route('http://device-fixture.test/**',route=>{
  const url=new URL(route.request().url());
  if(url.pathname.startsWith('/api/'))return route.fulfill({json:url.pathname==='/api/security-audit'?{events}:url.searchParams.get('action')==='login'?{token:'fixture-token'}:{notes:[],rooms:['default'],noteRooms:['default']}});
  const file=url.pathname==='/'?'detail-admin-jik-2026.html':url.pathname.slice(1);
  return ['detail-admin-jik-2026.html','note-password-admin.js'].includes(file)?route.fulfill({contentType:file.endsWith('.js')?'text/javascript':'text/html',body:fs.readFileSync(path.join(root,file),'utf8')}):route.fulfill({status:404,body:''});
 });
 await page.goto('http://device-fixture.test/');
 await page.locator('#note-admin-login input').fill('fixture-only');await page.locator('#note-admin-login button').click();
 const cards=page.locator('#security-audit-list .security-event');await cards.first().waitFor();
 async function fields(card){return card.locator('dl').evaluate(el=>Object.fromEntries([...el.querySelectorAll('dt')].map(dt=>[dt.textContent,dt.nextElementSibling.textContent])));}
 const current=await fields(cards.nth(0));assert.equal(current['브라우저'],'Chrome 142.0');assert.equal(current['OS'],'Windows 11');assert.equal(current['기기 ID'],deviceId);
 const legacy=await fields(cards.nth(1));for(const label of ['브라우저','OS','기기 ID'])assert.equal(legacy[label],'미수집');
 const hostile=await fields(cards.nth(2));for(const label of ['브라우저','OS','기기 ID'])assert.equal(hostile[label],malicious);
 assert.equal(await cards.locator('img,script').count(),0);assert.equal(await page.evaluate(()=>window.pwned),undefined);
 const advisory=page.locator('#security-device-advisory');await advisory.waitFor({state:'visible'});
 assert.match(await advisory.textContent(),/MAC.*아닙니다/);assert.match(await advisory.textContent(),/쿠키.*삭제.*다른 브라우저/);assert.match(await advisory.textContent(),/위조.*신원.*증명/);
 for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});await cards.locator('summary').first().click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`no horizontal overflow at ${width}`);}
 assert.deepEqual(errors,[]);
});
