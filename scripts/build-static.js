#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {publicPath}=require('../server/static-policy');
function build(out=path.join(__dirname,'..','.static-site')) {
 const root=path.resolve(__dirname,'..');
 out=path.resolve(out);
 if(root===out || root.startsWith(out+path.sep))throw new Error('Unsafe static output path');
 if(fs.existsSync(out) && fs.lstatSync(out).isSymbolicLink())throw new Error('Symlink output is not allowed');
 // Never retain stale files from a previous broader/static build.
 fs.rmSync(out,{recursive:true,force:true});
 fs.mkdirSync(out,{recursive:true});
 function copy(dir,prefix='') {
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})) {
   if(ent.isSymbolicLink())continue;
   const rel=prefix+ent.name,src=path.join(dir,ent.name);
   if(ent.isDirectory() && rel==='downloads'){copy(src,rel+'/');continue;}
   if(!ent.isFile() || !publicPath('/'+rel))continue;
   const dest=path.join(out,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(src,dest);
  }
 }
 copy(root);
 console.log('Public static allowlist build complete. Server sources, credentials and note folders excluded.');
}
if(require.main===module)build();
module.exports={build};
