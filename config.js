/* ═══════════════════════════════════════════════════
   CONEXIÓN A SUPABASE  —  editable sin tocar el resto
   ═══════════════════════════════════════════════════ */
window.SB_URL = 'https://wfzlldsdontjmikhwsod.supabase.co';
window.SB_KEY = 'sb_publishable_syo-t3i5oZKC28nJWKk2OQ_KAUM3Lkt';

/* ── Cliente REST mínimo (sin librerías: ~2 KB en vez de ~120 KB) ── */
window.api = (function () {
  const H = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };
  async function req(method, path, body, extra) {
    const r = await fetch(SB_URL + '/rest/v1/' + path, {
      method,
      headers: Object.assign({}, H, extra || {}),
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    });
    if (!r.ok) throw new Error(await r.text());
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  }
  return {
    get: p => req('GET', p),
    add: (t, b) => req('POST', t, b, { Prefer: 'return=representation' }),
    upsert: (t, b) => req('POST', t, b, { Prefer: 'resolution=merge-duplicates,return=representation' }),
    patch: (p, b) => req('PATCH', p, b, { Prefer: 'return=representation' }),
    del: p => req('DELETE', p),
    rpc: (fn, args) => req('POST', 'rpc/' + fn, args || {})
  };
})();

/* ── Caché local: la app abre al instante y revalida detrás ── */
window.cache = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem('cf_' + k)); return v === null ? d : v } catch (e) { return d } },
  set(k, v) { try { localStorage.setItem('cf_' + k, JSON.stringify(v)) } catch (e) { } },
  del(k) { try { localStorage.removeItem('cf_' + k) } catch (e) { } }
};
