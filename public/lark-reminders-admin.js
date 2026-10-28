const el = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
let people = [];
el('source-check').onclick = event => busy(event.target, async () => {
  const result = await call('source-check');
  el('message').textContent = `ต้นทาง ${result.sourceCount} รายการ • ตรงกัน ${result.matched} รายการ • งดส่ง ${result.blocked.length} รายการ\n${result.blocked.map(row=>`${row.deviceNumber || '-'} — ${row.name}: ${row.reason}`).join('\n')}\nการตรวจนี้ยังไม่ได้ส่งข้อความ`;
});
el('summary').onclick = event => busy(event.target, async () => {
  if (!confirm('ส่งรายงานสรุปทั้งระบบให้อำพล แซ่แฮคนเดียว? (วันละครั้ง)')) return;
  const result = await call('summary');
  el('message').textContent = result.skipped || (result.sent ? `Lark รับรายงานสำหรับอำพลแล้ว${result.storageError ? '\nบันทึกประวัติไม่สำเร็จ: '+result.storageError : ''}` : result.error);
});
el('import-contacts').onclick = event => busy(event.target, async () => {
  const file = el('contacts-file').files[0];
  if (!file) throw Error('กรุณาเลือกไฟล์รายชื่อ .json');
  if (file.size > 1000000) throw Error('ไฟล์ใหญ่เกินไป');
  const input = JSON.parse(await file.text());
  if (input.format !== 'lark-contacts-v1' || !Array.isArray(input.contacts)) throw Error('รูปแบบไฟล์ไม่ถูกต้อง');
  const current = await call('status'); people = current.people;
  const matches = people.map(person => ({ person, candidates: matchLarkContacts(person.name, input.contacts) }));
  const certain = matches.filter(item => item.candidates.length === 1);
  if (!confirm(`พบชื่อที่จับคู่ได้ ${certain.length} แถว จาก ${people.length} แถว บันทึก User ID โดยคงสถานะเปิดส่งเดิมหรือไม่?`)) return;
  let saved = 0; const errors = [];
  for (const { person, candidates } of certain) {
    try {
      const contact = candidates[0];
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(contact.userId)) throw Error('User ID ไม่ถูกต้อง');
      if (person.recipient?.enabled && (person.recipient.receiveId !== contact.userId || person.recipient.idType !== 'user_id')) throw Error('บัญชีนี้เปิดส่งอยู่ กรุณาตรวจการเปลี่ยนผู้รับด้วยตนเอง');
      await call('save', { name: person.name, idType: 'user_id', receiveId: contact.userId, enabled: person.recipient?.enabled === true });
      saved++;
    } catch(error) { errors.push(`${person.name}: ${error.message}`); }
  }
  people = (await call('status')).people; render();
  const unmatched = matches.filter(item => item.candidates.length !== 1).map(item => item.person.name);
  el('message').textContent = `บันทึก ${saved} แถว\nต้องตรวจสอบ ${unmatched.length + errors.length} แถว\n${unmatched.join('\n')}\n${errors.join('\n')}\nยังไม่ได้ส่งข้อความจากการนำเข้า`;
});
async function call(action, extra = {}) {
  const response = await fetch('/api/lark-reminders', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action, password:el('password').value, ...extra }) });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'เชื่อมต่อไม่สำเร็จ');
  return data;
}
function render() {
  const query = el('search').value.toLowerCase();
  el('people').innerHTML = people.filter(p => p.name.toLowerCase().includes(query)).map(p => `<tr data-name="${escape(p.name)}"><td>${escape(p.name)}<small>รอยืนยัน ${p.dueCount} / ทั้งหมด ${p.total}</small></td><td><select aria-label="ประเภทบัญชี"><option value="email" ${p.recipient?.idType==='email'?'selected':''}>อีเมล Lark</option><option value="open_id" ${p.recipient?.idType==='open_id'?'selected':''}>Open ID</option><option value="user_id" ${p.recipient?.idType==='user_id'?'selected':''}>User ID</option></select></td><td><input type="text" aria-label="บัญชี Lark" value="${escape(p.recipient?.receiveId || '')}"></td><td><label><input type="checkbox" ${p.recipient?.enabled?'checked':''}>เปิดส่ง</label><button class="save">บันทึก</button></td><td>${escape(p.delivery?.sentAt ? new Date(p.delivery.sentAt).toLocaleString('th-TH') : 'ยังไม่ส่ง')}<small>${escape(p.delivery?.error || '')}</small></td></tr>`).join('');
}
async function busy(button, work) {
  button.disabled = true;
  try { await work(); } catch(error) { el('message').textContent = error.message; }
  finally { button.disabled = false; }
}
el('load').onclick = event => busy(event.target, async () => {
  const data = await call('status'); people = data.people; render();
  el('message').textContent = data.configured ? `ตั้งค่า App ID / App Secret แล้ว • ${data.schedule}` : 'ยังไม่ได้ตั้ง LARK_APP_ID / LARK_APP_SECRET ใน Render';
});
el('test').onclick = event => busy(event.target, async () => { await call('test'); el('message').textContent='เชื่อมต่อ Lark สำเร็จ (ยังไม่ได้ส่งข้อความ)'; });
el('send').onclick = event => busy(event.target, async () => {
  if (!confirm('ส่งลิงก์ให้บัญชีที่เปิดส่งและมีอุปกรณ์ถึงกำหนดตอนนี้?')) return;
  const result = await call('send');
  el('message').textContent = result.skipped || `Lark รับข้อความแล้ว ${result.results.filter(r=>r.sent).length} บัญชี (ยังไม่ใช่การยืนยันว่าเปิดอ่าน)\n${result.results.filter(r=>!r.sent).map(r=>`${r.name}: ${r.error}`).join('\n')}\n${result.results.filter(r=>r.storageError).map(r=>`${r.name}: บันทึกประวัติไม่สำเร็จ ${r.storageError}`).join('\n')}`;
  people = (await call('status')).people; render();
});
el('search').oninput = render;
el('people').onclick = event => {
  if (!event.target.classList.contains('save')) return;
  const row = event.target.closest('tr');
  busy(event.target, async () => {
    const data = await call('save', { name:row.dataset.name, idType:row.querySelector('select').value, receiveId:row.querySelector('input[type=text]').value, enabled:row.querySelector('input[type=checkbox]').checked });
    people=data.people; render(); el('message').textContent='บันทึกบัญชีผู้รับแล้ว';
  });
};
