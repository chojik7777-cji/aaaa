'use strict';

// 맥미니용 공유노트 API: 메모와 첨부파일을 특정 폴더(기본: note/family)에 실제 파일로 저장합니다.
// note.html이 쓰는 /api/note/* 와 같은 형식이라, 임시터널 주소로 note.html을 열면 이 폴더를 공유합니다.
// - room=default → NOTE_DIR 자체, 다른 room → NOTE_DIR/<room> 하위 폴더
// - 메모 본문은 .note-memo.txt, 버전·올린 사람 기록은 .note-meta.json (점으로 시작해 목록에 안 보임)
// - Finder로 폴더에 직접 넣거나 지운 파일도 목록에 그대로 반영됩니다.
// - 비밀번호: login 으로 토큰을 받아야 다른 API를 쓸 수 있음. 5번 틀리면 그 접속(IP)은 1시간 잠금.

const fs = require('fs');
const path = require('path');
const { createNoteAuth } = require('./note-auth');
const { fileHeaders } = require('./note-preview');
const { preserveUploadCopy } = require('./server/note-upload-backup');
const {requestRoom,existingRoom}=require('./server/note-room');
const {existingNoteRoom}=require('./server/note-a-room');

const MAX_TEXT = 500_000;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_BODY = Math.ceil(MAX_FILE_BYTES * 1.4) + 100_000; // base64 여유분
const MAX_NAME = 160;
const MEMO = '.note-memo.txt';
const META = '.note-meta.json';

function send(res, status, data, headers = {}) {
  res.statusCode = status;
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.setHeader('Cache-Control', 'no-store');
  if (Buffer.isBuffer(data)) return res.end(data);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}
function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (req.method !== 'POST') return Promise.resolve({});
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error('파일이 너무 큽니다.'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch (e) { reject(new Error('요청 형식이 올바르지 않습니다.')); }
    });
    req.on('error', reject);
  });
}
function roomId(v) {
  const room = String(v || 'default').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50) || 'default';
  // Keep legacy room spelling, but never expose the backup directory (including macOS case aliases).
  if (room.toLowerCase() === 'backup') throw Object.assign(new Error('백업 폴더는 노트 방으로 사용할 수 없습니다.'), { status: 400 });
  return room;
}
function safeName(v) {
  const n = path.basename(String(v || 'file')).replace(/[\\/\0\r\n:]/g, '_').replace(/^\.+/, '').slice(0, MAX_NAME);
  return n || 'file';
}
function guessType(name) {
  const ext = path.extname(name).toLowerCase();
  return ({
    '.txt': 'text/plain; charset=utf-8', '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp', '.heic': 'image/heic', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.mov': 'video/quicktime',
    '.zip': 'application/zip', '.hwp': 'application/x-hwp', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  })[ext] || 'application/octet-stream';
}
function parseDataUrl(dataUrl) {
  const m = String(dataUrl || '').match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!m) throw new Error('파일 데이터 형식이 올바르지 않습니다.');
  return m[2] ? Buffer.from(m[3] || '', 'base64') : Buffer.from(decodeURIComponent(m[3] || ''));
}
function uniqueName(dir, name) {
  const occupied = (n) => {
    if (n.toLowerCase() === 'backup') return true;
    try { fs.lstatSync(path.join(dir, n)); return true; }
    catch (e) { if (e.code === 'ENOENT') return false; throw e; }
  };
  if (!occupied(name)) return name;
  const ext = path.extname(name), base = name.slice(0, name.length - ext.length);
  for (let i = 1; ; i++) { const n = `${base} (${i})${ext}`; if (!occupied(n)) return n; }
}

