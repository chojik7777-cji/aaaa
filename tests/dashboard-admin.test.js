'use strict';

const assert = require('assert');

function mockReq(method, url, body = {}) {
  return { method, url, headers: { host: 'localhost' }, body };
}

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(x) { this.body = x || ''; },
  };
}

async function call(handler, method, url, body = {}) {
  const res = mockRes();
  await handler(mockReq(method, url, body), res);
  let data;
  try { data = JSON.parse(res.body || '{}'); }
  catch (e) { data = { parseError: e.message, raw: res.body }; }
  return { status: res.statusCode, data };
}

async function assertDashboardRoomDeletion({ name, modulePath, createUrl, dashboardUrl, deleteUrl }) {
  const handler = require(modulePath);
  const created = await call(handler, 'POST', createUrl, {});
  assert.strictEqual(created.status, 200, `${name} create status`);
  assert.strictEqual(created.data.ok, true, `${name} create ok`);
  const roomId = created.data.room.roomId;

  const before = await call(handler, 'GET', dashboardUrl, {});
  assert.strictEqual(before.status, 200, `${name} dashboard status before`);
  assert.ok(before.data.rooms.some((r) => r.roomId === roomId), `${name} dashboard includes room before delete`);

  const deleted = await call(handler, 'POST', deleteUrl, { roomId });
  assert.strictEqual(deleted.status, 200, `${name} delete-room status`);
  assert.strictEqual(deleted.data.ok, true, `${name} delete-room ok`);
  assert.strictEqual(deleted.data.deletedRoomId, roomId, `${name} deleted room id`);

  const after = await call(handler, 'GET', dashboardUrl, {});
  assert.strictEqual(after.status, 200, `${name} dashboard status after`);
  assert.ok(!after.data.rooms.some((r) => r.roomId === roomId), `${name} dashboard removes room after delete`);
}

async function assertDashboardKick({ name, modulePath, createUrl, dashboardUrl, kickUrl }) {
  const handler = require(modulePath);
  const created = await call(handler, 'POST', createUrl, {});
  assert.strictEqual(created.status, 200, `${name} create for kick status`);
  const roomId = created.data.room.roomId;
  const targetId = created.data.playerId;

  const kicked = await call(handler, 'POST', kickUrl, { roomId, targetId });
  assert.strictEqual(kicked.status, 200, `${name} kick status`);
  assert.strictEqual(kicked.data.ok, true, `${name} kick ok`);

  const after = await call(handler, 'GET', dashboardUrl, {});
  const room = after.data.rooms.find((r) => r.roomId === roomId);
  assert.ok(room, `${name} room remains after kicking connection`);
  assert.strictEqual(room.playersConnected[0], false, `${name} first player disconnected after kick`);
}

(async () => {
  await assertDashboardRoomDeletion({
    name: 'omok',
    modulePath: '../api/omok.js',
    createUrl: '/api/omok/create',
    dashboardUrl: '/api/omok/dashboard',
    deleteUrl: '/api/omok/dashboard/delete-room',
  });
  await assertDashboardRoomDeletion({
    name: 'baduk',
    modulePath: '../api/baduk.js',
    createUrl: '/api/baduk/create',
    dashboardUrl: '/api/baduk/dashboard',
    deleteUrl: '/api/baduk/dashboard/delete-room',
  });
  await assertDashboardRoomDeletion({
    name: 'yut',
    modulePath: '../api/yut.js',
    createUrl: '/api/yut/room/create',
    dashboardUrl: '/api/yut/dashboard',
    deleteUrl: '/api/yut/dashboard/delete-room',
  });
  await assertDashboardKick({
    name: 'omok',
    modulePath: '../api/omok.js',
    createUrl: '/api/omok/create',
    dashboardUrl: '/api/omok/dashboard',
    kickUrl: '/api/omok/dashboard/kick',
  });
  await assertDashboardKick({
    name: 'baduk',
    modulePath: '../api/baduk.js',
    createUrl: '/api/baduk/create',
    dashboardUrl: '/api/baduk/dashboard',
    kickUrl: '/api/baduk/dashboard/kick',
  });
  console.log('dashboard admin tests passed');
})().catch((err) => {
  console.error(err.stack || err);
  process.exit(1);
});
