'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {initialize,createFileStore,createService}=require('../server/note-local');
const {createNoteFolderHandler}=require('../note-folder');
const {createAdminHandler}=require('../server/note-admin');
test('local room credentials, tokens, file downloads, rotations and guarded discovery are isolated',async t=>{
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'note-rooms-'))),root=path.join(dir,'rooms');
 const env={NOTE_AUTH_FILE:path.join(dir,'private','auth.json'),NOTE_ADMIN_PASSWORD_FILE:path.join(dir,'admin'),NOTE_PASSWORD:'note-original',NOTE2_PASSWORD:'room-original'};
 fs.writeFileSync(env.NOTE_ADMIN_PASSWORD_FILE,'admin-original');for(const room of ['alpha','beta'])fs.mkdirSync(path.join(root,room),{recursive:true});
 await initialize(env);const before=fs.readFileSync(env.NOTE_AUTH_FILE,'utf8');
 const saved=process.env.NOTE_AUTH_FILE;process.env.NOTE_AUTH_FILE=env.NOTE_AUTH_FILE;
 const service=createService(createFileStore(env)),handler=createNoteFolderHandler(root,{localId:'note2',roomFolders:true}),admin=createAdminHandler(()=>service,{roomRoot:root});
 const server=http.createServer((req,res)=>req.url.startsWith('/api/note-admin')?admin(req,res):handler(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));if(saved===undefined)delete process.env.NOTE_AUTH_FILE;else process.env.NOTE_AUTH_FILE=saved;fs.rmSync(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+server.address().port;
 async function call(action,room,body,token='',isAdmin=false){const r=await fetch(base+(isAdmin?'/api/note-admin?action=':'/api/note2/')+action+(isAdmin?'&':'?')+'room='+encodeURIComponent(room),{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?isAdmin?{Authorization:'Bearer '+token}:{'x-note-token':token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,data:await r.json()};}
 const a=(await call('login','alpha',{password:'room-original'})).data.token,b=(await call('login','beta',{password:'room-original'})).data.token;assert.ok(a);assert.ok(b);assert.notEqual(a,b);
 for(const action of ['state','save','upload','delete-file','file'])assert.equal((await call(action,'beta',action==='state'||action==='file'?undefined:{room:'beta',text:'stolen',id:'x',name:'x',dataUrl:'data:text/plain;base64,eA=='},a)).status,401,action);
 assert.equal((await call('save','alpha',{room:'beta',text:'wrong'},a)).status,400);
 for(const room of ['../alpha','a'.repeat(51),'__proto__','constructor','toString',' alpha',''])assert.equal((await call('login',room,{password:'room-original'})).status,400,room);
 assert.equal((await call('login','unknown',{password:'room-original'})).status,401);
 assert.equal((await call('state','unknown',undefined,a)).status,401);
 assert.equal(fs.readFileSync(env.NOTE_AUTH_FILE,'utf8'),before,'logins must not create auth records');
 assert.equal((await call('status','alpha',undefined,'',true)).status,401);
 const at=await service.login('admin','admin-original');const st=await call('status','alpha',undefined,at,true);assert.equal(st.status,200);assert.deepEqual(st.data.rooms,['alpha','beta']);
 const revision=st.data.notes.find(n=>n.id==='note2').revision;
 assert.equal((await call('rotate','alpha',{id:'note2',room:'beta',password:'alpha-changed',confirmation:'alpha-changed',revision},at,true)).status,400);
 assert.equal((await call('rotate','alpha',{id:'note2',room:'alpha',password:'alpha-changed',confirmation:'alpha-changed',revision},at,true)).status,200);
 assert.equal((await call('state','alpha',undefined,a)).status,401);assert.equal((await call('state','beta',undefined,b)).status,200);
 assert.equal((await call('login','alpha',{password:'room-original'})).status,401);assert.equal((await call('login','alpha',{password:'alpha-changed'})).status,200);
 assert.equal((await call('login','beta',{password:'alpha-changed'})).status,401);assert.ok(await service.tokenOk('admin',at));assert.ok(await service.login('note','note-original'));
 await call('upload','beta',{room:'beta',name:'x.txt',dataUrl:'data:text/plain;base64,eA=='},b);
 for(const [room,token,status]of [['beta',a,401],['alpha',b,401],['beta',b,200],['unknown',b,401]]){const r=await fetch(base+'/api/note2/file?room='+room+'&id=x.txt&token='+encodeURIComponent(token));assert.equal(r.status,status);await r.text();}
 // An authentic pre-room global token cannot be used even with the old signing key.
 const row=(await createFileStore(env).get('note2')),payload=Buffer.from(JSON.stringify({id:'note2',revision:row.revision,exp:Date.now()+60000})).toString('base64url');const legacy=payload+'.'+crypto.createHmac('sha256',row.token_key).update(payload).digest('hex');assert.equal((await call('state','beta',undefined,legacy)).status,401);
 const fresh=await call('status','new-room',undefined,at,true);assert.equal(fresh.status,200);assert.equal((await call('rotate','new-room',{id:'note2',room:'new-room',password:'new-room-pass',confirmation:'new-room-pass',revision:fresh.data.notes.find(n=>n.id==='note2').revision},at,true)).status,200);assert.equal((await call('login','new-room',{password:'new-room-pass'})).status,200);
 for(const body of [null,[],{room:7},{room:{} }])assert.equal((await call('save','beta',body,b)).status,400);
 for(const action of ['login','state','save','upload','delete-file','file']){
  assert.equal((await call(action,'beta',{room:'alpha',password:'room-original'},b)).status,400,action+' mismatch');
  assert.equal((await fetch(base+'/api/note2/'+action+'?room=beta&room=alpha',{headers:{'x-note-token':b}})).status,400,action+' duplicate');
 }
 // Symlinked folders/files must not turn a valid room token into cross-room file access.
 fs.symlinkSync(path.join(root,'beta','x.txt'),path.join(root,'alpha','linked.txt'));
 const anew=(await call('login','alpha',{password:'alpha-changed'})).data.token;
 const linked=await fetch(base+'/api/note2/file?room=alpha&id=linked.txt&token='+encodeURIComponent(anew));assert.equal(linked.status,404);await linked.text();
 fs.renameSync(path.join(root,'alpha'),path.join(root,'alpha-old'));fs.symlinkSync(path.join(root,'beta'),path.join(root,'alpha'));
 assert.equal((await call('state','alpha',undefined,anew)).status,400);
 assert.equal((await call('rotate','alpha',{id:'note2',room:'alpha',password:'other-password',confirmation:'other-password',revision},at,true)).status,400);
 for(const action of ['login','rotate'])for(const body of [null,[],7,'bad-body'])assert.equal((await call(action,'beta',body,at,true)).status,400,'admin malformed '+action);
 fs.writeFileSync(env.NOTE_AUTH_FILE,'SECRET-SHOULD-NOT-LEAK invalid-json');
 const broken=await call('state','beta',undefined,b);assert.equal(broken.status,503);assert.doesNotMatch(JSON.stringify(broken),/SECRET-SHOULD-NOT-LEAK/);
});
