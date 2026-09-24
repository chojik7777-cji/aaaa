#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 8792);
const ROOT = __dirname;
const SIZE = 15;
const EMPTY = 0, BLACK = 1, WHITE = 2;
const NAMES = { [BLACK]: '흑', [WHITE]: '백' };
const DIRS = [[1,0],[0,1],[1,1],[1,-1]];
const rooms = new Map();

const roomCode = () => crypto.randomBytes(3).toString('hex').toUpperCase();
const playerId = () => crypto.randomBytes(8).toString('hex');
const clone = (x) => JSON.parse(JSON.stringify(x));
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
  return {
    board: Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY)),
    turn: BLACK, moves: [], winner: null, winLine: null, rule: rule === 'free' ? 'free' : 'renju',
    log: ['흑이 먼저 시작합니다.'], updatedAt: Date.now(),
  };
}
function publicRoom(room) {
  return { roomId: room.roomId, playersConnected: room.players.map(Boolean), game: clone(room.game), updatedAt: room.updatedAt };
}
function assertTurn(room, pid) {
  const pi = room.players.indexOf(pid);
  if (pi < 0) throw new Error('이 방의 참가자가 아닙니다.');
  const color = pi === 0 ? BLACK : WHITE;
  if (room.game.turn !== color) throw new Error('현재 내 차례가 아닙니다.');
  if (room.game.winner) throw new Error('이미 종료된 게임입니다.');
  return { pi, color };
}
function handleMove(room, pid, x, y) {
  const { color } = assertTurn(room, pid);
  const G = room.game;
  x = Number(x); y = Number(y);
  if (!Number.isInteger(x) || !Number.isInteger(y) || !inBounds(x,y)) throw new Error('판 밖입니다.');
  if (G.board[y][x] !== EMPTY) throw new Error('이미 돌이 있는 자리입니다.');
  G.board[y][x] = color;
  G.moves.push({x,y,color});
  G.winLine = findWin(G.board, x, y, G.rule);
  if (G.winLine) {
    G.winner = color;
    G.log.unshift(`${NAMES[color]} 승리`);
  } else if (G.moves.length === SIZE * SIZE) {
    G.winner = 'draw';
    G.log.unshift('무승부');
  } else {
    G.turn = color === BLACK ? WHITE : BLACK;
    G.log.unshift(`${NAMES[color]} 착수: ${x + 1}, ${y + 1}`);
  }
  G.log.length = Math.min(G.log.length, 30);
  G.updatedAt = room.updatedAt = Date.now();
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch(e) { reject(e); } });
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
    if (url.pathname === '/api/health') return json(res, 200, { ok: true, rooms: rooms.size, game: 'omok' });
    if (url.pathname === '/api/omok/create' && req.method === 'POST') {
      const body = await readBody(req);
      let id; do { id = roomCode(); } while (rooms.has(id));
      const pid = playerId();
      const room = { roomId: id, players: [pid, null], game: createGame(body.rule), updatedAt: Date.now() };
      rooms.set(id, room);
      return json(res, 200, { ok: true, room: publicRoom(room), playerId: pid, playerIndex: 0 });
    }
    if (url.pathname === '/api/omok/join' && req.method === 'POST') {
      const body = await readBody(req);
      const room = rooms.get(String(body.roomId || '').toUpperCase());
      if (!room) return json(res, 404, { ok: false, error: '방을 찾을 수 없습니다.' });
      if (room.players[1]) return json(res, 400, { ok: false, error: '방이 가득 찼습니다.' });
      const pid = playerId();
      room.players[1] = pid; room.updatedAt = Date.now();
      return json(res, 200, { ok: true, room: publicRoom(room), playerId: pid, playerIndex: 1 });
    }
    if (url.pathname === '/api/omok/state') {
      const room = rooms.get(String(url.searchParams.get('roomId') || '').toUpperCase());
      if (!room) return json(res, 404, { ok: false, error: '방을 찾을 수 없습니다.' });
      return json(res, 200, { ok: true, room: publicRoom(room) });
    }
    if (url.pathname === '/api/omok/move' && req.method === 'POST') {
      const body = await readBody(req);
      const room = rooms.get(String(body.roomId || '').toUpperCase());
      if (!room) return json(res, 404, { ok: false, error: '방을 찾을 수 없습니다.' });
      handleMove(room, body.playerId, body.x, body.y);
      return json(res, 200, { ok: true, room: publicRoom(room) });
    }
    if (url.pathname === '/api/omok/reset' && req.method === 'POST') {
      const body = await readBody(req);
      const room = rooms.get(String(body.roomId || '').toUpperCase());
      if (!room) return json(res, 404, { ok: false, error: '방을 찾을 수 없습니다.' });
      if (!room.players.includes(body.playerId)) return json(res, 403, { ok: false, error: '이 방의 참가자가 아닙니다.' });
      room.game = createGame(room.game.rule);
      room.updatedAt = Date.now();
      return json(res, 200, { ok: true, room: publicRoom(room) });
    }
    return serveStatic(req, res);
  } catch (e) {
    return json(res, 400, { ok: false, error: e.message || String(e) });
  }
});
server.listen(PORT, HOST, () => console.log(`Omok online server: http://${HOST}:${PORT}`));
