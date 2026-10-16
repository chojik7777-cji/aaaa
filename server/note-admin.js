'use strict';
const {runtimeService,validPassword}=require('./note-local');
const {requestRoom,roomRoot,listRooms,existingRoom}=require('./note-room');
function send(res,status,data){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(data));}
async function bodyOf(req){
 if(req.body && typeof req.body==='object') {if(Buffer.byteLength(JSON.stringify(req.body))>2048)throw {status:413};return req.body;}
 let size=0,parts=[];
 for await(const c of req){size+=c.length;if(size>2048)throw {status:413};parts.push(c);}
 try{return parts.length?JSON.parse(Buffer.concat(parts).toString('utf8')):{};}catch{throw {status:400};}
}
function createAdminHandler(getService=runtimeService,options={}){
 const attempts=new Map();
 return async(req,res)=>{
  const url=new URL(req.url,'http://localhost'),action=url.searchParams.get('action')||url.pathname.split('/').pop();
  if(action==='not-found')return send(res,404,{ok:false});
  try{
   if(!['login','status','rotate','create','reset-content'].includes(action))return send(res,404,{ok:false,error:'알 수 없는 요청입니다.'});
   if(req.method!==(action==='status'?'GET':'POST'))return send(res,405,{ok:false,error:'허용되지 않는 요청 방식입니다.'});
   const body=action==='status'?{}:await bodyOf(req);
   if(!body||typeof body!=='object'||Array.isArray(body))throw {status:400};
   if(action==='login'){
    if(!validPassword(body.password))return send(res,400,{ok:false,error:'관리자 비밀번호를 입력해 주세요.'});
    // Socket-based guard supplements the durable global admin attempt budget.
    const key=String(req.socket?.remoteAddress||'remote');const now=Date.now();
    if(attempts.size>10000)attempts.clear();
    let a=attempts.get(key);if(!a||a.until<=now)a={count:0,until:now+15*60*1000};
    a.count++;attempts.set(key,a);if(a.count>10)return send(res,429,{ok:false,error:'시도 횟수가 많습니다. 15분 뒤 다시 시도해 주세요.'});
    const token=await getService().login('admin',body.password);
    return send(res,token?200:401,token?{ok:true,token}:{ok:false,error:'관리자 비밀번호가 맞지 않습니다.'});
   }
   const token=String(req.headers.authorization||'').replace(/^Bearer /,'');
   // Authenticate before any read/write, not a browser/sessionStorage flag.
   if(!token)return send(res,401,{ok:false,error:'관리자 인증이 필요합니다.'});
   const service=getService();
   if(!await service.tokenOk('admin',token))throw {status:401};
   const room=requestRoom(url,body),root=options.roomRoot||roomRoot();
   if(action==='reset-content'&&body.id==='note'){
    if(room!=='default')throw {status:400};
    const dir=options.noteDir||process.env.NOTE_DIR||require('node:path').join(__dirname,'..','note','family');
    require('../note-folder').resetNoteAContent(dir);
    return send(res,200,{ok:true,id:'note',room:'default',version:0});
   }
   existingRoom(root,room);
   if(action==='status'){
    const rooms=[...new Set([...listRooms(root),...await service.rooms(token)])].sort();
    // Customized-only names may alias an invalid physical directory, too.
    for(const name of rooms)existingRoom(root,name);
    return send(res,200,{ok:true,notes:await service.status(token,room),rooms});
   }
   if(action==='reset-content'){
    if(body.id!=='note2')throw {status:400};
    if(!existingRoom(root,room)&&!await service.hasRoom(room))throw {status:404};
    require('../note-folder').resetNoteContent(root,room);
    return send(res,200,{ok:true,room,version:0});
   }
   if(action==='create')return send(res,201,{ok:true,room:await service.createRoom(token,room,body.password,body.confirmation,root)});
   return send(res,200,{ok:true,note:await service.rotate(token,body.id,body.password,body.confirmation,body.revision,room,root)});
  }catch(e){const status=[400,401,404,409,413,429].includes(e.status)?e.status:503;return send(res,status,{ok:false,error:({400:'입력 내용을 확인해 주세요.',401:'관리자 인증이 필요합니다. 다시 로그인해 주세요.',404:'등록되지 않은 방입니다. NEW ROOM에서 먼저 생성해 주세요.',409:'이미 존재하는 방이거나 다른 변경이 있습니다. 기존 비밀번호는 덮어쓰지 않았습니다. 다시 조회해 주세요.',413:'요청이 너무 큽니다.',429:'시도 횟수가 많습니다. 15분 뒤 다시 시도해 주세요.',503:'맥미니 로컬 비밀번호 저장소를 사용할 수 없습니다. 관리자에게 문의해 주세요.'})[status]});}
 };
}
module.exports={createAdminHandler};
