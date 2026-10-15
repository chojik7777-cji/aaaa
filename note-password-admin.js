'use strict';
(() => {
  const login=document.getElementById('note-admin-login'),form=document.getElementById('note-password-form');
  const panel=document.getElementById('note-admin-panel'),message=document.getElementById('note-admin-message');
  const roomField=document.getElementById('note2-room-field'),roomInput=form.elements.room;
  let token='',notes=[],sequence=0;
  function selectedRoom(){
    const room=form.elements.id.value==='note2'?roomInput.value:'default';
    if(!/^[a-z0-9_-]{1,50}$/.test(room)||Object.hasOwn(Object.prototype,room)||room==='prototype')throw new Error('방 이름은 영문 소문자, 숫자, _ 또는 -로 1~50자 입력해 주세요. 대문자는 사용할 수 없습니다.');
    return room;
  }
  function logout(){sequence++;token='';notes=[];panel.hidden=true;login.hidden=false;form.reset();roomField.hidden=true;roomInput.disabled=true;document.getElementById('note2-rooms').replaceChildren();document.getElementById('note-password-status').textContent='';}
  async function api(action,body,room='default'){
    const r=await fetch('/api/note-admin?action='+action+'&room='+encodeURIComponent(room),{method:body?'POST':'GET',cache:'no-store',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const d=await r.json();if(!r.ok){if(r.status===401)logout();throw new Error(d.error||'요청을 처리하지 못했습니다.');}return d;
  }
  async function refresh(){
    const room=selectedRoom(),seq=++sequence,d=await api('status',undefined,room);
    if(seq!==sequence||!token||selectedRoom()!==room)return false;
    notes=d.notes;
    const options=d.rooms.map(value=>{const option=document.createElement('option');option.value=value;return option;});
    document.getElementById('note2-rooms').replaceChildren(...options);
    document.getElementById('note-password-status').textContent=notes.map(n=>(n.id==='note'?'노트 A':'노트 B / '+n.room)+': '+new Date(n.updatedAt).toLocaleString('ko-KR')).join(' / ');
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
      const id=form.elements.id.value,room=selectedRoom(),password=form.elements.password.value,confirmation=form.elements.confirmation.value;
      if(password!==confirmation)throw new Error('새 비밀번호와 확인란이 일치하지 않습니다.');
      if(new TextEncoder().encode(password).length>256)throw new Error('비밀번호는 256바이트 이하로 입력해 주세요.');
      // A typed room may not have been queried yet. Never reuse a different room's revision.
      if(!notes.some(n=>n.id===id&&(id!=='note2'||n.room===room))){if(!await refresh())return;}
      if(id!==form.elements.id.value||room!==selectedRoom())return;
      const revision=notes.find(n=>n.id===id&&(id!=='note2'||n.room===room))?.revision;
      if(!revision)throw new Error('변경 상태를 다시 조회해 주세요.');
      if(!window.confirm((id==='note2'?'노트 B / '+room:'노트 A')+' 비밀번호를 변경하고 해당 로그인만 해제할까요?'))return;
      form.elements.password.value='';form.elements.confirmation.value='';
      await api('rotate',{id,room,password,confirmation,revision},room);await refresh();message.textContent='비밀번호가 변경되었습니다. 해당 노트/방에서 새 비밀번호로 다시 로그인해 주세요.';
    });
  });
  roomInput.addEventListener('input',()=>{sequence++;notes=[];});
  function selectionChanged(){roomField.hidden=form.elements.id.value!=='note2';roomInput.disabled=roomField.hidden;notes=[];sequence++;if(token)busy(document.getElementById('note-admin-refresh'),refresh);}
  roomInput.addEventListener('change',selectionChanged);form.elements.id.addEventListener('change',selectionChanged);
  document.getElementById('note-admin-refresh').addEventListener('click',e=>busy(e.target,async()=>{await refresh();message.textContent='변경 상태를 다시 조회했습니다.';}));
  document.getElementById('note-admin-logout').addEventListener('click',()=>{logout();message.textContent='관리자 로그아웃되었습니다.';});
  window.addEventListener('pagehide',logout);
})();
