'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const {userAgentMetadata}=require('../server/audit-device');
test('Node client label is not misreported as an operating system',()=>{assert.deepEqual(userAgentMetadata('node'),{browser:'node',os:'unknown'});});
test('iPad desktop-style Safari Mobile UA is marked iOS rather than macOS',()=>{
 const ua='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
 assert.equal(userAgentMetadata(ua).os,'iOS');
});
