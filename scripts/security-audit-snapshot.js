#!/usr/bin/env node
'use strict';
// Read-only outbox snapshot. Writers atomically rename fully fsynced JSON files,
// so a reader must NOT take audit.lock and compete with password verification.
// Open one immutable inode, validate it, then read it through that descriptor.
const fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(process.argv[2]);
let fd;
try{
 if(!fs.existsSync(dir)){process.stdout.write('[]');}
 else{
  const st=fs.lstatSync(dir);
  if(st.isSymbolicLink()||!st.isDirectory()||st.uid!==process.getuid()||(st.mode&0o777)!==0o700||fs.realpathSync(dir)!==dir)throw new Error('Unsafe directory');
  try{fd=fs.openSync(path.join(dir,'audit.json'),fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);}
  catch(e){if(e.code!=='ENOENT')throw e;}
  let events=[];
  if(fd!==undefined){
   const st=fs.fstatSync(fd);
   if(!st.isFile()||st.uid!==process.getuid()||(st.mode&0o777)!==0o600||st.size>32*1024*1024)throw new Error('Unsafe storage');
   const data=JSON.parse(fs.readFileSync(fd,'utf8'));
   if(data.version!==1||!Array.isArray(data.events)||data.events.length>2000)throw new Error('Invalid schema');
   const outbox=data.outbox===undefined?data.events:data.outbox;
   if(!Array.isArray(outbox)||outbox.length>2000)throw new Error('Invalid outbox');
   events=outbox.filter(e=>e.alertEligible===true&&Date.parse(e.time)>Date.now()-30*86400000).map(e=>{
    const out={};for(const key of ['id','time','ip','page','room','count','ipSource'])out[key]=e[key];return out;
   });
  }
  process.stdout.write(JSON.stringify(events));
 }
}catch{process.stderr.write('Security audit snapshot unavailable.\n');process.exitCode=1;}
finally{if(fd!==undefined)fs.closeSync(fd);}
