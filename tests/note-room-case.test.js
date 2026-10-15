'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {initialize,createFileStore,createService}=require('../server/note-local');
const {createNoteFolderHandler}=require('../note-folder');
const {createAdminHandler}=require('../server/note-admin');
const {roomId,existingRoom,listRooms}=require('../server/note-room');

test('room identifiers reject uppercase instead of normalizing',()=>{
 for(const room of ['ALPHA','Alpha','toString'])assert.throws(()=>roomId(room),{status:400});
 for(const room of ['alpha','church','a-z_09'])assert.equal(roomId(room),room);
});

test('real case-insensitive filesystem cannot alias custom alpha with template ALPHA',async t=>{
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'note-room-case-'))),root=path.join(dir,'rooms');
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 fs.mkdirSync(root);fs.mkdirSync(path.join(root,'alpha'));
 if(!fs.existsSync(path.join(root,'ALPHA'))){t.skip('Temporary filesystem is case-sensitive: alpha and ALPHA are distinct; real alias regression requires a case-insensitive filesystem.');return;}
 assert.equal(fs.statSync(path.join(root,'alpha')).ino,fs.statSync(path.join(root,'ALPHA')).ino,'probe must exercise a real physical alias');
 const env={NOTE_AUTH_FILE:path.join(dir,'private','auth.json'),NOTE_ADMIN_PASSWORD_FILE:path.join(dir,'admin'),NOTE_PASSWORD:'test-note-pass',NOTE2_PASSWORD:'test-template-pass'};
 fs.writeFileSync(env.NOTE_ADMIN_PASSWORD_FILE,'test-admin-pass');await initialize(env);
 const service=createService(createFileStore(env)),adminToken=await service.login('admin','test-admin-pass');
 const rev=(await service.status(adminToken,'alpha')).find(n=>n.id==='note2').revision;
 await service.rotate(adminToken,'note2','test-alpha-pass','test-alpha-pass',rev,'alpha');
 fs.writeFileSync(path.join(root,'alpha','.note-memo.txt'),'private-alpha');fs.writeFileSync(path.join(root,'alpha','x.txt'),'private-file');
 const saved=process.env.NOTE_AUTH_FILE;process.env.NOTE_AUTH_FILE=env.NOTE_AUTH_FILE;
 t.after(()=>{if(saved===undefined)delete process.env.NOTE_AUTH_FILE;else process.env.NOTE_AUTH_FILE=saved;});
 const handler=createNoteFolderHandler(root,{localId:'note2',roomFolders:true}),admin=createAdminHandler(()=>service,{roomRoot:root});
 const server=http.createServer((req,res)=>req.url.startsWith('/api/note-admin')?admin(req,res):handler(req,res));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const base='http://127.0.0.1:'+server.address().port;
 async function call(action,room,body,token='',admin=false){const r=await fetch(base+(admin?'/api/note-admin?action=':'/api/note2/')+action+(admin?'&':'?')+'room='+room,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?admin?{Authorization:'Bearer '+token}:{'x-note-token':token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,data:await r.json()};}
 assert.equal((await call('login','alpha',{password:'test-template-pass'})).status,401);
 const alpha=(await call('login','alpha',{password:'test-alpha-pass'})).data.token;assert.ok(alpha);
 assert.equal((await call('login','ALPHA',{password:'test-template-pass'})).status,400,'uppercase must never inherit the template password');
 // Authentic old uppercase template token must also be rejected at every content endpoint.
 const template=await createFileStore(env).get('note2'),payload=Buffer.from(JSON.stringify({id:'note2',room:'ALPHA',revision:template.revision,exp:Date.now()+60000})).toString('base64url');
 const aliasKey=crypto.createHmac('sha256',template.token_key).update('note2-room-v1:ALPHA').digest('hex');
 const alias=payload+'.'+crypto.createHmac('sha256',aliasKey).update(payload).digest('hex');
 for(const token of [alpha,alias])for(const action of ['state','save','upload','delete-file','file']){
  const body=['state','file'].includes(action)?undefined:{room:'ALPHA',text:'overwrite',id:'x.txt',name:'attack.txt',dataUrl:'data:text/plain;base64,eA=='};
  assert.equal((await call(action,'ALPHA',body,token)).status,400,action+' uppercase');
  const r=await fetch(base+'/api/note2/'+action+'?room=ALPHA&id=x.txt&token='+encodeURIComponent(token));assert.equal(r.status,400,action+' query token');await r.text();
 }
 assert.equal((await call('state','alpha',undefined,alias)).status,401);
 assert.equal((await call('state','alpha',undefined,alpha)).data.text,'private-alpha');
 assert.equal(fs.readFileSync(path.join(root,'alpha','x.txt'),'utf8'),'private-file');assert.equal(fs.existsSync(path.join(root,'alpha','attack.txt')),false);
 // A lowercase request must not address an old uppercase physical directory, even with a custom record.
 fs.mkdirSync(path.join(root,'LEGACY'));fs.writeFileSync(path.join(root,'LEGACY','.note-memo.txt'),'legacy-private');
 assert.throws(()=>existingRoom(root,'legacy'),{status:400});assert.equal(listRooms(root).includes('LEGACY'),false);
 assert.equal((await call('login','legacy',{password:'test-template-pass'})).status,400);
 const legacyRev=(await service.status(adminToken,'legacy')).find(n=>n.id==='note2').revision;
 await service.rotate(adminToken,'note2','test-legacy-pass','test-legacy-pass',legacyRev,'legacy');
 const legacy=await service.login('note2','test-legacy-pass','legacy');
 assert.equal((await call('status','alpha',undefined,adminToken,true)).status,400,'discovery must reject customized names that alias uppercase physical folders');
 const authBefore=fs.readFileSync(env.NOTE_AUTH_FILE,'utf8');
 assert.equal((await call('login','legacy',{password:'test-legacy-pass'})).status,400,'custom record must not override physical case mismatch');
 for(const action of ['state','save','upload','delete-file','file']){
  assert.equal((await call(action,'legacy',['state','file'].includes(action)?undefined:{room:'legacy',text:'overwrite',id:'x.txt',name:'attack.txt',dataUrl:'data:text/plain;base64,eA=='},legacy)).status,400,action+' legacy alias');
  const r=await fetch(base+'/api/note2/'+action+'?room=legacy&id=x.txt&token='+encodeURIComponent(legacy));assert.equal(r.status,400);await r.text();
 }
 for(const room of ['ALPHA','legacy']){
  assert.equal((await call('status',room,undefined,adminToken,true)).status,400);
  assert.equal((await call('rotate',room,{id:'note2',room,password:'test-next-pass',confirmation:'test-next-pass',revision:legacyRev},adminToken,true)).status,400);
 }
 assert.equal(fs.readFileSync(env.NOTE_AUTH_FILE,'utf8'),authBefore,'rejected aliases must not create or modify credentials');
 assert.equal(fs.readFileSync(path.join(root,'LEGACY','.note-memo.txt'),'utf8'),'legacy-private');
});

test('uppercase/customized case conflicts fail closed instead of falling back',async t=>{
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'note-room-record-case-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const env={NOTE_AUTH_FILE:path.join(dir,'private','auth.json'),NOTE_ADMIN_PASSWORD_FILE:path.join(dir,'admin'),NOTE_PASSWORD:'test-note-pass',NOTE2_PASSWORD:'test-template-pass'};
 fs.writeFileSync(env.NOTE_ADMIN_PASSWORD_FILE,'test-admin-pass');await initialize(env);
 const service=createService(createFileStore(env)),before=JSON.parse(fs.readFileSync(env.NOTE_AUTH_FILE,'utf8'));
 for(const entries of [{ALPHA:{...before.rows.note2,room:'ALPHA'}},{alpha:{...before.rows.note2,room:'alpha'},ALPHA:{...before.rows.note2,room:'ALPHA'}}]){
  fs.writeFileSync(env.NOTE_AUTH_FILE,JSON.stringify({...before,note2Rooms:entries}));
  await assert.rejects(()=>service.login('note2','test-template-pass','alpha'),{status:503});
  await assert.rejects(()=>service.tokenOk('note2','old-token','alpha'),{status:503});
  assert.throws(()=>createFileStore(env).validate());
 }
});
