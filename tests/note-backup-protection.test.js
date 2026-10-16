'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {initialize,createFileStore,createService}=require('../server/note-local');
const {createAdminHandler}=require('../server/note-admin');
const {createNoteFolderHandler,resetNoteContent,resetNoteAContent}=require('../note-folder');
const {roomId,requestRoom,existingRoom,listRooms}=require('../server/note-room');

async function fixture(t){
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'note-backup-protection-'))),root=path.join(dir,'note2'),note=path.join(dir,'note');
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 for(const p of [path.join(root,'alpha'),path.join(root,'backup'),path.join(note,'backup')])fs.mkdirSync(p,{recursive:true});
 for(const p of [path.join(root,'backup'),path.join(note,'backup')])fs.writeFileSync(path.join(p,'weekly.zip'),'fixture-archive');
 const env={NOTE_AUTH_FILE:path.join(dir,'private','auth.json'),NOTE_ADMIN_PASSWORD_FILE:path.join(dir,'admin'),NOTE_PASSWORD:'fixture-note-pass',NOTE2_PASSWORD:'fixture-template-pass',NOTE2_DIR:root};
 fs.writeFileSync(env.NOTE_ADMIN_PASSWORD_FILE,'fixture-admin-pass');await initialize(env);
 const service=createService(createFileStore(env),Date.now,{roomRoot:root}),adminToken=await service.login('admin','fixture-admin-pass');
 const saved=Object.fromEntries(['NOTE_AUTH_FILE','NOTE2_DIR','VERCEL'].map(k=>[k,process.env[k]]));
 Object.assign(process.env,{NOTE_AUTH_FILE:env.NOTE_AUTH_FILE,NOTE2_DIR:root,VERCEL:''});
 t.after(()=>{for(const [k,v]of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
 const admin=createAdminHandler(()=>service,{roomRoot:root,noteDir:note}),handlers={note:createNoteFolderHandler(note,{localId:'note'}),note2:createNoteFolderHandler(root,{localId:'note2',roomFolders:true})};
 const server=http.createServer((req,res)=>req.url.startsWith('/api/note-admin')?admin(req,res):handlers[req.url.startsWith('/api/note2/')?'note2':'note'](req,res));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));
 async function call(route,body,headers={}){
  const response=await fetch('http://127.0.0.1:'+server.address().port+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const text=await response.text();let data;try{data=JSON.parse(text);}catch{}
  return {status:response.status,data,text};
 }
 return {dir,root,note,env,service,adminToken,call};
}

test('backup is reserved before auth mutation and excluded from room discovery/admin/create',async t=>{
 const {root,env,service,adminToken,call}=await fixture(t),headers={Authorization:'Bearer '+adminToken};
 assert.throws(()=>roomId('backup'),{status:400});
 assert.throws(()=>requestRoom(new URL('http://fixture/?room=backup')),{status:400});
 assert.throws(()=>requestRoom(new URL('http://fixture/'),{room:'backup'}),{status:400});
 assert.throws(()=>existingRoom(root,'backup'),{status:400});
 assert.deepEqual(listRooms(root),['alpha']);
 const status=await call('/api/note-admin?action=status&room=alpha',undefined,headers);
 assert.equal(status.status,200);assert.deepEqual(status.data.rooms,['alpha']);
 const before=fs.readFileSync(env.NOTE_AUTH_FILE);
 for(const action of ['status','create','rotate','reset-content']){
  const body=action==='status'?undefined:{id:'note2',room:'backup',password:'fixture-next-pass',confirmation:'fixture-next-pass',revision:'fixture-revision'};
  assert.equal((await call('/api/note-admin?action='+action+'&room=backup',body,headers)).status,400,action);
 }
 await assert.rejects(()=>service.createRoom(adminToken,'backup','fixture-next-pass','fixture-next-pass',root),{status:400});
 await assert.rejects(()=>service.login('note2','fixture-template-pass','backup'),{status:400});
 assert.deepEqual(fs.readFileSync(env.NOTE_AUTH_FILE),before,'reserved names must not write credentials or attempt budgets');
 assert.equal(fs.readFileSync(path.join(root,'backup','weekly.zip'),'utf8'),'fixture-archive');
 assert.equal((await call('/api/note-admin?action=create',{room:'beta',password:'fixture-beta-pass',confirmation:'fixture-beta-pass'},headers)).status,201);
 assert.ok(await service.login('note2','fixture-beta-pass','beta'));
});

test('both note APIs reject backup rooms before auth and cannot download archives with unrelated grants',async t=>{
 const {root,note,env,call}=await fixture(t);
 for(const id of ['note','note2']){
  const room=id==='note'?'default':'alpha',password=id==='note'?'fixture-note-pass':'fixture-template-pass';
  const login=await call('/api/'+id+'/login?room='+room,{password});assert.equal(login.status,200);
  const token=login.data.token,headers={'x-note-token':token},before=fs.readFileSync(env.NOTE_AUTH_FILE);
  for(const action of ['login','state','save','upload','delete-file','file'])for(const reserved of ['backup','Backup','BACKUP']){
   const body=['state','file'].includes(action)?undefined:{room:reserved,password,text:'overwrite',name:'attack.txt',id:'weekly.zip',dataUrl:'data:text/plain;base64,eA=='};
   assert.equal((await call('/api/'+id+'/'+action+'?room='+reserved+'&id=weekly.zip',body,headers)).status,400,id+' '+action+' '+reserved);
   if(body)assert.equal((await call('/api/'+id+'/'+action,body,headers)).status,400,id+' body '+action+' '+reserved);
  }
  assert.deepEqual(fs.readFileSync(env.NOTE_AUTH_FILE),before,'rejected backup login must not write auth');
  for(const traversal of ['../backup/weekly.zip','backup/weekly.zip','../../note2/backup/weekly.zip']){
   assert.equal((await call('/api/'+id+'/file?room='+room+'&id='+encodeURIComponent(traversal),undefined,headers)).status,404,id+' traversal '+traversal);
  }
  assert.equal((await call('/api/'+id+'/save?room='+room,{text:'ordinary memo'},headers)).status,200);
  assert.equal((await call('/api/'+id+'/upload?room='+room,{name:'ordinary.txt',dataUrl:'data:text/plain;base64,b3JkaW5hcnk='},headers)).status,200);
  const state=await call('/api/'+id+'/state?room='+room,undefined,headers);
  assert.equal(state.status,200);assert.equal(state.data.text,'ordinary memo');assert.deepEqual(state.data.files.map(f=>f.name),['ordinary.txt']);
  const download=await call('/api/'+id+'/file?room='+room+'&id=ordinary.txt',undefined,headers);
  assert.equal(download.status,200);assert.equal(download.text,'ordinary');
 }
 for(const base of [note,root])assert.equal(fs.readFileSync(path.join(base,'backup','weekly.zip'),'utf8'),'fixture-archive');
});

test('note2 room reset preserves backup directory and cannot reset the reserved root archive',async t=>{
 const {root,env,call,adminToken}=await fixture(t),room=path.join(root,'alpha'),backup=path.join(room,'backup');
 fs.mkdirSync(path.join(backup,'nested'),{recursive:true});fs.writeFileSync(path.join(backup,'nested','weekly.zip'),'room-archive');
 fs.mkdirSync(path.join(room,'attachments'));fs.writeFileSync(path.join(room,'attachments','ordinary.txt'),'remove');
 fs.writeFileSync(path.join(room,'.note-memo.txt'),'remove memo');fs.writeFileSync(path.join(room,'ordinary.txt'),'remove file');
 fs.writeFileSync(path.join(room,'.note-password'),'fixture-legacy');
 const before=fs.readFileSync(env.NOTE_AUTH_FILE);
 resetNoteContent(root,'alpha');
 assert.equal(fs.readFileSync(path.join(backup,'nested','weekly.zip'),'utf8'),'room-archive');
 assert.deepEqual(fs.readdirSync(room).sort(),['.note-meta.json','.note-password','backup']);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(room,'.note-meta.json'))),{version:0,updatedAt:0,updatedBy:'',uploads:{}});
 assert.throws(()=>resetNoteContent(root,'backup'),{status:400});
 fs.writeFileSync(path.join(room,'ordinary.txt'),'remove again');
 assert.equal((await call('/api/note-admin?action=reset-content',{id:'note2',room:'alpha'},{Authorization:'Bearer '+adminToken})).status,200);
 assert.equal(fs.existsSync(path.join(room,'ordinary.txt')),false);
 assert.equal(fs.readFileSync(path.join(backup,'nested','weekly.zip'),'utf8'),'room-archive');
 assert.equal(fs.readFileSync(path.join(root,'backup','weekly.zip'),'utf8'),'fixture-archive');
 assert.deepEqual(fs.readFileSync(env.NOTE_AUTH_FILE),before);
});

test('note A reset keeps backup archives and other room directories while clearing its content',async t=>{
 const {note,env,call,adminToken}=await fixture(t);
 fs.mkdirSync(path.join(note,'other-room'));fs.writeFileSync(path.join(note,'other-room','keep.txt'),'room-content');
 const before=fs.readFileSync(env.NOTE_AUTH_FILE);
 for(const reset of [()=>resetNoteAContent(note),async()=>assert.equal((await call('/api/note-admin?action=reset-content',{id:'note',room:'default'},{Authorization:'Bearer '+adminToken})).status,200)]){
  fs.writeFileSync(path.join(note,'.note-memo.txt'),'remove memo');fs.writeFileSync(path.join(note,'ordinary.txt'),'remove file');
  await reset();
  assert.equal(fs.readFileSync(path.join(note,'backup','weekly.zip'),'utf8'),'fixture-archive');
  assert.equal(fs.readFileSync(path.join(note,'other-room','keep.txt'),'utf8'),'room-content');
  assert.deepEqual(fs.readdirSync(note).sort(),['.note-meta.json','backup','other-room']);
 }
 assert.deepEqual(fs.readFileSync(env.NOTE_AUTH_FILE),before);
});
