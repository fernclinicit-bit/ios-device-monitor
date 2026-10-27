const { gzipSync, gunzipSync } = require('node:zlib');
// Keep recent logs readable in cloud storage and archive older entries losslessly.
function encodeDb(db) {
  const raw = JSON.stringify(db);
  if (Buffer.byteLength(raw, 'utf8') > 80000) {
    return { _storageFormat: 'gzip-v1', _dbGzip: gzipSync(Buffer.from(raw, 'utf8')).toString('base64') };
  }
  if (!Array.isArray(db.logs) || db.logs.length <= 20) return db;
  return { ...db, logs: db.logs.slice(0, 20),
    _olderLogsGzip: gzipSync(Buffer.from(JSON.stringify(db.logs.slice(20)), 'utf8')).toString('base64') };
}
function decodeDb(db) {
  if (db._storageFormat === 'gzip-v1' && db._dbGzip) {
    return decodeDb(JSON.parse(gunzipSync(Buffer.from(db._dbGzip, 'base64'), { maxOutputLength: 20 * 1024 * 1024 }).toString('utf8')));
  }
  if (!db._olderLogsGzip) return db;
  const older = JSON.parse(gunzipSync(Buffer.from(db._olderLogsGzip, 'base64'), { maxOutputLength: 20 * 1024 * 1024 }).toString('utf8'));
  if (!Array.isArray(older)) throw new Error('Invalid cloud log archive');
  const { _olderLogsGzip, ...rest } = db;
  return { ...rest, logs: [...(db.logs || []), ...older] };
}
module.exports = { encodeDb, decodeDb };

