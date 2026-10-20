const test=require('node:test');const assert=require('node:assert/strict');const {publicPath}=require('../server/static-policy');
test('problem generator is public in Mac static serving and public build',()=>assert.equal(publicPath('/math-problems.js'),true));
