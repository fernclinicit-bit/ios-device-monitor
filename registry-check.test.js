const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateRegistry, createRegistryCheck } = require('./registry-check');
const { createLarkReminders } = require('./lark-reminders');
const now = Date.parse('2026-10-28T02:00:00Z');
const snapshot = assets => ({ generatedAt: new Date(now).toISOString(), assets });
const device = { id:'mouse',deviceNumber:'MOS-002',name:'อำพล แซ่แฮ' };
test('returned or vacant source item never receives a reminder', () => {
  const result=validateRegistry([device],snapshot([{deviceNumber:'mos-002',userName:device.name,status:'ว่าง'}]),now);
  assert.equal(result.devices.length,0);assert.match(result.blocked[0].reason,/ไม่ได้อยู่ในสถานะใช้งาน/);
});
test('correct serial, owner and in-use state match; wrong owner is blocked', () => {
  const source=snapshot([{deviceNumber:'mos-002',userName:device.name,status:'ใช้งาน'}]);
  assert.equal(validateRegistry([device],source,now).devices.length,1);
  assert.equal(validateRegistry([{...device,name:'คนอื่น'}],source,now).devices.length,0);
});
test('duplicate serial, missing serial and stale snapshot are not trusted', () => {
  const row={deviceNumber:'mos-002',userName:device.name,status:'ใช้งาน'};
  assert.equal(validateRegistry([device],snapshot([row,row]),now).devices.length,0);
  assert.equal(validateRegistry([{...device,deviceNumber:'ไม่มีหมายเลข อุปกรณ์'}],snapshot([]),now).devices.length,0);
  assert.throws(()=>validateRegistry([device],snapshot([row]),now+31000),/ข้อมูลไม่ใช่ชุดล่าสุด/);
});
test('source unavailable stops delivery, even when Lark credentials work', async () => {
  let sends=0;const db={devices:[device]};
  const request=async url=>{
    if(url.includes('tenant_access_token'))return {ok:true,json:async()=>({code:0,tenant_access_token:'t',expire:7200})};
    if(url.includes('/internal/device-registry'))return {ok:false,status:503};
    sends++;throw Error('must not send');
  };
  const service=createLarkReminders({readDb:()=>db,persist:async()=>{},clock:()=>now,env:{LARK_APP_ID:'x',LARK_APP_SECRET:'y',IOS_DASHBOARD_SYNC_TOKEN:'test'},request});
  await service.saveRecipient({name:device.name,receiveId:'user',idType:'user_id',enabled:true});
  const result=await service.run();assert.equal(sends,0);assert.match(result.results[0].error,/ตรวจทะเบียนต้นทางไม่ได้/);
});
test('no integration token fails closed without any source request', async () => {
  let calls=0;const check=createRegistryCheck({env:{},request:async()=>{calls++;}});
  await assert.rejects(()=>check([device]),/integration token/);assert.equal(calls,0);
});
test('each recipient gets a fresh source check; a newly returned item is excluded', async () => {
  const db={devices:[{id:'a',name:'A',deviceNumber:'pc-1'},{id:'b',name:'B',deviceNumber:'pc-2'}]};
  let reads=0;const sends=[];
  const request=async(url,options)=>{
    if(url.includes('tenant_access_token'))return {ok:true,json:async()=>({code:0,tenant_access_token:'t',expire:7200})};
    if(url.includes('/internal/device-registry')){reads++;return {ok:true,json:async()=>snapshot([
      {deviceNumber:'pc-1',userName:'A',status:'ใช้งาน'},
      {deviceNumber:'pc-2',userName:'B',status:reads===1?'ใช้งาน':'ว่าง'}
    ])};}
    sends.push(JSON.parse(options.body).receive_id);return {ok:true,json:async()=>({code:0,data:{message_id:'om_test'}})};
  };
  const service=createLarkReminders({readDb:()=>db,persist:async()=>{},clock:()=>now,env:{LARK_APP_ID:'x',LARK_APP_SECRET:'y',IOS_DASHBOARD_SYNC_TOKEN:'test'},request});
  await service.saveRecipient({name:'A',receiveId:'a',idType:'user_id',enabled:true});
  await service.saveRecipient({name:'B',receiveId:'b',idType:'user_id',enabled:true});
  const result=await service.run();assert.equal(reads,2);assert.deepEqual(sends,['a']);assert(result.results.some(r=>r.blocked?.length));
});
