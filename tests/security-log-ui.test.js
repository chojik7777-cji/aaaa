'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('/tmp/note-modal-browser/node_modules/playwright');
const root=path.join(__dirname,'..');
async function fixture(t){
  const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:375,height:812}}),calls=[],errors=[];
  const state={status:200,events:[{id:'event-1',time:'2026-10-19T01:00:00Z',timeKst:'2026-10-19 10:00:00',ip:'203.0.113.5',ipSource:'cf-connecting-ip',peerIp:'127.0.0.1',page:'/note.html',endpoint:'/api/note',room:'default',count:5,userAgent:'<img src=x onerror="window.pwned=true">',type:'password_failure_threshold'}]};
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://security-fixture.test/**',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.pathname.startsWith('/api/')){
      calls.push({url:url.pathname,action:url.searchParams.get('action'),headers:req.headers(),body:req.postData()});
      let status=200,data={ok:true};
      if(url.pathname==='/api/security-audit'){status=state.status;data={ok:status===200,events:state.events,code:state.code};if(state.wait)await state.wait;}
      else if(url.searchParams.get('action')==='login')data={token:'fixture-admin-token'};
      else data={notes:[],rooms:['default'],noteRooms:['default']};
      return route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    }
    const file=url.pathname==='/'?'detail-admin-jik-2026.html':url.pathname.slice(1);
    if(['detail-admin-jik-2026.html','note-password-admin.js'].includes(file))return route.fulfill({contentType:file.endsWith('.js')?'text/javascript':'text/html',body:fs.readFileSync(path.join(root,file),'utf8')});
    return route.fulfill({status:404,body:''});
  });
  await page.goto('http://security-fixture.test/');
  async function login(){await page.locator('#note-admin-login input').fill('fixture-password');await page.locator('#note-admin-login button').click();await page.waitForFunction(()=>!document.querySelector('#note-admin-login button').disabled);}
  return {page,calls,errors,state,login};
}
test('authenticated security cards auto-load safely on mobile and clear on logout',async t=>{
  const {page,calls,errors,login}=await fixture(t);
  assert.equal(await page.locator('#security-audit').count(),1,'security audit section exists');
  assert.equal(await page.locator('#security-audit').isHidden(),true);
  assert.equal(calls.filter(c=>c.url==='/api/security-audit').length,0);
  await login();
  await page.locator('#security-audit-list .security-event').waitFor();
  assert.equal(await page.locator('#security-audit').evaluate(el=>el.closest('#note-admin-panel')!==null),true);
  assert.match(await page.locator('#security-audit').textContent(),/15분.*동일 IP.*페이지.*방.*연속.*5회 이상/);
  const text=await page.locator('#security-audit-list').textContent();
  for(const value of ['2026-10-19 10:00:00','203.0.113.5','/note.html','default','5','cf-connecting-ip'])assert.ok(text.includes(value),value);
  assert.equal(await page.locator('#security-audit-list details').count(),1);
  assert.equal(await page.locator('#security-audit-list img').count(),0);
  assert.ok(text.includes('<img src=x'));
  assert.equal(await page.evaluate(()=>window.pwned),undefined);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const request=calls.find(c=>c.url==='/api/security-audit');assert.equal(request.headers.authorization,'Bearer fixture-admin-token');assert.equal(request.body,null);
  assert.ok(calls.some(c=>c.action==='status'),'existing note refresh still runs');
  assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage})), '{}');
  await page.locator('#note-admin-logout').click();
  assert.equal(await page.locator('#security-audit-list').textContent(),'');assert.equal(await page.locator('#security-audit-status').textContent(),'');
  assert.equal(await page.locator('#security-audit').isHidden(),true);assert.deepEqual(errors,[]);
});
test('manual refresh handles empty events, local-only 503 and expired 401 without disturbing notes',async t=>{
  const {page,state,login,errors}=await fixture(t);await login();
  const button=page.locator('#security-audit-refresh'),status=page.locator('#security-audit-status');
  await page.locator('#security-audit-list .security-event').waitFor();
  async function refresh(){await button.click();await page.waitForFunction(()=>!document.querySelector('#security-audit-refresh').disabled);}
  state.events=[];await refresh();assert.match(await status.textContent(),/기록이 없습니다/);
  state.status=503;state.code='LOCAL_ONLY';await refresh();assert.match(await status.textContent(),/로컬.*터널/);
  state.code=undefined;await refresh();assert.match(await status.textContent(),/저장소.*장애/);assert.doesNotMatch(await status.textContent(),/전용/);
  assert.equal(await page.locator('#note-admin-panel').isVisible(),true);
  assert.match(await page.locator('#note-admin-message').textContent(),/인증이 완료/);
  state.status=401;await refresh();
  assert.equal(await page.locator('#note-admin-panel').isHidden(),true);
  assert.equal(await page.locator('#security-audit-list').textContent(),'');assert.equal(await status.textContent(),'');
  assert.match(await page.locator('#note-admin-message').textContent(),/다시 로그인/);assert.deepEqual(errors,[]);
});
test('late audit response cannot restore sensitive cards after logout',async t=>{
  const {page,state,login,errors}=await fixture(t);await login();await page.locator('#security-audit-list .security-event').waitFor();
  let release;state.wait=new Promise(resolve=>{release=resolve;});
  const pending=page.waitForRequest('**/api/security-audit');await page.locator('#security-audit-refresh').click();await pending;
  await page.locator('#note-admin-logout').click();const response=page.waitForResponse('**/api/security-audit');release();await response;
  await page.waitForLoadState('networkidle');assert.equal(await page.locator('#security-audit-list').textContent(),'');
  assert.equal(await page.locator('#security-audit-status').textContent(),'');assert.equal(await page.locator('#note-admin-panel').isHidden(),true);assert.deepEqual(errors,[]);
});
test('backend peer/outcome fields are shown in request details',async t=>{
  const {page,state,login}=await fixture(t);state.events=[{time:'2026-10-19T01:00:00Z',ip:'203.0.113.5',peer:'127.0.0.9',outcome:'failure',page:'note.html',room:null,count:5,ipSource:'socket'}];
  await login();await page.locator('#security-audit-list .security-event').waitFor();
  const text=await page.locator('#security-audit-list').textContent();assert.ok(text.includes('127.0.0.9'));assert.ok(text.includes('failure'));
});
test('detail admin dashboard authentication includes the clicked target page',async t=>{
  const {page}=await fixture(t);page.once('dialog',dialog=>dialog.accept('fixture-dashboard-password'));
  const request=page.waitForRequest('**/api/dashboard-auth');await page.locator('a[href="baduk-dashboard.html"]').click();
  const body=(await request).postDataJSON();assert.equal(body.page,'baduk-dashboard.html');
});
