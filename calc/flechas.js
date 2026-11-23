/* ═══ Deflexiones de las vigas con los resultados del modelo (pedido de Amo 22-nov) ═══
   El archivo del modelo no trae la flecha a lo largo de cada elemento, solo el desplazamiento de los nudos.
   Se calcula con los momentos de «ELEMENT FORCES - FRAMES» en las estaciones de salida: κ = M/EI, integrada dos
   veces a lo largo del vano (de apoyo a apoyo, uniendo los elementos colineales en que se haya partido la viga),
   y se mide la flecha respecto a la cuerda entre los apoyos. En voladizos: punta respecto al apoyo con
   «JOINT DISPLACEMENTS» (incluye el giro del apoyo); sin esa tabla, empotrado perfecto.
   Límites: NSR-10 Tabla C.9.5(b) (criterio adoptado por Amo). Unidades del archivo: kN, m. */
(function(root){
'use strict';
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };
const si = v => /^(yes|y|si|sí|true)$/i.test(String(v ?? '').trim());

// Límites (Tabla C.9.5(b)): tipo de elemento × elementos no estructurales
const LIMITES = {
  no:{ cub:{ den:180, cons:'viva', fila:1, txt:'Cubierta que no soporta elementos no estructurales susceptibles de daño' },
       ent:{ den:360, cons:'viva', fila:2, txt:'Entrepiso que no soporta elementos no estructurales susceptibles de daño' } },
  si:{ den:240, cons:'total', fila:4, txt:'Soporta elementos no estructurales no susceptibles de dañarse' },
  dano:{ den:480, cons:'total', fila:3, txt:'Soporta elementos no estructurales susceptibles de dañarse' } };
function limite(cfg){
  const t = cfg.tipoEl === 'ent' ? 'ent' : 'cub';
  return cfg.noEst === 'dano' ? LIMITES.dano : cfg.noEst === 'si' ? LIMITES.si : LIMITES.no[t];
}

// ─── Lectura del modelo (una vez por archivo) ───
function leerModelo(texto){
  const T = root.AnexoC.leer(texto), tb = n => T[n] || [];
  const J = {}; for(const r of tb('JOINT COORDINATES')) J[r.Joint] = [num(r.GlobalX ?? r.XorR), num(r.GlobalY ?? r.Y), num(r.GlobalZ ?? r.Z)];
  const fr = {};
  for(const r of tb('CONNECTIVITY - FRAME')){ const a = J[r.JointI], b = J[r.JointJ]; if(!a || !b) continue;
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d); if(!(L > 0)) continue;
    const rz = Math.abs(d[2]) / L;
    fr[r.Frame] = { F:r.Frame, i:r.JointI, j:r.JointJ, L, u:d.map(x => x / L), fun:rz > 0.9 ? 'Columna' : rz < 0.15 ? 'Viga' : 'Diagonal' }; }
  // sección, material, E e I
  const props = Object.fromEntries(tb('FRAME SECTION PROPERTIES 01 - GENERAL').map(r => [r.SectionName, r]));
  const mats = Object.fromEntries(tb('MATERIAL PROPERTIES 02 - BASIC MECHANICAL PROPERTIES').map(r => [r.Material, num(r.E1)]));
  for(const r of tb('FRAME SECTION ASSIGNMENTS')){ const f = fr[r.Frame]; if(!f) continue;
    const s = r.AnalSect || r.DesignSect || '?', p = props[s] || {}, mat = r.MatProp && r.MatProp !== 'Default' ? r.MatProp : p.Material || '';
    Object.assign(f, { sec:s, g:s + '|' + f.fun, I33:num(p.I33), I22:num(p.I22), E:mats[mat] || 0 }); }
  const tAx = Object.keys(T).find(n => /^FRAME LOCAL AXES ASSIGNMENTS 1/i.test(n));
  for(const r of tAx ? T[tAx] : []) if(fr[r.Frame]) fr[r.Frame].ang = num(r.Angle);
  // apoyos: nudos con alguna restricción o donde llega una columna o una diagonal
  const apoyo = new Set();
  for(const r of tb('JOINT RESTRAINT ASSIGNMENTS')) if(['U1','U2','U3','R1','R2','R3'].some(k => si(r[k]))) apoyo.add(r.Joint);
  const enNudo = {}; for(const f of Object.values(fr)){ (enNudo[f.i] = enNudo[f.i] || []).push(f.F); (enNudo[f.j] = enNudo[f.j] || []).push(f.F); if(f.fun !== 'Viga'){ apoyo.add(f.i); apoyo.add(f.j); } }
  // momentos por elemento y caso (sin filas Max/Min de envolventes)
  const M = {}, est = {};
  for(const r of tb('ELEMENT FORCES - FRAMES')){ if(/^(max|min)$/i.test(r.StepType || '')) continue; const f = fr[r.Frame]; if(!f || f.fun !== 'Viga') continue;
    const k = r.Frame + '|' + r.OutputCase; (M[k] = M[k] || []).push([num(r.Station), num(r.M3), num(r.M2)]); est[r.OutputCase] = 1; }
  // desplazamientos verticales de los nudos
  const U = {}; for(const n of Object.keys(T).filter(n => /JOINT DISPLACEMENTS/.test(n) && !/ABSOLUTE|GENERALIZED/.test(n)))
    for(const r of T[n]){ if(/^(max|min)$/i.test(r.StepType || '')) continue; U[r.Joint + '|' + r.OutputCase] = num(r.U3); }
  // casos: combinaciones de servicio (con D, factores ≤ 1, sin sismo) y casos de viva sola
  const pat = Object.fromEntries(tb('LOAD PATTERN DEFINITIONS').map(r => [r.LoadPat, root.AnexoC.categoria(r.LoadPat, r.DesignType)]));
  const cb = {}, tipoCb = {}; let ult = '';
  for(const r of tb('COMBINATION DEFINITIONS')){ const n = r.ComboName || ult; ult = n; if(!n) continue; if(r.ComboType) tipoCb[n] = r.ComboType; if(r.CaseName) (cb[n] = cb[n] || []).push([r.CaseName, num(r.ScaleSF ?? r.ScaleFactor)]); }
  const info = (n, p = 0) => { const o = { D:false, L:false, E:false, W:false, N:false, max:0 };
    for(const [c, f] of cb[n] || []){
      if(cb[c] && p < 5){ const i = info(c, p + 1); for(const k of ['D','L','E','W','N']) o[k] ||= i[k]; o.max = Math.max(o.max, Math.abs(f) * (i.max || 1)); continue; }
      const k = pat[c] || root.AnexoC.categoria(c, ''); if(k in o) o[k] = true; o.max = Math.max(o.max, Math.abs(f)); }
    return o; };
  const casos = Object.keys(est);
  const serv = casos.filter(c => cb[c] && !/envelope/i.test(tipoCb[c] || '') && (i => i.D && !i.E && !i.N && i.max <= 1.0001)(info(c)));
  const viva = casos.filter(c => !cb[c] && (pat[c] || root.AnexoC.categoria(c, '')) === 'L');
  return { fr, apoyo, enNudo, M, U, casos, serv, viva, hayU:Object.keys(U).length > 0, vanos:vanos(fr, apoyo, enNudo, J) };
}

