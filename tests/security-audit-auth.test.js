'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{Readable}=require('node:stream');
function request(body,url='/api/dashboard-auth'){const r=Readable.from([Buffer.from(typeof body==='string'?body:JSON.stringify(body))]);Object.assign(r,{url,method:'POST',headers:{host:'localhost',referer:'http://localhost/omok-dashboard.html'},socket:{remoteAddress:'127.0.0.1'}});return r;}
async function call(handler,req){let text='';const res={setHeader(){},end(v){text=v;}};await handler(req,res);return {status:res.statusCode,body:JSON.parse(text)};}
const service={login:async(id,p)=>{if(p==='broken')throw {status:503};if(p==='limited')throw {status:429};return p==='correct'?'TOKEN':null;}};
test('dashboard audits verified password outcomes only and labels verifier rate limits',async()=>{
 const events=[],audit={record:(r,d)=>events.push(d)},h=require('../server/dashboard-auth').createDashboardAuth(()=>service,{audit});
 for(const [p,status]of [['wrong',403],['correct',200],['broken',503],['limited',429],['',400]])assert.equal((await call(h,request({password:p}))).status,status);
 assert.deepEqual(events.map(e=>e.outcome),['failure','success','rate_limit']);assert.ok(events.every(e=>e.page==='omok-dashboard.html'));
});
test('local note fifth returning 429 is failure, subsequent lock is rate_limit; unknown room and malformed never count',async()=>{
 for(const id of ['note','note2']){
 const events=[],auth=require('../note-auth').createNoteAuth({localId:id,getService:()=>service,audit:{record:(r,d)=>events.push(d)},roomAllowed:async room=>room!=='absent'}),req=request({},'/api/'+id+'?action=login');
 assert.equal((await auth.login(req,{},'church'))[0],400);await auth.login(req,{password:'wrong'},'absent');assert.equal(events.length,0);
 await assert.rejects(auth.login(req,{password:'broken'},'church'));
 // A storage error and missing room must not exhaust the actual failure budget.
 for(let i=0;i<5;i++)assert.equal((await auth.login(req,{password:'wrong'},'church'))[0],i===4?429:401);
 assert.equal((await auth.login(req,{password:'wrong'},'church'))[0],429);
 assert.deepEqual(events.map(e=>e.outcome),['failure','failure','failure','failure','failure','rate_limit']);assert.ok(events.every(e=>e.page===id+'.html'&&e.room==='church'));
 }
});
test('admin login audits failures/success and no malformed/storage false failures',async()=>{
 const events=[],h=require('../server/note-admin').createAdminHandler(()=>service,{audit:{record:(r,d)=>events.push(d)}});
 for(const [p,status]of [['wrong',401],['correct',200],['broken',503],['limited',429],['',400]])assert.equal((await call(h,request({password:p},'/api/note-admin/login'))).status,status);
 assert.deepEqual(events.map(e=>e.outcome),['failure','success','rate_limit']);assert.ok(events.every(e=>e.page==='detail-admin-jik-2026.html'));
});
