'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

for (const file of ['omok.html', 'baduk.html', 'yut.html']) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  assert.match(html, /function handleOnlineRoomClosed\(/, `${file} defines room-closed handler`);
  assert.match(html, /관리자가 이 방을 강제종료했습니다/, `${file} tells user admin terminated the room`);
  assert.match(html, /res\.status === 404/, `${file} handles deleted-room 404 state`);
  assert.match(html, /clearInterval\(NET\.timer\)/, `${file} stops polling after forced termination`);
}

console.log('frontend room closed tests passed');
