'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {publicPath}=require('../server/static-policy');
test('static allowlist permits UI but rejects credentials, source, uploads and traversal',()=>{
 for(const p of ['/','.env.local','/.env.local','/note-auth.js','/server/note-local.js','/.git/config','/note/family/.note-password','/note2/church/photo.png','/scripts/init-note-auth.js','/pw','/vercel.json','/../note.html','/note.html/extra'])if(p!=='/')assert.equal(publicPath(p),false,p);
 for(const p of ['/index.html','/detail-admin-jik-2026.html','/note-password-admin.js','/downloads/piano.mp3'])assert.equal(publicPath(p),true,p);
});
