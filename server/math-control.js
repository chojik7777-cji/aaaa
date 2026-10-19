'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {runtimeService,hashPassword,validPassword}=require('./note-local');
const {recordAuth}=require('./security-audit');
const {createPasswordLock,runtimePasswordLock,LOCK_MESSAGE}=require('./password-lock');
const scrypt=require('node:util').promisify(crypto.scrypt);
const badRequest=()=>Object.assign(new Error('Invalid request'),{status:400});
async function readJSON(req){
 let body=req.body;
 if(body===undefined){
  let size=0;const chunks=[];
  if(typeof req[Symbol.asyncIterator]!=='function')throw badRequest();
  for await(const part of req){const chunk=Buffer.isBuffer(part)?part:Buffer.from(part);size+=chunk.length;if(size>16384)throw Object.assign(new Error('Body too large'),{status:413});chunks.push(chunk);}
  body=Buffer.concat(chunks).toString('utf8');
 }
 if(typeof body==='string'){if(Buffer.byteLength(body)>16384)throw Object.assign(new Error('Body too large'),{status:413});try{body=JSON.parse(body);}catch{throw badRequest();}}
 if(!body||typeof body!=='object'||Array.isArray(body))throw badRequest();
 if(Buffer.byteLength(JSON.stringify(body))>16384)throw Object.assign(new Error('Body too large'),{status:413});
 return body;
}
function validate(body,action){
 if(!validPassword(body[action==='set'?'adminPassword':'password']))throw badRequest();
 if(action!=='set')return;
 for(const key of ['unlockPassword','limitPassword'])if(body[key]!==undefined&&(typeof body[key]!=='string'||Buffer.byteLength(body[key])>256))throw badRequest();
 if(body.locked!==undefined&&typeof body.locked!=='boolean')throw badRequest();
 if(body.message!==undefined&&typeof body.message!=='string')throw badRequest();
 if(body.questionLimit!==undefined&&!(typeof body.questionLimit==='number'&&Number.isFinite(body.questionLimit)))throw badRequest();
}
const queues=new Map();
function send(res,status,data){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data));}
function createMathControl({getService=runtimeService,audit,dir=path.join(os.homedir(),'.config','aaaa'),now=Date.now,lock,env=process.env}={}){
 dir=path.resolve(dir);const file=path.join(dir,'math-control.json');
 const run=lock||(now===Date.now?runtimePasswordLock:createPasswordLock({now}));
 async function authenticate(req,scope,details,verify){
  let result;
  try{result=await run(req,scope,verify);}catch(e){if(e.status===429)recordAuth(req,{...details,outcome:'rate_limit'},audit);throw e;}
  recordAuth(req,{...details,outcome:!result.verified?'rate_limit':result.value?'success':'failure'},audit);
  return result;
 }
 const publicState=s=>({ok:true,locked:s.locked,message:s.message,questionLimit:s.questionLimit,version:s.version,updatedAt:s.updatedAt});
 const unavailable=()=>Object.assign(new Error('Unsafe math storage'),{status:503});
 function check(st,directory){if(st.isSymbolicLink()||!(directory?st.isDirectory():st.isFile())||st.uid!==process.getuid()||(st.mode&0o777)!==(directory?0o700:0o600))throw unavailable();}
 function prepare(){
  const root=path.resolve(__dirname,'..');
  if(env.VERCEL||dir===root||dir.startsWith(root+path.sep))throw unavailable();
  fs.mkdirSync(dir,{recursive:true,mode:0o700});check(fs.lstatSync(dir),true);if(fs.realpathSync(dir)!==dir)throw unavailable();
 }
 function validVerifier(v){return v&&Object.keys(v).sort().join(',')==='algorithm,hash,salt'&&v.algorithm==='scrypt'&&/^[a-f0-9]{32}$/.test(v.salt)&&/^[a-f0-9]{64}$/.test(v.hash);}
 function validState(s){return s&&Object.keys(s).sort().join(',')==='limitVerifier,locked,message,questionLimit,unlockVerifier,updatedAt,version'&&typeof s.locked==='boolean'&&typeof s.message==='string'&&s.message.length<=180&&Number.isInteger(s.questionLimit)&&s.questionLimit>=0&&s.questionLimit<=999&&Number.isSafeInteger(s.version)&&s.version>=0&&Number.isFinite(s.updatedAt)&&validVerifier(s.unlockVerifier)&&validVerifier(s.limitVerifier);}
 function write(s){prepare();const temp=file+'.'+crypto.randomUUID()+'.tmp';let fd;try{fd=fs.openSync(temp,'wx',0o600);fs.writeFileSync(fd,JSON.stringify(s));fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;fs.renameSync(temp,file);const d=fs.openSync(dir,'r');try{fs.fsyncSync(d);}finally{fs.closeSync(d);}}finally{if(fd!==undefined)fs.closeSync(fd);try{fs.unlinkSync(temp);}catch(e){if(e.code!=='ENOENT')throw e;}}}
 async function read(){
  prepare();let fd;
  try{fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);const st=fs.fstatSync(fd);check(st,false);if(st.size>16384)throw unavailable();const s=JSON.parse(fs.readFileSync(fd,'utf8'));if(!validState(s))throw unavailable();return s;}
  catch(e){if(e.code!=='ENOENT')throw unavailable();}
  finally{if(fd!==undefined)fs.closeSync(fd);}
  const s={locked:false,message:'비번을 입력하세요',questionLimit:5,version:0,updatedAt:now(),unlockVerifier:await hashPassword(env.MATH_UNLOCK_PASSWORD||'1212'),limitVerifier:await hashPassword(env.MATH_LIMIT_PASSWORD||'1414')};write(s);return s;
 }
 async function handle(req,res){
  let storageLock;
  try{
   const url=new URL(req.url,'http://localhost'),action=(url.searchParams.get('action')||url.pathname.split('/math-control/')[1]||'status').replace(/^\/+|\/+$/g,'');
   if(!['status','set','unlock','limit-unlock'].includes(action))return send(res,404,{ok:false,error:'지원하지 않는 요청입니다.'});
   if(req.method!==(action==='status'?'GET':'POST'))return send(res,405,{ok:false,error:'지원하지 않는 메서드입니다.'});
   const body=action==='status'?{}:await readJSON(req);if(action!=='status')validate(body,action);
   prepare();storageLock=fs.openSync(file+'.lock','wx',0o600);
   const s=await read();
   if(action==='status'&&req.method==='GET')return send(res,200,publicState(s));
   if(action==='set'&&req.method==='POST'){
    const result=await authenticate(req,'admin',{page:'math-control.html',scope:'admin'},async ip=>(await getService()).login('admin',body.adminPassword,'default',ip));
    if(!result.value)return send(res,result.locked?429:403,{ok:false,error:result.locked?LOCK_MESSAGE:'비밀번호가 맞지 않습니다.'});
    s.locked=!!body.locked;if(body.message!=null)s.message=String(body.message).trim().slice(0,180)||'비번을 입력하세요';
    if(body.questionLimit!=null){const n=Math.max(0,Math.min(999,Math.floor(Number(body.questionLimit))));if(Number.isFinite(n))s.questionLimit=n;}
    if(body.unlockPassword?.trim())s.unlockVerifier=await hashPassword(body.unlockPassword.trim());
    if(body.limitPassword?.trim())s.limitVerifier=await hashPassword(body.limitPassword.trim());
    s.version++;s.updatedAt=now();write(s);return send(res,200,publicState(s));
   }
   if(['unlock','limit-unlock'].includes(action)&&req.method==='POST'){
    const isLimit=action==='limit-unlock',v=s[isLimit?'limitVerifier':'unlockVerifier'];
    const result=await authenticate(req,isLimit?'math-limit':'math-unlock',{page:'math-level.html',room:isLimit?'question-limit':'control-unlock'},async()=>{
     const hash=await scrypt(body.password,v.salt,32,{N:32768,r:8,p:1,maxmem:64*1024*1024});
     return crypto.timingSafeEqual(hash,Buffer.from(v.hash,'hex'));
    });
    return send(res,result.value?200:result.locked?429:403,result.value?{...publicState(s),[isLimit?'limitUnlocked':'unlocked']:true}:{ok:false,error:result.locked?LOCK_MESSAGE:'비밀번호가 맞지 않습니다.'});
   }
   return send(res,404,{ok:false,error:'지원하지 않는 요청입니다.'});
  }catch(e){return send(res,[400,413,429].includes(e.status)?e.status:503,{ok:false,error:[400,413].includes(e.status)?'잘못된 요청입니다.':e.status===429?'시도 횟수가 많습니다. 15분 뒤 다시 시도해 주세요.':'로컬 저장소를 사용할 수 없습니다.'});}
  finally{if(storageLock!==undefined){fs.closeSync(storageLock);fs.unlinkSync(file+'.lock');}}
 }
 // Serialize instances sharing the same private file; reject other processes via wx.
 return (req,res)=>{
  const next=(queues.get(file)||Promise.resolve()).then(()=>handle(req,res));
  const tail=next.catch(()=>{});queues.set(file,tail);
  tail.then(()=>{if(queues.get(file)===tail)queues.delete(file);});return next;
 };
}
module.exports={createMathControl};
