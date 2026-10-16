'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let chromium;try{({chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'));}catch{}
test('Chromium both open notes clear old text after polling reset without reload',{skip:!chromium},async()=>{
 const http=require('node:http'),root=path.join(__dirname,'..');
 const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://fixture').pathname.slice(1);if(!['note.html','note2.html','note-attachment-preview.js'].includes(name)){res.writeHead(404).end();return;}res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(path.join(root,name)));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{browser=await chromium.launch();for(const file of ['note.html','note2.html']){const page=await browser.newPage();let reset=false;await page.addInitScript(()=>{localStorage.setItem('note-token','fixture-token');localStorage.setItem('note2-token:alpha','fixture-token');});await page.route('**/api/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,version:reset?0:7,text:reset?'':'old body',updatedAt:reset?0:1,files:[],storage:'folder',folder:'fixture',maxFileBytes:1000})}));await page.goto(`http://127.0.0.1:${server.address().port}/${file}?room=alpha`);await page.waitForFunction(()=>document.getElementById('editor').value==='old body');reset=true;await page.waitForFunction(()=>document.getElementById('editor').value===''&&document.getElementById('versionText').textContent.includes('0'),{timeout:5000});await page.close();}}
 finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
});
for(const file of ['note.html','note2.html'])test(file+' detects reset-to-zero and cancels stale pending autosave',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..',file),'utf8');const start=html.indexOf('function applyRemote('),end=html.indexOf('async function load(',start);assert.ok(start>=0&&end>start);
 const elements=new Map();const $=id=>{if(!elements.has(id))elements.set(id,{value:'old content',style:{},textContent:''});return elements.get(id);};let cancelled=0;
 const ctx=vm.createContext({$,locked:false,state:{version:8,text:'old content'},dirty:true,applyingRemote:false,saveTimer:42,lastLocalEdit:0,clearTimeout:id=>{assert.equal(id,42);cancelled++;},renderFiles(){},updateStatus(){},setBadge(){},fmtSize(){},Date});
 vm.runInContext(html.slice(start,end),ctx);vm.runInContext('applyRemote({version:0,text:"",files:[],updatedAt:0})',ctx);
 assert.equal($('editor').value,'');assert.equal(ctx.dirty,false);assert.equal(cancelled,1);
});
