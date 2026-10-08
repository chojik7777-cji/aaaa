'use strict';

const crypto = require('crypto');

globalThis.__COLLAB_NOTES__ = globalThis.__COLLAB_NOTES__ || new Map();
const notes = globalThis.__COLLAB_NOTES__;

const MAX_TEXT = 300_000;
const MAX_FILE_BYTES = 900_000;
const MAX_FILES = 30;
const MAX_NAME = 120;

function send(res, status, data, headers = {}) {
  res.statusCode = status;
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.setHeader('Cache-Control', 'no-store');
  if (Buffer.isBuffer(data)) return res.end(data);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}
function actionFrom(req) {
  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const q = url.searchParams.get('action');
  if (q) return { url, action: q.replace(/^\/+/, '') };
  const parts = url.pathname.split('/').filter(Boolean);
  const i = parts.indexOf('note');
  return { url, action: i >= 0 ? parts.slice(i + 1).join('/') : parts.slice(1).join('/') };
}
function bodyOf(req) { return req.body && typeof req.body === 'object' ? req.body : {}; }
function roomId(v) { return String(v || 'default').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'default'; }
function safeName(v) { return String(v || 'file').replace(/[\\/\0\r\n]/g, '_').slice(0, MAX_NAME) || 'file'; }
function getNote(room) {
  if (!notes.has(room)) {
    notes.set(room, { room, text: '', version: 0, updatedAt: Date.now(), updatedBy: '', files: [] });
  }
  return notes.get(room);
}
function meta(note) {
  return {
    ok: true,
    room: note.room,
    text: note.text,
    version: note.version,
    updatedAt: note.updatedAt,
    updatedBy: note.updatedBy,
    files: note.files.map(({ id, name, type, size, uploadedAt, uploadedBy }) => ({ id, name, type, size, uploadedAt, uploadedBy })),
  };
}
function parseDataUrl(dataUrl) {
  const m = String(dataUrl || '').match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!m) throw new Error('파일 데이터 형식이 올바르지 않습니다.');
  const type = m[1] || 'application/octet-stream';
  const isBase64 = !!m[2];
  const payload = m[3] || '';
  const buffer = isBase64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload));
  return { type, buffer };
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {}, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  try {
    const { url, action } = actionFrom(req);
    const body = bodyOf(req);
    const room = roomId(url.searchParams.get('room') || body.room);
    const note = getNote(room);

    if (!action || action === 'state') return send(res, 200, meta(note));

    if (action === 'save' && req.method === 'POST') {
      const text = String(body.text ?? '');
      if (text.length > MAX_TEXT) return send(res, 413, { ok: false, error: '본문이 너무 깁니다.' });
      note.text = text;
      note.version += 1;
      note.updatedAt = Date.now();
      note.updatedBy = String(body.user || '').slice(0, 40);
      return send(res, 200, meta(note));
    }

    if (action === 'upload' && req.method === 'POST') {
      if (note.files.length >= MAX_FILES) return send(res, 400, { ok: false, error: `첨부파일은 최대 ${MAX_FILES}개까지 가능합니다.` });
      const { type, buffer } = parseDataUrl(body.dataUrl);
      if (!buffer.length) return send(res, 400, { ok: false, error: '빈 파일은 업로드할 수 없습니다.' });
      if (buffer.length > MAX_FILE_BYTES) return send(res, 413, { ok: false, error: '파일은 900KB 이하만 업로드할 수 있습니다.' });
      const item = {
        id: crypto.randomBytes(8).toString('hex'),
        name: safeName(body.name),
        type: String(body.type || type || 'application/octet-stream').slice(0, 120),
        size: buffer.length,
        uploadedAt: Date.now(),
        uploadedBy: String(body.user || '').slice(0, 40),
        data: buffer.toString('base64'),
      };
      note.files.unshift(item);
      note.version += 1;
      note.updatedAt = Date.now();
      note.updatedBy = item.uploadedBy;
      return send(res, 200, meta(note));
    }

    if (action === 'delete-file' && req.method === 'POST') {
      const id = String(body.id || '');
      const before = note.files.length;
      note.files = note.files.filter((f) => f.id !== id);
      if (note.files.length === before) return send(res, 404, { ok: false, error: '파일을 찾을 수 없습니다.' });
      note.version += 1;
      note.updatedAt = Date.now();
      note.updatedBy = String(body.user || '').slice(0, 40);
      return send(res, 200, meta(note));
    }

    if (action === 'file') {
      const id = String(url.searchParams.get('id') || body.id || '');
      const f = note.files.find((x) => x.id === id);
      if (!f) return send(res, 404, { ok: false, error: '파일을 찾을 수 없습니다.' });
      const buf = Buffer.from(f.data, 'base64');
      return send(res, 200, buf, {
        'Content-Type': f.type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`,
        'Content-Length': String(buf.length),
      });
    }

    return send(res, 404, { ok: false, error: '알 수 없는 API입니다.', action });
  } catch (e) {
    return send(res, 400, { ok: false, error: e.message || String(e) });
  }
};
