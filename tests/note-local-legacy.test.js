'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawn}=require('node:child_process');
function fixture(t){
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'note-legacy-'))),root=path.join(dir,'app');
 fs.mkdirSync(root);
 for(const name of ['server','portal-server.js','note-folder.js','note-auth.js','note-preview.js'])fs.cpSync(path.join(__dirname,'..',name),path.join(root,name),{recursive:true});
 const env={NOTE_AUTH_FILE:path.join(dir,'private','auth.json'),NOTE_ADMIN_PASSWORD_FILE:path.join(dir,'admin')};
 fs.writeFileSync(env.NOTE_ADMIN_PASSWORD_FILE,'fixture-admin-secret',{mode:0o600});
 const legacy=path.join(root,'family');fs.mkdirSync(legacy);fs.writeFileSync(path.join(legacy,'.note-password'),'custom-legacy-secret\n');
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 return {root,env,legacy,local:require(path.join(root,'server','note-local'))};
}
test('standalone init preserves unmigrated legacy password and portal startup remains compatible',async t=>{
 const {root,env,legacy,local}=fixture(t),source=fs.readFileSync(path.join(legacy,'.note-password'));
 await local.initialize(env);
 const service=local.createService(local.createFileStore(env));
 assert.ok(await service.login('note','custom-legacy-secret'));
 assert.equal(await service.login('note','1313'),null);
 assert.deepEqual(fs.readFileSync(path.join(legacy,'.note-password')),source);
 assert.equal(fs.existsSync(path.join(root,'note')),false);
 const before=fs.readFileSync(env.NOTE_AUTH_FILE);
 const childEnv={...process.env,...env,VERCEL:'',HOST:'127.0.0.1',PORT:'0'};
 for(const key of ['NOTE_DIR','NOTE2_DIR','NOTE_PASSWORD','NOTE2_PASSWORD'])delete childEnv[key];
 const child=spawn(process.execPath,['portal-server.js'],{cwd:root,env:childEnv,stdio:['ignore','pipe','pipe']});
 try{
  const base=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(new Error('startup timeout')),10000);child.stdout.on('data',c=>{out+=c;const m=out.match(/Game portal server: (http:\/\/127\.0\.0\.1:\d+)/);if(m){clearTimeout(timer);resolve(m[1]);}});child.once('exit',()=>{clearTimeout(timer);reject(new Error('startup failed'));});});
  const response=await fetch(base+'/api/note/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:'custom-legacy-secret'})});
  assert.equal(response.status,200);
  assert.deepEqual(fs.readFileSync(env.NOTE_AUTH_FILE),before);
  assert.deepEqual(fs.readFileSync(path.join(root,'note','family','.note-password')),source);
  assert.equal(fs.existsSync(legacy),false);
 }finally{const exited=new Promise(resolve=>child.once('exit',resolve));child.kill();await exited;}
});
test('ambiguous default note folders fail closed without writing or moving either source',async t=>{
 const {root,env,legacy,local}=fixture(t),current=path.join(root,'note','family');
 fs.mkdirSync(current,{recursive:true});fs.writeFileSync(path.join(current,'.note-password'),'different-current-secret');
 await assert.rejects(()=>local.initialize(env),{status:503});
 assert.equal(fs.existsSync(env.NOTE_AUTH_FILE),false);
 assert.ok(fs.existsSync(path.join(legacy,'.note-password')));assert.ok(fs.existsSync(path.join(current,'.note-password')));
 // Explicit NOTE_DIR resolves ambiguity and must not consult the unrelated legacy folder.
 await local.initialize({...env,NOTE_DIR:current});
 assert.ok(await local.createService(local.createFileStore(env)).login('note','different-current-secret'));
});
