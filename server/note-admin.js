'use strict';
const {runtimeService,validPassword}=require('./note-local');
const {recordAuth}=require('./security-audit');
const {runtimePasswordLock,LOCK_MESSAGE}=require('./password-lock');
const {requestRoom,roomRoot,listRooms,existingRoom}=require('./note-room');
const {noteRoot,listNoteRooms,existingNoteRoom}=require('./note-a-room');
function send(res,status,data){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(data));}
async function bodyOf(req){
 if(req.body && typeof req.body==='object') {if(Buffer.byteLength(JSON.stringify(req.body))>2048)throw {status:413};return req.body;}
 let size=0,parts=[];
 for await(const c of req){size+=c.length;if(size>2048)throw {status:413};parts.push(c);}
 try{return parts.length?JSON.parse(Buffer.concat(parts).toString('utf8')):{};}catch{throw {status:400};}
}
function createAdminHandler(getService=runtimeService,options={}){
 const lock=options.lock||runtimePasswordLock;
 return async(req,res)=>{
  const url=new URL(req.url,'http://localhost'),action=url.searchParams.get('action')||url.pathname.split('/').pop();
  let verifiedInput=false;
  const audit=outcome=>recordAuth(req,{page:'detail-admin-jik-2026.html',outcome,scope:'admin'},options.audit);
  if(action==='not-found')return send(res,404,{ok:false});
  try{
   if(!['login','status','rotate','create','reset-content','delete-room'].includes(action))return send(res,404,{ok:false,error:'알 수 없는 요청입니다.'});
   if(req.method!==(action==='status'?'GET':'POST'))return send(res,405,{ok:false,error:'허용되지 않는 요청 방식입니다.'});
   let body;
   if(action==='login'){
    body=await bodyOf(req);if(!body||typeof body!=='object'||Array.isArray(body))throw {status:400};
    if(!validPassword(body.password))return send(res,400,{ok:false,error:'관리자 비밀번호를 입력해 주세요.'});
    verifiedInput=true;
    const result=await lock(req,'admin',ip=>getService().login('admin',body.password,'default',ip));
    audit(result.verified?(result.value?'success':'failure'):'rate_limit');
    if(result.locked)return send(res,429,{ok:false,error:LOCK_MESSAGE,remaining:0});
    return send(res,result.value?200:401,result.value?{ok:true,token:result.value}:{ok:false,error:'관리자 비밀번호가 맞지 않습니다.',remaining:result.remaining});
   }
   const token=String(req.headers.authorization||'').replace(/^Bearer /,'');
   // Authenticate before any read/write, not a browser/sessionStorage flag.
   if(!token)return send(res,401,{ok:false,error:'관리자 인증이 필요합니다.'});
   const service=getService();
   if(!await service.tokenOk('admin',token))throw {status:401};
   body=action==='status'?{}:await bodyOf(req);
   if(!body||typeof body!=='object'||Array.isArray(body))throw {status:400};
   const room=requestRoom(url,body),root=options.roomRoot||roomRoot(),noteDir=options.noteDir||noteRoot();
   if(action==='delete-room'){
    if(!['note','note2'].includes(body.id)||!Object.hasOwn(body,'room')||body.room!==room||body.confirmation!==room)throw {status:400};
    return send(res,200,{ok:true,room:await service.deleteRoom(token,room,body.confirmation,body.revision,body.id,body.id==='note'?noteDir:root)});
   }
   if(action!=='status'&&action!=='create'&&['note','note2'].includes(body.id)&&await service.isRoomDeleted(room,body.id))throw {status:404};
   if(action==='reset-content'&&body.id==='note'){
    if(!existingNoteRoom(noteDir,room)&&!await service.hasRoom(room,'note'))throw {status:404};
    require('../note-folder').resetNoteAContent(noteDir,room);
    return send(res,200,{ok:true,id:'note',room,version:0});
   }
   if(action!=='status'&&body.id!=='note')existingRoom(root,room);
   if(action==='status'){
    const ids=url.searchParams.getAll('id'),id=ids[0]||'note2';
    if(ids.length>1||!['note','note2'].includes(id))throw {status:400};
    if(await service.isRoomDeleted(room,id))throw {status:404};
    (id==='note'?existingNoteRoom:existingRoom)(id==='note'?noteDir:root,room);
    const active=async(names,id)=>{const result=[];for(const name of names)if(!await service.isRoomDeleted(name,id))result.push(name);return result;};
    const rooms=await active([...new Set([...listRooms(root),...await service.rooms(token)])].sort(),'note2');
    // Customized-only names may alias an invalid physical directory, too.
    for(const name of rooms)existingRoom(root,name);
    const noteRooms=await active([...new Set([...listNoteRooms(noteDir),...await service.rooms(token,'note')])].sort(),'note');
    for(const name of noteRooms)existingNoteRoom(noteDir,name);
    return send(res,200,{ok:true,notes:await service.status(token,room),rooms,noteRooms});
   }
   if(action==='reset-content'){
    if(body.id!=='note2')throw {status:400};
    if(!existingRoom(root,room)&&!await service.hasRoom(room))throw {status:404};
    require('../note-folder').resetNoteContent(root,room);
    return send(res,200,{ok:true,room,version:0});
   }
   if(action==='create'){
    const id=body.id===undefined?'note2':body.id;if(!['note','note2'].includes(id))throw {status:400};
    return send(res,201,{ok:true,room:await service.createRoom(token,room,body.password,body.confirmation,id==='note'?noteDir:root,id)});
   }
   return send(res,200,{ok:true,note:await service.rotate(token,body.id,body.password,body.confirmation,body.revision,room,body.id==='note'?noteDir:root)});
  }catch(e){if(verifiedInput&&e.status===429)audit('rate_limit');const status=[400,401,404,409,413,429].includes(e.status)?e.status:503;return send(res,status,{ok:false,error:e.code==='ROOM_DELETED'?e.message:({400:'입력 내용을 확인해 주세요.',401:'관리자 인증이 필요합니다. 다시 로그인해 주세요.',404:'등록되지 않은 방입니다. NEW ROOM에서 먼저 생성해 주세요.',409:'이미 존재하는 방이거나 다른 변경이 있습니다. 기존 비밀번호는 덮어쓰지 않았습니다. 다시 조회해 주세요.',413:'요청이 너무 큽니다.',429:'시도 횟수가 많습니다. 15분 뒤 다시 시도해 주세요.',503:'맥미니 로컬 비밀번호 저장소를 사용할 수 없습니다. 관리자에게 문의해 주세요.'})[status]});}
 };
}
module.exports={createAdminHandler};
