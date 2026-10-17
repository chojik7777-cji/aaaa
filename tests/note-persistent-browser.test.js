'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
for(const file of ['note.html','note2.html'])test(file+' reload uses stored token; polling 401 locks editing and reauthentication retains draft',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'..',file),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
 const key=file==='note2.html'?'note2-token:alpha':'note-token:alpha',storage=new Map([[key,'existing-token']]);let revoked=false;
 const calls=[];const flush=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};
 function boot(){
  const elements=new Map();function el(){return {value:'',hidden:true,disabled:false,style:{},dataset:{},handlers:{},files:[],addEventListener(k,f){this.handlers[k]=f;},focus(){},select(){},appendChild(){},querySelectorAll(){return []}};}
  const $=id=>{if(!elements.has(id))elements.set(id,el());return elements.get(id);};let poll;
  const context={URLSearchParams,location:{search:'?room=alpha',origin:'http://isolated.test',pathname:'/'+file},history:{replaceState(){}},document:{getElementById:$,createElement:el,body:el()},window:{},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},setTimeout(){return 1;},clearTimeout(){},setInterval(fn){poll=fn;},console:{warn(){}},fetch:async(url,options)=>{
   calls.push({url,options});if(url.includes('/login')){revoked=false;return {status:200,ok:true,json:async()=>({ok:true,token:'renewed-token'})};}
   return revoked?{status:401,ok:false,json:async()=>({ok:false,error:'credentials changed'})}:{status:200,ok:true,json:async()=>({ok:true,version:1,text:'server text',files:[],storage:'folder',maxFileBytes:1000})};
  }};vm.createContext(context);vm.runInContext(source,context);return {$,context,poll:()=>poll()};
 }
 let page=boot();await flush();assert.equal(page.$('editor').value,'server text');assert.equal(calls.at(-1).options.headers['X-Note-Token'],'existing-token');
 page=boot();await flush();assert.equal(page.$('lock').hidden,true);assert.equal(page.$('editor').value,'server text');
 page.$('editor').value='unsaved local draft';page.$('editor').handlers.input();revoked=true;page.poll();await flush();
 assert.equal(page.$('lock').hidden,false);assert.equal(page.$('editor').disabled,true);assert.equal(page.$('saveBtn').disabled,true);assert.equal(page.$('uploadBtn').disabled,true);assert.equal(page.$('fileInput').disabled,true);assert.equal(page.$('editor').value,'unsaved local draft');
 const count=calls.length;await vm.runInContext('saveNow()',page.context);assert.equal(calls.length,count,'no pending autosave while locked');
 page.$('lockPw').value='fixture-new-password';await page.$('lockForm').handlers.submit({preventDefault(){}});await flush();
 assert.equal(page.$('lock').hidden,true);assert.equal(page.$('editor').disabled,false);assert.equal(page.$('editor').value,'unsaved local draft');assert.equal(storage.get(key),'renewed-token');assert.equal(page.$('lockPw').value,'');assert.equal([...storage.values()].includes('fixture-new-password'),false);
 await vm.runInContext('saveNow()',page.context);assert.equal(JSON.parse(calls.at(-1).options.body).text,'unsaved local draft');
});
