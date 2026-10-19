'use strict';
(() => {
  const login=document.getElementById('note-admin-login'),form=document.getElementById('note-password-form');
  const panel=document.getElementById('note-admin-panel'),message=document.getElementById('note-admin-message');
  const roomField=document.getElementById('note2-room-field'),roomInput=form.elements.room;
  const create=document.getElementById('note2-create-form'),roomList=document.getElementById('note2-room-list');
  const noteCreate=document.getElementById('note-a-create-form'),noteRoomList=document.getElementById('note-a-room-list');
  const auditList=document.getElementById('security-audit-list'),auditStatus=document.getElementById('security-audit-status'),auditRefresh=document.getElementById('security-audit-refresh');
  const selectionHeading=document.getElementById('note-password-selection'),selectionStatus=document.getElementById('note-password-selection-status');
  let auditSequence=0;
  let token='',notes=[],rooms=[],noteRooms=[],sequence=0;
  function renderAudit(events){
    auditList.replaceChildren(...events.map(event=>{
      const card=document.createElement('article'),fields=document.createElement('dl');card.className='security-event';
      for(const [label,value] of [['시각 (한국 시간)',event.timeKst||(event.time?new Date(event.time).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'—')],['IP',event.ip],['페이지',event.page],['방',event.room],['연속 실패 횟수',event.count],['IP 출처',event.ipSource]]){
        const term=document.createElement('dt'),description=document.createElement('dd');term.textContent=label;description.textContent=String(value??'—');fields.append(term,description);
      }
      card.append(fields);
      const details=document.createElement('details'),summary=document.createElement('summary'),info=document.createElement('p');summary.textContent='요청 상세';
      info.textContent=['엔드포인트: '+(event.endpoint??'—'),'연결 IP: '+(event.peerIp??event.peer??'—'),'유형: '+(event.type??event.outcome??'—'),'User-Agent: '+(event.userAgent??'—')].join('\n');details.append(summary,info);card.append(details);return card;
    }));
    auditStatus.textContent=events.length?'최근 보안 기록 '+events.length+'건입니다.':'보안 기록이 없습니다.';
  }
  async function refreshAudit(){
    if(!token||!auditList)return;
    const auth=token,seq=++auditSequence;auditRefresh.disabled=true;auditStatus.textContent='보안 기록을 조회하고 있습니다…';
    try{
      const response=await fetch('/api/security-audit',{method:'GET',cache:'no-store',headers:{Authorization:'Bearer '+auth}});
      if(auth!==token||seq!==auditSequence)return;
      if(response.status===401){logout();message.textContent='관리자 인증이 만료되었습니다. 다시 로그인해 주세요.';return;}
      const data=await response.json();
      if(auth!==token||seq!==auditSequence)return;
      if(response.status===503){auditList.replaceChildren();auditStatus.textContent=data.code==='LOCAL_ONLY'?'보안 기록은 Mac mini 로컬/터널에서만 사용할 수 있습니다.':'보안 기록 저장소 또는 인증 서비스 장애입니다. 권한·잠금 상태와 서버 로그를 확인해 주세요.';return;}
      if(!response.ok)throw new Error('보안 기록을 조회하지 못했습니다.');
      renderAudit(Array.isArray(data.records)?data.records:Array.isArray(data.events)?data.events:[]);
    }catch(e){if(auth===token&&seq===auditSequence)auditStatus.textContent='보안 기록을 조회하지 못했습니다. 잠시 후 다시 시도해 주세요.';}
    finally{if(seq===auditSequence)auditRefresh.disabled=false;}
  }
  auditRefresh?.addEventListener('click',refreshAudit);
  function validRoom(room){
    if(!/^[a-z0-9_-]{1,50}$/.test(room)||Object.hasOwn(Object.prototype,room)||room==='prototype')throw new Error('방 이름은 영문 소문자, 숫자, _ 또는 -로 1~50자 입력해 주세요. 대문자는 사용할 수 없습니다.');
    return room;
  }
  function selectedRoom(){return form.elements.id.value==='note2'||noteRoomList?validRoom(roomInput.value||'default'):'default';}
  function matchesSelection(note,id,room){return note.id===id&&(note.room||'default')===room;}
  function passwordOf(target){
    const password=target.elements.password.value,confirmation=target.elements.confirmation.value;
    if(password!==confirmation)throw new Error('새 비밀번호와 확인란이 일치하지 않습니다.');
    if(password.length<8||new TextEncoder().encode(password).length>256)throw new Error('비밀번호는 8자 이상, 256바이트 이하로 입력해 주세요.');
    return {password,confirmation};
  }
  function logout(){if(selectionHeading)selectionHeading.textContent='선택한 방 비밀번호 변경';if(selectionStatus)selectionStatus.textContent='';auditSequence++;auditList?.replaceChildren();if(auditStatus)auditStatus.textContent='';if(auditRefresh)auditRefresh.disabled=false;sequence++;token='';notes=[];rooms=[];noteRooms=[];panel.hidden=true;login.hidden=false;form.reset();create.reset();noteCreate?.reset();roomField.hidden=true;roomInput.disabled=true;roomList.replaceChildren();noteRoomList?.replaceChildren();document.getElementById('note2-rooms').replaceChildren();document.getElementById('note-password-status').textContent='';}
  function roomResetButton(id,room){
    const reset=document.createElement('button');reset.type='button';reset.textContent='내용·파일 초기화';
    reset.addEventListener('click',()=>{
      const auth=token,label=id==='note'?'노트 A':'노트 B';if(!auth||reset.disabled)return;
      if(!window.confirm(label+' / '+room+' 방의 본문과 첨부파일을 삭제하고 버전을 0으로 초기화할까요? 다른 방과 방별 비밀번호·로그인·백업은 유지됩니다.'))return;
      busy(reset,async()=>{
        if(token!==auth)return;
        await api('reset-content',{id,room},room);if(token!==auth)return;
        await refresh();if(token!==auth)return;
        message.textContent=label+' / '+room+' 방의 본문·첨부파일이 삭제되고 버전이 0으로 초기화되었습니다. 다른 방·비밀번호·로그인·백업은 유지됩니다.';
      });
    });
    return reset;
  }
  function roomDeleteControl(id,room){
    const box=document.createElement('div'),button=document.createElement('button'),status=document.createElement('p');
    button.type='button';button.textContent='방 삭제';button.className='room-delete';status.className='room-delete-status';status.role='status';
    if(room==='default'){button.disabled=true;button.title='기본방은 삭제할 수 없습니다.';}
    button.addEventListener('click',()=>{
      const auth=token,label=id==='note'?'노트 A':'노트 B';if(!auth||button.disabled||room==='default')return;
      const confirmation=window.prompt(label+' / '+room+' 방을 삭제할까요? 방 목록에서 사라지고 기존 로그인이 해제됩니다. 본문·첨부·백업은 보존되며 같은 방 이름은 다시 사용할 수 없습니다.\n삭제하려면 방 이름 「'+room+'」을 정확히 입력해 주세요.','');
      if(confirmation===null)return;
      if(confirmation!==room){status.textContent='방 이름이 일치하지 않아 삭제하지 않았습니다.';return;}
      busy(button,async()=>{
        status.textContent='삭제할 방을 확인하고 있습니다…';
        try{
          const snapshot=await api('status',undefined,room,id);if(token!==auth)return;
          const revision=snapshot.notes.find(n=>matchesSelection(n,id,room))?.revision;
          if(!revision)throw new Error('방 상태를 확인하지 못했습니다. 다시 조회해 주세요.');
          await api('delete-room',{id,room,confirmation,revision},room);if(token!==auth)return;
          let updated;
          if(form.elements.id.value===id&&selectedRoom()===room){roomInput.value='default';updated=await selectionChanged();}
          else updated=await refresh();
          if(!updated||token!==auth)return;
          message.textContent=label+' / '+room+' 방을 삭제했습니다. 기존 로그인은 해제되며 본문·첨부·백업은 보존됩니다. 같은 방 이름은 다시 사용할 수 없습니다.';
          message.scrollIntoView({behavior:'smooth',block:'center'});
        }catch(e){status.textContent=e.message||'방을 삭제하지 못했습니다.';throw e;}
      });
    });
    box.append(button,status);return box;
  }
  function renderNoteRooms(){
    if(!noteRoomList)return;
    noteRoomList.replaceChildren(...noteRooms.map(room=>{
      const card=document.createElement('div'),name=document.createElement('strong'),link=document.createElement('a'),select=document.createElement('button');
      card.className='room-card';name.textContent=room;link.textContent='방 열기 ↗';link.href='note.html?room='+encodeURIComponent(room);link.target='_blank';link.rel='noopener noreferrer';
      select.type='button';select.textContent='이 방 선택 / 비밀번호 변경';
      select.addEventListener('click',()=>selectRoomForPassword('note',room));
      card.append(name,link,select,roomResetButton('note',room),roomDeleteControl('note',room));return card;
    }));
  }
  function renderRoomOptions(){
    const options=(form.elements.id.value==='note'?noteRooms:rooms).map(value=>{const option=document.createElement('option');option.value=value;return option;});
    document.getElementById('note2-rooms').replaceChildren(...options);
  }
  async function api(action,body,room='default',noteId=form.elements.id.value){
    const r=await fetch('/api/note-admin?action='+action+'&room='+encodeURIComponent(room)+(action==='status'?'&id='+encodeURIComponent(noteId):''),{method:body?'POST':'GET',cache:'no-store',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const d=await r.json();if(!r.ok){if(r.status===401)logout();throw new Error(d.error||'요청을 처리하지 못했습니다.');}return d;
  }
  function renderRooms(){
    const cards=rooms.map(room=>{
      const card=document.createElement('div'),name=document.createElement('strong'),link=document.createElement('a'),select=document.createElement('button');
      card.className='room-card';name.textContent=room;link.textContent='방 열기 ↗';link.href='note2.html?room='+encodeURIComponent(room);link.target='_blank';link.rel='noopener noreferrer';
      select.type='button';select.textContent='이 방 선택 / 비밀번호 변경';
      select.addEventListener('click',()=>selectRoomForPassword('note2',room));
      card.append(name,link,select,roomResetButton('note2',room),roomDeleteControl('note2',room));return card;
    });
    roomList.replaceChildren(...cards);
    if(!rooms.length)roomList.textContent='등록된 방이 없습니다. NEW ROOM에서 새 방을 생성하세요.';
  }
  async function refresh(){
    const id=form.elements.id.value,room=selectedRoom(),seq=++sequence,d=await api('status',undefined,room);
    if(seq!==sequence||!token||form.elements.id.value!==id||selectedRoom()!==room)return false;
    notes=d.notes;rooms=d.rooms;noteRooms=d.noteRooms||['default'];renderRooms();renderNoteRooms();renderRoomOptions();
    roomField.hidden=!noteRoomList&&id!=='note2';roomInput.disabled=roomField.hidden;
    if(roomField.firstChild?.nodeType===3)roomField.firstChild.textContent=(id==='note'?'노트 A':'노트 B')+' 방 선택 / 직접 입력';
    document.getElementById('note-password-status').textContent=notes.filter(n=>n.id==='note'?noteRooms.includes(n.room||'default'):rooms.includes(n.room)).map(n=>(n.id==='note'?'노트 A / '+(n.room||'default'):'노트 B / '+n.room)+': '+new Date(n.updatedAt).toLocaleString('ko-KR')).join(' / ');
    panel.hidden=false;login.hidden=true;return true;
  }
  async function busy(button,work){button.disabled=true;message.textContent='처리 중입니다…';try{return await work();}catch(e){message.textContent=e.message||'서버에 연결할 수 없습니다.';return false;}finally{button.disabled=false;}}
  login.addEventListener('submit',e=>{
    e.preventDefault();const password=login.elements.password.value;login.reset();
    busy(login.querySelector('button'),async()=>{token=(await api('login',{password})).token;await refresh();if(token)void refreshAudit();message.textContent='관리자 인증이 완료되었습니다. 인증은 15분간 유효합니다.';});
  });
  form.addEventListener('submit',e=>{
    e.preventDefault();
    busy(form.querySelector('button'),async()=>{
      const id=form.elements.id.value,room=selectedRoom(),{password,confirmation}=passwordOf(form),auth=token;
      if(!(id==='note'?noteRooms:rooms).includes(room))throw new Error('등록되지 않은 방입니다. NEW ROOM에서 먼저 생성해 주세요.');
      // Never reuse a different room's revision after editing the selection.
      if(!notes.some(n=>matchesSelection(n,id,room))){if(!await refresh())return;}
      if(!token||token!==auth||id!==form.elements.id.value||room!==selectedRoom())return;
      const revision=notes.find(n=>matchesSelection(n,id,room))?.revision;
      if(!revision)throw new Error('변경 상태를 다시 조회해 주세요.');
      if(!window.confirm((id==='note2'?'노트 B / ':'노트 A / ')+room+' 비밀번호를 변경하고 해당 로그인만 해제할까요?'))return;
      form.elements.password.value='';form.elements.confirmation.value='';
      await api('rotate',{id,room,password,confirmation,revision},room);if(token!==auth)return;await refresh();message.textContent='비밀번호가 변경되었습니다. 해당 노트/방에서 새 비밀번호로 다시 로그인해 주세요.';
    });
  });
  create.addEventListener('submit',e=>{
    e.preventDefault();
    busy(create.querySelector('button'),async()=>{
      const room=validRoom(create.elements.room.value),{password,confirmation}=passwordOf(create),auth=token;
      if(!auth)throw new Error('관리자 인증이 필요합니다. 다시 로그인해 주세요.');
      if(rooms.includes(room))throw new Error('이미 등록된 방입니다. 목록에서 선택해 비밀번호를 변경하세요.');
      if(!window.confirm('노트 B / '+room+' 방을 생성하고 초기 비밀번호를 설정할까요? 기존 방은 덮어쓰지 않습니다.'))return;
      create.elements.password.value='';create.elements.confirmation.value='';
      await api('create',{room,password,confirmation},room);if(token!==auth)return;
      create.reset();form.elements.id.value='note2';roomInput.value=room;roomField.hidden=false;roomInput.disabled=false;notes=[];
      await refresh();message.textContent='새 방이 생성되었습니다. 지정한 초기 비밀번호로 바로 로그인하세요. 데이터 폴더는 첫 저장/업로드 시 생성됩니다.';
    });
  });
  noteCreate?.addEventListener('submit',e=>{
    e.preventDefault();
    busy(noteCreate.querySelector('button'),async()=>{
      const room=validRoom(noteCreate.elements.room.value),{password,confirmation}=passwordOf(noteCreate),auth=token;
      if(!auth)throw new Error('관리자 인증이 필요합니다. 다시 로그인해 주세요.');
      if(noteRooms.includes(room))throw new Error('이미 등록된 방입니다. 목록에서 선택해 비밀번호를 변경하세요.');
      if(!window.confirm('노트 A / '+room+' 방을 생성하고 초기 비밀번호를 설정할까요? 기존 방은 덮어쓰지 않습니다.'))return;
      noteCreate.elements.password.value='';noteCreate.elements.confirmation.value='';
      await api('create',{id:'note',room,password,confirmation},room);if(token!==auth)return;
      noteCreate.reset();form.elements.id.value='note';roomInput.value=room;form.elements.password.value='';form.elements.confirmation.value='';notes=[];
      await refresh();if(token!==auth)return;
      message.textContent='노트 A 새 방이 생성되었습니다. 지정한 초기 비밀번호로 바로 로그인하세요.';
    });
  });
  roomInput.addEventListener('input',()=>{sequence++;notes=[];});
  function selectionChanged(){roomField.hidden=!noteRoomList&&form.elements.id.value!=='note2';roomInput.disabled=roomField.hidden;if(roomField.firstChild?.nodeType===3)roomField.firstChild.textContent=(form.elements.id.value==='note'?'노트 A':'노트 B')+' 방 선택 / 직접 입력';form.elements.password.value='';form.elements.confirmation.value='';renderRoomOptions();notes=[];sequence++;if(selectionHeading)selectionHeading.textContent=(form.elements.id.value==='note'?'노트 A':'노트 B')+' / '+(roomInput.value||'default')+' 비밀번호 변경';if(token)return busy(document.getElementById('note-admin-refresh'),refresh);return false;}
  async function selectRoomForPassword(id,room){
    if(!token)return;
    form.elements.id.value=id;roomInput.value=room;
    const selected=selectionChanged();
    if(selectionStatus)selectionStatus.textContent='선택한 방을 확인하고 있습니다…';
    form.scrollIntoView({behavior:'smooth',block:'start'});
    form.elements.password.focus({preventScroll:true});
    const ok=await selected;
    if(!token||form.elements.id.value!==id||selectedRoom()!==room)return;
    if(!ok){if(selectionStatus)selectionStatus.textContent=message.textContent;return;}
    const feedback=(id==='note'?'노트 A':'노트 B')+' / '+room+' 방을 선택했습니다. 새 비밀번호를 입력하고 「새 비밀번호 저장」을 눌러 주세요.';
    message.textContent=feedback;if(selectionStatus)selectionStatus.textContent=feedback;
  }
  roomInput.addEventListener('change',selectionChanged);form.elements.id.addEventListener('change',selectionChanged);
  document.getElementById('note-admin-refresh').addEventListener('click',e=>busy(e.target,async()=>{await refresh();message.textContent='변경 상태를 다시 조회했습니다.';}));
  document.getElementById('note-admin-logout').addEventListener('click',()=>{logout();message.textContent='관리자 로그아웃되었습니다.';});
  document.getElementById('note-a-select-password')?.addEventListener('click',()=>selectRoomForPassword('note','default'));
  window.addEventListener('pagehide',logout);
})();
