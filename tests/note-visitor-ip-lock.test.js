'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createNoteAuth}=require('../note-auth');
const {requestInfo}=require('../server/security-audit');
const host='inn-analytical-split-juice.trycloudflare.com';
function req(ip,peer='127.0.0.1',requestHost=host){return {url:'/api/note/login',headers:{host:requestHost,'cf-connecting-ip':ip},socket:{remoteAddress:peer}};}
const service={login:async(id,p)=>p==='fixture-correct'?'fixture-token':null};
for(const id of ['note','note2']){
 test(id+': room-scoped lock matches the IP/page/room audit counter',async()=>{
  const auth=createNoteAuth({localId:id,getService:()=>service,audit:{record(){}}}),r=req('203.0.113.7');
  for(let i=0;i<5;i++)await auth.login(r,{password:'wrong'},'church');
  assert.equal((await auth.login(r,{password:'fixture-correct'},'family'))[0],200);
  assert.equal((await auth.login(r,{password:'fixture-correct'},'church'))[0],429);
 });
 test(id+': spaced failures outside the audit window must not create an unrecorded lock',async()=>{
  let time=Date.now();const auth=createNoteAuth({localId:id,getService:()=>service,now:()=>time,audit:{record(){}}});
  for(let i=0;i<5;i++){assert.equal((await auth.login(req('203.0.113.8'),{password:'wrong'}))[0],401);time+=14*60*1000;}
 });
 test(id+': fifth failure locks only trusted visitor IP, not other tunnel users',async()=>{
  let time=Date.now();const observed=[];
  const auth=createNoteAuth({localId:id,getService:()=>service,now:()=>time,audit:{record:(r,d)=>observed.push({...d,ip:requestInfo(r).ip})}});
  const a=req('203.0.113.10'),b=req('203.0.113.20');
  for(let i=0;i<5;i++)assert.equal((await auth.login(a,{password:'wrong'}))[0],i===4?429:401);
  assert.equal((await auth.login(a,{password:'fixture-correct'}))[0],429,'locked IP stays locked even with correct password');
  assert.equal((await auth.login(b,{password:'fixture-correct'}))[0],200,'different real visitor must not inherit proxy lock');
  assert.equal((await auth.login(req('203.0.113.10','::1'),{password:'fixture-correct'}))[0],429,'same visitor via another loopback socket is still locked');
  assert.equal(observed.filter(e=>e.outcome==='failure'&&e.ip==='203.0.113.10').length,5);
  time+=60*60*1000+1;assert.equal((await auth.login(a,{password:'fixture-correct'}))[0],200,'existing one-hour expiry preserved');
 });
 test(id+': one visitor pending attempts cannot exhaust another visitor budget',async()=>{
  const auth=createNoteAuth({localId:id,getService:()=>service,audit:{record(){}}});
  const result=await Promise.all([...Array.from({length:5},()=>auth.login(req('203.0.113.1'),{password:'wrong'})),auth.login(req('203.0.113.2'),{password:'fixture-correct'})]);
  assert.equal(result[5][0],200);
 });
 test(id+': untrusted, malformed or wrong-host forwarded IP cannot bypass socket lock',async()=>{
  for(const [peer,requestHost,initial]of [['192.0.2.20',host,'203.0.113.1'],['127.0.0.1','localhost','203.0.113.1'],['127.0.0.1',host,'invalid-ip']]){
   const auth=createNoteAuth({localId:id,getService:()=>service,audit:{record(){}}});
   for(let i=0;i<5;i++)await auth.login(req(initial,peer,requestHost),{password:'wrong'});
   const other=req(initial==='invalid-ip'?'also-invalid':'203.0.113.99',peer,requestHost);other.headers['x-forwarded-for']='203.0.113.77';
   assert.equal((await auth.login(other,{password:'fixture-correct'}))[0],429);
  }
 });
}
