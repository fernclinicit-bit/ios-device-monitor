// Prefer full names; allow a short name only when it identifies one directory member.
function larkNameKey(value) {
  return String(value || '').normalize('NFKC').split('|')[0]
    .split(/\p{Extended_Pictographic}/u)[0]
    .replace(/^(?:นาย|นางสาว|นาง|พ\.ต\.)\s*/, '')
    .replace(/\([^)]*\)/g, '').replace(/crm\s*$/i, '')
    .replace(/เเ/g, 'แ').replace(/[^\p{L}\p{M}]/gu, '').toLowerCase();
}
function matchLarkContacts(name, contacts) {
  const key = larkNameKey(name);
  if (!key) return [];
  const active = contacts.filter(c => c.status === 'Active' && c.userId);
  const exact = active.filter(c => String(c.name).split('|').some(alias =>
    larkNameKey(alias.replace(/^(?:CN|EN|JP)-/, '')) === key));
  if (exact.length) return exact;
  const shortName = String(name || '').trim();
  if (/\s|[()]/.test(shortName)) return [];
  return active.filter(c => String(c.name).split('|').some(alias => {
    const clean = alias.replace(/^(?:CN|EN|JP)-/, '').trim();
    const firstName = clean.split(/\s|\(/)[0];
    const nicknames = [...clean.matchAll(/\(([^)]+)\)/g)].map(match => match[1]);
    return [firstName, ...nicknames].some(value => larkNameKey(value) === key);
  }));
}
if (typeof module !== 'undefined') module.exports = { larkNameKey, matchLarkContacts };
