#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 8791);
const ROOT = __dirname;

const HOME = -1;
const PATHS = {
  OUT: [HOME, ...Array.from({ length: 19 }, (_, i) => i + 1), 0],
  B: [5, 20, 21, 22, 23, 24, 15, 16, 17, 18, 19, 0],
  C: [10, 25, 26, 22, 27, 28, 0],
  D: [22, 27, 28, 0],
};
const NAMES = { '-1': '백도', 1: '도', 2: '개', 3: '걸', 4: '윷', 5: '모' };
const PLAYER_DEFS = [
  { name: '빨강', color: '#e53e3e' },
  { name: '파랑', color: '#3182ce' },
  { name: '초록', color: '#2f855a' },
  { name: '노랑', color: '#d69e2e' },
];
const rooms = new Map();

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
const clone = (x) => JSON.parse(JSON.stringify(x));
const roomCode = () => crypto.randomBytes(3).toString('hex').toUpperCase();
const playerId = () => crypto.randomBytes(8).toString('hex');
const isHome = (p) => !p.done && p.path === 'OUT' && p.idx === 0;
function nodeOf(p) {
  if (p.done) return null;
  const n = PATHS[p.path][p.idx];
  return n === HOME ? null : n;
}
function simulate(p, r) {
  if (p.done) return null;
  let path = p.path, idx = p.idx;
  if (r === -1) {
    if (isHome(p)) return null;
    if (path === 'OUT' && idx === 1) idx = 20;
    else idx--;
    if (path === 'D' && idx === 0) { path = 'C'; idx = 2; }
    else if (path === 'B' && idx === 0) { path = 'OUT'; idx = 5; }
    else if (path === 'C' && idx === 0) { path = 'OUT'; idx = 10; }
    return { path, idx, done: false, node: PATHS[path][idx], trail: [PATHS[path][idx]] };
  }
  const n = nodeOf(p);
  if (n === 5) { path = 'B'; idx = 0; }
  else if (n === 10) { path = 'C'; idx = 0; }
  else if (n === 22) { path = 'D'; idx = 0; }
  const arr = PATHS[path];
  const trail = [];
  for (let s = 0; s < r; s++) {
    idx++;
    if (idx >= arr.length) { trail.push('exit'); return { path, idx, done: true, node: null, trail }; }
    trail.push(arr[idx]);
  }
  const node = arr[idx];
  if (node === 5) { path = 'OUT'; idx = 5; }
  else if (node === 10) { path = 'OUT'; idx = 10; }
  return { path, idx, done: false, node, trail };
}
function sources(G, pi) {
  const pl = G.players[pi];
  const map = new Map();
  pl.pieces.forEach((p, i) => {
    const n = nodeOf(p);
    if (n !== null) { if (!map.has(n)) map.set(n, []); map.get(n).push(i); }
  });
  const list = [...map].map(([node, pieces]) => ({ key: 'n' + node, node, pieces }));
  const home = pl.pieces.findIndex(isHome);
  if (home >= 0) list.push({ key: 'home', node: null, pieces: [home] });
  return list;
}
function optionsFor(G, pi, src) {
  const lead = G.players[pi].pieces[src.pieces[0]];
  const seen = new Set(), out = [];
  for (const r of G.pending) {
    if (seen.has(r)) continue;
    seen.add(r);
    const res = simulate(lead, r);
    if (res) out.push({ r, src, res });
  }
  return out;
}
function allOptions(G, pi) { return sources(G, pi).flatMap((s) => optionsFor(G, pi, s)); }
function ownerAt(G, node, exceptPi) {
  if (node === null) return null;
  for (let i = 0; i < G.players.length; i++) {
    if (i === exceptPi) continue;
    const cnt = G.players[i].pieces.filter((p) => nodeOf(p) === node).length;
    if (cnt) return { pi: i, cnt };
  }
  return null;
}
function addLog(G, msg) { G.log.unshift(msg); G.log.length = Math.min(G.log.length, 40); }
const who = (G, i) => G.players[i].name;
function roll() {
  const faces = [0, 1, 2, 3].map(() => Math.random() < 0.5);
  const flats = faces.filter(Boolean).length;
  let r = flats === 0 ? 5 : flats;
  if (flats === 1 && faces[0]) r = -1;
  return { r, faces };
}
function settle(G) {
  G.selected = null;
  if (G.winner !== null) { G.phase = 'over'; return; }
  if (G.throwsLeft > 0) { G.phase = 'throw'; return; }
  if (G.pending.length && !allOptions(G, G.cur).length) {
    addLog(G, `움직일 말이 없어서 ${G.pending.map((r) => NAMES[r]).join(', ')}은(는) 버립니다.`);
    G.pending = [];
  }
  if (!G.pending.length) { nextTurn(G); return; }
  G.phase = 'move';
}
function nextTurn(G) {
  G.cur = (G.cur + 1) % G.players.length;
  G.phase = 'throw';
  G.pending = [];
  G.throwsLeft = 1;
  G.selected = null;
}
function createGame(count, pieces) {
  const n = Math.max(2, Math.min(4, Number(count) || 2));
  const pc = Math.max(2, Math.min(4, Number(pieces) || 4));
  const G = {
    players: Array.from({ length: n }, (_, i) => ({
      ...PLAYER_DEFS[i], ai: false,
      pieces: Array.from({ length: pc }, () => ({ path: 'OUT', idx: 0, done: false })),
    })),
    cur: 0, phase: 'throw', pending: [], throwsLeft: 1,
    selected: null, busy: false, winner: null, log: [], faces: null, lastResult: '',
  };
  addLog(G, `${who(G, 0)} 먼저 시작합니다.`);
  return G;
}
function publicRoom(room) {
  const teams = room.teams || room.players.map((pid) => pid ? [pid] : []);
  return {
    roomId: room.roomId,
    playersConnected: room.players.map(Boolean),
    teamMode: !!room.teamMode,
    teamCounts: teams.map((t) => t.length),
    spectatorCount: room.spectators ? room.spectators.length : 0,
    guestCount: room.guests ? room.guests.length : 0,
    canUndo: !!(room.history && room.history.length),
    game: clone(room.game),
    updatedAt: room.updatedAt,
  };
}
function dashboardRoom(room) {
  const pub = publicRoom(room);
  const G = room.game;
  const teamNames = G.players.map((p) => p.name);
  const pieces = G.players.map((p) => ({
    done: p.pieces.filter((x) => x.done).length,
    total: p.pieces.length,
    waiting: p.pieces.filter(isHome).length,
    onBoard: p.pieces.filter((x) => !x.done && !isHome(x)).length,
  }));
  return {
    roomId: room.roomId,
    teamMode: pub.teamMode,
    teamCounts: pub.teamCounts,
    spectatorCount: pub.spectatorCount,
    guestCount: pub.guestCount,
    playersConnected: pub.playersConnected,
    currentTeam: G.cur,
    currentTeamName: teamNames[G.cur] || '',
    phase: G.phase,
    phaseLabel: G.phase === 'throw' ? '윷 던질 차례' : G.phase === 'move' ? '말 이동 차례' : G.phase === 'over' ? '종료' : G.phase,
    pending: G.pending.map((r) => NAMES[r]),
    throwsLeft: G.throwsLeft,
    lastResult: G.lastResult,
    winner: G.winner,
    winnerName: G.winner === null ? '' : (teamNames[G.winner] || ''),
    canUndo: pub.canUndo,
    pieces,
    lastLog: G.log.slice(0, 5),
    updatedAt: room.updatedAt,
    ageSeconds: Math.max(0, Math.round((Date.now() - room.updatedAt) / 1000)),
  };
}
function teamIndexOf(room, pid) {
  const teams = room.teams || [];
  for (let i = 0; i < teams.length; i++) if (teams[i].includes(pid)) return i;
  return -1;
}
function isSpectator(room, pid) { return !!(room.spectators || []).includes(pid); }
function isController(room, pid) {
  return room.players.includes(pid) || teamIndexOf(room, pid) >= 0 || !!(room.guests || []).includes(pid);
}
function assertParticipant(room, pid) {
  if (!isController(room, pid) && !isSpectator(room, pid)) throw new Error('이 방의 참가자가 아닙니다.');
}
function assertController(room, pid) {
  if (!isController(room, pid)) throw new Error('관전자는 조작할 수 없습니다.');
}
function saveHistory(room) {
  room.history = room.history || [];
  room.history.push(clone(room.game));
  if (room.history.length > 30) room.history.shift();
}
function assertTurn(room, pid) {
  assertController(room, pid);
  const G = room.game;
  if (G.winner !== null) throw new Error('이미 종료된 게임입니다.');
  let pi = room.players.indexOf(pid);
  const ti = teamIndexOf(room, pid);
  const legacyGuest = room.guests && room.guests.includes(pid);
  if (ti >= 0) pi = ti;
  if (!legacyGuest && G.cur !== pi) throw new Error('현재 내 팀 차례가 아닙니다.');
  return legacyGuest ? G.cur : pi;
}
function handleThrow(room, pid) {
  assertTurn(room, pid);
  const G = room.game;
  if (G.phase !== 'throw') throw new Error('지금은 윷을 던질 수 없습니다.');
  saveHistory(room);
  const { r, faces } = roll();
  G.faces = faces;
  G.throwsLeft--;
  G.pending.push(r);
  const bonus = r >= 4;
  if (bonus) G.throwsLeft++;
  G.lastResult = NAMES[r] + (bonus ? '! 한 번 더' : '');
  addLog(G, `${who(G, G.cur)}: ${NAMES[r]}${bonus ? ' — 한 번 더 던집니다' : ''}`);
  if (G.throwsLeft > 0) G.phase = 'throw';
  else settle(G);
  room.updatedAt = Date.now();
}
function handleMove(room, pid, body) {
  assertTurn(room, pid);
  const G = room.game;
  if (G.phase !== 'move') throw new Error('지금은 말을 움직일 수 없습니다.');
  const pi = G.cur;
  const src = sources(G, pi).find((s) => s.key === body.srcKey);
  if (!src) throw new Error('선택한 말이 없습니다.');
  const opts = optionsFor(G, pi, src);
  const opt = opts.find((o) => o.r === Number(body.r) && String(o.res.done ? 'exit' : o.res.node) === String(body.destKey));
  if (!opt) throw new Error('선택한 이동을 할 수 없습니다.');
  saveHistory(room);
  const pl = G.players[pi];
  G.pending.splice(G.pending.indexOf(opt.r), 1);
  G.selected = null;
  const { res } = opt;
  for (const i of opt.src.pieces) Object.assign(pl.pieces[i], { path: res.path, idx: res.idx, done: res.done });
  const moved = opt.src.pieces.length;
  const label = moved > 1 ? `말 ${moved}개를 업고` : '말을';
  if (res.done) {
    addLog(G, `${who(G, pi)}이(가) ${NAMES[opt.r]}(으)로 ${label} 났습니다!`);
  } else {
    let stacked = 0;
    pl.pieces.forEach((p, i) => {
      if (!opt.src.pieces.includes(i) && nodeOf(p) === res.node) {
        p.path = res.path; p.idx = res.idx; stacked++;
      }
    });
    const enemy = ownerAt(G, res.node, pi);
    if (enemy) {
      for (const p of G.players[enemy.pi].pieces) if (nodeOf(p) === res.node) Object.assign(p, { path: 'OUT', idx: 0 });
      G.throwsLeft++;
      addLog(G, `${who(G, pi)}이(가) ${NAMES[opt.r]}(으)로 ${G.players[enemy.pi].name} 말 ${enemy.cnt}개를 잡았습니다! 한 번 더 던집니다.`);
    } else if (stacked) addLog(G, `${who(G, pi)}이(가) ${NAMES[opt.r]}(으)로 말을 업었습니다.`);
    else addLog(G, `${who(G, pi)}: ${NAMES[opt.r]}`);
  }
  if (pl.pieces.every((p) => p.done)) {
    G.winner = pi;
    addLog(G, `🎉 ${who(G, pi)}이(가) 이겼습니다!`);
  }
  settle(G);
  room.updatedAt = Date.now();
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
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
    if (url.pathname === '/api/health') return json(res, 200, { ok: true, rooms: rooms.size });
    if (url.pathname === '/api/dashboard') {
      const list = [...rooms.values()].map(dashboardRoom).sort((a, b) => b.updatedAt - a.updatedAt);
      return json(res, 200, {
        ok: true,
        rooms: list,
        totalRooms: list.length,
        totalTeamMembers: list.reduce((sum, r) => sum + (r.teamCounts || []).reduce((a, b) => a + b, 0), 0),
        totalSpectators: list.reduce((sum, r) => sum + (r.spectatorCount || 0), 0),
        now: Date.now(),
      });
    }
    if (url.pathname === '/api/room/create' && req.method === 'POST') {
      const body = await readBody(req);
      let id; do { id = roomCode(); } while (rooms.has(id));
      const pid = playerId();
      const teamMode = body.teamMode !== false;
      const game = createGame(teamMode ? 2 : body.count, body.pieces);
      const room = {
        roomId: id,
        players: teamMode ? [pid, null] : [pid],
        teams: teamMode ? [[pid], []] : null,
        spectators: [], guests: [], history: [], teamMode, game, updatedAt: Date.now(),
      };
      rooms.set(id, room);
      return json(res, 200, { ok: true, room: publicRoom(room), playerId: pid, playerIndex: 0, role: 'team', teamIndex: 0 });
    }
    if (url.pathname === '/api/room/join' && req.method === 'POST') {
      const body = await readBody(req);
      const room = rooms.get(String(body.roomId || '').toUpperCase());
      if (!room) return json(res, 404, { ok: false, error: '방을 찾을 수 없습니다.' });
      const pid = playerId();
      if (room.teamMode) {
        const requested = String(body.role || '').toLowerCase();
        if (requested === 'spectator') {
          room.spectators = room.spectators || [];
          room.spectators.push(pid);
          room.updatedAt = Date.now();
          return json(res, 200, { ok: true, room: publicRoom(room), playerId: pid, playerIndex: null, role: 'spectator' });
        }
        const teamIndex = Math.max(0, Math.min(1, Number(body.teamIndex || 0)));
        room.teams = room.teams || [[], []];
        room.teams[teamIndex].push(pid);
        if (!room.players[teamIndex]) room.players[teamIndex] = pid;
        room.updatedAt = Date.now();
        return json(res, 200, { ok: true, room: publicRoom(room), playerId: pid, playerIndex: teamIndex, role: 'team', teamIndex });
      }
      let idx = room.players.findIndex((x) => !x);
      if (idx < 0) idx = room.players.length;
      if (idx < room.game.players.length) {
        room.players[idx] = pid;
        room.updatedAt = Date.now();
        return json(res, 200, { ok: true, room: publicRoom(room), playerId: pid, playerIndex: idx, role: 'player' });
      }
      room.guests = room.guests || [];
      room.guests.push(pid);
      room.updatedAt = Date.now();
      return json(res, 200, { ok: true, room: publicRoom(room), playerId: pid, playerIndex: null, role: 'guest' });
    }
    if (url.pathname === '/api/room/state') {
      const room = rooms.get(String(url.searchParams.get('roomId') || '').toUpperCase());
      if (!room) return json(res, 404, { ok: false, error: '방을 찾을 수 없습니다.' });
      return json(res, 200, { ok: true, room: publicRoom(room) });
    }
    if (url.pathname === '/api/room/throw' && req.method === 'POST') {
      const body = await readBody(req);
      const room = rooms.get(String(body.roomId || '').toUpperCase());
      if (!room) return json(res, 404, { ok: false, error: '방을 찾을 수 없습니다.' });
      handleThrow(room, body.playerId);
      return json(res, 200, { ok: true, room: publicRoom(room) });
    }
    if (url.pathname === '/api/room/move' && req.method === 'POST') {
      const body = await readBody(req);
      const room = rooms.get(String(body.roomId || '').toUpperCase());
      if (!room) return json(res, 404, { ok: false, error: '방을 찾을 수 없습니다.' });
      handleMove(room, body.playerId, body);
      return json(res, 200, { ok: true, room: publicRoom(room) });
    }
    if (url.pathname === '/api/room/undo' && req.method === 'POST') {
      const body = await readBody(req);
      const room = rooms.get(String(body.roomId || '').toUpperCase());
      if (!room) return json(res, 404, { ok: false, error: '방을 찾을 수 없습니다.' });
      assertController(room, body.playerId);
      if (!room.history || !room.history.length) return json(res, 400, { ok: false, error: '무를 수 있는 이전 상태가 없습니다.' });
      room.game = room.history.pop();
      room.game.selected = null;
      room.game.busy = false;
      addLog(room.game, '↩ 무르기로 직전 상태로 돌아갔습니다.');
      room.updatedAt = Date.now();
      return json(res, 200, { ok: true, room: publicRoom(room) });
    }
    if (url.pathname === '/api/room/reset' && req.method === 'POST') {
      const body = await readBody(req);
      const room = rooms.get(String(body.roomId || '').toUpperCase());
      if (!room) return json(res, 404, { ok: false, error: '방을 찾을 수 없습니다.' });
      try { assertController(room, body.playerId); } catch (e) { return json(res, 403, { ok: false, error: e.message }); }
      room.game = createGame(room.game.players.length, room.game.players[0].pieces.length);
      room.history = [];
      room.updatedAt = Date.now();
      return json(res, 200, { ok: true, room: publicRoom(room) });
    }
    return serveStatic(req, res);
  } catch (e) {
    return json(res, 400, { ok: false, error: e.message || String(e) });
  }
});
server.listen(PORT, HOST, () => {
  console.log(`Yut online server: http://${HOST}:${PORT}`);
});
