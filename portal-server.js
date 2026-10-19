#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 8793);
const ROOT = __dirname;
// 공유노트(note.html) 파일 저장 폴더. 기본은 이 폴더 안의 note/family, NOTE_DIR로 바꿀 수 있음
const NOTE_BASE = path.join(ROOT, 'note');
const NOTE_DIR = path.resolve(process.env.NOTE_DIR || path.join(NOTE_BASE, 'family'));
// 예전 위치(github-aaaa/family)에 있던 파일은 처음 한 번 note/family 로 옮김
const OLD_NOTE_DIR = path.join(ROOT, 'family');
if (!process.env.NOTE_DIR && fs.existsSync(OLD_NOTE_DIR) && !fs.existsSync(NOTE_DIR)) {
  fs.mkdirSync(NOTE_BASE, { recursive: true });
  fs.renameSync(OLD_NOTE_DIR, NOTE_DIR);
  console.log(`공유노트 폴더를 옮겼어요: ${OLD_NOTE_DIR} → ${NOTE_DIR}`);
}
// 최초 시작 때만 기존 환경변수/비밀번호 파일을 로컬 인증 저장소로 이관합니다.
// 이후 비밀번호 변경은 관리자 API를 통해서만 적용합니다.
const noteHandler = require('./note-folder').createNoteFolderHandler(NOTE_DIR, { localId: 'note', label: path.relative(ROOT, NOTE_DIR).startsWith('..') ? NOTE_DIR : path.relative(ROOT, NOTE_DIR).split(path.sep).join('/') });
fs.mkdirSync(NOTE_DIR, { recursive: true });

// 공유노트 B(note2.html): note2/<room> 폴더 (note2.html?room=church → note2/church)
// 인증은 note와 같은 로컬 영속 저장소를 사용합니다.
const NOTE2_DIR = path.resolve(process.env.NOTE2_DIR || path.join(ROOT, 'note2'));
const note2Handler = require('./note-folder').createNoteFolderHandler(NOTE2_DIR, { localId: 'note2', roomFolders: true, label: path.relative(ROOT, NOTE2_DIR).startsWith('..') ? NOTE2_DIR : path.relative(ROOT, NOTE2_DIR).split(path.sep).join('/') });
fs.mkdirSync(NOTE2_DIR, { recursive: true });

const adminHandler = require('./server/note-admin').createAdminHandler();
const dashboardAuthHandler = require('./server/dashboard-auth').createDashboardAuth();
const securityAuditHandler = require('./server/security-audit-api').createSecurityAuditHandler();

const TARGETS = {
  '/api/room': 'http://127.0.0.1:8791',   // yut-server.js
  '/api/dashboard': 'http://127.0.0.1:8791', // yut dashboard summary
  '/api/omok': 'http://127.0.0.1:8792',   // omok-server.js
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function proxy(req, res, base) {
  const target = new URL(req.url, base);
  const upstream = http.request(target, {
    method: req.method,
    headers: { ...req.headers, host: target.host },
  }, (up) => {
    const headers = { ...up.headers, 'access-control-allow-origin': '*', 'cache-control': 'no-store' };
    res.writeHead(up.statusCode || 502, headers);
    up.pipe(res);
  });
  upstream.on('error', (e) => {
    send(res, 502, JSON.stringify({ ok: false, error: `upstream error: ${e.message}` }), 'application/json; charset=utf-8');
  });
  req.pipe(upstream);
}

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return send(res, 400, 'Bad request'); }
  if (pathname === '/') pathname = '/index.html';
  if (!require('./server/static-policy').publicPath(pathname)) return send(res, 403, 'Forbidden');
  const file = path.normalize(path.join(ROOT, pathname));
  if (!file.startsWith(ROOT + path.sep)) return send(res, 403, 'Forbidden');
  // Never follow public-looking symlinks into secrets or private note folders.
  let real;
  try { real = fs.realpathSync(file); } catch { return send(res, 404, 'Not found'); }
  if (real !== file) return send(res, 403, 'Forbidden');
  // 공유노트 폴더는 /api/note 로만 접근 (주소로 직접 열기 막기)
  const inside = (dir) => file === dir || file.startsWith(dir + path.sep);
  if (inside(NOTE_DIR) || inside(NOTE_BASE) || inside(OLD_NOTE_DIR) || inside(NOTE2_DIR)) return send(res, 403, 'Forbidden');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Not found');
    const ext = path.extname(file).toLowerCase();
    const type = ext === '.html' ? 'text/html; charset=utf-8'
      : ext === '.js' ? 'text/javascript; charset=utf-8'
      : ext === '.css' ? 'text/css; charset=utf-8'
      : ext === '.json' ? 'application/json; charset=utf-8'
      : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(buf);
  });
}

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/api/security-audit') return securityAuditHandler(req, res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    });
    return res.end();
  }

  if (pathname === '/api/health') {
    return send(res, 200, JSON.stringify({ ok: true, portal: true, yut: '8791', omok: '8792' }), 'application/json; charset=utf-8');
  }
  if (pathname === '/api/dashboard-auth') return dashboardAuthHandler(req, res);
  if (pathname === '/api/note-admin' || pathname.startsWith('/api/note-admin/')) return adminHandler(req, res);
  if (pathname === '/api/note' || pathname.startsWith('/api/note/')) return noteHandler(req, res);
  if (pathname === '/api/note2' || pathname.startsWith('/api/note2/')) return note2Handler(req, res);
  for (const [prefix, base] of Object.entries(TARGETS)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return proxy(req, res, base);
  }
  return serveStatic(req, res);
});

// Startup only: HTTP handlers never bootstrap or fall back to legacy passwords.
require('./server/note-local').initialize().catch(() => {
  console.error('로컬 노트 인증 초기화 실패: 기존 관리자 파일/저장소 권한을 확인해 주세요.');
}).then(() => server.listen(PORT, HOST, () => {
  console.log(`Game portal server: http://${HOST}:${server.address().port}`);
  console.log(`- intro: http://${HOST}:${PORT}/index.html`);
  console.log(`- omok:  http://${HOST}:${PORT}/omok.html`);
  console.log(`- yut:   http://${HOST}:${PORT}/yut.html`);
  console.log(`- note:  http://${HOST}:${PORT}/note.html  (파일 폴더: ${NOTE_DIR})`);
  console.log(`- note2: http://${HOST}:${PORT}/note2.html?room=church  (파일 폴더: ${NOTE2_DIR}/<room>)`);
}));
