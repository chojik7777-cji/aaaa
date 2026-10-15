'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {promisify}=require('node:util');
const scrypt=promisify(crypto.scrypt), IDS=['admin','note','note2'];
const validPassword=v=>typeof v==='string'&&v.length>0&&Buffer.byteLength(v)<=256;
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
const unavailable=()=>Object.assign(new Error('맥미니 로컬 비밀번호 저장소를 사용할 수 없습니다.'),{status:503});
async function hashPassword(password){
 if(!validPassword(password))throw Object.assign(new Error('잘못된 비밀번호입니다.'),{status:400});
 const salt=crypto.randomBytes(16).toString('hex');
 return {algorithm:'scrypt',salt,hash:(await scrypt(password,salt,32,{N:32768,r:8,p:1,maxmem:64*1024*1024})).toString('hex')};
}
async function verify(password,v){return validPassword(password)&&equal((await scrypt(password,v.salt,32,{N:32768,r:8,p:1,maxmem:64*1024*1024})).toString('hex'),v.hash);}
const {roomId,roomRoot,existingRoom}=require('./note-room');
function createService(store,now=Date.now,options={}){
 const root=options.roomRoot||roomRoot();
 const newRow=async(id,password,room)=>({id,...(id==='note2'?{room:roomId(room)}:{}),revision:crypto.randomUUID(),verifier:await hashPassword(password),token_key:crypto.randomBytes(32).toString('hex'),updated_at:new Date(now()).toISOString()});
 const checkPassword=(password,confirmation)=>{if(!validPassword(password)||password.length<8||password!==confirmation)throw {status:400};};
 async function get(id){if(!IDS.includes(id))throw Object.assign(new Error('잘못된 대상입니다.'),{status:400});try{const row=await store.get(id);if(!row)throw unavailable();return row;}catch{throw unavailable();}}
 async function roomRow(room){
  room=roomId(room);let custom;try{custom=store.getRoom?await store.getRoom(room):null;}catch{throw unavailable();}if(custom)return custom;
  const template=await get('note2');
  return {...template,room,token_key:crypto.createHmac('sha256',template.token_key).update('note2-room-v1:'+room).digest('hex')};
 }
 const sign=(row,payload)=>crypto.createHmac('sha256',row.token_key).update(payload).digest('hex');
 // User grants persist until revision/key rotation; only admin grants expire.
 function token(row){const p=Buffer.from(JSON.stringify({id:row.id,...(row.id==='note2'?{room:row.room}:{}),revision:row.revision,...(row.id==='admin'?{exp:now()+15*60*1000}:{})})).toString('base64url');return p+'.'+sign(row,p);}
 async function tokenOk(id,t,room='default'){
  if(typeof t!=='string'||t.length>1024)return false;
  const row=id==='note2'?await roomRow(room):await get(id),parts=t.split('.');if(parts.length!==2||!equal(sign(row,parts[0]),parts[1]))return false;
  try{const p=JSON.parse(Buffer.from(parts[0],'base64url'));return p.id===id&&(id!=='note2'||p.room===room)&&p.revision===row.revision&&(id!=='admin'||(Number.isFinite(p.exp)&&p.exp>now()));}catch{return false;}
 }
 return {
  async login(id,password,room='default'){if(id==='admin'&&!await store.consumeAdminAttempt())throw Object.assign(new Error('시도 횟수가 많습니다.'),{status:429});const row=id==='note2'?await roomRow(room):await get(id);return await verify(password,row.verifier)?token(row):null;},
  async hasRoom(room){roomId(room);try{return !!(store.getRoom&&await store.getRoom(room));}catch{throw unavailable();}},
  tokenOk,
  async rooms(t){if(!await tokenOk('admin',t))throw {status:401};return store.roomNames?await store.roomNames():[];},
  async status(t,room='default'){if(!await tokenOk('admin',t))throw {status:401};return Promise.all(['note','note2'].map(async id=>{const r=id==='note2'?await roomRow(room):await get(id);return {id,...(id==='note2'?{room:r.room}:{}),revision:r.revision,updatedAt:r.updated_at};}));},
  async createRoom(t,room,password,confirmation,physicalRoot=root){
   if(!await tokenOk('admin',t))throw {status:401};
   roomId(room);checkPassword(password,confirmation);
   const next=await newRow('note2',password,room);
   // The physical existence check runs inside the same synchronous store transaction
   // as create-if-absent. No public folder is created; first save/upload creates it.
   if(!await store.createRoom(room,next,()=>existingRoom(physicalRoot,room)))throw {status:409};
   return {room,updatedAt:next.updated_at};
  },
  async rotate(t,id,password,confirmation,revision,room='default',physicalRoot=root){
   if(!await tokenOk('admin',t))throw {status:401};
   if(!['note','note2'].includes(id))throw {status:400};checkPassword(password,confirmation);
   if(id==='note2'&&!existingRoom(physicalRoot,room)&&!await this.hasRoom(room))throw {status:404};
   const row=id==='note2'?await roomRow(room):await get(id);if(revision!==row.revision)throw {status:409};
   const next=await newRow(id,password,room);
   if(!await (id==='note2'?store.replaceRoom(room,revision,next,()=>existingRoom(physicalRoot,room)):store.replace(id,revision,next)))throw {status:409};return {id,...(id==='note2'?{room}:{}),revision:next.revision,updatedAt:next.updated_at};
  }
 };
}
function createFileStore(env=process.env){
 if(env.VERCEL)throw unavailable();
 const file=path.resolve(env.NOTE_AUTH_FILE||path.join(os.homedir(),'.config','aaaa','note-auth.json')),dir=path.dirname(file),root=path.resolve(__dirname,'..');
 // A misconfiguration must never place secrets under the public repository.
 if(file===root||file.startsWith(root+path.sep))throw unavailable();
 function privatePath(p,kind){const st=fs.lstatSync(p);if(st.isSymbolicLink()||!(kind==='dir'?st.isDirectory():st.isFile())||st.uid!==process.getuid()||(st.mode&0o777)!==(kind==='dir'?0o700:0o600))throw unavailable();}
 function prepare(){fs.mkdirSync(dir,{recursive:true,mode:0o700});privatePath(dir,'dir');if(fs.realpathSync(dir)!==dir)throw unavailable();}
 function validRow(r,id){return r?.id===id&&typeof r.revision==='string'&&r.revision.length>0&&r.verifier?.algorithm==='scrypt'&&/^[a-f0-9]{32}$/.test(r.verifier.salt)&&/^[a-f0-9]{64}$/.test(r.verifier.hash)&&/^[a-f0-9]{64}$/.test(r.token_key)&&typeof r.updated_at==='string';}
 // Validate every room record before any lookup: old uppercase/case-conflicting keys
 // must fail closed, never look like a missing custom password and inherit the template.
 function read(){
  prepare();privatePath(file,'file');const data=JSON.parse(fs.readFileSync(file,'utf8'));
  if(data.version!==1||!data.rows||!IDS.every(id=>validRow(data.rows[id],id)))throw unavailable();
  if(data.note2Rooms!==undefined&&(!data.note2Rooms||typeof data.note2Rooms!=='object'||Array.isArray(data.note2Rooms)||!Object.entries(data.note2Rooms).every(([room,r])=>roomId(room)===r.room&&validRow(r,'note2'))))throw unavailable();return data;
 }
 function write(data){
  const temp=file+'.'+crypto.randomUUID()+'.tmp';let fd;
  try{fd=fs.openSync(temp,'wx',0o600);fs.writeFileSync(fd,JSON.stringify(data));fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;fs.renameSync(temp,file);const d=fs.openSync(dir,'r');try{fs.fsyncSync(d);}finally{fs.closeSync(d);}}
  finally{if(fd!==undefined)fs.closeSync(fd);try{fs.unlinkSync(temp);}catch(e){if(e.code!=='ENOENT')throw e;}}
 }
 function transaction(fn){
  prepare();const lock=file+'.lock';let fd;
  try{fd=fs.openSync(lock,'wx',0o600);return fn();}catch(e){if(e.status===400)throw e;throw unavailable();}finally{if(fd!==undefined){fs.closeSync(fd);fs.unlinkSync(lock);}}
 }
 return {
  file,
  exists(){try{fs.lstatSync(file);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}},
  async get(id){return structuredClone(read().rows[id]);},
  async getRoom(room){roomId(room);const rooms=read().note2Rooms;return rooms&&Object.hasOwn(rooms,room)?structuredClone(rooms[room]):null;},
  async roomNames(){return Object.keys(read().note2Rooms||{});},
  async createRoom(room,row,physicalExists){roomId(room);return transaction(()=>{const data=read();if(physicalExists()||(data.note2Rooms&&Object.hasOwn(data.note2Rooms,room)))return false;data.note2Rooms??={};data.note2Rooms[room]=row;write(data);return true;});},
  async replaceRoom(room,rev,row,physicalExists=()=>false){roomId(room);return transaction(()=>{const data=read(),configured=data.note2Rooms&&Object.hasOwn(data.note2Rooms,room);if(!configured&&!physicalExists())return false;const current=configured?data.note2Rooms[room]:data.rows.note2;if(current.revision!==rev)return false;data.note2Rooms??={};data.note2Rooms[room]=row;write(data);return true;});},
  async initialize(rows){return transaction(()=>{if(this.exists()){read();return false;}write({version:1,rows:Object.fromEntries(rows.map(r=>[r.id,r]))});return true;});},
  async replace(id,rev,row){return transaction(()=>{const data=read();if(data.rows[id]?.revision!==rev)return false;data.rows[id]=row;write(data);return true;});},
  async consumeAdminAttempt(){return transaction(()=>{const data=read(),now=Date.now();let a=data.adminAttempts;if(!a||a.until<=now)a={count:0,until:now+15*60*1000};a.count++;data.adminAttempts=a;write(data);return a.count<=10;});},
  validate(){read();}
 };
}
// Startup/CLI only. HTTP handlers never initialize or fall back to old passwords.
async function initialize(env=process.env){
 const store=createFileStore(env);if(store.exists()){store.validate();return false;}
 const admin=fs.readFileSync(env.NOTE_ADMIN_PASSWORD_FILE||path.join(os.homedir(),'.dashboard_pw'),'utf8').trim();if(!validPassword(admin))throw unavailable();
 function password(id){
  const key=id==='note'?'NOTE_PASSWORD':'NOTE2_PASSWORD';if(env[key])return env[key];
  let dir=id==='note'?(env.NOTE_DIR||path.join(__dirname,'..','note','family')):(env.NOTE2_DIR||path.join(__dirname,'..','note2'));
  if(id==='note'&&!env.NOTE_DIR){
   const legacy=path.join(__dirname,'..','family');
   const exists=p=>{try{fs.lstatSync(p);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
   // Match portal's pre-migration source, but never move folders during standalone init.
   // Two locations are ambiguous: require an explicit NOTE_DIR/password instead of guessing.
   if(exists(legacy)){if(exists(dir))throw unavailable();dir=legacy;}
  }
  try{return fs.readFileSync(path.join(dir,'.note-password'),'utf8').trim()||'1313';}catch(e){if(e.code!=='ENOENT')throw e;return '1313';}
 }
 const rows=[];for(const id of IDS)rows.push({id,revision:crypto.randomUUID(),verifier:await hashPassword(id==='admin'?admin:password(id)),token_key:crypto.randomBytes(32).toString('hex'),updated_at:new Date().toISOString()});
 return store.initialize(rows);
}
const runtimeService=()=>createService(createFileStore());
module.exports={initialize,createFileStore,createService,hashPassword,validPassword,unavailable,runtimeService};
