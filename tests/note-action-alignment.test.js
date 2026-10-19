'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let engine;try{engine=require(process.env.PLAYWRIGHT_PATH||'playwright')[process.env.PLAYWRIGHT_BROWSER||'chromium'];}catch{}
test('attachment preview/download/delete buttons share top/bottom edges and fit narrow phones on both notes',{skip:!engine},async t=>{
 const browser=await engine.launch({headless:true});t.after(()=>browser.close());const root=path.join(__dirname,'..');
 for(const file of ['note.html','note2.html'])for(const width of [320,390,1200]){
  const page=await browser.newPage({viewport:{width,height:844}});
  await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.pathname.startsWith('/api/'))return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,version:1,text:'',files:[{id:'fixture',name:'긴 파일 이름이 있는 첨부자료.txt',uploadedAt:1,size:100}]})});const n=url.pathname.slice(1);if(!['note.html','note2.html','note-attachment-preview.js'].includes(n))return route.fulfill({status:404,body:''});return route.fulfill({contentType:n.endsWith('.js')?'text/javascript':'text/html',body:fs.readFileSync(path.join(root,n))});});
  await page.goto('http://alignment.test/'+file+'?room=alpha');await page.locator('.file-actions button').first().waitFor();const buttons=page.locator('.file-actions button');assert.equal(await buttons.count(),4);assert.deepEqual(await buttons.allTextContents(),['미리보기','이름변경','다운로드','삭제']);const boxes=[];for(let i=0;i<4;i++)boxes.push(await buttons.nth(i).boundingBox());
  const tops=boxes.map(b=>b.y),bottoms=boxes.map(b=>b.y+b.height);assert.ok(Math.max(...tops)-Math.min(...tops)<1,file+' '+width+' top '+JSON.stringify(boxes));assert.ok(Math.max(...bottoms)-Math.min(...bottoms)<1,file+' '+width+' bottom '+JSON.stringify(boxes));assert.ok(boxes.every(b=>b.height===44&&b.x>=0&&b.x+b.width<=width));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  if(process.env.NOTE_ACTION_SCREENSHOTS){fs.mkdirSync(process.env.NOTE_ACTION_SCREENSHOTS,{recursive:true});await page.locator('.file').screenshot({path:path.join(process.env.NOTE_ACTION_SCREENSHOTS,file+'-'+width+'.png')});}await page.close();
 }
});