// ─── Vigas: elementos «Viga» colineales unidos por nudos que no son apoyo ───
// Cada viga se parte después en vanos por los apoyos que tenga (en los extremos o dentro de un elemento, cuando la
// columna llega a un nudo intermedio sin partir el elemento) y en voladizos hacia los extremos sin apoyo.
function vanos(fr, apoyo, enNudo, J){
  const vig = Object.values(fr).filter(f => f.fun === 'Viga'), usado = new Set(), cads = [];
  const col = (a, b) => Math.abs(a.u[0]*b.u[0] + a.u[1]*b.u[1] + a.u[2]*b.u[2]) > 0.995;
  const sig = (f, j) => { if(apoyo.has(j)) return null;      // el elemento colineal que sigue en el nudo j
    const c = (enNudo[j] || []).map(F => fr[F]).filter(g => g && g !== f && g.fun === 'Viga' && col(f, g));
    return c.length === 1 ? c[0] : null; };
  for(const f0 of vig){ if(usado.has(f0.F)) continue;
    let f = f0, j = f0.i, guard = 0;
    while(guard++ < 500){ const g = sig(f, j); if(!g || usado.has(g.F) || g === f0) break; j = g.i === j ? g.j : g.i; f = g; }
    const cad = []; let jj = j, ff = f; guard = 0;
    while(ff && guard++ < 500){ const rev = ff.j === jj; cad.push({ f:ff, rev, x0:0 }); usado.add(ff.F); jj = rev ? ff.i : ff.j; const g = sig(ff, jj); ff = g && !usado.has(g.F) ? g : null; }
    let x = 0; for(const c of cad){ c.x0 = x; x += c.f.L; }
    cads.push({ cad, a:j, b:jj, L:x });
  }
  // nudos que quedan DENTRO de una viga (entre sus elementos o sobre un elemento sin partir)
  const sobre = (f, p) => { const a = J[f.i]; if(!a || !p) return null; const d = [p[0]-a[0], p[1]-a[1], p[2]-a[2]], t = d[0]*f.u[0] + d[1]*f.u[1] + d[2]*f.u[2];
    if(t <= 1e-3 || t >= f.L - 1e-3) return null; const e = Math.hypot(d[0] - t*f.u[0], d[1] - t*f.u[1], d[2] - t*f.u[2]); return e < 2e-3 ? t : null; };
  const dentro = new Set();
  for(const c of cads){ for(let k = 1; k < c.cad.length; k++){ const q = c.cad[k]; dentro.add(q.rev ? q.f.j : q.f.i); } }
  const nudosV = new Set(vig.flatMap(f => [f.i, f.j])), extremos = new Set(cads.flatMap(c => [c.a, c.b]));
  for(const n of Object.keys(J)) if(!nudosV.has(n) || extremos.has(n)) for(const f of vig){ if(sobre(f, J[n]) != null){ dentro.add(n); break; } }
  // nudos sobre cada viga (extremos, entre elementos y sobre un elemento sin partir) y su rigidez EI
  const enCad = {};
  for(const c of cads){ c.EI = Math.max(...c.cad.map(q => (q.f.E || 0) * (q.f.I33 || 0)));
    const put = (n, x) => { (enCad[n] = enCad[n] || []).push({ c, x }); };
    put(c.a, 0); put(c.b, c.L);
    for(let k = 1; k < c.cad.length; k++) put(c.cad[k].rev ? c.cad[k].f.j : c.cad[k].f.i, c.cad[k].x0);
    for(const q of c.cad) for(const n of Object.keys(J)){ if(n === q.f.i || n === q.f.j) continue; const t = sobre(q.f, J[n]); if(t != null) put(n, q.x0 + (q.rev ? q.f.L - t : t)); } }
  const out = [];
  for(const c of cads){
    // apoyos a lo largo de la viga: x [m] y nudo. También cuenta como apoyo el cruce con una viga bastante más rígida (correa sobre viga)
    const P = [];
    for(const [n, l] of Object.entries(enCad)){ const yo = l.find(o => o.c === c); if(!yo || yo.x < 1e-3 || yo.x > c.L - 1e-3) continue;
      if(l.some(o => o.c !== c && o.c.EI > 1.5 * c.EI)) P.push({ x:yo.x, j:n }); }
    const masRigida = n => (enCad[n] || []).some(o => o.c !== c && o.c.EI > 1.5 * c.EI);
    const tipoExt = n => apoyo.has(n) || dentro.has(n) || masRigida(n) ? 'apoyo' : (enNudo[n] || []).length <= 1 ? 'libre' : 'esquina';
    const tA = tipoExt(c.a), tB = tipoExt(c.b);
    if(tA === 'apoyo') P.push({ x:0, j:c.a });
    for(const q of c.cad){ for(const n of apoyo){ if(n === q.f.i || n === q.f.j) continue; const t = sobre(q.f, J[n]); if(t != null) P.push({ x:q.x0 + (q.rev ? q.f.L - t : t), j:n }); } }
    if(tB === 'apoyo') P.push({ x:c.L, j:c.b });
    P.sort((p, q) => p.x - q.x); for(let k = P.length - 1; k > 0; k--) if(P[k].x - P[k-1].x < 1e-3) P.splice(k, 1);
    const grupos = [...new Set(c.cad.map(x => x.f.g))], base = { cad:c.cad, grupos, a:c.a, b:c.b, Lv:c.L };
    if(!P.length){
      if(tA === 'libre' && tB === 'libre') out.push({ ...base, tipo:'suelta', x0:0, x1:c.L });
      else out.push({ ...base, tipo:'vano', x0:0, x1:c.L, ja:c.a, jb:c.b });   // apoyada en las puntas de otras vigas: cuerda entre sus extremos
      continue; }
    if(P[0].x > 1e-3) out.push({ ...base, tipo:'voladizo', x0:0, x1:P[0].x, jt:c.a, js:P[0].j, punta:'ini' });
    for(let k = 0; k < P.length - 1; k++) if(P[k+1].x - P[k].x > 1e-3) out.push({ ...base, tipo:'vano', x0:P[k].x, x1:P[k+1].x, ja:P[k].j, jb:P[k+1].j });
    const u = P[P.length - 1]; if(c.L - u.x > 1e-3) out.push({ ...base, tipo:'voladizo', x0:u.x, x1:c.L, jt:c.b, js:u.j, punta:'fin' });
  }
  return out;
}

