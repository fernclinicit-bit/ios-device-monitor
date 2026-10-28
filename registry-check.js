const normalizeSerial = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const normalizeOwner = value => String(value || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();
function unavailable(message) {
  const error = new Error('งดส่ง: ตรวจทะเบียนต้นทางไม่ได้ — ' + message);
  error.code = 'SOURCE_UNAVAILABLE'; return error;
}
function validateRegistry(devices, snapshot, now = Date.now()) {
  if (!snapshot || !Array.isArray(snapshot.assets) || !Number.isFinite(Date.parse(snapshot.generatedAt))) throw unavailable('รูปแบบข้อมูลไม่ถูกต้อง');
  const age = now - Date.parse(snapshot.generatedAt);
  if (age > 30000 || age < -5000) throw unavailable('ข้อมูลไม่ใช่ชุดล่าสุด');
  const index = new Map();
  for (const row of snapshot.assets) {
    const key = normalizeSerial(row.deviceNumber);
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(row);
  }
  const allowed = [], blocked = [];
  for (const device of devices) {
    const serial = String(device.deviceNumber || '').trim();
    const key = normalizeSerial(serial), owner = normalizeOwner(device.userName || device.name);
    const rows = index.get(key) || [];
    let reason;
    if (!key || /^(?:ไม่มีหมายเลข|ไม่ระบุ|no\s*number)/i.test(serial)) reason = 'ไม่มีหมายเลขอุปกรณ์ที่ตรวจสอบได้';
    else if (device.assignmentStatus === 'returned') reason = 'ปลายทางระบุว่าคืนแล้ว';
    else if (!rows.length) reason = 'ไม่พบหมายเลขนี้ในต้นทาง';
    else if (rows.length !== 1) reason = 'หมายเลขซ้ำในต้นทาง ต้องตรวจสอบก่อน';
    else if (String(rows[0].status || '').trim() !== 'ใช้งาน') reason = 'ต้นทางไม่ได้อยู่ในสถานะใช้งาน';
    else if (!owner || normalizeOwner(rows[0].userName) !== owner) reason = 'ผู้ถือครองไม่ตรงกับต้นทาง';
    if (reason) blocked.push({ id: device.id, deviceNumber: serial, name: device.userName || device.name || '', reason });
    else allowed.push({ ...device });
  }
  return { devices: allowed, blocked, generatedAt: snapshot.generatedAt, sourceCount: snapshot.assets.length };
}
function createRegistryCheck({ env = process.env, request = fetch, clock = Date.now } = {}) {
  return async devices => {
    const token = env.IOS_DASHBOARD_SYNC_TOKEN;
    if (!token) throw unavailable('ยังไม่ได้ตั้ง integration token');
    try {
      const response = await request('https://it-monthly-dashboard-new.onrender.com/internal/device-registry', {
        headers: { 'x-integration-token': token, 'Cache-Control': 'no-cache' },
        redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20000)
      });
      if (!response.ok) throw unavailable('ต้นทางตอบ HTTP ' + response.status);
      return validateRegistry(devices, await response.json(), clock());
    } catch (error) {
      if (error.code === 'SOURCE_UNAVAILABLE') throw error;
      throw unavailable('การเชื่อมต่อล้มเหลว');
    }
  };
}
module.exports = { createRegistryCheck, validateRegistry, normalizeSerial, normalizeOwner };
