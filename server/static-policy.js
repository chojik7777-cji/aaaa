'use strict';
// Shared allowlist for Mac static responses and the Vercel build output.
function publicPath(p) {
 return /^\/[a-z0-9][a-z0-9-]*\.html$/.test(p) || p === '/note-password-admin.js' || p === '/note-attachment-preview.js' || p === '/game-transfer.js' || /^\/downloads\/[^/\\.][^/\\]*\.(mp3|mp4|png|jpe?g|webp|pdf)$/.test(p) && !p.includes('..');
}
module.exports={publicPath};
