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
        .attachment-preview{position:fixed;inset:0;margin:auto;width:min(900px,90vw);max-width:90vw;max-height:85vh;max-height:85dvh;padding:16px;border:0;border-radius:16px;background:#fff;color:#1a202c;overflow:hidden;box-shadow:0 20px 70px #0007;box-sizing:border-box}
        .attachment-preview[open]{display:flex;flex-direction:column;gap:12px}
        .attachment-preview::backdrop{background:rgba(15,23,42,.75)}
        .attachment-preview-heading{display:flex;align-items:center;gap:12px;flex:none;min-width:0}
        .attachment-preview h2{margin:0;flex:1;min-width:0;font-size:18px;overflow-wrap:anywhere;max-height:4.5em;overflow:auto}
        .attachment-preview-close{flex:none;width:44px;height:44px;padding:0;font-size:24px;background:#edf2f7;color:#1a202c;border:1px solid #cbd5e0;border-radius:10px;cursor:pointer}
        .attachment-preview-content{min-width:0;min-height:0;overflow:auto;text-align:center}
        .attachment-preview-content img,.attachment-preview-content video{display:block;margin:auto;max-width:100%;max-height:calc(85vh - 150px);max-height:calc(85dvh - 150px);object-fit:contain}
        .attachment-preview-content audio{display:block;width:100%;max-width:100%}
        .attachment-preview-content iframe{display:block;width:100%;height:calc(85vh - 150px);height:calc(85dvh - 150px);border:0}
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
          if(format[0]==='image'){node.alt=String(file.name||'첨부 이미지');node.onerror=()=>{if(dialog.open)content.textContent='이 형식은 미리볼 수 없습니다. 다운로드하거나 새 창에서 확인해 주세요.';};}
          if(format[0]==='pdf'){node.setAttribute('sandbox','');node.title='PDF 미리보기';}
          if(format[0]==='video'||format[0]==='audio'){node.controls=true;node.preload='metadata';}
          node.src=objectUrl;
        }
        content.replaceChildren(node);
      } catch(error) {if(!request.signal.aborted&&dialog.open)content.textContent='미리보기를 불러오지 못했습니다. 다운로드하거나 새 창에서 확인해 주세요.';}
    }
    list.addEventListener('click',event=>{
      const link=event.target.closest('[data-preview]');if(!link)return;
      // Intercept ordinary filename clicks only; explicit new-window links stay untouched.
      if(event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      const file=files().find(file=>String(file.id)===link.dataset.preview);if(!file||!kind(file))return;
      event.preventDefault();if(!isLocked())open(file,link);
    });
    return {close};
  }
  root.NoteAttachmentPreview={kind,create};
})(window);
