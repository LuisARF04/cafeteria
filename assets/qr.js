/* ═══════════════════════════════════════════════════════════════
   Generador de códigos QR — JavaScript puro, sin dependencias.
   Modo byte (UTF-8), corrección de errores nivel M, versiones 1–10.
   Suficiente para URLs de hasta 214 caracteres.
   Funciona sin internet: los QR se dibujan en el propio teléfono.
   ═══════════════════════════════════════════════════════════════ */
window.QR = (function () {

  /* ── Aritmética en GF(256), polinomio 0x11D ── */
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function () {
    let x = 1;
    for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();
  const mul = (a, b) => (a && b) ? EXP[LOG[a] + LOG[b]] : 0;

  function generador(n) {
    let p = [1];
    for (let i = 0; i < n; i++) {
      const q = new Array(p.length + 1).fill(0);
      for (let j = 0; j < p.length; j++) { q[j] ^= p[j]; q[j + 1] ^= mul(p[j], EXP[i]); }
      p = q;
    }
    return p;
  }
  function corregir(datos, n) {
    const g = generador(n), r = new Uint8Array(datos.length + n);
    r.set(datos);
    for (let i = 0; i < datos.length; i++) {
      const f = r[i]; if (!f) continue;
      for (let j = 0; j < g.length; j++) r[i + j] ^= mul(g[j], f);
    }
    return Array.from(r.slice(datos.length));
  }

  /* ── Tablas del estándar, nivel M, versiones 1–10 ── */
  const TOTAL = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
  const EC_X_BLOQUE = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
  const BLOQUES = [null, [16], [28], [44], [32, 32], [43, 43], [27, 27, 27, 27],
    [31, 31, 31, 31], [38, 38, 39, 39], [36, 36, 36, 37, 37], [43, 43, 43, 43, 44]];
  const ALINEACION = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
    [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
  const INFO_VERSION = { 7: 0x07C94, 8: 0x085BC, 9: 0x09A99, 10: 0x0A4D3 };

  const MASCARAS = [
    (i, j) => (i + j) % 2 === 0,
    (i, j) => i % 2 === 0,
    (i, j) => j % 3 === 0,
    (i, j) => (i + j) % 3 === 0,
    (i, j) => ((i / 2 | 0) + (j / 3 | 0)) % 2 === 0,
    (i, j) => (i * j) % 2 + (i * j) % 3 === 0,
    (i, j) => ((i * j) % 2 + (i * j) % 3) % 2 === 0,
    (i, j) => ((i + j) % 2 + (i * j) % 3) % 2 === 0
  ];

  /* ── Texto → bytes UTF-8 ── */
  function bytes(txt) {
    if (typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(txt));
    return Array.from(unescape(encodeURIComponent(txt))).map(c => c.charCodeAt(0));
  }

  /* ── Elegir la versión más pequeña que quepa ── */
  function versionPara(n) {
    for (let v = 1; v <= 10; v++) {
      const datos = BLOQUES[v].reduce((a, b) => a + b, 0);
      const bits = 4 + (v < 10 ? 8 : 16) + 8 * n;
      if (bits <= datos * 8) return v;
    }
    throw new Error('El texto es demasiado largo para un QR de versión 10');
  }

  /* ── Flujo de bits de datos ── */
  function flujo(bs, v) {
    const datos = BLOQUES[v].reduce((a, b) => a + b, 0), cap = datos * 8;
    const bits = [];
    const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
    push(0b0100, 4);                       // modo byte
    push(bs.length, v < 10 ? 8 : 16);      // longitud
    bs.forEach(b => push(b, 8));
    for (let i = 0; i < 4 && bits.length < cap; i++) bits.push(0);   // terminador
    while (bits.length % 8) bits.push(0);
    const cw = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      cw.push(b);
    }
    const relleno = [0xEC, 0x11];
    for (let i = 0; cw.length < datos; i++) cw.push(relleno[i % 2]);
    return cw;
  }

  /* ── Intercalado de bloques de datos y de corrección ── */
  function codigos(cw, v) {
    const tam = BLOQUES[v], nec = EC_X_BLOQUE[v];
    const dat = [], ecc = [];
    let p = 0;
    tam.forEach(t => { const b = cw.slice(p, p + t); p += t; dat.push(b); ecc.push(corregir(b, nec)); });
    const out = [];
    for (let i = 0; i < Math.max(...tam); i++) dat.forEach(b => { if (i < b.length) out.push(b[i]); });
    for (let i = 0; i < nec; i++) ecc.forEach(b => out.push(b[i]));
    return out;
  }

  /* ── Patrones fijos ── */
  function esqueleto(v) {
    const n = v * 4 + 17;
    const m = Array.from({ length: n }, () => new Int8Array(n).fill(-1)); // -1 = libre
    const buscador = (r, c) => {
      for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) {
        const y = r + i, x = c + j;
        if (y < 0 || y >= n || x < 0 || x >= n) continue;
        const borde = i >= 0 && i <= 6 && j >= 0 && j <= 6;
        const negro = borde && ((i === 0 || i === 6 || j === 0 || j === 6) ||
          (i >= 2 && i <= 4 && j >= 2 && j <= 4));
        m[y][x] = negro ? 1 : 0;
      }
    };
    buscador(0, 0); buscador(0, n - 7); buscador(n - 7, 0);

    for (let i = 8; i < n - 8; i++) { const b = i % 2 === 0 ? 1 : 0; m[6][i] = b; m[i][6] = b; }

    const cen = ALINEACION[v];
    cen.forEach(r => cen.forEach(c => {
      if ((r <= 8 && c <= 8) || (r <= 8 && c >= n - 9) || (r >= n - 9 && c <= 8)) return;
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++)
        m[r + i][c + j] = (Math.max(Math.abs(i), Math.abs(j)) !== 1) ? 1 : 0;
    }));

    m[n - 8][8] = 1;  // módulo siempre negro

    // reservar las zonas de información de formato y de versión
    for (let i = 0; i < 9; i++) {
      if (m[8][i] === -1) m[8][i] = -2;
      if (m[i][8] === -1) m[i][8] = -2;
    }
    for (let i = 0; i < 8; i++) {
      if (m[8][n - 1 - i] === -1) m[8][n - 1 - i] = -2;
      if (m[n - 1 - i][8] === -1) m[n - 1 - i][8] = -2;
    }
    if (v >= 7) for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
      m[n - 11 + j][i] = -2; m[i][n - 11 + j] = -2;
    }
    return m;
  }

  /* ── Colocar los datos en zigzag ── */
  function colocar(m, bits) {
    const n = m.length; let k = 0, arriba = true;
    for (let col = n - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (let t = 0; t < n; t++) {
        const fila = arriba ? n - 1 - t : t;
        for (let d = 0; d < 2; d++) {
          const c = col - d;
          if (m[fila][c] !== -1) continue;
          m[fila][c] = k < bits.length ? bits[k] : 0;
          k++;
        }
      }
      arriba = !arriba;
    }
  }

  /* ── Penalización (reglas 1 a 4 del estándar) ── */
  function penalizacion(m) {
    const n = m.length; let p = 0;
    const leer = (r, c) => m[r][c] & 1;
    // 1: rachas de 5 o más
    for (let i = 0; i < n; i++) for (const fila of [true, false]) {
      let run = 1, prev = -1;
      for (let j = 0; j < n; j++) {
        const v = fila ? leer(i, j) : leer(j, i);
        if (v === prev) { run++; if (run === 5) p += 3; else if (run > 5) p++; }
        else { run = 1; prev = v; }
      }
    }
    // 2: bloques de 2×2
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) {
      const v = leer(i, j);
      if (v === leer(i, j + 1) && v === leer(i + 1, j) && v === leer(i + 1, j + 1)) p += 3;
    }
    // 3: patrón 1:1:3:1:1 con zona clara
    const A = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], B = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    const coincide = (arr, pat) => pat.every((x, i) => arr[i] === x);
    for (let i = 0; i < n; i++) for (let j = 0; j + 11 <= n; j++) {
      const h = [], w = [];
      for (let k = 0; k < 11; k++) { h.push(leer(i, j + k)); w.push(leer(j + k, i)); }
      if (coincide(h, A) || coincide(h, B)) p += 40;
      if (coincide(w, A) || coincide(w, B)) p += 40;
    }
    // 4: desequilibrio claro/oscuro
    let oscuros = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) oscuros += leer(i, j);
    p += Math.floor(Math.abs(oscuros * 100 / (n * n) - 50) / 5) * 10;
    return p;
  }

  /* ── Información de formato y de versión (BCH) ── */
  function bitsFormato(mascara) {
    let d = (0b00 << 3) | mascara;            // nivel M = 00
    let v = d << 10;
    for (let i = 4; i >= 0; i--) if (v & (1 << (i + 10))) v ^= 0b10100110111 << i;
    return ((d << 10) | v) ^ 0b101010000010010;
  }
  function aplicarFormato(m, mascara) {
    const n = m.length, f = bitsFormato(mascara);
    const bit = i => (f >> i) & 1;
    for (let i = 0; i <= 5; i++) m[8][i] = bit(i);
    m[8][7] = bit(6); m[8][8] = bit(7); m[7][8] = bit(8);
    for (let i = 9; i <= 14; i++) m[14 - i][8] = bit(i);
    for (let i = 0; i <= 6; i++) m[n - 1 - i][8] = bit(i);
    for (let i = 7; i <= 14; i++) m[8][n - 15 + i] = bit(i);
    m[n - 8][8] = 1;
  }
  function aplicarVersion(m, v) {
    if (v < 7) return;
    const n = m.length, b = INFO_VERSION[v];
    for (let i = 0; i < 18; i++) {
      const bit = (b >> i) & 1, f = Math.floor(i / 3), c = i % 3;
      m[n - 11 + c][f] = bit; m[f][n - 11 + c] = bit;
    }
  }

  /* ── Construir la matriz final ── */
  function matriz(texto) {
    const bs = bytes(texto), v = versionPara(bs.length);
    const cw = codigos(flujo(bs, v), v);
    const bits = [];
    cw.forEach(b => { for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1); });

    const base = esqueleto(v);
    const libres = base.map(f => Array.from(f));
    colocar(libres, bits);

    let mejor = null, mejorP = Infinity;
    for (let k = 0; k < 8; k++) {
      const m = libres.map((f, i) => Array.from(f, (val, j) =>
        (base[i][j] === -1 && MASCARAS[k](i, j)) ? val ^ 1 : val));
      aplicarFormato(m, k); aplicarVersion(m, v);
      const p = penalizacion(m);
      if (p < mejorP) { mejorP = p; mejor = m; }
    }
    return { version: v, size: mejor.length, modulos: mejor.map(f => Array.from(f, x => x & 1)) };
  }

  /* ── Matriz → SVG (se imprime nítido a cualquier tamaño) ── */
  function svg(texto, opciones) {
    const o = opciones || {};
    const margen = o.margen == null ? 4 : o.margen;
    const q = matriz(texto), n = q.size, lado = n + margen * 2;
    let d = '';
    for (let i = 0; i < n; i++) {
      let j = 0;
      while (j < n) {
        if (!q.modulos[i][j]) { j++; continue; }
        let w = 1; while (j + w < n && q.modulos[i][j + w]) w++;
        d += 'M' + (j + margen) + ' ' + (i + margen) + 'h' + w + 'v1h-' + w + 'z';
        j += w;
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + lado + ' ' + lado + '" ' +
      'shape-rendering="crispEdges" role="img" aria-label="' +
      String(o.alt || 'Código QR').replace(/[&<>"]/g, '') + '">' +
      '<rect width="' + lado + '" height="' + lado + '" fill="' + (o.fondo || '#fff') + '"/>' +
      '<path d="' + d + '" fill="' + (o.color || '#000') + '"/></svg>';
  }

  return { matriz, svg };
})();
