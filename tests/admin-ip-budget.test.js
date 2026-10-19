'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {initialize,createFileStore,createService}=require('../server/note-local');
test('durable administrator attempt budgets are separated by validated visitor IP',async t=>{
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'admin-ip-budget-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const env={NOTE_AUTH_FILE:path.join(dir,'private','auth.json'),NOTE_ADMIN_PASSWORD_FILE:path.join(dir,'admin-fixture'),NOTE_PASSWORD:'fixture-note-password',NOTE2_PASSWORD:'fixture-note-password'};
 fs.writeFileSync(env.NOTE_ADMIN_PASSWORD_FILE,'fixture-admin-password',{mode:0o600});await initialize(env);const store=createFileStore(env);
 for(let i=0;i<10;i++)assert.equal(await store.consumeAdminAttempt('203.0.113.1'),true);
 assert.equal(await store.consumeAdminAttempt('203.0.113.1'),false);
 assert.equal(await store.consumeAdminAttempt('203.0.113.2'),true,'visitor B must not share visitor A durable budget');
 const service=createService(createFileStore(env));
 assert.ok(await service.login('admin','fixture-admin-password','default','203.0.113.3'),'actual verifier passes its visitor IP to durable store');
 await assert.rejects(()=>service.login('admin','fixture-admin-password','default','not-an-ip'));
});
