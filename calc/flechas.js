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
  // la Tabla C.9.5(b) es para cargas de gravedad: las de servicio con viento (D + W, 0.6D + W) no entran
  const serv = casos.filter(c => cb[c] && !/envelope/i.test(tipoCb[c] || '') && (i => i.D && !i.E && !i.N && !i.W && i.max <= 1.0001)(info(c)));
  const viva = casos.filter(c => !cb[c] && (pat[c] || root.AnexoC.categoria(c, '')) === 'L');
  return { fr, J, G:root.AnexoC.ejesDe ? root.AnexoC.ejesDe(T) : null, apoyo, enNudo, M, U, casos, serv, viva, hayU:Object.keys(U).length > 0, vanos:vanos(fr, apoyo, enNudo, J) };
}

// ─── Vigas: elementos «Viga» colineales unidos por nudos que no son apoyo ───
// Apoyos fijos: nudos con restricción o donde llega una columna o una diagonal (también si quedan dentro de un elemento sin
// partir, por auto-mesh). Donde la viga se encuentra con OTRA viga el punto es «candidato»: es apoyo solo si las fuerzas del
// modelo muestran que la otra viga la sostiene (fuerza hacia arriba); si no, es una carga (revisión con Amo 22-nov).
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
    const pa = J[j], pb = J[jj];
    cads.push({ cad, a:j, b:jj, L:x, Ja:pa, dir:pa && pb ? [0, 1, 2].map(k => (pb[k] - pa[k]) / (x || 1)) : [1, 0, 0], grupos:[...new Set(cad.map(q => q.f.g))] });
  }
  // nudos sobre cada viga: extremos, entre elementos y sobre un elemento sin partir
  const sobre = (f, p) => { const a = J[f.i]; if(!a || !p) return null; const d = [p[0]-a[0], p[1]-a[1], p[2]-a[2]], t = d[0]*f.u[0] + d[1]*f.u[1] + d[2]*f.u[2];
    if(t <= 1e-3 || t >= f.L - 1e-3) return null; const e = Math.hypot(d[0] - t*f.u[0], d[1] - t*f.u[1], d[2] - t*f.u[2]); return e < 2e-3 ? t : null; };
  const enCad = {}, put = (n, c, x) => { (enCad[n] = enCad[n] || []).push({ c, x }); };
  for(const c of cads){ put(c.a, c, 0); put(c.b, c, c.L);
    for(let k = 1; k < c.cad.length; k++) put(c.cad[k].rev ? c.cad[k].f.j : c.cad[k].f.i, c, c.cad[k].x0);
    for(const q of c.cad) for(const n of Object.keys(J)){ if(n === q.f.i || n === q.f.j) continue; const t = sobre(q.f, J[n]); if(t != null) put(n, c, q.x0 + (q.rev ? q.f.L - t : t)); } }
  for(const c of cads){
    c.fijos = []; c.cands = [];
    for(const [n, l] of Object.entries(enCad)){ const yo = l.find(o => o.c === c); if(!yo) continue;
      const ext = yo.x < 1e-3 ? 'a' : yo.x > c.L - 1e-3 ? 'b' : null;
      if(apoyo.has(n)) c.fijos.push({ x:yo.x, j:n });
      else if(l.some(o => o.c !== c)) c.cands.push({ x:yo.x, j:n, ext }); }
    const libre = n => !apoyo.has(n) && (enNudo[n] || []).length <= 1 && !(enCad[n] || []).some(o => o.c !== c);
    c.libreA = libre(c.a); c.libreB = libre(c.b);
  }
  return cads;
}

