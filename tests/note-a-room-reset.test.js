'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {initialize,createFileStore,createService}=require('../server/note-local');
const {createAdminHandler}=require('../server/note-admin');
async function fixture(t){
 const tmp=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'note-a-room-reset-')));
 t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
 const noteDir=path.join(tmp,'note'),roomRoot=path.join(tmp,'note2');
 for(const dir of [noteDir,path.join(noteDir,'alpha'),path.join(noteDir,'beta'),path.join(roomRoot,'alpha')])fs.mkdirSync(dir,{recursive:true});
 const env={NOTE_AUTH_FILE:path.join(tmp,'private','auth.json'),NOTE_ADMIN_PASSWORD_FILE:path.join(tmp,'admin'),NOTE_PASSWORD:'fixture-note',NOTE2_PASSWORD:'fixture-template'};
 fs.writeFileSync(env.NOTE_ADMIN_PASSWORD_FILE,'fixture-admin');await initialize(env);
 const service=createService(createFileStore(env),Date.now,{noteDir,roomRoot}),token=await service.login('admin','fixture-admin');
 const handler=createAdminHandler(()=>service,{noteDir,roomRoot});
 async function call(room='alpha',auth=token,method='POST',query='',id='note'){
  const res={setHeader(){},end(value){this.data=JSON.parse(value);}};
  await handler({method,url:'/api/note-admin?action=reset-content'+query,headers:{authorization:auth?'Bearer '+auth:''},body:{id,room}},res);return res;
 }
 return {tmp,noteDir,roomRoot,env,service,token,call};
}
function seed(dir){
 for(const [name,value]of Object.entries({'.note-memo.txt':'body','.note-meta.json':JSON.stringify({version:8,uploads:{'file.txt':'user'}}),'file.txt':'attachment','.note-password':'legacy-fixture'}))fs.writeFileSync(path.join(dir,name),value);
 fs.mkdirSync(path.join(dir,'backup'),{recursive:true});fs.writeFileSync(path.join(dir,'backup','archive.bin'),'weekly archive');
}
function snapshot(dir){
 const result={};for(const name of fs.readdirSync(dir).sort()){
  const file=path.join(dir,name),stat=fs.lstatSync(file);
  result[name]=stat.isSymbolicLink()?{link:fs.readlinkSync(file)}:stat.isDirectory()?snapshot(file):crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 }return result;
}
test('named note A reset isolates namespaces, preserves credentials, revisions, grants and backup bytes',async t=>{
 const f=await fixture(t),alpha=path.join(f.noteDir,'alpha');
 for(const dir of [f.noteDir,alpha,path.join(f.noteDir,'beta'),path.join(f.roomRoot,'alpha')])seed(dir);
 const revision=(await f.service.status(f.token,'alpha')).find(row=>row.id==='note').revision;
 await f.service.rotate(f.token,'note','fixture-alpha','fixture-alpha',revision,'alpha',f.noteDir);
 const privateBytes=fs.readFileSync(f.env.NOTE_AUTH_FILE);
 const grants=[];for(const [id,room,password]of [['note','default','fixture-note'],['note','alpha','fixture-alpha'],['note','beta','fixture-note'],['note2','alpha','fixture-template']]){
  const token=await f.service.login(id,password,room);assert.ok(await f.service.tokenOk(id,token,room));grants.push({id,room,token});
 }
 const before=snapshot(f.tmp),backup=snapshot(path.join(alpha,'backup')),status=await f.service.status(f.token,'alpha');
 const res=await f.call();assert.equal(res.statusCode,200);assert.deepEqual(res.data,{ok:true,id:'note',room:'alpha',version:0});
 assert.deepEqual(fs.readdirSync(alpha).sort(),['.note-meta.json','.note-password','backup']);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(alpha,'.note-meta.json'))),{version:0,updatedAt:0,updatedBy:'',uploads:{}});
 const after=snapshot(f.tmp);before.note.alpha=after.note.alpha;assert.deepEqual(after,before);
 assert.deepEqual(snapshot(path.join(alpha,'backup')),backup);
 assert.equal(fs.readFileSync(path.join(alpha,'.note-password'),'utf8'),'legacy-fixture');
 assert.deepEqual(await f.service.status(f.token,'alpha'),status);
 for(const {id,room,token}of grants)assert.ok(await f.service.tokenOk(id,token,room));
 assert.deepEqual(fs.readFileSync(f.env.NOTE_AUTH_FILE),privateBytes);
 assert.ok(await f.service.login('note','fixture-alpha','alpha'));
 assert.equal(await f.service.login('note','fixture-note','alpha'),null);
});
test('configured-only note A room initializes only itself; B registration cannot authorize A',async t=>{
 const f=await fixture(t);
 await f.service.createRoom(f.token,'configured','configured-password','configured-password',f.noteDir,'note');
 await f.service.createRoom(f.token,'bonly','bonly-password','bonly-password',f.roomRoot,'note2');
 const grant=await f.service.login('note','configured-password','configured'),before=snapshot(f.tmp);
 assert.equal((await f.call('bonly')).statusCode,404);assert.deepEqual(snapshot(f.tmp),before);
 const res=await f.call('configured');assert.equal(res.statusCode,200);assert.deepEqual(res.data,{ok:true,id:'note',room:'configured',version:0});
 assert.deepEqual(fs.readdirSync(path.join(f.noteDir,'configured')),['.note-meta.json']);
 const after=snapshot(f.tmp);delete after.note.configured;assert.deepEqual(after,before);
 assert.ok(await f.service.tokenOk('note',grant,'configured'));
});
test('unknown, invalid, conflicting and unauthorized requests never mutate storage',async t=>{
 const f=await fixture(t);seed(path.join(f.noteDir,'alpha'));const before=snapshot(f.tmp);
 for(const auth of ['', 'invalid'])assert.equal((await f.call('alpha',auth)).statusCode,401);
 assert.equal((await f.call('missing')).statusCode,404);
 for(const room of ['../alpha','ALPHA','Alpha','__proto__','constructor','prototype','backup','BACKUP','','a/b',null,7])assert.equal((await f.call(room)).statusCode,400);
 for(const query of ['&room=beta','&room=alpha&room=alpha'])assert.equal((await f.call('alpha',undefined,'POST',query)).statusCode,400);
 assert.equal((await f.call('alpha',undefined,'GET')).statusCode,405);
 assert.deepEqual(snapshot(f.tmp),before);
});
test('case aliases, room and ancestor symlinks, internal links and file collisions fail closed',async t=>{
 const f=await fixture(t),alpha=path.join(f.noteDir,'alpha');seed(alpha);
 const outside=path.join(f.tmp,'outside');fs.mkdirSync(outside);fs.writeFileSync(path.join(outside,'keep'),'outside');
 fs.symlinkSync(outside,path.join(f.noteDir,'linked'));fs.writeFileSync(path.join(f.noteDir,'collision'),'file');fs.mkdirSync(path.join(f.noteDir,'Mixed'));
 for(const room of ['linked','collision','mixed']){const before=snapshot(f.tmp);assert.equal((await f.call(room)).statusCode,400);assert.deepEqual(snapshot(f.tmp),before);}
 for(const name of ['.note-meta.json','.note-memo.txt']){
  const file=path.join(alpha,name),original=fs.readFileSync(file);fs.unlinkSync(file);fs.symlinkSync(path.join(outside,'keep'),file);
  const before=snapshot(f.tmp);assert.equal((await f.call()).statusCode,400);assert.deepEqual(snapshot(f.tmp),before);fs.unlinkSync(file);fs.writeFileSync(file,original);
 }
 // Canonical fixture paths are intentional: a noncanonical ancestor must be rejected.
 const alias=path.join(f.tmp,'alias');fs.symlinkSync(f.noteDir,alias);
 const handler=createAdminHandler(()=>f.service,{noteDir:path.join(alias,'nested'),roomRoot:f.roomRoot});
 fs.mkdirSync(path.join(f.noteDir,'nested'));fs.mkdirSync(path.join(f.noteDir,'nested','alpha'));
 const before=snapshot(f.tmp),res={setHeader(){},end(){}};
 await handler({method:'POST',url:'/api/note-admin?action=reset-content',headers:{authorization:'Bearer '+f.token},body:{id:'note',room:'alpha'}},res);
 assert.equal(res.statusCode,400);assert.deepEqual(snapshot(f.tmp),before);
});
test('default reset and legacy helper signature keep named rooms and all backups intact',async t=>{
 const f=await fixture(t);for(const dir of [f.noteDir,path.join(f.noteDir,'alpha'),path.join(f.noteDir,'beta'),path.join(f.roomRoot,'alpha')])seed(dir);
 const before=snapshot(f.tmp),res=await f.call('default');assert.equal(res.statusCode,200);assert.deepEqual(res.data,{ok:true,id:'note',room:'default',version:0});
 const after=snapshot(f.tmp);assert.equal(fs.existsSync(path.join(f.noteDir,'.note-memo.txt')),false);assert.equal(fs.existsSync(path.join(f.noteDir,'file.txt')),false);
 delete before.note['.note-memo.txt'];delete before.note['file.txt'];before.note['.note-meta.json']=after.note['.note-meta.json'];assert.deepEqual(after,before);
 require('../note-folder').resetNoteAContent(f.noteDir);assert.deepEqual(snapshot(f.tmp),after);
});
test('named attachment links are removed without traversing their targets; note B reset is unchanged',async t=>{
 const f=await fixture(t),alpha=path.join(f.noteDir,'alpha');seed(alpha);seed(path.join(f.roomRoot,'alpha'));
 const outside=path.join(f.tmp,'outside');fs.mkdirSync(outside);fs.writeFileSync(path.join(outside,'keep'),'keep');
 fs.symlinkSync(outside,path.join(alpha,'link'));fs.mkdirSync(path.join(alpha,'attachment-dir'));fs.writeFileSync(path.join(alpha,'attachment-dir','file'),'nested');
 assert.equal((await f.call()).statusCode,200);assert.equal(fs.existsSync(path.join(alpha,'link')),false);assert.equal(fs.existsSync(path.join(alpha,'attachment-dir')),false);assert.equal(fs.readFileSync(path.join(outside,'keep'),'utf8'),'keep');
 const before=snapshot(f.noteDir),res=await f.call('alpha',undefined,'POST','','note2');assert.equal(res.statusCode,200);assert.deepEqual(res.data,{ok:true,room:'alpha',version:0});assert.deepEqual(snapshot(f.noteDir),before);
 assert.deepEqual(fs.readdirSync(path.join(f.roomRoot,'alpha')).sort(),['.note-meta.json','.note-password','backup']);
});
