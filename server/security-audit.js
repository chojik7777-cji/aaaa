'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{isIP}=require('node:net');
const WINDOW=15*60*1000,RETENTION=30*86400000;
const TRUSTED_TUNNEL='inn-analytical-split-juice.trycloudflare.com';
const PAGES=new Set(['detail-admin-jik-2026.html','omok-dashboard.html','baduk-dashboard.html','yut-dashboard.html','note.html','note2.html','math-control.html','math-level.html']);
const clean=v=>String(v||'').replace(/[\x00-\x1f\x7f]/g,'').slice(0,256);
function requestInfo(req){
 const raw=req.socket?.remoteAddress||'',peer=isIP(raw)?raw:'unknown',host=req.headers?.host;
 // Proxy trust assumption, NOT proof: a local caller can spoof Host and CF headers.
 // Restrict local origin access operationally; X-Forwarded-For is never trusted.
 const loopback=peer==='::1'||peer==='127.0.0.1'||peer==='::ffff:127.0.0.1',cf=req.headers?.['cf-connecting-ip'];
 const trusted=loopback&&host===TRUSTED_TUNNEL&&typeof cf==='string'&&!!isIP(cf);
 let endpoint='/';try{endpoint=new URL(req.url||'/','http://localhost').pathname;}catch{}
 return {ip:trusted?cf:peer,peer,ipSource:trusted?'cf-connecting-ip (trusted-local-proxy assumption)':'socket',endpoint:clean(endpoint),userAgent:clean(req.headers?.['user-agent'])};
}
function dashboardPage(req,body={}){
 const posted=typeof body.page==='string'?body.page.replace(/^\//,''):'';
 if(PAGES.has(posted))return posted;
 try{const ref=new URL(req.headers?.referer),host=req.headers?.host,origin=(req.socket?.encrypted||host===TRUSTED_TUNNEL?'https:':'http:')+'//'+host;
 if(ref.origin===origin&&PAGES.has(ref.pathname.slice(1)))return ref.pathname.slice(1);
 }catch{}
 return PAGES.has(body.page)?body.page:'dashboard';
}
function createSecurityAudit(options={}){
 const dir=path.resolve(options.dir||path.join(os.homedir(),'.config','aaaa','security')),file=path.join(dir,'audit.json'),now=options.now||Date.now;
 const maxEvents=Math.min(options.maxEvents||2000,2000),maxKeys=Math.min(options.maxKeys||10000,10000),maxTimes=Math.min(options.maxTimes||100,100);
 const root=path.resolve(__dirname,'..');if(dir===root||dir.startsWith(root+path.sep))throw new Error('Audit directory must be outside repository');
 function check(p,directory){const s=fs.lstatSync(p);if(s.isSymbolicLink()||!(directory?s.isDirectory():s.isFile())||s.uid!==process.getuid()||(s.mode&0o777)!==(directory?0o700:0o600))throw new Error('Unsafe audit storage');}
 function prepare(){fs.mkdirSync(dir,{recursive:true,mode:0o700});check(dir,true);if(fs.realpathSync(dir)!==dir)throw new Error('Unsafe audit directory');}
 function read(){prepare();try{check(file,false);if(fs.statSync(file).size>32*1024*1024)throw new Error('Oversized audit state');const data=JSON.parse(fs.readFileSync(file,'utf8'));if(data.version!==1||!data.counters||!Array.isArray(data.events))throw new Error('Invalid audit state');return data;}catch(e){if(e.code==='ENOENT')return {version:1,counters:{},events:[]};throw e;}}
 function prune(data,time){
  // Migrate old alerts BEFORE ordinary history retention. A flood of blocked
  // requests must never evict an alert waiting for the separate sender.
  if(data.outbox===undefined)data.outbox=data.events.filter(e=>e.alertEligible===true);
  if(!Array.isArray(data.outbox)||data.outbox.length>2000)throw new Error('Invalid audit outbox');
  data.outbox=data.outbox.filter(e=>Date.parse(e.time)>time-RETENTION);
  for(const [k,v]of Object.entries(data.counters)){v.times=v.times.filter(t=>t>time-WINDOW);if(!v.times.length)delete data.counters[k];}
  data.events=data.events.filter(e=>Date.parse(e.time)>time-RETENTION).slice(-maxEvents);
 }
 function write(data){const temp=file+'.'+crypto.randomUUID()+'.tmp';let fd;try{fd=fs.openSync(temp,'wx',0o600);fs.writeFileSync(fd,JSON.stringify(data));fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;fs.renameSync(temp,file);const d=fs.openSync(dir,'r');try{fs.fsyncSync(d);}finally{fs.closeSync(d);}}finally{if(fd!==undefined)fs.closeSync(fd);try{fs.unlinkSync(temp);}catch(e){if(e.code!=='ENOENT')throw e;}}}
 // All operations in the critical section are synchronous: no await/interleaving.
 // Exclusive lock rejects concurrent processes rather than silently losing updates.
 function transaction(fn){prepare();const lock=path.join(dir,'audit.lock');let fd;try{fd=fs.openSync(lock,'wx',0o600);return fn();}finally{if(fd!==undefined){fs.closeSync(fd);fs.unlinkSync(lock);}}}
 return {
  record(req,{page,room,outcome,scope}){
   if(!PAGES.has(page)&&page!=='dashboard')throw new Error('Invalid audit page');
   if(room!==undefined&&room!==null)require('./note-room').roomId(room);
   if(!['failure','success','rate_limit'].includes(outcome))return;
   return transaction(()=>{
    const data=read(),time=now(),info=requestInfo(req),key=JSON.stringify([info.ip,scope==='admin'?'admin':page,room||null]);prune(data,time);
    if(outcome==='success')delete data.counters[key];
    let c=data.counters[key],alertEligible=false;
    if(outcome==='failure'){
     if(!c){if(Object.keys(data.counters).length>=maxKeys)throw new Error('Audit counter capacity');c={times:[],lastAlert:null};}
     c.times.push(time);c.times=c.times.slice(-maxTimes);data.counters[key]=c;
     if(c.times.length>=5){alertEligible=c.lastAlert===null||time-c.lastAlert>=WINDOW;if(alertEligible)c.lastAlert=time;}
    }
    if((outcome==='failure'&&c.times.length>=5)||outcome==='rate_limit'){
     const event={id:crypto.randomUUID(),time:new Date(time).toISOString(),timeKst:new Date(time+9*60*60*1000).toISOString().replace('T',' ').replace('Z',' KST'),...info,page,room:room||null,outcome,count:c?.times.length||0,countCapped:(c?.times.length||0)>=maxTimes,alertEligible};
     if(alertEligible){
      // Separate bounded retention: never silently evict a pending older alert.
      // On capacity exhaustion report an audit error; existing queue stays intact.
      if(data.outbox.length>=2000)throw new Error('Audit outbox capacity');
      data.outbox.push(event);
     }
     data.events.push(event);
    }
    prune(data,time);write(data);
   });
  },
  latest(limit=100){return transaction(()=>{const data=read();prune(data,now());write(data);return data.events.slice(-Math.min(100,Math.max(1,Number(limit)||100))).reverse();});}
 };
}
let singleton;
function runtimeAudit(){return singleton||(singleton=createSecurityAudit());}
function recordAuth(req,details,audit){try{return (audit||runtimeAudit()).record(req,details);}catch{console.error('Security audit unavailable (private storage/permissions/capacity).');}}
module.exports={createSecurityAudit,runtimeAudit,recordAuth,requestInfo,dashboardPage};
