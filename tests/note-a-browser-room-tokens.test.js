'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const prelude=fs.readFileSync(path.join(__dirname,'..','note.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].split('function setEditingLocked')[0];
function boot(search){const elements=new Map(),storage=new Map([['note-token','existing-default-token'],['note-token:alpha','alpha-token'],['note-token:beta','beta-token']]);const context={URLSearchParams,location:{search,pathname:'/note.html'},history:{replaceState(){}},document:{getElementById:id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id);}},localStorage:{getItem:k=>storage.get(k)||null}};vm.createContext(context);vm.runInContext(prelude,context);return expression=>vm.runInContext(expression,context);}
test('note A isolates named room browser tokens and retains legacy default login storage',()=>{
 assert.equal(boot('')('token()'),'existing-default-token');assert.equal(boot('?room=default')('TOKEN_KEY'),'note-token');assert.equal(boot('?room=alpha')('token()'),'alpha-token');assert.equal(boot('?room=beta')('token()'),'beta-token');assert.equal(boot('?room=newroom')('token()'),'');
});
test('note A preserves full valid room identity and rejects aliases instead of silently rewriting',()=>{
 const room='a'.repeat(50);assert.equal(boot('?room='+room)('room'),room);
 for(const search of ['?room=ALPHA','?room=backup','?room=__proto__','?room=prototype','?room=constructor','?room=alpha&room=beta','?room=bad%2Froom','?room='+room+'a','?room='])assert.throws(()=>boot(search),undefined,search);
});
