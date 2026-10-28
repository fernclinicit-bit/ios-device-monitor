const { createHash } = require('node:crypto');
const { createRegistryCheck, normalizeSerial, normalizeOwner } = require('./registry-check');
const DAY = 86400000;
const normalizeName = value => String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
function due(device, now) {
  if (device.assignmentStatus === 'returned') return false;
  const last = Date.parse(device.lastVerifiedAt);
  return !Number.isFinite(last) || now - last >= 12 * DAY;
}
function bangkokDay(now) { return new Date(now + 7 * 3600000).toISOString().slice(0, 10); }
const recipientKey = recipient => `recipient:${recipient.idType}:${recipient.receiveId}`;

function createLarkReminders({ readDb, persist, env = process.env, request = fetch, clock = Date.now, checkSource }) {
  const registryCheck = checkSource || createRegistryCheck({ env, request, clock });
  let sourceCheck = null;
  async function checkedSource(devices) {
    try {
      const result = await registryCheck(devices);
      sourceCheck = { checkedAt: new Date(clock()).toISOString(), matched: result.devices.length, blocked: result.blocked, sourceCount: result.sourceCount, ok: true };
      return result;
    } catch (error) {
      sourceCheck = { checkedAt: new Date(clock()).toISOString(), ok: false, error: error.message };
      throw error;
    }
  }
  let token = '', tokenUntil = 0, running = false, summaryRunning = false;
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
    const config = db.larkReminders ||= { recipients: {}, delivery: {} };
    // Migrate legacy per-name copies into one record per destination account.
    for (const [name, recipient] of Object.entries(config.recipients)) {
      const legacy = config.delivery[name];
      if (!legacy) continue;
      const key = recipientKey(recipient), existing = config.delivery[key];
      if (!existing || Date.parse(legacy.sentAt || legacy.attemptedAt) > Date.parse(existing.sentAt || existing.attemptedAt)) config.delivery[key] = legacy;
      delete config.delivery[name];
    }
    return config;
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
      summaryDelivery: config.summaryDelivery || null,
      sourceCheck,
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
        const selectDueDevices = () => readDb().devices.filter(d => {
          const name = normalizeName(d.userName || d.name), current = config.recipients[name];
          return names.includes(name) && current?.enabled && recipientKey(current) === key && due(d, clock());
        });
        if (!selectDueDevices().length) continue;
        try {
          const auth = await accessToken();
          // Always fetch authoritative current inventory before each message.
          const checked = await checkedSource(selectDueDevices());
          const devices = selectDueDevices().filter(d => checked.devices.some(v => v.id === d.id && normalizeSerial(v.deviceNumber) === normalizeSerial(d.deviceNumber) && normalizeOwner(v.userName || v.name) === normalizeOwner(d.userName || d.name)));
          if (checked.blocked.length) results.push({ name: names[0], sent: false, skipped: true, error: 'งดรายการที่ไม่ตรงต้นทาง', blocked: checked.blocked });
          if (!devices.length) continue;
          const lines = devices.map(d => `${d.deviceNumber || 'ไม่ระบุหมายเลข'}\n${baseUrl}/?id=${encodeURIComponent(d.id)}`);
          const text = `แจ้งเตือนยืนยันอุปกรณ์: ${names[0]}\nกรุณาเปิดลิงก์ของแต่ละอุปกรณ์และกดยืนยันการใช้งาน\n\n${lines.join('\n\n')}\n\nระบบจะหยุดเตือนรายการที่ยืนยันแล้ว จนถึงรอบถัดไป`;
          const uuid = createHash('sha256').update(`${day}:${recipient.idType}:${recipient.receiveId}`).digest('hex').slice(0, 32);
          const message = await api(`im/v1/messages?receive_id_type=${recipient.idType}`, { receive_id: recipient.receiveId, msg_type: 'text', content: JSON.stringify({ text }), uuid }, auth);
          const delivery = { day, sentAt: new Date(clock()).toISOString(), count: devices.length, messageId: message.data?.message_id };
          config.delivery[key] = delivery;
          // A storage failure is not a Lark delivery failure. Keep the successful
          // message ID in memory and continue with other recipients.
          try {
            await persist(db);
            results.push({ name: names[0], names, sent: true });
          } catch (storageError) {
            results.push({ name: names[0], names, sent: true, storageError: storageError.message });
          }
        } catch (error) {
          config.delivery[key] = { ...config.delivery[key], error: error.message, attemptedAt: new Date(clock()).toISOString() };
          let storageError;
          try { await persist(db); } catch (err) { storageError = err.message; }
          results.push({ name: names[0], names, sent: false, error: error.message, ...(storageError ? { storageError } : {}) });
          if (error.code === 'SOURCE_UNAVAILABLE') break;
        }
      }
      return { results };
    } finally { running = false; }
  }
  async function sendSummary({ scheduled = true } = {}) {
    if (summaryRunning) return { skipped: 'กำลังส่งรายงาน' };
    const now = clock(), day = bangkokDay(now);
    if (scheduled && new Date(now + 7 * 3600000).getUTCHours() < 9) return { skipped: 'ยังไม่ถึง 09:00 น.' };
    const db = readDb(), config = state(db);
    if (config.summaryDelivery?.day === day) return { skipped: 'ส่งรายงานให้อำพลแล้ววันนี้', delivery: config.summaryDelivery };
    if (now - Date.parse(config.summaryDelivery?.attemptedAt) < 3600000) return { skipped: 'รอลองส่งรายงานใหม่หลังข้อผิดพลาด 1 ชั่วโมง' };
    summaryRunning = true;
    try {
      const checked = await checkedSource(db.devices);
      if (checked.blocked.length) throw new Error(`งดรายงานสรุป: มี ${checked.blocked.length} รายการไม่ตรงทะเบียนต้นทาง กรุณาตรวจสอบก่อน`);
      const counts = { active: 0, pending: 0, unverified: 0, overdue: 0 }, followUp = new Map();
      for (const device of db.devices) {
        const age = now - Date.parse(device.lastVerifiedAt);
        const status = !Number.isFinite(age) ? 'unverified' : age >= 15 * DAY ? 'overdue' : age >= 12 * DAY ? 'pending' : 'active';
        counts[status]++;
        if (status !== 'active') {
          const name = normalizeName(device.userName || device.name) || 'ไม่ระบุชื่อ';
          followUp.set(name, (followUp.get(name) || 0) + 1);
        }
      }
      const pending = [...followUp].sort((a,b)=>b[1]-a[1]);
      const timestamp = new Date(now).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
      const text = `รายงานสถานะอุปกรณ์ทั้งระบบ\nสำหรับ อำพล แซ่แฮ\nข้อมูล ณ ${timestamp}\n\nทั้งหมด ${db.devices.length} รายการ\nActive: ${counts.active}\nPending: ${counts.pending}\nUnverified: ${counts.unverified}\nOverdue: ${counts.overdue}\n\nต้องติดตาม ${pending.length} ชื่อ/รายการผู้ถือครอง\n${pending.slice(0,15).map(([name,count])=>`${name}: ${count} รายการ`).join('\n') || 'ไม่มีรายการค้าง'}${pending.length > 15 ? `\nและอีก ${pending.length-15} ชื่อ ดูทั้งหมดในระบบ` : ''}\n\nดูสถานะและรายการทั้งหมด:\n${baseUrl}/\n\nรายงานนี้ส่งให้อำพลคนเดียว การเตือนยืนยันอุปกรณ์ของพนักงานยังทำงานตามเดิม`;
      const auth = await accessToken();
      // Administrator ID verified against the supplied Lark contact export.
      const message = await api('im/v1/messages?receive_id_type=user_id', {
        receive_id: '17e23293', msg_type: 'text', content: JSON.stringify({ text }),
        uuid: createHash('sha256').update(`admin-summary:${day}:17e23293`).digest('hex').slice(0,32)
      }, auth);
      config.summaryDelivery = { day, sentAt: new Date(clock()).toISOString(), messageId: message.data?.message_id, receiveId: '17e23293' };
      try { await persist(db); } catch (error) { return { sent: true, storageError: error.message, delivery: config.summaryDelivery }; }
      return { sent: true, delivery: config.summaryDelivery };
    } catch (error) {
      config.summaryDelivery = { error: error.message, attemptedAt: new Date(clock()).toISOString() };
      try { await persist(db); } catch (_) { /* Keep retry backoff in memory. */ }
      return { sent: false, error: error.message };
    } finally { summaryRunning = false; }
  }
  async function recover({ people = [], deviceChecks = [], logs = [], deviceIds }) {
    const db = readDb(), config = state(db);
    // Rebuild unsaved assignments only from a matching check + recorded assignment.
    for (const check of deviceChecks) {
      if (db.devices.some(d => d.id === check.id)) continue;
      const log = logs.find(l => l.deviceId === check.id && /^Assigned from IT Dashboard \(.+\)$/.test(l.action || ''));
      if (!log || !Number.isFinite(Date.parse(check.lastVerifiedAt))) continue;
      const serial = log.action.match(/^Assigned from IT Dashboard \((.+)\)$/)[1];
      db.devices.push({ id: check.id, name: log.deviceName, userName: log.deviceName, deviceNumber: serial,
        registeredAt: check.lastVerifiedAt, lastVerifiedAt: check.lastVerifiedAt, assignmentStatus: 'issued', isIOS: /^(ipad|iphone)-/i.test(serial) });
    }
    // A complete pre-deploy snapshot prevents resurrecting records deleted while
    // cloud writes were rejected. Never prune against an incomplete snapshot.
    if (Array.isArray(deviceIds) && deviceIds.length && deviceIds.length === new Set(deviceIds).size && deviceChecks.length === deviceIds.length && deviceIds.every(id => deviceChecks.some(c => c.id === id) && db.devices.some(d => d.id === id))) {
      db.devices = db.devices.filter(d => deviceIds.includes(d.id));
    }
    const names = new Set(db.devices.map(d => normalizeName(d.userName || d.name)));
    let restored = 0, checks = 0;
    for (const person of people) {
      const name = normalizeName(person.name), recipient = person.recipient;
      if (!names.has(name) || !recipient || !['user_id','open_id','email'].includes(recipient.idType) || typeof recipient.receiveId !== 'string' || recipient.receiveId.length > 254) continue;
      const existing = config.recipients[name];
      if (existing && recipientKey(existing) !== recipientKey(recipient)) continue;
      config.recipients[name] = { receiveId: recipient.receiveId, idType: recipient.idType, enabled: recipient.enabled === true };
      const entry = person.delivery, key = recipientKey(recipient);
      if (!entry?.messageId?.startsWith('om_') || !Number.isFinite(Date.parse(entry.sentAt)) || entry.day !== bangkokDay(Date.parse(entry.sentAt))) continue;
      if (Date.parse(config.delivery[key]?.sentAt || '') >= Date.parse(entry.sentAt)) continue;
      config.delivery[key] = { day: entry.day, sentAt: entry.sentAt, count: Number(entry.count) || 0, messageId: entry.messageId };
      restored++;
    }
    for (const check of deviceChecks) {
      const device = db.devices.find(d => d.id === check.id), incomingTime = Date.parse(check.lastVerifiedAt);
      if (!device || !Number.isFinite(incomingTime) || incomingTime <= (Date.parse(device.lastVerifiedAt) || 0)) continue;
      device.lastVerifiedAt = new Date(incomingTime).toISOString();
      if (check.latitude != null && check.longitude != null && Number.isFinite(Number(check.latitude)) && Math.abs(Number(check.latitude)) <= 90 && Number.isFinite(Number(check.longitude)) && Math.abs(Number(check.longitude)) <= 180) {
        device.latitude = Number(check.latitude); device.longitude = Number(check.longitude);
        device.lastLocationTime = check.lastLocationTime || check.lastVerifiedAt;
        device.address = String(check.address || '');
      }
      checks++;
    }
    if (logs.length) {
      const key = log => JSON.stringify([log.timestamp,log.deviceId,log.action,log.deviceName]);
      const merged = new Map((db.logs || []).map(log => [key(log),log]));
      for (const log of logs) {
        if (typeof log.action === 'string' && typeof log.timestamp === 'string' && Number.isFinite(Date.parse(log.timestamp))) merged.set(key(log),log);
      }
      db.logs = [...merged.values()].sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp));
    }
    await persist(db);
    return { restored, checks, people: overview().people.length };
  }
  return { overview, saveRecipient, run, recover, sendSummary,
    previewSource: async () => { await checkedSource(readDb().devices); return sourceCheck; },
    testConnection: async () => { await accessToken(); return { ok: true }; } };
}
module.exports = { createLarkReminders, due, bangkokDay, normalizeName };
