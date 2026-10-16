'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Returns the absolute archive path; an existing version is never overwritten.
function preserveUploadCopy(dir, name, buffer, now = new Date()) {
  if (typeof name !== 'string' || !name || name.startsWith('.') || /[\\/\\\\\0\r\n]/.test(name) || path.basename(name) !== name) {
    throw new Error('Invalid archive filename');
  }
  if (!Buffer.isBuffer(buffer)) throw new TypeError('Archive data must be a Buffer');
  dir = path.resolve(dir);
  // Canonicalize the parent so macOS /var -> /private/var is accepted,
  // but reject a room directory that itself redirects elsewhere.
  const source = fs.lstatSync(dir);
  const canonical = path.join(fs.realpathSync(path.dirname(dir)), path.basename(dir));
  if (!source.isDirectory() || source.isSymbolicLink() || fs.realpathSync(dir) !== canonical) throw new Error('Unsafe source directory');
  const backup = path.join(canonical, 'backup');
  try { fs.mkdirSync(backup, { mode: 0o700 }); } catch (e) { if (e.code !== 'EEXIST') throw e; }
  const stat = fs.lstatSync(backup);
  if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(backup) !== backup) throw new Error('Unsafe backup directory');
  const fd = fs.openSync(backup, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
  try { fs.fchmodSync(fd, 0o700); } finally { fs.closeSync(fd); }
  const ext = path.extname(name), base = name.slice(0, name.length - ext.length);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(now)).map(p => [p.type, p.value]));
  const stamp = `${parts.year}${parts.month}${parts.day}_${parts.hour}${parts.minute}${parts.second}`;
  for (let i = 0; ; i++) {
    const suffix = `_${stamp}${i ? '_' + String(i).padStart(3, '0') : ''}${ext}`;
    if (Buffer.byteLength(suffix, 'utf8') >= 255) throw new Error('Archive extension is too long');
    let stem = base;
    while (Buffer.byteLength(stem + suffix, 'utf8') > 255) stem = Array.from(stem).slice(0, -1).join('');
    const file = path.join(backup, stem + suffix);
    try {
      fs.writeFileSync(file, buffer, { mode: 0o600, flag: fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW });
      return file;
    } catch (e) { if (e.code !== 'EEXIST') throw e; }
  }
}
module.exports = { preserveUploadCopy };
