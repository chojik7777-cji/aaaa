'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createNoteFolderHandler,resetNoteAContent,resetNoteContent}=require('../note-folder');
const {initialize,createService,createFileStore}=require('../server/note-local');
const {createAdminHandler}=require('../server/note-admin');

test('archive helper rejects unsafe directories/names, tightens permissions and never follows colliding links',t=>{
 const tmp=temp(t),{preserveUploadCopy}=require('../server/note-upload-backup'),outside=path.join(tmp,'outside');fs.mkdirSync(outside);
 for(const kind of ['link','file']){
  const dir=path.join(tmp,kind);fs.mkdirSync(dir);
  if(kind==='link')fs.symlinkSync(outside,path.join(dir,'backup'));else fs.writeFileSync(path.join(dir,'backup'),'keep');
  assert.throws(()=>preserveUploadCopy(dir,'photo.png',Buffer.from('blocked')));
 }
 assert.deepEqual(fs.readdirSync(outside),[]);
 const source=path.join(tmp,'source');fs.mkdirSync(source);const link=path.join(tmp,'source-link');fs.symlinkSync(source,link);
 assert.throws(()=>preserveUploadCopy(link,'photo.png',Buffer.from('blocked')));
 const dir=path.join(tmp,'safe');fs.mkdirSync(dir);fs.mkdirSync(path.join(dir,'backup'),{mode:0o755});
 for(const name of ['../escape','/escape','.note-password','a/b','a\\\\b',''])assert.throws(()=>preserveUploadCopy(dir,name,Buffer.from('bad')),name);
 const target=path.join(outside,'target');fs.writeFileSync(target,'keep');fs.symlinkSync(target,path.join(dir,'backup','photo_20261016_195530.png'));
 const archived=preserveUploadCopy(dir,'photo.png',Buffer.from('safe'),new Date('2026-10-16T19:55:30+09:00'));
 assert.equal(path.basename(archived),'photo_20261016_195530_001.png');assert.equal(fs.readFileSync(target,'utf8'),'keep');assert.ok(fs.lstatSync(path.join(dir,'backup','photo_20261016_195530.png')).isSymbolicLink());
 assert.equal(fs.statSync(path.join(dir,'backup')).mode&0o777,0o700);
 // macOS /var is an OS-level alias, not a room escape.
 const alias=path.join(os.tmpdir(),path.basename(tmp),'safe');assert.ok(preserveUploadCopy(alias,'alias.txt',Buffer.from('alias')));
});

for(const id of ['note','note2'])test(`${id} archive obstruction fails before active publication/metadata, authentication and rooms stay isolated`,async t=>{
 const f=await fixture(t),room=id==='note'?'default':'alpha',dir=id==='note'?f.note:path.join(f.root,room),token=await f.login(id,room);
 assert.equal((await f.call(id,room,'upload',upload('unauthenticated'))).status,401);assert.equal(fs.existsSync(path.join(dir,'backup')),false);
 assert.equal((await f.call(id,room,'save',{text:'keep',user:'fixture'},token)).status,200);
 const before=fs.readFileSync(path.join(dir,'.note-meta.json')),outside=path.join(f.tmp,'outside');fs.mkdirSync(outside);
 for(const kind of ['link','file']){
  const backup=path.join(dir,'backup');if(kind==='link')fs.symlinkSync(outside,backup);else fs.writeFileSync(backup,'keep');
  assert.notEqual((await f.call(id,room,'upload',upload('blocked'),token)).status,200);
  assert.equal(fs.existsSync(path.join(dir,'photo.png')),false);assert.deepEqual(fs.readFileSync(path.join(dir,'.note-meta.json')),before);
  const state=await f.call(id,room,'state',undefined,token);assert.deepEqual(state.data.files,[]);
  assert.equal((await f.call(id,room,'file&id=backup',undefined,token)).status,404);
  fs.unlinkSync(backup);
 }
 assert.deepEqual(fs.readdirSync(outside),[]);
 assert.equal((await f.call(id,room,'upload',upload('reserved','backup'),token)).status,200);
 assert.ok(fs.existsSync(path.join(dir,'backup (1)')));assert.deepEqual(backupValues(dir),['reserved']);
 const other=id==='note'?'legacy':'beta',otherToken=await f.login(id,other);
 assert.equal((await f.call(id,other,'upload',upload('other-room'),otherToken)).status,200);
 const otherDir=id==='note'?path.join(f.note,other):path.join(f.root,other);
 assert.deepEqual(backupValues(otherDir),['other-room']);
 assert.deepEqual(backupValues(dir),['reserved']);
});

for(const id of ['note','note2'])test(`${id} uploads skip dangling active links without following them and reset unlinks links only`,async t=>{
 const f=await fixture(t),room=id==='note'?'default':'alpha',dir=id==='note'?f.note:path.join(f.root,room),token=await f.login(id,room),outside=path.join(f.tmp,'not-created');
 fs.symlinkSync(outside,path.join(dir,'photo.png'));
 assert.equal((await f.call(id,room,'upload',upload('safe'),token)).status,200);
 assert.equal(fs.existsSync(outside),false);assert.ok(fs.lstatSync(path.join(dir,'photo.png')).isSymbolicLink());
 assert.equal(fs.readFileSync(path.join(dir,'photo (1).png'),'utf8'),'safe');
 assert.deepEqual(backupValues(dir),['safe']);
 fs.writeFileSync(outside,'keep');
 if(id==='note')resetNoteAContent(dir);else resetNoteContent(f.root,room);
 assert.equal(fs.readFileSync(outside,'utf8'),'keep');assert.equal(fs.existsSync(path.join(dir,'photo.png')),false);
});

