#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 8793);
const ROOT = __dirname;
const EMPTY = 0, BLACK = 1, WHITE = 2;
const rooms = new Map();

const roomCode = () => crypto.randomBytes(3).toString('hex').toUpperCase();
const playerId = () => crypto.randomBytes(8).toString('hex');
const clone = x => JSON.parse(JSON.stringify(x));
const json = (res, status, data) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end(JSON.stringify(data));
};

function neighbors(n, p) {
  const x = p % n, y = Math.floor(p / n), out = [];
  if (x > 0) out.push(p - 1);
  if (x < n - 1) out.push(p + 1);
  if (y > 0) out.push(p - n);
  if (y < n - 1) out.push(p + n);
  return out;
}
function group(b, n, p) {
  const color = b[p], seen = new Set([p]), stones = [p], libs = new Set();
  for (let i = 0; i < stones.length; i++) {
    for (const q of neighbors(n, stones[i])) {
      if (b[q] === EMPTY) libs.add(q);
      else if (b[q] === color && !seen.has(q)) { seen.add(q); stones.push(q); }
    }
  }
  return { stones, libs: libs.size };
}
function tryPlay(game, p, color) {
  const n = game.size, b = game.b;
  if (p < 0 || p >= n * n || b[p] !== EMPTY || p === game.ko) return null;
  b[p] = color;
  const opp = 3 - color;
  let cap = [];
  for (const q of neighbors(n, p)) {
    if (b[q] === opp) {
      const g = group(b, n, q);
      if (g.libs === 0) {
        for (const s of g.stones) b[s] = EMPTY;
        cap = cap.concat(g.stones);
      }
    }
  }
  const mine = group(b, n, p);
  if (mine.libs === 0) {
    b[p] = EMPTY;
    for (const s of cap) b[s] = opp;
    return null;
  }
  const ko = cap.length === 1 && mine.stones.length === 1 && mine.libs === 1 ? cap[0] : -1;
  return { cap, ko };
}
function createGame(opts = {}) {
  const size = [9, 13, 19].includes(Number(opts.size)) ? Number(opts.size) : 9;
  const komi = [0.5, 6.5, 7.5].includes(Number(opts.komi)) ? Number(opts.komi) : 6.5;
  return {
    size, mode: 'net', level: Number(opts.level || 2), human: BLACK, komi,
    levelB: Number(opts.levelB || opts.level || 2), levelW: Number(opts.levelW || opts.level || 2), paused: false,
    b: Array(size * size).fill(EMPTY), toMove: BLACK, ko: -1, caps: { 1: 0, 2: 0 },
    moves: [], history: [], passes: 0, phase: 'play', last: -1, dead: null, result: null,
    updatedAt: Date.now(),
  };
}
function publicRoom(room) {
  return {
    roomId: room.roomId,
    playersConnected: room.players.map(Boolean),
    guestCount: room.guests.length,
    game: clone(room.game),
    updatedAt: room.updatedAt,
  };
}
function assertTurn(room, pid) {
  const pi = room.players.indexOf(pid);
  const guest = room.guests.includes(pid);
  if (pi < 0 && !guest) throw new Error('이 방의 참가자가 아닙니다.');
  if (room.game.phase !== 'play') throw new Error('현재 착수할 수 있는 상태가 아닙니다.');
  if (!guest && pi !== (room.game.toMove === BLACK ? 0 : 1)) throw new Error('현재 내 차례가 아닙니다.');
  return { pi: guest ? null : pi, color: room.game.toMove };
}
function move(room, pid, p) {
  const { color } = assertTurn(room, pid);
  const game = room.game;
  p = Number(p);
  if (p < 0) {
    game.moves.push(-1);
    game.passes++;
    game.ko = -1;
    game.last = -1;
    if (game.passes >= 2) {
      game.phase = 'score';
      game.dead = Array(game.size * game.size).fill(0);
    } else game.toMove = 3 - game.toMove;
  } else {
    const r = tryPlay(game, p, color);
    if (!r) throw new Error(p === game.ko ? '패 자리입니다. 다른 곳에 한 수 둔 뒤 되따낼 수 있어요.' : '둘 수 없는 자리입니다.');
    game.moves.push(p);
    game.caps[color] += r.cap.length;
    game.ko = r.ko;
    game.passes = 0;
    game.last = p;
    game.toMove = 3 - color;
  }
  game.updatedAt = room.updatedAt = Date.now();
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/baduk.html';
  const file = path.normalize(path.join(ROOT, pathname));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(file).toLowerCase();
    const type = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.js' ? 'text/javascript; charset=utf-8' : ext === '.css' ? 'text/css; charset=utf-8' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname === '/api/health') return json(res, 200, { ok: true, rooms: rooms.size, game: 'baduk' });
    if (url.pathname === '/api/baduk/create' && req.method === 'POST') {
      const body = await readBody(req);
      let id; do { id = roomCode(); } while (rooms.has(id));
      const pid = playerId();
      const room = { roomId: id, players: [pid, null], guests: [], game: createGame(body), updatedAt: Date.now() };
      rooms.set(id, room);
      return json(res, 200, { ok: true, room: publicRoom(room), playerId: pid, playerIndex: 0 });
    }
    if (url.pathname === '/api/baduk/join' && req.method === 'POST') {
      const body = await readBody(req);
      const room = rooms.get(String(body.roomId || '').toUpperCase());
      if (!room) return json(res, 404, { ok: false, error: '방을 찾을 수 없습니다.' });
      const pid = playerId();
      if (!room.players[1]) {
        room.players[1] = pid; room.updatedAt = Date.now();
        return json(res, 200, { ok: true, room: publicRoom(room), playerId: pid, playerIndex: 1, role: 'player' });
      }
      room.guests.push(pid); room.updatedAt = Date.now();
      return json(res, 200, { ok: true, room: publicRoom(room), playerId: pid, playerIndex: null, role: 'guest' });
    }
    if (url.pathname === '/api/baduk/state') {
      const room = rooms.get(String(url.searchParams.get('roomId') || '').toUpperCase());
      if (!room) return json(res, 404, { ok: false, error: '방을 찾을 수 없습니다.' });
      return json(res, 200, { ok: true, room: publicRoom(room) });
    }
    if (url.pathname === '/api/baduk/move' && req.method === 'POST') {
      const body = await readBody(req);
      const room = rooms.get(String(body.roomId || '').toUpperCase());
      if (!room) return json(res, 404, { ok: false, error: '방을 찾을 수 없습니다.' });
      move(room, body.playerId, body.p);
      return json(res, 200, { ok: true, room: publicRoom(room) });
    }
    if (url.pathname === '/api/baduk/reset' && req.method === 'POST') {
      const body = await readBody(req);
      const room = rooms.get(String(body.roomId || '').toUpperCase());
      if (!room) return json(res, 404, { ok: false, error: '방을 찾을 수 없습니다.' });
      if (!room.players.includes(body.playerId) && !room.guests.includes(body.playerId)) return json(res, 403, { ok: false, error: '이 방의 참가자가 아닙니다.' });
      room.game = createGame(room.game);
      room.updatedAt = Date.now();
      return json(res, 200, { ok: true, room: publicRoom(room) });
    }
    if (url.pathname === '/api/baduk/resign' && req.method === 'POST') {
      const body = await readBody(req);
      const room = rooms.get(String(body.roomId || '').toUpperCase());
      if (!room) return json(res, 404, { ok: false, error: '방을 찾을 수 없습니다.' });
      const pi = room.players.indexOf(body.playerId);
      if (pi < 0) return json(res, 403, { ok: false, error: '이 방의 참가자가 아닙니다.' });
      const resigned = pi === 0 ? BLACK : WHITE;
      const winner = 3 - resigned;
      room.game.phase = 'end';
      room.game.result = `${winner === BLACK ? '흑' : '백'} 불계승`;
      room.updatedAt = room.game.updatedAt = Date.now();
      return json(res, 200, { ok: true, room: publicRoom(room) });
    }
    return serveStatic(req, res);
  } catch (e) {
    return json(res, 400, { ok: false, error: e.message || String(e) });
  }
});

server.listen(PORT, HOST, () => console.log(`Baduk online server: http://${HOST}:${PORT}`));
