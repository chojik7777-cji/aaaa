'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createNoteFolderHandler}=require('../note-folder');
const {initialize}=require('../server/note-local');
async function call(handler,action,body,token='',room='default'){
 const res={setHeader(){},end(v){this.data=JSON.parse(v);}};
 await handler({method:body===undefined?'GET':'POST',url:`/api/note/${action}?room=${room}`,headers:{'x-note-token':token},body},res);
 return {status:res.statusCode,data:res.data};
}
async function fixture(t,id){
 const tmp=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'note-rename-')));t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
 const root=path.join(tmp,id),room=id==='note'?'default':'alpha',dir=id==='note'?root:path.join(root,room);fs.mkdirSync(dir,{recursive:true});
 const env={NOTE_AUTH_FILE:path.join(tmp,'private/auth.json'),NOTE_ADMIN_PASSWORD_FILE:path.join(tmp,'admin'),NOTE_PASSWORD:'fixture-pass',NOTE2_PASSWORD:'fixture-pass',NOTE2_DIR:root};fs.writeFileSync(env.NOTE_ADMIN_PASSWORD_FILE,'fixture-admin');await initialize(env);
 const previous=Object.fromEntries(['NOTE_AUTH_FILE','NOTE2_DIR','VERCEL'].map(k=>[k,process.env[k]]));Object.assign(process.env,{NOTE_AUTH_FILE:env.NOTE_AUTH_FILE,NOTE2_DIR:root,VERCEL:''});t.after(()=>{for(const[k,v]of Object.entries(previous))if(v===undefined)delete process.env[k];else process.env[k]=v;});
 const handler=createNoteFolderHandler(root,{localId:id,roomFolders:id==='note2'}),login=await call(handler,'login',{password:'fixture-pass'},'',room);assert.equal(login.status,200);
 const token=login.data.token,request=(action,body,tok=token,r=room)=>call(handler,action,body,tok,r);
 await request('upload',{name:'original.PDF',user:'uploader',dataUrl:'data:application/pdf;base64,AAEC/w=='});
 return {tmp,root,dir,env,request};
}
test('local Finder-file rename cannot inherit stale target uploader metadata',async t=>{
 const f=await fixture(t,'note'),metaPath=path.join(f.dir,'.note-meta.json'),meta=JSON.parse(fs.readFileSync(metaPath));
 fs.writeFileSync(path.join(f.dir,'finder.pdf'),'finder');meta.uploads['new.pdf']='stale-user';fs.writeFileSync(metaPath,JSON.stringify(meta));
 const r=await f.request('rename-file',{id:'finder.pdf',name:'new.pdf'});assert.equal(r.status,200);assert.equal(r.data.files.find(x=>x.id==='new.pdf').uploadedBy,'');
});
for(const failure of ['link-race','meta-write','source-unlink'])test(`local rename rolls back safely on ${failure}`,async t=>{
 const f=await fixture(t,'note'),source=path.join(f.dir,'original.PDF'),target=path.join(f.dir,'new.pdf'),metaPath=path.join(f.dir,'.note-meta.json'),before=fs.readFileSync(metaPath);
 const method=failure==='link-race'?'linkSync':failure==='meta-write'?'writeFileSync':'unlinkSync',real=fs[method];let injected=false;
 fs[method]=function(...args){if(!injected&&((method==='linkSync')||(method==='writeFileSync'&&args[0]===metaPath)||(method==='unlinkSync'&&args[0]===source))){injected=true;if(failure==='link-race'){fs.writeFileSync(target,'racer');throw Object.assign(new Error('exists'),{code:'EEXIST'});}throw new Error('injected failure');}return real.apply(this,args);};
 let r;try{r=await f.request('rename-file',{id:'original.PDF',name:'new.pdf'});}finally{fs[method]=real;}
 assert.equal(r.status,failure==='link-race'?409:400);assert.deepEqual(fs.readFileSync(metaPath),before);assert.deepEqual(fs.readFileSync(source),Buffer.from([0,1,2,255]));if(failure==='link-race')assert.equal(fs.readFileSync(target,'utf8'),'racer');else assert.equal(fs.existsSync(target),false);
});
for(const id of ['note','note2'])test(`${id} rejects invalid names, targets, collisions and wrong grants without mutation`,async t=>{
 const f=await fixture(t,id),meta=fs.readFileSync(path.join(f.dir,'.note-meta.json'));
 const rename=(name,source='original.PDF',token)=>f.request('rename-file',{id:source,name,user:'editor'},token);
 for(const name of ['', '   ', '.hidden.pdf','../escape.pdf','a/b.pdf','a\\b.pdf','a\u0000.pdf','a\n.pdf','backup','a.txt','가'.repeat(90)+'.pdf','a'.repeat(161)+'.pdf',null,{},'new..pdf','x:.pdf'])assert.equal((await rename(name)).status,400,JSON.stringify(name));
 for(const [name,kind]of [['occupied.pdf','file'],['directory.pdf','directory'],['link.pdf','link'],['dangling.pdf','dangling']]){
  const p=path.join(f.dir,name);if(kind==='file')fs.writeFileSync(p,'keep');else if(kind==='directory')fs.mkdirSync(p);else fs.symlinkSync(kind==='link'?path.join(f.dir,'original.PDF'):path.join(f.tmp,'absent'),p);
  assert.equal((await rename(name)).status,409,name);
 }
 for(const source of ['missing.pdf','../original.PDF','.note-meta.json','backup','directory.pdf','link.pdf','dangling.pdf'])assert.equal((await rename('safe.pdf',source)).status,404,source);
 assert.equal((await rename('safe.pdf','original.PDF','')).status,401);
 const wrong=await f.request('rename-file',{id:'original.PDF',name:'safe.pdf'},undefined,'other');assert.ok([401,404].includes(wrong.status));
 assert.deepEqual(fs.readFileSync(path.join(f.dir,'.note-meta.json')),meta);assert.deepEqual(fs.readFileSync(path.join(f.dir,'original.PDF')),Buffer.from([0,1,2,255]));assert.equal(fs.readFileSync(path.join(f.dir,'occupied.pdf'),'utf8'),'keep');
});
for(const id of ['note','note2'])test(`${id} rename physically preserves bytes/mtime/uploader/archive and returns new id with one version`,async t=>{
 const f=await fixture(t,id),before=(await f.request('state')).data,st=fs.statSync(path.join(f.dir,'original.PDF')),auth=fs.readFileSync(f.env.NOTE_AUTH_FILE),backup=fs.readdirSync(path.join(f.dir,'backup'));
 const r=await f.request('rename-file',{id:'original.PDF',name:'새 이름.pdf',user:'editor'});assert.equal(r.status,200);
 assert.equal(r.data.version,before.version+1);assert.equal(r.data.updatedBy,'editor');assert.equal(r.data.files[0].id,'새 이름.pdf');assert.equal(r.data.files[0].uploadedBy,'uploader');assert.equal(r.data.files[0].uploadedAt,st.mtimeMs);
 assert.deepEqual(fs.readFileSync(path.join(f.dir,'새 이름.pdf')),Buffer.from([0,1,2,255]));assert.equal(fs.existsSync(path.join(f.dir,'original.PDF')),false);
 assert.deepEqual(fs.readdirSync(path.join(f.dir,'backup')),backup);assert.deepEqual(fs.readFileSync(path.join(f.dir,'backup',backup[0])),Buffer.from([0,1,2,255]));assert.deepEqual(fs.readFileSync(f.env.NOTE_AUTH_FILE),auth);
 const meta=JSON.parse(fs.readFileSync(path.join(f.dir,'.note-meta.json')));assert.deepEqual(meta.uploads,{'새 이름.pdf':'uploader'});
 const noop=await f.request('rename-file',{id:'새 이름.pdf',name:'새 이름.pdf',user:'other'});assert.deepEqual(noop.data,r.data);
});
