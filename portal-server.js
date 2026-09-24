#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 8793);
const ROOT = __dirname;

const TARGETS = {
  '/api/room': 'http://127.0.0.1:8791',   // yut-server.js
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
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const file = path.normalize(path.join(ROOT, pathname));
  if (!file.startsWith(ROOT)) return send(res, 403, 'Forbidden');
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
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    });
    return res.end();
  }
  const pathname = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;
  if (pathname === '/api/health') {
    return send(res, 200, JSON.stringify({ ok: true, portal: true, yut: '8791', omok: '8792' }), 'application/json; charset=utf-8');
  }
  for (const [prefix, base] of Object.entries(TARGETS)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return proxy(req, res, base);
  }
  return serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Game portal server: http://${HOST}:${PORT}`);
  console.log(`- intro: http://${HOST}:${PORT}/index.html`);
  console.log(`- omok:  http://${HOST}:${PORT}/omok.html`);
  console.log(`- yut:   http://${HOST}:${PORT}/yut.html`);
});
