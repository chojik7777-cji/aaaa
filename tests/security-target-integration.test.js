'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {dashboardPage}=require('../server/security-audit');
const host='inn-analytical-split-juice.trycloudflare.com';
const req={headers:{host,referer:'https://'+host+'/detail-admin-jik-2026.html'},socket:{remoteAddress:'127.0.0.1'}};
test('clicked dashboard target takes precedence over referring admin page',()=>{
 assert.equal(dashboardPage(req,{page:'/omok-dashboard.html'}),'omok-dashboard.html');
});
test('intro target works even when referer not an audited page',()=>{
 assert.equal(dashboardPage({...req,headers:{host,referer:'https://'+host+'/intro.html'}},{page:'/baduk-dashboard.html'}),'baduk-dashboard.html');
});
test('unknown or external target cannot inject arbitrary page names',()=>{
 assert.equal(dashboardPage(req,{page:'https://evil.test/private?token=secret'}),'detail-admin-jik-2026.html');
});
