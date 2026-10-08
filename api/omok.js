'use strict';

const crypto = require('crypto');
const SIZE = 15;
const EMPTY = 0, BLACK = 1, WHITE = 2;
const NAMES = { [BLACK]: '흑', [WHITE]: '백' };
const DIRS = [[1,0],[0,1],[1,1],[1,-1]];
globalThis.__OMOK_ROOMS__ = globalThis.__OMOK_ROOMS__ || new Map();
const rooms = globalThis.__OMOK_ROOMS__;

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
function inBounds(x,y){ return x>=0 && y>=0 && x<SIZE && y<SIZE; }
function findWin(board, x, y, rule='renju') {
  const c = board[y][x];
  for (const [dx,dy] of DIRS) {
    let ax=x, ay=y, bx=x, by=y;
    while (inBounds(ax-dx, ay-dy) && board[ay-dy][ax-dx] === c) { ax-=dx; ay-=dy; }
    while (inBounds(bx+dx, by+dy) && board[by+dy][bx+dx] === c) { bx+=dx; by+=dy; }
    const len = Math.max(Math.abs(bx-ax), Math.abs(by-ay)) + 1;
    if ((rule === 'renju' && c === BLACK) ? len === 5 : len >= 5) return [{x:ax,y:ay},{x:bx,y:by}];
  }
  return null;
}
function createGame(rule='renju') {
  return { board: Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY)), turn: BLACK, moves: [], winner: null, winLine: null, rule: rule === 'free' ? 'free' : 'renju', log: ['흑이 먼저 시작합니다.'], updatedAt: Date.now() };
}
function publicRoom(room) {
  return { roomId: room.roomId, playersConnected: room.players.map(Boolean), guestCount: room.guests.length, game: clone(room.game), updatedAt: room.updatedAt };
}
function connectionLabel(pid) { return pid ? pid.slice(0, 4).toUpperCase() : ''; }
function removeConnection(room, targetId) {
  let removed = false;
  const pi = room.players.indexOf(targetId);
  if (pi >= 0) { room.players[pi] = null; removed = true; }
  const beforeGuests = room.guests.length;
  room.guests = room.guests.filter((pid) => pid !== targetId);
  if (room.guests.length !== beforeGuests) removed = true;
  if (removed) {
    room.game.log.unshift(`접속자 ${connectionLabel(targetId)} 님의 접속을 종료했습니다.`);
    room.game.log.length = Math.min(room.game.log.length, 30);
    room.game.updatedAt = room.updatedAt = Date.now();
  }
  return removed;
}
function dashboardRoom(room) {
  const G = room.game;
  const black = G.moves.filter(m => m.color === BLACK).length;
  const white = G.moves.filter(m => m.color === WHITE).length;
  return {
    roomId: room.roomId,
    playersConnected: room.players.map(Boolean),
    blackConnected: !!room.players[0],
    whiteConnected: !!room.players[1],
    guestCount: room.guests.length,
    connections: {
      players: room.players.map((pid, idx) => pid ? ({ id: pid, label: `${idx === 0 ? '흑' : '백'} 플레이어 · ${connectionLabel(pid)}`, role: 'player', playerIndex: idx }) : null).filter(Boolean),
      guests: room.guests.map((pid, idx) => ({ id: pid, label: `공동참여자 #${idx + 1} · ${connectionLabel(pid)}`, role: 'guest' })),
    },
    rule: G.rule === 'free' ? '자유 오목' : '렌주룰',
    turn: G.winner ? '-' : NAMES[G.turn],
    winner: G.winner === 'draw' ? '무승부' : G.winner ? `${NAMES[G.winner]} 승리` : '',
    phase: G.winner ? '종료' : '진행/대기',
    moveCount: G.moves.length,
    blackStones: black,
    whiteStones: white,
    lastMove: G.moves.length ? `${NAMES[G.moves[G.moves.length - 1].color]} ${G.moves[G.moves.length - 1].x + 1}, ${G.moves[G.moves.length - 1].y + 1}` : '-',
    lastLog: (G.log || []).slice(0, 5),
    updatedAt: room.updatedAt,
    ageSeconds: Math.max(0, Math.round((Date.now() - room.updatedAt) / 1000)),
  };
}
function dashboard() {
  const list = [...rooms.values()].sort((a,b)=>b.updatedAt-a.updatedAt).map(dashboardRoom);
  return { ok: true, now: Date.now(), totalRooms: list.length, totalPlayers: list.reduce((s,r)=>s+(r.blackConnected?1:0)+(r.whiteConnected?1:0),0), totalGuests: list.reduce((s,r)=>s+r.guestCount,0), activeRooms: list.filter(r=>!r.winner).length, rooms: list };
}
function assertTurn(room, pid) {
  const pi = room.players.indexOf(pid);
  const guest = room.guests.includes(pid);
  if (pi < 0 && !guest) throw new Error('이 방의 참가자가 아닙니다.');
  const color = guest ? room.game.turn : (pi === 0 ? BLACK : WHITE);
  if (room.game.turn !== color) throw new Error('현재 내 차례가 아닙니다.');
  if (room.game.winner) throw new Error('이미 종료된 게임입니다.');
  return { color };
}
function handleMove(room, pid, x, y) {
  const { color } = assertTurn(room, pid);
  const G = room.game;
  x = Number(x); y = Number(y);
  if (!Number.isInteger(x) || !Number.isInteger(y) || !inBounds(x,y)) throw new Error('판 밖입니다.');
  if (G.board[y][x] !== EMPTY) throw new Error('이미 돌이 있는 자리입니다.');
  G.board[y][x] = color; G.moves.push({x,y,color}); G.winLine = findWin(G.board, x, y, G.rule);
  if (G.winLine) { G.winner = color; G.log.unshift(`${NAMES[color]} 승리`); }
  else if (G.moves.length === SIZE * SIZE) { G.winner = 'draw'; G.log.unshift('무승부'); }
  else { G.turn = color === BLACK ? WHITE : BLACK; G.log.unshift(`${NAMES[color]} 착수: ${x + 1}, ${y + 1}`); }
  G.log.length = Math.min(G.log.length, 30); G.updatedAt = room.updatedAt = Date.now();
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
    if (action === 'health') return send(res, 200, { ok: true, rooms: rooms.size, game: 'omok' });
    if (action === 'dashboard') return send(res, 200, dashboard());
    if ((action === 'dashboard/kick' || action === 'kick') && req.method === 'POST') {
      const room = rooms.get(String(body.roomId || '').toUpperCase());
      if (!room) return send(res, 404, { ok: false, error: '방을 찾을 수 없습니다.' });
      if (!body.targetId) return send(res, 400, { ok: false, error: '종료할 접속자를 선택하세요.' });
      const removed = removeConnection(room, String(body.targetId));
      if (!removed) return send(res, 404, { ok: false, error: '해당 접속자를 찾을 수 없습니다.' });
      return send(res, 200, { ok: true, room: dashboardRoom(room) });
    }
    if ((action === 'dashboard/delete-room' || action === 'delete-room') && req.method === 'POST') {
      const roomId = String(body.roomId || '').toUpperCase();
      if (!rooms.has(roomId)) return send(res, 404, { ok: false, error: '방을 찾을 수 없습니다.' });
      rooms.delete(roomId);
      return send(res, 200, { ok: true, deletedRoomId: roomId, rooms: rooms.size });
    }
    if (action === 'create' && req.method === 'POST') {
      let id; do { id = roomCode(); } while (rooms.has(id));
      const pid = playerId();
      const room = { roomId: id, players: [pid, null], guests: [], game: createGame(body.rule), updatedAt: Date.now() };
      rooms.set(id, room);
      return send(res, 200, { ok: true, room: publicRoom(room), playerId: pid, playerIndex: 0 });
    }
    if (action === 'join' && req.method === 'POST') {
      const room = rooms.get(String(body.roomId || '').toUpperCase());
      if (!room) return send(res, 404, { ok: false, error: '방을 찾을 수 없습니다.' });
      const pid = playerId();
      if (!room.players[1]) { room.players[1] = pid; room.updatedAt = Date.now(); return send(res, 200, { ok: true, room: publicRoom(room), playerId: pid, playerIndex: 1, role: 'player' }); }
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
      handleMove(room, body.playerId, body.x, body.y);
      return send(res, 200, { ok: true, room: publicRoom(room) });
    }
    if (action === 'reset' && req.method === 'POST') {
      const room = rooms.get(String(body.roomId || '').toUpperCase());
      if (!room) return send(res, 404, { ok: false, error: '방을 찾을 수 없습니다.' });
      if (!room.players.includes(body.playerId) && !room.guests.includes(body.playerId)) return send(res, 403, { ok: false, error: '이 방의 참가자가 아닙니다.' });
      room.game = createGame(room.game.rule); room.updatedAt = Date.now();
      return send(res, 200, { ok: true, room: publicRoom(room) });
    }
    return send(res, 404, { ok: false, error: '알 수 없는 API입니다.' });
  } catch (e) { return send(res, 400, { ok: false, error: e.message || String(e) }); }
};