// ─── Curvatura e integración a lo largo de una viga para un caso ───
function integrar(Mo, cad, caso){
  const pts = []; let nEst = Infinity;
  for(const { f, rev, x0 } of cad){
    const fil = Mo.M[f.F + '|' + caso]; if(!fil || !f.E) return null;
    const debil = Math.abs(Math.sin((f.ang || 0) * Math.PI / 180)) > 0.7;   // ejes girados 90°: la flexión vertical es M2
    const EI = f.E * (debil ? f.I22 : f.I33); if(!(EI > 0)) return null;
    let S = fil.map(r => [r[0], debil ? r[2] : r[1]]).sort((p, q) => p[0] - q[0]);
    if(rev) S = S.map(([s, M]) => [f.L - s, M]).reverse();
    nEst = Math.min(nEst, new Set(S.map(r => r[0].toFixed(4))).size);
    // tramos sin saltos: una estación repetida = carga o momento concentrado
    const tramos = [[S[0]]]; for(let i = 1; i < S.length; i++){ if(S[i][0] - S[i-1][0] < 1e-6) tramos.push([S[i]]); else tramos[tramos.length - 1].push(S[i]); }
    for(const T of tramos){ const n = T.length; if(n < 2) continue;
      const q = (k, s) => { const [a, b, c] = [T[k], T[k+1], T[k+2]];
        return a[1]*(s-b[0])*(s-c[0])/((a[0]-b[0])*(a[0]-c[0])) + b[1]*(s-a[0])*(s-c[0])/((b[0]-a[0])*(b[0]-c[0])) + c[1]*(s-a[0])*(s-b[0])/((c[0]-a[0])*(c[0]-b[0])); };
      for(let i = 0; i < n - 1; i++){ const s0 = T[i][0], s1 = T[i+1][0], N = 10;
        for(let k = 0; k <= N; k++){ const s = s0 + (s1 - s0) * k / N;
          const M = n >= 3 ? q(i + 2 < n ? i : i - 1, s) : T[i][1] + (T[i+1][1] - T[i][1]) * k / N;
          pts.push({ x:x0 + s, k:M / EI, F:f.F, s:rev ? f.L - s : s }); } } }
  }
  if(pts.length < 2) return null;
  // doble integración (trapecios): θ' = κ, w' = θ, con w(0) = θ(0) = 0
  const th = [0], w = [0];
  for(let i = 1; i < pts.length; i++){ const h = pts[i].x - pts[i-1].x; th[i] = th[i-1] + (pts[i].k + pts[i-1].k) / 2 * h; w[i] = w[i-1] + (th[i] + th[i-1]) / 2 * h; }
  return { pts, th, w, nEst };
}
const idxEn = (pts, x) => { let b = 0, d = Infinity; pts.forEach((p, i) => { const e = Math.abs(p.x - x); if(e < d){ d = e; b = i; } }); return b; };

