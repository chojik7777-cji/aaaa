'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),{spawn}=require('node:child_process');
test('real portal delete revokes both room identities while retaining originals/backups and protecting defaults',{timeout:45000},async t=>{
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'delete-portal-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));fs.writeFileSync(path.join(dir,'admin'),'fixture-admin');
 const env={...process.env,HOME:dir,HOST:'127.0.0.1',PORT:'0',NOTE_AUTH_FILE:path.join(dir,'private','auth.json'),NOTE_ADMIN_PASSWORD_FILE:path.join(dir,'admin'),NOTE_DIR:path.join(dir,'a'),NOTE2_DIR:path.join(dir,'b'),NOTE_PASSWORD:'fixture-note',NOTE2_PASSWORD:'fixture-note2',AAAA_SECURITY_DIR:path.join(dir,'audit')};delete env.VERCEL;
 const probe=http.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));env.PORT=String(probe.address().port);await new Promise(r=>probe.close(r));
 const child=spawn(process.execPath,['portal-server.js'],{cwd:path.join(__dirname,'..'),env,stdio:['ignore','ignore','pipe']});let stderr='';child.stderr.on('data',x=>stderr+=x);t.after(async()=>{if(child.exitCode!==null)return;child.kill('SIGTERM');await new Promise(r=>child.once('exit',r))});
 const base='http://127.0.0.1:'+env.PORT;let ready=false;
 for(let i=0;i<120;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break}}catch{}if(child.exitCode!==null)throw new Error('isolated portal failed');await new Promise(r=>setTimeout(r,30))}assert.ok(ready);
 async function req(url,body,token){const r=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token,'X-Note-Token':token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()}}
 const admin=(await req('/api/note-admin?action=login',{password:'fixture-admin'})).data.token;assert.ok(admin);const tokens={};
 for(const id of ['note','note2']){
  assert.equal((await req('/api/note-admin?action=create&room=alpha',{id,room:'alpha',password:'room-fixture',confirmation:'room-fixture'},admin)).status,201);
  tokens[id]=(await req('/api/'+id+'/login?room=alpha',{password:'room-fixture'})).data.token;assert.ok(tokens[id]);
  assert.equal((await req('/api/'+id+'/save?room=alpha',{text:'preserved-'+id},tokens[id])).status,200);
  assert.equal((await req('/api/'+id+'/upload?room=alpha',{name:'keep.txt',dataUrl:'data:text/plain;base64,'+Buffer.from('retained-'+id).toString('base64')},tokens[id])).status,200);
 }
 const snapshot=()=>{const out={};function walk(p){if(!fs.existsSync(p))return;for(const e of fs.readdirSync(p,{withFileTypes:true})){const f=path.join(p,e.name);if(e.isDirectory())walk(f);else out[f]=fs.readFileSync(f).toString('hex')}}walk(env.NOTE_DIR);walk(env.NOTE2_DIR);return out};const before=snapshot();
 for(const id of ['note','note2']){
  const info=await req('/api/note-admin?action=status&id='+id+'&room=alpha',undefined,admin);assert.equal(info.status,200);const revision=info.data.notes.find(n=>n.id===id).revision;
  const payload={id,room:'alpha',confirmation:'alpha',revision};
  assert.equal((await req('/api/note-admin?action=delete-room&room=alpha',payload)).status,401);
  assert.equal((await req('/api/note-admin?action=delete-room&room=alpha',payload,admin)).status,200);
  for(const [action,body]of [['state',undefined],['save',{text:'blocked'}],['upload',{name:'bad',dataUrl:'data:text/plain;base64,eA=='}]])assert.equal((await req('/api/'+id+'/'+action+'?room=alpha',body,tokens[id])).status,401);
  assert.equal((await req('/api/'+id+'/login?room=alpha',{password:'room-fixture'})).status,401);
  assert.equal((await req('/api/note-admin?action=create&room=alpha',{id,room:'alpha',password:'new-fixture',confirmation:'new-fixture'},admin)).status,409);
  const list=await req('/api/note-admin?action=status&id='+id+'&room=default',undefined,admin);assert.equal(list.status,200);assert.ok(!(id==='note'?list.data.noteRooms:list.data.rooms).includes('alpha'));
  assert.equal((await req('/api/note-admin?action=delete-room&room=default',{id,room:'default',confirmation:'default',revision:'irrelevant'},admin)).status,400);
  if(id==='note')assert.equal((await req('/api/note2/state?room=alpha',undefined,tokens.note2)).status,200);
 }
 assert.deepEqual(snapshot(),before);assert.ok(Object.keys(before).some(f=>f.includes('/backup/')));assert.ok(!stderr.includes('Unhandled'));
});
