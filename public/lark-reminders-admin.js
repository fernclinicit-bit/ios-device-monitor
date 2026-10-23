const el = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
let people = [];
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
  el('message').textContent = result.skipped || `ส่งสำเร็จ ${result.results.filter(r=>r.sent).length} คน\n${result.results.filter(r=>!r.sent).map(r=>`${r.name}: ${r.error}`).join('\n')}`;
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
