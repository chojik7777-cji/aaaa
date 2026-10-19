/* Game-only JSON backup. Never copy browser-wide storage or login credentials. */
(function(root){
 'use strict';
 const FORMAT='aaaa-game-backup',VERSION=1,MAX_BYTES=2*1024*1024;
 function safeTree(value,depth=0,budget={left:100000}){
  if(--budget.left<0||depth>40)throw new Error('게임 데이터가 너무 복잡합니다.');
  if(value===null||typeof value==='string'||typeof value==='boolean')return;
  if(typeof value==='number'&&Number.isFinite(value))return;
  if(typeof value!=='object')throw new Error('올바른 게임 데이터가 아닙니다.');
  for(const key of Object.keys(value)){
   if(['__proto__','prototype','constructor'].includes(key))throw new Error('허용되지 않는 데이터 항목입니다.');
   safeTree(value[key],depth+1,budget);
  }
 }
 function makeBackup(adapter){
  const raw=adapter.capture();safeTree(raw);
  const data=adapter.validate(JSON.parse(JSON.stringify(raw)));safeTree(data);
  const result={format:FORMAT,version:VERSION,game:adapter.gameId,exportedAt:new Date().toISOString(),data};
  if(new TextEncoder().encode(JSON.stringify(result)).length>MAX_BYTES)throw new Error('백업은 2MB 이하만 저장할 수 있습니다.');
  return result;
 }
 function parseBackup(text,gameId){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)throw new Error('2MB 이하의 게임 JSON 파일을 선택해 주세요.');
  let data;try{data=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw new Error('올바른 JSON 파일이 아닙니다.');}
  safeTree(data);
  if(!data||Array.isArray(data)||data.format!==FORMAT||data.version!==VERSION||data.game!==gameId||!Object.hasOwn(data,'data'))throw new Error('이 게임에서 내보낸 버전 1 백업 파일을 선택해 주세요.');
  return data.data;
 }
 function mount(adapter){
  const doc=root.document;
  if(!doc||!adapter||!/^[a-z][a-z0-9-]{1,48}$/.test(adapter.gameId)||!['capture','validate','restore'].every(k=>typeof adapter[k]==='function'))throw new Error('게임 백업 설정이 올바르지 않습니다.');
  if(doc.getElementById('game-transfer-panel'))throw new Error('게임 백업 버튼이 이미 있습니다.');
  const style=doc.createElement('style');style.textContent='#game-transfer-panel{box-sizing:border-box;clear:both;width:calc(100% - 24px);max-width:1080px;margin:24px auto;padding:18px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc;color:#1e293b;font:14px/1.6 system-ui,sans-serif;text-align:left}#game-transfer-panel h2{font-size:18px;margin:0 0 8px}#game-transfer-panel p{margin:8px 0;overflow-wrap:anywhere}#game-transfer-panel .game-transfer-actions{display:flex;gap:10px;flex-wrap:wrap}#game-transfer-panel button{box-sizing:border-box;flex:1;min-height:44px;min-width:140px;margin:0;padding:10px 14px;border:1px solid #94a3b8;border-radius:8px;background:#fff;color:#0f172a;cursor:pointer;font:inherit;touch-action:manipulation}#game-transfer-panel button:disabled{opacity:.55;cursor:wait}#game-transfer-panel [hidden]{display:none!important}';doc.head.append(style);
  const panel=doc.createElement('section'),heading=doc.createElement('h2'),description=doc.createElement('p'),actions=doc.createElement('div'),exportBtn=doc.createElement('button'),importBtn=doc.createElement('button'),fileInput=doc.createElement('input'),status=doc.createElement('p');
  panel.id='game-transfer-panel';heading.textContent=String(adapter.title||'게임')+' · Export / Import';description.textContent=adapter.description||'게임 진행·기록·설정을 JSON 파일로 저장하고 불러옵니다. 불러오기는 현재 게임 데이터를 바꿉니다. 온라인 방과 접속 권한은 옮기지 않습니다.';
  actions.className='game-transfer-actions';exportBtn.id='game-export-btn';exportBtn.type='button';exportBtn.textContent='Export · 내보내기';importBtn.id='game-import-btn';importBtn.type='button';importBtn.textContent='Import · 불러오기';fileInput.id='game-import-file';fileInput.type='file';fileInput.accept='application/json,.json';fileInput.hidden=true;status.id='game-transfer-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  actions.append(exportBtn,importBtn);panel.append(heading,description,actions,fileInput,status);doc.body.append(panel);
  const guard=kind=>{const fn=adapter[kind];if(typeof fn!=='function')return;const result=fn();if(result!==true&&result!==undefined)throw new Error(typeof result==='string'?result:'현재는 게임 데이터를 불러올 수 없습니다.');};
  const report=e=>{status.textContent=e&&e.message?e.message:'게임 파일을 처리하지 못했습니다.';};
  exportBtn.addEventListener('click',()=>{
   try{guard('canExport');const payload=makeBackup(adapter),blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}),url=root.URL.createObjectURL(blob),link=doc.createElement('a');link.href=url;link.download=adapter.gameId+'_'+new Date().toISOString().replace(/[-:]/g,'').replace(/\..+$/,'').replace('T','_')+'.json';link.hidden=true;panel.append(link);try{link.click();status.textContent='게임 데이터를 JSON 파일로 내보냈습니다.';}finally{link.remove();root.setTimeout(()=>root.URL.revokeObjectURL(url),1000);}}
   catch(e){report(e);}
  });
  importBtn.addEventListener('click',()=>{try{guard('canImport');fileInput.click();}catch(e){report(e);}});
  fileInput.addEventListener('change',async()=>{
   const file=fileInput.files&&fileInput.files[0];if(!file)return;
   exportBtn.disabled=importBtn.disabled=fileInput.disabled=true;status.textContent='게임 파일을 확인하고 있습니다…';
   try{
    guard('canImport');if(file.size>MAX_BYTES)throw new Error('2MB 이하의 게임 JSON 파일을 선택해 주세요.');
    const raw=parseBackup(await file.text(),adapter.gameId),normalized=adapter.validate(raw);safeTree(normalized);guard('canImport');
    if(!root.confirm(String(adapter.title||'게임')+'의 현재 데이터를 이 백업으로 바꿀까요? 현재 진행 상태는 덮어씁니다.')){status.textContent='불러오기를 취소했습니다. 기존 데이터는 그대로입니다.';return;}
    guard('canImport');await adapter.restore(normalized);status.textContent='게임 데이터를 불러왔습니다.';
   }catch(e){report(e);}finally{fileInput.value='';exportBtn.disabled=importBtn.disabled=fileInput.disabled=false;}
  });
  return {panel,exportBtn,importBtn,fileInput,status};
 }
 function persist(entries,storage=root.localStorage){
  let before;const written=[];
  try{
   before=Object.keys(entries).map(key=>[key,storage.getItem(key)]);
   for(const [key,value] of Object.entries(entries)){if(typeof value!=='string')throw new Error('Invalid game storage value');storage.setItem(key,value);written.push(key);}
  }catch(e){
   let rollbackFailed=false;
   for(const [key,value] of (before||[]).slice().reverse())if(written.includes(key))try{if(value===null)storage.removeItem(key);else storage.setItem(key,value);}catch{rollbackFailed=true;}
   throw new Error(rollbackFailed?'브라우저 저장소 복구에 실패했습니다. 기존 백업을 보관하고 저장 공간·권한을 확인해 주세요.':'브라우저 저장 공간이나 권한 문제로 불러오기를 중단했습니다. 기존 데이터는 유지했습니다.');
  }
 }
 const api={makeBackup,parseBackup,mount,persist,MAX_BYTES};
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.GameTransfer=api;
})(typeof window!=='undefined'?window:globalThis);
