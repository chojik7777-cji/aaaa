'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {initialize}=require('../server/note-local');
const {createNoteAuth}=require('../note-auth');
test('parallel local scrypt guesses share a bounded client budget and retain lockout',async t=>{
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'note-lockout-')));
 const env={NOTE_AUTH_FILE:path.join(dir,'private','auth.json'),NOTE_ADMIN_PASSWORD_FILE:path.join(dir,'admin'),NOTE_PASSWORD:'fixture-note-password',NOTE2_PASSWORD:'fixture-other-password'};
 fs.writeFileSync(env.NOTE_ADMIN_PASSWORD_FILE,'fixture-admin-password',{mode:0o600});
 await initialize(env);
 const saved=process.env.NOTE_AUTH_FILE;process.env.NOTE_AUTH_FILE=env.NOTE_AUTH_FILE;
 t.after(()=>{if(saved===undefined)delete process.env.NOTE_AUTH_FILE;else process.env.NOTE_AUTH_FILE=saved;fs.rmSync(dir,{recursive:true,force:true});});
 let now=Date.now();const auth=createNoteAuth({localId:'note',now:()=>now,audit:{record(){}}}),req={socket:{remoteAddress:'192.0.2.1'}};
 const attempts=Array.from({length:12},()=>auth.login(req,{password:'incorrect-fixture'}));
 // Excess requests, including a correct guess, cannot enter the full queue.
 const correct=auth.login(req,{password:env.NOTE_PASSWORD});
 const results=await Promise.all(attempts);
 assert.equal(results.filter(r=>r[0]===401).length,4);
 assert.equal(results.filter(r=>r[0]===429).length,8);
 assert.equal((await correct)[0],429);
 assert.equal((await auth.login(req,{password:env.NOTE_PASSWORD}))[0],429);
 // A correct guess accepted into the queue must recheck a lock set ahead of it.
 const queuedReq={socket:{remoteAddress:'192.0.2.2'}};
 for(let i=0;i<4;i++)assert.equal((await auth.login(queuedReq,{password:'incorrect-fixture'}))[0],401);
 const fifth=auth.login(queuedReq,{password:'incorrect-fixture'});
 const queuedCorrect=auth.login(queuedReq,{password:env.NOTE_PASSWORD});
 assert.equal((await fifth)[0],429);assert.equal((await queuedCorrect)[0],429);
 // A separate client is not locked; expiry permits authentication again.
 assert.equal((await auth.login({socket:{remoteAddress:'192.0.2.3'}},{password:env.NOTE_PASSWORD}))[0],200);
 now+=require('../note-auth').LOCK_MS+1;
 assert.equal((await auth.login(req,{password:env.NOTE_PASSWORD}))[0],200);
 const legacy=createNoteAuth({password:env.NOTE_PASSWORD});
 assert.equal(legacy.login(req,{password:env.NOTE_PASSWORD})[0],200);
});
