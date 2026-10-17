'use strict';
const fs=require('node:fs'),path=require('node:path');
// No normalization: identity must be the same on case-sensitive and insensitive filesystems.
function roomId(value='default'){
 if(typeof value!=='string'||!/^[a-z0-9_-]{1,50}$/.test(value)||['__proto__','prototype','constructor','backup'].includes(value))throw Object.assign(new Error('방 이름은 영문 소문자, 숫자, _ 또는 -로 1~50자 입력해 주세요. 대문자는 사용할 수 없습니다.'),{status:400});
 return value;
}
function requestRoom(url,body={}){
 if(!body||typeof body!=='object'||Array.isArray(body))throw {status:400};
 const values=url.searchParams.getAll('room');if(values.length>1)throw {status:400};
 const query=values.length?roomId(values[0]):undefined;
 const posted=Object.hasOwn(body,'room')?roomId(body.room):undefined;
 if(query!==undefined&&posted!==undefined&&query!==posted)throw {status:400};
 return query??posted??'default';
}
function roomRoot(env=process.env){return path.resolve(env.NOTE2_DIR||path.join(__dirname,'..','note2'));}
function existingRoom(root,room){
 roomId(room);
 let names;try{names=fs.readdirSync(root);}catch(e){if(e.code==='ENOENT')return false;throw e;}
 // realpath may preserve the requested spelling on macOS. Read actual directory entries
 // before any template/custom-record fallback, even when the requested path looks absent.
 const matches=names.filter(name=>name.toLowerCase()===room);
 if(!matches.length){
  // Also reject any filesystem alias not captured by JavaScript's case mapping.
  try{fs.lstatSync(path.join(root,room));}catch(e){if(e.code==='ENOENT')return false;throw e;}
  throw Object.assign(new Error('방 폴더 이름이 정확히 일치하지 않습니다. 운영자 확인이 필요합니다.'),{status:400});
 }
 if(matches.length!==1||matches[0]!==room)throw Object.assign(new Error('방 폴더의 대소문자가 충돌합니다. 운영자 확인이 필요합니다.'),{status:400});
 const dir=path.join(root,room),stat=fs.lstatSync(dir);
 if(stat.isSymbolicLink()||!stat.isDirectory()||fs.realpathSync(dir)!==dir)throw Object.assign(new Error('안전하지 않은 방 폴더입니다.'),{status:400});
 return true;
}
function listRooms(root){
 let names;try{names=fs.readdirSync(root);}catch(e){if(e.code==='ENOENT')return [];throw e;}
 return names.filter(name=>{try{roomId(name);}catch{return false;}if(fs.lstatSync(path.join(root,name)).isFile())return false;return existingRoom(root,name);}).sort();
}
module.exports={roomId,requestRoom,roomRoot,existingRoom,listRooms};
