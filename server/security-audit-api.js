'use strict';
const {runtimeService}=require('./note-local');
const {runtimeAudit}=require('./security-audit');
function createSecurityAuditHandler(getService=runtimeService,options={}){
 return async(req,res)=>{
  const send=(status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(data));};
  if(req.method!=='GET'){res.setHeader('Allow','GET');return send(405,{ok:false});}
  const match=/^Bearer ([^\s]{1,1024})$/.exec(req.headers?.authorization||'');
  if(!match)return send(401,{ok:false});
  try{
   if(!await getService().tokenOk('admin',match[1]))return send(401,{ok:false});
   const value=new URL(req.url,'http://localhost').searchParams.get('limit'),limit=Math.min(100,Math.max(1,Number(value)||100));
   const records=await (options.audit||runtimeAudit()).latest(limit);
   return send(200,{ok:true,records});
  }catch{return send(503,{ok:false,error:'보안 감사 저장소를 확인할 수 없습니다.'});}
 };
}
module.exports={createSecurityAuditHandler};
