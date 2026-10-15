'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {createDashboardAuth}=require('../server/dashboard-auth');
test('dashboard uses note administrator verifier without disclosing token and fails closed',async()=>{
 const seen=[];
 const h=createDashboardAuth(()=>({login:async(id,p)=>{seen.push(id);if(p==='unavailable')throw new Error('private error');if(p==='limited')throw {status:429};return p==='admin-fixture'?'privileged-secret':null;}}));
 const s=http.createServer(h);await new Promise(r=>s.listen(0,'127.0.0.1',r));
 try{
  const base=`http://127.0.0.1:${s.address().port}`;
  for(const [password,status] of [['admin-fixture',200],['wrong',403],['unavailable',503],['limited',429]]){
   const r=await fetch(base,{method:'POST',body:JSON.stringify({password})});assert.equal(r.status,status);const t=await r.text();assert.ok(!t.includes('privileged-secret')&&!t.includes('private error'));assert.equal(JSON.parse(t).ok,status===200);
  }
  assert.ok(seen.every(x=>x==='admin'));
  assert.equal((await fetch(base)).status,405);
  assert.equal((await fetch(base,{method:'POST',body:'bad'})).status,400);
  assert.equal((await fetch(base,{method:'POST',body:'x'.repeat(2049)})).status,413);
 }finally{await new Promise(r=>s.close(r));}
});
test('all game status pages and detail admin share dashboard endpoint and portal routes it before static',()=>{
 const fs=require('node:fs'),path=require('node:path');
 for(const f of ['detail-admin-jik-2026.html','omok-dashboard.html','baduk-dashboard.html','yut-dashboard.html'])assert.ok(fs.readFileSync(path.join(__dirname,'..',f),'utf8').includes('/api/dashboard-auth'));
 assert.ok(fs.readFileSync(path.join(__dirname,'..','portal-server.js'),'utf8').includes("pathname === '/api/dashboard-auth'"));
});
