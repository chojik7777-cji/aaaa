'use strict';
(() => {
  const login=document.getElementById('note-admin-login'), form=document.getElementById('note-password-form');
  const panel=document.getElementById('note-admin-panel'), message=document.getElementById('note-admin-message');
  let token='', notes=[];
  function logout(){token='';notes=[];panel.hidden=true;login.hidden=false;form.reset();document.getElementById('note-password-status').textContent='';}
  async function api(action,body){
    const r=await fetch('/api/note-admin?action='+action,{method:body?'POST':'GET',cache:'no-store',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const d=await r.json();if(!r.ok){if(r.status===401)logout();throw new Error(d.error||'요청을 처리하지 못했습니다.');}return d;
  }
  async function refresh(){
    notes=(await api('status')).notes;
    document.getElementById('note-password-status').textContent=notes.map(n=>(n.id==='note'?'노트 A':'노트 B')+': '+new Date(n.updatedAt).toLocaleString('ko-KR')).join(' / ');
    panel.hidden=false;login.hidden=true;
  }
  async function busy(button,work){button.disabled=true;message.textContent='처리 중입니다…';try{await work();}catch(e){message.textContent=e.message||'서버에 연결할 수 없습니다.';}finally{button.disabled=false;}}
  login.addEventListener('submit',e=>{
    e.preventDefault();const password=login.elements.password.value;login.reset();
    busy(login.querySelector('button'),async()=>{token=(await api('login',{password})).token;await refresh();message.textContent='관리자 인증이 완료되었습니다. 인증은 15분간 유효합니다.';});
  });
  form.addEventListener('submit',e=>{
    e.preventDefault();const id=form.elements.id.value,password=form.elements.password.value,confirmation=form.elements.confirmation.value;
    if(password!==confirmation){message.textContent='새 비밀번호와 확인란이 일치하지 않습니다.';return;}
    if(new TextEncoder().encode(password).length>256){message.textContent='비밀번호는 256바이트 이하로 입력해 주세요.';return;}
    if(!window.confirm('해당 노트의 비밀번호를 변경하고 기존 로그인을 모두 해제할까요?'))return;
    const revision=notes.find(n=>n.id===id)?.revision;form.elements.password.value='';form.elements.confirmation.value='';
    busy(form.querySelector('button'),async()=>{await api('rotate',{id,password,confirmation,revision});await refresh();message.textContent='비밀번호가 변경되었습니다. 해당 노트에서 새 비밀번호로 다시 로그인해 주세요.';});
  });
  document.getElementById('note-admin-refresh').addEventListener('click',e=>busy(e.target,async()=>{await refresh();message.textContent='변경 상태를 다시 조회했습니다.';}));
  document.getElementById('note-admin-logout').addEventListener('click',()=>{logout();message.textContent='관리자 로그아웃되었습니다.';});
  window.addEventListener('pagehide',logout);
})();
