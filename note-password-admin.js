'use strict';
(() => {
  const login=document.getElementById('note-admin-login'),form=document.getElementById('note-password-form');
  const panel=document.getElementById('note-admin-panel'),message=document.getElementById('note-admin-message');
  const roomField=document.getElementById('note2-room-field'),roomInput=form.elements.room;
  const create=document.getElementById('note2-create-form'),roomList=document.getElementById('note2-room-list');
  let token='',notes=[],rooms=[],sequence=0;
  function validRoom(room){
    if(!/^[a-z0-9_-]{1,50}$/.test(room)||Object.hasOwn(Object.prototype,room)||room==='prototype')throw new Error('방 이름은 영문 소문자, 숫자, _ 또는 -로 1~50자 입력해 주세요. 대문자는 사용할 수 없습니다.');
    return room;
  }
  function selectedRoom(){return form.elements.id.value==='note2'?validRoom(roomInput.value):'default';}
  function passwordOf(target){
    const password=target.elements.password.value,confirmation=target.elements.confirmation.value;
    if(password!==confirmation)throw new Error('새 비밀번호와 확인란이 일치하지 않습니다.');
    if(password.length<8||new TextEncoder().encode(password).length>256)throw new Error('비밀번호는 8자 이상, 256바이트 이하로 입력해 주세요.');
    return {password,confirmation};
  }
  function logout(){sequence++;token='';notes=[];rooms=[];panel.hidden=true;login.hidden=false;form.reset();create.reset();roomField.hidden=true;roomInput.disabled=true;roomList.replaceChildren();document.getElementById('note2-rooms').replaceChildren();document.getElementById('note-password-status').textContent='';}
  async function api(action,body,room='default'){
    const r=await fetch('/api/note-admin?action='+action+'&room='+encodeURIComponent(room),{method:body?'POST':'GET',cache:'no-store',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const d=await r.json();if(!r.ok){if(r.status===401)logout();throw new Error(d.error||'요청을 처리하지 못했습니다.');}return d;
  }
  function renderRooms(){
    const cards=rooms.map(room=>{
      const card=document.createElement('div'),name=document.createElement('strong'),link=document.createElement('a'),select=document.createElement('button');
      card.className='room-card';name.textContent=room;link.textContent='방 열기 ↗';link.href='note2.html?room='+encodeURIComponent(room);link.target='_blank';link.rel='noopener noreferrer';
      select.type='button';select.textContent='이 방 선택 / 비밀번호 변경';
      select.addEventListener('click',()=>{form.elements.id.value='note2';roomInput.value=room;form.elements.password.value='';form.elements.confirmation.value='';selectionChanged();});
      card.append(name,link,select);return card;
    });
    roomList.replaceChildren(...cards);
    if(!rooms.length)roomList.textContent='등록된 방이 없습니다. NEW ROOM에서 새 방을 생성하세요.';
  }
  async function refresh(){
    const room=selectedRoom(),seq=++sequence,d=await api('status',undefined,room);
    if(seq!==sequence||!token||selectedRoom()!==room)return false;
    notes=d.notes;rooms=d.rooms;renderRooms();
    const options=rooms.map(value=>{const option=document.createElement('option');option.value=value;return option;});
    document.getElementById('note2-rooms').replaceChildren(...options);
    document.getElementById('note-password-status').textContent=notes.filter(n=>n.id!=='note2'||rooms.includes(n.room)).map(n=>(n.id==='note'?'노트 A':'노트 B / '+n.room)+': '+new Date(n.updatedAt).toLocaleString('ko-KR')).join(' / ');
    panel.hidden=false;login.hidden=true;return true;
  }
  async function busy(button,work){button.disabled=true;message.textContent='처리 중입니다…';try{await work();}catch(e){message.textContent=e.message||'서버에 연결할 수 없습니다.';}finally{button.disabled=false;}}
  login.addEventListener('submit',e=>{
    e.preventDefault();const password=login.elements.password.value;login.reset();
    busy(login.querySelector('button'),async()=>{token=(await api('login',{password})).token;await refresh();message.textContent='관리자 인증이 완료되었습니다. 인증은 15분간 유효합니다.';});
  });
  form.addEventListener('submit',e=>{
    e.preventDefault();
    busy(form.querySelector('button'),async()=>{
      const id=form.elements.id.value,room=selectedRoom(),{password,confirmation}=passwordOf(form),auth=token;
      if(id==='note2'&&!rooms.includes(room))throw new Error('등록되지 않은 방입니다. NEW ROOM에서 먼저 생성해 주세요.');
      // Never reuse a different room's revision after editing the selection.
      if(!notes.some(n=>n.id===id&&(id!=='note2'||n.room===room))){if(!await refresh())return;}
      if(!token||token!==auth||id!==form.elements.id.value||room!==selectedRoom())return;
      const revision=notes.find(n=>n.id===id&&(id!=='note2'||n.room===room))?.revision;
      if(!revision)throw new Error('변경 상태를 다시 조회해 주세요.');
      if(!window.confirm((id==='note2'?'노트 B / '+room:'노트 A')+' 비밀번호를 변경하고 해당 로그인만 해제할까요?'))return;
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
  roomInput.addEventListener('input',()=>{sequence++;notes=[];});
  function selectionChanged(){roomField.hidden=form.elements.id.value!=='note2';roomInput.disabled=roomField.hidden;notes=[];sequence++;if(token)busy(document.getElementById('note-admin-refresh'),refresh);}
  roomInput.addEventListener('change',selectionChanged);form.elements.id.addEventListener('change',selectionChanged);
  document.getElementById('note-admin-refresh').addEventListener('click',e=>busy(e.target,async()=>{await refresh();message.textContent='변경 상태를 다시 조회했습니다.';}));
  document.getElementById('note-admin-logout').addEventListener('click',()=>{logout();message.textContent='관리자 로그아웃되었습니다.';});
  window.addEventListener('pagehide',logout);
})();
