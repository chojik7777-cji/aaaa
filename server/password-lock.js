'use strict';
const {requestInfo}=require('./security-audit');
const MAX_FAILS=5,LOCK_MS=60*60*1000,WINDOW_MS=15*60*1000;
const LOCK_MESSAGE='비밀번호를 5회 틀려 해당 IP의 로그인이 1시간 동안 잠겼습니다.';
function createPasswordLock(options={}){
 const now=options.now||Date.now,rows=new Map(),maxKeys=options.maxKeys||10000;
 return async function run(req,scope,verify){
  const ip=requestInfo(req).ip,key=ip+'\0'+scope;
  const blocked=f=>({value:null,verified:false,locked:true,count:f?.count||0,remaining:0,ip});
  let f=rows.get(key);
  if(!f){
   if(rows.size>=maxKeys)for(const [k,v]of rows)if(!v.pending&&v.until<=now()&&v.last+WINDOW_MS<=now())rows.delete(k);
   if(rows.size>=maxKeys)return blocked();
   f={count:0,times:[],last:0,until:0,pending:0,tail:Promise.resolve()};rows.set(key,f);
  }
  if(f.until>now()||f.pending>=MAX_FAILS)return blocked(f);
  f.pending++;
  const attempt=f.tail.then(async()=>{
   if(f.until>now())return blocked(f);
   f.times=f.times.filter(t=>t>now()-WINDOW_MS);f.count=f.times.length;
   const value=await verify(ip);
   if(value){f.times=[];f.count=0;f.last=now();return {value,verified:true,locked:false,count:0,remaining:MAX_FAILS,ip};}
   f.times.push(now());f.count=f.times.length;f.last=now();if(f.count>=MAX_FAILS)f.until=now()+LOCK_MS;
   return {value,verified:true,locked:f.until>now(),count:f.count,remaining:Math.max(0,MAX_FAILS-f.count),ip};
  });
  f.tail=attempt.catch(()=>{});
  try{return await attempt;}finally{f.pending--;if(!f.pending&&!f.count&&f.until<=now())rows.delete(key);}
 };
}
const runtimePasswordLock=createPasswordLock();
module.exports={createPasswordLock,runtimePasswordLock,MAX_FAILS,LOCK_MS,WINDOW_MS,LOCK_MESSAGE};
