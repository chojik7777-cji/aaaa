'use strict';
const {runtimeService}=require('./note-local');
const {recordAuth,dashboardPage}=require('./security-audit');
function createDashboardAuth(getService=runtimeService,options={}){
 return async(req,res)=>{
  let page='dashboard',verifiedInput=false;
  const audit=outcome=>recordAuth(req,{page,outcome},options.audit);
  const send=(status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data));};
  if(req.method!=='POST')return send(405,{ok:false});
  try{
   let size=0,parts=[];
   for await(const chunk of req){size+=chunk.length;if(size>2048)return send(413,{ok:false});parts.push(chunk);}
   let body;try{body=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{return send(400,{ok:false});}
   if(!body||typeof body.password!=='string'||!body.password.length||Buffer.byteLength(body.password)>256)return send(400,{ok:false});
   page=dashboardPage(req,body);verifiedInput=true;
   // Same private administrator verifier and durable attempt budget as note administration.
   // Never disclose or return the privileged administrator token to dashboard callers.
   const token=await getService().login('admin',body.password);
   audit(token?'success':'failure');
   return send(token?200:403,token?{ok:true}:{ok:false,error:'비밀번호가 맞지 않습니다.'});
  }catch(e){if(verifiedInput&&e.status===429)audit('rate_limit');return send(e.status===429?429:503,{ok:false,error:e.status===429?'시도 횟수가 많습니다. 잠시 후 다시 시도해 주세요.':'관리자 인증을 확인할 수 없습니다.'});}
 };
}
module.exports={createDashboardAuth};
