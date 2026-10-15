'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {initialize,createFileStore,createService}=require('../server/note-local');
test('room CAS is durable and only adds the selected room; template/admin/note remain unchanged',async t=>{
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'note-room-cas-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const env={NOTE_AUTH_FILE:path.join(dir,'private','auth.json'),NOTE_ADMIN_PASSWORD_FILE:path.join(dir,'admin'),NOTE_PASSWORD:'old-note-pass',NOTE2_PASSWORD:'old-room-pass'};fs.writeFileSync(env.NOTE_ADMIN_PASSWORD_FILE,'admin-test-pass');await initialize(env);
 const root=path.join(dir,'rooms');for(const room of ['alpha','beta'])fs.mkdirSync(path.join(root,room),{recursive:true});
 const a=createService(createFileStore(env),Date.now,{roomRoot:root}),b=createService(createFileStore(env),Date.now,{roomRoot:root}),admin=await a.login('admin','admin-test-pass');
 const before=JSON.parse(fs.readFileSync(env.NOTE_AUTH_FILE,'utf8')),note=await a.login('note','old-note-pass'),alpha=await a.login('note2','old-room-pass','alpha'),beta=await a.login('note2','old-room-pass','beta');
 const rev=(await a.status(admin,'alpha')).find(n=>n.id==='note2').revision;
 const result=await Promise.allSettled([a.rotate(admin,'note2','changed-alpha','changed-alpha',rev,'alpha'),b.rotate(admin,'note2','other-alpha-pass','other-alpha-pass',rev,'alpha'),b.rotate(admin,'note2','changed-beta','changed-beta',rev,'beta')]);
 assert.equal(result.slice(0,2).filter(r=>r.status==='fulfilled').length,1);assert.equal(result.slice(0,2).find(r=>r.status==='rejected').reason.status,409);assert.equal(result[2].status,'fulfilled');
 const after=JSON.parse(fs.readFileSync(env.NOTE_AUTH_FILE,'utf8'));assert.deepEqual(after.rows,before.rows);assert.deepEqual(Object.keys(after.note2Rooms).sort(),['alpha','beta']);
 assert.notEqual(after.note2Rooms.alpha.token_key,after.note2Rooms.beta.token_key);assert.notEqual(after.note2Rooms.alpha.token_key,after.rows.note2.token_key);
 const reload=createService(createFileStore(env));assert.equal(await reload.tokenOk('note2',alpha,'alpha'),false);assert.equal(await reload.tokenOk('note2',beta,'beta'),false);assert.ok(await reload.tokenOk('note',note));assert.ok(await reload.tokenOk('admin',admin));assert.ok(await reload.login('note2','old-room-pass','unmodified-room'));
 const unchanged=fs.readFileSync(env.NOTE_AUTH_FILE,'utf8');await initialize(env);assert.equal(fs.readFileSync(env.NOTE_AUTH_FILE,'utf8'),unchanged);
 for(const room of ['__proto__','constructor','../bad','a'.repeat(51)])await assert.rejects(()=>reload.login('note2','old-room-pass',room),{status:400});
 after.note2Rooms.alpha.room='beta';fs.writeFileSync(env.NOTE_AUTH_FILE,JSON.stringify(after));await assert.rejects(()=>reload.login('note2','old-room-pass','alpha'));
});
