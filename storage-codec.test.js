const { test } = require('node:test');
const assert = require('node:assert/strict');
const { encodeDb, decodeDb } = require('./storage-codec');
test('cloud archive preserves every log, order, Thai text and device verification', () => {
  const db={devices:[{id:'1',lastVerifiedAt:'2026-10-27T01:00:00Z'}],logs:Array.from({length:100},(_,i)=>({action:'ยืนยันอุปกรณ์ ที่อยู่ กรุงเทพมหานคร '+i,timestamp:String(i)}))};
  const encoded=encodeDb(db);
  assert.equal(encoded.logs.length,20);
  assert.deepEqual(decodeDb(JSON.parse(JSON.stringify(encoded))),db);
  assert.equal(db.logs.length,100);
  assert(JSON.stringify(encoded).length<JSON.stringify(db).length);
});
test('legacy cloud data without an archive still loads unchanged', () => {
  const db={devices:[],logs:[]};assert.deepEqual(decodeDb(db),db);
});