// ─── Flecha de un vano o voladizo para un caso: { d [m], F, xF, nEst, tipo, L, conU } ───
function flechaVano(Mo, v, caso, cache){
  const key = v.cad[0].f.F + '|' + caso, I = cache && cache[key] !== undefined ? cache[key] : integrar(Mo, v.cad, caso);
  if(cache) cache[key] = I; if(!I) return null;
  const { pts, th, w, nEst } = I, L = v.x1 - v.x0;
  if(v.tipo === 'voladizo'){
    const it = idxEn(pts, v.punta === 'ini' ? v.x0 : v.x1), ia = idxEn(pts, v.punta === 'ini' ? v.x1 : v.x0);
    const ua = Mo.U[v.js + '|' + caso], ut = Mo.U[v.jt + '|' + caso];
    let d, conU = false;
    if(ua !== undefined && ut !== undefined){ d = Math.abs(ut - ua); conU = true; }
    else d = Math.abs(w[it] - w[ia] - th[ia] * (pts[it].x - pts[ia].x));      // apoyo empotrado perfecto
    return { d, F:pts[it].F, xF:pts[it].s, nEst, tipo:'voladizo', conU, L };
  }
  const i0 = idxEn(pts, v.x0), i1 = idxEn(pts, v.x1), x0 = pts[i0].x, x1 = pts[i1].x;
  let best = { d:-1, i:i0 };
  for(let i = i0; i <= i1; i++){ const r = Math.abs(w[i] - w[i0] - (w[i1] - w[i0]) * (pts[i].x - x0) / (x1 - x0 || 1)); if(r > best.d) best = { d:r, i }; }
  return { d:best.d, F:pts[best.i].F, xF:pts[best.i].s, nEst, tipo:'vano', L };
}

