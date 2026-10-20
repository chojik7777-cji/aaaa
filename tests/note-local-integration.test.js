'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawn}=require('node:child_process');
const root=path.join(__dirname,'..');
test('portal startup-only bootstrap, HTTP auth/revisions persist through restart; Vercel stays independent',async t=>{
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'note-http-')));let child,base;
 const env={...process.env,HOME:dir,VERCEL:'',HOST:'127.0.0.1',PORT:'0',NOTE_AUTH_FILE:path.join(dir,'private','note-auth.json'),NOTE_ADMIN_PASSWORD_FILE:path.join(dir,'admin'),NOTE_DIR:path.join(dir,'note'),NOTE2_DIR:path.join(dir,'note2'),NOTE_PASSWORD:'existing-A-test',NOTE2_PASSWORD:'existing-B-test'};
 fs.writeFileSync(env.NOTE_ADMIN_PASSWORD_FILE,'admin-test-password\n',{mode:0o600});
 fs.mkdirSync(path.join(env.NOTE2_DIR,'default'),{recursive:true});
 async function stop(){if(child){const c=child;child=null;const done=new Promise(r=>c.once('exit',r));c.kill();await done;}}
 t.after(async()=>{await stop();fs.rmSync(dir,{recursive:true,force:true});});
 async function start(){child=spawn(process.execPath,['portal-server.js'],{cwd:root,env,stdio:['ignore','pipe','pipe']});base=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(new Error('startup timeout')),10000);child.stdout.on('data',c=>{out+=c;const m=out.match(/Game portal server: (http:\/\/127\.0\.0\.1:\d+)/);if(m){clearTimeout(timer);resolve(m[1]);}});child.once('exit',()=>{clearTimeout(timer);reject(new Error('startup failed'));});});}
 async function call(p,body,token='',admin=false){const r=await fetch(base+p,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?admin?{Authorization:'Bearer '+token}:{'x-note-token':token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
 await start();assert.equal(fs.existsSync(env.NOTE_AUTH_FILE),true);
 assert.equal((await call('/api/note-admin?action=status')).status,401);
 assert.equal((await call('/api/note-admin?action=bootstrap',{})).status,404);
 assert.equal((await call('/api/note2/setup')).status,401);
 const admin=await call('/api/note-admin?action=login',{password:'admin-test-password'});assert.equal(admin.status,200);const at=admin.data.token;
 const status=await call('/api/note-admin?action=status',null,at,true);assert.equal(status.status,200);assert.doesNotMatch(JSON.stringify(status),/verifier|token_key|scrypt|existing-A-test/);
 const tokens={};for(const [id,pw]of [['note','existing-A-test'],['note2','existing-B-test']]){
  const old=await call('/api/'+id+'/login',{password:pw});assert.equal(old.status,200);
  const revision=status.data.notes.find(n=>n.id===id).revision;
  const change=await call('/api/note-admin?action=rotate',{id,password:'rotated-'+id+'-test',confirmation:'rotated-'+id+'-test',revision},at,true);assert.equal(change.status,200);
  assert.equal((await call('/api/'+id+'/state',null,old.data.token)).status,401);
  assert.equal((await call('/api/'+id+'/login',{password:pw})).status,401);
  tokens[id]=(await call('/api/'+id+'/login',{password:'rotated-'+id+'-test'})).data.token;assert.ok(tokens[id]);
 }
 for(const p of ['/.env.local','/.git/config','/server/note-local.js','/note-auth.js','/portal-server.js','/pw','/note/family/.note-password','/scripts/init-note-auth.js','/note-auth.json'])assert.equal((await fetch(base+p)).status,403,p);
 fs.symlinkSync(env.NOTE_AUTH_FILE,path.join(root,'leak-test.html'));try{assert.equal((await fetch(base+'/leak-test.html')).status,403);}finally{fs.unlinkSync(path.join(root,'leak-test.html'));}
 assert.equal((await fetch(base+'/note-password-admin.js')).status,200);
 const output=path.join(dir,'public');fs.mkdirSync(output);fs.writeFileSync(path.join(output,'note-auth.json'),'stale-private-artifact');require('../scripts/build-static').build(output);assert.ok(fs.existsSync(path.join(output,'note.html')));assert.equal(fs.existsSync(path.join(output,'note-auth.json')),false);
 for(const p of ['server','api','.env.local','note-auth.js','portal-server.js','note','note2','scripts'])assert.equal(fs.existsSync(path.join(output,p)),false,p);
 await stop();await start();for(const id of ['note','note2'])assert.equal((await call('/api/'+id+'/state',null,tokens[id])).status,200);
 assert.equal((await call('/api/note-admin?action=status',null,at,true)).status,200);
 for(let i=0;i<4;i++)assert.equal((await call('/api/note/login',{password:'wrong-test'})).status,401);
 assert.equal((await call('/api/note/login',{password:'wrong-test'})).status,429);
 assert.equal((await call('/api/note/login',{password:'rotated-note-test'})).status,429);
 // Existing Vercel env auth must not read even a configured missing local store.
 const saved={};for(const k of ['NOTE_PASSWORD','NOTE2_PASSWORD','NOTE_AUTH_FILE','VERCEL']){saved[k]=process.env[k];process.env[k]=k==='VERCEL'?'1':env[k];}
 try{
  const vercel=async(file,action,body)=>{const req={method:body?'POST':'GET',url:'/api/'+file+'?action='+action,headers:{},body:body||{}};const res={setHeader(){},end(s){this.data=JSON.parse(s);}};await require('../api/'+file)(req,res);return res;};
  const r=await vercel('note-admin','login',{password:'admin-test-password'});assert.equal(r.statusCode,503);assert.match(r.data.error,/로컬/);
  for(const [id,pw]of [['note','existing-A-test'],['note2','existing-B-test']])assert.equal((await vercel(id,'login',{password:pw})).statusCode,200);
 }finally{for(const[k,v]of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
 // Removing admin source after initialized never resets anything. Missing store must fail closed.
 await stop();fs.unlinkSync(env.NOTE_AUTH_FILE);fs.unlinkSync(env.NOTE_ADMIN_PASSWORD_FILE);await start();
 assert.equal((await call('/api/note/login',{password:'existing-A-test'})).status,503);
 assert.equal((await call('/api/note-admin?action=login',{password:'admin-test-password'})).status,503);
 assert.equal(fs.existsSync(env.NOTE_AUTH_FILE),false);
});
