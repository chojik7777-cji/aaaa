'use strict';

const crypto = require('crypto');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const BUCKET = process.env.SUPABASE_NOTE_BUCKET || 'note-files';
const MAX_TEXT = 500_000;
const MAX_FILE_BYTES = 8_000_000;
const MAX_NAME = 160;

const setupSql = `-- Supabase SQL Editor에서 1회 실행
create table if not exists public.collab_notes (
  room text primary key,
  text text not null default '',
  version integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);

create table if not exists public.collab_files (
  id text primary key,
  room text not null,
  name text not null,
  type text not null default 'application/octet-stream',
  size integer not null default 0,
  path text not null,
  uploaded_at timestamptz not null default now(),
  uploaded_by text not null default ''
);

create index if not exists collab_files_room_idx on public.collab_files(room, uploaded_at desc);

-- Storage에서 note-files 버킷을 private으로 생성하세요.
-- 또는 SUPABASE_NOTE_BUCKET 환경변수로 다른 버킷명을 지정하세요.`;

function send(res, status, data, headers = {}) {
  res.statusCode = status;
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.setHeader('Cache-Control', 'no-store');
  if (Buffer.isBuffer(data)) return res.end(data);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}
function notConfigured(res) {
  return send(res, 503, { ok: false, setupRequired: true, error: 'Supabase 환경변수가 설정되지 않았습니다.', requiredEnv: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'], optionalEnv: ['SUPABASE_NOTE_BUCKET'], sql: setupSql });
}
function actionFrom(req) {
  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const q = url.searchParams.get('action');
  if (q) return { url, action: q.replace(/^\/+/, '') };
  const parts = url.pathname.split('/').filter(Boolean);
  const i = parts.indexOf('note2');
  return { url, action: i >= 0 ? parts.slice(i + 1).join('/') : parts.slice(1).join('/') };
}
function bodyOf(req) { return req.body && typeof req.body === 'object' ? req.body : {}; }
function roomId(v) { return String(v || 'default').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50) || 'default'; }
function safeName(v) { return String(v || 'file').replace(/[\\/\0\r\n]/g, '_').slice(0, MAX_NAME) || 'file'; }
function configured() { return !!(SUPABASE_URL && SUPABASE_KEY); }
function sbHeaders(extra = {}) {
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, ...extra };
}
async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, { ...opts, headers: sbHeaders(opts.headers || {}) });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.arrayBuffer();
  if (!res.ok) {
    const msg = data && data.message ? data.message : `Supabase 오류 ${res.status}`;
    throw new Error(msg);
  }
  return data;
}
async function getNote(room) {
  const rows = await sb(`/rest/v1/collab_notes?room=eq.${encodeURIComponent(room)}&select=*`);
  if (rows.length) return rows[0];
  const created = await sb('/rest/v1/collab_notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ room, text: '', version: 0, updated_by: '' }),
  });
  return created[0];
}
async function getFiles(room) {
  return await sb(`/rest/v1/collab_files?room=eq.${encodeURIComponent(room)}&select=id,name,type,size,uploaded_at,uploaded_by&order=uploaded_at.desc`);
}
async function state(room) {
  const note = await getNote(room);
  const files = await getFiles(room);
  return {
    ok: true,
    room,
    text: note.text || '',
    version: note.version || 0,
    updatedAt: note.updated_at,
    updatedBy: note.updated_by || '',
    files: files.map((f) => ({ id: f.id, name: f.name, type: f.type, size: f.size, uploadedAt: f.uploaded_at, uploadedBy: f.uploaded_by || '' })),
  };
}
function parseDataUrl(dataUrl) {
  const m = String(dataUrl || '').match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!m) throw new Error('파일 데이터 형식이 올바르지 않습니다.');
  const type = m[1] || 'application/octet-stream';
  const payload = m[3] || '';
  const buffer = m[2] ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload));
  return { type, buffer };
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {}, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  const { url, action } = actionFrom(req);
  if (action === 'setup') return send(res, 200, { ok: true, configured: configured(), requiredEnv: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'], bucket: BUCKET, sql: setupSql });
  if (!configured()) return notConfigured(res);
  try {
    const body = bodyOf(req);
    const room = roomId(url.searchParams.get('room') || body.room);

    if (!action || action === 'state') return send(res, 200, await state(room));

    if (action === 'save' && req.method === 'POST') {
      const text = String(body.text ?? '');
      if (text.length > MAX_TEXT) return send(res, 413, { ok: false, error: '본문이 너무 깁니다.' });
      const current = await getNote(room);
      const version = Number(current.version || 0) + 1;
      await sb(`/rest/v1/collab_notes?room=eq.${encodeURIComponent(room)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ text, version, updated_at: new Date().toISOString(), updated_by: String(body.user || '').slice(0, 50) }),
      });
      return send(res, 200, await state(room));
    }

    if (action === 'upload' && req.method === 'POST') {
      const { type, buffer } = parseDataUrl(body.dataUrl);
      if (!buffer.length) return send(res, 400, { ok: false, error: '빈 파일은 업로드할 수 없습니다.' });
      if (buffer.length > MAX_FILE_BYTES) return send(res, 413, { ok: false, error: '파일은 8MB 이하만 업로드할 수 있습니다.' });
      const id = crypto.randomBytes(10).toString('hex');
      const name = safeName(body.name);
      const contentType = String(body.type || type || 'application/octet-stream').slice(0, 140);
      const objectPath = `${room}/${id}-${encodeURIComponent(name)}`;
      await sb(`/storage/v1/object/${encodeURIComponent(BUCKET)}/${objectPath}`, {
        method: 'POST',
        headers: { 'Content-Type': contentType, 'x-upsert': 'false' },
        body: buffer,
      });
      await sb('/rest/v1/collab_files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ id, room, name, type: contentType, size: buffer.length, path: objectPath, uploaded_by: String(body.user || '').slice(0, 50) }),
      });
      return send(res, 200, await state(room));
    }

    if (action === 'delete-file' && req.method === 'POST') {
      const id = String(body.id || '');
      const rows = await sb(`/rest/v1/collab_files?id=eq.${encodeURIComponent(id)}&room=eq.${encodeURIComponent(room)}&select=*`);
      if (!rows.length) return send(res, 404, { ok: false, error: '파일을 찾을 수 없습니다.' });
      await sb(`/rest/v1/collab_files?id=eq.${encodeURIComponent(id)}&room=eq.${encodeURIComponent(room)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      // Storage object deletion is best-effort. Metadata deletion is enough to hide it from users.
      return send(res, 200, await state(room));
    }

    if (action === 'file') {
      const id = String(url.searchParams.get('id') || body.id || '');
      const rows = await sb(`/rest/v1/collab_files?id=eq.${encodeURIComponent(id)}&room=eq.${encodeURIComponent(room)}&select=*`);
      if (!rows.length) return send(res, 404, { ok: false, error: '파일을 찾을 수 없습니다.' });
      const f = rows[0];
      const arr = await sb(`/storage/v1/object/${encodeURIComponent(BUCKET)}/${f.path}`);
      return send(res, 200, Buffer.from(arr), {
        'Content-Type': f.type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      });
    }

    return send(res, 404, { ok: false, error: '알 수 없는 API입니다.', action });
  } catch (e) {
    return send(res, 400, { ok: false, error: e.message || String(e) });
  }
};
