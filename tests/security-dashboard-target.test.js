'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
for(const filename of ['intro.html','omok-dashboard.html','baduk-dashboard.html','yut-dashboard.html']){
 test(filename+' supplies target page to password audit',async()=>{
  const html=fs.readFileSync(path.join(__dirname,'..',filename),'utf8');
  const match=html.match(/async function requireDashboardPassword\([^)]*\)\s*\{[\s\S]*?\n\s*\}/);
  // Execute the exact payload expression rather than test a duplicated value.
  const payload=html.match(/body:\s*JSON\.stringify\((\{\s*password:\s*input[\s\S]*?\})\)/);
  assert.ok(payload,'password payload exists');
  const target=filename==='intro.html'?'/omok-dashboard.html':'/'+filename;
  const value=vm.runInNewContext('('+payload[1]+')',{input:'fixture-not-secret',page:target,location:{pathname:target}});
  assert.equal(value.page,target);
  if(filename==='intro.html'){
   assert.match(html,/requireDashboardPassword\(new URL\(a\.href[^\n]*\.pathname\)/,'link passes actual destination');
   assert.match(html,/async function requireDashboardPassword\(page/);
  }
 });
}
