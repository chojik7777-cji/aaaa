'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {initialize,createFileStore,createService}=require('../server/note-local');
const {createAdminHandler}=require('../server/note-admin');
const {createNoteFolderHandler}=require('../note-folder');
async function fixture(t){
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'room-delete-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const root=path.join(dir,'b'),noteDir=path.join(dir,'a'),env={NOTE_AUTH_FILE:path.join(dir,'private','auth.json'),NOTE_ADMIN_PASSWORD_FILE:path.join(dir,'admin'),NOTE_PASSWORD:'note-original',NOTE2_PASSWORD:'template-original'};
 fs.writeFileSync(env.NOTE_ADMIN_PASSWORD_FILE,'admin-fixture');await initialize(env);
 for(const base of [root,noteDir])for(const room of ['alpha','other']){const p=path.join(base,room);fs.mkdirSync(path.join(p,'backup'),{recursive:true});fs.writeFileSync(path.join(p,'keep.txt'),'active bytes');fs.writeFileSync(path.join(p,'backup','archive.bin'),Buffer.from([0,1,255,3]));}
 const reload=()=>createService(createFileStore(env),Date.now,{roomRoot:root,noteDir}),service=reload(),token=await service.login('admin','admin-fixture');
 const handler=createAdminHandler(()=>service,{roomRoot:root,noteDir});
 async function call(action,room,body,auth=token){const raw=body===null?'null':typeof body==='string'?body:undefined;const req=Object.assign(require('node:stream').Readable.from(raw===undefined?[]:[Buffer.from(raw)]),{method:body===undefined?'GET':'POST',url:'/api/note-admin?action='+action+'&room='+encodeURIComponent(room),headers:{authorization:auth?'Bearer '+auth:''},body,socket:{remoteAddress:'127.0.0.1'}});const res={setHeader(){},end(v){this.data=JSON.parse(v);}};await handler(req,res);return {status:res.statusCode,data:res.data};}
 const revision=async(id,room='alpha')=>(await service.status(token,room)).find(r=>r.id===id).revision;
 return {env,root,noteDir,service,token,reload,call,revision};
}
test('public handlers deny deleted physical rooms before credential attempts, including legacy grants after reload',async t=>{
 for(const id of ['note','note2'])await t.test(id,async t=>{
  const f=await fixture(t),password=id==='note'?'note-original':'template-original',token=await f.service.login(id,password,'alpha');
  async function publicCall(handler,action,body,grant=token){
   const req={method:body===undefined?'GET':'POST',url:'/api/'+id+'/'+action+'?room=alpha',headers:{'x-note-token':grant},body,socket:{remoteAddress:'127.0.0.1'}};
   const res={setHeader(){},end(v){this.data=JSON.parse(v);}};await handler(req,res);return {status:res.statusCode,data:res.data};
  }
  const handler=()=>createNoteFolderHandler(id==='note'?f.noteDir:f.root,{localId:id,roomFolders:id==='note2',getService:f.reload});
  const h=handler();assert.equal((await publicCall(h,'state')).status,200);
  // Legacy unscoped note A HMAC remains valid only before tombstoning.
  const row=JSON.parse(fs.readFileSync(f.env.NOTE_AUTH_FILE,'utf8')).rows[id],payload=Buffer.from(JSON.stringify({id,revision:row.revision})).toString('base64url');
  const legacy=payload+'.'+require('node:crypto').createHmac('sha256',row.token_key).update(payload).digest('hex');
  if(id==='note')assert.equal(await f.service.tokenOk(id,legacy,'alpha'),true);
  assert.equal((await f.call('delete-room','alpha',{id,room:'alpha',confirmation:'alpha',revision:await f.revision(id)})).status,200);
  for(const current of [h,handler()]){
   for(let n=0;n<7;n++)assert.equal((await publicCall(current,'login',{password})).status,401);
   for(const action of ['state','file'])assert.equal((await publicCall(current,action)).status,401);
   assert.equal((await publicCall(current,'save',{text:'must not write'})).status,401);
   assert.equal((await publicCall(current,'state',undefined,legacy)).status,401);
  }
  assert.equal((await f.call('reset-content','alpha',{id,room:'alpha'})).status,404);
  assert.equal(fs.readFileSync(path.join(id==='note'?f.noteDir:f.root,'alpha','keep.txt'),'utf8'),'active bytes');
  assert.equal(fs.existsSync(path.join(id==='note'?f.noteDir:f.root,'alpha','.note-memo.txt')),false);
 });
});
test('configured deletion is atomic, CAS-serialized and cannot be undone by create, rotate or default freezing',async t=>{
 for(const id of ['note','note2'])await t.test(id,async t=>{
  const f=await fixture(t),{service,token}=f,store=createFileStore(f.env);
  await service.createRoom(token,'configured','chosen-password','chosen-password',undefined,id);
  const rev=await f.revision(id,'configured'),old=await service.login(id,'chosen-password','configured');
  const race=await Promise.allSettled([service.deleteRoom(token,'configured','configured',rev,id),f.reload().deleteRoom(token,'configured','configured',rev,id)]);
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal(race.find(r=>r.status==='rejected').reason.status,404);
  assert.equal(await store.getRoom('configured',id),null);assert.ok(!await service.tokenOk(id,old,'configured'));
  const data=JSON.parse(fs.readFileSync(f.env.NOTE_AUTH_FILE,'utf8'));
  await assert.rejects(()=>store.createRoom('configured',data.rows[id],()=>false,id),{status:409});
  assert.equal(await store.replaceRoom('configured',data.rows[id].revision,data.rows[id],()=>true,id),false);
  await assert.rejects(()=>service.rotate(token,id,'new-password','new-password',rev,'configured'),{status:404});
  const inheritedRev=await f.revision(id),rotating=service.rotate(token,id,'rotated-password','rotated-password',inheritedRev,'alpha');
  await service.deleteRoom(token,'alpha','alpha',inheritedRev,id);
  const result=await Promise.allSettled([rotating]);assert.equal(result[0].status,'rejected');assert.equal(await store.getRoom('alpha',id),null);
  if(id==='note')await service.rotate(token,id,'default-new-pass','default-new-pass',data.rows.note.revision,'default');
  assert.equal(await store.getRoom('alpha',id),null);
  const status=await f.call('status','other');assert.equal(status.status,200);
  const selected=await f.call('status&id='+id,'alpha');assert.equal(selected.status,404);
  const other=await f.call('status&id='+(id==='note'?'note2':'note'),'alpha');assert.equal(other.status,200);assert.equal(other.data.notes.some(row=>row.id===id),false);
 });
});
test('malformed tombstones fail closed before any credential or token fallback',async t=>{
 const f=await fixture(t),saved=JSON.parse(fs.readFileSync(f.env.NOTE_AUTH_FILE,'utf8')),old=await f.service.login('note2','template-original','alpha');
 for(const deletedRooms of [null,[],{admin:{}},{note2:[]},{note2:null},{note2:{UPPER:{deletedAt:'2026-01-01T00:00:00.000Z'}}},{note:{default:{deletedAt:'2026-01-01T00:00:00.000Z'}}},{note2:{alpha:null}},{note2:{alpha:{deletedAt:123}}},{note2:{alpha:{deletedAt:'bad'}}},JSON.parse('{"note2":{"__proto__":{"deletedAt":"2026-01-01T00:00:00.000Z"}}}')]){
  fs.writeFileSync(f.env.NOTE_AUTH_FILE,JSON.stringify({...saved,deletedRooms}));
  await assert.rejects(()=>f.reload().login('note2','template-original','alpha'),{status:503});
  await assert.rejects(()=>f.reload().tokenOk('note2',old,'alpha'),{status:503});
  assert.equal((await f.call('status','default')).status,503);
 }
});
test('admin delete requires authorization, explicit matching identity, confirmation and current revision',async t=>{
 const f=await fixture(t),rev=await f.revision('note2'),body={id:'note2',room:'alpha',confirmation:'alpha',revision:rev};
 for(const auth of ['', 'bad-token'])assert.equal((await f.call('delete-room','alpha',body,auth)).status,401);
 assert.equal((await f.call('delete-room','UPPER',[], '')).status,401);
 for(const bad of [[],null,'{','42','"text"',{...body,id:'admin'},{...body,id:undefined},{...body,room:'other'},{...body,room:undefined},{...body,confirmation:undefined},{...body,confirmation:'ALPHA'}])assert.equal((await f.call('delete-room','alpha',bad)).status,400);
 assert.equal((await f.call('delete-room','default',{...body,room:'default',confirmation:'default'})).status,400);
 for(const revision of [undefined,'','stale'])assert.equal((await f.call('delete-room','alpha',{...body,revision})).status,409);
 assert.equal((await f.call('delete-room','missing',{...body,room:'missing',confirmation:'missing'})).status,404);
 const before=JSON.parse(fs.readFileSync(f.env.NOTE_AUTH_FILE,'utf8'));
 assert.equal((await f.call('delete-room','alpha',body)).status,200);
 assert.equal((await f.call('delete-room','alpha',body)).status,404);
 const status=await f.call('status','default');assert.equal(status.status,200);assert.ok(!status.data.rooms.includes('alpha'));assert.ok(status.data.noteRooms.includes('alpha'));
 assert.equal((await f.call('status','alpha')).status,404);
 assert.equal((await f.call('reset-content','alpha',{id:'note2',room:'alpha'})).status,404);
 assert.equal((await f.call('rotate','alpha',{...body,password:'new-password',confirmation:'new-password'})).status,404);
 const recreate=await f.call('create','alpha',{id:'note2',room:'alpha',password:'new-password',confirmation:'new-password'});assert.equal(recreate.status,409);assert.match(recreate.data.error,/삭제.*백업.*(예약|사용)/);
 assert.deepEqual(JSON.parse(fs.readFileSync(f.env.NOTE_AUTH_FILE,'utf8')).rows,before.rows);
});
test('logical deletion persists, revokes inherited grants, reserves names and preserves original bytes in each namespace',async t=>{
 for(const id of ['note','note2'])await t.test(id,async t=>{
  const f=await fixture(t),{service,token,env,root,noteDir}=f,otherId=id==='note'?'note2':'note';
  const password=id==='note'?'note-original':'template-original',old=await service.login(id,password,'alpha'),other=await service.login(otherId,otherId==='note'?'note-original':'template-original','alpha');
  assert.equal(await service.tokenOk(id,old,'alpha'),true);
  const before=JSON.parse(fs.readFileSync(env.NOTE_AUTH_FILE,'utf8'));
  await service.deleteRoom(token,'alpha','alpha',await f.revision(id),id);
  const after=JSON.parse(fs.readFileSync(env.NOTE_AUTH_FILE,'utf8'));
  assert.deepEqual(after.rows,before.rows);assert.ok(after.deletedRooms[id].alpha.deletedAt);
  const child=require('node:child_process').spawnSync(process.execPath,['-e',`
   const {createFileStore,createService}=require(${JSON.stringify(require.resolve('../server/note-local'))});
   (async()=>{const s=createService(createFileStore(JSON.parse(process.env.FIXTURE_ENV)));process.stdout.write(JSON.stringify([await s.isRoomDeleted('alpha',process.env.FIXTURE_ID),await s.login(process.env.FIXTURE_ID,process.env.FIXTURE_PASSWORD,'alpha'),await s.tokenOk(process.env.FIXTURE_ID,process.env.FIXTURE_TOKEN,'alpha')]));})().catch(e=>{console.error(e);process.exitCode=1;});
  `],{encoding:'utf8',env:{...process.env,FIXTURE_ENV:JSON.stringify(env),FIXTURE_ID:id,FIXTURE_PASSWORD:password,FIXTURE_TOKEN:old}});
  assert.equal(child.status,0,child.stderr);assert.deepEqual(JSON.parse(child.stdout),[true,null,false]);
  for(const s of [service,f.reload()]){assert.equal(await s.isRoomDeleted('alpha',id),true);assert.equal(await s.login(id,password,'alpha'),null);assert.equal(await s.tokenOk(id,old,'alpha'),false);assert.equal(await s.tokenOk(otherId,other,'alpha'),true);await assert.rejects(()=>s.createRoom(token,'alpha','new-password','new-password',undefined,id),{status:409});}
  for(const base of [root,noteDir]){assert.equal(fs.readFileSync(path.join(base,'alpha','keep.txt'),'utf8'),'active bytes');assert.deepEqual(fs.readFileSync(path.join(base,'alpha','backup','archive.bin')),Buffer.from([0,1,255,3]));}
 });
});
