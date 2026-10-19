'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
async function call(handler,id,action,body,token='',room='alpha'){
 const res={setHeader(){},end(v){this.data=JSON.parse(v);}};
 await handler({method:body===undefined?'GET':'POST',url:`/api/${id}/${action}?room=${room}`,headers:{'x-note-token':token},body},res);return {status:res.statusCode,data:res.data};
}
async function fixture(t,id){
 const keys=['NOTE_PASSWORD','NOTE2_PASSWORD','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'],before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));Object.assign(process.env,{NOTE_PASSWORD:'fixture-pass',NOTE2_PASSWORD:'fixture-pass',SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture-not-secret'});t.after(()=>{for(const[k,v]of Object.entries(before))if(v===undefined)delete process.env[k];else process.env[k]=v;});
 const files=[{id:'stable-id',room:'alpha',name:'original.PDF',path:'alpha/stable-original.PDF',data:'AAEC/w==',type:'application/pdf',size:4,uploaded_at:'2026-01-01',uploaded_by:'uploader',uploadedAt:100,uploadedBy:'uploader'},{id:'occupied',room:'alpha',name:'occupied.pdf'},{id:'sibling',room:'beta',name:'original.PDF'}],notes=[{room:'alpha',text:'keep',version:7,updated_at:'before',updated_by:'before'},{room:'beta',text:'other',version:8}],requests=[];
 let handler;
 if(id==='note'){
  handler=require('../api/note');const map=globalThis.__COLLAB_NOTES__,old=new Map(map);map.clear();for(const n of notes)map.set(n.room,{...n,updatedAt:100,updatedBy:'before',files:files.filter(f=>f.room===n.room)});t.after(()=>{map.clear();for(const[k,v]of old)map.set(k,v);});
 }else{
  const realFetch=global.fetch;global.fetch=async(url,opts={})=>{
   const u=new URL(url);assert.equal(u.origin,'https://fixture.invalid');assert.ok(!u.pathname.includes('/storage/'),'rename must never move/read storage');requests.push({url,opts});const table=u.pathname.endsWith('collab_files')?files:notes;
   const rows=table.filter(row=>[...u.searchParams].every(([k,v])=>!v.startsWith('eq.')||String(row[k])===v.slice(3)));
   if(opts.method==='PATCH')for(const row of rows)Object.assign(row,JSON.parse(opts.body));
   return {ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>structuredClone(rows)};
  };t.after(()=>{global.fetch=realFetch;});delete require.cache[require.resolve('../api/note2')];handler=require('../api/note2');t.after(()=>delete require.cache[require.resolve('../api/note2')]);
 }
 const login=await call(handler,id,'login',{password:'fixture-pass'});assert.equal(login.status,200);const token=login.data.token;
 return {files,notes,requests,request:(action,body,tok=token,room='alpha')=>call(handler,id,action,body,tok,room)};
}
for(const id of ['note','note2'])test(`cloud ${id} rejects unsafe names, collisions, wrong-room ids and unauthenticated requests`,async t=>{
 const f=await fixture(t,id),before=structuredClone(f.files),state=(await f.request('state')).data;
 for(const name of ['', ' ', '.hidden.pdf','../x.pdf','a/b.pdf','a\\b.pdf','a\n.pdf','a\u0000.pdf','backup','BACKUP','a.txt','가'.repeat(90)+'.pdf','x'.repeat(id==='note'?121:161)+'.pdf',null,{}])assert.equal((await f.request('rename-file',{id:'stable-id',name})).status,400,JSON.stringify(name));
 assert.equal((await f.request('rename-file',{id:'stable-id',name:'occupied.pdf'})).status,409);
 assert.equal((await f.request('rename-file',{id:'sibling',name:'new.pdf'})).status,404);
 assert.equal((await f.request('rename-file',{id:'stable-id',name:'new.pdf'},undefined,'beta')).status,404);
 assert.equal((await f.request('rename-file',{id:'stable-id',name:'new.pdf'},'')).status,401);
 assert.deepEqual(f.files,before);assert.deepEqual((await f.request('state')).data,state);
 assert.equal(f.requests.filter(x=>x.opts.method==='PATCH').length,0);
});
for(const id of ['note','note2'])test(`cloud ${id} renames metadata only, stable id/path/uploader, scoped room and no-op version`,async t=>{
 const f=await fixture(t,id),before=(await f.request('state')).data,original=structuredClone(f.files[0]),sibling=structuredClone(f.files[2]);
 const r=await f.request('rename-file',{id:'stable-id',name:'새 이름.pdf',user:'editor'});assert.equal(r.status,200);assert.equal(r.data.files.find(x=>x.id==='stable-id').name,'새 이름.pdf');assert.equal(r.data.version,before.version+1);assert.equal(r.data.updatedBy,'editor');
 assert.deepEqual(f.files[0],{...original,name:'새 이름.pdf'});assert.deepEqual(f.files[2],sibling);
 const noop=await f.request('rename-file',{id:'stable-id',name:'새 이름.pdf',user:'other'});assert.deepEqual(noop.data,r.data);
 if(id==='note2'){const patches=f.requests.filter(x=>x.opts.method==='PATCH'&&x.url.includes('collab_files'));assert.equal(patches.length,1);const u=new URL(patches[0].url);assert.equal(u.searchParams.get('room'),'eq.alpha');assert.equal(u.searchParams.get('id'),'eq.stable-id');assert.deepEqual(JSON.parse(patches[0].opts.body),{name:'새 이름.pdf'});}
});
