'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('admin browser selects/queries typed room and submits its revision, never a previous room revision',async()=>{
 function element(value=''){return {value,disabled:false,hidden:false,handlers:{},addEventListener(k,fn){this.handlers[k]=fn;},replaceChildren(...children){this.children=children;},querySelector(){return this.button??=(element());},reset(){}};}
 const ids=Object.fromEntries(['note-admin-login','note-password-form','note-admin-panel','note-admin-message','note2-room-field','note2-rooms','note-password-status','note-admin-refresh','note-admin-logout'].map(id=>[id,element()]));
 const form=ids['note-password-form'],login=ids['note-admin-login'];form.elements={id:element('note'),room:element('default'),password:element(),confirmation:element()};form.elements.room.disabled=true;login.elements={password:element('admin-pass')};
 const calls=[],confirmations=[];
 async function fetch(url,options){const query=new URL(url,'http://test').searchParams,action=query.get('action'),room=query.get('room'),body=options.body?JSON.parse(options.body):undefined;calls.push({action,room,body});return {ok:true,json:async()=>action==='login'?{token:'admin-token'}:action==='status'?{notes:[{id:'note',revision:'note-rev',updatedAt:0},{id:'note2',room,revision:'rev-'+room,updatedAt:0}],rooms:['alpha','beta']}:{ok:true}};}
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','note-password-admin.js'),'utf8'),{fetch,URL,TextEncoder,document:{getElementById:id=>ids[id],createElement:()=>element()},window:{confirm:s=>{confirmations.push(s);return true;},addEventListener(){}}});
 const flush=async()=>{for(let i=0;i<5;i++)await new Promise(r=>setImmediate(r));};
 login.handlers.submit({preventDefault(){}});await flush();assert.equal(ids['note-admin-panel'].hidden,false);
 form.elements.id.value='note2';form.elements.room.value='alpha';form.elements.id.handlers.change();await flush();assert.equal(form.elements.room.disabled,false);
 form.elements.room.value='beta';form.elements.room.handlers.input();form.elements.password.value='beta-password';form.elements.confirmation.value='beta-password';form.handlers.submit({preventDefault(){}});await flush();
 const rotation=calls.find(c=>c.action==='rotate');assert.ok(rotation);assert.equal(rotation.room,'beta');assert.equal(rotation.body.room,'beta');assert.equal(rotation.body.revision,'rev-beta');assert.match(confirmations[0],/beta/);
 const rotationCount=calls.filter(c=>c.action==='rotate').length;
 form.elements.room.value='ALPHA';form.elements.room.handlers.input();form.elements.password.value='alpha-password';form.elements.confirmation.value='alpha-password';form.handlers.submit({preventDefault(){}});await flush();
 assert.equal(calls.filter(c=>c.action==='rotate').length,rotationCount);assert.match(ids['note-admin-message'].textContent,/소문자|대문자/);
 form.elements.id.value='note';form.elements.room.value='../invalid';form.elements.id.handlers.change();await flush();assert.equal(form.elements.room.disabled,true);
});
