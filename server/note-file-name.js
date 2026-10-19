'use strict';
const path = require('node:path');
// Reject rather than sanitize: a rename must describe exactly one public filename.
function renameFileName(name, original, maxLength) {
  if (typeof name !== 'string' || !name.trim() || name.length > maxLength ||
      Buffer.byteLength(name, 'utf8') > 255 || /^[.]/.test(name) ||
      /[\x00-\x1f\x7f-\x9f/\\:]/.test(name) || name.includes('..') ||
      name.toLowerCase() === 'backup' ||
      path.extname(name).toLowerCase() !== path.extname(original).toLowerCase()) {
    throw Object.assign(new Error('파일 이름과 기존 확장자를 확인해 주세요.'), { status: 400 });
  }
  return name;
}
module.exports = { renameFileName };
