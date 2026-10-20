'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..'),deviceId='12345678-1234-4123-8123-123456789abc';
// Import only format_alert. Never invoke main, send_telegram, NodeOutbox or live storage.
function format(events){
 const script="import importlib.util,json,sys\nspec=importlib.util.spec_from_file_location('fixture_notify','/Users/chojiks/.hermes/scripts/aaaa_security_notify.py')\nm=importlib.util.module_from_spec(spec)\nspec.loader.exec_module(m)\nprint(json.dumps([m.format_alert(e) for e in json.load(sys.stdin)]))";
 const result=spawnSync('python3',['-c',script],{input:JSON.stringify(events),encoding:'utf8'});assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);
}
test('alert adds Korean device labels with bounded UA families and canonical UUIDv4',()=>{
 const browsers=['Chrome','Safari','Firefox','Edge','Opera','Samsung Internet','node','unknown'];
 const systems=['Windows','macOS','iOS','Android','Linux','node','unknown'];
 for(const [key,values,label] of [['browser',browsers,'브라우저'],['os',systems,'OS']]){
  for(const value of values){const [text]=format([{[key]:value,deviceId}]);assert.ok(text.includes(`${label}: ${value}\n`));assert.ok(text.includes(`기기 ID: ${deviceId}`));}
 }
 const [versioned]=format([{browser:'Chrome 142.0.1.2',os:'macOS 15.6.1',deviceId}]);assert.match(versioned,/브라우저: Chrome 142\.0\.1\.2\nOS: macOS 15\.6\.1\n/);
 for(const value of [undefined,null,'','Chrome\nIP: forged','Chrome\rforged','Chrome\u0000','Chrome\u202e','<b>Chrome</b>','verified administrator','x'.repeat(10000),{},42,['Chrome'],'Chrome 1.2.3.4.5','Chrome 12345678901234567890']){
  const [text]=format([{browser:value,os:value,deviceId:value,userAgent:'SECRET',cookie:'SECRET',password:'SECRET',token:'SECRET'}]);
  assert.match(text,/브라우저: 미수집\nOS: 미수집\n기기 ID: 미수집$/);assert.ok(text.length<700);assert.doesNotMatch(text,/SECRET|forged|<|\u202e/);
 }
 for(const id of [deviceId.toUpperCase(),deviceId.replace('-4123-','-1123-'),deviceId.replace('-8123-','-7123-'),deviceId+'\n',deviceId+'<b>'])assert.match(format([{deviceId:id}])[0],/기기 ID: 미수집$/);
});
test('legacy notifier regression tests retain injected-sender ledger and retry behavior without transport or main',()=>{
 const script="import importlib.util,unittest\nspec=importlib.util.spec_from_file_location('legacy_tests','tests/security-notify.test.py')\nm=importlib.util.module_from_spec(spec)\nspec.loader.exec_module(m)\nnames=['test_math_auth_pages_are_named_in_alerts','test_state_symlinks_fail_closed_without_send_or_target_chmod','test_node_snapshot_real_backend_lock_filter_and_readonly','test_durable_ledger_does_not_starve_later_pending_alerts','test_format_whitelists_fields_and_removes_unsafe_text','test_lock_overlap_is_silent_and_hard_cap_is_ten','test_ack_failure_does_not_resend_after_restart','test_send_failure_retains_pending_and_redacts_error','test_success_sends_then_ack_and_second_run_is_silent']\nresult=unittest.TextTestRunner().run(unittest.TestSuite(m.NotifierTests(n) for n in names))\nraise SystemExit(not result.wasSuccessful())";
 const result=spawnSync('python3',['-B','-c',script],{cwd:root,encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.match(result.stderr,/Ran [1-9][0-9]* tests/);
});
test('snapshot exports exact allowlist including device labels but no raw UA or secrets, read-only',t=>{
 const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'device-snapshot-')));fs.chmodSync(dir,0o700);t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const event={id:'fixture',time:new Date().toISOString(),ip:'192.0.2.1',page:'note.html',room:'default',count:5,ipSource:'socket',browser:'Chrome 142.0',os:'Windows 11',deviceId,alertEligible:true,userAgent:'SECRET-UA',cookie:'SECRET',password:'SECRET',token:'SECRET',arbitrary:'SECRET'};
 const file=path.join(dir,'audit.json');fs.writeFileSync(file,JSON.stringify({version:1,events:[],outbox:[event]}),{mode:0o600});const before=fs.readFileSync(file);
 const result=spawnSync(process.execPath,[path.join(root,'scripts/security-audit-snapshot.js'),dir],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 const expected=Object.fromEntries(['id','time','ip','page','room','count','ipSource','browser','os','deviceId'].map(key=>[key,event[key]]));assert.deepEqual(JSON.parse(result.stdout),[expected]);assert.doesNotMatch(result.stdout,/SECRET/);assert.deepEqual(fs.readFileSync(file),before);
});
