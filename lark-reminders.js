const { createHash } = require('node:crypto');
const DAY = 86400000;
const normalizeName = value => String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
function due(device, now) {
  if (device.assignmentStatus === 'returned') return false;
  const last = Date.parse(device.lastVerifiedAt);
  return !Number.isFinite(last) || now - last >= 12 * DAY;
}
function bangkokDay(now) { return new Date(now + 7 * 3600000).toISOString().slice(0, 10); }
const recipientKey = recipient => `recipient:${recipient.idType}:${recipient.receiveId}`;

function createLarkReminders({ readDb, persist, env = process.env, request = fetch, clock = Date.now }) {
  let token = '', tokenUntil = 0, running = false;
  const baseUrl = (env.PUBLIC_BASE_URL || 'https://ios-device-monitor-46w9.onrender.com').replace(/\/$/, '');
  async function api(path, body, auth) {
    const response = await request('https://open.larksuite.com/open-apis/' + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
      body: JSON.stringify(body), signal: AbortSignal.timeout(15000)
    });
    const data = await response.json();
    if (!response.ok || data.code !== 0) throw new Error(`Lark ${data.code || response.status}: ${data.msg || 'request failed'}`);
    return data;
  }
  async function accessToken() {
    if (!env.LARK_APP_ID || !env.LARK_APP_SECRET) throw new Error('ยังไม่ได้ตั้ง LARK_APP_ID / LARK_APP_SECRET');
    if (clock() < tokenUntil) return token;
    const result = await api('auth/v3/tenant_access_token/internal', { app_id: env.LARK_APP_ID, app_secret: env.LARK_APP_SECRET });
    token = result.tenant_access_token;
    tokenUntil = clock() + Math.max(0, Number(result.expire) - 120) * 1000;
    return token;
  }
  function state(db) {
    return db.larkReminders ||= { recipients: {}, delivery: {} };
  }
  function overview() {
    const db = readDb(), config = state(db), now = clock();
    const groups = new Map();
    for (const d of db.devices) {
      const name = normalizeName(d.userName || d.name);
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(d);
    }
    return { configured: !!(env.LARK_APP_ID && env.LARK_APP_SECRET), schedule: '09:00 Asia/Bangkok ทุกวัน เริ่มก่อนกำหนด 3 วัน',
      people: [...groups].map(([name, devices]) => ({ name, recipient: config.recipients[name] || null,
        dueCount: devices.filter(d => due(d, now)).length, total: devices.length,
        delivery: (config.recipients[name] && config.delivery[recipientKey(config.recipients[name])]) || config.delivery[name] || null })) };
  }
  async function saveRecipient({ name, receiveId, idType, enabled }) {
    const db = readDb(), key = normalizeName(name);
    if (!db.devices.some(d => normalizeName(d.userName || d.name) === key)) throw new Error('ไม่พบชื่อในทะเบียน');
    if (!['email', 'open_id', 'user_id'].includes(idType)) throw new Error('ประเภทบัญชีไม่ถูกต้อง');
    receiveId = String(receiveId || '').trim();
    if (!receiveId || receiveId.length > 254 || (idType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receiveId))) throw new Error('กรุณาระบุบัญชี Lark ให้ถูกต้อง');
    const config = state(db);
    config.recipients[key] = { receiveId, idType, enabled: enabled === true };
    await persist(db);
  }
  async function run({ scheduled = true } = {}) {
    if (running) return { skipped: 'already-running' };
    const now = clock();
    if (scheduled && new Date(now + 7 * 3600000).getUTCHours() < 9) return { skipped: 'before-09:00' };
    if (!env.LARK_APP_ID || !env.LARK_APP_SECRET) return { skipped: 'not-configured' };
    running = true;
    const results = [];
    try {
      const day = bangkokDay(now), people = overview().people;
      const groups = new Map();
      for (const person of people) {
        const recipient = state(readDb()).recipients[person.name];
        if (!recipient?.enabled) continue;
        const key = recipientKey(recipient);
        if (!groups.has(key)) groups.set(key, { recipient, names: [] });
        groups.get(key).names.push(person.name);
      }
      for (const [key, { recipient, names }] of groups) {
        const db = readDb(), config = state(db);
        // Respect delivery history written by the earlier per-name implementation too.
        const history = [config.delivery[key], ...names.map(name => config.delivery[name])].filter(Boolean);
        if (history.some(entry => entry.day === day)) continue;
        if (history.some(entry => now - Date.parse(entry.attemptedAt) < 3600000)) continue;
        // Read current verification state immediately before sending, not the earlier snapshot.
        const devices = db.devices.filter(d => {
          const name = normalizeName(d.userName || d.name), current = config.recipients[name];
          return names.includes(name) && current?.enabled && recipientKey(current) === key && due(d, clock());
        });
        if (!devices.length) continue;
        const lines = devices.map(d => `${d.deviceNumber || 'ไม่ระบุหมายเลข'}\n${baseUrl}/?id=${encodeURIComponent(d.id)}`);
        const text = `แจ้งเตือนยืนยันอุปกรณ์: ${names[0]}\nกรุณาเปิดลิงก์ของแต่ละอุปกรณ์และกดยืนยันการใช้งาน\n\n${lines.join('\n\n')}\n\nระบบจะหยุดเตือนรายการที่ยืนยันแล้ว จนถึงรอบถัดไป`;
        try {
          const auth = await accessToken();
          const uuid = createHash('sha256').update(`${day}:${recipient.idType}:${recipient.receiveId}`).digest('hex').slice(0, 32);
          const message = await api(`im/v1/messages?receive_id_type=${recipient.idType}`, { receive_id: recipient.receiveId, msg_type: 'text', content: JSON.stringify({ text }), uuid }, auth);
          const delivery = { day, sentAt: new Date(clock()).toISOString(), count: devices.length, messageId: message.data?.message_id };
          config.delivery[key] = delivery;
          for (const name of names) config.delivery[name] = delivery;
          await persist(db);
          results.push({ name: names[0], names, sent: true });
        } catch (error) {
          config.delivery[key] = { ...config.delivery[key], error: error.message, attemptedAt: new Date(clock()).toISOString() };
          for (const name of names) config.delivery[name] = config.delivery[key];
          await persist(db);
          results.push({ name: names[0], names, sent: false, error: error.message });
        }
      }
      return { results };
    } finally { running = false; }
  }
  return { overview, saveRecipient, run, testConnection: async () => { await accessToken(); return { ok: true }; } };
}
module.exports = { createLarkReminders, due, bangkokDay, normalizeName };
