'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { publicPath } = require('../server/static-policy');
test('junior generator is public while backend and private files remain excluded', () => {
  assert.equal(publicPath('/math-junior-problems.js'), true);
  assert.equal(publicPath('/math-junior.html'), true);
  for (const p of ['/server/math-control.js', '/.env', '/math-junior-secrets.js', '/server/static-policy.js']) assert.equal(publicPath(p), false);
});
