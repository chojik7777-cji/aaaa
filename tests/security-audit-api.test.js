'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('audit GET requires admin bearer verifier and caps response; rejects all writes',async()=>{
 const {createSecurityAuditHandler}=require('../server/security-audit-api'),seen=[];
 const h=createSecurityAuditHandler(()=>({tokenOk:async(id,t)=>{seen.push([id,t]);return t==='valid';}}),{audit:{latest:limit=>{assert.equal(limit,100);return [{id:'event'}];}}});
 async function call(method,authorization){let data;const r={setHeader(){},end(v){data=JSON.parse(v);}};await h({method,url:'/api/security-audit?limit=9999&token=valid',headers:{authorization}},r);return {status:r.statusCode,data};}
 assert.equal((await call('GET','')).status,401);assert.equal((await call('GET','Bearer bad')).status,401);
 assert.deepEqual(await call('GET','Bearer valid'),{status:200,data:{ok:true,records:[{id:'event'}]}});assert.deepEqual(seen.at(-1),['admin','valid']);
 for(const method of ['POST','PUT','DELETE','OPTIONS'])assert.equal((await call(method,'Bearer valid')).status,405);
 const portal=fs.readFileSync(require.resolve('../portal-server'),'utf8');assert.ok(portal.indexOf("pathname === '/api/security-audit'")<portal.indexOf("req.method === 'OPTIONS'"));
});
