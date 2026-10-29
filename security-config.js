function loadSecurityConfig(env = process.env) {
  const actionPassword = String(env.ACTION_PASSWORD || '').trim();
  if (!actionPassword) throw new Error('ACTION_PASSWORD must be configured');
  return Object.freeze({ actionPassword });
}

module.exports = { loadSecurityConfig };
