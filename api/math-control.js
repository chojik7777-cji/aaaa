'use strict';

const fs = require('fs');
const path = require('path');

globalThis.__MATH_GAME_CONTROL__ = globalThis.__MATH_GAME_CONTROL__ || {
  locked: false,
  message: '선생님 확인 후 계속하세요.',
  unlockPassword: '1212',
  version: 0,
  updatedAt: Date.now(),
};
const control = globalThis.__MATH_GAME_CONTROL__;

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.end(JSON.stringify(data));
}
function readAdminPassword() {
  const candidates = [
    process.env.DASHBOARD_PW_FILE,
    '/Users/chojiks/.dashboard_pw',
    path.join(process.cwd(), 'pw'),
  ].filter(Boolean);
  for (const f of candidates) {
    try { if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim(); } catch (_) {}
  }
  return process.env.DASHBOARD_PW || '1212';
}
function actionFrom(req) {
  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const q = url.searchParams.get('action');
  if (q) return q.replace(/^\/+/, '');
  const parts = url.pathname.split('/').filter(Boolean);
  const i = parts.indexOf('math-control');
  return i >= 0 ? parts.slice(i + 1).join('/') : '';
}
function bodyOf(req) { return req.body && typeof req.body === 'object' ? req.body : {}; }
function publicState(extra = {}) {
  return {
    ok: true,
    locked: !!control.locked,
    message: control.message || '선생님 확인 후 계속하세요.',
    version: control.version || 0,
    updatedAt: control.updatedAt || Date.now(),
    ...extra,
  };
}
function setState({ locked, message, unlockPassword }) {
  control.locked = !!locked;
  if (message != null) control.message = String(message).trim().slice(0, 180) || '선생님 확인 후 계속하세요.';
  if (unlockPassword != null && String(unlockPassword).trim()) control.unlockPassword = String(unlockPassword).trim().slice(0, 64);
  control.version = (control.version || 0) + 1;
  control.updatedAt = Date.now();
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const action = actionFrom(req) || 'status';
  const body = bodyOf(req);

  if (action === 'status' && req.method === 'GET') return send(res, 200, publicState());

  if (action === 'set' && req.method === 'POST') {
    if (String(body.adminPassword || '') !== readAdminPassword()) {
      return send(res, 403, { ok: false, error: '관리자 비밀번호가 맞지 않습니다.' });
    }
    setState(body);
    return send(res, 200, publicState());
  }

  if (action === 'unlock' && req.method === 'POST') {
    if (String(body.password || '') !== String(control.unlockPassword || '1212')) {
      return send(res, 403, { ok: false, error: '비밀번호가 맞지 않습니다.', locked: !!control.locked });
    }
    return send(res, 200, publicState({ unlocked: true }));
  }

  return send(res, 404, { ok: false, error: '지원하지 않는 요청입니다.' });
};
