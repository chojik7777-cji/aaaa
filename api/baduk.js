'use strict';

const crypto = require('crypto');

const EMPTY = 0, BLACK = 1, WHITE = 2;
globalThis.__BADUK_ROOMS__ = globalThis.__BADUK_ROOMS__ || new Map();
const rooms = globalThis.__BADUK_ROOMS__;

const roomCode = () => crypto.randomBytes(3).toString('hex').toUpperCase();
const playerId = () => crypto.randomBytes(8).toString('hex');
const clone = x => JSON.parse(JSON.stringify(x));

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.end(JSON.stringify(data));
}
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
    game.moves.push(-1); game.passes++; game.ko = -1; game.last = -1;
    if (game.passes >= 2) { game.phase = 'score'; game.dead = Array(game.size * game.size).fill(0); }
    else game.toMove = 3 - game.toMove;
  } else {
    const r = tryPlay(game, p, color);
    if (!r) throw new Error(p === game.ko ? '패 자리입니다. 다른 곳에 한 수 둔 뒤 되따낼 수 있어요.' : '둘 수 없는 자리입니다.');
    game.moves.push(p); game.caps[color] += r.cap.length; game.ko = r.ko; game.passes = 0; game.last = p; game.toMove = 3 - color;
  }
  game.updatedAt = room.updatedAt = Date.now();
}
function cleanupRooms() {
  const cutoff = Date.now() - 1000 * 60 * 60 * 6;
  for (const [id, room] of rooms) if ((room.updatedAt || 0) < cutoff) rooms.delete(id);
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  cleanupRooms();
  try {
    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const action = url.searchParams.get('action') || url.pathname.split('/').filter(Boolean).pop();
    const body = req.body && typeof req.body === 'object' ? req.body : {};

    if (action === 'health') return send(res, 200, { ok: true, rooms: rooms.size, game: 'baduk' });
    if (action === 'create' && req.method === 'POST') {
      let id; do { id = roomCode(); } while (rooms.has(id));
      const pid = playerId();
      const room = { roomId: id, players: [pid, null], guests: [], game: createGame(body), updatedAt: Date.now() };
      rooms.set(id, room);
      return send(res, 200, { ok: true, room: publicRoom(room), playerId: pid, playerIndex: 0 });
    }
    if (action === 'join' && req.method === 'POST') {
      const room = rooms.get(String(body.roomId || '').toUpperCase());
      if (!room) return send(res, 404, { ok: false, error: '방을 찾을 수 없습니다.' });
      const pid = playerId();
      if (!room.players[1]) {
        room.players[1] = pid; room.updatedAt = Date.now();
        return send(res, 200, { ok: true, room: publicRoom(room), playerId: pid, playerIndex: 1, role: 'player' });
      }
      room.guests.push(pid); room.updatedAt = Date.now();
      return send(res, 200, { ok: true, room: publicRoom(room), playerId: pid, playerIndex: null, role: 'guest' });
    }
    if (action === 'state') {
      const room = rooms.get(String(url.searchParams.get('roomId') || body.roomId || '').toUpperCase());
      if (!room) return send(res, 404, { ok: false, error: '방을 찾을 수 없습니다.' });
      return send(res, 200, { ok: true, room: publicRoom(room) });
    }
    if (action === 'move' && req.method === 'POST') {
      const room = rooms.get(String(body.roomId || '').toUpperCase());
      if (!room) return send(res, 404, { ok: false, error: '방을 찾을 수 없습니다.' });
      move(room, body.playerId, body.p);
      return send(res, 200, { ok: true, room: publicRoom(room) });
    }
    if (action === 'reset' && req.method === 'POST') {
      const room = rooms.get(String(body.roomId || '').toUpperCase());
      if (!room) return send(res, 404, { ok: false, error: '방을 찾을 수 없습니다.' });
      if (!room.players.includes(body.playerId) && !room.guests.includes(body.playerId)) return send(res, 403, { ok: false, error: '이 방의 참가자가 아닙니다.' });
      room.game = createGame(room.game); room.updatedAt = Date.now();
      return send(res, 200, { ok: true, room: publicRoom(room) });
    }
    if (action === 'resign' && req.method === 'POST') {
      const room = rooms.get(String(body.roomId || '').toUpperCase());
      if (!room) return send(res, 404, { ok: false, error: '방을 찾을 수 없습니다.' });
      const pi = room.players.indexOf(body.playerId);
      if (pi < 0) return send(res, 403, { ok: false, error: '이 방의 참가자가 아닙니다.' });
      const resigned = pi === 0 ? BLACK : WHITE;
      const winner = 3 - resigned;
      room.game.phase = 'end'; room.game.result = `${winner === BLACK ? '흑' : '백'} 불계승`;
      room.updatedAt = room.game.updatedAt = Date.now();
      return send(res, 200, { ok: true, room: publicRoom(room) });
    }
    return send(res, 404, { ok: false, error: '알 수 없는 API입니다.' });
  } catch (e) {
    return send(res, 400, { ok: false, error: e.message || String(e) });
  }
};
