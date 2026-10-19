/* Shared attachment UI only. Server-side response policy remains in note-preview.js. */
'use strict';
(function (root) {
  const types = {
    jpg:['image','image/jpeg'], jpeg:['image','image/jpeg'], png:['image','image/png'], gif:['image','image/gif'], webp:['image','image/webp'], bmp:['image','image/bmp'], heic:['image','image/heic'],
    pdf:['pdf','application/pdf'], mp4:['video','video/mp4'], webm:['video','video/webm'], mov:['video','video/quicktime'],
    mp3:['audio','audio/mpeg'], m4a:['audio','audio/mp4'], wav:['audio','audio/wav'], ogg:['audio','audio/ogg'], aac:['audio','audio/aac'],
    txt:['text','text/plain'], md:['text','text/plain'], csv:['text','text/plain'], log:['text','text/plain']
  };
  // Match the server's extension allowlist; never trust an uploaded MIME label.
  function info(file) { const match = /\.([a-z0-9]+)$/i.exec(String(file.name || '')); return match ? types[match[1].toLowerCase()] : undefined; }
  function kind(file) { return info(file)?.[0] || ''; }
  function create({list, files, fileUrl, isLocked, onUnauthorized}) {
    let dialog, title, content, closeButton, controller, objectUrl, returnFocus, oldOverflow;
    let deleteDialog, deleteName, deleteCancel, resolveDelete, deleteFocus, deleteOverflow;
    function finishDelete(approved) {
      if (!resolveDelete) return;
      const resolve = resolveDelete;resolveDelete = null;
      deleteDialog.close();document.body.style.overflow = deleteOverflow;
      if (deleteFocus?.isConnected && !isLocked()) deleteFocus.focus({preventScroll:true});
      deleteFocus = null;deleteName.textContent = '';
      resolve(Boolean(approved) && !isLocked());
    }
    function confirmDelete(file) {
      if (isLocked() || resolveDelete) return Promise.resolve(false);
      close();
      if (!deleteDialog) {
        const style = document.createElement('style');
        style.textContent = `.attachment-delete-confirm{width:min(360px,90vw);max-height:80dvh;overflow:auto;box-sizing:border-box;border:0;border-radius:16px;padding:22px;color:#1a202c;background:white;box-shadow:0 20px 70px #0007}.attachment-delete-confirm::backdrop{background:#0f172abf}.attachment-delete-confirm h2{font-size:20px;margin:0 0 12px}.attachment-delete-confirm p{overflow-wrap:anywhere;color:#4a5568;margin:0 0 20px}.attachment-delete-actions{display:flex;justify-content:flex-end;gap:10px}.attachment-delete-actions button{min-height:44px;font:inherit;font-weight:700;padding:10px 18px;border:1px solid #cbd5e0;border-radius:10px;cursor:pointer}.attachment-delete-actions .cancel{background:#edf2f7;color:#2d3748}.attachment-delete-actions .delete{background:#c53030;color:white;border-color:#c53030}`;
        document.head.append(style);
        deleteDialog = document.createElement('dialog');deleteDialog.className = 'attachment-delete-confirm';
        deleteDialog.setAttribute('role','alertdialog');deleteDialog.setAttribute('aria-modal','true');deleteDialog.setAttribute('aria-labelledby','attachment-delete-title');deleteDialog.setAttribute('aria-describedby','attachment-delete-name');
        const heading = document.createElement('h2');heading.id = 'attachment-delete-title';heading.textContent = '삭제하시겠습니까?';
        deleteName = document.createElement('p');deleteName.id = 'attachment-delete-name';
        const actions = document.createElement('div');actions.className = 'attachment-delete-actions';
        deleteCancel = document.createElement('button');deleteCancel.type = 'button';deleteCancel.className = 'cancel';deleteCancel.textContent = '취소';
        const approve = document.createElement('button');approve.type = 'button';approve.className = 'delete';approve.textContent = '삭제';
        deleteCancel.addEventListener('click',()=>finishDelete(false));approve.addEventListener('click',()=>finishDelete(true));
        actions.append(deleteCancel,approve);deleteDialog.append(heading,deleteName,actions);document.body.append(deleteDialog);
        deleteDialog.addEventListener('cancel',event=>{event.preventDefault();finishDelete(false);});
        deleteDialog.addEventListener('click',event=>{if(event.target!==deleteDialog)return;const r=deleteDialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)finishDelete(false);});
        deleteDialog.addEventListener('keydown',event=>{if(event.key!=='Tab')return;if(event.shiftKey&&document.activeElement===deleteCancel){event.preventDefault();approve.focus();}else if(!event.shiftKey&&document.activeElement===approve){event.preventDefault();deleteCancel.focus();}});
      }
      deleteFocus = [...list.querySelectorAll('[data-delete]')].find(button=>button.dataset.delete===String(file.id)) || document.activeElement;
      deleteName.textContent = String(file.name || '첨부파일');deleteOverflow = document.body.style.overflow;document.body.style.overflow = 'hidden';
      return new Promise(resolve=>{resolveDelete = resolve;deleteDialog.showModal();deleteCancel.focus();});
    }
    let renameDialog, renameInput, renameExtension, renameError, renameSave, renameCancel, resolveRename, renameFocus, renameOverflow;
    function finishRename(saved) {
      if (!resolveRename) return;
      const resolve = resolveRename;resolveRename = null;
      renameDialog.close();document.body.style.overflow = renameOverflow;
      if (renameFocus?.isConnected && !isLocked()) renameFocus.focus({preventScroll:true});
      renameFocus = null;resolve(Boolean(saved));
    }
    function editName(file, save) {
      if (isLocked() || resolveRename) return Promise.resolve(false);
      close();
      if (!renameDialog) {
        const style = document.createElement('style');
        style.textContent = `.attachment-rename{width:min(400px,90vw);max-height:80dvh;overflow:auto;box-sizing:border-box;border:0;border-radius:16px;padding:20px;color:#1a202c;background:white;box-shadow:0 20px 70px #0007}.attachment-rename::backdrop{background:#0f172abf}.attachment-rename h2{font-size:20px;margin:0 0 16px}.attachment-rename-field{display:flex;align-items:center;gap:8px;min-width:0}.attachment-rename input{min-width:0;flex:1;width:100%;box-sizing:border-box;font:inherit;border:1px solid #cbd5e0;border-radius:10px;padding:10px}.attachment-rename-extension{flex:none;max-width:40%;overflow-wrap:anywhere}.attachment-rename-error{color:#c53030;overflow-wrap:anywhere;font-size:14px;min-height:1.5em;margin:10px 0}.attachment-rename-actions{display:flex;justify-content:flex-end;gap:10px}.attachment-rename-actions button{min-height:44px;font:inherit;font-weight:700;padding:10px 18px;border:1px solid #cbd5e0;border-radius:10px;cursor:pointer}.attachment-rename-actions .cancel{background:#edf2f7;color:#2d3748}.attachment-rename-actions .save{background:#2b6cb0;color:white}`;
        document.head.append(style);
        renameDialog = document.createElement('dialog');renameDialog.className = 'attachment-rename';renameDialog.setAttribute('aria-labelledby','attachment-rename-title');
        const heading = document.createElement('h2');heading.id = 'attachment-rename-title';heading.textContent = '파일명 변경';
        const label = document.createElement('label');label.htmlFor = 'attachment-rename-input';label.textContent = '파일명';
        const field = document.createElement('div');field.className = 'attachment-rename-field';
        renameInput = document.createElement('input');renameInput.type = 'text';renameInput.id = 'attachment-rename-input';renameInput.autocomplete = 'off';
        renameExtension = document.createElement('span');renameExtension.className = 'attachment-rename-extension';renameExtension.id = 'attachment-rename-extension';renameInput.setAttribute('aria-describedby','attachment-rename-extension attachment-rename-error');
        renameError = document.createElement('p');renameError.id = 'attachment-rename-error';renameError.className = 'attachment-rename-error';renameError.setAttribute('role','status');
        const actions = document.createElement('div');actions.className = 'attachment-rename-actions';
        renameCancel = document.createElement('button');renameCancel.type = 'button';renameCancel.className = 'cancel';renameCancel.textContent = '취소';
        renameSave = document.createElement('button');renameSave.type = 'button';renameSave.className = 'save';renameSave.textContent = '저장';
        renameCancel.addEventListener('click',()=>finishRename(false));
        actions.append(renameCancel,renameSave);field.append(renameInput,renameExtension);renameDialog.append(heading,label,field,renameError,actions);document.body.append(renameDialog);
      }
      const name = String(file.name || ''), dot = name.lastIndexOf('.');
      const extension = dot > 0 ? name.slice(dot) : '';
      renameInput.value = extension ? name.slice(0,dot) : name;renameExtension.textContent = extension;renameError.textContent = '';renameInput.disabled = false;renameSave.disabled = false;
      let pending = false;
      renameSave.onclick = async () => {
        if (pending || !resolveRename || isLocked()) return;
        const stem = renameInput.value, proposed = stem + extension;
        if (!stem.trim() || proposed.length > 160 || new TextEncoder().encode(proposed).length > 255 || /^\./.test(proposed) || /[\x00-\x1f\x7f-\x9f/\\:]/.test(proposed) || proposed.includes('..') || proposed.toLowerCase() === 'backup') {
          renameError.textContent = '파일 이름을 확인해 주세요. 경로·제어문자는 사용할 수 없으며 160자, 255바이트 이내여야 합니다.';renameInput.focus();return;
        }
        const session = resolveRename;
        pending = true;renameSave.disabled = true;renameInput.disabled = true;
        try { await save(proposed);if (resolveRename === session) finishRename(true); }
        catch (error) { if (resolveRename === session && !isLocked()) {renameError.textContent = error.message || '파일명을 변경하지 못했습니다.';renameInput.disabled = false;renameSave.disabled = false;pending = false;renameInput.focus();} }
      };
      renameDialog.oncancel = event => {event.preventDefault();finishRename(false);};
      renameDialog.onclick = event => {if(event.target!==renameDialog)return;const r=renameDialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)finishRename(false);};
      renameFocus = [...list.querySelectorAll('[data-rename]')].find(button=>button.dataset.rename===String(file.id)) || document.activeElement;
      renameOverflow = document.body.style.overflow;document.body.style.overflow = 'hidden';
      return new Promise(resolve=>{resolveRename=resolve;renameDialog.showModal();renameInput.focus();renameInput.select();});
    }
    function clear() {
      controller?.abort(); controller = null;
      if (content) {
        content.querySelectorAll('video,audio').forEach(media => {media.pause();media.removeAttribute('src');media.load();});
        content.querySelectorAll('img,iframe').forEach(node => node.removeAttribute('src'));
        content.replaceChildren();
      }
      if (objectUrl) {URL.revokeObjectURL(objectUrl);objectUrl = null;}
      if (title) title.textContent = '';
    }
    function close() {
      finishRename(false);
      finishDelete(false);
      const wasOpen = dialog?.open;
      clear();
      if (wasOpen) {
        dialog.close(); document.body.style.overflow = oldOverflow;
        if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
      }
      returnFocus = null;
    }
    function mount() {
      if (dialog) return;
      const style = document.createElement('style');
      style.textContent = `
        .attachment-preview{position:fixed;inset:0;margin:auto;width:80vw;max-width:80vw;height:80vh;height:80dvh;max-height:80vh;max-height:80dvh;padding:16px;border:0;border-radius:16px;background:#fff;color:#1a202c;overflow:hidden;box-shadow:0 20px 70px #0007;box-sizing:border-box}
        .attachment-preview[open]{display:flex;flex-direction:column;gap:12px}
        .attachment-preview::backdrop{background:rgba(15,23,42,.75)}
        .attachment-preview-heading{display:flex;align-items:center;gap:12px;flex:none;min-width:0}
        .attachment-preview h2{margin:0;flex:1;min-width:0;font-size:18px;overflow-wrap:anywhere;max-height:4.5em;overflow:auto}
        .attachment-preview-close{flex:none;width:44px;height:44px;padding:0;font-size:24px;background:#edf2f7;color:#1a202c;border:1px solid #cbd5e0;border-radius:10px;cursor:pointer}
        .attachment-preview-content{min-width:0;min-height:0;overflow:auto;text-align:center}
        .attachment-preview-content img,.attachment-preview-content video{display:block;margin:auto;max-width:100%;max-height:calc(80vh - 150px);max-height:calc(80dvh - 150px);object-fit:contain}
        .attachment-preview-content audio{display:block;width:100%;max-width:100%}
        .attachment-preview-content iframe{display:block;width:100%;height:calc(80vh - 150px);height:calc(80dvh - 150px);border:0}
        .attachment-preview-content pre{margin:0;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere;max-width:100%}
      `;
      document.head.appendChild(style);
      dialog = document.createElement('dialog'); dialog.className = 'attachment-preview';
      dialog.setAttribute('aria-modal','true'); dialog.setAttribute('aria-labelledby','attachment-preview-title');
      const heading = document.createElement('div'); heading.className = 'attachment-preview-heading';
      title = document.createElement('h2'); title.id = 'attachment-preview-title';
      closeButton = document.createElement('button'); closeButton.type = 'button'; closeButton.className = 'attachment-preview-close'; closeButton.textContent = '×';closeButton.setAttribute('aria-label','미리보기 닫기');
      closeButton.addEventListener('click',close);heading.append(title,closeButton);
      content = document.createElement('div');content.className = 'attachment-preview-content';content.setAttribute('aria-live','polite');
      dialog.append(heading,content);document.body.appendChild(dialog);
      dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
      dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();});
      dialog.addEventListener('keydown',event=>{
        if(event.key!=='Tab')return;
        const stops=[...dialog.querySelectorAll('button,a[href],audio[controls],video[controls],iframe')].filter(el=>!el.disabled);
        const first=stops[0],last=stops.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      });
    }
    async function open(file, trigger) {
      const format=info(file);if(!format||isLocked())return;
      mount();close();returnFocus=trigger;title.textContent=String(file.name||'첨부파일');content.textContent='불러오는 중입니다…';
      oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.showModal();closeButton.focus();
      const request=new AbortController();controller=request;
      try {
        const response=await fetch(fileUrl(file,true),{signal:request.signal,cache:'no-store',credentials:'same-origin'});
        if(request.signal.aborted)return;
        if(response.status===401){close();onUnauthorized();return;}
        if(!response.ok)throw new Error('preview unavailable');
        const blob=await response.blob();
        if(request.signal.aborted||isLocked())return;
        let node;
        if(format[0]==='text') {const text=await blob.text();if(request.signal.aborted||isLocked())return;node=document.createElement('pre');node.textContent=text;}
        else {
          objectUrl=URL.createObjectURL(new Blob([blob],{type:format[1]}));
          node=document.createElement(({image:'img',pdf:'iframe',video:'video',audio:'audio'})[format[0]]);
          if(format[0]==='image'){node.alt=String(file.name||'첨부 이미지');node.onerror=()=>{if(dialog.open)content.textContent='이 형식은 미리볼 수 없습니다. 다운로드해서 확인해 주세요.';};}
          if(format[0]==='pdf'){node.setAttribute('sandbox','');node.title='PDF 미리보기';}
          if(format[0]==='video'||format[0]==='audio'){node.controls=true;node.preload='metadata';}
          node.src=objectUrl;
        }
        content.replaceChildren(node);
      } catch(error) {if(!request.signal.aborted&&dialog.open)content.textContent='미리보기를 불러오지 못했습니다. 다운로드해서 확인해 주세요.';}
    }
    list.addEventListener('click',event=>{
      const link = event.target.closest('[data-preview-button],[data-preview]');if(!link)return;
      const id = link.dataset.previewButton ?? link.dataset.preview;
      const file=files().find(file=>String(file.id)===id);if(!file||!kind(file))return;
      event.preventDefault();if(!isLocked())open(file,link);
    });
    root.addEventListener('pagehide', close);
    return {close,confirmDelete,editName};
  }
  root.NoteAttachmentPreview={kind,create};
})(window);
