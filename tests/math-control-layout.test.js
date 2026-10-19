'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_PATH||'playwright');
for(const [name,engine]of [['Chromium',chromium],['WebKit',webkit]])test(name+' math management keeps intended width and contact footer below card',async t=>{
 const b=await engine.launch();t.after(()=>b.close());
 for(const width of [390,768,1280]){const p=await b.newPage({viewport:{width,height:900}});await p.route('**/*',r=>r.fulfill(r.request().url().includes('.html')?{contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'../math-control.html'))}:{json:{ok:true,locked:false,questionLimit:5,version:1}}));await p.goto('http://math-width.test/math-control.html');
 const g=await p.evaluate(()=>{const card=document.querySelector('.card').getBoundingClientRect(),footer=document.querySelector('.footer').getBoundingClientRect();return {width:card.width,left:card.left,right:card.right,bottom:card.bottom,footerTop:footer.top}});
 assert.ok(Math.abs(g.width-Math.min(720,width-36))<1,'card width must not be taken by footer: '+JSON.stringify({width,...g}));assert.ok(g.footerTop>=g.bottom,'contact must be below management form');assert.ok(g.left>=0&&g.right<=width);await p.close();}
});