// opts.password: 문자열 또는 문자열을 돌려주는 함수 (비우면 기본 비밀번호, 매 요청마다 읽음)
// opts.roomFolders: true면 모든 room이 하위 폴더 (room=church → <폴더>/church, room 없으면 <폴더>/default)
// opts.label: 화면에 보여 줄 폴더 이름
function createNoteFolderHandler(rootDir, opts = {}) {
  const ROOT = path.resolve(rootDir);
  const local = ['note','note2'].includes(opts.localId);
  const roomExists = opts.localId==='note'?existingNoteRoom:existingRoom;
  const auth = createNoteAuth({...opts,roomAllowed:async(room,service)=>!await service.isRoomDeleted(room,opts.localId)&&(roomExists(ROOT,room)||await service.hasRoom(room,opts.localId)||room==='default')});
  const dirOf = (room) => (room === 'default' && !opts.roomFolders) ? ROOT : path.join(ROOT, room);
  const label = opts.label || path.basename(ROOT);
  const labelOf = (room) => (room === 'default' && !opts.roomFolders) ? label : `${label}/${room}`;
  function readMeta(dir) {
    try { const m = JSON.parse(fs.readFileSync(path.join(dir, META), 'utf8')); return { version: 0, updatedAt: 0, updatedBy: '', uploads: {}, ...m }; }
    catch (e) { return { version: 0, updatedAt: 0, updatedBy: '', uploads: {} }; }
  }
  function writeMeta(dir, meta) { fs.writeFileSync(path.join(dir, META), JSON.stringify(meta)); }
  function listFiles(dir, meta) {
    let names = [];
    try { names = fs.readdirSync(dir); } catch (e) { return []; }
    const files = [];
    for (const name of names) {
      if (name.startsWith('.') || name.toLowerCase() === 'backup') continue;
      let s; try { s = local?fs.lstatSync(path.join(dir, name)):fs.statSync(path.join(dir, name)); } catch (e) { continue; }
      if (!s.isFile()) continue;
      files.push({ id: name, name, type: guessType(name), size: s.size, uploadedAt: s.mtimeMs, uploadedBy: (meta.uploads || {})[name] || '' });
    }
    return files.sort((a, b) => b.uploadedAt - a.uploadedAt);
  }
  function state(room) {
    const dir = dirOf(room), meta = readMeta(dir);
    let text = '';
    try { text = fs.readFileSync(path.join(dir, MEMO), 'utf8'); } catch (e) { /* 아직 없음 */ }
    return {
      ok: true, room, text, version: meta.version, updatedAt: meta.updatedAt, updatedBy: meta.updatedBy,
      files: listFiles(dir, meta), storage: 'folder', folder: labelOf(room), maxFileBytes: MAX_FILE_BYTES,
    };
  }
  // 파일 id(=파일 이름)가 폴더 밖이나 숨김 파일을 가리키지 않게
  function fileIn(dir, id) {
    const name = String(id || '');
    if (!name || name !== path.basename(name) || name.startsWith('.') || name.toLowerCase() === 'backup') return null;
    if(local){try{if(fs.lstatSync(path.join(dir,name)).isSymbolicLink())return null;}catch(e){if(e.code!=='ENOENT')throw e;}}
    return path.join(dir, name);
  }

  return async function handler(req, res) {
    if (req.method === 'OPTIONS') return send(res, 204, {}, {
      'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    });
    try {
      const url = new URL(req.url, `http://${(req.headers && req.headers.host) || 'localhost'}`);
      // /api/note/<action> 또는 /api/note2/<action>
      const parts = url.pathname.split('/').filter(Boolean);
      const i = parts.indexOf('api');
      const action = url.searchParams.get('action') || (i >= 0 ? parts.slice(i + 2).join('/') : '');
      const body = await readBody(req);
      const room = local?requestRoom(url,body):roomId(url.searchParams.get('room') || body.room);
      const dir = dirOf(room);
      if(local){
        // Reject physical case aliases/conflicts before custom/default credential fallback.
        roomExists(ROOT,room);
        // Reject links before any login, read or mutation, including internal memo/meta files.
        for(const p of [ROOT,dir,path.join(dir,MEMO),path.join(dir,META)]){
          try{if(fs.lstatSync(p).isSymbolicLink()||fs.realpathSync(p)!==p)throw {status:400};}catch(e){if(e.code!=='ENOENT')throw e;}
        }
      }

      if (action === 'login' && req.method === 'POST') { const [st, data] = await auth.login(req, body,room); return send(res, st, data); }
      if (!await auth.tokenOk(req, url,room)) return send(res, 401, { ok: false, authRequired: true, error: '비밀번호가 필요해요.' });

      if (!action || action === 'state') return send(res, 200, state(room));

      if (action === 'save' && req.method === 'POST') {
        const text = String(body.text ?? '');
        if (text.length > MAX_TEXT) return send(res, 413, { ok: false, error: '본문이 너무 깁니다.' });
        fs.mkdirSync(dir, { recursive: true });
        const meta = readMeta(dir);
        fs.writeFileSync(path.join(dir, MEMO), text);
        meta.version += 1; meta.updatedAt = Date.now(); meta.updatedBy = String(body.user || '').slice(0, 40);
        writeMeta(dir, meta);
        return send(res, 200, state(room));
      }

      if (action === 'upload' && req.method === 'POST') {
        const buffer = parseDataUrl(body.dataUrl);
        if (!buffer.length) return send(res, 400, { ok: false, error: '빈 파일은 업로드할 수 없습니다.' });
        if (buffer.length > MAX_FILE_BYTES) return send(res, 413, { ok: false, error: '파일은 50MB 이하만 업로드할 수 있습니다.' });
        fs.mkdirSync(dir, { recursive: true });
        const name = uniqueName(dir, safeName(body.name));
        // Fail closed before publishing active bytes or advancing metadata.
        preserveUploadCopy(dir, name, buffer);
        fs.writeFileSync(path.join(dir, name), buffer, {
          mode: 0o600, flag: fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW,
        });
        const meta = readMeta(dir);
        meta.uploads = { ...(meta.uploads || {}), [name]: String(body.user || '').slice(0, 40) };
        meta.version += 1; meta.updatedAt = Date.now(); meta.updatedBy = meta.uploads[name];
        writeMeta(dir, meta);
        return send(res, 200, state(room));
      }

      if (action === 'rename-file' && req.method === 'POST') {
        const file = fileIn(dir, body.id);
        let stat; try { stat = file && fs.lstatSync(file); } catch (e) { if (e.code !== 'ENOENT') throw e; }
        if (!stat || !stat.isFile()) return send(res, 404, { ok: false, error: '파일을 찾을 수 없습니다.' });
        const name = require('./server/note-file-name').renameFileName(body.name, path.basename(file), MAX_NAME);
        if (name === body.id) return send(res, 200, state(room));
        const target = path.join(dir, name);
        try { fs.lstatSync(target); return send(res, 409, { ok: false, error: '이미 같은 이름이 있습니다.' }); }
        catch (e) { if (e.code !== 'ENOENT') throw e; }
        const meta = readMeta(dir);
        meta.uploads = { ...(meta.uploads || {}), [name]: Object.hasOwn(meta.uploads || {}, body.id) ? meta.uploads[body.id] : '' };
        delete meta.uploads[body.id];
        meta.version += 1; meta.updatedAt = Date.now(); meta.updatedBy = String(body.user || '').slice(0, 40);
        const metaPath = path.join(dir, META);
        let previousMeta; try { previousMeta = fs.readFileSync(metaPath); } catch (e) { if (e.code !== 'ENOENT') throw e; }
        try { fs.linkSync(file, target); } // Atomic no-clobber publication, including races/case aliases.
        catch (e) { if (e.code === 'EEXIST') e.status = 409; throw e; }
        try { writeMeta(dir, meta); fs.unlinkSync(file); }
        catch (e) {
          // Source still exists. Restore exact metadata bytes before dropping our link.
          try { if (previousMeta) fs.writeFileSync(metaPath, previousMeta); else fs.rmSync(metaPath, { force: true }); }
          finally { fs.unlinkSync(target); }
          throw e;
        }
        return send(res, 200, state(room));
      }

      if (action === 'delete-file' && req.method === 'POST') {
        const file = fileIn(dir, body.id);
        if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, { ok: false, error: '파일을 찾을 수 없습니다.' });
        fs.unlinkSync(file);
        const meta = readMeta(dir);
        if (meta.uploads) delete meta.uploads[path.basename(file)];
        meta.version += 1; meta.updatedAt = Date.now(); meta.updatedBy = String(body.user || '').slice(0, 40);
        writeMeta(dir, meta);
        return send(res, 200, state(room));
      }

      if (action === 'file') {
        const file = fileIn(dir, url.searchParams.get('id') || body.id);
        let s = null; try { s = file && fs.statSync(file); } catch (e) { /* 없음 */ }
        if (!s || !s.isFile()) return send(res, 404, { ok: false, error: '파일을 찾을 수 없습니다.' });
        res.statusCode = 200;
        const fh = fileHeaders(path.basename(file), guessType(file), url.searchParams.get('inline') === '1');
        for (const [k, v] of Object.entries(fh)) res.setHeader(k, v);
        res.setHeader('Content-Length', String(s.size));
        res.setHeader('Cache-Control', 'no-store');
        return fs.createReadStream(file).pipe(res);
      }

      return send(res, 404, { ok: false, error: '알 수 없는 API입니다.', action });
    } catch (e) {
      return send(res, e.status || 400, { ok: false, error: e.message || String(e) });
    }
  };
}

// Called only after admin authorization and registered-room validation.
// Like save/upload/delete above, the complete mutation is synchronous: no await
// can interleave storage operations within this local portal process.
function resetNoteContent(root,room){
  root=path.resolve(root);
  existingRoom(root,room);
  const dir=path.join(root,room);
  resetDirectoryContent(dir,false,[root]);
}
function resetNoteAContent(root,room='default'){
  root=path.resolve(root);
  existingNoteRoom(root,room);
  const dir=room==='default'?root:path.join(root,room);
  resetDirectoryContent(dir,room==='default',[root]);
}
function resetDirectoryContent(dir,preserveDirectories,parents=[]){
  // Validate every internal path before deleting anything. Attachment symlinks
  // are unlinked by rmSync, never traversed; hidden credentials are untouched.
  for(const p of [...parents,dir,path.join(dir,MEMO),path.join(dir,META)]){
    try{const st=fs.lstatSync(p);if(st.isSymbolicLink()||fs.realpathSync(p)!==p||((parents.includes(p)||p===dir)?!st.isDirectory():!st.isFile()))throw {status:400};}
    catch(e){if(e.code!=='ENOENT')throw e;}
  }
  fs.mkdirSync(dir,{recursive:true});
  for(const name of fs.readdirSync(dir)){
    if(name.startsWith('.')&&name!==MEMO&&name!==META)continue;
    // note.html may have other rooms as subdirectories; they are not attachments.
    // Backups are archives, not attachments. Never recurse into the reserved directory.
    if((preserveDirectories||name.toLowerCase()==='backup')&&fs.lstatSync(path.join(dir,name)).isDirectory())continue;
    fs.rmSync(path.join(dir,name),{recursive:true,force:true});
  }
  fs.writeFileSync(path.join(dir,META),JSON.stringify({version:0,updatedAt:0,updatedBy:'',uploads:{}}));
}
module.exports = { createNoteFolderHandler, resetNoteContent, resetNoteAContent, MAX_FILE_BYTES };
