'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {initialize,createFileStore,createService}=require('../server/note-local');
const {createAdminHandler}=require('../server/note-admin');
async function fixture(t){
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'room-create-'))),root=path.join(dir,'rooms');
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));fs.mkdirSync(path.join(root,'inherited'),{recursive:true});fs.writeFileSync(path.join(root,'inherited','keep.txt'),'preserve me');
 const env={NOTE_AUTH_FILE:path.join(dir,'private','auth.json'),NOTE_ADMIN_PASSWORD_FILE:path.join(dir,'admin'),NOTE_PASSWORD:'note-original',NOTE2_PASSWORD:'template-original'};
 fs.writeFileSync(env.NOTE_ADMIN_PASSWORD_FILE,'admin-fixture');await initialize(env);
 const service=createService(createFileStore(env),Date.now,{roomRoot:root}),other=createService(createFileStore(env),Date.now,{roomRoot:root});
 const token=await service.login('admin','admin-fixture'),handler=createAdminHandler(()=>service,{roomRoot:root});
 async function call(action,room,body,auth=token){const req={method:body===undefined?'GET':'POST',url:'/api/note-admin?action='+action+'&room='+encodeURIComponent(room),headers:{authorization:auth?'Bearer '+auth:''},body,socket:{remoteAddress:'fixture'}};const res={setHeader(){},end(v){this.data=JSON.parse(v);}};await handler(req,res);return {status:res.statusCode,data:res.data};}
 return {env,root,service,other,token,call};
}
test('explicit create is authorized, listed without a directory and immediately uses chosen password',async t=>{
 const {env,root,service,call}=await fixture(t),before=JSON.parse(fs.readFileSync(env.NOTE_AUTH_FILE,'utf8'));
 const body={room:'fresh',password:'chosen-password',confirmation:'chosen-password'};
 assert.equal((await call('create','fresh',body,'')).status,401);
 assert.equal((await call('status','default',undefined,'')).status,401);
 const created=await call('create','fresh',body);assert.equal(created.status,201);
 assert.equal(fs.existsSync(path.join(root,'fresh')),false);
 const status=await call('status','fresh');assert.equal(status.status,200);assert.deepEqual(status.data.rooms,['fresh','inherited']);
 assert.doesNotMatch(JSON.stringify(status),/verifier|token_key|salt|hash|chosen-password/);
 assert.ok(await service.login('note2','chosen-password','fresh'));assert.equal(await service.login('note2','template-original','fresh'),null);
 assert.deepEqual(JSON.parse(fs.readFileSync(env.NOTE_AUTH_FILE,'utf8')).rows,before.rows);
 const saved=fs.readFileSync(env.NOTE_AUTH_FILE,'utf8');assert.equal((await call('create','fresh',body)).status,409);assert.equal((await call('create','inherited',{...body,room:'inherited'})).status,409);
 assert.equal(fs.readFileSync(env.NOTE_AUTH_FILE,'utf8'),saved);assert.equal(fs.readFileSync(path.join(root,'inherited','keep.txt'),'utf8'),'preserve me');
});
test('create race has exactly one winner and never overrides it; unknown rotation cannot create',async t=>{
 const {service,other,token,call,env}=await fixture(t);
 const results=await Promise.allSettled([service.createRoom(token,'race','winner-one','winner-one'),other.createRoom(token,'race','winner-two','winner-two')]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
 const winner=results[0].status==='fulfilled'?'winner-one':'winner-two';assert.ok(await other.login('note2',winner,'race'));
 const revision=(await service.status(token,'missing')).find(n=>n.id==='note2').revision,saved=fs.readFileSync(env.NOTE_AUTH_FILE,'utf8');
 const body={id:'note2',room:'missing',password:'new-password',confirmation:'new-password',revision};
 assert.equal((await call('rotate','missing',body)).status,404);
 await assert.rejects(()=>service.rotate(token,'note2','new-password','new-password',revision,'missing'),{status:404});
 assert.equal(fs.readFileSync(env.NOTE_AUTH_FILE,'utf8'),saved);
 const inherited=await service.login('note2','template-original','inherited'),race=await service.login('note2',winner,'race');
 assert.equal((await call('rotate','inherited',{...body,room:'inherited'})).status,200);
 assert.equal(await service.tokenOk('note2',inherited,'inherited'),false);assert.ok(await service.tokenOk('note2',race,'race'));assert.ok(await service.login('note','note-original'));
});
test('invalid creation, mismatched identities and case aliases never write credentials',async t=>{
 const {env,root,call}=await fixture(t),saved=fs.readFileSync(env.NOTE_AUTH_FILE,'utf8');
 for(const room of ['UPPER','../bad','constructor','__proto__','','a'.repeat(51)])assert.equal((await call('create',room,{room,password:'valid-password',confirmation:'valid-password'})).status,400);
 for(const [password,confirmation]of [['short','short'],['valid-password','different'],['x'.repeat(257),'x'.repeat(257)],[null,null]])assert.equal((await call('create','valid',{room:'valid',password,confirmation})).status,400);
 assert.equal((await call('create','valid',{room:'other',password:'valid-password',confirmation:'valid-password'})).status,400);
 fs.mkdirSync(path.join(root,'Upper'));assert.equal((await call('create','upper',{room:'upper',password:'valid-password',confirmation:'valid-password'})).status,400);
 assert.equal(fs.readFileSync(env.NOTE_AUTH_FILE,'utf8'),saved);
});
