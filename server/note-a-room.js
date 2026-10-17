'use strict';
const fs=require('node:fs'),path=require('node:path');
const {roomId,existingRoom}=require('./note-room');
function noteRoot(env=process.env){return path.resolve(env.NOTE_DIR||path.join(__dirname,'..','note','family'));}
function existingNoteRoom(root,room){
 roomId(room);root=path.resolve(root);
 try{const st=fs.lstatSync(root);if(st.isSymbolicLink()||!st.isDirectory()||fs.realpathSync(root)!==root)throw {status:400};}catch(e){if(e.code!=='ENOENT')throw e;}
 // note A's default is the root itself, never ROOT/default.
 return room==='default'?true:existingRoom(root,room);
}
function listNoteRooms(root){
 existingNoteRoom(root,'default');let names=[];try{names=fs.readdirSync(root);}catch(e){if(e.code!=='ENOENT')throw e;}
 return ['default',...names.filter(name=>{if(name==='default')return false;try{return existingNoteRoom(root,name);}catch{return false;}})].sort();
}
module.exports={noteRoot,existingNoteRoom,listNoteRooms};
