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
test('do not repeatedly retry rejected deliveries within an hour', async()=>{
  const now=Date.parse('2026-10-23T02:00:00Z'); let attempts=0;
  const db={devices:[{id:'a',name:'A'}]};
  const service=createLarkReminders({readDb:()=>db,persist:async()=>{},clock:()=>now,env:{LARK_APP_ID:'x',LARK_APP_SECRET:'y'},request:async()=>{attempts++;return {ok:false,status:403,json:async()=>({code:999,msg:'denied'})};}});
  await service.saveRecipient({name:'A',receiveId:'ou_example',idType:'open_id',enabled:true});
  await service.run(); await service.run(); assert.equal(attempts,1);
  assert.match(service.overview().people[0].delivery.error,/denied/);
});
