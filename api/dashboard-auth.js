'use strict';
const fs = require('fs');
const path = require('path');
function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.end(JSON.stringify(data));
}
function readPw() {
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
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'POST만 허용됩니다.' });
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const ok = String(body.password || '') === readPw();
  return send(res, ok ? 200 : 403, ok ? { ok: true } : { ok: false, error: '비밀번호가 맞지 않습니다.' });
};
