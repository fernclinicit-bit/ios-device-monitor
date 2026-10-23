// Match full names, including translated names, without guessing by nickname.
function larkNameKey(value) {
  return String(value || '').normalize('NFKC').split('|')[0]
    .replace(/^(?:นาย|นางสาว|นาง|พ\.ต\.)\s*/, '')
    .replace(/\([^)]*\)/g, '').replace(/crm\s*$/i, '')
    .replace(/เเ/g, 'แ').replace(/[^\p{L}\p{M}]/gu, '').toLowerCase();
}
function matchLarkContacts(name, contacts) {
  const key = larkNameKey(name);
  if (!key) return [];
  return contacts.filter(c => c.status === 'Active' && c.userId && String(c.name).split('|').some(alias =>
    larkNameKey(alias.replace(/^(?:CN|EN|JP)-/, '')) === key));
}
if (typeof module !== 'undefined') module.exports = { larkNameKey, matchLarkContacts };