// ─── Revisión de un grupo «sección|función» ───
// cfg { tipoEl cub|ent, noEst no|si|dano, cons total|viva }. Toma el vano y el caso con la mayor relación flecha / límite.
function revisarGrupo(Mo, grupo, cfg){
  const lim = limite(cfg), cons = cfg.cons || lim.cons;
  const casos = cons === 'viva' ? Mo.viva : Mo.serv;
  if(!casos.length) return { ok:false, error: cons === 'viva'
    ? 'El archivo no trae los resultados de la carga viva sola: al exportar, marque el caso de viva (Lr) en «Select Load Cases».'
    : 'El archivo no trae combinaciones de servicio (1.0D + 1.0Lr…): créelas en el paso Combinaciones, péguelas en el modelo y márquelas en «Select Load Cases» al exportar.' };
  const todos = Mo.vanos.filter(v => v.grupos.includes(grupo)), vs = todos.filter(v => v.tipo !== 'suelta');
  if(!vs.length) return { ok:false, error: todos.length ? 'Las vigas de este grupo no tienen apoyos en el modelo.' : 'No se encontraron vigas de este grupo en el modelo.' };
  const filas = [], cache = {}; let peor = null, nEst = Infinity, sinU = false;
  for(const v of vs){ for(const c of casos){ const r = flechaVano(Mo, v, c, cache); if(!r) continue;
    // solo cuenta si el punto de la flecha máxima (o la punta) cae en un elemento de este grupo
    if(Mo.fr[r.F]?.g !== grupo) continue;
    const Ll = r.tipo === 'voladizo' ? 2 * r.L : r.L, dl = Ll / lim.den, ratio = r.d / dl;
    const o = { ...r, caso:c, Ll, dl, ratio };
    nEst = Math.min(nEst, r.nEst); if(r.tipo === 'voladizo' && !r.conU) sinU = true;
    if(!peor || ratio > peor.ratio) peor = o; filas.push(o); } }
  if(!peor) return { ok:false, error:`Faltan los momentos de ${cons === 'viva' ? 'la carga viva' : 'las combinaciones de servicio'} en estos elementos (tabla «Element Forces - Frames»).` };
  const avisos = [];
  if(nEst < 5) avisos.push(`Hay elementos con solo ${nEst} puntos de salida: la flecha es aproximada. En el software ponga más puntos (Assign → Frame → Output Stations, p. ej. cada 0.5 m) y vuelva a exportar.`);
  if(sinU) avisos.push('Voladizo sin los desplazamientos de los nudos en el archivo: se tomó el apoyo como empotrado perfecto (no incluye su giro).');
  if(todos.length > vs.length) avisos.push('Hay una viga suelta (sin apoyos en el modelo): no se revisó.');
  return { ok:true, cumple:peor.ratio <= 1, ratio:peor.ratio, peor, lim, cons, casos, nVanos:vs.length, nVol:vs.filter(v => v.tipo === 'voladizo').length, filas, avisos };
}

const api = { leerModelo, revisarGrupo, limite, LIMITES, vanos, flechaVano };
if(typeof module !== 'undefined' && module.exports) module.exports = api;
root.Flechas = api;
})(typeof window !== 'undefined' ? window : globalThis);
