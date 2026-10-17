'use strict';
// Run real Chromium checks: PLAYWRIGHT_PATH=/path/to/playwright node --test tests/note-preview-browser.test.js
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
let chromium;
try { ({chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright')); } catch {}
test('isolated browser: both pages preview safely, close, trap focus, clear on 401 and fit mobile', {skip: !chromium}, async () => {
  const root = path.join(__dirname, '..');
  const server = http.createServer((req, res) => {
    const file = new URL(req.url, 'http://fixture').pathname.slice(1);
    if (!['note.html','note2.html','note-attachment-preview.js'].includes(file) || !fs.existsSync(path.join(root,file))) {res.writeHead(404).end();return;}
    res.setHeader('Content-Type', file.endsWith('.js')?'text/javascript':'text/html');
    res.end(fs.readFileSync(path.join(root,file)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({headless:true});
    for (const file of ['note.html','note2.html']) {
      const page = await browser.newPage({viewport:{width:1200,height:900}});
      const jpeg = await page.evaluate(() => {const c=document.createElement('canvas');c.width=1200;c.height=1800;const g=c.getContext('2d');g.fillStyle='#244b70';g.fillRect(0,0,1200,1800);g.fillStyle='#f5c467';g.fillRect(100,300,1000,1000);g.fillStyle='#244b70';g.font='100px sans-serif';g.fillText('JPEG fixture',200,850);return c.toDataURL('image/jpeg').split(',')[1];});
      const name = '<img src=x onerror="window.filenameXss=1"> 사진.JPEG';
      const files = [{id:'photo',name,type:'image/jpeg'}, {id:'text',name:'memo.txt',type:'text/plain'}, {id:'pdf',name:'paper.pdf'}, {id:'video',name:'clip.mp4'}, {id:'audio',name:'music.mp3'}, {id:'bad',name:'x.svg',type:'image/png'}].map(f=>({...f,size:100,uploadedAt:1}));
      let denied=false, denyFile=false;
      const requests=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(() => {if(window!==window.top)return;window.revokedPreviewUrls=[];const revoke=URL.revokeObjectURL.bind(URL);URL.revokeObjectURL=url=>{window.revokedPreviewUrls.push(url);revoke(url);};localStorage.setItem('note-token','fixture-token');localStorage.setItem('note-token:alpha','fixture-token');localStorage.setItem('note2-token:alpha','fixture-token');});
      await page.route('**/api/**', async route => {
        const url = new URL(route.request().url());requests.push(url);
        if (url.pathname.endsWith('/file')) {
          if(denyFile)return route.fulfill({status:401,contentType:'application/json',body:'{"error":"expired"}'});
          const id=url.searchParams.get('id');
          return route.fulfill({contentType:id==='photo'?'image/jpeg':id==='text'?'text/plain':'application/octet-stream',body:id==='photo'?Buffer.from(jpeg,'base64'):id==='text'?'<script>window.textXss=1</script>':'fixture'});
        }
        return route.fulfill({status:denied?401:200,contentType:'application/json',body:denied?'expired':JSON.stringify({ok:true,version:1,text:'draft',files,maxFileBytes:1000})});
      });
      await page.goto(`http://127.0.0.1:${server.address().port}/${file}?room=alpha`);
      const trigger=page.locator('[data-preview="photo"]'),dialog=page.locator('dialog');
      await trigger.click();
      await dialog.waitFor({state:'visible',timeout:3000});
      await page.waitForFunction(()=>document.querySelector('dialog img')?.naturalWidth>0);
      assert.equal(await dialog.locator('h2').textContent(),name);
      assert.equal(await page.evaluate(()=>window.filenameXss),undefined);
      const box=await dialog.boundingBox();assert.ok(Math.abs(box.x+box.width/2-600)<2);assert.ok(Math.abs(box.y+box.height/2-450)<2);
      if(process.env.NOTE_PREVIEW_SCREENSHOTS)await page.screenshot({path:path.join(process.env.NOTE_PREVIEW_SCREENSHOTS,file+'-desktop.png')});
      await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.closest('dialog')!==null),true);
      await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.closest('dialog')!==null),true);
      await dialog.getByRole('button',{name:'미리보기 닫기'}).click();assert.equal(await dialog.isVisible(),false);
      assert.equal(await trigger.evaluate(e=>document.activeElement===e),true);
      assert.equal(await dialog.locator('img').count(),0);
      assert.equal(await page.evaluate(()=>window.revokedPreviewUrls.length),1);
      await trigger.click();await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);
      await trigger.click();await page.mouse.click(2,2);assert.equal(await dialog.isVisible(),false);
      await page.locator('[data-preview="text"]').click();await dialog.locator('pre').waitFor();assert.equal(await dialog.locator('pre').textContent(),'<script>window.textXss=1</script>');assert.equal(await page.evaluate(()=>window.textXss),undefined);await page.keyboard.press('Escape');
      for(const [id,tag] of [['pdf','iframe'],['video','video'],['audio','audio']]){await page.locator(`[data-preview="${id}"]`).click();await dialog.locator(tag).waitFor();if(id==='pdf')assert.equal(await dialog.locator(tag).getAttribute('sandbox'),'');else assert.equal(await dialog.locator(tag).getAttribute('controls'),'');await page.keyboard.press('Escape');assert.equal(await dialog.locator(tag).count(),0);}
      assert.equal(await page.locator('[data-preview="bad"]').count(),0);
      assert.equal(await page.locator('[download]').count(),files.length);
      if(file==='note2.html')assert.equal(await page.getByText('새 창에서 보기',{exact:false}).count(),5);
      await page.setViewportSize({width:390,height:844});await trigger.click();await page.waitForFunction(()=>document.querySelector('dialog img')?.naturalWidth>0);
      const mobile=await dialog.boundingBox();assert.ok(mobile.width<=351);assert.ok(mobile.height<=718);assert.ok(mobile.x>=0&&mobile.y>=0);
      assert.equal(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth),true);
      if(process.env.NOTE_PREVIEW_SCREENSHOTS)await page.screenshot({path:path.join(process.env.NOTE_PREVIEW_SCREENSHOTS,file+'-mobile.png')});
      denied=true;await page.waitForFunction(()=>!document.getElementById('lock').hidden);assert.equal(await dialog.isVisible(),false);assert.equal(await dialog.locator('img').count(),0);
      await trigger.click({force:true});assert.equal(await dialog.isVisible(),false);
      assert.ok(requests.filter(u=>u.pathname.endsWith('/file')).every(u=>u.searchParams.get('room')==='alpha'&&u.searchParams.get('token')==='fixture-token'));
      assert.deepEqual(errors,[]);
      // A file-request 401 also locks and clears immediately, independently of polling.
      denied=false;await page.reload();denyFile=true;await trigger.click();await page.waitForFunction(()=>!document.getElementById('lock').hidden);assert.equal(await dialog.isVisible(),false);
      console.log(`${file}: JPEG centered, X/Escape/backdrop, focus, safe text/name, PDF/media cleanup, mobile, state/file 401 passed`);
      await page.close();
    }
  } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
});
