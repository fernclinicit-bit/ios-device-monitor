const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLarkReminders, due } = require('./lark-reminders');
const DAY = 86400000;
test('remind three days before due, stop after verification, restart next cycle', async () => {
  let now = Date.parse('2026-10-23T02:00:00Z'), sends = 0;
  const db = { devices: [{ id:'one', name:'ทดสอบ', deviceNumber:'pc-1', lastVerifiedAt:new Date(now-12*DAY).toISOString() }], logs:[] };
  const service = createLarkReminders({ readDb:()=>db, persist:async()=>{}, clock:()=>now,
    env:{LARK_APP_ID:'test',LARK_APP_SECRET:'test'}, request:async(url, options)=>{
      if (url.includes('tenant_access_token')) return {ok:true,json:async()=>({code:0,tenant_access_token:'token',expire:7200})};
      sends++; const body=JSON.parse(options.body);
      assert.equal(body.receive_id,'test@example.com');
      assert.match(JSON.parse(body.content).text,/\?id=one/);
      return {ok:true,json:async()=>({code:0,data:{message_id:'message'}})};
    } });
  await service.run(); assert.equal(sends,0);
  await service.saveRecipient({name:'ทดสอบ',receiveId:'test@example.com',idType:'email',enabled:true});
  await service.run(); assert.equal(sends,1);
  await service.run(); assert.equal(sends,1);
  now+=DAY; await service.run(); assert.equal(sends,2);
  db.devices[0].lastVerifiedAt=new Date(now).toISOString();
  now+=DAY; await service.run(); assert.equal(sends,2);
  now+=11*DAY; await service.run(); assert.equal(sends,3);
});
test('skip returned devices and preserve pending boundary',()=>{
  const now=Date.now();
  assert.equal(due({lastVerifiedAt:new Date(now-12*DAY+1).toISOString()},now),false);
  assert.equal(due({lastVerifiedAt:new Date(now-12*DAY).toISOString()},now),true);
  assert.equal(due({assignmentStatus:'returned'},now),false);
});
test('one recipient can own multiple name rows and receives all due links together', async () => {
  let now = Date.parse('2026-10-23T02:00:00Z');
  const sent = [];
  const db = { devices: [
    {id:'first',name:'ศรัญญา ( แนน )'},
    {id:'second',name:'ศรัญญา (แนน)'},
    {id:'fresh',name:'ศรัญญา (แนน)',lastVerifiedAt:new Date(now).toISOString()},
    {id:'disabled',name:'แนน ปิดส่ง'}
  ] };
  const service = createLarkReminders({ readDb:()=>db,persist:async()=>{},clock:()=>now,
    env:{LARK_APP_ID:'test',LARK_APP_SECRET:'test'},request:async(url,options)=>{
      if(url.includes('tenant_access_token')) return {ok:true,json:async()=>({code:0,tenant_access_token:'token',expire:7200})};
      sent.push(JSON.parse(JSON.parse(options.body).content).text);
      return {ok:true,json:async()=>({code:0,data:{message_id:'m'}})};
    } });
  for (const name of ['ศรัญญา ( แนน )','ศรัญญา (แนน)','แนน ปิดส่ง']) {
    await service.saveRecipient({name,receiveId:'same-user',idType:'user_id',enabled:name!=='แนน ปิดส่ง'});
  }
  await service.run(); await service.run();
  assert.equal(sent.length,1);
  assert.match(sent[0],/\?id=first/); assert.match(sent[0],/\?id=second/);
  assert.doesNotMatch(sent[0],/\?id=fresh|\?id=disabled/);
  db.devices[0].lastVerifiedAt = new Date(now).toISOString();
  now += DAY; await service.run();
  assert.equal(sent.length,2);
  assert.doesNotMatch(sent[1],/\?id=first/); assert.match(sent[1],/\?id=second/);
});
test('do not repeatedly retry rejected deliveries within an hour', async()=>{
  const now=Date.parse('2026-10-23T02:00:00Z'); let attempts=0;
  const db={devices:[{id:'a',name:'A'}]};
  const service=createLarkReminders({readDb:()=>db,persist:async()=>{},clock:()=>now,env:{LARK_APP_ID:'x',LARK_APP_SECRET:'y'},request:async()=>{attempts++;return {ok:false,status:403,json:async()=>({code:999,msg:'denied'})};}});
  await service.saveRecipient({name:'A',receiveId:'ou_example',idType:'open_id',enabled:true});
  await service.run(); await service.run(); assert.equal(attempts,1);
  assert.match(service.overview().people[0].delivery.error,/denied/);
});
test('storage failure after successful send does not abort the remaining recipients or resend', async () => {
  const now=Date.parse('2026-10-24T03:00:00Z'); let fail=false, sends=0;
  const db={devices:[{id:'a',name:'A'},{id:'b',name:'B'}]};
  const service=createLarkReminders({readDb:()=>db,persist:async()=>{if(fail)throw Error('JSONBin save error: 403');},clock:()=>now,env:{LARK_APP_ID:'a',LARK_APP_SECRET:'s'},request:async url=>{
    if(url.includes('tenant_access_token'))return {ok:true,json:async()=>({code:0,tenant_access_token:'t',expire:7200})};
    sends++;return {ok:true,json:async()=>({code:0,data:{message_id:'m'+sends}})};
  }});
  await service.saveRecipient({name:'A',idType:'user_id',receiveId:'a',enabled:true});
  await service.saveRecipient({name:'B',idType:'user_id',receiveId:'b',enabled:true});
  fail=true; const result=await service.run();
  assert.equal(sends,2);assert.equal(result.results.filter(r=>r.sent).length,2);
  assert(result.results.every(r=>r.storageError));
  await service.run();assert.equal(sends,2);
  assert.equal(Object.keys(db.larkReminders.delivery).length,2);
});
test('recover successful deliveries and only newer device checks before retrying', async () => {
  const now=Date.parse('2026-10-24T03:00:00Z');let sends=0;
  const db={devices:[{id:'a',name:'A',lastVerifiedAt:'2026-10-01T00:00:00Z'}]};
  const service=createLarkReminders({readDb:()=>db,persist:async()=>{},clock:()=>now,env:{LARK_APP_ID:'a',LARK_APP_SECRET:'s'},request:async()=>{sends++;throw Error('must not send');}});
  await service.recover({people:[{name:'A',recipient:{receiveId:'a',idType:'user_id',enabled:true},delivery:{day:'2026-10-24',sentAt:'2026-10-24T01:00:00Z',count:1,messageId:'om_saved'}}],deviceChecks:[{id:'a',lastVerifiedAt:'2026-10-24T02:00:00Z'}]});
  assert.equal(service.overview().people[0].delivery.messageId,'om_saved');
  assert.equal(db.devices[0].lastVerifiedAt,'2026-10-24T02:00:00.000Z');
  await service.recover({deviceChecks:[{id:'a',lastVerifiedAt:'2026-10-01T00:00:00Z'}]});
  await service.run();assert.equal(sends,0);
  assert.equal(db.devices[0].lastVerifiedAt,'2026-10-24T02:00:00.000Z');
});
