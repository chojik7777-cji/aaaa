'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
test('Vercel audit API explicitly preserves private Mac-only boundary',async()=>{
 const handler=require('../api/security-audit');
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},end(v){this.data=JSON.parse(v);}};
 await handler({method:'GET',headers:{authorization:'Bearer fixture'}},res);
 assert.equal(res.statusCode,503);assert.equal(res.data.code,'LOCAL_ONLY');assert.equal(res.data.ok,false);assert.match(res.headers['Cache-Control'],/no-store/);
 assert.ok(!Object.hasOwn(res.data,'records'));
});