// ─── Curvatura e integración a lo largo de una viga para un caso ───
// Ms = momento con signo positivo cuando la viga se flecta hacia abajo (eje local 2 hacia arriba: M3 positivo)
function integrar(Mo, cad, caso){
  const pts = []; let nEst = Infinity;
  for(const { f, rev, x0 } of cad){
    const fil = Mo.M[f.F + '|' + caso]; if(!fil || !f.E) return null;
    const ang = (f.ang || 0) * Math.PI / 180, debil = Math.abs(Math.sin(ang)) > 0.7;   // ejes girados 90°: la flexión vertical es M2
    const sg = debil ? 1 : Math.cos(ang) < 0 ? -1 : 1;
    const EI = f.E * (debil ? f.I22 : f.I33); if(!(EI > 0)) return null;
    let S = fil.map(r => [r[0], sg * (debil ? r[2] : r[1])]).sort((p, q) => p[0] - q[0]);
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
          pts.push({ x:x0 + s, M, k:M / EI, F:f.F, s:rev ? f.L - s : s }); } } }
  }
  if(pts.length < 2) return null;
  // doble integración (trapecios): EI·w'' = Ms (w positivo hacia arriba, Ms positivo si flecta hacia abajo), con w(0) = θ(0) = 0
  const th = [0], w = [0];
  for(let i = 1; i < pts.length; i++){ const h = pts[i].x - pts[i-1].x; th[i] = th[i-1] + (pts[i].k + pts[i-1].k) / 2 * h; w[i] = w[i-1] + (th[i] + th[i-1]) / 2 * h; }
  // cortante = pendiente del momento: para saber dónde otra viga empuja hacia arriba
  let Vmax = 0; for(let i = 1; i < pts.length; i++){ const h = pts[i].x - pts[i-1].x; if(h > 1e-9) Vmax = Math.max(Vmax, Math.abs((pts[i].M - pts[i-1].M) / h)); }
  return { pts, th, w, nEst, Vmax };
}
const idxEn = (pts, x) => { let b = 0, d = Infinity; pts.forEach((p, i) => { const e = Math.abs(p.x - x); if(e < d){ d = e; b = i; } }); return b; };
// fuerza concentrada hacia arriba que recibe la viga en x (salto de la pendiente del momento; en los extremos, la pendiente misma)
function fuerzaArriba(I, x, L){
  const { pts } = I, en = pts.map((p, i) => Math.abs(p.x - x) < 1e-4 ? i : -1).filter(i => i >= 0); if(!en.length) return 0;
  const iL = en[0], iR = en[en.length - 1];
  const sl = i => (pts[i+1].M - pts[i].M) / (pts[i+1].x - pts[i].x || 1e-9);
  const izq = iL > 0 ? sl(iL - 1) : null, der = iR < pts.length - 1 ? sl(iR) : null;
  if(x < 1e-3) return der ?? 0; if(x > L - 1e-3) return izq != null ? -izq : 0;
  return izq != null && der != null ? der - izq : 0;
}

// ─── Vanos y voladizos de una viga para un caso, con la flecha de cada uno ───
function flechasViga(Mo, c, caso, cache){
  const key = c.cad[0].f.F + '|' + caso, I = cache && cache[key] !== undefined ? cache[key] : integrar(Mo, c.cad, caso);
  if(cache) cache[key] = I; if(!I) return null;
  const thr = Math.max(0.05, 0.05 * I.Vmax);
  const P = [...c.fijos.map(p => ({ ...p, viga:false })), ...c.cands.filter(p => fuerzaArriba(I, p.x, c.L) > thr).map(p => ({ ...p, viga:true }))]
    .sort((p, q) => p.x - q.x).filter((p, k, a) => !k || p.x - a[k-1].x > 1e-3);
  const pos = x => c.Ja ? c.Ja.map((v, k) => v + c.dir[k] * x) : null;
  const G = Mo.G, ub = (x0, x1) => G ? root.AnexoC.ubicarTramo(G, pos(x0), pos(x1)) : '', up = x => G ? root.AnexoC.ubicar(G, pos(x)) : '';
  const { pts, th, w, nEst } = I, out = [];
  const vano = (x0, x1, ja, jb, porViga) => {
    const i0 = idxEn(pts, x0), i1 = idxEn(pts, x1), X0 = pts[i0].x, X1 = pts[i1].x; let best = { d:-1, i:i0, r:0 };
    for(let i = i0; i <= i1; i++){ const r = w[i] - w[i0] - (w[i1] - w[i0]) * (pts[i].x - X0) / (X1 - X0 || 1); if(Math.abs(r) > best.d) best = { d:Math.abs(r), i, r }; }
    const p = pts[best.i], ua = Mo.U[ja + '|' + caso], ubb = Mo.U[jb + '|' + caso];
    const dAbs = porViga && ua !== undefined && ubb !== undefined ? Math.abs(best.r + ua + (ubb - ua) * (p.x - X0) / (X1 - X0 || 1)) : null;
    out.push({ tipo:'vano', d:best.d, F:p.F, xF:p.s, L:x1 - x0, nEst, porViga, dAbs, ubic:ub(x0, x1), ubicP:up(p.x) }); };
  const vol = (x0, x1, punta, jt, js, porViga) => {
    const it = idxEn(pts, punta === 'ini' ? x0 : x1), ia = idxEn(pts, punta === 'ini' ? x1 : x0);
    const ua = Mo.U[js + '|' + caso], ut = Mo.U[jt + '|' + caso]; let d, conU = false;
    if(ua !== undefined && ut !== undefined){ d = Math.abs(ut - ua); conU = true; }
    else d = Math.abs(w[it] - w[ia] - th[ia] * (pts[it].x - pts[ia].x));      // apoyo empotrado perfecto
    out.push({ tipo:'voladizo', d, F:pts[it].F, xF:pts[it].s, L:x1 - x0, nEst, conU, porViga, dAbs:porViga && ut !== undefined ? Math.abs(ut) : null, ubic:ub(punta === 'ini' ? x1 : x0, punta === 'ini' ? x0 : x1), ubicP:up(pts[it].x) }); };
  if(!P.length){ if(!(c.libreA && c.libreB)) vano(0, c.L, c.a, c.b, true); return out; }   // sin apoyos claros: cuerda entre los extremos
  if(P[0].x > 1e-3) vol(0, P[0].x, 'ini', c.a, P[0].j, P[0].viga);
  for(let k = 0; k < P.length - 1; k++) if(P[k+1].x - P[k].x > 1e-3) vano(P[k].x, P[k+1].x, P[k].j, P[k+1].j, P[k].viga || P[k+1].viga);
  const u = P[P.length - 1]; if(c.L - u.x > 1e-3) vol(u.x, c.L, 'fin', c.b, u.j, u.viga);
  return out;
}

