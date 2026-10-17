'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('/tmp/note-modal-browser/node_modules/playwright');
const root=path.join(__dirname,'..');
async function fixture(t){
  const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
  const page=await browser.newPage(),calls=[],errors=[],noteRooms=['default','legacy-room'];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://note-fixture.test/**',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.pathname==='/api/note-admin'){
      const action=url.searchParams.get('action'),room=url.searchParams.get('room'),body=request.postDataJSON();calls.push({action,room,body});
      let data={ok:true},status=200;
      if(action==='login')data={token:'fixture-admin-token'};
      if(action==='status')data={rooms:['default','beta'],noteRooms:[...noteRooms],notes:[{id:'note',...(room==='default'?{}:{room}),revision:'a-'+room,updatedAt:0},{id:'note2',room,revision:'b-'+room,updatedAt:0}]};
      if(action==='create'){
        if(noteRooms.includes(room)){status=409;data={error:'이미 등록된 방입니다.'};}
        else noteRooms.push(room);
      }
      await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});return;
    }
    const file=url.pathname==='/detail-admin-jik-2026.html'?'detail-admin-jik-2026.html':url.pathname==='/note-password-admin.js'?'note-password-admin.js':null;
    if(file)await route.fulfill({contentType:file.endsWith('.js')?'text/javascript':'text/html',body:fs.readFileSync(path.join(root,file),'utf8')});
    else await route.fulfill({status:404,body:'fixture only'});
  });
  await page.goto('http://note-fixture.test/detail-admin-jik-2026.html');
  const login=page.locator('#note-admin-login');await login.locator('input').fill('fixture-password');await login.locator('button').click();
  await page.locator('#note-admin-panel').waitFor({state:'visible'});
  return {page,calls,errors};
}
async function credentials(form,password){await form.locator('[name=password]').fill(password);await form.locator('[name=confirmation]').fill(password);}
async function settled(page){await page.waitForFunction(()=>!document.querySelector('#note-admin-refresh').disabled);}

test('actual browser: note A list → own-password create → selected-room rotation → note B → logout',async t=>{
  const {page,calls,errors}=await fixture(t),list=page.locator('#note-a-room-list'),form=page.locator('#note-password-form');
  assert.equal(await list.count(),1,'note A must have its own authenticated room list');
  assert.deepEqual(await list.locator('strong').allTextContents(),['default','legacy-room']);
  for(const room of ['default','legacy-room']){
    const link=list.locator('.room-card').filter({hasText:room}).locator('a');
    assert.equal(await link.getAttribute('href'),'note.html?room='+encodeURIComponent(room));
    assert.equal(await link.getAttribute('target'),'_blank');assert.match(await link.getAttribute('rel'),/noopener/);
  }
  assert.equal(await list.getByRole('button',{name:'내용·파일 초기화',exact:true}).count(),0);
  await form.locator('[name=id]').selectOption('note2');await settled(page);
  const create=page.locator('#note-a-create-form');await create.locator('[name=room]').fill('new-a');await credentials(create,'new-a-password');
  page.once('dialog',d=>d.accept());await create.getByRole('button',{name:'새 방 생성',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#note-a-room-list').textContent.includes('new-a'));
  assert.deepEqual(calls.find(c=>c.action==='create'),{action:'create',room:'new-a',body:{id:'note',room:'new-a',password:'new-a-password',confirmation:'new-a-password'}});
  assert.equal(await form.locator('[name=id]').inputValue(),'note');assert.equal(await form.locator('[name=room]').inputValue(),'new-a');
  assert.match(await page.locator('#note2-room-field').textContent(),/노트 A 방 선택/);
  assert.equal(await create.locator('[name=password]').inputValue(),'');assert.equal(await create.locator('[name=confirmation]').inputValue(),'');
  await list.locator('.room-card').filter({hasText:'legacy-room'}).getByRole('button').click();await settled(page);
  await credentials(form,'legacy-new-password');page.once('dialog',d=>d.accept());await form.getByRole('button').click();
  await page.waitForFunction(()=>document.querySelector('#note-admin-message').textContent.includes('비밀번호가 변경'));
  assert.deepEqual(calls.filter(c=>c.action==='rotate'),[{action:'rotate',room:'legacy-room',body:{id:'note',room:'legacy-room',password:'legacy-new-password',confirmation:'legacy-new-password',revision:'a-legacy-room'}}]);
  await page.locator('#note-a-select-password').click();await settled(page);assert.equal(await form.locator('[name=room]').inputValue(),'default');
  await form.locator('[name=id]').selectOption('note2');await settled(page);
  await page.locator('#note2-room-list .room-card').filter({hasText:'beta'}).getByRole('button',{name:'이 방 선택 / 비밀번호 변경'}).click();await settled(page);
  assert.equal(await form.locator('[name=id]').inputValue(),'note2');assert.equal(await form.locator('[name=room]').inputValue(),'beta');
  assert.deepEqual(await page.locator('#note2-rooms option').evaluateAll(items=>items.map(i=>i.value)),['default','beta']);
  await credentials(create,'unsubmitted-secret');await page.locator('#note-admin-logout').click();
  assert.equal(await list.textContent(),'');assert.equal(await page.locator('#note2-room-list').textContent(),'');
  assert.equal(await create.locator('[name=password]').inputValue(),'');assert.equal(await page.locator('#note-password-status').textContent(),'');
  assert.equal(await page.locator('#note-admin-panel').isHidden(),true);assert.deepEqual(errors,[]);
});

test('actual browser: note A create validation and cancellation send no writes',async t=>{
  const {page,calls,errors}=await fixture(t),create=page.locator('#note-a-create-form');
  const submit=()=>create.getByRole('button',{name:'새 방 생성',exact:true}).click();
  await create.locator('[name=room]').fill('legacy-room');await credentials(create,'fixture-password');await submit();
  assert.match(await page.locator('#note-admin-message').textContent(),/이미 등록된 방/);
  await create.locator('[name=room]').fill('fresh-room');await create.locator('[name=confirmation]').fill('different-password');await submit();
  assert.match(await page.locator('#note-admin-message').textContent(),/일치하지/);
  await credentials(create,'가'.repeat(86));await submit();assert.match(await page.locator('#note-admin-message').textContent(),/256바이트/);
  await credentials(create,'fixture-password');page.once('dialog',d=>d.dismiss());await submit();
  assert.equal(calls.filter(c=>c.action==='create').length,0);assert.equal(await create.locator('[name=password]').inputValue(),'fixture-password');assert.deepEqual(errors,[]);
});

test('actual browser: late authenticated status cannot restore rooms after logout',async t=>{
  const {page,errors}=await fixture(t);let release,seen;
  const pending=new Promise(r=>{seen=r;});
  await page.route('**/api/note-admin?**',async route=>{
    if(new URL(route.request().url()).searchParams.get('action')!=='status')return route.fallback();
    seen();await new Promise(r=>{release=r;});
    await route.fulfill({contentType:'application/json',body:JSON.stringify({noteRooms:['default','private-late-room'],rooms:['private-b'],notes:[]})});
  });
  await page.locator('#note-admin-refresh').click();await pending;
  await page.locator('#note-admin-logout').click();release();await settled(page);
  assert.equal(await page.locator('#note-a-room-list').textContent(),'');assert.equal(await page.locator('#note2-room-list').textContent(),'');
  assert.equal(await page.locator('#note2-rooms option').count(),0);assert.equal(await page.locator('#note-admin-panel').isHidden(),true);assert.deepEqual(errors,[]);
});
