const { gzipSync, gunzipSync } = require('node:zlib');
// Keep recent logs readable in cloud storage and archive older entries losslessly.
function encodeDb(db) {
  if (!Array.isArray(db.logs) || db.logs.length <= 20) return db;
  return { ...db, logs: db.logs.slice(0, 20),
    _olderLogsGzip: gzipSync(Buffer.from(JSON.stringify(db.logs.slice(20)), 'utf8')).toString('base64') };
}
function decodeDb(db) {
  if (!db._olderLogsGzip) return db;
  const older = JSON.parse(gunzipSync(Buffer.from(db._olderLogsGzip, 'base64'), { maxOutputLength: 20 * 1024 * 1024 }).toString('utf8'));
  if (!Array.isArray(older)) throw new Error('Invalid cloud log archive');
  const { _olderLogsGzip, ...rest } = db;
  return { ...rest, logs: [...(db.logs || []), ...older] };
}
module.exports = { encodeDb, decodeDb };
