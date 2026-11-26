/* ═══════════════════════════════════════════════════════════
   Cliente REST + sesión de Supabase, escrito a mano.
   ~3 KB en vez de los ~120 KB de supabase-js: en una conexión
   lenta eso es la diferencia entre abrir en 2 s o en 20 s.
   ═══════════════════════════════════════════════════════════ */

/* ── Caché local ── */
window.cache = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem('cf_' + k)); return v === null ? d : v } catch (e) { return d } },
  set(k, v) { try { localStorage.setItem('cf_' + k, JSON.stringify(v)) } catch (e) { } },
  del(k) { try { localStorage.removeItem('cf_' + k) } catch (e) { } }
};

/* ── Sesión del panel (Supabase Auth) ── */
window.auth = (function () {
  const DOMINIO = '@cafeteria.local';
  let ses = cache.get('sesion', null);

  const correo = u => u.includes('@') ? u.trim().toLowerCase() : u.trim().toLowerCase() + DOMINIO;

  function guardar(j) {
    ses = {
      token: j.access_token,
      refresco: j.refresh_token,
      vence: Date.now() + (j.expires_in || 3600) * 1000,
      usuario: (j.user && j.user.user_metadata && j.user.user_metadata.usuario) ||
               (j.user && j.user.email || '').split('@')[0].toUpperCase(),
      rol: (j.user && j.user.user_metadata && j.user.user_metadata.rol) || 'dueño'
    };
    cache.set('sesion', ses);
    return ses;
  }

  async function pedirToken(cuerpo, tipo) {
    const r = await fetch(SB_URL + '/auth/v1/token?grant_type=' + tipo, {
      method: 'POST',
      headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error_description || j.msg || 'Error de acceso'); e.http = r.status; throw e }
    return guardar(j);
  }

  return {
    hay: () => !!ses,
    quien: () => ses,
    entrar: (usuario, clave) => pedirToken({ email: correo(usuario), password: clave }, 'password'),
    async token() {
      if (!ses) return null;
      if (Date.now() > ses.vence - 90000) {
        try { await pedirToken({ refresh_token: ses.refresco }, 'refresh_token') }
        catch (e) { if (e.http === 400 || e.http === 401) { this.salir(); return null } }
      }
      return ses ? ses.token : null;
    },
    async cambiarClave(nueva) {
      const t = await this.token();
      const r = await fetch(SB_URL + '/auth/v1/user', {
        method: 'PUT',
        headers: { apikey: SB_KEY, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: nueva })
      });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.msg || 'No se pudo cambiar') }
      return true;
    },
    salir() { ses = null; cache.del('sesion') }
  };
})();

/* ── Peticiones a la base de datos ── */
window.api = (function () {
  async function req(metodo, ruta, cuerpo, prefer) {
    const t = await auth.token();
    const h = {
      apikey: SB_KEY,
      Authorization: 'Bearer ' + (t || SB_KEY),
      'Content-Type': 'application/json'
    };
    if (prefer) h.Prefer = prefer;
    const r = await fetch(SB_URL + '/rest/v1/' + ruta, {
      method: metodo, headers: h,
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      cache: 'no-store'
    });
    if (!r.ok) {
      const txt = await r.text();
      const e = new Error(txt || ('HTTP ' + r.status));
      e.http = r.status;
      e.permiso = r.status === 401 || r.status === 403 || /row-level security/i.test(txt);
      throw e;
    }
    const txt = await r.text();
    return txt ? JSON.parse(txt) : null;
  }
  return {
    get: ruta => req('GET', ruta),
    add: (tabla, filas) => req('POST', tabla, filas, 'return=representation'),
    /* para el cliente: crea sin leer de vuelta, porque no tiene permiso de lectura */
    addMudo: (tabla, filas) => req('POST', tabla, filas, 'return=minimal'),
    upsert: (tabla, filas) => req('POST', tabla, filas, 'resolution=merge-duplicates,return=representation'),
    patch: (ruta, campos) => req('PATCH', ruta, campos, 'return=minimal'),
    del: ruta => req('DELETE', ruta),
    rpc: (fn, args) => req('POST', 'rpc/' + fn, args || {})
  };
})();
