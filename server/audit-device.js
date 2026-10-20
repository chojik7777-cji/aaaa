'use strict';
// Advisory, spoofable labels only. This is not a MAC address or fingerprint.
function userAgentMetadata(value){
 const ua=typeof value==='string'?value.slice(0,256):'';
 const browser=/\b(?:Edg|Edge|EdgA|EdgiOS)\//i.test(ua)?'Edge':/\b(?:OPR|OPiOS|Opera)(?:\/|\b)/i.test(ua)?'Opera':/SamsungBrowser\//i.test(ua)?'Samsung Internet':/\b(?:Chrome|HeadlessChrome|CriOS)\//i.test(ua)?'Chrome':/\b(?:Firefox|FxiOS)\//i.test(ua)?'Firefox':/Safari\//i.test(ua)?'Safari':/^node(?:\b|\/)/i.test(ua)?'node':'unknown';
 const os=(/iPhone|iPad|iPod/i.test(ua)||(/Macintosh/i.test(ua)&&/Mobile\//i.test(ua)))?'iOS':/Android/i.test(ua)?'Android':/Windows/i.test(ua)?'Windows':/Macintosh|Mac OS X/i.test(ua)?'macOS':/Linux/i.test(ua)?'Linux':'unknown';
 return {browser,os};
}
const {randomUUID}=require('node:crypto'),{isIP}=require('node:net');
const COOKIE_NAME='aaaa-audit-device-v1',UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const assigned=Symbol('advisory audit device');
function cookieDeviceId(cookie){
 if(typeof cookie!=='string'||cookie.length>8192||/[\x00-\x1f\x7f]/.test(cookie))return null;
 let count=0,value=null;
 for(const part of cookie.split(';')){
  const item=part.trim(),eq=item.indexOf('=');
  if((eq<0?item:item.slice(0,eq).trim())!==COOKIE_NAME)continue;
  count++;const candidate=item.slice(eq+1);if(eq>=0&&UUID.test(candidate))value=candidate;
 }
 return count===1?value:null;
}
function requestDeviceId(req){return req[assigned]||cookieDeviceId(req.headers?.cookie);}
function auditDevice(req,res){
 if(req[assigned])return;
 const existing=cookieDeviceId(req.headers?.cookie);
 req[assigned]=existing||randomUUID();
 if(existing||res.headersSent)return;
 const peer=req.socket?.remoteAddress,loopback=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer),cf=req.headers?.['cf-connecting-ip'];
 const secure=req.socket?.encrypted||(loopback&&req.headers?.host==='inn-analytical-split-juice.trycloudflare.com'&&typeof cf==='string'&&!!isIP(cf));
 const cookie=COOKIE_NAME+'='+req[assigned]+'; Max-Age=31536000; Path=/; HttpOnly; SameSite=Lax'+(secure?'; Secure':'');
 // Metadata is best-effort, never a reason to deny authentication or change a lock.
 try{const previous=res.getHeader?.('Set-Cookie');res.setHeader('Set-Cookie',[...(previous===undefined?[]:Array.isArray(previous)?previous:[previous]),cookie]);}catch{}
}
module.exports={userAgentMetadata,cookieDeviceId,requestDeviceId,auditDevice};
