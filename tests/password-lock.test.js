'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createPasswordLock,LOCK_MS}=require('../server/password-lock');
const req=ip=>({socket:{remoteAddress:ip},headers:{host:'localhost'}});
test('lock counts only failures inside the same sliding fifteen-minute audit window',async()=>{
 let time=Date.now();const lock=createPasswordLock({now:()=>time}),r=req('192.0.2.8');
 for(let i=0;i<5;i++){assert.equal((await lock(r,'admin',async()=>false)).locked,false);time+=14*60*1000;}
 for(let i=0;i<4;i++)assert.equal((await lock(r,'admin',async()=>false)).locked,i===3);
});
test('common lock reserves concurrent attempts and isolates IPs',async()=>{
 const lock=createPasswordLock();let checked=0;
 const results=await Promise.all([...Array.from({length:12},()=>lock(req('192.0.2.1'),'admin',async()=>{checked++;return false})),lock(req('192.0.2.2'),'admin',async()=>true)]);
 assert.equal(checked,5);assert.equal(results.filter(r=>r.verified&&!r.value).length,5);assert.equal(results[12].value,true);
 assert.equal((await lock(req('192.0.2.1'),'admin',async()=>true)).locked,true);
});
test('common lock expires after one hour and verifier errors never consume failure budget',async()=>{
 let time=Date.now();const lock=createPasswordLock({now:()=>time}),r=req('192.0.2.1');
 for(let i=0;i<6;i++)await assert.rejects(()=>lock(r,'admin',async()=>{throw {status:503}}));
 for(let i=0;i<5;i++){const result=await lock(r,'admin',async()=>false);assert.equal(result.verified,true);assert.equal(result.locked,i===4);}
 time+=LOCK_MS+1;assert.equal((await lock(r,'admin',async()=>true)).value,true);
});
test('capacity never evicts an active visitor lock to admit a new visitor',async()=>{
 let time=Date.now();const lock=createPasswordLock({now:()=>time,maxKeys:1});
 for(let i=0;i<5;i++)await lock(req('192.0.2.1'),'admin',async()=>false);
 assert.equal((await lock(req('192.0.2.2'),'admin',async()=>true)).locked,true);
 assert.equal((await lock(req('192.0.2.1'),'admin',async()=>true)).locked,true);
 time+=LOCK_MS+1;assert.equal((await lock(req('192.0.2.2'),'admin',async()=>true)).value,true);
});
