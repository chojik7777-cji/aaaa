'use strict';
// Security history and its administrator verifier remain on the private Mac.
module.exports=async function(req,res){
 res.statusCode=503;
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.end(JSON.stringify({ok:false,code:'LOCAL_ONLY',error:'보안 기록 저장·조회와 알림은 Mac mini 로컬/터널 전용입니다. Vercel 인증 실패는 이 기록에 수집되지 않습니다.'}));
};
