'use strict';

// 공유노트(note.html) 비밀번호 확인: Vercel(api/note.js)과 맥미니(note-folder.js)가 같이 씀
// - 기본 비밀번호는 공개 저장소라 원문 대신 SHA-256 해시만 저장
// - opts.password()가 값을 돌려주면(환경변수·파일) 그 비밀번호를 우선 사용
// - login 성공 시 토큰 발급 (비밀번호에서 만들어서 서버 재시작에도 유지, 비번 바꾸면 무효)
// - 5번 틀리면 그 접속(IP)은 1시간 잠금

const crypto = require('crypto');

const DEFAULT_HASH = '1cfafff6d51a03662b85b93dc3417f51687034ba9a46682f5328257eff7133ed';
const MAX_FAILS = 5;
const LOCK_MS = 60 * 60 * 1000;

const hashHex = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const same = (a, b) => crypto.timingSafeEqual(Buffer.from(hashHex(a)), Buffer.from(hashHex(b)));

function clientIp(req) {
  const h = req.headers || {};
  return String(h['cf-connecting-ip'] || h['x-real-ip'] || (h['x-forwarded-for'] || '').split(',')[0] || (req.socket && req.socket.remoteAddress) || '').trim() || 'unknown';
}

function createNoteAuth(opts = {}) {
  const now = opts.now || Date.now;
  const fails = new Map(); // ip → { count, lockedUntil }
  const pwHash = () => {
    const pw = String((typeof opts.password === 'function' ? opts.password() : opts.password) || '');
    return pw ? hashHex(pw) : DEFAULT_HASH;
  };
  const tokenFor = (h) => crypto.createHmac('sha256', 'family-note-v2').update(h).digest('hex');

  function tokenOk(req, url) {
    const t = String((req.headers && req.headers['x-note-token']) || (url && url.searchParams.get('token')) || '');
    return !!t && same(t, tokenFor(pwHash()));
  }
  // [status, body] 반환
  function login(req, body) {
    const ip = clientIp(req);
    const f = fails.get(ip) || { count: 0, lockedUntil: 0 };
    if (f.lockedUntil > now()) {
      return [429, { ok: false, locked: true, retryAfterMs: f.lockedUntil - now(), error: `비밀번호를 ${MAX_FAILS}번 틀려서 잠겼어요. ${Math.ceil((f.lockedUntil - now()) / 60000)}분 뒤에 다시 시도하세요.` }];
    }
    const h = pwHash();
    if (same(hashHex(String((body && body.password) || '')), h)) {
      fails.delete(ip);
      return [200, { ok: true, token: tokenFor(h) }];
    }
    f.count += 1;
    if (f.count >= MAX_FAILS) { f.count = 0; f.lockedUntil = now() + LOCK_MS; }
    fails.set(ip, f);
    if (f.lockedUntil > now()) return [429, { ok: false, locked: true, retryAfterMs: LOCK_MS, error: `비밀번호를 ${MAX_FAILS}번 틀려서 1시간 동안 잠겼어요.` }];
    return [401, { ok: false, authRequired: true, error: `비밀번호가 틀렸어요. (${MAX_FAILS - f.count}번 남음)` }];
  }
  return { tokenOk, login };
}

module.exports = { createNoteAuth, MAX_FAILS, LOCK_MS };
