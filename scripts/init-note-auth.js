#!/usr/bin/env node
'use strict';
// Local operator entry point only. Existing store is validated, never reset.
const {initialize}=require('../server/note-local');
if(require.main===module){
 if(!process.argv.includes('--initialize')){console.error('사용법: node scripts/init-note-auth.js --initialize (기존 Mac 비밀번호 유지, 로컬 저장소만 생성)');process.exitCode=1;}
 else initialize().then(created=>console.log(created?'맥미니 로컬 인증 저장소를 생성했습니다. 기존 비밀번호는 유지됩니다. 이전 노트 토큰은 다시 로그인해야 합니다.':'기존 로컬 저장소를 확인했습니다. 비밀번호는 변경하지 않았습니다.')).catch(()=>{console.error('초기화 실패: 기존 관리자 파일, 저장소 경로/권한을 확인해 주세요. 비밀 값은 출력하지 않습니다.');process.exitCode=1;});
}
module.exports={initialize};
