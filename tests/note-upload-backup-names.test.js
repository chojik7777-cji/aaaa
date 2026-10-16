'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {preserveUploadCopy}=require('../server/note-upload-backup');
test('archive filenames use Korean date/time before extension and no-clobber same-second suffix',t=>{
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'note-backup-names-')));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const date=new Date('2026-10-16T19:55:30+09:00');
 const first=preserveUploadCopy(root,'자료.pdf',Buffer.from('first'),date),second=preserveUploadCopy(root,'자료.pdf',Buffer.from('second'),date),third=preserveUploadCopy(root,'자료.pdf',Buffer.from('third'),date);
 assert.equal(path.basename(first),'자료_20261016_195530.pdf');assert.equal(path.basename(second),'자료_20261016_195530_001.pdf');assert.equal(path.basename(third),'자료_20261016_195530_002.pdf');
 assert.equal(fs.readFileSync(first,'utf8'),'first');assert.equal(fs.readFileSync(second,'utf8'),'second');assert.equal(fs.readFileSync(third,'utf8'),'third');
 assert.equal(path.basename(preserveUploadCopy(root,'README',Buffer.from('no extension'),date)),'README_20261016_195530');
 assert.equal(path.basename(preserveUploadCopy(root,'archive.tar.gz',Buffer.from('compound'),date)),'archive.tar_20261016_195530.gz');
 const long=preserveUploadCopy(root,'가'.repeat(80)+'.pdf',Buffer.from('long Korean filename'),date);
 assert.ok(Buffer.byteLength(path.basename(long),'utf8')<=255);assert.match(path.basename(long),/_20261016_195530\.pdf$/);
});
