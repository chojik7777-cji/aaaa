'use strict';
// Vercel must never import the Mac filesystem auth store or attempt bootstrap.
module.exports = async function(req,res){
 res.statusCode=503;
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.end(JSON.stringify({ok:false,code:'LOCAL_ONLY',error:'비밀번호 관리는 맥미니 로컬 전용입니다. 맥미니/터널 주소에서 이용해 주세요. Vercel 비밀번호는 변경되지 않습니다.'}));
};
