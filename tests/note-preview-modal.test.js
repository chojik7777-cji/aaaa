'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {publicPath} = require('../server/static-policy');
test('both note pages connect a shared modal and close it on authentication lock', () => {
  for (const file of ['note.html', 'note2.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.match(html, /<script src="\/note-attachment-preview.js\?v=modal80-4"><\/script>/);
    assert.match(html, /NoteAttachmentPreview\??\.create/);
    assert.match(html, /preview\?\.close\(\)/);
    assert.doesNotMatch(html, /data-preview="[^\n]+title="새 (탭|창)에서 열기"/);
  }
  assert.equal(publicPath('/note-attachment-preview.js'), true);
});
