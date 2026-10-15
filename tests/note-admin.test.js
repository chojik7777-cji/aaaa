'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createService,hashPassword}=require('../server/note-local');
const {createAdminHandler}=require('../server/note-admin');
async function fixture(){
 const rows=new Map();
 for(const id of ['note','note2','admin']) rows.set(id,{id,verifier:await hashPassword('test-'+id+'-password'),token_key:crypto.randomBytes(32).toString('hex'),revision:crypto.randomUUID(),updated_at:new Date().toISOString()});
 const store={consumeAdminAttempt:async()=>true,get:async id=>structuredClone(rows.get(id)),replace:async(id,rev,row)=>{if(rows.get(id).revision!==rev)return false;rows.set(id,structuredClone(row));return true;}};
 return {service:createService(store),rows,store};
}
async function call(handler,action,body={},token='',method='POST'){
 const req={method,url:'/api/note-admin?action='+action,headers:{host:'localhost',authorization:token?'Bearer '+token:''},body,socket:{remoteAddress:'127.0.0.1'}};
 const res={statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v;},end(v){this.body=v;}};
 await handler(req,res);return {status:res.statusCode,data:JSON.parse(res.body)};
}
test('admin API validates every read/write; rotation revokes tokens on independent server',async()=>{
 const {service,store}=await fixture(),handler=createAdminHandler(()=>service);
 assert.equal((await call(handler,'status',{},'','GET')).status,401);
 assert.equal((await call(handler,'rotate',{id:'note',password:'unauthorized'})).status,401);
 assert.equal((await call(handler,'login',{password:'wrong'})).status,401);
 const login=await call(handler,'login',{password:'test-admin-password'}); assert.equal(login.status,200);
 const t=login.data.token;
 const status=await call(handler,'status',{},t,'GET');assert.equal(status.status,200);
 assert.doesNotMatch(JSON.stringify(status),/verifier|token_key|scrypt|test-note/);
 const revision=status.data.notes.find(x=>x.id==='note').revision;
 const old=await service.login('note','test-note-password');const other=await service.login('note2','test-note2-password');
 assert.equal((await call(handler,'rotate',{id:'note',password:'new-password',confirmation:'different',revision},t)).status,400);
 assert.equal((await call(handler,'rotate',{id:'note',password:'new-password',confirmation:'new-password',revision},t)).status,200);
 const independent=createService(store);
 assert.equal(await independent.tokenOk('note',old),false);
 assert.equal(await independent.tokenOk('note2',other),true);
 assert.equal(await independent.login('note','test-note-password'),null);
 assert.ok(await independent.login('note','new-password'));
 assert.equal((await call(handler,'rotate',{id:'note',password:'new-password',confirmation:'new-password',revision},t)).status,409);
 assert.equal((await call(handler,'status',{},'ok','GET')).status,401);
 assert.equal(await service.tokenOk('note',t),false);
});
test('failed local store never becomes a legacy/admin fallback; safe error and bounded requests',async()=>{
 const handler=createAdminHandler(()=>{throw new Error('SECRET-CREDENTIAL');});
 const r=await call(handler,'login',{password:'anything'});assert.equal(r.status,503);assert.doesNotMatch(JSON.stringify(r),/SECRET/);
 assert.equal((await call(handler,'login',{password:'x'.repeat(3000)})).status,413);
});
