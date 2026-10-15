'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {initialize,createFileStore,createService}=require('../server/note-local');
function fixture(t){const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'note-safe-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const env={NOTE_AUTH_FILE:path.join(dir,'auth','store.json'),NOTE_ADMIN_PASSWORD_FILE:path.join(dir,'admin'),NOTE_DIR:path.join(dir,'A'),NOTE2_DIR:path.join(dir,'B')};fs.writeFileSync(env.NOTE_ADMIN_PASSWORD_FILE,'fixture-admin',{mode:0o600});return {dir,env};}
test('migration preserves per-note file/default and env precedence without changing source files',async t=>{
 const {env}=fixture(t);fs.mkdirSync(env.NOTE_DIR);fs.writeFileSync(path.join(env.NOTE_DIR,'.note-password'),'file-password\n');
 await initialize(env);let service=createService(createFileStore(env));assert.ok(await service.login('note','file-password'));assert.ok(await service.login('note2','1313'));
 const legacy=require('../note-auth').createNoteAuth();assert.equal(legacy.login({headers:{},socket:{remoteAddress:'fixture'}},{password:'1313'})[0],200);
 fs.unlinkSync(env.NOTE_AUTH_FILE);await initialize({...env,NOTE_PASSWORD:'env-password'});service=createService(createFileStore(env));assert.ok(await service.login('note','env-password'));assert.equal(await service.login('note','file-password'),null);
 assert.equal(fs.readFileSync(path.join(env.NOTE_DIR,'.note-password'),'utf8'),'file-password\n');
});
test('private store rejects repo paths, Vercel, insecure permissions, symlinks and concurrent locks',async t=>{
 const {dir,env}=fixture(t);assert.throws(()=>createFileStore({...env,VERCEL:'1'}));assert.throws(()=>createFileStore({NOTE_AUTH_FILE:path.join(__dirname,'..','leak.json')}));
 await initialize(env);const store=createFileStore(env),before=fs.readFileSync(env.NOTE_AUTH_FILE,'utf8');
 fs.chmodSync(env.NOTE_AUTH_FILE,0o644);await assert.rejects(()=>store.get('note'));fs.chmodSync(env.NOTE_AUTH_FILE,0o600);
 fs.chmodSync(path.dirname(env.NOTE_AUTH_FILE),0o755);await assert.rejects(()=>store.get('note'));fs.chmodSync(path.dirname(env.NOTE_AUTH_FILE),0o700);
 const link=path.join(dir,'link.json');fs.symlinkSync(env.NOTE_AUTH_FILE,link);await assert.rejects(()=>createFileStore({...env,NOTE_AUTH_FILE:link}).get('note'));
 fs.writeFileSync(env.NOTE_AUTH_FILE+'.lock','held',{mode:0o600});await assert.rejects(()=>store.consumeAdminAttempt(),{status:503});assert.equal(fs.readFileSync(env.NOTE_AUTH_FILE,'utf8'),before);fs.unlinkSync(env.NOTE_AUTH_FILE+'.lock');
 const a=createService(store),b=createService(createFileStore(env)),at=await a.login('admin','fixture-admin'),rev=(await a.status(at))[0].revision;
 const results=await Promise.allSettled([a.rotate(at,'note','next-password','next-password',rev),b.rotate(at,'note','other-password','other-password',rev)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
 assert.equal(fs.readdirSync(path.dirname(env.NOTE_AUTH_FILE)).length,1);
});
