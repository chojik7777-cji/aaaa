'use strict';

// 공유노트 첨부파일 미리보기(inline=1)용 응답 헤더
// - 사진·PDF·영상·음악·텍스트만 브라우저 안에서 열고, 나머지(html, svg 등)는 항상 다운로드로 처리
//   (올린 파일이 같은 사이트에서 스크립트로 실행되지 않게)

const INLINE_TYPES = /^(image\/(jpeg|png|gif|webp|bmp|heic)|application\/pdf|video\/(mp4|webm|quicktime)|audio\/(mpeg|mp4|wav|x-wav|ogg|webm|aac|x-m4a)|text\/plain)$/i;
const EXT_TYPES = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', heic: 'image/heic',
  pdf: 'application/pdf', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', aac: 'audio/aac',
  txt: 'text/plain', md: 'text/plain', csv: 'text/plain', log: 'text/plain',
};

function baseType(type) { return String(type || '').split(';')[0].trim().toLowerCase(); }
function typeFor(name, type) {
  const ext = String(name || '').split('.').pop().toLowerCase();
  return EXT_TYPES[ext] || baseType(type) || 'application/octet-stream';
}

// wantInline이면서 안전한 종류일 때만 inline, 그 외에는 attachment
// 미리보기는 파일 확장자가 안전한 종류일 때만 (올린 사람이 보낸 type은 믿지 않음)
function fileHeaders(name, type, wantInline) {
  const ext = String(name || '').includes('.') ? String(name).split('.').pop().toLowerCase() : '';
  const t = typeFor(name, type);
  const inline = !!wantInline && !!EXT_TYPES[ext] && INLINE_TYPES.test(t);
  return {
    'Content-Type': inline ? (t === 'text/plain' ? 'text/plain; charset=utf-8' : t) : (baseType(type) || t),
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(name)}`,
    'X-Content-Type-Options': 'nosniff',
  };
}

module.exports = { fileHeaders, typeFor, INLINE_TYPES };