// ─── Revisión de un grupo «sección|función» ───
// cfg { tipoEl cub|ent, noEst no|si|dano, cons total|viva }. Toma el vano y el caso con la mayor relación flecha / límite.
function revisarGrupo(Mo, grupo, cfg){
  const lim = limite(cfg), cons = cfg.cons || lim.cons;
  const casos = cons === 'viva' ? Mo.viva : Mo.serv;
  if(!casos.length) return { ok:false, error: cons === 'viva'
    ? 'El archivo no trae los resultados de la carga viva sola: al exportar, marque el caso de viva (Lr) en «Select Load Cases».'
    : 'El archivo no trae combinaciones de servicio (1.0D + 1.0Lr…): créelas en el paso Combinaciones, péguelas en el modelo y márquelas en «Select Load Cases» al exportar.' };
  const vs = Mo.vanos.filter(v => v.grupos.includes(grupo));
  if(!vs.length) return { ok:false, error:'No se encontraron vigas de este grupo en el modelo.' };
  const filas = [], cache = {}; let peor = null, nEst = Infinity, sinU = false, nV = 0, nVol = 0;
  for(const v of vs){ for(const c of casos){ const rs = flechasViga(Mo, v, c, cache); if(!rs) continue;
    for(const r of rs){
      // solo cuenta si el punto de la flecha máxima (o la punta) cae en un elemento de este grupo
      if(Mo.fr[r.F]?.g !== grupo) continue;
      if(c === casos[0]){ nV++; if(r.tipo === 'voladizo') nVol++; }
      const Ll = r.tipo === 'voladizo' ? 2 * r.L : r.L, dl = Ll / lim.den, ratio = r.d / dl;
      const o = { ...r, caso:c, Ll, dl, ratio };
      nEst = Math.min(nEst, r.nEst); if(r.tipo === 'voladizo' && !r.conU) sinU = true;
      if(!peor || ratio > peor.ratio) peor = o; filas.push(o); } } }
  if(!peor) return { ok:false, error:`Faltan los momentos de ${cons === 'viva' ? 'la carga viva' : 'las combinaciones de servicio'} en estos elementos (tabla «Element Forces - Frames»), o las vigas no tienen apoyos.` };
  const avisos = [];
  if(nEst < 5) avisos.push(`Hay elementos con solo ${nEst} puntos de salida: la flecha es aproximada. En el software ponga más puntos (Assign → Frame → Output Stations, p. ej. cada 0.5 m) y vuelva a exportar.`);
  if(sinU) avisos.push('Voladizo sin los desplazamientos de los nudos en el archivo: se tomó el apoyo como empotrado perfecto (no incluye su giro).');
  if(vs.some(v => v.libreA && v.libreB && !v.fijos.length)) avisos.push('Hay una viga suelta (sin apoyos en el modelo): no se revisó.');
  return { ok:true, cumple:peor.ratio <= 1, ratio:peor.ratio, peor, lim, cons, casos, nVanos:nV, nVol, filas, avisos };
}

const api = { leerModelo, revisarGrupo, limite, LIMITES, vanos, flechasViga, integrar };
if(typeof module !== 'undefined' && module.exports) module.exports = api;
root.Flechas = api;
})(typeof window !== 'undefined' ? window : globalThis);
