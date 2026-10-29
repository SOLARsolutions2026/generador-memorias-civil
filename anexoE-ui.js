/* ═══ Pantalla del Anexo E — Conexiones (usa calc/anexoE.js, los elementos del Anexo D y los resultados del modelo del Anexo C) ═══
   Opción A de Amo (28-oct-2026): galería con dibujos para agregar; cada conexión se edita sobre su dibujo (cotas con recuadro = se tocan y se cambian),
   lo que no cumple se pinta en rojo y tiene su 💡. Cada conexión lleva la etiqueta «Conexión X a Y» (qué une con qué). */
'use strict';
let selE = null, tabE = 0;

const PLACAS = [['1/4"',6.35],['5/16"',7.94],['3/8"',9.525],['1/2"',12.7],['5/8"',15.875],['3/4"',19.05],['7/8"',22.225],['1"',25.4],['1-1/4"',31.75],['1-1/2"',38.1],['2"',50.8]];
const TIPOS_E = {
  placa:{ pre:'CN', n:'Placa base y anclajes', s:'columna → pedestal · ejes X e Y · cargas = reacciones del modelo' },
  vc:   { pre:'TP', n:'Viga – columna a momento', s:'cubrejuntas pernadas + cartela a cortante · IPE / HEA' },
  sold: { pre:'SL', n:'Soldadura de filete', s:'10 formas: cordones, L, C, U, rectangular, perfil I, circular y a tope' },
};
function datosE(){
  const m = S.m; m.anexos = m.anexos || {};
  const E = m.anexos.E = m.anexos.E || {};
  if(!Array.isArray(E.con)) E.con = [];
  return E;
}
const dPerno = d => (AnexoE.PERNOS[d] || AnexoE.PERNOS['1/2"'])[0];
const numE = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };
function sigNom(E, tipo){ const pre = TIPOS_E[tipo].pre, ns = E.con.filter(c => c.tipo === tipo).map(c => parseInt(String(c.nom).split('-')[1]) || 0); return `${pre}-${Math.max(0, ...ns) + 1}`; }
function sigPL(E){ const ns = E.con.map(c => parseInt(String(c.plN || '').split('-')[1]) || 0); return `PL-${Math.max(0, ...ns) + 1}`; }
function nuevaCon(tipo, E, D){
  const base = { id:'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), tipo, nom:sigNom(E, tipo), etiqueta:'', desc:'', cargas:'modelo', extremo:'ambos', nudos:[], res:null };
  const col = D.met.find(e => e.tipo === 'I' && /col/i.test(e.desc || '')) || D.met.find(e => e.tipo === 'I'), viga = D.met.find(e => e.tipo === 'I' && /viga/i.test(e.desc || '') && e !== col);
  if(tipo === 'placa') return { ...base, de:col?.id || '', a:D.ped[0]?.id || '', plN:sigPL(E), ori:'y', N:300, B:300, tp:12.7, aceroPlaca:'A36', Lp:400, Wp:400, ha:1180, fc:21,
    perno:'5/8"', anclaje:'A36', nB:2, S1:220, S2:200, hef:300, arandela:50, cabeza:'tuerca', eh:'', fisurado:true, mortero:false, w:6, electrodo:'E70XX',
    man:{ P:'', Mn:'', Mb:'', Vn:'', Vb:'' } };
  if(tipo === 'vc') return { ...base, de:viga?.id || '', a:col?.id || '', aceroViga:'A572 Gr 50', aceroCol:'A572 Gr 50',
    pl:{ L:250, b:120, t:9.525, acero:'A36' }, pc:{ d:'5/8"', tipo:'A325', rosca:true, nf:2, nc:3, s:50, le:30, g:70, lu:40 },
    ct:{ h:110, b:90, t:9.525, acero:'A36', d:'5/8"', tipo:'A325', rosca:true, n:2, s:50, le:30, e:50 }, wPl:6, wCt:5, electrodo:'E70XX', man:{ M:'', V:'', P:'' } };
  const el = col || D.met[0], s = el ? secDe(el) : null;
  const forma = !s ? 'O' : s.tipo === 'HSS' ? 'O' : s.tipo === 'BAR' ? 'c' : 'I';
  const pb = E.con.find(x => x.tipo === 'placa' && x.de === el?.id);
  return { ...base, de:el?.id || '', a:'PL', plN:pb?.plN || sigPL(E), forma, b:s ? (s.b || s.B || s.d || 100) : 100, d:s ? (s.h || s.H || s.d || 150) : 150, w:6, t:s?.tf || s?.tn || 9.525, acero:'A36', electrodo:'E70XX',
    man:{ V:'', H:'', T:'', N:'', Mx:'', My:'' } };
}

// ─── Nombres y etiquetas ───
const metDe = (D, id) => D.met.find(e => e.id === id), pedDe = (D, id) => D.ped.find(e => e.id === id);
function nomEl(D, id, c){
  if(id === 'PL') return c.plN || 'PL';
  const e = metDe(D, id) || pedDe(D, id); return e ? e.nom : '?';
}
function etiquetaE(c, D){
  if(c.etiqueta) return c.etiqueta;
  if(c.tipo === 'placa') return `Conexión ${nomEl(D, c.de, c)} a ${c.plN || 'PL'} sobre ${nomEl(D, c.a, c)}`;
  return `Conexión ${nomEl(D, c.de, c)} a ${nomEl(D, c.a, c)}`;
}

// ─── Entradas para el cálculo (con los datos del Anexo D) ───
function secCol(e){ const s = e ? secDe(e) : null; if(!s) return null;
  return s.tipo === 'I' ? { bf:s.b, d:s.h, tw:s.tw, tf:s.tf, r:s.r, n:s.n, tipo:'I' } : s.tipo === 'HSS' ? { bf:s.B, d:s.H, tw:s.tn, tf:s.tn, r:0, n:'Tubo ' + s.n, tipo:'HSS' } : { bf:s.d, d:s.d, tw:s.d, tf:s.d, r:0, n:'Barra Ø' + s.d, tipo:'BAR' }; }
function entradaE(c, D){
  if(c.tipo === 'placa'){
    const s = secCol(metDe(D, c.de)), p = pedDe(D, c.a), oy = c.ori !== 'x';
    const ped = p ? { Lp:numE(oy ? p.h : p.b), Wp:numE(oy ? p.b : p.h), ha:numE(p.Hp)*1000, fc:numE(p.fc) } : { Lp:c.Lp, Wp:c.Wp, ha:c.ha, fc:c.fc };
    return { ...c, ...(s || {}), ...ped, _s:s, _p:p };
  }
  if(c.tipo === 'vc'){
    const v = metDe(D, c.de), k = metDe(D, c.a), sv = v ? secDe(v) : null, sk = c._colPerfil ? AnexoD.secI(c._colPerfil) : k ? secDe(k) : null;
    return { ...c, viga:sv?.tipo === 'I' ? sv : null, col:sk?.tipo === 'I' ? sk : null, aceroViga:v?.acero || c.aceroViga, aceroCol:k?.acero || c.aceroCol };
  }
  const e = metDe(D, c.de);
  return { ...c, acero:c.acero || e?.acero || 'A36' };
}
// Filas de fuerzas: placa = reacciones de los nudos del pedestal; viga–columna y soldadura = extremos de los elementos del grupo del perfil
async function ctxE(){
  const ctx = { R:null, G:null };
  try{ ctx.R = await reacModelo(); }catch(e){ console.warn(e); }
  try{ ctx.G = await filasModelo(); }catch(e){ console.warn(e); }
  return ctx;
}
function filasExtremos(filas, extremo){
  const lim = {}; for(const f of filas){ const l = lim[f.F] = lim[f.F] || [Infinity, -Infinity]; l[0] = Math.min(l[0], f.st); l[1] = Math.max(l[1], f.st); }
  return filas.filter(f => { const l = lim[f.F]; const i = Math.abs(f.st - l[0]) < 1e-6, j = Math.abs(f.st - l[1]) < 1e-6; return extremo === 'i' ? i : extremo === 'j' ? j : i || j; });
}
function filasE(c, D, ctx){
  const man = c.man || {};
  if(c.tipo === 'placa'){
    if(c.cargas === 'manual') return [{ P:man.P, Mn:man.Mn, Mb:man.Mb, Vn:man.Vn, Vb:man.Vb, _t:'escritas a mano' }];
    const p = pedDe(D, c.a), nudos = p ? p.nudos : c.nudos, M = S.m.anexos?.C?.modelo, oy = c.ori !== 'x';
    return filasReac(ctx.R, nudos || [], combosD(D, M).res).map(f => ({ P:f.F3, Mn:oy ? f.M1 : f.M2, Mb:oy ? f.M2 : f.M1, Vn:oy ? f.F2 : f.F1, Vb:oy ? f.F1 : f.F2, _t:filaReacTxt(f) }));
  }
  if(c.cargas === 'manual') return [{ ...man, _t:'escritas a mano' }];
  const e = metDe(D, c.de); if(!e || e.fuerzas === 'manual'){ return e?.fuerzas === 'manual' ? [{ ...(c.tipo === 'vc' ? { M:e.manual.M3, V:e.manual.V2, P:e.manual.P } : { V:e.manual.V2, H:e.manual.V3, N:e.manual.P, T:e.manual.T, Mx:e.manual.M3, My:e.manual.M2 }), _t:'fuerzas del Anexo D (a mano)' }] : []; }
  const g = ctx.G?.[e.grupo]; if(!g) return [];
  return filasExtremos(g.filas, c.extremo).map(f => ({ ...(c.tipo === 'vc' ? { M:f.M3, V:f.V2, P:f.P } : { V:f.V2, H:f.V3, N:f.P, T:f.T, Mx:f.M3, My:f.M2 }), _t:filaTxt(f) }));
}
function correrE(c, D, filas){
  const inp = entradaE(c, D);
  if(c.tipo === 'placa'){ if(!inp._s) return { ok:false, error:'Escoge la columna (elemento del Anexo D).' }; return AnexoE.placaBase(inp, filas); }
  if(c.tipo === 'vc'){ if(!inp.viga || !inp.col) return { ok:false, error:'Escoge la viga y la columna (perfiles I del Anexo D).' }; return AnexoE.vigaColumna(inp, filas); }
  if(!filas.length) return { ok:false, error:'Faltan las cargas (escoge un perfil con fuerzas del modelo o escríbelas a mano).' };
  // soldadura: se revisa cada fila y se guarda la que controla
  const el = metDe(D, c.de), sI = c.forma === 'I' && el ? secDe(el) : null;
  if(sI?.tipo === 'I'){ inp.seg = AnexoE.contornoI(sI.b, sI.h, sI.tw, sI.tf); inp.b = sI.b; inp.d = sI.h; }   // contorno real del perfil
  let peor = null; for(const f of filas){ const X = AnexoE.soldadura({ ...inp, ...f }); if(!peor || X.ratio > peor.ratio){ peor = X; peor.fila = f; } }
  const checks = {}; peor.checks.forEach((k, i) => { checks['s' + i] = { ...k, fila:peor.fila }; });
  return { ...peor, tipo:'sold', checks, avisos:[], nFilas:filas.length };
}
function calcE(c, D, ctx){
  const filas = filasE(c, D, ctx);
  if(!filas.length && c.tipo !== 'sold'){ c.res = { ok:false, error: c.cargas === 'manual' ? 'Escribe las cargas.' : c.tipo === 'placa' ? 'Sin reacciones: revisa los nudos del pedestal y el archivo del modelo.' : 'El perfil no tiene fuerzas del modelo: escoge su grupo en el Anexo D o escribe las cargas.' }; return { ok:false, error:c.res.error }; }
  const X = correrE(c, D, filas);
  if(X.ok) X._filas = filas;
  c.res = X.ok ? { ok:true, ratio:+X.ratio.toFixed(3), cumple:X.cumple, fecha:new Date().toISOString() } : { ok:false, error:X.error };
  return X;
}

// ═══ Dibujos (a escala; las cotas con recuadro se tocan para cambiarlas) ═══
let _sid = 0;   // ids únicos de patrones y recortes en cada dibujo (pantalla e impresión a la vez)
const C_AZ = '#1d4ed8', C_RJ = '#dc2626', C_ST = '#334155', C_AC = '#94a3b8', C_SO = '#c2410c';
function cotaE(x1, y1, x2, y2, txt, key, o={}){
  const v = Math.abs(x1 - x2) < 0.5, mx = (x1 + x2)/2, my = (y1 + y2)/2, col = o.col || C_AZ, w = txt.length*6.1 + 10;
  const tick = v ? `<line x1="${x1-4}" y1="${y1}" x2="${x1+4}" y2="${y1}"/><line x1="${x2-4}" y1="${y2}" x2="${x2+4}" y2="${y2}"/>` : `<line x1="${x1}" y1="${y1-4}" x2="${x1}" y2="${y1+4}"/><line x1="${x2}" y1="${y2-4}" x2="${x2}" y2="${y2+4}"/>`;
  const box = key && o.ed ? `<rect x="${-w/2}" y="-8" width="${w}" height="16" rx="4" fill="#fff" stroke="${col}"/>` : `<rect x="${-w/2}" y="-8" width="${w}" height="16" fill="#fff" opacity=".85"/>`;
  return `<g stroke="${col}" stroke-width="1"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>${tick}</g>
    <g transform="translate(${mx + (o.dx || 0)},${my + (o.dy || 0)})${v ? ' rotate(-90)' : ''}" ${key && o.ed ? `class="cz" data-cota="${key}" role="button" tabindex="0" aria-label="Cambiar ${esc(txt)}"` : ''}>${box}
    <text y="4" text-anchor="middle" font-size="10.5" font-weight="700" fill="${col}">${esc(txt)}</text></g>`;
}
const svgE = (W, H, g, lbl) => `<svg viewBox="0 0 ${W} ${H}" class="e-svg" role="img" aria-label="${esc(lbl)}" font-family="Segoe UI,system-ui,sans-serif">${g}</svg>`;
function perfilI(cx, cy, b, h, tw, tf, fill, stroke){
  const L = cx - b/2, T = cy - h/2;
  return `<g fill="${fill}" stroke="${stroke}" stroke-width="1"><rect x="${L}" y="${T}" width="${b}" height="${tf}"/><rect x="${L}" y="${T + h - tf}" width="${b}" height="${tf}"/><rect x="${cx - tw/2}" y="${T + tf}" width="${tw}" height="${h - 2*tf}"/></g>`;
}
// Placa base en planta: pedestal (Wp × Lp), placa (B × N), columna (bf × d) y pernos
function svgPlacaPlanta(I, X, ed, f={}){
  const W = 360, H = 330, cx = 190, cy = 168, k = 230/Math.max(I.Lp, I.Wp, I.N, I.B, 1);
  const pw = I.Wp*k, ph = I.Lp*k, bw = I.B*k, bh = I.N*k, s1 = I.S1*k, s2 = I.S2*k, nB = Math.max(2, Math.round(numE(I.nB) || 2));
  const rb = Math.max(3.5, dPerno(I.perno)*k/2 + 1.5);
  const xs = Array.from({ length:nB }, (_, i) => cx - s2/2 + (nB > 1 ? i*s2/(nB - 1) : 0));
  const pern = [cy - s1/2, cy + s1/2].flatMap(y => xs.map(x => `<circle cx="${x}" cy="${y}" r="${rb}" fill="#fff" stroke="${f.perno ? C_RJ : '#111'}" stroke-width="2"/><circle cx="${x}" cy="${y}" r="1.6" fill="${f.perno ? C_RJ : '#111'}"/>`)).join('');
  const u = ++_sid, s = I._s, col = s ? perfilI(cx, cy, s.bf*k, s.d*k, Math.max(1.5, s.tw*k), Math.max(2, s.tf*k), '#94a3b8', C_ST) : '';
  const ped = !!I._p;
  return svgE(W, H, `<defs><pattern id="pt-conc${u}" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r=".7" fill="#94a3b8"/></pattern></defs>
    <text x="8" y="14" font-size="10" font-weight="700" fill="#64748b">PLANTA</text>
    <rect x="${cx - pw/2}" y="${cy - ph/2}" width="${pw}" height="${ph}" fill="url(#pt-conc${u})" stroke="#64748b"/>
    <rect x="${cx - bw/2}" y="${cy - bh/2}" width="${bw}" height="${bh}" fill="${f.placa ? '#fee2e2' : '#e2e8f0'}" stroke="${f.placa ? C_RJ : C_ST}" stroke-width="1.6"/>
    ${col}${pern}
    ${cotaE(cx - pw/2, cy - ph/2 - 14, cx + pw/2, cy - ph/2 - 14, `${ped ? 'pedestal ' : 'Wp '}${fx(I.Wp,0)}`, ped ? null : 'Wp', { ed })}
    ${cotaE(cx + pw/2 + 14, cy - ph/2, cx + pw/2 + 14, cy + ph/2, `${ped ? 'pedestal ' : 'Lp '}${fx(I.Lp,0)}`, ped ? null : 'Lp', { ed })}
    ${cotaE(cx - bw/2, cy + bh/2 + 13, cx + bw/2, cy + bh/2 + 13, `B ${fx(I.B,0)}`, 'B', { ed })}
    ${cotaE(cx - pw/2 - 14, cy - bh/2, cx - pw/2 - 14, cy + bh/2, `N ${fx(I.N,0)}`, 'N', { ed })}
    ${cotaE(xs[0], cy - s1/2 - rb - 9, xs[nB - 1], cy - s1/2 - rb - 9, `S2 ${fx(I.S2,0)}`, 'S2', { ed, col:C_SO })}
    ${cotaE(cx - bw/2 + 10, cy - s1/2, cx - bw/2 + 10, cy + s1/2, `S1 ${fx(I.S1,0)}`, 'S1', { ed, col:C_SO, dx:-2 })}
    <text x="${W/2}" y="${H - 4}" text-anchor="middle" font-size="9.5" fill="#64748b">${esc(s?.n || 'columna')} · N en el sentido del peralte d · medidas en mm</text>`, 'Placa base en planta');
}
// Placa base en alzado (corte en el sentido de N): pernos con hef y cono de arrancamiento
function svgPlacaAlzado(I, X, ed, f={}){
  const W = 320, H = 330, cx = 165, top = 120, k = Math.min(250/Math.max(I.Lp, 1), 185/Math.max(numE(I.hef) + 60, 1));
  const pw = I.Lp*k, s1 = I.S1*k, hef = numE(I.hef)*k, tp = Math.max(4, numE(I.tp)*k), d = (I._s?.d || 200)*k, bw = I.N*k;
  const u = ++_sid, hp = Math.min(H - top - 30, Math.max(hef + 30, 120)), xs = [cx - s1/2, cx + s1/2];
  const cono = xs.map(x => { const o = x < cx ? -1 : 1, h15 = Math.min(1.5*numE(I.hef)*k, pw); return `<polyline points="${x + o*(-4)},${top + hef} ${x + o*h15},${top}" fill="none" stroke="${f.cono ? C_RJ : '#64748b'}" stroke-width="${f.cono ? 1.8 : 1}" stroke-dasharray="5 3"/>`; }).join('');
  const varilla = xs.map(x => `<line x1="${x}" y1="${top - tp - 12}" x2="${x}" y2="${top + hef}" stroke="${f.perno ? C_RJ : '#111'}" stroke-width="3"/>
    ${I.cabeza === 'gancho' ? `<path d="M${x},${top + hef} q0,10 ${x < cx ? 10 : -10},10" fill="none" stroke="${f.perno ? C_RJ : '#111'}" stroke-width="3"/>` : `<rect x="${x - 7}" y="${top + hef - 2}" width="14" height="5" fill="${f.perno ? C_RJ : '#111'}"/>`}
    <rect x="${x - 6}" y="${top - tp - 8}" width="12" height="6" fill="#111"/>`).join('');
  return svgE(W, H, `<defs><clipPath id="cp-ped${u}"><rect x="${cx - pw/2}" y="${top}" width="${pw}" height="${hp}"/></clipPath><pattern id="pt-conc2${u}" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r=".7" fill="#94a3b8"/></pattern></defs>
    <text x="8" y="14" font-size="10" font-weight="700" fill="#64748b">CORTE</text>
    <rect x="${cx - d/2}" y="26" width="${d}" height="${top - tp - 26}" fill="#94a3b8" stroke="${C_ST}"/><text x="${cx}" y="${(26 + top)/2}" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">${esc(I._s?.n || 'columna')}</text>
    <path d="M${cx - 5},12 L${cx + 5},12 L${cx},24 Z" fill="${C_RJ}"/><text x="${cx + 9}" y="20" font-size="9.5" font-weight="700" fill="${C_RJ}">Pu, Mu, Vu</text>
    <rect x="${cx - pw/2}" y="${top}" width="${pw}" height="${hp}" fill="url(#pt-conc2${u})" stroke="#64748b"/>
    <rect x="${cx - bw/2}" y="${top - tp}" width="${bw}" height="${tp}" fill="${f.placa ? '#fee2e2' : '#334155'}" stroke="${f.placa ? C_RJ : C_ST}"/>
    ${f.sold ? `<path d="M${cx - d/2 - 5},${top - tp} l5,-5 v5 Z M${cx + d/2 + 5},${top - tp} l-5,-5 v5 Z" fill="${C_RJ}"/>` : `<path d="M${cx - d/2 - 5},${top - tp} l5,-5 v5 Z M${cx + d/2 + 5},${top - tp} l-5,-5 v5 Z" fill="${C_SO}"/>`}
    <g clip-path="url(#cp-ped${u})">${cono}</g>${varilla}
    ${cotaE(cx + pw/2 + 14, top, cx + pw/2 + 14, top + hef, `hef ${fx(numE(I.hef),0)}`, 'hef', { ed })}
    ${cotaE(cx - bw/2 - 30, top - tp, cx - bw/2 - 30, top, `tp ${fx(numE(I.tp),1)}`, 'tp', { ed, dx:-10 })}
    <text x="${cx}" y="${top + hp - 6}" text-anchor="middle" font-size="9.5" fill="${f.cono ? C_RJ : '#64748b'}" font-weight="${f.cono ? 700 : 400}">cono de arrancamiento${f.cono ? ' — no cumple' : ''}</text>`, 'Placa base en corte');
}
// Viga – columna en alzado: cubrejuntas arriba y abajo con pernos, cartela a cortante y soldaduras
function svgVC(I, X, ed, f={}){
  const W = 400, H = 300, v = I.viga, c = I.col; if(!v || !c) return '';
  const pl = I.pl, pc = I.pc, ct = I.ct, k = Math.min(210/(v.h + 2*numE(pl.t) + 40), 270/(c.h + numE(pl.L) + 60));
  const x0 = 30, xc = x0 + c.h*k, cy = 150, hb = v.h*k, tp = Math.max(3, numE(pl.t)*k), L = numE(pl.L)*k;
  const top = cy - hb/2, bot = cy + hb/2, nc = Math.max(1, Math.round(numE(pc.nc))), lu = numE(pc.lu)*k, s = numE(pc.s)*k;
  const xb = i => xc + lu + i*s, pr = Math.max(2.5, dPerno(pc.d)*k/2);
  const bolts = (y, h) => Array.from({ length:nc }, (_, i) => `<line x1="${xb(i)}" y1="${y - 4}" x2="${xb(i)}" y2="${y + h + 4}" stroke="${f.perno ? C_RJ : '#111'}" stroke-width="${Math.max(2, pr)}"/>`).join('');
  const hct = numE(ct.h)*k, bct = numE(ct.b)*k, et = numE(ct.e)*k, nt = Math.max(1, Math.round(numE(ct.n))), st = numE(ct.s)*k;
  const ctB = Array.from({ length:nt }, (_, i) => `<circle cx="${xc + et}" cy="${cy - (nt - 1)*st/2 + i*st}" r="${Math.max(2.5, pr)}" fill="${f.pernoCt ? C_RJ : '#111'}"/>`).join('');
  const colF = f.col ? '#fecaca' : '#94a3b8', tfc = Math.max(2, c.tf*k);
  return svgE(W, H, `<text x="8" y="14" font-size="10" font-weight="700" fill="#64748b">ALZADO</text>
    <rect x="${x0}" y="20" width="${c.h*k}" height="${H - 50}" fill="#e2e8f0" stroke="${f.col ? C_RJ : C_ST}"/>
    <rect x="${x0}" y="20" width="${tfc}" height="${H - 50}" fill="${colF}" stroke="${C_ST}"/><rect x="${xc - tfc}" y="20" width="${tfc}" height="${H - 50}" fill="${colF}" stroke="${C_ST}"/>
    <text x="${x0 + c.h*k/2}" y="${H - 18}" text-anchor="middle" font-size="9.5" fill="#475569">${esc(c.n)}</text>
    <rect x="${xc + 4}" y="${top}" width="${W - xc - 12}" height="${hb}" fill="#cbd5e1" stroke="${C_ST}"/>
    <rect x="${xc + 4}" y="${top}" width="${W - xc - 12}" height="${Math.max(2, v.tf*k)}" fill="#94a3b8"/><rect x="${xc + 4}" y="${bot - Math.max(2, v.tf*k)}" width="${W - xc - 12}" height="${Math.max(2, v.tf*k)}" fill="#94a3b8"/>
    <text x="${W - 12}" y="${cy + 4}" text-anchor="end" font-size="9.5" fill="#475569">${esc(v.n)}</text>
    <rect x="${xc}" y="${top - tp}" width="${L}" height="${tp}" fill="${f.pl ? C_RJ : '#1e40af'}"/><rect x="${xc}" y="${bot}" width="${L}" height="${tp}" fill="${f.pl ? C_RJ : '#1e40af'}"/>
    ${bolts(top - tp, tp + Math.max(2, v.tf*k))}${bolts(bot - Math.max(2, v.tf*k), tp + Math.max(2, v.tf*k))}
    <rect x="${xc}" y="${cy - hct/2}" width="${bct}" height="${hct}" fill="${f.ct ? '#fecaca' : '#3b82f6'}" fill-opacity=".75" stroke="${f.ct ? C_RJ : '#1e3a8a'}"/>${ctB}
    <path d="M${xc},${top - tp} l-6,-6 v6 Z M${xc},${bot + tp} l-6,6 v-6 Z" fill="${f.sold ? C_RJ : C_SO}"/><path d="M${xc},${cy - hct/2} l-5,-5 v${hct + 10} l5,-5 Z" fill="${f.soldCt ? C_RJ : C_SO}" opacity=".8"/>
    ${cotaE(xc, top - tp - 26, xc + L, top - tp - 26, `cubrejunta ${fx(numE(pl.L),0)}`, 'pl.L', { ed })}
    ${cotaE(xc, top - tp - 10, xb(0), top - tp - 10, `${fx(numE(pc.lu),0)}`, 'pc.lu', { ed, col:C_SO })}
    ${nc > 1 ? cotaE(xb(0), bot + tp + 12, xb(1), bot + tp + 12, `s ${fx(numE(pc.s),0)}`, 'pc.s', { ed, col:C_SO }) : ''}
    ${cotaE(xc + bct + 12, cy - hct/2, xc + bct + 12, cy + hct/2, `cartela ${fx(numE(ct.h),0)}`, 'ct.h', { ed })}
    ${cotaE(xc, bot + tp + 30, xc + et, bot + tp + 30, `e ${fx(numE(ct.e),0)}`, 'ct.e', { ed, col:C_SO })}
    <text x="${xc + L + 6}" y="${top - tp + 2}" font-size="9.5" fill="${f.pl ? C_RJ : '#1e40af'}">t ${fx(numE(pl.t),1)} · ${nc}×${Math.max(1, Math.round(numE(pc.nf)))} pernos ${esc(pc.d)}</text>`, 'Conexión viga – columna en alzado');
}
// Soldadura: forma a escala, centroide y punto crítico
function svgSold(I, R, ed, falla){
  const W = 330, H = 300, fm = AnexoE.FORMAS[I.forma] || AnexoE.FORMAS.O, b = numE(I.b) || 100, d = numE(I.d) || 100;
  const seg = I.forma === 'I' && I._sec ? AnexoE.contornoI(I._sec.b, I._sec.h, I._sec.tw, I._sec.tf) : fm.seg(b, d);
  const ancho = I.forma === 'c' ? d : b, k = Math.min(200/Math.max(ancho, 1), 200/Math.max(d, 1)), ox = (W - ancho*k)/2, oy = 40 + d*k;
  const Q = y => oy - y*k;
  const fondo = I._sec && I.forma === 'I' ? perfilI(ox + b*k/2, oy - d*k/2, I._sec.b*k, I._sec.h*k, Math.max(2, I._sec.tw*k), Math.max(2, I._sec.tf*k), '#e2e8f0', '#94a3b8')
    : I.forma === 'c' ? `<circle cx="${ox + d*k/2}" cy="${oy - d*k/2}" r="${d*k/2}" fill="#e2e8f0" stroke="#94a3b8"/>` : `<rect x="${ox}" y="${oy - d*k}" width="${b*k}" height="${d*k}" fill="#e2e8f0" stroke="#94a3b8"/>`;
  const col = falla ? C_RJ : C_SO;
  const lineas = seg.map(([x1, y1, x2, y2]) => `<line x1="${ox + x1*k}" y1="${Q(y1)}" x2="${ox + x2*k}" y2="${Q(y2)}" stroke="${col}" stroke-width="5" stroke-linecap="round"/>`).join('');
  const g = R?.P ? `<g stroke="#0f172a" stroke-width="1"><line x1="${ox + R.P.xg*k - 7}" y1="${Q(R.P.yg)}" x2="${ox + R.P.xg*k + 7}" y2="${Q(R.P.yg)}"/><line x1="${ox + R.P.xg*k}" y1="${Q(R.P.yg) - 7}" x2="${ox + R.P.xg*k}" y2="${Q(R.P.yg) + 7}"/></g><text x="${ox + R.P.xg*k + 9}" y="${Q(R.P.yg) - 6}" font-size="9.5" fill="#0f172a">G</text>` : '';
  const pc = R?.peor ? `<circle cx="${ox + R.peor.x*k}" cy="${Q(R.peor.y)}" r="6" fill="none" stroke="${C_RJ}" stroke-width="2"/><text x="${ox + R.peor.x*k + 8}" y="${Q(R.peor.y) + 14}" font-size="9.5" font-weight="700" fill="${C_RJ}">punto crítico</text>` : '';
  const sec = !!I._sec && I.forma === 'I';
  return svgE(W, H, `<text x="8" y="14" font-size="10" font-weight="700" fill="#64748b">${esc(fm.n.toUpperCase())}</text>${fondo}${lineas}${g}${pc}
    ${I.forma !== 'c' && I.forma !== '1' && I.forma !== 'T' ? cotaE(ox, oy + 16, ox + b*k, oy + 16, `b ${fx(b,0)}`, sec ? null : 'b', { ed }) : ''}
    ${cotaE(ox - 16, oy - d*k, ox - 16, oy, `${I.forma === 'c' ? 'Ø' : I.forma === '1' || I.forma === 'T' ? 'L' : 'd'} ${fx(d,0)}`, sec ? null : 'd', { ed })}
    <g transform="translate(${W - 62},${H - 40})" ${ed && I.forma !== 'T' ? 'class="cz" data-cota="w" role="button" tabindex="0" aria-label="Cambiar el tamaño del filete"' : ''}><rect x="-50" y="-11" width="100" height="22" rx="5" fill="#fff" stroke="${col}"/><text y="4" text-anchor="middle" font-size="10.5" font-weight="700" fill="${col}">${I.forma === 'T' ? 'penetración total' : `filete w ${fx(numE(I.w),0)} mm`}</text></g>`, 'Soldadura');
}
const svgSoldX = (I, R, ed, falla) => svgSold(I, R, ed, falla);

// Fallas que se pintan en rojo sobre el dibujo
function fallasE(X){
  if(!X?.ok) return {};
  const r = k => (X.checks[k]?.r || 0) > 1;
  if(X.tipo === 'placa') return { perno:r('ten') || r('pull') || r('vs') || r('int') || r('sb'), placa:r('tp') || r('apl') || r('geo'), cono:r('cono') || r('vb') || r('vcp') || r('sb'), sold:r('sold') };
  if(X.tipo === 'vc') return { perno:r('perno') || r('aplPl') || r('aplAla'), pl:r('ten') || r('bloq') || r('comp') || r('aplPl'), col:r('alaCol') || r('almaFl') || r('almaApl') || r('panel'), sold:r('sold'), pernoCt:r('pernoCt') || r('aplCt'), ct:r('cortCt') || r('bloqCt'), soldCt:r('soldCt') };
  return { falla:!X.cumple };
}
function dibujosE(c, D, X, ed){
  const I = entradaE(c, D), f = fallasE(X);
  if(c.tipo === 'placa') return `<div class="e-dib">${svgPlacaPlanta(I, X, ed, f)}${svgPlacaAlzado(I, X, ed, f)}</div>`;
  if(c.tipo === 'vc') return `<div class="e-dib one">${svgVC(I, X, ed, f) || '<p class="hint">Escoge la viga y la columna para ver el dibujo.</p>'}</div>`;
  const e = metDe(D, c.de), s = e ? secDe(e) : null;
  return `<div class="e-dib one">${svgSoldX({ ...I, _sec:s?.tipo === 'I' ? s : null }, X?.ok ? X : null, ed, f.falla)}</div>`;
}
// Miniaturas de la galería
function miniE(tipo){
  const D = { met:[], ped:[] };
  if(tipo === 'placa'){ const I = { N:300, B:300, Lp:420, Wp:420, S1:220, S2:200, nB:2, perno:'5/8"', hef:300, tp:12.7, _s:{ bf:200, d:190, tw:6.5, tf:10, n:'HEA 200' } }; return svgPlacaPlanta(I, null, false); }
  if(tipo === 'vc'){ const I = { viga:AnexoD.secI('IPE 240'), col:AnexoD.secI('HEA 200'), pl:{ L:250, t:9.525 }, pc:{ nc:4, nf:2, lu:40, s:50, d:'5/8"' }, ct:{ h:110, b:90, e:50, n:2, s:50 } }; return svgVC(I, null, false); }
  return svgSoldX({ forma:'I', b:200, d:190, w:6, _sec:AnexoD.secI('HEA 200') }, null, false);
}

// ═══ Pantalla ═══
function paneAnexoE(){
  const E = datosE(), D = datosD(), ing = esIng();
  const sel = E.con.find(c => c.id === selE) || E.con[0]; selE = sel?.id || null;
  const gal = ing ? `<div class="card"><div class="ct">Agregar conexión <span class="hint" style="text-transform:none;letter-spacing:0">toca el tipo</span></div>
    <div class="e-gal">${Object.entries(TIPOS_E).map(([k, t]) => `<button type="button" class="e-tc" data-nueva="${k}">${miniE(k)}<b>${t.n}</b><span>${t.s}</span></button>`).join('')}</div>
    ${!D.met.length ? '<div class="note amber" style="margin-top:8px">Primero crea los perfiles y pedestales en el Anexo D: las conexiones toman de ahí sus medidas y sus fuerzas.</div>' : ''}</div>` : '';
  const lista = `${E.con.map(c => `<button type="button" class="d-el ${c.id === selE ? 'on' : ''}" data-sele="${c.id}"><span><b>${esc(c.nom)}</b> ${esc(TIPOS_E[c.tipo].n)}
      <small class="e-lbl">${esc(etiquetaE(c, D))}</small>${c.desc ? `<small>${esc(c.desc)}</small>` : ''}</span>${pillRes(c.res)}</button>`).join('')}
    ${!E.con.length ? '<p class="hint">Aún no hay conexiones.</p>' : ''}
    ${ing && E.con.length > 1 ? '<button class="btn sm" type="button" id="eOrdenar" style="width:100%;margin-top:6px">↓ Ordenar por nombre (menor a mayor)</button>' : ''}`;
  pane(`${gal}<div class="d-grid"><div class="d-lista">${lista}</div><div id="eDet">${sel ? detEHTML(sel, D) : '<div class="card"><p class="muted">Agrega una conexión desde la galería.</p></div>'}</div></div>`);
  $$('[data-sele]').forEach(b => b.onclick = () => { selE = b.dataset.sele; tabE = 0; paneAnexoE(); });
  if(ing){
    $$('[data-nueva]').forEach(b => b.onclick = () => { const c = nuevaCon(b.dataset.nueva, E, D); E.con.push(c); selE = c.id; tabE = 0; guardarMemoria(); paneAnexoE(); toast(`${c.nom} creada: ${etiquetaE(c, D)}.`); });
    if($('#eOrdenar')) $('#eOrdenar').onclick = () => { ordenNombre(E.con); guardarMemoria(); paneAnexoE(); toast('Lista ordenada por nombre.'); };
  }
  if(sel) activarE(sel, D);
}
const TABS_E = { placa:['Placa y pedestal', 'Pernos de anclaje', 'Soldadura columna–placa', 'Cargas'], vc:['Perfiles y cubrejuntas', 'Pernos', 'Cartela a cortante', 'Soldaduras', 'Cargas'], sold:['Forma y medidas', 'Cargas'] };
function detEHTML(c, D){
  const ro_ = esIng() ? '' : 'disabled', tabs = TABS_E[c.tipo]; if(tabE >= tabs.length) tabE = 0;
  return `<div class="card"><div class="ct"><span>${esc(c.nom)} · ${esc(TIPOS_E[c.tipo].n)}</span>${esIng() ? '<button class="btn sm danger" type="button" id="eBorrar">Borrar</button>' : ''}</div>
    <div class="e-tag">🔗 <b id="eTag">${esc(etiquetaE(c, D))}</b></div>
    <div id="eDib">${dibujosE(c, D, null, esIng())}</div>
    ${esIng() ? '<p class="hint" style="margin:4px 0 10px">Toca una cota con recuadro para cambiarla; el dibujo se redibuja a escala. Lo que no cumple se pinta en rojo.</p>' : ''}
    <div class="e-ed"><div>
      <div class="tabs" role="tablist" style="margin-bottom:8px">${tabs.map((t, i) => `<button type="button" role="tab" data-tabe="${i}" class="${tabE === i ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div id="eForm">${formE(c, D, tabE, ro_)}</div>
    </div><div><div id="eRes"><p class="muted">Calculando…</p></div></div></div>
    <div id="eDet2"></div></div>`;
}
const optE = (v, t, cur) => `<option value="${esc(v)}" ${String(cur) === String(v) ? 'selected' : ''}>${esc(t)}</option>`;
const selE_ = (o, p, l, opts, h) => `<div class="f"><label>${l}</label><select data-a="${p}" ${esIng() ? '' : 'disabled'}>${opts.map(([v, t]) => optE(v, t, getP(o, p))).join('')}</select>${h ? `<div class="hint">${h}</div>` : ''}</div>`;
const kv = o => Object.keys(o).map(k => [k, k]);
function formE(c, D, t, ro_){
  const mets = D.met.map(e => [e.id, `${e.nom} · ${nomSec(e)}${e.desc ? ' · ' + e.desc : ''}`]);
  const comun = `<div class="fg g4">${fIn(c,'nom','Nombre',{num:false})}${fIn(c,'desc','Descripción',{num:false,ph:'Columnas centrales…'})}${fIn(c,'etiqueta','Etiqueta (qué une)',{num:false,cls:'span2',ph:etiquetaE({ ...c, etiqueta:'' }, D),h:'Vacío = se arma sola con los elementos escogidos'})}</div>`;
  const placas = PLACAS.map(([n, v]) => [v, `${n} (${v} mm)`]);
  const pernos = kv(AnexoE.PERNOS), elec = kv(AnexoE.ELECTRODOS), aceros = kv(AnexoE.ACEROS);
  if(c.tipo === 'placa'){
    if(t === 0) return `${comun}<div class="fg g4">${selE_(c,'de','Columna (Anexo D)',[['','— escoge —'], ...mets])}${selE_(c,'a','Pedestal (Anexo D)',[['','— medidas a mano —'], ...D.ped.map(p => [p.id, `${p.nom} · ${p.b}×${p.h} mm`])])}
        ${selE_(c,'ori','Peralte d de la columna paralelo a',[['y','eje Y del modelo (h del pedestal)'],['x','eje X del modelo (b del pedestal)']])}${fIn(c,'plN','Nombre de la placa',{num:false})}</div>
      <div class="fg g4">${fIn(c,'N','N placa [mm] (sentido de d)')}${fIn(c,'B','B placa [mm]')}${selE_(c,'tp','Espesor de la placa',placas)}${selE_(c,'aceroPlaca','Acero de la placa',aceros)}</div>
      ${c.a ? '' : `<div class="fg g4">${fIn(c,'Lp','Pedestal en el sentido de N [mm]')}${fIn(c,'Wp','Pedestal en el sentido de B [mm]')}${fIn(c,'ha','Altura del pedestal [mm]')}${fIn(c,'fc',"f'c [MPa]")}</div>`}`;
    if(t === 1) return `<div class="fg g4">${selE_(c,'perno','Diámetro del perno',pernos)}${selE_(c,'anclaje','Acero del anclaje',kv(AnexoE.ANCLAJES))}${fIn(c,'nB','Pernos por fila (2 filas)')}${fIn(c,'hef','Longitud embebida hef [mm]')}</div>
      <div class="fg g4">${fIn(c,'S1','S1 entre filas [mm] (sentido N)')}${fIn(c,'S2','S2 entre pernos extremos [mm]')}${selE_(c,'cabeza','Extremo del perno',[['tuerca','Tuerca y arandela'],['gancho','Gancho en J']])}${c.cabeza === 'gancho' ? fIn(c,'eh','Largo del gancho eh [mm]',{ph:'4.5·d'}) : fIn(c,'arandela','Lado de la arandela embebida [mm]')}</div>
      <div class="fg g4">${fChk(c,'fisurado','Concreto fisurado (del lado seguro)')}${fChk(c,'mortero','Mortero de nivelación bajo la placa (cortante × 0.8)')}</div>`;
    if(t === 2) return `<div class="fg g4">${fIn(c,'w','Pierna del filete w [mm]',{h:'0 = sin revisar'})}${selE_(c,'electrodo','Electrodo',elec)}</div><p class="hint">Se revisa el contorno real del perfil (alas por fuera y por dentro + alma a ambos lados) con el método de la línea, con las mismas combinaciones.</p>`;
    return cargasE(c, D);
  }
  if(c.tipo === 'vc'){
    if(t === 0) return `${comun}<div class="fg g4">${selE_(c,'de','Viga (Anexo D)',[['','— escoge —'], ...mets])}${selE_(c,'a','Columna (Anexo D)',[['','— escoge —'], ...mets])}</div>
      <h4 class="sub">Cubrejuntas (arriba y abajo)</h4><div class="fg g4">${fIn(c,'pl.L','Largo [mm]')}${fIn(c,'pl.b','Ancho [mm]')}${selE_(c,'pl.t','Espesor',placas)}${selE_(c,'pl.acero','Acero',aceros)}</div>`;
    if(t === 1) return `<div class="fg g4">${selE_(c,'pc.d','Diámetro',pernos)}${selE_(c,'pc.tipo','Tipo',kv(AnexoE.TIPOS_PERNO))}${fIn(c,'pc.nf','Filas a lo ancho')}${fIn(c,'pc.nc','Pernos por fila')}</div>
      <div class="fg g4">${fIn(c,'pc.s','Separación s [mm]')}${fIn(c,'pc.le','Distancia al borde [mm]')}${fIn(c,'pc.g','Gramil g [mm]')}${fIn(c,'pc.lu','Cara de la columna al 1er perno [mm]')}</div>
      <div class="fg g4">${fChk(c,'pc.rosca','Rosca en el plano de corte')}</div>`;
    if(t === 2) return `<div class="fg g4">${fIn(c,'ct.h','Alto [mm]')}${fIn(c,'ct.b','Ancho [mm]')}${selE_(c,'ct.t','Espesor',placas)}${selE_(c,'ct.acero','Acero',aceros)}</div>
      <div class="fg g4">${selE_(c,'ct.d','Diámetro del perno',pernos)}${selE_(c,'ct.tipo','Tipo',kv(AnexoE.TIPOS_PERNO))}${fIn(c,'ct.n','Número de pernos')}${fIn(c,'ct.s','Separación [mm]')}</div>
      <div class="fg g4">${fIn(c,'ct.le','Distancia al borde [mm]')}${fIn(c,'ct.e','Excentricidad e (pernos a la soldadura) [mm]')}${fChk(c,'ct.rosca','Rosca en el plano de corte')}</div>`;
    if(t === 3) return `<div class="fg g4">${fIn(c,'wPl','Filete cubrejunta–columna [mm]')}${fIn(c,'wCt','Filete cartela–columna [mm]')}${selE_(c,'electrodo','Electrodo',elec)}</div>`;
    return cargasE(c, D);
  }
  if(t === 0){
    const e = metDe(D, c.de), s = e ? secDe(e) : null, I = s?.tipo === 'I' && c.forma === 'I';
    return `${comun}<div class="fg g4">${selE_(c,'de','Elemento soldado (Anexo D)',[['','— escoge —'], ...mets])}${selE_(c,'a','Se suelda a',[['PL', `Platina (${c.plN || 'PL'})`], ...D.met.filter(x => x.id !== c.de).map(x => [x.id, `${x.nom} · ${nomSec(x)}`]), ...D.ped.map(p => [p.id, p.nom])])}${c.a === 'PL' ? fIn(c,'plN','Nombre de la platina',{num:false}) : ''}</div>
      <div class="e-formas">${Object.entries(AnexoE.FORMAS).map(([k, f]) => `<button type="button" class="e-fm ${c.forma === k ? 'on' : ''}" data-forma="${k}" ${ro_}>${svgFormaMini(k)}<span>${esc(f.n)}</span></button>`).join('')}</div>
      <div class="fg g4">${I ? `<div class="hint" style="align-self:center">Medidas del perfil ${esc(s.n)}: contorno real.</div>` : fIn(c,'b','b [mm]') + fIn(c,'d', c.forma === 'c' ? 'Diámetro [mm]' : c.forma === '1' || c.forma === 'T' ? 'Largo L [mm]' : 'd [mm]')}
        ${c.forma === 'T' ? '' : fIn(c,'w','Pierna del filete w [mm]')}${fIn(c,'t','Espesor menor unido t [mm]')}</div>
      <div class="fg g4">${selE_(c,'electrodo','Electrodo',elec)}${selE_(c,'acero','Acero del metal base',aceros)}</div>
      <p class="hint">A<sub>u</sub> = ${esc(AnexoE.FORMAS[c.forma]?.au || '')} · J<sub>u</sub> = ${esc(AnexoE.FORMAS[c.forma]?.ju || '')} (por unidad de garganta). El cálculo usa la geometría exacta de los cordones.</p>`;
  }
  return cargasE(c, D);
}
function svgFormaMini(k){
  const f = AnexoE.FORMAS[k], seg = k === 'I' ? AnexoE.contornoI(40, 40, 4, 5).slice(0, 2).concat([[18, 0, 18, 40], [22, 0, 22, 40]]) : f.seg(40, 40), sc = 1;
  return `<svg viewBox="-6 -6 52 52" width="44" height="44" aria-hidden="true"><rect x="0" y="0" width="40" height="40" fill="#f1f5f9" stroke="#cbd5e1"/>${seg.map(([a, b, c2, d]) => `<line x1="${a*sc}" y1="${40 - b*sc}" x2="${c2*sc}" y2="${40 - d*sc}" stroke="${C_SO}" stroke-width="${k === 'T' ? 6 : 4}" stroke-linecap="round"/>`).join('')}</svg>`;
}
function cargasE(c, D){
  const ro_ = esIng() ? '' : 'disabled', M = S.m.anexos?.C?.modelo;
  const seg = `<div class="seg" role="group" style="margin-bottom:8px"><button type="button" data-carg="modelo" class="${c.cargas !== 'manual' ? 'on' : ''}" ${ro_}>Del modelo</button><button type="button" data-carg="manual" class="${c.cargas === 'manual' ? 'on' : ''}" ${ro_}>Escribir a mano</button></div>`;
  if(c.cargas === 'manual'){
    const k = c.tipo === 'placa' ? [['P','Pu [kN] (+ compresión)'],['Mn','Mu sentido N [kN·m]'],['Mb','Mu sentido B [kN·m]'],['Vn','Vu sentido N [kN]'],['Vb','Vu sentido B [kN]']]
      : c.tipo === 'vc' ? [['M','Mu [kN·m]'],['V','Vu [kN]'],['P','Pu axial de la viga [kN]']]
      : [['V','V (en el plano, eje y) [kN]'],['H','H (en el plano, eje x) [kN]'],['T','T torsión en el plano [kN·m]'],['N','N normal al plano [kN]'],['Mx','Mx (alrededor de x) [kN·m]'],['My','My (alrededor de y) [kN·m]']];
    return seg + `<div class="fg g4">${k.map(([a, l]) => fIn(c, 'man.' + a, l)).join('')}</div><p class="hint">Cargas mayoradas (resistencia).</p>`;
  }
  if(c.tipo === 'placa'){
    const p = pedDe(D, c.a);
    if(p) return seg + `<p class="hint">Se usan las reacciones de los nudos del pedestal ${esc(p.nom)} (${esc((p.nudos || []).join(', ') || 'sin nudos')}) en las combinaciones de resistencia escogidas en el Anexo D. F3 = carga axial; los momentos y cortantes se asignan según la orientación de la columna.</p>`;
    return seg + (M?.reac?.nudos?.length ? nudosHTML(c, M) : '<div class="note amber">El modelo no trae reacciones.</div>');
  }
  const e = metDe(D, c.de);
  return seg + `<div class="fg g4">${selE_(c,'extremo','Extremos de los elementos',[['ambos','Ambos extremos (el que controle)'],['i','Solo el extremo inicial (i)'],['j','Solo el extremo final (j)']])}</div>
    <p class="hint">${e ? `Fuerzas del grupo de ${esc(e.nom)} (${esc(e.grupo ? e.grupo.replace('|', ' · ') : 'sin grupo')}) en los extremos de cada elemento, en las combinaciones de resistencia del Anexo C. ${c.tipo === 'vc' ? 'Mu = M3, Vu = V2, Pu = P.' : 'V = V2, H = V3, N = P, T = T, Mx = M3, My = M2.'}` : 'Escoge el elemento.'}</p>`;
}

// ─── Resultados ───
const CHK_E_U = { N:v => fx(v/1e3,2) + ' kN', 'N/mm':v => fx(v,1) + ' N/mm', MPa:v => fx(v,1) + ' MPa', mm:v => fx(v,1) + ' mm', '':v => fx(v,3) };
function filasChkE(X, imp, sg){
  return Object.entries(X.checks).map(([k, ch]) => {
    const u = CHK_E_U[ch.u] || CHK_E_U[''], cumple = ch.r <= 1 + 1e-9;
    const dem = ch.soloOk ? (k === 'geo' ? (cumple ? 'cabe' : 'no cabe') : u(ch.dem)) : k === 'tp' ? `t req = ${fx(ch.req,1)} mm` : u(ch.dem);
    const cap = ch.soloOk ? (k === 'geo' ? '—' : u(ch.cap)) : k === 'tp' ? `(t req/t)² ≤ 1` : ch.u === '' ? '≤ 1.00' : u(ch.cap);
    const rel = imp ? fx(ch.r,3) : barra3(ch.r), ok = imp ? (cumple ? 'Cumple' : '<b>No cumple</b>') : pill(cumple ? 'ok' : 'no', cumple ? 'Cumple' : 'No cumple') + (!cumple && sg ? sg(k) : '');
    return [`${ch.n} <span class="${imp ? '' : 'hint'}">${imp ? '(' + ch.ref + ')' : ch.ref}</span>`, dem, cap, ch.soloOk ? '' : rel, ok, `<span class="ids">${esc(ch.fila?.fl?._t || ch.fila?._t || '')}</span>`];
  });
}
function resEHTML(c, X, imp, sg){
  if(!imp){   // pantalla: lista compacta (nombre, demanda / capacidad, barra, estado y 💡)
    const fl = filasChkE(X, false, sg);
    return `<div class="e-cks">${fl.map(r => `<div class="e-ck"><div class="e-ckn">${r[0]}<small>${r[1]}${r[2] ? ' / ' + r[2] : ''}${r[5].includes('</span>') && r[5].length > 25 ? ' · ' + r[5] : ''}</small></div><div class="e-ckr">${r[3]} ${r[4]}</div></div>`).join('')}</div>
      <div class="wtot" style="background:${X.cumple ? '' : '#b91c1c'}"><span>Relación máxima (${X._filas?.length || 0} combinaciones)</span><span>${fx(X.ratio,3)} — ${X.cumple ? 'CUMPLE' : 'NO CUMPLE'}</span></div>
      ${(X.avisos || []).map(a => `<p class="note amber" style="margin-top:6px">${esc(a)}</p>`).join('')}`;
  }
  const T = imp ? (cab, filas) => `<table class="ax-tb"><thead><tr>${cab.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${filas.map(r => `<tr>${r.map((x,i) => `<td class="${i?'c':''}">${x}</td>`).join('')}</tr>`).join('')}</tbody></table>` : tabla;
  const n = X._filas?.length || 0;
  return `${T(['Chequeo','Demanda','Capacidad','Relación','','Combinación que controla'], filasChkE(X, imp, sg))}
    ${imp ? `<div class="ax-box">Relación máxima = ${fx(X.ratio,3)} — ${X.cumple ? 'CUMPLE' : 'NO CUMPLE'}</div>` : `<div class="wtot" style="background:${X.cumple ? '' : '#b91c1c'}"><span>Relación máxima (${n} combinaciones revisadas)</span><span>${fx(X.ratio,3)} — ${X.cumple ? 'CUMPLE' : 'NO CUMPLE'}</span></div>`}
    ${(X.avisos || []).map(a => `<p class="${imp ? 'ax-nota' : 'note amber'}" style="margin-top:6px">${esc(a)}</p>`).join('')}`;
}
function detECalc(c, X, imp){
  const kvT = filas => imp ? `<table class="ax-kv">${filas.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>` : tabla(['', ''], filas);
  const k3 = v => fx(v/1e3,2) + ' kN', h = t => `<h4 class="sub">${t}</h4>`;
  if(X.tipo === 'placa'){
    const p = X.peor, rn = p.rN;
    return h('Placa y concreto (AISC Guía de diseño 1)') + kvT([
      ['A1 = N·B · A2 = área del pedestal', `${fx(X.A1,0)} · ${fx(X.A2,0)} mm²`], ['fp,máx = φ·0.85·f\'c·√(A2/A1) ≤ φ·1.7·f\'c (φ = 0.65)', fx(X.fpMax,2) + ' MPa'],
      ['m = (N − 0.95d)/2 · n = (B − 0.8bf)/2 · λn\' = √(d·bf)/4', `${fx(X.m,1)} · ${fx(X.nv,1)} · ${fx(X.lnp,1)} mm`],
      [`Combinación que controla: ${esc(p.fl._t || '')}`, `Pu ${fx(p.P/1e3,2)} kN · Mu,N ${fx(p.Mn/1e6,2)} · Mu,B ${fx(p.Mb/1e6,2)} kN·m`],
      ['e = Mu/Pu · ecrít = N/2 − Pu/(2·qmáx) (sentido N)', `${isFinite(rn.e) ? fx(rn.e,1) : '∞'} · ${fx(rn.ecrit,1)} mm → ${rn.caso}`],
      ['Longitud de apoyo Y · presión fp (sentido N)', `${fx(rn.Y,1)} mm · ${fx(rn.fp,2)} MPa`],
      ['Tensión en la fila de pernos Tu (N · B)', `${k3(rn.Tu)} · ${k3(p.rB.Tu)}`],
      ['t req compresión = 1.5·l·√(fp/Fy) o 2.11·√(fp·Y·(l − Y/2)/Fy)', `${fx(rn.tReqC,2)} mm`], ['t req tensión = 2.11·√(Tu·x/(B·Fy))', `${fx(rn.tReqT,2)} mm (x = ${fx(rn.x,1)} mm)`]])
      + h('Pernos de anclaje (NSR-10 C — Apéndice C-D)') + kvT([
      ['Perno: d · Ase · futa (≤ 1.9fya ; 860)', `${fx(X.da,2)} mm · ${fx(X.Ase,1)} mm² · ${fx(X.futa,0)} MPa`],
      ['φNsa = 0.75·Ase·futa (por perno)', k3(X.phiNsa)], ['φVsa = 0.65·0.6·Ase·futa' + (c.mortero ? ' × 0.8 (mortero)' : ''), k3(X.phiVsa)],
      ['Distancias al borde del pedestal ca (sentido N · sentido B)', `${fx(X.caN,0)} · ${fx(X.caB,0)} mm`],
      ['h\'ef · ANc / ANco · ψed,N · ψc,N', `${fx(p.bo.hef,0)} mm · ${fx(p.bo.ANc,0)} / ${fx(p.bo.ANco,0)} mm² · ${fx(p.bo.psiEd,3)} · ${fx(X.psiC,2)}`],
      ['Nb = 10·√f\'c·hef^1.5 (o 3.9·√f\'c·hef^(5/3)) · φNcbg (φ = 0.70)', `${k3(p.bo.Nb)} · ${k3(p.bo.phiN)}`],
      [c.cabeza === 'gancho' ? 'Np = 0.9·f\'c·eh·da' : 'Np = 8·Abrg·f\'c (Abrg = arandela − perno)', `${c.cabeza === 'gancho' ? '' : fx(X.Abrg,0) + ' mm² · '}${k3(X.Np)} · φNpn = ${k3(X.phiNpn)}`],
      ['Cortante al borde (sentido N): Avc / Avco · Vb · φVcbg', `${fx(X.vN.Avc,0)} / ${fx(X.vN.Avco,0)} mm² · ${k3(X.vN.Vb)} · ${k3(X.vN.phiV)}`],
      ['Cortante al borde (sentido B): Avc / Avco · Vb · φVcbg', `${fx(X.vB.Avc,0)} / ${fx(X.vB.Avco,0)} mm² · ${k3(X.vB.Vb)} · ${k3(X.vB.phiV)}`],
      ['Desprendimiento φVcp = 0.70·kcp·Ncbg', `kcp = ${X.kcp} · ${k3(X.phiVcp)}`],
      ['Interacción: si N/φNn ≤ 0.2 o V/φVn ≤ 0.2 sin interacción; si no (N/φNn + V/φVn)/1.2 ≤ 1', `${fx(p.rT,3)} · ${fx(p.rV,3)} → ${fx(p.inter,3)}`]])
      + (X.sold ? h('Soldadura columna – placa (método de la línea)') + soldKV(X.sold, kvT) : '');
  }
  if(X.tipo === 'vc'){
    const p = X.peor;
    return h('Fuerza en las alas') + kvT([[`Combinación que controla: ${esc(p.fl._t || '')}`, `Mu ${fx(p.M/1e6,2)} kN·m · Vu ${k3(p.V)} · Pu ${k3(p.P)}`], ['Nf = Mu/(d − tf) + |Pu|/2', k3(p.Nf)]])
      + h('Cubrejunta y pernos') + kvT([
      ['Pernos: d · Ab · Fnv · n', `${fx(X.dp,2)} mm · ${fx(X.Abp,1)} mm² · ${X.Fnv} MPa · ${X.nP}`], ['φRn = 0.75·Fnv·Ab (por perno)', k3(X.phiRnPerno)],
      ['Aplastamiento φ·Σ mín(1.2·Lc·t·Fu ; 2.4·d·t·Fu): cubrejunta · ala', `${k3(X.aplPl)} · ${k3(X.aplAla)}`],
      ['Ag · An (≤ 0.85Ag)', `${fx(X.Ag,0)} · ${fx(X.An,0)} mm²`], ['φPn = mín(0.9·Fy·Ag ; 0.75·Fu·An)', k3(X.tenPl)],
      ['Bloque de cortante: cubrejunta · ala', `${k3(X.bloquePl)} · ${k3(X.bloqueAla)}`],
      ['Compresión: K·L/r (K = 0.65) · Fcr · φPn', `${fx(X.KL,1)} · ${fx(X.Fcr,1)} MPa · ${k3(X.compPl)}`],
      ['Soldadura: φ·0.6·FEXX·0.707·w·(2b)', `${fx(X.Lw,0)} mm · ${k3(X.soldPl)}`]])
      + h('Columna (fuerzas concentradas, F.2.10.10)') + kvT([
      ['Flexión local del ala φ·6.25·Fy·tf²', k3(X.alaCol)], ['Fluencia del alma (5k + lb)·Fy·tw', k3(X.almaFl)], ['Aplastamiento del alma 0.75·0.80·tw²·[1 + 3(lb/d)(tw/tf)^1.5]·√(E·Fy·tf/tw)', k3(X.almaApl)], ['Zona de panel φ·0.6·Fy·dc·tw', k3(X.panel)]])
      + h('Cartela a cortante') + kvT([
      ['Fuerza en el perno crítico (método elástico, e = ' + fx(X.et,0) + ' mm)', k3(p.rb)], ['φRn por perno', k3(X.phiRnPt)],
      ['Cortante: fluencia 1.0·0.6·Fy·Ag · rotura 0.75·0.6·Fu·Anv', `${k3(X.cortY)} · ${k3(X.cortR)}`], ['Bloque de cortante', k3(X.bloqueCt)],
      ['Soldadura (2 cordones, V y V·e): f · φ·0.6·FEXX·0.707·w', `${fx(p.fw,1)} · ${fx(X.soldCtPhi,1)} N/mm`]]);
  }
  return h('Método de la línea (cordón como línea)') + soldKV(X, kvT);
}
function soldKV(X, kvT){
  const P = X.P, q = X.peor;
  if(X.forma === 'T') return kvT([['Longitud · espesor', `${fx(P.A,0)} · ${fx(X.t,1)} mm`], ['Penetración completa: controla el metal base', 'F.2.10.2-5']]);
  return kvT([['Longitud total Aw · centroide (x̄, ȳ)', `${fx(P.A,1)} mm · (${fx(P.xg,1)}, ${fx(P.yg,1)}) mm`], ['Ix · Iy · J = Ix + Iy (por unidad de garganta)', `${fx(P.Ix,0)} · ${fx(P.Iy,0)} · ${fx(P.J,0)} mm³`],
    ['Punto crítico (x, y)', `(${fx(q.x,1)}, ${fx(q.y,1)}) mm`], ['fx = H/A − T·(y − ȳ)/J · fy = V/A + T·(x − x̄)/J · fz = N/A + Mx·(y − ȳ)/Ix + My·(x − x̄)/Iy', `${fx(q.fx,1)} · ${fx(q.fy,1)} · ${fx(q.fz,1)} N/mm`],
    ['f = √(fx² + fy² + fz²)', fx(q.f,1) + ' N/mm'], ['Esfuerzo en la garganta f/(0.707·w)', fx(X.esf,1) + ' MPa'], ['φ·0.60·FEXX (φ = 0.75)', fx(X.phiRn,1) + ' MPa'],
    ['Pierna requerida w = f/(0.707·φ·0.60·FEXX)', fx(X.wReq,2) + ' mm']]);
}

// ─── Sugerencias 💡 para las conexiones (se recalcula con las mismas cargas) ───
function sugE(c, D, filas, key, X){
  const clon = () => JSON.parse(JSON.stringify(c));
  const prueba = (t, mod) => { const z = clon(); if(mod(z) === false) return null; const Y = correrE(z, D, filas); if(!Y.ok) return null;
    const ck = Y.checks[key] || Object.values(Y.checks).find(v => v.n === X.checks[key]?.n); return { t, r:ck ? ck.r : Y.ratio, todo:Y.cumple }; };
  const sigLista = (lista, cur, n=2) => { const i = lista.findIndex(v => +v >= +cur - 1e-6); return lista.slice(i < 0 ? lista.length : (+lista[i] > +cur + 1e-6 ? i : i + 1)).slice(0, n); };
  const tps = PLACAS.map(p => p[1]), dps = Object.keys(AnexoE.PERNOS), nomP = v => PLACAS.find(p => p[1] === +v)?.[0] || v + ' mm';
  const sigD = (cur, n=2) => dps.slice(dps.indexOf(cur) + 1, dps.indexOf(cur) + 1 + n);
  const ops = [], add = o => { if(o) ops.push(o); };
  const ch = X.checks[key], por = ch ? `${ch.n}: demanda ${fx(ch.r*100,0)} % de la capacidad.` : '';
  if(c.tipo === 'placa'){
    const I = entradaE(c, D), maxHef = I.ha - 50;
    if(['tp','apl','geo'].includes(key)){ for(const v of sigLista(tps, c.tp, 3)) add(prueba(`Placa de ${nomP(v)}`, z => { z.tp = v; }));
      for(const dv of [50, 100]) add(prueba(`Placa más grande: N ${+c.N + dv} × B ${+c.B + dv} mm`, z => { z.N = +z.N + dv; z.B = +z.B + dv; if(z.N > I.Lp || z.B > I.Wp) return false; })); }
    if(['ten','pull','vs','int','sb'].includes(key)){ for(const d of sigD(c.perno)) add(prueba(`Pernos de ${d}`, z => { z.perno = d; }));
      add(prueba(`${+c.nB + 1} pernos por fila`, z => { z.nB = +z.nB + 1; })); if(c.anclaje === 'A36') add(prueba('Anclaje F1554 Gr 55', z => { z.anclaje = 'F1554 Gr 55'; }));
      if(key === 'pull' && c.cabeza !== 'gancho') add(prueba(`Arandela de ${+c.arandela + 25} mm`, z => { z.arandela = +z.arandela + 25; })); }
    if(['cono','vcp','int','sb'].includes(key)){ for(const dv of [100, 200]) add(prueba(`hef = ${+c.hef + dv} mm`, z => { z.hef = +z.hef + dv; if(z.hef > maxHef) return false; }));
      add(prueba(`${+c.nB + 1} pernos por fila`, z => { z.nB = +z.nB + 1; })); }
    if(['cono','vb','sb'].includes(key) && I._p) for(const dv of [100, 200]) add(prueba(`Pedestal ${numE(I._p.b) + dv} × ${numE(I._p.h) + dv} mm (cámbialo en el Anexo D)`, z => { z.a = ''; z.Lp = I.Lp + dv; z.Wp = I.Wp + dv; z.ha = I.ha; z.fc = I.fc; }));
    if(key === 'vb'){ add(prueba('Concreto no fisurado (si el análisis lo justifica)', z => { z.fisurado = false; })); for(const d of sigD(c.perno, 1)) add(prueba(`Pernos de ${d}`, z => { z.perno = d; })); }
    if(key === 'sold'){ for(const dw of [1, 2, 3]) add(prueba(`Filete de ${+c.w + dw} mm`, z => { z.w = +z.w + dw; })); if(c.electrodo !== 'E70XX') add(prueba('Electrodo E70XX', z => { z.electrodo = 'E70XX'; })); }
  } else if(c.tipo === 'vc'){
    if(['perno','aplPl','aplAla','bloqAla'].includes(key)){ for(const d of sigD(c.pc.d)) add(prueba(`Pernos de ${d}`, z => { z.pc.d = d; }));
      add(prueba(`${+c.pc.nc + 1} pernos por fila (cubrejunta de ${+c.pl.L + +c.pc.s} mm)`, z => { z.pc.nc = +z.pc.nc + 1; z.pl.L = +z.pl.L + +z.pc.s; }));
      if(c.pc.rosca !== false) add(prueba('Pernos con la rosca fuera del plano de corte', z => { z.pc.rosca = false; })); if(c.pc.tipo !== 'A490') add(prueba('Pernos A490', z => { z.pc.tipo = 'A490'; })); }
    if(['aplPl','ten','bloq','comp'].includes(key)){ for(const v of sigLista(tps, c.pl.t, 2)) add(prueba(`Cubrejunta de ${nomP(v)}`, z => { z.pl.t = v; }));
      if(key !== 'comp') add(prueba(`Cubrejunta más ancha: ${+c.pl.b + 30} mm`, z => { z.pl.b = +z.pl.b + 30; })); }
    if(key === 'sold') for(const dw of [1, 2, 3]) add(prueba(`Filete de ${+c.wPl + dw} mm`, z => { z.wPl = +z.wPl + dw; }));
    if(['alaCol','almaFl','almaApl','panel'].includes(key)){
      const col = metDe(D, c.a), fam = (PERFILES_LAM || []).filter(p => p[1] === (AnexoD.secI(col?.perfil)?.fam)), i = fam.findIndex(p => p[0] === col?.perfil);
      for(const p of fam.slice(i + 1, i + 3)) add(prueba(`Columna ${p[0]} (cámbiala en el Anexo D)`, z => { z._colPerfil = p[0]; }));
      ops.push({ t:key === 'panel' ? 'Platina de refuerzo en el alma de la columna (doble placa) en la zona de panel' : 'Rigidizadores (placas de continuidad) a la altura de las alas de la viga, a ambos lados del alma' }); }
    if(['pernoCt','aplCt'].includes(key)){ add(prueba(`${+c.ct.n + 1} pernos en la cartela`, z => { z.ct.n = +z.ct.n + 1; z.ct.h = Math.max(+z.ct.h, 2*+z.ct.le + (+z.ct.n - 1)*+z.ct.s); }));
      for(const d of sigD(c.ct.d, 1)) add(prueba(`Pernos de ${d} en la cartela`, z => { z.ct.d = d; })); for(const v of sigLista(tps, c.ct.t, 1)) add(prueba(`Cartela de ${nomP(v)}`, z => { z.ct.t = v; })); }
    if(['cortCt','bloqCt'].includes(key)){ add(prueba(`Cartela de ${+c.ct.h + 40} mm de alto`, z => { z.ct.h = +z.ct.h + 40; })); for(const v of sigLista(tps, c.ct.t, 2)) add(prueba(`Cartela de ${nomP(v)}`, z => { z.ct.t = v; })); }
    if(key === 'soldCt') for(const dw of [1, 2, 3]) add(prueba(`Filete de ${+c.wCt + dw} mm en la cartela`, z => { z.wCt = +z.wCt + dw; }));
  } else {
    const k = X.checks[key]?.n || '';
    if(/mínimo/.test(k)) add(prueba(`Filete de ${AnexoE.filMin(+c.t)} mm (mínimo)`, z => { z.w = AnexoE.filMin(+z.t); }));
    else if(/máximo/.test(k)) add(prueba(`Filete de ${AnexoE.filMax(+c.t)} mm (máximo en el borde)`, z => { z.w = AnexoE.filMax(+z.t); }));
    else { const wr = Math.ceil(X.wReq || 0); if(c.forma !== 'T' && wr > +c.w) add(prueba(`Filete de ${wr} mm (el requerido)`, z => { z.w = wr; }));
      for(const dw of [1, 2]) add(prueba(`Filete de ${+c.w + dw} mm`, z => { z.w = +z.w + dw; }));
      if(c.electrodo !== 'E70XX') add(prueba('Electrodo E70XX', z => { z.electrodo = 'E70XX'; }));
      if(c.forma !== 'O' && c.forma !== 'I' && c.forma !== 'c' && c.forma !== 'T') add(prueba('Soldar todo el perímetro (rectangular)', z => { z.forma = 'O'; }));
      if(/Metal base/.test(k)) add(prueba(`Metal base de ${+c.t + 3} mm`, z => { z.t = +z.t + 3; })); }
  }
  const ok = ops.filter(o => o.r != null && o.r <= 1); if(ok[0]) ok[0].mejor = true;
  return { tit:ch?.n || 'chequeo', por, ops: ops.length ? ops : [{ t:'Revisa las medidas y las cargas de esta conexión.' }] };
}

async function pintarResE(c, D){
  const ctx = await ctxE(), box = $('#eRes'); if(!box || selE !== c.id) return;
  const X = calcE(c, D, ctx);
  $('#eDib').innerHTML = dibujosE(c, D, X.ok ? X : null, esIng()); activarCotas(c, D);
  if($('#eTag')) $('#eTag').textContent = etiquetaE(c, D);
  if(!X.ok){ box.innerHTML = `<div class="note amber">${esc(X.error)}</div>`; $('#eDet2').innerHTML = ''; }
  else {
    const sg = esIng() ? (k => bulbHTML(sugE(c, D, X._filas, k, X))) : null;
    box.innerHTML = `<b class="e-h">Chequeos — NSR-10 ${c.tipo === 'placa' ? 'F.2 y C (Apéndice C-D)' : 'F.2.10'}</b>${resEHTML(c, X, false, sg)}`;
    $('#eDet2').innerHTML = `<details class="d-opc" style="margin-top:10px"><summary>Ver cálculo detallado</summary>${detECalc(c, X, false)}</details>`;
  }
  const li = document.querySelector(`[data-sele="${c.id}"]`); if(li){ const p = li.querySelector('.pill'); if(p) p.outerHTML = pillRes(c.res); const l = li.querySelector('.e-lbl'); if(l) l.textContent = etiquetaE(c, D); }
  pintarListo();
}
// Cotas del dibujo: al tocarlas aparece una casilla para cambiar el valor
function activarCotas(c, D){
  if(!esIng()) return;
  $$('#eDib [data-cota]').forEach(g => { const abrir = () => {
    const key = g.dataset.cota, r = g.getBoundingClientRect(), cur = getP(c, key);
    let box = $('#cotaPop'); if(box) box.remove();
    box = document.createElement('div'); box.id = 'cotaPop'; box.className = 'cota-pop';
    const esPl = ['tp','pl.t','ct.t'].includes(key);
    box.innerHTML = esPl ? `<select aria-label="Espesor">${PLACAS.map(([n, v]) => `<option value="${v}" ${+cur === v ? 'selected' : ''}>${n} (${v} mm)</option>`).join('')}</select>` : `<input inputmode="decimal" value="${esc(cur)}" aria-label="Nuevo valor"/>`;
    box.innerHTML += '<button class="btn sm pri" type="button">OK</button>';
    document.body.appendChild(box);
    box.style.left = Math.max(8, Math.min(r.left + r.width/2 - 70, innerWidth - 160)) + 'px'; box.style.top = (r.bottom + 6) + 'px';
    const inp = box.querySelector('input,select'); inp.focus(); if(inp.select) inp.select();
    const ok = () => { const v = String(inp.value).replace(',', '.'); if(v !== '' && isFinite(+v)){ setP(c, key, +v); guardarMemoria(); } box.remove(); paneAnexoE(); };
    box.querySelector('button').onclick = ok; inp.onkeydown = e => { if(e.key === 'Enter') ok(); if(e.key === 'Escape') box.remove(); };
    if(esPl) inp.onchange = ok;
    setTimeout(() => document.addEventListener('mousedown', function f(e){ if(!box.contains(e.target)){ box.remove(); document.removeEventListener('mousedown', f); } }), 0);
  }; g.onclick = abrir; g.onkeydown = e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); abrir(); } }; });
}
function activarE(c, D){
  const E = datosE();
  $$('[data-tabe]').forEach(b => b.onclick = () => { tabE = +b.dataset.tabe; $$('[data-tabe]').forEach(x => x.classList.toggle('on', x === b)); $('#eForm').innerHTML = formE(c, D, tabE, esIng() ? '' : 'disabled'); activarForm(c, D); });
  if($('#eBorrar')) $('#eBorrar').onclick = () => { if(!confirm(`¿Borrar ${c.nom}?`)) return; E.con = E.con.filter(x => x.id !== c.id); selE = null; guardarMemoria(); paneAnexoE(); };
  activarForm(c, D);
  pintarResE(c, D);
}
function activarForm(c, D){
  if(!esIng()) return;
  const re = debounce(() => { guardarMemoria(); pintarResE(c, D); }, 300);
  $$('#eForm [data-a]').forEach(inp => inp.addEventListener(inp.type === 'checkbox' || inp.tagName === 'SELECT' ? 'change' : 'input', () => {
    let v = inp.type === 'checkbox' ? inp.checked : inp.value;
    if(inp.tagName === 'SELECT' && /^(tp|pl\.t|ct\.t)$/.test(inp.dataset.a)) v = +v;
    setP(c, inp.dataset.a, v);
    if(['de','a','cabeza','nom'].includes(inp.dataset.a)){ guardarMemoria(); if(inp.dataset.a === 'de' && c.tipo === 'sold') ajustarSold(c, D); paneAnexoE(); } else re();
  }));
  $$('#eForm [data-forma]').forEach(b => b.onclick = () => { c.forma = b.dataset.forma; guardarMemoria(); $('#eForm').innerHTML = formE(c, D, tabE, ''); activarForm(c, D); pintarResE(c, D); });
  $$('#eForm [data-carg]').forEach(b => b.onclick = () => { c.cargas = b.dataset.carg; guardarMemoria(); $('#eForm').innerHTML = formE(c, D, tabE, ''); activarForm(c, D); pintarResE(c, D); });
  $$('#eForm [data-nudo]').forEach(i => i.onchange = () => { const s = new Set(c.nudos || []); i.checked ? s.add(i.dataset.nudo) : s.delete(i.dataset.nudo); c.nudos = [...s]; guardarMemoria(); pintarResE(c, D); });
}
function ajustarSold(c, D){ const e = metDe(D, c.de), s = e ? secDe(e) : null; if(!s) return;
  c.forma = s.tipo === 'HSS' ? 'O' : s.tipo === 'BAR' ? 'c' : 'I'; c.b = s.b || s.B || s.d; c.d = s.h || s.H || s.d; c.t = s.tf || s.tn || c.t; }

// ═══ Impresión del Anexo E ═══
async function imprimirE(){
  const E = datosE(), D = datosD(); if(!E.con.length) return toast('No hay conexiones para imprimir.');
  toast('Calculando las conexiones…', 20000);
  const ctx = await ctxE(), Xs = E.con.map(c => ({ c, X:calcE(c, D, ctx) }));
  guardarMemoria();
  $('#print-area').innerHTML = anexoEPrintHTML(Xs, D);
  await document.fonts.ready; toast('Listo.', 800); imprimirConMargen(`${S.m.consecutivo}_ANEXO_E`);
}
function anexoEPrintHTML(Xs, D){
  const m = S.m, f = m.ficha, cf = S.cfg, L = 'E';
  const fecha = f.fecha ? new Date(f.fecha + 'T12:00').toLocaleDateString('es-CO', { month:'long', year:'numeric' }) : '';
  const tb = (cab, filas) => `<table class="ax-tb"><thead><tr>${cab.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${filas.map(r => `<tr>${r.map((x,i) => `<td class="${i?'c':''}">${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const datos = (c, X) => { const I = entradaE(c, D);
    if(c.tipo === 'placa') return [['Columna · pedestal', `${esc(I._s?.n || '')} · ${fx(I.Wp,0)} × ${fx(I.Lp,0)} mm, f'c ${fx(I.fc,0)} MPa`], ['Placa N × B × t · acero', `${fx(+c.N,0)} × ${fx(+c.B,0)} × ${fx(+c.tp,2)} mm · ${esc(c.aceroPlaca)}`],
      ['Pernos de anclaje', `${2*Math.round(+c.nB)} × ${esc(c.perno)} ${esc(c.anclaje)} · S1 ${fx(+c.S1,0)} · S2 ${fx(+c.S2,0)} mm · hef ${fx(+c.hef,0)} mm · ${c.cabeza === 'gancho' ? 'gancho en J' : 'tuerca y arandela ' + fx(+c.arandela,0) + ' mm'}`],
      ['Concreto · soldadura', `${c.fisurado !== false ? 'fisurado' : 'no fisurado'}${c.mortero ? ', con mortero de nivelación' : ''} · filete ${fx(+c.w,0)} mm ${esc(c.electrodo)}`]];
    if(c.tipo === 'vc') return [['Viga · columna', `${esc(I.viga?.n || '')} · ${esc(I.col?.n || '')}`], ['Cubrejuntas', `${fx(+c.pl.L,0)} × ${fx(+c.pl.b,0)} × ${fx(+c.pl.t,2)} mm ${esc(c.pl.acero)}`],
      ['Pernos de las cubrejuntas', `${Math.round(+c.pc.nf)} × ${Math.round(+c.pc.nc)} ${esc(c.pc.d)} ${esc(c.pc.tipo)} por ala · s ${fx(+c.pc.s,0)} · borde ${fx(+c.pc.le,0)} · g ${fx(+c.pc.g,0)} mm`],
      ['Cartela', `${fx(+c.ct.h,0)} × ${fx(+c.ct.b,0)} × ${fx(+c.ct.t,2)} mm · ${Math.round(+c.ct.n)} pernos ${esc(c.ct.d)} ${esc(c.ct.tipo)} · e ${fx(+c.ct.e,0)} mm`], ['Soldaduras', `cubrejunta ${fx(+c.wPl,0)} mm · cartela ${fx(+c.wCt,0)} mm · ${esc(c.electrodo)}`]];
    return [['Forma', `${esc(AnexoE.FORMAS[c.forma]?.n || '')}${c.forma === 'I' ? '' : ` · b ${fx(+c.b,0)} · d ${fx(+c.d,0)} mm`}`], ['Filete · electrodo · metal base', `${c.forma === 'T' ? 'penetración completa' : fx(+c.w,0) + ' mm'} · ${esc(c.electrodo)} · t ${fx(+c.t,1)} mm ${esc(c.acero)}`]]; };
  const ok = Xs.filter(x => x.X.ok);
  return `<div class="ax"><section>
    <div class="ax-hd"><div class="ax-t">ANEXO ${L} - DISEÑO DE CONEXIONES METÁLICAS</div><div class="ax-n">NSR-10 Título F.2 y Título C</div><div class="ax-n2">Placas base, anclajes, conexiones a momento y soldaduras</div>
      <table class="ax-id"><tr><td><b>Proyecto:</b></td><td>${esc(f.proyecto||m.titulo||'')}</td><td><b>Ingeniero:</b></td><td>${esc((cf.nombre_firma||'').replace(/^ING\.\s*/,''))}</td></tr>
      <tr><td><b>Proyecto No.:</b></td><td>${esc(m.consecutivo)}</td><td><b>Fecha:</b></td><td>${esc(fecha)}</td></tr></table></div>
    <h3>${L}-1 Resumen de conexiones</h3>
    <p>Las conexiones se diseñan por el método de resistencia (NSR-10 F.2.10) con las fuerzas mayoradas del modelo estructural. Las placas base siguen la Guía de diseño 1 del AISC y los pernos de anclaje el Apéndice C-D de la NSR-10 (concreto fisurado salvo que se indique). Las soldaduras de filete se revisan con el método de la línea: el cordón se trata como una línea, se combinan vectorialmente los esfuerzos de cortante directo, torsión y flexión en el punto más cargado, y el esfuerzo sobre la garganta se compara con φ·0.60·FEXX (φ = 0.75).</p>
    ${tb(['Conexión','Une','Tipo','Relación D/C','Resultado'], Xs.map(({ c, X }) => [`<b>${esc(c.nom)}</b>`, esc(etiquetaE(c, D)), esc(TIPOS_E[c.tipo].n), X.ok ? fx(X.ratio,3) : '—', X.ok ? (X.cumple ? 'Cumple' : '<b>No cumple</b>') : 'Sin datos']))}</section>
    ${ok.map(({ c, X }, i) => { const I = entradaE(c, D), fl = fallasE(X); const e = metDe(D, c.de), s = e ? secDe(e) : null;
      const figs = c.tipo === 'placa' ? `<figure>${svgPlacaPlanta(I, X, false, fl)}<figcaption>Planta</figcaption></figure><figure>${svgPlacaAlzado(I, X, false, fl)}<figcaption>Corte</figcaption></figure>`
        : c.tipo === 'vc' ? `<figure style="grid-column:1/-1">${svgVC(I, X, false, fl)}<figcaption>Alzado</figcaption></figure>` : `<figure style="grid-column:1/-1">${svgSoldX({ ...I, _sec:s?.tipo === 'I' ? s : null }, X, false, fl.falla)}<figcaption>Cordones de soldadura (G = centroide)</figcaption></figure>`;
      return `<section class="ax-cont"><h3>${L}-1.${i+1} ${esc(c.nom)} · ${esc(etiquetaE(c, D))} — ${esc(TIPOS_E[c.tipo].n)}${c.desc ? ' (' + esc(c.desc) + ')' : ''}</h3>
        <div class="ax-mapas">${figs}</div>
        <table class="ax-kv">${datos(c, X).map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}<tr><td>Cargas</td><td>${c.cargas === 'manual' ? 'escritas por el diseñador' : `${X._filas.length} combinaciones de resistencia del modelo`}</td></tr></table>
        ${resEHTML(c, X, true)}${detECalc(c, X, true)}</section>`; }).join('')}</div>`;
}
