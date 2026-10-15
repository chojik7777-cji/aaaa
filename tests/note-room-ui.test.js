'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
test('note2 browser validates exact rooms and uses separate room token keys',()=>{
 const html=fs.readFileSync(path.join(root,'note2.html'),'utf8');const source=html.split("<script>\n'use strict';")[1].split('function showLock')[0];
 function evaluate(search){return vm.runInNewContext(source+';({room,TOKEN_KEY,token:token()})',{URLSearchParams,location:{search,pathname:'/note2.html'},history:{replaceState(){}},document:{getElementById(){return {};}},localStorage:{getItem:k=>k==='note2-token:alpha'?'alpha-token':k==='note2-token'?'unsafe-global':''}});}
 assert.equal(evaluate('?room=alpha').TOKEN_KEY,'note2-token:alpha');assert.equal(evaluate('?room=alpha').token,'alpha-token');assert.equal(evaluate('?room=beta').token,'');assert.equal(evaluate('').room,'default');
 for(const room of ['ALPHA','Alpha','../alpha','a'.repeat(51),'__proto__','constructor',' alpha',''])assert.throws(()=>evaluate('?room='+encodeURIComponent(room)));
 assert.throws(()=>evaluate('?room=alpha&room=beta'));
});
test('admin room selection supports discovered choices and typed names with room-specific revision refresh',()=>{
 const html=fs.readFileSync(path.join(root,'detail-admin-jik-2026.html'),'utf8'),js=fs.readFileSync(path.join(root,'note-password-admin.js'),'utf8');
 assert.match(html,/name="room"/);assert.match(html,/<datalist id="note2-rooms"/);assert.match(js,/d\.rooms/);assert.match(js,/room:.*room|\{id,room,/);assert.match(js,/addEventListener\('change'/);
});
