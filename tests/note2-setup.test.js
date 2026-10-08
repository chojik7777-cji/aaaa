'use strict';

const assert = require('assert');
const handler = require('../api/note2.js');

function mockReq(method, url, body = {}) { return { method, url, headers: { host: 'localhost' }, body }; }
function mockRes() { return { statusCode: 0, headers: {}, body: Buffer.alloc(0), setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(x) { this.body = Buffer.isBuffer(x) ? x : Buffer.from(x || ''); } }; }
async function call(method, url, body = {}) { const res = mockRes(); await handler(mockReq(method, url, body), res); return { status: res.statusCode, headers: res.headers, data: JSON.parse(res.body.toString() || '{}') }; }

(async () => {
  const setup = await call('GET', '/api/note2/setup');
  assert.strictEqual(setup.status, 200);
  assert.strictEqual(setup.data.ok, true);
  assert.ok(setup.data.sql.includes('collab_notes'));
  const state = await call('GET', '/api/note2/state?room=test');
  assert.strictEqual(state.status, 503);
  assert.strictEqual(state.data.setupRequired, true);
  assert.ok(state.data.requiredEnv.includes('SUPABASE_URL'));
  console.log('note2 setup tests passed');
})().catch((err) => { console.error(err.stack || err); process.exit(1); });