function backupValues(dir){return fs.readdirSync(path.join(dir,'backup')).filter(n=>fs.lstatSync(path.join(dir,'backup',n)).isFile()).map(n=>fs.readFileSync(path.join(dir,'backup',n),'utf8')).sort();}
function temp(t){const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'note-upload-backup-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
test('archive helper preserves bytes privately and allocates versions exclusively',t=>{
 const dir=temp(t),{preserveUploadCopy}=require('../server/note-upload-backup');
 const first=preserveUploadCopy(dir,'photo.png',Buffer.from('first'));
 const second=preserveUploadCopy(dir,'photo.png',Buffer.from('second'));
 assert.notEqual(first,second);for(const file of [first,second])assert.match(path.basename(file),/^photo_\d{8}_\d{6}(?:_\d{3,})?\.png$/);
 assert.equal(fs.readFileSync(first,'utf8'),'first');assert.equal(fs.readFileSync(second,'utf8'),'second');
 assert.equal(fs.statSync(path.dirname(first)).mode&0o777,0o700);assert.equal(fs.statSync(first).mode&0o777,0o600);
});

async function fixture(t){
 const tmp=temp(t),note=path.join(tmp,'note','family'),root=path.join(tmp,'note2');
 for(const dir of [note,path.join(note,'legacy'),path.join(root,'alpha'),path.join(root,'beta')])fs.mkdirSync(dir,{recursive:true});
 const env={NOTE_AUTH_FILE:path.join(tmp,'private/auth.json'),NOTE_ADMIN_PASSWORD_FILE:path.join(tmp,'admin'),NOTE_PASSWORD:'fixture-note-pass',NOTE2_PASSWORD:'fixture-room-pass',NOTE2_DIR:root};
 fs.writeFileSync(env.NOTE_ADMIN_PASSWORD_FILE,'fixture-admin-pass');await initialize(env);
 const previous=Object.fromEntries(['NOTE_AUTH_FILE','NOTE2_DIR','VERCEL'].map(k=>[k,process.env[k]]));Object.assign(process.env,{NOTE_AUTH_FILE:env.NOTE_AUTH_FILE,NOTE2_DIR:root,VERCEL:''});
 t.after(()=>{for(const[k,v]of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
 const handlers={note:createNoteFolderHandler(note,{localId:'note'}),note2:createNoteFolderHandler(root,{localId:'note2',roomFolders:true})};
 async function call(id,room,action,body,token=''){
  const {PassThrough}=require('node:stream'),res=new PassThrough(),chunks=[];res.setHeader=()=>{};res.on('data',c=>chunks.push(c));const done=new Promise(r=>res.on('finish',r));
  await handlers[id]({method:body===undefined?'GET':'POST',url:`/api/${id}/${action.split('&')[0]}?room=${room}${action.includes('&')?'&'+action.split('&').slice(1).join('&'):''}`,headers:{'x-note-token':token},body},res);await done;
  return {status:res.statusCode,data:JSON.parse(Buffer.concat(chunks).toString())};
 }
 async function login(id,room){const r=await call(id,room,'login',{password:id==='note'?'fixture-note-pass':'fixture-room-pass'});assert.equal(r.status,200);return r.data.token;}
 async function reset(id,room){
  const service=createService(createFileStore(env),Date.now,{roomRoot:root}),token=await service.login('admin','fixture-admin-pass');
  const handler=createAdminHandler(()=>service,{roomRoot:root,noteDir:note});
  const res={setHeader(){},end(v){this.data=JSON.parse(v);}};
  await handler({method:'POST',url:'/api/note-admin?action=reset-content',headers:{authorization:'Bearer '+token},body:{id,room}},res);
  assert.equal(res.statusCode,200);return res.data;
 }
 return {tmp,note,root,call,login,reset};
}
const upload=(text,name='photo.png')=>({name,dataUrl:'data:application/octet-stream;base64,'+Buffer.from(text).toString('base64')});

for(const [id,room] of [['note','default'],['note','legacy'],['note2','alpha']])test(`${id}/${room} dual writes, preserves delete/reset histories and active duplicate naming`,async t=>{
 const f=await fixture(t),token=await f.login(id,room),dir=id==='note'?(room==='default'?f.note:path.join(f.note,room)):path.join(f.root,room);
 const put=text=>f.call(id,room,'upload',upload(text),token);
 assert.equal((await put('first')).status,200);
 assert.deepEqual(backupValues(dir),['first']);
 assert.equal((await put('second')).status,200);
 assert.equal(fs.readFileSync(path.join(dir,'photo (1).png'),'utf8'),'second');
 assert.equal((await f.call(id,room,'delete-file',{id:'photo.png'},token)).status,200);
 assert.equal((await put('third')).status,200);
 assert.equal(fs.readFileSync(path.join(dir,'photo.png'),'utf8'),'third');
 if(id==='note'&&room==='legacy')resetNoteAContent(dir);else await f.reset(id,room);
 assert.equal((await put('fourth')).status,200);
 assert.equal(fs.readdirSync(path.join(dir,'backup')).length,4);
 assert.deepEqual(backupValues(dir),['first','fourth','second','third']);
 const state=await f.call(id,room,'state',undefined,token);assert.deepEqual(state.data.files.map(x=>x.name),['photo.png']);
 for(const name of ['backup/photo.png','../backup/photo.png'])assert.equal((await f.call(id,room,'file&id='+encodeURIComponent(name),undefined,token)).status,404);
 assert.equal((await f.call(id,'backup','state',undefined,token)).status,400);
});
