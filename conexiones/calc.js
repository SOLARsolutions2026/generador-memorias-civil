/* Cálculo de conexiones metálicas — NSR-10 Título F.2 (equivale a AISC 360-10), método LRFD.
   La lista de chequeos sigue el curso «Diseño de uniones en estructuras de acero» (Celigüeta, tecnun 2018),
   pero TODAS las fórmulas y factores φ son los de NSR-10 F.2.10 / AISC 360-10 capítulo J y el Manual AISC
   (partes 7, 9 y 10). Unidades: kN, mm, MPa (N/mm²).
   Archivo puro (sin pantalla): se puede probar con node. */
(function(G){
const MPA_KSI = 6.894757;

// ── Materiales ─────────────────────────────────────────────
const ACEROS = {               // Fy, Fu [MPa]
  'A36':         { Fy:250, Fu:400 },
  'A572 Gr 50':  { Fy:345, Fu:450 },
  'A992':        { Fy:345, Fu:450 },
  'A500 Gr C':   { Fy:345, Fu:427 },
};
// NSR-10 Tabla F.2.10.3-2 (AISC Tabla J3.2): Fnt y Fnv [MPa]; N = rosca incluida en el plano de corte, X = excluida
const PERNOS = {
  'A325': { Fnt:620, N:372, X:469 },
  'A490': { Fnt:780, N:469, X:579 },
  'A307': { Fnt:310, N:188, X:188 },
};
const DIAM = [ ['1/2"', 12.7], ['5/8"', 15.9], ['3/4"', 19.1], ['7/8"', 22.2], ['1"', 25.4], ['1-1/8"', 28.6] ];
// Distancia mínima al borde, Tabla F.2.10.3-4 (AISC J3.4) [mm]
const BORDE_MIN = { 12.7:19, 15.9:22, 19.1:25, 22.2:29, 25.4:32, 28.6:38 };
const ELECTRODOS = { 'E60XX':414, 'E70XX':483 };
const agujero = d => d + 1.6;                 // agujero estándar d + 1/16"
const anchoNeto = d => agujero(d) + 1.6;      // F.2.4.3.2 (B4.3): para área neta se suma 1/16" más
const r1 = x => Math.round(x * 10) / 10, r2 = x => Math.round(x * 100) / 100, r3 = x => Math.round(x * 1000) / 1000;
// Bordes cortados con cizalla (columna «At sheared edges» de la misma tabla, AISC 360-10 J3.4); pedido de Amo 18-nov: casilla `cizalla` en cada conexión
const BORDE_CIZ = { 12.7:22, 15.9:29, 19.1:32, 22.2:38, 25.4:44, 28.6:51 };
let CIZ = false;
const bordeMin = d => CIZ ? (BORDE_CIZ[d] ?? Math.ceil(1.75 * d)) : (BORDE_MIN[d] ?? Math.ceil(1.25 * d));

// ── Método del centro instantáneo de rotación (Manual AISC parte 7) ─────────────
// pernos: [{x, y}] en mm respecto a cualquier origen; e = excentricidad horizontal de la carga respecto al centroide (mm);
// ang = ángulo de la carga respecto a la vertical (°). Devuelve C (= Rn grupo / rn de un perno) y la posición del centro.
function icr(pernos, e, ang = 0){
  const n = pernos.length; if(!n) return { C:0 };
  const cx = pernos.reduce((a, p) => a + p.x, 0) / n, cy = pernos.reduce((a, p) => a + p.y, 0) / n;
  // se gira el sistema para que la carga quede vertical (hacia abajo); e se mide perpendicular a la carga
  const t = ang * Math.PI / 180, ct = Math.cos(t), st = Math.sin(t);
  const B = pernos.map(p => { const x = p.x - cx, y = p.y - cy; return { x: x * ct - y * st, y: x * st + y * ct }; });
  const ip = B.reduce((a, b) => a + b.x * b.x + b.y * b.y, 0);
  if(Math.abs(e) < 1e-6) return { C:n, ro:Infinity, cx, cy, metodo:'concéntrica' };
  if(ip < 1e-9) return { C:0 };
  const sg = Math.sign(e), E = Math.abs(e);
  const R = D => Math.pow(1 - Math.exp(-10 * D), 0.55);            // Δ en pulgadas
  // para un ro dado (centro en (-sg·ro, 0)): fuerzas de cada perno, P por momentos, desequilibrio vertical
  const evalua = ro => {
    const xi = -sg * ro; let cmax = 0;
    const c = B.map(b => { const dx = b.x - xi, dy = b.y, ci = Math.hypot(dx, dy); if(ci > cmax) cmax = ci; return { dx, dy, ci }; });
    let M = 0, Ry = 0;
    c.forEach(q => { if(q.ci < 1e-9) return; const D = 0.34 * q.ci / cmax, Ri = R(D); M += Ri * q.ci; Ry += Ri * sg * q.dx / q.ci; });   // componente paralela a la carga, con signo
    const P = M / (E + ro);
    return { P, f:Ry - P };
  };
  let lo = 1e-6, hi = 10 * Math.sqrt(ip / n) + 10 * E + 1000, flo = evalua(lo).f, fhi = evalua(hi).f;
  // f(ro) pasa de negativo a positivo; si no cambia de signo se usa el elástico como respaldo
  if(flo * fhi > 0){ const el = elastico(pernos, e, ang); return { C:el.C, ro:NaN, cx, cy, metodo:'elástico (ICR sin solución)' }; }
  for(let k = 0; k < 100; k++){ const m = (lo + hi) / 2, fm = evalua(m).f; if(flo * fm <= 0){ hi = m; } else { lo = m; flo = fm; } if(hi - lo < 1e-4) break; }
  const ro = (lo + hi) / 2, P = evalua(ro).P;
  return { C:P, ro, cx, cy, metodo:'centro instantáneo' };
}
// Método elástico (vectorial), como referencia: C = 1 / fuerza del perno más cargado con P = 1
function elastico(pernos, e, ang = 0){
  const n = pernos.length, cx = pernos.reduce((a, p) => a + p.x, 0) / n, cy = pernos.reduce((a, p) => a + p.y, 0) / n;
  const t = ang * Math.PI / 180, Px = Math.sin(t), Py = -Math.cos(t);       // carga unitaria
  const ip = pernos.reduce((a, p) => a + (p.x - cx) ** 2 + (p.y - cy) ** 2, 0), M = e * Math.abs(Py) * 1; // momento de P = 1 con brazo e
  let fmax = 0;
  pernos.forEach(p => { const x = p.x - cx, y = p.y - cy;
    const fx = Px / n - (ip ? M * y / ip : 0), fy = Py / n + (ip ? M * x / ip : 0); fmax = Math.max(fmax, Math.hypot(fx, fy)); });
  return { C: fmax ? 1 / fmax : 0 };
}

// ── Resistencia de un perno (por plano de corte) ─────────────
function pernoCorte(d, grado, rosca, planos = 1){
  const Ab = Math.PI * d * d / 4, Fnv = PERNOS[grado][rosca === 'X' ? 'X' : 'N'];
  return { Ab, Fnv, phiRn: 0.75 * Fnv * Ab * planos / 1000 };     // kN, F.2.10.3.6 (J3-1)
}
// Aplastamiento y desgarro en el agujero (deformación en servicio es consideración de diseño): F.2.10.3.10 (J3-6a)
function aplast(lc, t, d, Fu){
  const a = 1.2 * lc * t * Fu, b = 2.4 * d * t * Fu;
  return { lc, phiRn: 0.75 * Math.min(a, b) / 1000, controla: a < b ? 'desgarro' : 'aplastamiento' };
}

// ── Chapa de aleta en el alma (shear tab, una columna de pernos) ─────────────────
function defaultsAleta(){
  return { tipo:'aleta', nom:'', desc:'',
    Vu:80, Nu:0,
    viga:'IPE 300', aceroViga:'A572 Gr 50',
    soporte:'ala', tSop:10.7, aceroSop:'A572 Gr 50', dosLados:false,        // ala | alma (de columna) | viga (alma de viga principal)
    n:3, s:75, Lev:38, Leh:38, a:76, holgura:13,
    tp:9.5, aceroPl:'A36',
    d:19.1, grado:'A325', rosca:'N',
    w:6, electrodo:'E70XX' };
}
function perfil(nom){
  const P = (G.PERFILES_LAM || []).find(x => x[0] === nom);
  if(!P) return null;
  const [n, fam, h, b, tw, tf, r] = P;
  return { nom:n, fam, d:h, bf:b, tw, tf, r, T:h - 2 * (tf + r) };
}
function calcAleta(c){
  const ch = [], av = [], pasos = [];
  const V = +c.Vu || 0, d = +c.d, n = Math.max(1, Math.round(+c.n || 1)), s = +c.s, Lev = +c.Lev, Leh = +c.Leh, a = +c.a, tp = +c.tp;
  const pl = ACEROS[c.aceroPl], ac = ACEROS[c.aceroViga], sp = ACEROS[c.aceroSop], FEXX = ELECTRODOS[c.electrodo];
  const vg = perfil(c.viga); if(!vg) return { error:'Escoja el perfil de la viga.' };
  const dh = agujero(d), dn = anchoNeto(d), Lp = (n - 1) * s + 2 * Lev, LehB = a - (+c.holgura || 0);
  const add = (grupo, nombre, ref, dem, cap, ud, extra) => ch.push({ grupo, nombre, ref, dem, cap, ud, ratio: cap > 0 ? dem / cap : Infinity, extra });
  pasos.push(`Altura de la chapa Lp = (n − 1)·s + 2·Lev = (${n} − 1)·${s} + 2·${Lev} = ${r1(Lp)} mm`);
  pasos.push(`Agujero estándar dh = d + 1.6 = ${r1(dh)} mm; para área neta se usa dh + 1.6 = ${r1(dn)} mm`);

  // Requisitos geométricos (configuración convencional, Manual AISC parte 10)
  const req = [];
  const bm = bordeMin(d);
  req.push(['Distancia al borde vertical Lev ≥ mín. Tabla F.2.10.3-4', Lev >= bm, `${Lev} ≥ ${bm} mm`]);
  req.push(['Distancia al borde horizontal de la chapa Leh ≥ 2d', Leh >= 2 * d - 0.5, `${Leh} ≥ ${r1(2 * d)} mm`]);
  req.push(['Distancia al borde en el alma de la viga Leh,v ≥ 2d', LehB >= 2 * d - 0.5, `${r1(LehB)} ≥ ${r1(2 * d)} mm (a − holgura)`]);
  req.push(['Separación entre pernos s ≥ 3d (mín. 2.67d)', s >= 2.67 * d, `${s} ≥ ${r1(3 * d)} mm`]);
  req.push(['Número de pernos entre 2 y 12', n >= 2 && n <= 12, `n = ${n}`]);
  req.push(['Chapa o alma delgada (ductilidad): tp ≤ d/2 + 1.6 o tw ≤ d/2 + 1.6', tp <= d / 2 + 1.6 || vg.tw <= d / 2 + 1.6, `tp = ${tp}, tw = ${vg.tw}, d/2 + 1.6 = ${r1(d / 2 + 1.6)} mm`]);
  req.push(['La chapa cabe en el alma recta de la viga: Lp ≤ T', Lp <= vg.T + 0.5, `${r1(Lp)} ≤ ${r1(vg.T)} mm`]);
  req.push(['Estabilidad de la viga en el apoyo: Lp ≥ T/2', Lp >= vg.T / 2 - 0.5, `${r1(Lp)} ≥ ${r1(vg.T / 2)} mm`]);
  req.push(['Soldadura que desarrolla la chapa: w ≥ 5/8·tp (dos filetes)', +c.w >= 0.625 * tp - 0.05, `${c.w} ≥ ${r1(0.625 * tp)} mm`]);
  req.filter(r => !r[1]).forEach(r => av.push(`${r[0]}: ${r[2]}`));

  // 1. Pernos: grupo excéntrico con e = a (método del centro instantáneo), conservador (configuración extendida)
  const pernos = Array.from({ length:n }, (_, i) => ({ x:0, y:-i * s }));
  const ic = icr(pernos, a, 0);
  const pc = pernoCorte(d, c.grado, c.rosca, 1);
  const lcE = Lev - dh / 2, lcI = s - dh;
  const bpE = aplast(lcE, tp, d, pl.Fu), bpI = aplast(lcI, tp, d, pl.Fu), bv = aplast(lcI, vg.tw, d, ac.Fu);
  const rn = Math.min(pc.phiRn, bpE.phiRn, bpI.phiRn, bv.phiRn);
  const cual = rn === pc.phiRn ? 'cortante del perno' : rn === bv.phiRn ? 'aplastamiento en el alma de la viga' : 'aplastamiento en la chapa';
  pasos.push(`Cortante de un perno (F.2.10.3.6): φrn = 0.75·Fnv·Ab = 0.75·${pc.Fnv}·${r1(pc.Ab)} = ${r2(pc.phiRn)} kN`);
  pasos.push(`Aplastamiento en la chapa (F.2.10.3.10): borde lc = ${r1(lcE)} mm → ${r2(bpE.phiRn)} kN; interior lc = ${r1(lcI)} mm → ${r2(bpI.phiRn)} kN`);
  pasos.push(`Aplastamiento en el alma de la viga: lc = ${r1(lcI)} mm, tw = ${vg.tw} mm → ${r2(bv.phiRn)} kN`);
  pasos.push(`Centro instantáneo con e = a = ${a} mm: C = ${r3(ic.C)} (${ic.metodo}); φRn = C·φrn,mín = ${r3(ic.C)}·${r2(rn)} = ${r2(ic.C * rn)} kN (controla ${cual})`);
  add('pernos', 'Pernos con excentricidad (centro instantáneo): cortante y aplastamiento', 'F.2.10.3 (J3-1, J3-6) · Manual AISC parte 7', V, ic.C * rn, 'kN', `C = ${r2(ic.C)} · φrn = ${r2(rn)} kN, el menor de: corte ${r2(pc.phiRn)}; aplastamiento chapa borde ${r2(bpE.phiRn)} / interior ${r2(bpI.phiRn)}; alma de la viga ${r2(bv.phiRn)} kN → controla ${cual}`);

  // 2. Chapa
  const Agv = Lp * tp, Anv = (Lp - n * dn) * tp;
  const vy = 1.0 * 0.6 * pl.Fy * Agv / 1000, vr = 0.75 * 0.6 * pl.Fu * Anv / 1000;
  add('chapa', 'Fluencia por cortante', 'F.2.10.4.2 (J4-3)', V, vy, 'kN', `1.0·0.6·Fy·Agv, Agv = ${r1(Agv)} mm²`);
  add('chapa', 'Rotura por cortante', 'F.2.10.4.2 (J4-4)', V, vr, 'kN', `0.75·0.6·Fu·Anv, Anv = ${r1(Anv)} mm²`);
  const bloque = (t, Fy, Fu, Lv, Lh) => { const agv = (Lp - Lv) * t, anv = (Lp - Lv - (n - 0.5) * dn) * t, ant = (Lh - 0.5 * dn) * t;
    return { phiRn: 0.75 * Math.min(0.6 * Fu * anv + Fu * ant, 0.6 * Fy * agv + Fu * ant) / 1000, agv, anv, ant }; };
  const bk = bloque(tp, pl.Fy, pl.Fu, Lev, Leh);
  add('chapa', 'Bloque de cortante', 'F.2.10.4.3 (J4-5), Ubs = 1.0', V, bk.phiRn, 'kN', `Agv = ${r1(bk.agv)}, Anv = ${r1(bk.anv)}, Ant = ${r1(bk.ant)} mm²`);
  const Zg = tp * Lp * Lp / 4, Sg = tp * Lp * Lp / 6, Mu = V * a / 1000;   // kN·m
  const phiMy = 0.9 * pl.Fy * Zg / 1e6;
  const inter = Math.hypot(V / vy, Mu / phiMy);
  add('chapa', 'Fluencia por flexión y cortante: (Vu/φVn)² + (Mu/φMn)² ≤ 1', 'Manual AISC (10-5)', inter, 1, '', `Mu = Vu·a = ${r2(Mu)} kN·m; φMn = 0.9·Fy·Z = ${r2(phiMy)} kN·m`);
  let Zn = Zg; pernos.forEach(p => { const y = Math.abs(p.y + (n - 1) * s / 2); Zn -= dn * tp * y; });
  const phiMr = 0.75 * pl.Fu * Zn / 1e6;
  add('chapa', 'Rotura por flexión en la línea de pernos', 'Manual AISC (9-4)', Mu, phiMr, 'kN·m', `0.75·Fu·Znet, Znet = ${Math.round(Zn)} mm³`);
  const FyK = pl.Fy / MPA_KSI, lam = (Lp * Math.sqrt(FyK)) / (10 * tp * Math.sqrt(475 + 280 * (Lp / a) ** 2));
  const Q = lam <= 0.7 ? 1 : lam <= 1.41 ? 1.34 - 0.486 * lam : 1.30 / (lam * lam);
  const phiMb = 0.9 * Q * pl.Fy * Sg / 1e6;
  add('chapa', 'Pandeo de la chapa por flexión', 'Manual AISC (9-14 a 9-18)', Mu, phiMb, 'kN·m', `λ = ${r3(lam)}, Q = ${r3(Q)}; φMn = 0.9·Q·Fy·S`);

  // 3. Soldadura chapa–soporte: dos filetes de longitud Lp con cortante y momento Vu·a
  const qw = 0.75 * 0.6 * FEXX * 0.707 * (+c.w) / 1000;                   // kN/mm por filete
  const fv = V / (2 * Lp), fm = Mu * 1000 / (2 * Lp * Lp / 6), fr = Math.hypot(fv, fm);
  add('soldadura', 'Resistencia de los filetes (cortante + flexión)', 'F.2.10.2.4 (J2-4)', fr, qw, 'kN/mm', `f = √(fv² + fm²); fv = ${r3(fv)}, fm = ${r3(fm)} kN/mm; φ·0.6·FEXX·0.707·w`);
  // metal base: la chapa recibe un filete por cada cara → cada filete cuenta con la mitad de su espesor (rotura por cortante, J4-4)
  const qbCh = 0.75 * 0.6 * pl.Fu * tp / 2 / 1000;
  add('soldadura', 'Metal base de la chapa junto a los filetes', 'F.2.10.2.4 (J2-2) · J4-4', fr, qbCh, 'kN/mm', `0.75·0.6·Fu·tp/2 por filete (un filete en cada cara)`);

  // 4. Soporte y viga
  // soporte: rotura por cortante a lo largo de cada filete; si hay conexión al otro lado del alma, cada lado cuenta con la mitad
  const qbS = 0.75 * 0.6 * sp.Fu * (+c.tSop) / (c.dosLados ? 2 : 1) / 1000;
  add('soporte', (c.soporte === 'ala' ? 'Ala de la columna' : 'Alma del soporte') + ': rotura bajo la soldadura', 'F.2.10.2.4 (J2-2) · Manual AISC (9-2)', fr, qbS, 'kN/mm', `0.75·0.6·Fu·t${c.dosLados ? '/2 (conexión a ambos lados)' : ''} por filete`);
  const vb = 1.0 * 0.6 * ac.Fy * vg.d * vg.tw / 1000;
  add('viga', 'Cortante del alma de la viga', 'F.2.7.2 (G2-1), φv = 1.0', V, vb, 'kN', `0.6·Fy·d·tw = 0.6·${ac.Fy}·${vg.d}·${vg.tw}`);

  const max = ch.reduce((m, x) => Math.max(m, x.ratio), 0);
  return { ok:max <= 1 && !req.some(r => !r[1]), max, ch, req, av, pasos, geo:{ Lp, dh, LehB, pernos, vg, ic, a }, Mu };
}

// ── Grupo de pernos excéntrico (ménsula de chapa atornillada) ─────────────
function defaultsGrupo(){
  return { tipo:'grupo', nom:'', desc:'', Pu:60, ang:0, e:200,
    filas:3, cols:2, s:75, g:75, Lev:40, Leh:40,
    d:19.1, grado:'A325', rosca:'N',
    tp:12.7, aceroPl:'A36', tSop:12, aceroSop:'A572 Gr 50' };
}
function calcGrupo(c){
  const ch = [], av = [], pasos = [];
  const P = +c.Pu || 0, d = +c.d, nf = Math.max(1, Math.round(+c.filas)), nc = Math.max(1, Math.round(+c.cols)), s = +c.s, g = +c.g, e = +c.e, ang = +c.ang || 0;
  const pl = ACEROS[c.aceroPl], sp = ACEROS[c.aceroSop], tp = +c.tp, ts = +c.tSop, Lev = +c.Lev, Leh = +c.Leh;
  const dh = agujero(d), dn = anchoNeto(d);
  const pernos = []; for(let j = 0; j < nc; j++) for(let i = 0; i < nf; i++) pernos.push({ x:j * g, y:-i * s });
  const add = (grupo, nombre, ref, dem, cap, ud, extra) => ch.push({ grupo, nombre, ref, dem, cap, ud, ratio: cap > 0 ? dem / cap : Infinity, extra });
  const req = [], bm = bordeMin(d);
  req.push(['Distancias al borde Lev, Leh ≥ mín. Tabla F.2.10.3-4', Math.min(Lev, Leh) >= bm, `${Math.min(Lev, Leh)} ≥ ${bm} mm`]);
  req.push(['Separación s, g ≥ 2.67d (preferible 3d)', Math.min(nf > 1 ? s : 1e9, nc > 1 ? g : 1e9) >= 2.67 * d, `${Math.min(nf > 1 ? s : 1e9, nc > 1 ? g : 1e9) < 1e9 ? Math.min(nf > 1 ? s : 1e9, nc > 1 ? g : 1e9) : '—'} ≥ ${r1(2.67 * d)} mm`]);
  req.filter(r => !r[1]).forEach(r => av.push(`${r[0]}: ${r[2]}`));

  const ic = icr(pernos, e, ang), el = elastico(pernos, e, ang);
  const pc = pernoCorte(d, c.grado, c.rosca, 1);
  const lcE = Math.min(Lev, Leh) - dh / 2, lcI = Math.min(nf > 1 ? s : 1e9, nc > 1 ? g : 1e9) - dh;
  const bE = aplast(lcE, tp, d, pl.Fu), bI = aplast(Math.min(lcI, 1e6), tp, d, pl.Fu), bS = aplast(Math.min(lcI, 1e6), ts, d, sp.Fu);
  const rn = Math.min(pc.phiRn, bE.phiRn, bI.phiRn, bS.phiRn);
  const cual = rn === pc.phiRn ? 'cortante del perno' : rn === bS.phiRn ? 'aplastamiento en el soporte' : 'aplastamiento en la chapa';
  pasos.push(`${nf} filas × ${nc} columnas = ${pernos.length} pernos de ${d} mm ${c.grado}-${c.rosca}; s = ${s}, g = ${g} mm`);
  pasos.push(`Cortante de un perno: φrn = 0.75·${pc.Fnv}·${r1(pc.Ab)} = ${r2(pc.phiRn)} kN`);
  pasos.push(`Aplastamiento: chapa borde ${r2(bE.phiRn)} kN, chapa interior ${r2(bI.phiRn)} kN, soporte ${r2(bS.phiRn)} kN`);
  pasos.push(`Centro instantáneo (e = ${e} mm, carga a ${ang}° de la vertical): C = ${r3(ic.C)}; método elástico: C = ${r3(el.C)} (referencia)`);
  add('pernos', 'Grupo de pernos excéntrico (centro instantáneo)', 'F.2.10.3 · Manual AISC parte 7', P, ic.C * rn, 'kN', `C = ${r2(ic.C)} · φrn = ${r2(rn)} kN (${cual})`);

  // Chapa: sección vertical en la columna de pernos más cercana a la carga
  const Hp = (nf - 1) * s + 2 * Lev, cen = (nc - 1) * g / 2, e1 = Math.max(0, e - cen);   // brazo hasta la línea de pernos más cercana a la carga
  const Mu = P * Math.cos(ang * Math.PI / 180) * e1 / 1000;
  const Zg = tp * Hp * Hp / 4; let Zn = Zg; for(let i = 0; i < nf; i++) Zn -= dn * tp * Math.abs(i * s - (nf - 1) * s / 2);
  add('chapa', 'Fluencia por flexión en la línea de pernos', 'Manual AISC parte 15 · F.2.6', Mu, 0.9 * pl.Fy * Zg / 1e6, 'kN·m', `Mu = P·e₁, e₁ = ${r1(e1)} mm`);
  add('chapa', 'Rotura por flexión en la línea de pernos', 'Manual AISC (9-4)', Mu, 0.75 * pl.Fu * Zn / 1e6, 'kN·m', `Znet = ${Math.round(Zn)} mm³`);
  const V = P * Math.cos(ang * Math.PI / 180);
  add('chapa', 'Fluencia por cortante', 'F.2.10.4.2 (J4-3)', V, 0.6 * pl.Fy * Hp * tp / 1000, 'kN', `Agv = ${r1(Hp * tp)} mm²`);
  add('chapa', 'Rotura por cortante', 'F.2.10.4.2 (J4-4)', V, 0.75 * 0.6 * pl.Fu * (Hp - nf * dn) * tp / 1000, 'kN', `Anv = ${r1((Hp - nf * dn) * tp)} mm²`);
  const max = ch.reduce((m, x) => Math.max(m, x.ratio), 0);
  return { ok:max <= 1 && !req.some(r => !r[1]), max, ch, req, av, pasos, geo:{ pernos, Hp, ic, el, e } };
}

// ── Chapa de testa extendida, 4 pernos sin rigidizar (4E) — decisión de Amo 10-nov: placa gruesa sin palanca ─────────────
// AISC Guía de diseño 4 (2.ª ed.) y 16 para la placa y el ala de la columna (líneas de fluencia, φ = 0.90);
// pernos, soldaduras, cortante y alma de la columna con NSR-10 F.2.10 (AISC 360-10 cap. J).
function defaultsTesta(){
  return { tipo:'testa', nom:'', desc:'', Mu:60, Vu:60, ambos:true, nbc:2,
    viga:'IPE 300', aceroViga:'A572 Gr 50',
    columna:'HEB 200', aceroCol:'A572 Gr 50', colTope:false,
    tp:22.2, bp:170, aceroPl:'A36', g:100, pfo:38, pfi:38, de:38,
    d:19.1, grado:'A325', rosca:'N',
    soldAla:'filete', wAla:8, wAlma:8, electrodo:'E70XX',
    // Ampliaciones pedidas por Amo el 19-nov:
    config:'4E', pb:89, tsE:10, wsE:8,                     // 4E = 4 pernos sin rigidizar · 8ES = 8 pernos con rigidizador de la extensión
    dosLados:false, Mu2:60, sentido2:'opuesto',            // viga al otro lado de la columna (opuesto = gravedad; mismo = sismo/viento)
    rigCol:'auto', tsC:'', bsC:'', wsC:'', aceroRigC:'A36', // rigidizadores (placas de continuidad) de la columna
    sismo:'no', Lh:6, Vg:30 };                             // F.3 (AISC 358): DMO = pórtico intermedio, DES = especial
}
const RY = ac => /A36/.test(ac) ? 1.5 : 1.1;                // NSR-10 F.3 / AISC 341 Tabla A3.1
const ESP_PL = [6.4, 8, 9.5, 12.7, 15.9, 19.1, 22.2, 25.4, 28.6, 31.8, 38.1];
function calcTesta(c){
  const ch = [], av = [], pasos = [], req = [];
  const d = +c.d, tp = +c.tp, bp = +c.bp, g = +c.g, pfo = +c.pfo, pfi = +c.pfi, de = +c.de;
  const vg = perfil(c.viga), vgX = perfilX(c.viga); if(!vg) return { error:'Escoja el perfil de la viga.' };
  const cl = c.columna ? perfil(c.columna) : null;
  const pl = ACEROS[c.aceroPl], av_ = ACEROS[c.aceroViga], ac = ACEROS[c.aceroCol], FEXX = ELECTRODOS[c.electrodo], B = PERNOS[c.grado], E = 200000;
  const add = (grupo, nombre, ref, dem, cap, ud, extra) => ch.push({ grupo, nombre, ref, dem, cap, ud, ratio: cap > 0 ? dem / cap : Infinity, extra });
  const dh = agujero(d), dn = anchoNeto(d), bm = bordeMin(d), Ab = Math.PI * d * d / 4;
  const db = vg.d, tbf = vg.tf, bbf = vg.bf, tbw = vg.tw;
  const ras = c.tipo === 'ras', nfR = ras && +c.filas === 1 ? 1 : 2, pb = +c.pb || 0;
  const e8 = !ras && c.config === '8ES';
  const sis = ['DMO', 'DES'].includes(c.sismo) ? c.sismo : '';
  // Factores φ: con sismo (AISC 358) φn = 0.90 para estados no dúctiles (pernos) y φd = 1.00 para los dúctiles (placa, ala de la columna)
  const phB = sis ? 0.9 : 0.75, phD = sis ? 1.0 : 0.9;
  // Brazos: extendida 4E h0 (exterior), h1 (interior); 8ES h1..h4 de afuera hacia adentro; a ras h1, h2
  let H; if(ras) H = { h1:db - 1.5 * tbf - pfi }, H.h2 = nfR === 2 ? H.h1 - pb : 0;
  else if(e8){ H = { h1:db - tbf / 2 + pfo + pb, h2:db - tbf / 2 + pfo, h3:db - 1.5 * tbf - pfi }; H.h4 = H.h3 - pb; }
  else H = { h0:db - tbf / 2 + pfo, h1:db - 1.5 * tbf - pfi };
  const sumH = Object.values(H).reduce((a, x) => a + x, 0), gr = ras ? 1.25 : 1.0;
  const h0 = H.h0 || 0, h1 = H.h1, h2 = H.h2 || 0;

  // ── Momento de diseño: con sismo, Mf en la cara de la columna (AISC 358 cap. 6) ──
  let Mu = Math.abs(+c.Mu || 0), Vu = Math.abs(+c.Vu || 0);
  pasos.push(`Viga ${vg.nom}: d = ${db}, bf = ${bbf}, tf = ${tbf}, tw = ${tbw} mm · Mu = ${r2(Mu)} kN·m, Vu = ${r2(Vu)} kN`);
  if(sis){
    const Fy = av_.Fy, Fu = av_.Fu, Ry = RY(c.aceroViga), Cpr = Math.min(1.2, (Fy + Fu) / (2 * Fy)), Zx = vgX ? vgX.Zx : bbf * tbf * (db - tbf) + tbw * (db - 2 * tbf) ** 2 / 4;
    const Mpr = Cpr * Ry * Fy * Zx / 1e6;
    const hst = pfo + pb + de, Lst = hst / Math.tan(Math.PI / 6), Sh = e8 ? Lst + tp : Math.min(db / 2, 3 * bbf);
    const Lh = Math.max(+c.Lh || 0, 0.1) * 1000, Vh = 2 * Mpr * 1000 / Lh + Math.abs(+c.Vg || 0), Mf = Mpr + Vh * Sh / 1000;
    pasos.push(`Sismo ${sis} (AISC 358, NSR-10 F.3): Cpr = (Fy + Fu)/(2Fy) ≤ 1.2 = ${r3(Cpr)}, Ry = ${Ry}, Zx = ${Math.round(Zx)} mm³ → Mpr = Cpr·Ry·Fy·Zx = ${r2(Mpr)} kN·m`);
    pasos.push(`Rótula a Sh = ${e8 ? `Lst + tp = ${r1(Lst)} + ${tp}` : 'mín(d/2; 3bf)'} = ${r1(Sh)} mm de la cara; Vu = 2Mpr/L'h + Vg = 2·${r2(Mpr)}/${r2(Lh / 1000)} + ${r2(+c.Vg || 0)} = ${r2(Vh)} kN; Mf = Mpr + Vu·Sh = ${r2(Mf)} kN·m`);
    if(Mf > Mu){ Mu = Mf; av.push(`Con sismo ${sis} la conexión se diseña con Mf = ${r2(Mf)} kN·m (momento probable de la viga), no con el momento del modelo.`); }
    if(Vh > Vu) Vu = Vh;
    pasos.push(`Factores de AISC 358: pernos φn = 0.90; placa y ala de la columna φd = 1.00`);
  }
  const Ffu = Mu * 1000 / (db - tbf);                                   // fuerza en el ala [kN]
  pasos.push(ras ? `Placa a ras con ${nfR} fila(s) de 2 pernos bajo el ala en tensión: h₁ = d − 1.5tf − pfi = ${r1(h1)} mm${nfR === 2 ? `, h₂ = h₁ − pb = ${r1(h2)} mm` : ''}; Ffu = ${r2(Ffu)} kN`
    : e8 ? `8 pernos en tensión (8ES): h₁ = d − tf/2 + pfo + pb = ${r1(H.h1)}, h₂ = ${r1(H.h2)}, h₃ = d − 1.5tf − pfi = ${r1(H.h3)}, h₄ = h₃ − pb = ${r1(H.h4)} mm; Ffu = Mu/(d − tf) = ${r2(Ffu)} kN`
    : `h₀ = d − tf/2 + pfo = ${r1(h0)} mm; h₁ = d − 1.5tf − pfi = ${r1(h1)} mm; Ffu = Mu/(d − tf) = ${r2(Ffu)} kN`);

  // Requisitos de geometría
  req.push(['Ancho de la placa bp ≤ bf + 25 mm (Guía 4)', bp <= bbf + 25 + 1e-6, `${bp} ≤ ${bbf + 25} mm`]);
  req.push(['Ancho de la placa bp ≥ bf de la viga', bp >= bbf - 1e-6, `${bp} ≥ ${bbf} mm`]);
  req.push(['Gramil g ≥ 3d (llave) y g ≤ bp − 2·borde mín.', g >= 3 * d - 1e-6 && g <= bp - 2 * bm + 1e-6, `${r1(3 * d)} ≤ ${g} ≤ ${bp - 2 * bm} mm`]);
  if(ras){ req.push(['pfi ≥ d + 12.7 mm (espacio para apretar)', pfi >= d + 12.7 - 1e-6, `${pfi} ≥ ${r1(d + 12.7)} mm`]);
    if(nfR === 2) req.push(['pb ≥ 2.67d', pb >= 2.67 * d - 1e-6, `${pb} ≥ ${r1(2.67 * d)} mm`]);
    req.push(['Los pernos caben antes de la mitad del alma: h₂ (o h₁) > d/2', (nfR === 2 ? h2 : h1) > db / 2, `${r1(nfR === 2 ? h2 : h1)} > ${r1(db / 2)} mm`]); }
  else { req.push(['pfo, pfi ≥ d + 12.7 mm (espacio para apretar)', Math.min(pfo, pfi) >= d + 12.7 - 1e-6, `${Math.min(pfo, pfi)} ≥ ${r1(d + 12.7)} mm`]);
    req.push(['Borde de la extensión de ≥ mín. Tabla F.2.10.3-4', de >= bm, `${de} ≥ ${bm} mm`]);
    if(e8) req.push(['Separación entre filas pb ≥ 2.67d', pb >= 2.67 * d - 1e-6, `${pb} ≥ ${r1(2.67 * d)} mm`]); }
  req.push(['Borde lateral (bp − g)/2 ≥ mín.', (bp - g) / 2 >= bm, `${r1((bp - g) / 2)} ≥ ${bm} mm`]);
  if(cl) req.push(['Gramil cabe en el ala de la columna: (bfc − g)/2 ≥ borde mín.', (cl.bf - g) / 2 >= bm, `${r1((cl.bf - g) / 2)} ≥ ${bm} mm`]);
  req.push(['Pernos pretensionados (F.2.10.3.1, conexión a momento)', true, 'indicar en planos']);

  // Límites de precalificación (AISC 358 Tabla 6.1, en mm) — solo con sismo
  if(sis){
    if(ras) req.push(['La placa a ras NO está precalificada para pórticos DMO/DES (AISC 358)', false, 'use placa extendida 4E u 8ES']);
    else { const L = e8 ? { tbf:[14, 25], bbf:[190, 311], d:[457, 914], tp:[19, 64], bp:[229, 381], g:[127, 152], pf:[41, 51], pb:[89, 95] }
                        : { tbf:[10, 19], bbf:[152, 235], d:[349, 1397], tp:[13, 57], bp:[178, 273], g:[102, 152], pf:[38, 114] };
      const rg = (n, v, [a, b]) => req.push([`Precalificación AISC 358: ${n} entre ${a} y ${b} mm`, v >= a - 0.5 && v <= b + 0.5, `${r1(v)} mm`]);
      rg('espesor del ala de la viga', tbf, L.tbf); rg('ancho del ala de la viga', bbf, L.bbf); rg('altura de la viga', db, L.d); rg('espesor de la placa', tp, L.tp);
      rg('ancho de la placa', bp, L.bp); rg('gramil', g, L.g); rg('pfo y pfi', Math.min(pfo, pfi), L.pf); if(Math.max(pfo, pfi) > L.pf[1] + 0.5) rg('pfo y pfi', Math.max(pfo, pfi), L.pf);
      if(e8) rg('separación pb', pb, L.pb);
      req.push(['Soldadura de las alas de la viga a la placa de penetración completa (AISC 358 §6.7)', c.soldAla === 'cjp', c.soldAla === 'cjp' ? 'CJP' : 'cambie a penetración completa']);
      req.push([`Zona protegida (sin soldaduras ni perforaciones) hasta ${e8 ? 'Lst + d/2... ver AISC 358 §6.3' : 'la mitad de la altura de la viga o 3bf desde la cara'} — indicar en planos`, true, 'indicar en planos']);
      if(sis === 'DES') av.push('Pórtico DES: revise también columna fuerte–viga débil (ΣM*pc/ΣM*pb > 1) y la zona de panel con NSR-10 F.3.5 (AISC 341 E3); esta app no tiene la carga axial de la columna.'); } }

  // 1. Pernos a tensión sin palanca: φMnp = φ·2·Pt·Σh
  const Pt = B.Fnt * Ab / 1000, phiMnp = phB * 2 * Pt * sumH / 1000;
  pasos.push(`Pernos: Ab = ${r1(Ab)} mm², Pt = Fnt·Ab = ${B.Fnt}·${r1(Ab)} = ${r2(Pt)} kN; φMnp = ${phB}·2·Pt·Σh = ${r2(phiMnp)} kN·m (Σh = ${r1(sumH)} mm)`);
  add('pernos', 'Rotura de los pernos a tensión (sin palanca)', `F.2.10.3.6 (J3-1) · ${sis ? 'AISC 358 (6.10-?) φn = 0.90' : 'Guía AISC 4'}`, Mu, phiMnp, 'kN·m',
    `Pt = ${r2(Pt)} kN, ` + Object.entries(H).filter(([, v]) => v).map(([k, v]) => `${k.replace('h', 'h')} = ${r1(v)}`).join(', ') + ' mm');
  // 2. Pernos a cortante en la zona de compresión
  const nb = c.ambos ? (ras ? 2 * nfR : e8 ? 8 : 4) : Math.max(0, Math.round(+c.nbc || 0));
  const rv = phB * B[c.rosca === 'X' ? 'X' : 'N'] * Ab / 1000;
  const bPl = ras ? Infinity : aplast(de - dh / 2, tp, d, pl.Fu).phiRn, bPlI = 2.4 * d * tp * pl.Fu * 0.75 / 1000;
  const bCol = cl ? 0.75 * 2.4 * d * cl.tf * ac.Fu / 1000 : Infinity;
  const rb = Math.min(rv, c.ambos ? Math.min(bPl, bPlI) : bPlI, bCol);
  add('pernos', `Cortante en los ${nb} pernos de la zona de compresión`, 'F.2.10.3.6 y F.2.10.3.10 (J3-1, J3-6)', Vu, nb * rb, 'kN', `φrn = ${r2(rb)} kN por perno (corte ${r2(rv)}, aplastamiento placa ${r2(Math.min(bPl, bPlI))}${cl ? `, ala columna ${r2(bCol)}` : ''})`);
  if(!nb) av.push('No hay pernos en la zona de compresión para tomar el cortante.');

  // 3. Placa: líneas de fluencia (placa gruesa: φd·Mpl ≥ 1.11·Mf o 1.11·φMnp)
  const sP = 0.5 * Math.sqrt(bp * g), pfiY = Math.min(pfi, sP);
  let Yp;
  if(ras) Yp = nfR === 1 ? bp / 2 * (h1 * (1 / pfiY + 1 / sP) - 0.5) + 2 / g * (h1 * (pfiY + sP))
    : bp / 2 * (h1 * (1 / pfiY + 1 / sP) + h2 / sP - 0.5) + 2 / g * (h1 * (pfiY + 0.75 * pb) + h2 * (sP + 0.25 * pb)) + g / 2;    // Guía AISC 16
  else if(e8){ const { h1:a1, h2:a2, h3:a3, h4:a4 } = H;                // AISC 358 Tabla 6.4 / Guía 4 (8ES)
    Yp = de <= sP ? bp / 2 * (a1 / (2 * de) + a2 / pfo + a3 / pfi + a4 / sP) + 2 / g * (a1 * (de + pb / 4) + a2 * (pfo + 3 * pb / 4) + a3 * (pfi + pb / 4) + a4 * (sP + 3 * pb / 4) + pb * pb) + g
                  : bp / 2 * (a1 / sP + a2 / pfo + a3 / pfi + a4 / sP) + 2 / g * (a1 * (sP + pb / 4) + a2 * (pfo + 3 * pb / 4) + a3 * (pfi + pb / 4) + a4 * (sP + 3 * pb / 4) + pb * pb) + g; }
  else Yp = bp / 2 * (h1 * (1 / pfiY + 1 / sP) + h0 / pfo - 0.5) + 2 / g * (h1 * (pfiY + sP));
  const demPl = sis ? 1.11 * Mu : 1.11 * gr * phiMnp;
  const phiMpl = phD * pl.Fy * tp * tp * Yp / 1e6, tpReq = Math.sqrt(demPl * 1e6 / (phD * pl.Fy * Yp));
  pasos.push(`Placa: s = ½√(bp·g) = ${r1(sP)} mm${pfi > sP && !e8 ? ` (pfi se limita a s)` : ''}; Yp = ${Math.round(Yp)} mm; φMpl = ${phD}·Fy·tp²·Yp = ${r2(phiMpl)} kN·m`);
  pasos.push(`Espesor para comportamiento de placa gruesa: tp,req = √(${sis ? '1.11·Mf' : '1.11·γr·φMnp'}/(${phD}·Fy·Yp)) = ${r1(tpReq)} mm${sis ? '' : ` (γr = ${gr})`}`);
  add('placa', 'Placa gruesa: flexión por líneas de fluencia', `Guía AISC 4/16${sis ? ' · AISC 358' : ''} · φ = ${phD}`, demPl, phiMpl, 'kN·m', `exige ${sis ? '1.11·Mf' : `1.11·γr·φMnp (γr = ${gr})`}; tp,req = ${r1(tpReq)} mm`);
  if(!ras){
    add('placa', 'Fluencia por cortante de la extensión', 'F.2.10.4.2 (J4-3)', Ffu / 2, 1.0 * 0.6 * pl.Fy * bp * tp / 1000, 'kN', `Ffu/2; Agv = bp·tp = ${r1(bp * tp)} mm²`);
    const An = (bp - 2 * dn) * tp;
    add('placa', 'Rotura por cortante de la extensión', 'F.2.10.4.2 (J4-4)', Ffu / 2, 0.75 * 0.6 * pl.Fu * An / 1000, 'kN', `Anv = (bp − 2·${r1(dn)})·tp = ${r1(An)} mm²`); }
  // 3b. 8ES: rigidizador de la extensión (AISC 358 §6.10 paso 6 y Guía 4)
  if(e8){ const tsE = +c.tsE || 0, hst = pfo + pb + de, Lst = hst / Math.tan(Math.PI / 6), FyS = pl.Fy;
    pasos.push(`Rigidizador de la extensión: alto hst = pfo + pb + de = ${r1(hst)} mm, largo Lst = hst/tan30° = ${r1(Lst)} mm, espesor ${tsE} mm`);
    req.push(['Rigidizador de la extensión: ts ≥ tw·Fy,viga/Fy,rig', tsE >= tbw * av_.Fy / FyS - 1e-6, `${tsE} ≥ ${r1(tbw * av_.Fy / FyS)} mm`]);
    req.push(['Rigidizador de la extensión: hst/ts ≤ 0.56·√(E/Fy) (pandeo local)', hst / tsE <= 0.56 * Math.sqrt(E / FyS) + 1e-6, `${r1(hst / tsE)} ≤ ${r1(0.56 * Math.sqrt(E / FyS))}`]);
    const wE = +c.wsE || 0, LwE = 2 * (Lst - 25);                  // filetes a ambas caras sobre el ala de la viga (chaflán 25 mm)
    const Rst = 0.6 * FyS * tsE * Lst / 1000;                      // fuerza de cortante que debe desarrollar la unión al ala (fluencia del rigidizador)
    add('soldadura', 'Rigidizador de la extensión al ala de la viga (desarrolla su fluencia por cortante)', 'F.2.10.2.4 (J2-4) · AISC 358 §6.10', Rst, fw2(FEXX, wE) * LwE, 'kN', `filetes ${wE} mm por ambas caras, L = 2·(Lst − 25) = ${r1(LwE)} mm${tsE > 10 ? ' · con ts > 10 mm AISC 358 pide penetración completa a la placa' : ''}`);
    if(tsE > 10) req.push(['Rigidizador de la extensión con ts > 10 mm: soldadura CJP a la placa (AISC 358 §6.10)', true, 'indicar en planos']); }

  // 4. Soldaduras
  const fw = w => fw2(FEXX, w);
  if(c.soldAla === 'cjp') pasos.push('Alas: soldadura de penetración completa (resistencia igual a la del ala, F.2.10.2.4 Tabla J2.5)');
  else { const Lw = 2 * bbf - tbw, wA = +c.wAla;
    add('soldadura', 'Filetes ala–placa (transversales, ambas caras)', 'F.2.10.2.4 (J2-4, J2-5: 1.0 + 0.5 sen¹·⁵θ = 1.5)', Ffu, 1.5 * fw(wA) * Lw, 'kN', `w = ${wA} mm, L = 2bf − tw = ${r1(Lw)} mm`);
    const tm = Math.min(tp, tbf); req.push(['Filete del ala ≥ mín. Tabla J2.4', wA >= (tm <= 6 ? 3 : tm <= 13 ? 5 : tm <= 19 ? 6 : 8), `${wA} mm`]); }
  const wW = +c.wAlma;
  add('soldadura', 'Alma–placa cerca de los pernos en tensión (desarrolla Fy del alma)', 'Guía AISC 4 · F.2.10.2.4', 0.9 * av_.Fy * tbw / 1000, 2 * fw(wW), 'kN/mm', `0.9·Fy·tw contra 2 filetes de ${wW} mm`);
  const LwV = Math.max(0, Math.min(db / 2 - tbf, db - 2 * tbf - pfi - 2 * d));
  add('soldadura', 'Alma–placa a cortante', 'F.2.10.2.4 (J2-4)', Vu, 2 * fw(wW) * LwV, 'kN', `L = mín(d/2 − tf; d − 2tf − pfi − 2d) = ${r1(LwV)} mm por cara`);
  add('viga', 'Cortante del alma de la viga', 'F.2.7.2 (G2-1), φv = 1.0', Vu, 1.0 * 0.6 * av_.Fy * db * tbw / 1000, 'kN', `0.6·Fy·d·tw`);

  // 5. Columna (ala, alma, panel) con o sin rigidizadores y con viga al otro lado
  let rig = null;
  if(cl){
    const kc = cl.tf + cl.r, dc = cl.d, hcw = dc - 2 * kc, sC = 0.5 * Math.sqrt(cl.bf * g);
    const cc = ras ? pfi + tbf + (nfR === 2 ? pb : 0) : pfo + pfi + tbf;
    const dos = !!c.dosLados, Mu2 = dos ? Math.abs(+c.Mu2 || 0) : 0, F2 = Mu2 * 1000 / (db - tbf), opuesto = dos && c.sentido2 !== 'mismo';
    const Fcol = Math.max(Ffu, F2);                                 // fuerza de ala que llega a cada lado (la mayor)
    if(dos) pasos.push(`Viga al otro lado: M₂ = ${r2(Mu2)} kN·m → F₂ = ${r2(F2)} kN; momentos ${opuesto ? 'opuestos (gravedad): las alas inferiores aprietan el alma desde los dos lados (J10-8) y el panel recibe la diferencia' : 'del mismo sentido (sismo/viento): el panel recibe la suma'}`);
    // a) sin rigidizadores
    let Yc;
    if(ras) Yc = nfR === 1 ? cl.bf / 2 * (h1 / sC) + 2 / g * (h1 * sC) + g / 2 : cl.bf / 2 * (h1 / sC + h2 / sC) + 2 / g * (h1 * (sC + pb / 4) + h2 * (sC + 3 * pb / 4) + pb * pb / 2) + g / 2;   // por confirmar (Guía 16)
    else if(e8) Yc = cl.bf / 2 * (H.h1 / sC + H.h4 / sC) + 2 / g * (H.h1 * (pb + cc / 2 + sC) + H.h2 * (pb / 2 + cc / 4) + H.h3 * (pb / 2 + cc / 2) + H.h4 * sC) + g / 2;   // AISC 358 Tabla 6.5 (8ES), por confirmar
    else Yc = cl.bf / 2 * (h1 / sC + h0 / sC) + 2 / g * (h1 * (sC + 3 * cc / 4) + h0 * (sC + cc / 4) + cc * cc / 2) + g / 2;
    // Demanda en el ala: sin sismo, Mu (la palanca se avisa con tcf,req de placa gruesa); con sismo, 1.11·Mf (AISC 358)
    const demCf = sis ? 1.11 * Mu : Mu, demThick = sis ? 1.11 * Mu : 1.11 * gr * phiMnp;
    const phiMcf = phD * ac.Fy * cl.tf * cl.tf * Yc / 1e6, tcfReq = Math.sqrt(demThick * 1e6 / (phD * ac.Fy * Yc));
    const N = tbf + 2 * (c.soldAla === 'cjp' ? 0 : +c.wAla), lN = N + 2 * tp;
    const ly = (c.colTope ? 2.5 : 6) * kc + N + 2 * tp, lt = (c.colTope ? 3 : 6) * kc + cc;
    const Rly = 1.0 * ac.Fy * cl.tw * ly / 1000, Rlt = 1.0 * ac.Fy * cl.tw * lt / 1000;
    const crip = c.colTope && lN / dc > 0.2 ? 0.4 * cl.tw ** 2 * (1 + (4 * lN / dc - 0.2) * (cl.tw / cl.tf) ** 1.5) * Math.sqrt(E * ac.Fy * cl.tf / cl.tw)
      : (c.colTope ? 0.4 : 0.8) * cl.tw ** 2 * (1 + 3 * (lN / dc) * (cl.tw / cl.tf) ** 1.5) * Math.sqrt(E * ac.Fy * cl.tf / cl.tw);
    const Rcr = 0.75 * crip / 1000;
    const Rpb = opuesto ? 0.9 * 24 * cl.tw ** 3 * Math.sqrt(E * ac.Fy) / hcw / 1000 * (c.colTope ? 0.5 : 1) : Infinity;   // J10-8
    const Rfl = phiMcf * 1000 / (db - tbf);                          // fuerza de ala que aguanta el ala de la columna sin rigidizar
    // b) ¿hacen falta rigidizadores? fuerza que deben tomar = la mayor diferencia
    const faltas = [['flexión del ala de la columna', Rfl, cl.tf < tcfReq ? Fcol : 0], ['fluencia local del alma (compresión)', Rly, Fcol], ['aplastamiento del alma', Rcr, Fcol],
      ['fluencia local del alma (tensión)', Rlt, Fcol], ...(opuesto ? [['pandeo del alma por las dos alas (J10-8)', Rpb, Math.min(Ffu, F2)]] : [])];
    const Rst = Math.max(0, ...faltas.map(([, R, F]) => F - R), cl.tf < tcfReq ? Fcol - Rfl : 0);
    // Con sismo (AISC 341 E3.6f / NSR-10 F.3): placas de continuidad salvo que tcf ≥ 0.4·√(1.8·bbf·tbf·Ryb·Fyb/(Ryc·Fyc)) y tcf ≥ bbf/6
    const tcfSis = Math.max(0.4 * Math.sqrt(1.8 * bbf * tbf * RY(c.aceroViga) * av_.Fy / (RY(c.aceroCol) * ac.Fy)), bbf / 6), sisPide = sis && cl.tf < tcfSis;
    if(sis) pasos.push(`Sismo: el ala de la columna evita placas de continuidad si tcf ≥ máx(0.4·√(1.8·bf·tf·Ry·Fy,viga/(Ry·Fy,col)); bf/6) = ${r1(tcfSis)} mm → ${sisPide ? 'se requieren' : 'no las exige el sismo'}`);
    const usar = c.rigCol === 'si' || (c.rigCol !== 'no' && (Rst > 0 || cl.tf < tcfReq || sisPide));
    if(!usar){
      add('columna', 'Flexión del ala de la columna (sin rigidizadores)', `Guía AISC 4/16 · φ = ${phD}`, demCf, phiMcf, 'kN·m', `Yc = ${Math.round(Yc)} mm; tcf para placa gruesa = ${r1(tcfReq)} mm`);
      if(cl.tf < tcfReq) av.push(`El ala de la columna (${cl.tf} mm) es más delgada que ${r1(tcfReq)} mm: habrá palanca en los pernos. Active los rigidizadores de la columna o use una de ala más gruesa.`);
      add('columna', 'Fluencia local del alma (compresión)', `F.2.10.10.2 (J10-${c.colTope ? 3 : 2})`, Fcol, Rly, 'kN', `L = ${c.colTope ? '2.5' : '6'}k + N + 2tp = ${r1(ly)} mm`);
      add('columna', 'Aplastamiento del alma (compresión)', 'F.2.10.10.3 (J10-4/5)', Fcol, Rcr, 'kN', `lb = N + 2tp = ${r1(lN)} mm`);
      add('columna', 'Fluencia local del alma (tensión)', 'Guía AISC 4 · F.2.10.10.2', Fcol, Rlt, 'kN', `L = ${c.colTope ? '3' : '6'}k + c = ${r1(lt)} mm`);
      if(opuesto) add('columna', 'Pandeo del alma por compresión de las dos alas', 'F.2.10.10.5 (J10-8), φ = 0.90', Math.min(Ffu, F2), Rpb, 'kN', `24·tw³·√(E·Fy)/h, h = ${r1(hcw)} mm`);
      if(Rst > 0 && c.rigCol === 'no') av.push(`Faltan ${r2(Rst)} kN en la columna: cambie «Rigidizadores de la columna» a automático para diseñarlos.`);
    } else {
      // c) Rigidizadores transversales (placas de continuidad) a la altura de las dos alas de la viga, a ambos lados del alma — F.2.10.10.7/8 (J10.7, J10.8)
      const ar = ACEROS[c.aceroRigC] || ACEROS.A36, clip = 20, bsMax = (cl.bf - cl.tw) / 2;
      const bsMin = Math.max(bbf / 3 - cl.tw / 2, 0);
      const bs = +c.bsC > 0 ? +c.bsC : Math.floor(bsMax - 2);
      const Lr = dc - 2 * cl.tf;                                     // largo completo entre alas
      const Fst = Rst;                                               // fuerza que el alma no alcanza a tomar (J10.7)
      const capT = t => 0.9 * ar.Fy * 2 * (bs - clip) * t / 1000;    // tensión: 2 placas, área en contacto con el ala
      const capC = t => { const Ae = 2 * bs * t + 25 * cl.tw * cl.tw, Ie = t * (2 * bs + cl.tw) ** 3 / 12, rr = Math.sqrt(Ie / Ae), KL = 0.75 * Lr;
        return 0.9 * fcrE3(ar.Fy, KL / rr) * Ae / 1000; };
      const tMin = Math.max(tbf / 2, bs / (0.56 * Math.sqrt(E / ar.Fy)), sis ? (dos ? tbf : tbf / 2) : 0);
      const ts = +c.tsC > 0 ? +c.tsC : (ESP_PL.find(t => t >= tMin - 1e-6 && capT(t) >= Fst && capC(t) >= Fst) || 38.1);
      const fwr = w => fw2(FEXX, w);
      const wsMin = Math.min(ts, cl.tf) <= 6 ? 3 : Math.min(ts, cl.tf) <= 13 ? 5 : Math.min(ts, cl.tf) <= 19 ? 6 : 8;
      // filetes al ala: 2 placas × 2 caras × (bs − clip), transversales (×1.5); al alma: 2 placas × 2 caras × (Lr − 2·clip)
      const wsReq = Math.max(wsMin, ...[3, 5, 6, 8, 10, 12, 14, 16].filter(w => 1.5 * fwr(w) * 4 * (bs - clip) >= Fst && fwr(w) * 4 * (Lr - 2 * clip) >= Fst).slice(0, 1));
      const ws = +c.wsC > 0 ? +c.wsC : wsReq;
      rig = { bs, ts, ws, Lr, clip };
      pasos.push(`Rigidizadores de la columna (${c.rigCol === 'si' ? 'pedidos' : sisPide ? 'exigidos con sismo' : 'necesarios'}): fuerza que deben tomar Rst = ${r2(Fst)} kN${faltas.filter(([, R, F]) => F > R).length ? ` (falla sin ellos: ${faltas.filter(([, R, F]) => F > R).map(([n]) => n).join(', ')})` : ''}`);
      pasos.push(`2 placas por cada ala de la viga (una a cada lado del alma): ${bs} × ${ts} mm, largo ${r1(Lr)} mm, ${c.aceroRigC || 'A36'}, chaflán ${clip} mm; filetes de ${ws} mm`);
      // ala de la columna rigidizada: Yc con placas de continuidad (AISC 358 Tablas 6.5/6.6), pso = psi = (c − ts)/2
      // a ras: la placa queda a la altura del ala de la viga y la fila interior a psi = pfi + tf/2 − ts/2 de ella
      const ps = Math.max(ras ? pfi + tbf / 2 - ts / 2 : (cc - ts) / 2, 1);
      let YcS;
      if(e8) YcS = cl.bf / 2 * (H.h1 / sC + H.h2 / ps + H.h3 / ps + H.h4 / sC) + 2 / g * (H.h1 * (sC + pb / 4) + H.h2 * (ps + 3 * pb / 4) + H.h3 * (ps + pb / 4) + H.h4 * (sC + 3 * pb / 4) + pb * pb) + g;   // por confirmar
      else if(ras) YcS = nfR === 1 ? cl.bf / 2 * (h1 * (1 / sC + 1 / ps)) + 2 / g * (h1 * (sC + ps))
        : cl.bf / 2 * (h1 * (1 / sC + 1 / ps) + h2 / sC) + 2 / g * (h1 * (ps + 3 * pb / 4) + h2 * (sC + pb / 4) + pb * pb / 2) + g / 2;   // Guía AISC 16, por confirmar
      else YcS = cl.bf / 2 * (h1 * (1 / sC + 1 / ps) + h0 * (1 / sC + 1 / ps)) + 2 / g * (h1 * (sC + ps) + h0 * (sC + ps));
      YcS = Math.max(YcS, Yc);                                       // rigidizar nunca baja la capacidad del ala
      const phiMcfS = phD * ac.Fy * cl.tf * cl.tf * YcS / 1e6;
      const tcfReqS = Math.sqrt(demThick * 1e6 / (phD * ac.Fy * YcS));
      add('columna', 'Flexión del ala de la columna (con rigidizadores)', `Guía AISC 4 / AISC 358 · φ = ${phD}`, demCf, phiMcfS, 'kN·m', `Yc rigidizada = ${Math.round(YcS)} mm (${ras ? 'psi' : 'pso = psi'} = ${r1(ps)} mm); tcf para placa gruesa = ${r1(tcfReqS)} mm`);
      if(!sis && cl.tf < tcfReqS) av.push(`Aun con rigidizadores el ala de la columna (${cl.tf} mm) es más delgada que ${r1(tcfReqS)} mm: habrá algo de palanca en los pernos. Use una columna de ala más gruesa o revise los pernos con palanca.`);
      add('columna', 'Alma en compresión: fluencia local + rigidizadores', `F.2.10.10.2 (J10-2) + J10.8`, Fcol, Rly + capT(ts), 'kN', `alma ${r2(Rly)} + placas ${r2(capT(ts))} kN`);
      add('columna', 'Alma en compresión: aplastamiento + rigidizadores', 'F.2.10.10.3 (J10-4) + J10.8', Fcol, Rcr + capC(ts), 'kN', `alma ${r2(Rcr)} + placas como columna ${r2(capC(ts))} kN`);
      add('columna', 'Alma en tensión: fluencia local + rigidizadores', 'Guía AISC 4 + J10.8', Fcol, Rlt + capT(ts), 'kN', `alma ${r2(Rlt)} + placas ${r2(capT(ts))} kN`);
      if(opuesto) add('columna', 'Pandeo del alma por las dos alas + rigidizadores', 'F.2.10.10.5 (J10-8) + J10.8', Math.min(Ffu, F2), Rpb + capC(ts), 'kN', `alma ${r2(Rpb)} + placas ${r2(capC(ts))} kN`);
      if(Fst > 0){
      add('rigidizador', 'Placas de continuidad: fluencia a tensión', 'F.2.10.10.8 (J10.8) · φ = 0.90', Fst, capT(ts), 'kN', `0.9·Fy·2·(bs − ${clip})·ts`);
      add('rigidizador', 'Placas de continuidad: compresión como columna (K = 0.75, 25tw de alma)', 'F.2.10.10.8 (J10.8) · F.2.5 (E3)', Fst, capC(ts), 'kN', `L = ${r1(Lr)} mm`);
      add('soldadura', 'Filetes de los rigidizadores al ala de la columna', 'F.2.10.2.4 (J2-4, J2-5 = 1.5)', Fst, 1.5 * fwr(ws) * 4 * (bs - clip), 'kN', `4 filetes de ${ws} mm × ${bs - clip} mm`);
      add('soldadura', 'Filetes de los rigidizadores al alma de la columna', 'F.2.10.2.4 (J2-4)', Fst, fwr(ws) * 4 * (Lr - 2 * clip), 'kN', `4 filetes de ${ws} mm × ${r1(Lr - 2 * clip)} mm`); }
      else pasos.push('El alma no necesita fuerza adicional: los rigidizadores van con las dimensiones mínimas de J10.8 para que el ala de la columna trabaje como placa gruesa (sin palanca en los pernos).');
      req.push(['Rigidizador: bs + tw/2 ≥ bf de la viga/3 (J10.8)', bs >= bsMin - 1e-6, `${bs} ≥ ${r1(bsMin)} mm`]);
      req.push(['Rigidizador: bs ≤ (bfc − twc)/2 (cabe en el ala)', bs <= bsMax + 1e-6, `${bs} ≤ ${r1(bsMax)} mm`]);
      req.push(['Rigidizador: ts ≥ tf de la viga/2 (J10.8)', ts >= tbf / 2 - 1e-6, `${ts} ≥ ${r1(tbf / 2)} mm`]);
      req.push(['Rigidizador: bs/ts ≤ 0.56·√(E/Fy) (J10.8)', bs / ts <= 0.56 * Math.sqrt(E / ar.Fy) + 1e-6, `${r1(bs / ts)} ≤ ${r1(0.56 * Math.sqrt(E / ar.Fy))}`]);
      if(sisPide) req.push([`Con sismo: placas de continuidad ts ≥ ${dos ? 'tf de la viga (conexión a los dos lados)' : 'tf/2 de la viga'} (AISC 341 E3.6f)`, ts >= (dos ? tbf : tbf / 2) - 1e-6, `${ts} mm`]);
      req.push(['Filete de los rigidizadores ≥ mín. Tabla J2.4', ws >= wsMin, `${ws} ≥ ${wsMin} mm`]);
      req.push([`Chaflán de ${clip} mm en las esquinas de las placas (radio de la columna)`, true, 'indicar en planos']);
    }
    // d) zona de panel: una viga, suma (mismo sentido) o diferencia (opuestos)
    const Vp = !dos ? Ffu : opuesto ? Math.abs(Ffu - F2) : Ffu + F2, Rv = 0.9 * 0.6 * ac.Fy * dc * cl.tw / 1000;
    add('columna', 'Zona de panel (cortante del alma)', 'F.2.10.10.6 (J10-9), φ = 0.90', Vp, Rv, 'kN', `${!dos ? 'Ffu' : opuesto ? '|F₁ − F₂|' : 'F₁ + F₂'} contra 0.6·Fy·dc·tw (sin cortante de la columna)`);
    if(Vp > Rv){ const tdq = Vp * 1000 / (0.9 * 0.6 * ac.Fy * dc) - cl.tw, td = ESP_PL.find(t => t >= Math.max(tdq, (dc - 2 * cl.tf) / 90) - 1e-6) || 38.1;
      av.push(`La zona de panel no alcanza (${r2(Vp)} > ${r2(Rv)} kN): agregue una placa de refuerzo del alma (doubler) de ${td} mm (${c.aceroCol}), soldada al alma y a las alas de la columna, o use una columna de alma más gruesa.`); }
    pasos.push(`Columna ${cl.nom}: bf = ${cl.bf}, tf = ${cl.tf}, tw = ${cl.tw}, k = ${r1(kc)} mm; s = ${r1(sC)}, c = ${r1(cc)} mm; Yc sin rigidizar = ${Math.round(Yc)} mm, φMcf = ${r2(phiMcf)} kN·m, tcf,req = ${r1(tcfReq)} mm`);
  } else av.push('No se revisó la columna: escoja su perfil para revisar el ala y el alma.');

  req.filter(r => !r[1]).forEach(r => av.push(`${r[0]}: ${r[2]}`));
  const max = ch.reduce((m, x) => Math.max(m, x.ratio), 0);
  const ext = e8 ? pfo + pb + de : pfo + de;
  const Hp = ras ? db + 50 : c.ambos ? db + 2 * ext : db + ext + 25;
  return { ok:max <= 1 && !req.some(r => !r[1]), max, ch, req, av, pasos, geo:{ vg, cl, Hp, h0, h1, h2, H, e8, ras, nfR, dh, rig, Mu, nTot: ras ? (c.ambos ? 4 * nfR : 2 * nfR + nb) : e8 ? (c.ambos ? 16 : 8 + nb) : c.ambos ? 8 : 4 + nb } };
}
const fw2 = (FEXX, w) => 0.75 * 0.6 * FEXX * 0.707 * w / 1000;      // kN/mm, F.2.10.2.4 (J2-4)

function defaultsAngular(){
  return { tipo:'angular', nom:'', desc:'', Vu:80,
    viga:'IPE 300', aceroViga:'A572 Gr 50', holgura:13,
    soporte:'ala', tSop:10.7, aceroSop:'A572 Gr 50', dosLados:false,
    bAng:89, tAng:7.9, aceroAng:'A36', n:3, s:75, Lev:38, g1:51, g2:51,
    d:19.1, grado:'A325', rosca:'N',
    unSop:'pernos', wS:6, electrodo:'E70XX',                      // unión al soporte: atornillada o soldada (pedido de Amo 18-nov)
    destaje:'no', dct:35, dcb:35, cDes:110, LevB:38 };             // viga con destaje: no | sup | ambos
}
function calcAngular(c){
  const ch = [], av = [], pasos = [], req = [];
  const V = Math.abs(+c.Vu || 0), d = +c.d, n = Math.max(1, Math.round(+c.n || 1)), s = +c.s, Lev = +c.Lev, b = +c.bAng, t = +c.tAng, g1 = +c.g1, g2 = +c.g2, hol = +c.holgura || 0;
  const vg = perfil(c.viga); if(!vg) return { error:'Escoja el perfil de la viga.' };
  const an = ACEROS[c.aceroAng], av_ = ACEROS[c.aceroViga], sp = ACEROS[c.aceroSop], B = PERNOS[c.grado];
  const sold = c.unSop === 'sold', des = ['sup', 'ambos'].includes(c.destaje) ? c.destaje : 'no';
  const add = (grupo, nombre, ref, dem, cap, ud, extra) => ch.push({ grupo, nombre, ref, dem, cap, ud, ratio: cap > 0 ? dem / cap : Infinity, extra });
  const dh = agujero(d), dn = anchoNeto(d), bm = bordeMin(d), Ab = Math.PI * d * d / 4, L = (n - 1) * s + 2 * Lev;
  const LehA = b - (sold ? g1 : Math.max(g1, g2)), LehV = g1 - hol;
  // Destaje: profundidades arriba (dct) y abajo (dcb), largo c, borde LevB del perno superior al corte; los angulares quedan bajo el corte
  const dct = des !== 'no' ? +c.dct || 0 : 0, dcb = des === 'ambos' ? +c.dcb || 0 : 0, cD = des !== 'no' ? +c.cDes || 0 : 0, LevB = +c.LevB || 0;
  const ho = vg.d - dct - dcb, yb = des !== 'no' ? dct + LevB - Lev : (vg.d - L) / 2;
  pasos.push(`Viga ${vg.nom}: d = ${vg.d}, tw = ${vg.tw}, T = ${r1(vg.T)} mm · Vu = ${r2(V)} kN`);
  pasos.push(`Angulares 2L ${b}×${b}×${t} mm (${c.aceroAng}), largo L = (n − 1)·s + 2·Lev = ${r1(L)} mm; ${n} pernos en el alma (doble cortante)${sold ? ' y soldados al soporte' : ` y ${2 * n} en el soporte (cortante simple)`}`);
  if(des !== 'no') pasos.push(`Destaje ${des === 'sup' ? 'del ala superior' : 'de las dos alas'}: dc = ${dct}${dcb ? ` / ${dcb}` : ''} mm, c = ${cD} mm → altura del alma que queda ho = ${r1(ho)} mm; perno superior a ${LevB} mm del corte`);
  req.push(['Largo de los angulares L ≥ T/2 (estabilidad)', L >= vg.T / 2 - 1e-6, `${r1(L)} ≥ ${r1(vg.T / 2)} mm`]);
  if(des === 'no') req.push(['Largo de los angulares L ≤ T (caben entre las alas)', L <= vg.T + 1e-6, `${r1(L)} ≤ ${r1(vg.T)} mm`]);
  else { const fondo = des === 'ambos' ? vg.d - dcb : vg.d - vg.tf - (vg.r || 0);
    req.push(['Los angulares caben en el alma bajo el destaje', yb >= dct - 1e-6 && yb + L <= fondo + 1e-6, `de ${r1(yb)} a ${r1(yb + L)} mm (alma libre de ${r1(dct)} a ${r1(fondo)} mm)`]);
    req.push(['Borde del perno superior al corte del destaje LevB ≥ mín.', LevB >= bm, `${LevB} ≥ ${bm} mm`]);
    req.push(['Largo del destaje c ≤ 2d (validez de las ecuaciones del Manual AISC parte 9)', cD <= 2 * vg.d, `${cD} ≤ ${2 * vg.d} mm`]);
    if(des === 'sup') req.push(['Profundidad del destaje dc ≤ d/2', dct <= vg.d / 2, `${dct} ≤ ${r1(vg.d / 2)} mm`]);
    else req.push(['Profundidades del destaje dc ≤ 0.2d (arriba y abajo)', Math.max(dct, dcb) <= 0.2 * vg.d, `${Math.max(dct, dcb)} ≤ ${r1(0.2 * vg.d)} mm`]);
    if(cD < hol + b) av.push(`Revise que el destaje alcance a librar el ala del soporte: c = ${cD} mm y holgura + b = ${r1(hol + b)} mm (depende del ancho del ala que se cruza).`); }
  req.push(['Separación s ≥ 2.67d (preferible 3d)', s >= 2.67 * d - 1e-6, `${s} ≥ ${r1(2.67 * d)} mm`]);
  req.push(['Borde vertical Lev ≥ mín. Tabla F.2.10.3-4', Lev >= bm, `${Lev} ≥ ${bm} mm`]);
  req.push(['Borde horizontal del angular b − g ≥ mín.', LehA >= bm, `${r1(LehA)} ≥ ${bm} mm`]);
  req.push(['Borde horizontal en la viga g₁ − holgura ≥ mín.', LehV >= bm, `${r1(LehV)} ≥ ${bm} mm`]);
  req.push(['Espacio para apretar: g ≥ d + 12.7 mm', (sold ? g1 : Math.min(g1, g2)) >= d + 12.7 - 1e-6, `${sold ? g1 : Math.min(g1, g2)} ≥ ${r1(d + 12.7)} mm`]);
  req.push(['Angulares flexibles: t ≤ 16 mm (Manual AISC parte 10)', t <= 16, `${t} mm`]);

  // Pernos en el alma de la viga: doble cortante
  const rv = 0.75 * B[c.rosca === 'X' ? 'X' : 'N'] * Ab / 1000;
  const brg = (lc, tt, Fu) => aplast(lc, tt, d, Fu).phiRn;
  const lcE = Lev - dh / 2, lcI = s - dh;
  const angE = brg(lcE, t, an.Fu), angI = brg(lcI, t, an.Fu), web = 0.75 * 2.4 * d * vg.tw * av_.Fu / 1000;
  // con destaje la carga sube contra el borde del corte: el perno superior desgarra el alma hacia el destaje
  const webE = des !== 'no' ? brg(LevB - dh / 2, vg.tw, av_.Fu) : web;
  const rWebE = Math.min(2 * rv, webE, 2 * angE), rWebI = Math.min(2 * rv, web, 2 * angI);
  const capWeb = rWebE + (n - 1) * rWebI;
  pasos.push(`Corte de un perno φrn = 0.75·Fnv·Ab = ${r2(rv)} kN; aplastamiento en el angular: borde ${r2(angE)} kN (lc = ${r1(lcE)}), interior ${r2(angI)} kN (lc = ${r1(lcI)}); alma de la viga ${r2(web)} kN${des !== 'no' ? `, perno junto al destaje ${r2(webE)} kN (lc = ${r1(LevB - dh / 2)})` : ''}`);
  add('pernos', `Pernos en el alma de la viga (${n}, doble cortante)`, 'F.2.10.3.6 y F.2.10.3.10 (J3-1, J3-6)', V, capWeb, 'kN', `por perno: borde ${r2(rWebE)}, interior ${r2(rWebI)} kN`);
  if(!sold){
    // Pernos en el soporte: cortante simple, 2 por fila
    const sop = 0.75 * 2.4 * d * +c.tSop * sp.Fu / 1000 / (c.dosLados ? 2 : 1);
    const rSE = Math.min(rv, angE, sop), rSI = Math.min(rv, angI, sop), capSop = 2 * (rSE + (n - 1) * rSI);
    add('pernos', `Pernos en el soporte (${2 * n}, cortante simple)`, 'F.2.10.3.6 y F.2.10.3.10 (J3-1, J3-6)', V, capSop, 'kN', `por perno: borde ${r2(rSE)}, interior ${r2(rSI)} kN; soporte ${r2(sop)} kN${c.dosLados ? ' (comparte agujeros)' : ''}`);
    pasos.push('Se desprecia la excentricidad de los pernos (angulares flexibles, Manual AISC parte 10).');
  } else {
    // Soldadura en las alas salientes (Manual AISC parte 10, «soldadura B»): dos líneas verticales de largo L con retorno arriba, excentricidad e = b
    const FEXX = ELECTRODOS[c.electrodo] || 482, w = +c.wS || 0, fwl = 0.75 * 0.6 * FEXX * 0.707 * w / 1000;
    const fr = V / (2 * L * L) * Math.sqrt(L * L + 12.96 * b * b);
    pasos.push(`Soldadura en el soporte: filete ${w} mm ${c.electrodo} en el borde de cada angular (largo L = ${r1(L)} mm, retorno de 2w arriba); e = b = ${b} mm`);
    pasos.push(`f = Vu/(2L²)·√(L² + 12.96·e²) = ${r3(fr)} kN/mm; φ·0.6·FEXX·0.707·w = ${r3(fwl)} kN/mm`);
    add('soldadura', 'Filetes de los angulares al soporte (con la excentricidad e = b)', 'F.2.10.2.4 (J2-4) · Manual AISC parte 10', fr, fwl, 'kN/mm', `f = Vu/(2L²)·√(L² + 12.96·b²)`);
    add('soldadura', 'Metal base del angular junto al filete', 'F.2.10.2.4 (J2-2) · J4-4', fr, 0.75 * 0.6 * an.Fu * t / 1000, 'kN/mm', '0.75·0.6·Fu·t');
    const tS = +c.tSop || 0;
    add('soporte', 'Metal base del soporte junto a los filetes', 'F.2.10.2.4 (J2-2) · J4-4', fr * (c.dosLados ? 2 : 1), 0.75 * 0.6 * sp.Fu * tS / 1000, 'kN/mm', `0.75·0.6·Fu·t${c.dosLados ? ' · con conexión a los dos lados del alma (2 filetes sobre el mismo espesor)' : ''}`);
    const tmin = Math.min(t, tS), wmin = tmin <= 6 ? 3 : tmin <= 13 ? 5 : tmin <= 19 ? 6 : 8, wmax = t < 6 ? t : t - 1.6;
    req.push(['Filete mínimo Tabla J2.4 (parte más delgada)', w >= wmin, `${w} ≥ ${wmin} mm`]);
    req.push(['Filete máximo en el borde del angular (t − 1.6 mm)', w <= wmax + 1e-6, `${w} ≤ ${r1(wmax)} mm`]);
    req.push(['Retorno del filete en la parte superior = 2w', true, `${r1(2 * w)} mm (indicar en planos)`]);
  }

  // Angulares (los dos)
  const Agv = 2 * L * t, Anv = 2 * (L - n * dn) * t;
  add('angulares', 'Fluencia por cortante (2 angulares)', 'F.2.10.4.2 (J4-3)', V, 1.0 * 0.6 * an.Fy * Agv / 1000, 'kN', `Agv = 2·L·t = ${r1(Agv)} mm²`);
  add('angulares', 'Rotura por cortante (2 angulares)', 'F.2.10.4.2 (J4-4)', V, 0.75 * 0.6 * an.Fu * Anv / 1000, 'kN', `Anv = 2·(L − n·${r1(dn)})·t = ${r1(Anv)} mm²`);
  const bloque = Lh => { const agv = (L - Lev) * t, anv = (L - Lev - (n - 0.5) * dn) * t, ant = (Lh - 0.5 * dn) * t;
    return { phiRn: 2 * 0.75 * Math.min(0.6 * an.Fu * anv + an.Fu * ant, 0.6 * an.Fy * agv + an.Fu * ant) / 1000, agv, anv, ant }; };
  const bkW = bloque(b - g1);
  add('angulares', 'Bloque de cortante, ala sobre la viga (×2)', 'F.2.10.4.3 (J4-5), Ubs = 1.0', V, bkW.phiRn, 'kN', `por angular Agv = ${r1(bkW.agv)}, Anv = ${r1(bkW.anv)}, Ant = ${r1(bkW.ant)} mm²`);
  if(!sold){ const bkS = bloque(b - g2);
    add('angulares', 'Bloque de cortante, ala sobre el soporte (×2)', 'F.2.10.4.3 (J4-5), Ubs = 1.0', V, bkS.phiRn, 'kN', `por angular Agv = ${r1(bkS.agv)}, Anv = ${r1(bkS.anv)}, Ant = ${r1(bkS.ant)} mm²`); }
  // Viga
  if(des === 'no') add('viga', 'Cortante del alma de la viga', 'F.2.7.2 (G2-1), φv = 1.0', V, 1.0 * 0.6 * av_.Fy * vg.d * vg.tw / 1000, 'kN', '0.6·Fy·d·tw (viga sin destaje)');
  else {
    const tw = vg.tw;
    add('viga', 'Alma con destaje: fluencia por cortante', 'F.2.10.4.2 (J4-3)', V, 1.0 * 0.6 * av_.Fy * ho * tw / 1000, 'kN', `0.6·Fy·ho·tw, ho = ${r1(ho)} mm`);
    add('viga', 'Alma con destaje: rotura por cortante', 'F.2.10.4.2 (J4-4)', V, 0.75 * 0.6 * av_.Fu * (ho - n * dn) * tw / 1000, 'kN', `Anv = (ho − n·${r1(dn)})·tw = ${r1((ho - n * dn) * tw)} mm²`);
    const agv = (LevB + (n - 1) * s) * tw, anv = agv - (n - 0.5) * dn * tw, ant = (LehV - 0.5 * dn) * tw;
    add('viga', 'Alma con destaje: bloque de cortante', 'F.2.10.4.3 (J4-5), Ubs = 1.0 · Manual AISC parte 9', V, bloqueRn(av_.Fy, av_.Fu, agv, anv, ant), 'kN', `Agv = ${r1(agv)}, Anv = ${r1(anv)}, Ant = ${r1(ant)} mm² (hacia el destaje y el extremo de la viga)`);
    // Sección en la cara del destaje: T (ala inferior + alma) si se corta arriba; rectángulo si se cortan las dos alas
    const tf = vg.tf, bf = vg.bf, hw = des === 'sup' ? ho - tf : ho;
    const partes = des === 'sup' ? [{ b:bf, h:tf, y:tf / 2 }, { b:tw, h:hw, y:tf + hw / 2 }] : [{ b:tw, h:ho, y:ho / 2 }];
    const A = partes.reduce((a, q) => a + q.b * q.h, 0), yc = partes.reduce((a, q) => a + q.b * q.h * q.y, 0) / A;
    const I = partes.reduce((a, q) => a + q.b * q.h ** 3 / 12 + q.b * q.h * (q.y - yc) ** 2, 0), Snet = I / Math.max(yc, ho - yc);
    // eje plástico: la mitad del área a cada lado
    let yp; if(des === 'sup'){ yp = bf * tf >= A / 2 ? A / 2 / bf : tf + (A / 2 - bf * tf) / tw; } else yp = ho / 2;
    const Znet = partes.reduce((a, q) => { const y0 = q.y - q.h / 2, y1 = q.y + q.h / 2;
      const ab = Math.max(0, Math.min(y1, yp) - y0), ar = Math.max(0, y1 - Math.max(y0, yp));
      return a + q.b * ab * (yp - (y0 + ab / 2)) + q.b * ar * ((Math.max(y0, yp) + ar / 2) - yp); }, 0);
    const e = cD + hol, Mu = V * e / 1000;
    let Fcr, txt;
    if(des === 'sup'){
      const f = cD / vg.d <= 1 ? 2 * cD / vg.d : 1 + cD / vg.d, k = cD / ho <= 1 ? 2.2 * Math.pow(ho / Math.max(cD, 1), 1.65) : 2.2 * ho / cD;
      const Fe = 180700 * (tw / ho) ** 2 * f * k; Fcr = Math.min(av_.Fy, Fe);
      txt = `ala superior: f = ${r3(f)}, k = ${r3(k)}, Fcr = 26 210 ksi·(tw/ho)²·f·k = ${r1(Fe)} ≤ Fy → ${r1(Fcr)} MPa (Manual AISC 9-6)`;
    } else {
      const Fyk = av_.Fy / 6.89476, lam = ho * Math.sqrt(Fyk) / (10 * tw * Math.sqrt(475 + 280 * (ho / Math.max(cD, 1)) ** 2));
      const Q = lam <= 0.7 ? 1 : lam <= 1.41 ? 1.34 - 0.486 * lam : 1.30 / (lam * lam); Fcr = av_.Fy * Q;
      txt = `dos alas: λ = ${r3(lam)}, Q = ${r3(Q)}, Fcr = Fy·Q = ${r1(Fcr)} MPa (Manual AISC 9-14 a 9-16)`;
    }
    pasos.push(`Sección en la cara del destaje: A = ${r1(A)} mm², ȳ = ${r1(yc)} mm, I = ${Math.round(I)} mm⁴, Snet = ${Math.round(Snet)} mm³, Znet = ${Math.round(Znet)} mm³; e = c + holgura = ${r1(e)} mm → Mu = Vu·e = ${r3(Mu)} kN·m`);
    add('viga', 'Alma con destaje: fluencia por flexión y pandeo local', 'Manual AISC parte 9 (9-6 / 9-14) · φb = 0.90', Mu, 0.9 * Fcr * Snet / 1e6, 'kN·m', txt);
    add('viga', 'Alma con destaje: rotura por flexión', 'Manual AISC (9-4) · φ = 0.75', Mu, 0.75 * av_.Fu * Znet / 1e6, 'kN·m', `0.75·Fu·Znet`);
    av.push('Viga con destaje: el borde cortado debe quedar con esquinas redondeadas (radio ≥ 13 mm, F.2.10 / J1.6) y sin muescas.');
  }
  req.filter(r => !r[1]).forEach(r => av.push(`${r[0]}: ${r[2]}`));
  const max = ch.reduce((m, x) => Math.max(m, x.ratio), 0);
  return { ok:max <= 1 && !req.some(r => !r[1]), max, ch, req, av, pasos, geo:{ vg, L, dh, gage:2 * g2 + vg.tw, yb, ho, dct, dcb, cD, sold, des } };
}

// ═════════ Tipos agregados el 10-nov (pedido de Amo: «creamos todas y después las revisamos») ═════════
const addF = ch => (grupo, nombre, ref, dem, cap, ud, extra) => ch.push({ grupo, nombre, ref, dem, cap, ud, ratio: cap > 0 ? dem / cap : (dem > 0 ? Infinity : 0), extra });
const fin = (ch, req, av, pasos, geo) => { req.filter(r => !r[1]).forEach(r => av.push(`${r[0]}: ${r[2]}`));
  const max = ch.reduce((m, x) => Math.max(m, x.ratio), 0); return { ok:max <= 1 && !req.some(r => !r[1]), max, ch, req, av, pasos, geo }; };
const fv = (c, d) => 0.75 * PERNOS[c.grado][c.rosca === 'X' ? 'X' : 'N'] * Math.PI * d * d / 4 / 1000;     // φrn corte simple [kN]
const fw = (FEXX, w) => 0.75 * 0.6 * FEXX * 0.707 * w / 1000;                                                  // kN/mm de filete
const bloqueRn = (Fy, Fu, agv, anv, ant) => 0.75 * Math.min(0.6 * Fu * anv + Fu * ant, 0.6 * Fy * agv + Fu * ant) / 1000;
// Pandeo por flexión E3 (φc = 0.9) de una sección con KL/r
function fcrE3(Fy, KLr){ if(KLr <= 25) return Fy; const Fe = Math.PI ** 2 * 200000 / (KLr * KLr); return KLr <= 4.71 * Math.sqrt(200000 / Fy) ? Math.pow(0.658, Fy / Fe) * Fy : 0.877 * Fe; }
const perfilX = nom => { const P = (G.PERFILES_LAM || []).find(x => x[0] === nom); return P ? { ...perfil(nom), A:P[7], Ix:P[8], Sx:P[9], Zx:P[10] } : null; };

// ── Chapa de testa a cortante (articulada): placa soldada al alma, 2 columnas de pernos ─────────────
function defaultsTestaV(){
  return { tipo:'testaV', nom:'', desc:'', Vu:80, viga:'IPE 300', aceroViga:'A572 Gr 50',
    tSop:10.7, aceroSop:'A572 Gr 50', dosLados:false, tp:9.5, bp:150, aceroPl:'A36', n:3, s:75, Lev:38, g:90,
    d:19.1, grado:'A325', rosca:'N', w:5, electrodo:'E70XX' };
}
function calcTestaV(c){
  const ch = [], av = [], pasos = [], req = [], add = addF(ch);
  const V = Math.abs(+c.Vu || 0), d = +c.d, n = Math.max(1, Math.round(+c.n)), s = +c.s, Lev = +c.Lev, tp = +c.tp, bp = +c.bp, g = +c.g, w = +c.w;
  const vg = perfil(c.viga); if(!vg) return { error:'Escoja el perfil de la viga.' };
  const pl = ACEROS[c.aceroPl], ac = ACEROS[c.aceroViga], sp = ACEROS[c.aceroSop], FEXX = ELECTRODOS[c.electrodo];
  const dh = agujero(d), dn = anchoNeto(d), bm = bordeMin(d), Lp = (n - 1) * s + 2 * Lev, Leh = (bp - g) / 2;
  pasos.push(`Placa ${bp} × ${r1(Lp)} × ${tp} mm (${c.aceroPl}); ${2 * n} pernos en 2 columnas, gramil g = ${g} mm; Vu = ${r2(V)} kN`);
  req.push(['Alto de la placa T/2 ≤ Lp ≤ T', Lp >= vg.T / 2 - 1e-6 && Lp <= vg.T + 1e-6, `${r1(vg.T / 2)} ≤ ${r1(Lp)} ≤ ${r1(vg.T)} mm`]);
  req.push(['Separación s ≥ 2.67d', s >= 2.67 * d - 1e-6, `${s} ≥ ${r1(2.67 * d)} mm`]);
  req.push(['Bordes Lev y (bp − g)/2 ≥ mín.', Math.min(Lev, Leh) >= bm, `${Math.min(Lev, r1(Leh))} ≥ ${bm} mm`]);
  req.push(['Placa flexible: tp ≤ 10 mm (Manual AISC parte 10)', tp <= 10, `${tp} mm`]);
  req.push(['Gramil g ≥ tw + 2·(d + 12.7) (espacio para apretar)', g >= vg.tw + 2 * (d + 12.7) - 1e-6, `${g} ≥ ${r1(vg.tw + 2 * (d + 12.7))} mm`]);
  const rv = fv(c, d), bE = aplast(Lev - dh / 2, tp, d, pl.Fu).phiRn, bI = aplast(s - dh, tp, d, pl.Fu).phiRn, bS = 0.75 * 2.4 * d * +c.tSop * sp.Fu / 1000 / (c.dosLados ? 2 : 1);
  const cap = 2 * (Math.min(rv, bE, bS) + (n - 1) * Math.min(rv, bI, bS));
  add('pernos', `Pernos (${2 * n}, cortante simple)`, 'F.2.10.3.6 y F.2.10.3.10 (J3-1, J3-6)', V, cap, 'kN', `corte ${r2(rv)}, aplast. placa borde ${r2(bE)} / interior ${r2(bI)}, soporte ${r2(bS)} kN`);
  add('chapa', 'Fluencia por cortante de la placa (2 planos)', 'F.2.10.4.2 (J4-3)', V, 0.6 * pl.Fy * 2 * Lp * tp / 1000, 'kN', `Agv = 2·Lp·tp = ${r1(2 * Lp * tp)} mm²`);
  add('chapa', 'Rotura por cortante de la placa (2 planos)', 'F.2.10.4.2 (J4-4)', V, 0.75 * 0.6 * pl.Fu * 2 * (Lp - n * dn) * tp / 1000, 'kN', `Anv = ${r1(2 * (Lp - n * dn) * tp)} mm²`);
  const agv = (Lp - Lev) * tp, anv = (Lp - Lev - (n - 0.5) * dn) * tp, ant = (Leh - dn / 2) * tp;
  add('chapa', 'Bloque de cortante (×2)', 'F.2.10.4.3 (J4-5), Ubs = 1.0', V, 2 * bloqueRn(pl.Fy, pl.Fu, agv, anv, ant), 'kN', `Agv ${r1(agv)}, Anv ${r1(anv)}, Ant ${r1(ant)} mm²`);
  const Lw = Lp - 2 * w;
  add('soldadura', 'Filetes alma–placa (ambas caras)', 'F.2.10.2.4 (J2-4)', V, 2 * fw(FEXX, w) * Lw, 'kN', `w = ${w} mm, L = Lp − 2w = ${r1(Lw)} mm`);
  add('viga', 'Fluencia por cortante del alma junto a la soldadura', 'F.2.10.4.2 (J4-3), φ = 1.0', V, 0.6 * ac.Fy * vg.tw * Lp / 1000, 'kN', `0.6·Fy·tw·Lp`);
  // Rotura del alma a lo largo de los dos filetes (metal base, J4-4): controla cuando 2 filetes cargan un alma delgada
  add('viga', 'Rotura por cortante del alma junto a los filetes', 'F.2.10.2.4 (J2-2) · F.2.10.4.2 (J4-4), φ = 0.75', V, 0.75 * 0.6 * ac.Fu * vg.tw * Lw / 1000, 'kN', `0.75·0.6·Fu·tw·L, L = ${r1(Lw)} mm`);
  const tmin = Math.min(tp, vg.tw), wmin = tmin <= 6 ? 3 : tmin <= 13 ? 5 : tmin <= 19 ? 6 : 8;
  req.push(['Filete ≥ mín. Tabla J2.4 (parte más delgada)', w >= wmin, `${w} ≥ ${wmin} mm`]);
  return fin(ch, req, av, pasos, { vg, Lp, dh });
}

// ── Asiento con angular sin rigidizar (seated) — Manual AISC parte 10 ─────────────
function defaultsAsiento(){
  return { tipo:'asiento', nom:'', desc:'', Vu:60, viga:'IPE 300', aceroViga:'A572 Gr 50', holgura:13,
    tSop:10.7, aceroSop:'A572 Gr 50', bv:152, bh:102, t:12.7, La:150, aceroAng:'A36', filas:1, g:90, ev:64,
    d:19.1, grado:'A325', rosca:'N',
    unSop:'pernos', wS:8, electrodo:'E70XX',                                   // unión al soporte (pedido de Amo 19-nov)
    rig:false, ts:12.7, W:102, hs:152, aceroRig:'A36', wR:6 };                  // platina triangular de rigidez (pie de amigo)
}
// Asiento sin rigidizar o rigidizado con una platina triangular — Manual AISC parte 10 (seated / stiffened seated)
function calcAsiento(c, sinSug){
  const ch = [], av = [], pasos = [], req = [], add = addF(ch);
  const V = Math.abs(+c.Vu || 0), d = +c.d, t = +c.t, La = +c.La, bh = +c.bh, bv = +c.bv, hol = +c.holgura || 0, nf = Math.max(1, Math.round(+c.filas)), g = +c.g;
  const vg = perfil(c.viga); if(!vg) return { error:'Escoja el perfil de la viga.' };
  const an = ACEROS[c.aceroAng], ac = ACEROS[c.aceroViga], sp = ACEROS[c.aceroSop], FEXX = ELECTRODOS[c.electrodo] || 483;
  const sold = c.unSop === 'sold', rig = !!c.rig, ts = +c.ts || 0, W = rig ? (+c.W || bh) : bh, hs = +c.hs || bv, rg = ACEROS[c.aceroRig] || an, clip = 20;
  const kv = vg.tf + vg.r, N = W - hol, E = 200000;
  pasos.push(`Viga ${vg.nom}: d ${vg.d}, tw ${vg.tw}, tf ${vg.tf}, k = tf + r = ${r1(kv)} mm; longitud de apoyo N = ${rig ? 'W' : 'bh'} − holgura = ${r1(N)} mm`);
  if(rig) pasos.push(`Asiento rigidizado: platina triangular ${ts} mm (${c.aceroRig}), ancho W = ${W} mm y alto ${hs} mm, soldada bajo el ala horizontal${sold ? ' y al soporte' : ' y al ala vertical del angular'}`);
  const Ry = 1.0 * ac.Fy * vg.tw * (2.5 * kv + N) / 1000;
  add('viga', 'Fluencia local del alma (extremo de la viga)', 'F.2.10.10.2 (J10-3)', V, Ry, 'kN', `Fy·tw·(2.5k + N)`);
  const rN = N / vg.d, q = (vg.tw / vg.tf) ** 1.5, cr = rN <= 0.2 ? 0.4 * vg.tw ** 2 * (1 + 3 * rN * q) : 0.4 * vg.tw ** 2 * (1 + (4 * rN - 0.2) * q);
  add('viga', 'Aplastamiento del alma (extremo de la viga)', `F.2.10.10.3 (J10-5${rN <= 0.2 ? 'a' : 'b'})`, V, 0.75 * cr * Math.sqrt(E * ac.Fy * vg.tf / vg.tw) / 1000, 'kN', `N/d = ${r3(rN)}`);
  // Apoyo requerido: el mayor entre fluencia local (J10-3) y aplastamiento del alma (J10-5), y al menos k (Manual AISC parte 10)
  const Ny = V * 1000 / (ac.Fy * vg.tw) - 2.5 * kv, R0 = 0.75 * 0.4 * vg.tw ** 2 * Math.sqrt(E * ac.Fy * vg.tf / vg.tw) / 1000;
  let Nc = vg.d / (3 * q) * (V / R0 - 1); if(Nc > 0.2 * vg.d) Nc = vg.d / 4 * ((V / R0 - 1) / q + 0.2);
  const Nreq = Math.max(Ny, Nc, kv);
  pasos.push(`Apoyo requerido por fluencia local ${r1(Math.max(Ny, 0))} mm, por aplastamiento del alma ${r1(Math.max(Nc, 0))} mm, mínimo k = ${r1(kv)} mm`);
  req.push(['Longitud de apoyo N ≥ Nreq', N >= Nreq - 1e-6, `${r1(N)} ≥ ${r1(Nreq)} mm`]);
  const ka = t + 9.5, ef = Math.max(0, hol + Nreq / 2 - ka), Mu = V * ef / 1000;
  const eS = rig ? 0.8 * W : hol + Nreq / 2;                       // excentricidad de la carga respecto a la cara del soporte
  const fwl = w => 0.75 * 0.6 * FEXX * 0.707 * w / 1000;           // kN/mm
  const wMin = tt => tt <= 6 ? 3 : tt <= 13 ? 5 : tt <= 19 ? 6 : 8;
  if(!rig){
    pasos.push(`Apoyo requerido Nreq = el mayor de los anteriores = ${r1(Nreq)} mm; excentricidad a la sección crítica del angular ef = holgura + Nreq/2 − (t + 9.5) = ${r1(ef)} mm; Mu = ${r3(Mu)} kN·m`);
    add('angular', 'Flexión del ala horizontal del asiento', 'Manual AISC parte 10 · φb = 0.90', Mu, 0.9 * an.Fy * La * t * t / 4 / 1e6, 'kN·m', `φMn = 0.9·Fy·La·t²/4, La = ${La} mm`);
    add('angular', 'Cortante del ala horizontal', 'F.2.10.4.2 (J4-3)', V, 0.6 * an.Fy * La * t / 1000, 'kN', '0.6·Fy·La·t');
  } else {
    // Platina de rigidez (Manual AISC parte 10, asiento rigidizado): aplastamiento en el borde superior, esbeltez y espesor
    const Apb = ts * (W - clip);
    add('rigidizador', 'Aplastamiento del borde superior de la platina', 'F.2.10.7 (J7-1) · φ = 0.75', V, 0.75 * 1.8 * rg.Fy * Apb / 1000, 'kN', `1.8·Fy·Apb, Apb = ts·(W − ${clip} de chaflán) = ${r1(Apb)} mm²`);
    req.push(['Esbeltez de la platina W/ts ≤ 0.56·√(E/Fy)', W / ts <= 0.56 * Math.sqrt(E / rg.Fy) + 1e-6, `${r1(W / ts)} ≤ ${r1(0.56 * Math.sqrt(E / rg.Fy))}`]);
    req.push(['Espesor de la platina ts ≥ tw·Fy,viga/Fy,platina', ts >= vg.tw * ac.Fy / rg.Fy - 1e-6, `${ts} ≥ ${r1(vg.tw * ac.Fy / rg.Fy)} mm`]);
    req.push(['Alto de la platina ≥ ancho (pie de amigo con ángulo ≥ 45°)', hs >= W - 1e-6, `${hs} ≥ ${W} mm`]);
    // Platina en flexión y cortante en la cara del soporte (sección ts × hs) con la carga a 0.8W
    const Mr = V * eS / 1000, Sr = ts * hs * hs / 6, fb = Mr * 1e6 / Sr, fvR = V * 1000 / (ts * hs);
    add('rigidizador', 'Platina en la cara del soporte: flexión + cortante', 'F.2.10.4 · φ = 0.90 / 1.0', Math.hypot(fb / (0.9 * rg.Fy), fvR / (0.6 * rg.Fy)), 1, '', `M = Vu·0.8W = ${r3(Mr)} kN·m, fb = ${r1(fb)} MPa, fv = ${r1(fvR)} MPa (combinados √(a² + b²))`);
    // Soldadura platina–ala horizontal (dos filetes)
    const wR = +c.wR || 0;
    add('soldadura', 'Filetes platina–ala horizontal (2)', 'F.2.10.2.4 (J2-4)', V, 2 * fwl(wR) * (W - clip), 'kN', `w = ${wR} mm, L = W − ${clip} = ${W - clip} mm por cara`);
    // Soldadura de la platina a la cara vertical (soporte o ala vertical del angular): Manual AISC parte 10, e = 0.8W
    const fr = V / (2 * hs * hs) * Math.sqrt(hs * hs + 20.25 * eS * eS);
    add('soldadura', `Filetes de la platina ${sold ? 'al soporte' : 'al ala vertical del angular'} (2, con retorno 0.2L)`, 'F.2.10.2.4 · Manual AISC parte 10 (asiento rigidizado)', fr, fwl(wR), 'kN/mm', `f = Vu/(2L²)·√(L² + 20.25·e²), L = ${hs} mm, e = 0.8W = ${r1(eS)} mm`);
    add('rigidizador', 'Metal base de la platina junto a los filetes', 'F.2.10.2.4 (J2-2) · J4-4', 2 * fr, 0.75 * 0.6 * rg.Fu * ts / 1000, 'kN/mm', 'los dos filetes cargan el mismo espesor');
    req.push(['Filete de la platina ≥ mín. Tabla J2.4', wR >= wMin(Math.min(ts, sold ? +c.tSop : t)), `${wR} ≥ ${wMin(Math.min(ts, sold ? +c.tSop : t))} mm`]);
  }
  if(!sold){
    // Pernos al soporte. Sin rigidizador: cortante simple (Manual AISC). Con rigidizador: cortante + tensión por el momento Vu·e (método elástico)
    const nb = 2 * nf, rv = fv(c, d), dh = agujero(d), bA = 0.75 * 2.4 * d * t * an.Fu / 1000, bS = 0.75 * 2.4 * d * +c.tSop * sp.Fu / 1000, rC = Math.min(rv, bA, bS);
    if(!rig) add('pernos', `Pernos al soporte (${nb}, cortante simple)`, 'F.2.10.3.6 y F.2.10.3.10', V, nb * rC, 'kN', `corte ${r2(rv)}, aplast. angular ${r2(bA)} (hacia el talón, sin borde libre), soporte ${r2(bS)} kN`);
    else {
      const pts = []; for(const sg of [-1, 1]) for(let i = 0; i < nf; i++) pts.push({ u:sg * g / 2, v:-i * 70 });
      const b = pernos3D(pts, { Fu:0, Fv:V, Mn:0, N:0, Mu:V * eS / 1000, Mv:0 }, { d, grado:c.grado, rosca:c.rosca, rCorte:rC });
      add('pernos', `Pernos al soporte (${nb}): cortante y tensión por Vu·e (J3-3a)`, 'F.2.10.3.7 · método elástico', b.rat, 1, '', `e = 0.8W = ${r1(eS)} mm; cortante ${r2(b.r)} kN (φrn ${r2(rC)}), tensión ${r2(b.t)} kN (φRn ${r2(b.capT)})${b.nota || ''}`);
      if(nf < 2) req.push(['Con rigidizador atornillado: al menos 2 filas de pernos (para tomar el momento)', false, `${nf} fila`]);
      av.push('Asiento rigidizado atornillado: el ala vertical del angular trabaja con efecto palanca bajo la tensión de los pernos; revise su espesor o use una T o un angular grueso.');
    }
    req.push(['Gramil g cabe en el ancho: (La − g)/2 ≥ borde mín.', (La - g) / 2 >= bordeMin(d), `${r1((La - g) / 2)} ≥ ${bordeMin(d)} mm`]);
    const abajo = bv - +c.ev - (nf - 1) * 70;
    req.push(['Las filas caben en el ala vertical: bv − ev − (filas − 1)·70 ≥ borde mín.', abajo >= bordeMin(d) - 1e-6, `${r1(abajo)} ≥ ${bordeMin(d)} mm`]);
    if(rig) req.push(['Platina de rigidez dentro del ala vertical del angular (hs ≤ bv)', hs <= bv + 1e-6, `${hs} ≤ ${bv} mm`]);
  } else if(!rig){
    // Asiento soldado sin rigidizar: dos filetes verticales en los bordes del ala vertical (Manual AISC parte 10), retorno 2w arriba
    const w = +c.wS || 0, L = bv, fr = V / (2 * L * L) * Math.sqrt(L * L + 20.25 * eS * eS);
    pasos.push(`Asiento soldado: filetes de ${w} mm en los dos bordes verticales del angular (L = bv = ${L} mm), e = holgura + Nreq/2 = ${r1(eS)} mm`);
    add('soldadura', 'Filetes del angular al soporte (2, con la excentricidad)', 'F.2.10.2.4 · Manual AISC parte 10 (asiento soldado)', fr, fwl(w), 'kN/mm', `f = Vu/(2L²)·√(L² + 20.25·e²), L = ${L} mm, e = ${r1(eS)} mm`);
    add('angular', 'Metal base del angular junto al filete', 'F.2.10.2.4 (J2-2) · J4-4', fr, 0.75 * 0.6 * an.Fu * t / 1000, 'kN/mm', '0.75·0.6·Fu·t');
    add('soporte', 'Metal base del soporte junto al filete', 'F.2.10.2.4 (J2-2) · J4-4', fr, 0.75 * 0.6 * sp.Fu * +c.tSop / 1000, 'kN/mm', '0.75·0.6·Fu·t');
    req.push(['Filete mínimo Tabla J2.4 (parte más delgada)', w >= wMin(Math.min(t, +c.tSop)), `${w} ≥ ${wMin(Math.min(t, +c.tSop))} mm`]);
    req.push(['Filete máximo en el borde del angular (t − 1.6 mm)', w <= (t < 6 ? t : t - 1.6) + 1e-6, `${w} ≤ ${r1(t < 6 ? t : t - 1.6)} mm`]);
    req.push(['Retorno del filete en la parte superior = 2w', true, `${r1(2 * w)} mm (indicar en planos)`]);
  } else pasos.push('Asiento rigidizado soldado: la platina y el ala horizontal se sueldan directamente al soporte.');
  req.push(['Longitud de apoyo N ≥ k de la viga', N >= kv, `${r1(N)} ≥ ${r1(kv)} mm`]);
  if(La < vg.bf) av.push(`Recomendación: el largo del asiento (${La} mm) suele igualar o pasar el ancho del ala de la viga (${vg.bf} mm); el Manual AISC no lo exige.`);
  req.push(['Angular superior o lateral para estabilidad (Manual AISC)', true, 'indicar en planos']);
  const R = fin(ch, req, av, pasos, { vg, N, dh:agujero(d), ka, rig, sold, W, hs, ts, eS });
  // Si el angular sin rigidizar no resiste, se prueba con una platina triangular (pedido de Amo 19-nov)
  if(!rig && !sinSug){ const fl = ch.filter(x => x.grupo === 'angular' && x.ratio > 1);
    if(fl.length){
      // se prueban espesores, altos y filetes; gana la platina más liviana que cumple (si ninguna cumple, la de menor relación)
      let best = null;
      // soldado: la platina va al soporte (alto libre); atornillado: la platina va dentro del ala vertical, que puede alargarse (L de 152, 203 o 254 mm) con 2 a 4 filas
      const opc = sold ? [{ bvR:bv, filas:nf }] : [bv, 152, 203, 254].filter((x, i, A) => x >= bv && A.indexOf(x) === i).flatMap(bvR => [2, 3, 4].filter(f => bvR - +c.ev - (f - 1) * 70 >= bordeMin(d)).map(f => ({ bvR, filas:f })));
      // el ancho W de la platina = ala horizontal del asiento; se prueba también un ala más ancha (más apoyo para la viga)
      const Ws = [bh, 127, 152, 178, 203].filter((x, i, A) => x >= bh && A.indexOf(x) === i);
      for(const o of opc) for(const WR of Ws) for(const tsR of [9.5, 12.7, 15.9, 19.1, 22.2, 25.4]) for(let k = 1; k <= 3.01; k += 0.25) for(const wR of [6, 8, 10, 12]){
        const hsR = Math.round(WR * k); if(!sold && hsR > o.bvR) continue;
        const Rp = calcAsiento({ ...c, rig:true, ts:tsR, W:WR, bh:WR, hs:hsR, aceroRig:c.aceroAng, wR, filas:o.filas, bv:o.bvR }, true);
        if(Rp.error) continue; const peso = tsR * WR * hsR / 2 + ((o.bvR - bv) + (WR - bh)) * La * t + (o.filas - nf) * 5000, cand = { ts:tsR, W:WR, bh:WR, hs:hsR, wR, filas:o.filas, bv:o.bvR, max:Rp.max, ok:Rp.ok, peso };
        if(!best || (cand.ok && (!best.ok || cand.peso < best.peso - 1e-6 || (Math.abs(cand.peso - best.peso) < 1e-6 && cand.wR < best.wR))) || (!cand.ok && !best.ok && cand.max < best.max)) best = cand; }
      R.sug = best;
      const txt = best ? `platina triangular de ${best.ts} mm, ancho ${best.W} mm y alto ${best.hs} mm, filetes de ${best.wR} mm${best.bh > bh ? `, ala horizontal del asiento de ${best.bh} mm` : ''}${!sold && best.bv > bv ? `, angular con ala vertical de ${best.bv} mm` : ''}${!sold && best.filas !== nf ? `, ${best.filas} filas de pernos` : ''}` : '';
      R.av.push(`El angular solo no resiste (${fl.map(x => `${x.nombre.toLowerCase()} ${r2(x.ratio)}`).join(', ')}). ` + (best && best.ok
        ? `Con un pie de amigo (${txt}) la conexión CUMPLE con relación máxima ${r2(best.max)}. Toque «Aplicar platina de rigidez».`
        : `Ni con un pie de amigo de hasta 25.4 mm cumple (la mejor: ${txt}, relación ${r2(best ? best.max : NaN)}); revise la viga, los pernos o use un asiento más grande.`)); } }
  return R;
}

// ── Empalme de viga atornillado: cubrejuntas en las alas y el alma ─────────────
function defaultsEmpalme(){
  return { tipo:'empalme', nom:'', desc:'', Mu:80, Vu:60, viga:'IPE 300', aceroViga:'A572 Gr 50', gap:10,
    tpf:12.7, bpf:150, aceroPl:'A36', nf:3, sf:75, gf:90, Lef:38,
    tpw:8, hpw:210, nw:3, sw:65, Lew:38, Lehw:40,
    d:19.1, grado:'A325', rosca:'N' };
}
function calcEmpalme(c){
  const ch = [], av = [], pasos = [], req = [], add = addF(ch);
  const Mu = Math.abs(+c.Mu || 0), V = Math.abs(+c.Vu || 0), d = +c.d, gap = +c.gap || 0;
  const vg = perfilX(c.viga); if(!vg) return { error:'Escoja el perfil de la viga.' };
  const pl = ACEROS[c.aceroPl], ac = ACEROS[c.aceroViga];
  const dh = agujero(d), dn = anchoNeto(d), bm = bordeMin(d), rv = fv(c, d);
  // Alas
  const tpf = +c.tpf, bpf = +c.bpf, nf = Math.max(1, Math.round(+c.nf)), sf = +c.sf, gf = +c.gf, Lef = +c.Lef, nbF = 2 * nf;      // 2 columnas por lado
  const Ff = Mu * 1000 / (vg.d + tpf);
  pasos.push(`Fuerza en cada ala Ff = Mu/(d + tpf) = ${r2(Ff)} kN (el alma solo toma el cortante, del lado seguro)`);
  const bPlE = aplast(Lef - dh / 2, tpf, d, pl.Fu).phiRn, bPlI = aplast(sf - dh, tpf, d, pl.Fu).phiRn;
  const bFlE = aplast(Lef - dh / 2, vg.tf, d, ac.Fu).phiRn, bFlI = aplast(sf - dh, vg.tf, d, ac.Fu).phiRn;
  const capF = 2 * (Math.min(rv, bPlE, bFlE) + (nf - 1) * Math.min(rv, bPlI, bFlI));
  add('pernos', `Pernos de un ala, a cada lado (${nbF}, cortante simple)`, 'F.2.10.3.6 y F.2.10.3.10', Ff, capF, 'kN', `corte ${r2(rv)} kN; aplast. cubrejunta ${r2(bPlE)}/${r2(bPlI)}, ala ${r2(bFlE)}/${r2(bFlI)} kN`);
  const Ag = bpf * tpf, An = Math.min((bpf - 2 * dn) * tpf, 0.85 * Ag);
  add('alas', 'Cubrejunta del ala: fluencia a tensión', 'F.2.10.4.1 (J4-1)', Ff, 0.9 * pl.Fy * Ag / 1000, 'kN', `Ag = ${r1(Ag)} mm²`);
  add('alas', 'Cubrejunta del ala: rotura a tensión', 'F.2.10.4.1 (J4-2), An ≤ 0.85Ag', Ff, 0.75 * pl.Fu * An / 1000, 'kN', `An = ${r1(An)} mm²`);
  const KLr = 0.65 * (gap + 2 * Lef) / (tpf / Math.sqrt(12));
  add('alas', 'Cubrejunta del ala: compresión', 'F.2.10.4.4 (J4-6) / E3', Ff, 0.9 * fcrE3(pl.Fy, KLr) * Ag / 1000, 'kN', `KL/r = 0.65·(gap + 2Lef)/r = ${r1(KLr)}`);
  const agvP = 2 * (Lef + (nf - 1) * sf) * tpf, anvP = agvP - 2 * (nf - 0.5) * dn * tpf, antP = (gf - dn) * tpf;
  add('alas', 'Cubrejunta del ala: bloque de cortante', 'F.2.10.4.3 (J4-5)', Ff, bloqueRn(pl.Fy, pl.Fu, agvP, anvP, antP), 'kN', `bloque entre las dos líneas de pernos`);
  const antP2 = 2 * ((bpf - gf) / 2 - dn / 2) * tpf;
  add('alas', 'Cubrejunta del ala: bloque por los bordes', 'F.2.10.4.3 (J4-5)', Ff, bloqueRn(pl.Fy, pl.Fu, agvP, anvP, antP2), 'kN', `tensión hacia los bordes exteriores`);
  const agvF = 2 * (Lef + (nf - 1) * sf) * vg.tf, anvF = agvF - 2 * (nf - 0.5) * dn * vg.tf, antF = 2 * ((vg.bf - gf) / 2 - dn / 2) * vg.tf;
  add('alas', 'Ala de la viga: bloque de cortante', 'F.2.10.4.3 (J4-5)', Ff, bloqueRn(ac.Fy, ac.Fu, agvF, anvF, antF), 'kN', `hacia los bordes del ala`);
  const Afg = vg.bf * vg.tf, Afn = (vg.bf - 2 * dn) * vg.tf, Yt = ac.Fy / ac.Fu <= 0.8 ? 1.0 : 1.1;
  if(ac.Fu * Afn < Yt * ac.Fy * Afg){ const Mn = ac.Fu * Afn / Afg * vg.Sx / 1e6;
    add('viga', 'Viga: rotura del ala en tensión por los agujeros', 'F.2.6.13.1 (F13-1)', Mu, 0.9 * Mn, 'kN·m', `Fu·Afn < Yt·Fy·Afg → Mn = Fu·Afn/Afg·Sx`); }
  else pasos.push(`Ala en tensión: Fu·Afn = ${r1(ac.Fu * Afn / 1000)} ≥ Yt·Fy·Afg = ${r1(Yt * ac.Fy * Afg / 1000)} kN → no reduce la resistencia (F13.1)`);
  // Alma
  const tpw = +c.tpw, hpw = +c.hpw, nw = Math.max(1, Math.round(+c.nw)), sw = +c.sw, Lew = +c.Lew, Lehw = +c.Lehw;
  const ew = gap / 2 + Lehw;                                 // excentricidad del cortante a la línea de pernos
  const pts = Array.from({ length:nw }, (_, i) => ({ x:0, y:i * sw })), ic = icr(pts, ew, 0);
  const bWp = aplast(Lew - dh / 2, tpw, d, pl.Fu).phiRn, bWb = 0.75 * 2.4 * d * vg.tw * ac.Fu / 1000;
  const rW = Math.min(2 * rv, 2 * bWp, bWb);
  pasos.push(`Alma: 2 cubrejuntas ${hpw} × ${tpw} mm; ${nw} pernos a cada lado (doble cortante) con e = gap/2 + Leh = ${r1(ew)} mm → C = ${r2(ic.C)}`);
  add('pernos', `Pernos del alma, a cada lado (${nw}, doble cortante, excéntricos)`, 'F.2.10.3 · Manual AISC parte 7', V, ic.C * rW, 'kN', `C = ${r2(ic.C)} · φrn = ${r2(rW)} kN`);
  add('almaPl', 'Cubrejuntas del alma: fluencia por cortante (2)', 'F.2.10.4.2 (J4-3)', V, 0.6 * pl.Fy * 2 * hpw * tpw / 1000, 'kN', '');
  add('almaPl', 'Cubrejuntas del alma: rotura por cortante (2)', 'F.2.10.4.2 (J4-4)', V, 0.75 * 0.6 * pl.Fu * 2 * (hpw - nw * dn) * tpw / 1000, 'kN', '');
  const Mw = V * ew / 1000, Zw = 2 * tpw * hpw * hpw / 4;
  add('almaPl', 'Cubrejuntas del alma: flexión por la excentricidad', 'F.2.6 · φb = 0.90', Mw, 0.9 * pl.Fy * Zw / 1e6, 'kN·m', `Mu = Vu·e = ${r3(Mw)} kN·m`);
  add('viga', 'Cortante del alma de la viga', 'F.2.7.2 (G2-1)', V, 0.6 * ac.Fy * vg.d * vg.tw / 1000, 'kN', '');
  req.push(['Cubrejunta del ala bpf ≤ bf de la viga', bpf <= vg.bf + 1e-6, `${bpf} ≤ ${vg.bf} mm`]);
  req.push(['Bordes de la cubrejunta del ala (bpf − gf)/2 y Lef ≥ mín.', Math.min((bpf - gf) / 2, Lef) >= bm, `${r1(Math.min((bpf - gf) / 2, Lef))} ≥ ${bm} mm`]);
  req.push(['Cubrejunta del alma cabe entre las alas: hpw ≤ T', hpw <= vg.T + 1e-6, `${hpw} ≤ ${r1(vg.T)} mm`]);
  req.push(['Pernos del alma caben: (nw − 1)·sw + 2·Lew ≤ hpw', (nw - 1) * sw + 2 * Lew <= hpw + 1e-6, `${(nw - 1) * sw + 2 * Lew} ≤ ${hpw} mm`]);
  req.push(['Separaciones ≥ 2.67d', Math.min(sf, sw) >= 2.67 * d - 1e-6, `${Math.min(sf, sw)} ≥ ${r1(2.67 * d)} mm`]);
  req.push(['Pernos pretensionados (empalme a momento)', true, 'indicar en planos']);
  return fin(ch, req, av, pasos, { vg, dh, Ff, ic });
}

// ── Diagonal de angular(es) atornillada a una cartela soldada ─────────────
function defaultsCartela(){
  return { tipo:'cartela', nom:'', desc:'', Pu:150, nL:2, bL:76, tL:6.4, aceroL:'A36', n:3, s:65, Le:38, ga:45,
    tg:9.5, aceroG:'A36', Lcr:150, K:0.65, theta:45, Lwg:250, w:6, electrodo:'E70XX', d:19.1, grado:'A325', rosca:'N' };
}
function calcCartela(c){
  const ch = [], av = [], pasos = [], req = [], add = addF(ch);
  const P = +c.Pu || 0, Pa = Math.abs(P), d = +c.d, n = Math.max(1, Math.round(+c.n)), s = +c.s, Le = +c.Le, b = +c.bL, t = +c.tL, nL = +c.nL === 1 ? 1 : 2, ga = +c.ga, tg = +c.tg;
  const aL = ACEROS[c.aceroL], ag = ACEROS[c.aceroG], FEXX = ELECTRODOS[c.electrodo];
  const dh = agujero(d), dn = anchoNeto(d), bm = bordeMin(d), rv = fv(c, d);
  const A1 = (2 * b - t) * t, Ag = nL * A1, xb = (b * t * t / 2 + (b - t) * t * (t + (b - t) / 2)) / A1;   // centroide medido desde la espalda
  pasos.push(`Diagonal ${nL === 2 ? '2L' : 'L'} ${b}×${b}×${t} mm (${c.aceroL}): Ag = ${r1(Ag)} mm², x̄ = ${r1(xb)} mm; Pu = ${r2(P)} kN (${P >= 0 ? 'tensión' : 'compresión'})`);
  // Pernos
  const bAE = aplast(Le - dh / 2, t, d, aL.Fu).phiRn, bAI = aplast(s - dh, t, d, aL.Fu).phiRn, bG = 0.75 * 2.4 * d * tg * ag.Fu / 1000;
  const rE = Math.min(nL * rv, nL * bAE, bG), rI = Math.min(nL * rv, nL * bAI, bG);
  add('pernos', `Pernos (${n}, ${nL === 2 ? 'doble' : 'simple'} cortante)`, 'F.2.10.3.6 y F.2.10.3.10', Pa, rE + (n - 1) * rI, 'kN', `por perno: borde ${r2(rE)}, interior ${r2(rI)} kN (cartela ${r2(bG)} kN)`);
  // Diagonal
  const l = (n - 1) * s, U = Math.max(l > 0 ? 1 - xb / l : 0, n >= 4 ? 0.8 : n === 3 ? 0.6 : 0), An = Ag - nL * dn * t, Ae = U * An;
  if(P > 0){
    add('diagonal', 'Fluencia a tensión de la diagonal', 'F.2.4.2 (D2-1)', P, 0.9 * aL.Fy * Ag / 1000, 'kN', '');
    add('diagonal', 'Rotura a tensión (con rezago de cortante U)', 'F.2.4.2 (D2-2), Tabla D3.1', P, 0.75 * aL.Fu * Ae / 1000, 'kN', `U = máx(1 − x̄/l; caso 8) = ${r3(U)}, Ae = ${r1(Ae)} mm²`);
  } else pasos.push('Compresión: el pandeo de la diagonal se revisa como elemento (Anexo D); aquí solo la conexión.');
  const agv = (Le + l) * t, anv = agv - (n - 0.5) * dn * t, ant = (b - ga - dn / 2) * t;
  add('diagonal', `Bloque de cortante en el angular (×${nL})`, 'F.2.10.4.3 (J4-5)', Pa, nL * bloqueRn(aL.Fy, aL.Fu, agv, anv, ant), 'kN', `Agv ${r1(agv)}, Anv ${r1(anv)}, Ant ${r1(ant)} mm²`);
  // Cartela: sección de Whitmore
  const Lw = 2 * l * Math.tan(Math.PI / 6) + (n > 1 ? 0 : dh), Aw = Lw * tg;
  pasos.push(`Cartela t = ${tg} mm: ancho de Whitmore Lw = 2·(n − 1)·s·tan30° = ${r1(Lw)} mm`);
  if(P > 0) add('cartela', 'Fluencia en la sección de Whitmore', 'F.2.10.4.1 (J4-1)', P, 0.9 * ag.Fy * Aw / 1000, 'kN', `Aw = ${r1(Aw)} mm²`);
  else { const KLr = +c.K * +c.Lcr / (tg / Math.sqrt(12));
    add('cartela', 'Pandeo de la cartela (sección de Whitmore)', 'F.2.10.4.4 (J4-6) / E3', Pa, 0.9 * fcrE3(ag.Fy, KLr) * Aw / 1000, 'kN', `KL/r = ${c.K}·${c.Lcr}/r = ${r1(KLr)}`); }
  // Soldadura cartela–soporte
  const th = (+c.theta || 0) * Math.PI / 180, Lwg = +c.Lwg, w = +c.w;
  add('soldadura', 'Filetes cartela–soporte (ambas caras)', 'F.2.10.2.4 (J2-4, J2-5)', Pa, 2 * fw(FEXX, w) * Lwg * (1 + 0.5 * Math.pow(Math.sin(th), 1.5)), 'kN', `L = ${Lwg} mm, θ = ${c.theta}° entre la fuerza y el cordón`);
  add('cartela', 'Cartela junto a la soldadura (cortante + tensión)', 'F.2.10.4 · F.2.10.2.4', Pa, Math.min(0.6 * ag.Fy * tg * Lwg / 1000 / Math.max(Math.cos(th), 0.01), 0.9 * ag.Fy * tg * Lwg / 1000 / Math.max(Math.sin(th), 0.01)), 'kN', 'componentes de la fuerza contra fluencia por cortante y por tensión');
  req.push(['Separación s ≥ 2.67d', s >= 2.67 * d - 1e-6, `${s} ≥ ${r1(2.67 * d)} mm`]);
  req.push(['Borde Le ≥ mín.', Le >= bm, `${Le} ≥ ${bm} mm`]);
  req.push(['Borde del angular b − ga ≥ mín.', b - ga >= bm, `${b - ga} ≥ ${bm} mm`]);
  req.push(['Filete ≥ mín. Tabla J2.4', w >= (tg > 19 ? 8 : tg > 12.7 ? 6 : tg > 6.4 ? 5 : 3), `${w} mm`]);
  return fin(ch, req, av, pasos, { dh, Lw, U, xb });
}

// ── Placa base a momento: usa el mismo cálculo del Anexo E del generador (calc/anexoE.js) ─────────────
function defaultsBase(){
  return { tipo:'base', nom:'', desc:'', P:150, Mx:20, My:0, Vx:15, Vy:0, columna:'HEB 200',
    N:400, B:350, tp:25.4, aceroPlaca:'A36', Lp:650, Wp:600, ha:1000, fc:21,
    perno:'3/4"', anclaje:'F1554 Gr 36', nB:2, S1:300, S2:250, hef:300, arandela:50, cabeza:'tuerca', fisurado:true, mortero:true, w:8, electrodo:'E70XX' };
}
function calcBase(c){
  const AE = G.AnexoE || (typeof require !== 'undefined' ? require('../calc/anexoE.js') : null);
  if(!AE) return { error:'No se cargó el cálculo de la placa base.' };
  const cl = perfil(c.columna); if(!cl) return { error:'Escoja el perfil de la columna.' };
  const R = AE.placaBase({ ...c, bf:cl.bf, d:cl.d, tw:cl.tw, tf:cl.tf }, [{ P:+c.P, Mn:+c.Mx, Mb:+c.My, Vn:+c.Vx, Vb:+c.Vy }]);
  if(!R.ok) return { error:R.error };
  const ch = [], GR = { apl:'concreto', geo:'placa', tp:'placa', ten:'anclajes', cono:'concreto', pull:'anclajes', vs:'anclajes', vb:'concreto', vcp:'concreto', int:'anclajes', sb:'concreto', sold:'soldadura' };
  for(const [k, x] of Object.entries(R.checks)){
    const N = x.u === 'N', soloR = !x.u || x.soloOk;
    ch.push({ grupo:GR[k] || 'placa', nombre:x.n, ref:x.ref, dem: soloR ? x.r : N ? x.dem / 1000 : x.dem, cap: soloR ? 1 : N ? x.cap / 1000 : x.cap, ud: soloR ? '' : N ? 'kN' : x.u, ratio:x.r,
      extra: k === 'tp' ? `t requerido = ${r1(x.req)} mm` : '' });
  }
  const f = R.peor, pasos = [
    `Columna ${cl.nom} sobre placa N × B × tp = ${R.N} × ${R.B} × ${R.tp} mm; pedestal ${R.Lp} × ${R.Wp} mm, f'c = ${R.fc} MPa`,
    `Aplastamiento máximo fp,máx = 0.65·0.85·f'c·√(A2/A1) ≤ 2 → ${r2(R.fpMax)} MPa; voladizos m = ${r1(R.m)}, n = ${r1(R.nv)}, λn' = ${r1(R.lnp)} mm`,
    `Sentido X (N): ${f.rN.caso}; e = ${isFinite(f.rN.e) ? r1(f.rN.e) : '∞'} mm, e crít = ${r1(f.rN.ecrit)} mm, Y = ${r1(f.rN.Y)} mm, Tu = ${r2(f.rN.Tu / 1000)} kN`,
    `Sentido Y (B): ${f.rB.caso}; Tu = ${r2(f.rB.Tu / 1000)} kN · espesor requerido ${r1(f.tReq)} mm`,
    `Anclajes ${R.n} × ${c.perno} ${c.anclaje}: φNsa = ${r2(R.phiNsa / 1000)} kN, φVsa = ${r2(R.phiVsa / 1000)} kN por perno; hef = ${R.hef} mm` ];
  return fin(ch, [], [...R.avisos], pasos, { R, cl });
}


// ═════════ Fuerzas en los dos ejes y torsión (pedido de Amo 10-nov) ═════════
// Ejes del miembro conectado (como el Anexo D): 1 = eje del miembro, 2 = eje fuerte (cortante V2, momento M3), 3 = eje débil (V3, M2); T = torsión.
// Cargas mayoradas resultantes que da Amo (una sola fila). P: + tensión, − compresión.
const nz = v => { const x = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(x) ? x : 0; };
// Grupo de pernos por el método elástico (6 componentes): pts {u, v} [mm] en el plano de los pernos; F {Fu, Fv [kN], Mn [kN·m] (en el plano), N [kN] (normal, + tensión), Mu, Mv [kN·m] (fuera del plano)}
function pernos3D(pts, F, op){
  const n = pts.length, uc = pts.reduce((a, p) => a + p.u, 0) / n, vc = pts.reduce((a, p) => a + p.v, 0) / n;
  const P = pts.map(p => ({ u:p.u - uc, v:p.v - vc })), Iu = P.reduce((a, p) => a + p.v * p.v, 0), Iv = P.reduce((a, p) => a + p.u * p.u, 0), J = Iu + Iv;
  const B = PERNOS[op.grado], Fnv = B[op.rosca === 'X' ? 'X' : 'N'], Ab = Math.PI * op.d * op.d / 4, planos = op.planos || 1;
  let peor = null;
  for(const p of P){
    const ru = F.Fu / n - (J > 0 ? F.Mn * 1000 * p.v / J : 0), rv = F.Fv / n + (J > 0 ? F.Mn * 1000 * p.u / J : 0), r = Math.hypot(ru, rv);
    const t = Math.max(0, F.N / n + (Iu > 0 ? F.Mu * 1000 * p.v / Iu : 0) + (Iv > 0 ? F.Mv * 1000 * p.u / Iv : 0));
    const frv = r * 1000 / (Ab * planos), Fntp = Math.max(0, Math.min(B.Fnt, 1.3 * B.Fnt - B.Fnt / (0.75 * Fnv) * frv));
    const capT = 0.75 * Fntp * Ab / 1000, rat = Math.max(r / op.rCorte, t > 0 ? (capT > 0 ? t / capT : Infinity) : 0);
    if(!peor || rat > peor.rat) peor = { r, t, capT, Fntp, rat };
  }
  peor.nota = (Iv === 0 && F.Mv ? ' · una sola columna de pernos no toma ese momento por tensión: lo toma la chapa a flexión' : '') + (Iu === 0 && F.Mu ? ' · una sola fila de pernos no toma ese momento por tensión: lo toma la chapa a flexión' : '');
  return peor;
}
// Sección rectangular de platina (L × t) con las 6 fuerzas: flexión y axial lineal + cortante y torsión (Manual AISC ec. 10-5 generalizada)
function secPlatina(L, t, Fy, f){
  const A = L * t, flex = Math.abs(f.N) * 1000 / (0.9 * Fy * A) + Math.abs(f.ML) * 1e6 / (0.9 * Fy * t * L * L / 4) + Math.abs(f.Mt) * 1e6 / (0.9 * Fy * L * t * t / 4);
  const corte = (Math.abs(f.VL) + Math.abs(f.Vt)) * 1000 / (1.0 * 0.6 * Fy * A) + Math.abs(f.T) * 1e6 / (L * t * t / 3) / (0.6 * Fy);
  return { flex, corte, ratio:Math.hypot(flex, corte) };
}
// Soldadura de filete por el método de la línea (misma función del Anexo E del generador)
function soldLinea(forma, b, d, w, electrodo, tBase, f){
  const AE = G.AnexoE || (typeof require !== 'undefined' ? require('../calc/anexoE.js') : null); if(!AE) return null;
  const R = AE.soldadura({ forma, b, d, w, electrodo, t:tBase, acero:'A36', H:f.H, V:f.V, N:f.N, T:f.T, Mx:f.Mx, My:f.My });
  return { ratio:R.checks[0].r, f:R.peor.f, wReq:R.wReq };
}
const hayExtra = (c, k) => k.some(x => Math.abs(nz(c[x])) > 0);
const EXTRA = {
  aleta(c, r, add, av){ if(!hayExtra(c, ['P', 'V3', 'T', 'M2', 'M3'])) return;
    const d = +c.d, n = Math.round(+c.n), s = +c.s, a = +c.a, vg = r.geo.vg, Lp = r.geo.Lp, dh = agujero(d), pl = ACEROS[c.aceroPl];
    const pts = Array.from({ length:n }, (_, i) => ({ u:0, v:i * s })), rC = Math.min(fv(c, d), aplast(Math.min(+c.Lev, +c.Leh) - dh / 2, +c.tp, d, pl.Fu).phiRn, aplast(r.geo.LehB - dh / 2, vg.tw, d, ACEROS[c.aceroViga].Fu).phiRn);
    const P = nz(c.P), V2 = nz(c.Vu), V3 = nz(c.V3), T = nz(c.T), M2 = nz(c.M2), M3 = nz(c.M3);
    const b = pernos3D(pts, { Fu:P, Fv:V2, Mn:M3, N:Math.abs(V3), Mu:T, Mv:M2 }, { d, grado:c.grado, rosca:c.rosca, rCorte:rC });
    add('pernos', 'Pernos con las 6 fuerzas (método elástico, J3-3a)', 'F.2.10.3.7 (J3-3a)', b.rat, 1, '', `perno crítico: cortante ${r2(b.r)} kN (φrn ${r2(rC)}), tensión ${r2(b.t)} kN (φRn ${r2(b.capT)})${b.nota}`);
    const sp = secPlatina(Lp, +c.tp, pl.Fy, { N:P, VL:V2, Vt:V3, T, ML:M3 + V2 * a / 1000, Mt:M2 + V3 * a / 1000 });
    add('chapa', 'Chapa en la soldadura: flexión en ambos ejes + cortante + torsión', 'F.2.10.4 · Manual AISC ec. 10-5', sp.ratio, 1, '', `flexión/axial ${r3(sp.flex)}, cortante/torsión ${r3(sp.corte)}; M3 + V2·a y M2 + V3·a`);
    const w = soldLinea('2', +c.tp, Lp, +c.w, c.electrodo, +c.tp, { H:V3, V:V2, N:P, T, Mx:M3 + V2 * a / 1000, My:M2 + V3 * a / 1000 });
    if(w) add('soldadura', 'Filetes con las 6 fuerzas (método de la línea)', 'F.2.10.2.4', w.ratio, 1, '', `f máx. ${r1(w.f)} N/mm; w requerido ${r1(w.wReq)} mm`);
    const q = [M3 && 'el momento M3', M2 && 'el momento M2', T && 'la torsión T', V3 && 'el cortante V3'].filter(Boolean);
    if(q.length) av.push(`La chapa de aleta es una unión a cortante y es delgada fuera de su plano: ${q.join(', ')} la doblan en su eje débil. Si no cumple, considere una chapa más gruesa, una chapa de testa o una unión a momento.`); },
  angular(c, r, add, av){ if(!hayExtra(c, ['P', 'V3', 'T', 'M2', 'M3'])) return;
    const d = +c.d, n = Math.round(+c.n), s = +c.s, vg = r.geo.vg, dh = agujero(d), an = ACEROS[c.aceroAng], g2 = +c.g2;
    const P = nz(c.P), V2 = nz(c.Vu), V3 = nz(c.V3), T = nz(c.T), M2 = nz(c.M2), M3 = nz(c.M3), op = { d, grado:c.grado, rosca:c.rosca };
    const bA = +c.bAng, hol = +c.holgura || 0, rW = Math.min(2 * fv(c, d), aplast(+c.g1 - hol - dh / 2, vg.tw, d, ACEROS[c.aceroViga].Fu).phiRn, 2 * aplast(Math.min(+c.Lev, bA - +c.g1) - dh / 2, +c.tAng, d, an.Fu).phiRn);
    const bw = pernos3D(Array.from({ length:n }, (_, i) => ({ u:0, v:i * s })), { Fu:P, Fv:V2, Mn:M3, N:Math.abs(V3), Mu:T, Mv:M2 }, { ...op, planos:2, rCorte:rW });
    add('pernos', 'Pernos en el alma con las 6 fuerzas (J3-3a)', 'F.2.10.3.7', bw.rat, 1, '', `cortante ${r2(bw.r)} kN (φrn ${r2(rW)}), tensión ${r2(bw.t)} kN${bw.nota}`);
    if(c.unSop === 'sold'){ const w = soldLinea('2', 2 * bA + vg.tw, r.geo.L, +c.wS, c.electrodo, Math.min(+c.tAng, +c.tSop), { H:V3, V:V2, N:P, T, Mx:M3, My:M2 });
      if(w) add('soldadura', 'Filetes al soporte con las 6 fuerzas (método de la línea)', 'F.2.10.2.4', w.ratio, 1, '', `dos líneas de ${r1(r.geo.L)} mm separadas 2b + tw = ${r1(2 * bA + vg.tw)} mm; f máx. ${r1(w.f)} N/mm`); }
    else { const rS = Math.min(fv(c, d), aplast(Math.min(+c.Lev, bA - g2) - dh / 2, +c.tAng, d, an.Fu).phiRn, 0.75 * 2.4 * d * +c.tSop * ACEROS[c.aceroSop].Fu / 1000);
    const pts = []; for(const sg of [-1, 1]) for(let i = 0; i < n; i++) pts.push({ u:sg * (g2 + vg.tw / 2), v:i * s });
    const bs = pernos3D(pts, { Fu:V3, Fv:V2, Mn:T, N:P, Mu:M3, Mv:M2 }, { ...op, rCorte:rS });
    add('pernos', 'Pernos en el soporte con las 6 fuerzas (J3-3a)', 'F.2.10.3.7', bs.rat, 1, '', `cortante ${r2(bs.r)} kN (φrn ${r2(rS)}), tensión ${r2(bs.t)} kN`); }
    if(c.unSop !== 'sold' && (P > 0 || Math.abs(M3) > 0 || Math.abs(M2) > 0)) av.push('Con tensión o momentos los angulares se doblan y los pernos del soporte trabajan con efecto palanca, que aquí no se calcula. Revise el espesor de los angulares o use una chapa de testa.'); },
  testaV(c, r, add, av){ if(!hayExtra(c, ['P', 'V3', 'T', 'M2', 'M3'])) return;
    const d = +c.d, n = Math.round(+c.n), s = +c.s, g = +c.g, dh = agujero(d), pl = ACEROS[c.aceroPl], vg = r.geo.vg, Lp = r.geo.Lp;
    const P = nz(c.P), V2 = nz(c.Vu), V3 = nz(c.V3), T = nz(c.T), M2 = nz(c.M2), M3 = nz(c.M3);
    const rC = Math.min(fv(c, d), aplast(Math.min(+c.Lev, (+c.bp - g) / 2) - dh / 2, +c.tp, d, pl.Fu).phiRn, 0.75 * 2.4 * d * +c.tSop * ACEROS[c.aceroSop].Fu / 1000);
    const pts = []; for(const sg of [-1, 1]) for(let i = 0; i < n; i++) pts.push({ u:sg * g / 2, v:i * s });
    const b = pernos3D(pts, { Fu:V3, Fv:V2, Mn:T, N:P, Mu:M3, Mv:M2 }, { d, grado:c.grado, rosca:c.rosca, rCorte:rC });
    add('pernos', 'Pernos con las 6 fuerzas (método elástico, J3-3a)', 'F.2.10.3.7', b.rat, 1, '', `cortante ${r2(b.r)} kN (φrn ${r2(rC)}), tensión ${r2(b.t)} kN (φRn ${r2(b.capT)})`);
    const w = soldLinea('2', vg.tw, Lp - 2 * +c.w, +c.w, c.electrodo, Math.min(+c.tp, vg.tw), { H:V3, V:V2, N:P, T, Mx:M3, My:M2 });
    if(w) add('soldadura', 'Filetes alma–placa con las 6 fuerzas (método de la línea)', 'F.2.10.2.4', w.ratio, 1, '', `f máx. ${r1(w.f)} N/mm; w requerido ${r1(w.wReq)} mm`);
    if(P > 0 || Math.abs(M3) > 0 || Math.abs(M2) > 0) av.push('La placa delgada trabaja con efecto palanca cuando hay tensión o momento; aquí no se calcula. Considere una chapa de testa a momento.'); },
  asiento(c, r, add, av){ if(!hayExtra(c, ['P', 'V3', 'T', 'M2', 'M3'])) return;
    const d = +c.d, g = +c.g, nf = Math.max(1, Math.round(+c.filas)), an = ACEROS[c.aceroAng];
    const P = nz(c.P), V2 = nz(c.Vu), V3 = nz(c.V3), T = nz(c.T), M2 = nz(c.M2), M3 = nz(c.M3);
    const lcA = Math.min((+c.La - g) / 2, +c.bv - +c.ev - (nf - 1) * 70) - agujero(d) / 2, rC = Math.min(fv(c, d), aplast(lcA, +c.t, d, an.Fu).phiRn, 0.75 * 2.4 * d * +c.tSop * ACEROS[c.aceroSop].Fu / 1000);
    const pts = []; for(const sg of [-1, 1]) for(let i = 0; i < nf; i++) pts.push({ u:sg * g / 2, v:i * 3 * d });
    if(c.unSop === 'sold'){ const w = soldLinea('2', +c.La, c.rig ? +c.hs : +c.bv, c.rig ? +c.wR : +c.wS, c.electrodo, Math.min(+c.t, +c.tSop), { H:V3, V:V2, N:P, T, Mx:M3, My:M2 });
      if(w) add('soldadura', 'Filetes al soporte con las 6 fuerzas (método de la línea)', 'F.2.10.2.4', w.ratio, 1, '', `f máx. ${r1(w.f)} N/mm`); }
    else { const b = pernos3D(pts, { Fu:V3, Fv:V2, Mn:T, N:P, Mu:M3, Mv:M2 }, { d, grado:c.grado, rosca:c.rosca, rCorte:rC });
    add('pernos', 'Pernos al soporte con las 6 fuerzas (J3-3a)', 'F.2.10.3.7', b.rat, 1, '', `cortante ${r2(b.r)} kN, tensión ${r2(b.t)} kN`); }
    av.push('El asiento solo apoya la viga: la tensión, los momentos y la torsión deben tomarse con un angular superior o lateral, que aquí no se diseña.'); },
  testa(c, r, add, av){ if(!hayExtra(c, ['P', 'V3', 'T', 'M2'])) return;
    const d = +c.d, g = +c.g, Ab = Math.PI * d * d / 4, B = PERNOS[c.grado], Fnv = B[c.rosca === 'X' ? 'X' : 'N'], vg = r.geo.vg, nT = r.geo.nTot;
    const P = nz(c.P), V2 = nz(c.Vu), V3 = nz(c.V3), T = nz(c.T), M2 = nz(c.M2), M3 = nz(c.Mu);
    const ras = c.tipo === 'ras', sumh = ras ? r.geo.h1 + (r.geo.h2 || 0) : r.geo.h0 + r.geo.h1;
    const tM3 = Math.abs(M3) * 1000 / (2 * sumh), tP = Math.max(0, P) / nT, tM2 = Math.abs(M2) * 1000 / (nT * g / 2), t = tM3 + tP + tM2;
    const rMax = Math.hypot(g / 2, (vg.d + 2 * (+c.pfo || 0)) / 2), Jp = nT * (g * g / 4 + (vg.d / 2) ** 2 * 0.6);
    const rv = Math.hypot(V2, V3) / nT + Math.abs(T) * 1e3 * rMax / Jp;
    const frv = rv * 1000 / Ab, Fntp = Math.max(0, Math.min(B.Fnt, 1.3 * B.Fnt - B.Fnt / (0.75 * Fnv) * frv)), capT = 0.75 * Fntp * Ab / 1000;
    add('pernos', 'Perno más cargado: tensión (M3 + P + M2) con cortante (V2, V3, T)', 'F.2.10.3.7 (J3-3a)', t, capT, 'kN', `t = ${r2(tM3)} + ${r2(tP)} + ${r2(tM2)} kN; cortante ${r2(rv)} kN/perno → F'nt = ${Math.round(Fntp)} MPa`);
    const dh = agujero(d), pl = ACEROS[c.aceroPl], cl = c.columna ? perfil(c.columna) : null;
    const bP = aplast(Math.min(ras ? 1e6 : +c.de || 1e6, (+c.bp - g) / 2) - dh / 2, +c.tp, d, pl.Fu).phiRn, bC = cl ? 0.75 * 2.4 * d * cl.tf * ACEROS[c.aceroCol].Fu / 1000 : Infinity;
    const rb = Math.min(fv(c, d), bP, bC);
    add('pernos', 'Cortante y aplastamiento por perno (V2, V3 y torsión T, todos los pernos)', 'F.2.10.3.6 y F.2.10.3.10 (J3-1, J3-6)', rv, rb, 'kN', `${nT} pernos; el menor de: corte ${r2(fv(c, d))}, aplastamiento placa (borde) ${r2(bP)}${cl ? `, ala de la columna ${r2(bC)}` : ''} kN`);
    if(c.soldAla !== 'cjp'){ const w = soldLinea('I', vg.bf, vg.d, Math.min(+c.wAla, +c.wAlma), c.electrodo, vg.tf, { H:V3, V:V2, N:P, T, Mx:M3, My:M2 });
      if(w) add('soldadura', 'Soldadura del contorno del perfil con las 6 fuerzas (método de la línea)', 'F.2.10.2.4', w.ratio, 1, '', `f máx. ${r1(w.f)} N/mm con el filete menor; w requerido ${r1(w.wReq)} mm`); }
    if(Math.abs(M2) > 0) av.push('El momento M2 (eje débil) se reparte como tensión entre las dos columnas de pernos; la placa y el ala de la columna se revisan solo para M3 por líneas de fluencia.'); },
  empalme(c, r, add, av){ if(!hayExtra(c, ['P', 'V3', 'T', 'M2'])) return;
    const d = +c.d, vg = r.geo.vg, gap = +c.gap || 0, tpf = +c.tpf, bpf = +c.bpf, nf = Math.round(+c.nf), sf = +c.sf, gf = +c.gf, pl = ACEROS[c.aceroPl], dh = agujero(d);
    const P = nz(c.P), V2 = nz(c.Vu), V3 = nz(c.V3), T = nz(c.T), M2 = nz(c.M2), M3 = nz(c.Mu);
    const Af = bpf * tpf, Aw = 2 * +c.hpw * +c.tpw, At = 2 * Af + Aw, brazo = vg.d + tpf;
    const Ff = Math.abs(M3) * 1000 / brazo + Math.abs(P) * Af / At, Vf = Math.abs(V3) / 2 + Math.abs(T) * 1000 / brazo, Mf = Math.abs(M2) / 2;
    const pts = []; for(let i = 0; i < nf; i++) for(const sg of [-1, 1]) pts.push({ u:i * sf, v:sg * gf / 2 });
    const rC = Math.min(fv(c, d), aplast(Math.min(+c.Lef, (bpf - gf) / 2) - dh / 2, tpf, d, pl.Fu).phiRn, aplast(Math.min(+c.Lef, (vg.bf - gf) / 2) - dh / 2, vg.tf, d, ACEROS[c.aceroViga].Fu).phiRn);
    const b = pernos3D(pts, { Fu:Ff, Fv:Vf, Mn:Mf + Vf * (gap / 2 + +c.Lef + (nf - 1) * sf / 2) / 1000, N:0, Mu:0, Mv:0 }, { d, grado:c.grado, rosca:c.rosca, rCorte:rC });
    add('pernos', 'Pernos de un ala con M3, P, V3, M2 y T (método elástico)', 'F.2.10.3.6', b.rat, 1, '', `cortante del perno crítico ${r2(b.r)} kN (φrn ${r2(rC)}); por ala: F ${r2(Ff)} kN, V ${r2(Vf)} kN, M ${r2(Mf)} kN·m`);
    const sp = secPlatina(bpf, tpf, pl.Fy, { N:Ff, VL:Vf, Vt:0, T:0, ML:Mf + Vf * gap / 2000, Mt:0 });
    add('alas', 'Cubrejunta del ala: tensión + flexión en su plano (M2) + cortante', 'F.2.10.4 · Manual AISC ec. 10-5', sp.ratio, 1, '', `flexión/axial ${r3(sp.flex)}, cortante ${r3(sp.corte)}`);
    if(Math.abs(P) > 0){ const ew = gap / 2 + +c.Lehw, Pw = Math.abs(P) * Aw / At, nw = Math.round(+c.nw);
      const rW = Math.min(2 * fv(c, d), aplast(+c.Lehw - dh / 2, vg.tw, d, ACEROS[c.aceroViga].Fu).phiRn, 2 * aplast(Math.min(+c.Lew, +c.Lehw) - dh / 2, +c.tpw, d, pl.Fu).phiRn);
      const bw = pernos3D(Array.from({ length:nw }, (_, i) => ({ u:0, v:i * +c.sw })), { Fu:Pw, Fv:V2, Mn:V2 * ew / 1000, N:0, Mu:0, Mv:0 }, { d, grado:c.grado, rosca:c.rosca, rCorte:rW });
      add('pernos', 'Pernos del alma con V2 y la parte de P (método elástico)', 'F.2.10.3.6', bw.rat, 1, '', `P en el alma ${r2(Pw)} kN; cortante crítico ${r2(bw.r)} kN`); } },
  cartela(c, r, add, av){ if(!hayExtra(c, ['V2', 'V3', 'T', 'M2', 'M3'])) return;
    const d = +c.d, n = Math.round(+c.n), s = +c.s, nL = +c.nL === 1 ? 1 : 2, dh = agujero(d), ag = ACEROS[c.aceroG], aL = ACEROS[c.aceroL];
    const P = nz(c.Pu), V2 = nz(c.V2), V3 = nz(c.V3), T = nz(c.T), M2 = nz(c.M2), M3 = nz(c.M3);
    const rC = Math.min(nL * fv(c, d), nL * aplast(+c.Le - dh / 2, +c.tL, d, aL.Fu).phiRn, 0.75 * 2.4 * d * +c.tg * ag.Fu / 1000);
    const b = pernos3D(Array.from({ length:n }, (_, i) => ({ u:i * s, v:0 })), { Fu:P, Fv:V2, Mn:M3, N:Math.abs(V3), Mu:T, Mv:M2 }, { d, grado:c.grado, rosca:c.rosca, planos:nL, rCorte:rC });
    add('pernos', 'Pernos con las 6 fuerzas de la diagonal (J3-3a)', 'F.2.10.3.7', b.rat, 1, '', `cortante ${r2(b.r)} kN (φrn ${r2(rC)}), tensión ${r2(b.t)} kN${b.nota}`);
    const th = (+c.theta || 0) * Math.PI / 180, Lwg = +c.Lwg, hc = +c.Lcr + (n - 1) * s / 2;
    const Vw = P * Math.cos(th) - V2 * Math.sin(th), Nw = P * Math.sin(th) + V2 * Math.cos(th), Mx = Math.abs(M3), My = Math.abs(M2) + Math.abs(V3) * hc / 1000;
    const sp = secPlatina(Lwg, +c.tg, ag.Fy, { N:Nw, VL:Vw, Vt:V3, T, ML:Mx, Mt:My });
    add('cartela', 'Cartela en la soldadura: fuerzas en su plano y fuera de él', 'F.2.10.4 · Manual AISC ec. 10-5', sp.ratio, 1, '', `flexión/axial ${r3(sp.flex)}, cortante/torsión ${r3(sp.corte)}; fuera del plano M = M2 + V3·${Math.round(hc)} mm`);
    const w = soldLinea('2', +c.tg, Lwg, +c.w, c.electrodo, +c.tg, { H:V3, V:Vw, N:Nw, T, Mx, My });
    if(w) add('soldadura', 'Filetes cartela–soporte con las 6 fuerzas (método de la línea)', 'F.2.10.2.4', w.ratio, 1, '', `f máx. ${r1(w.f)} N/mm; w requerido ${r1(w.wReq)} mm`);
    av.push('Fuerzas fuera del plano de la cartela: la cartela es delgada en esa dirección; revise si necesita un rigidizador.'); },
  grupo(c, r, add, av){ if(!hayExtra(c, ['Nt', 'Mx', 'My'])) return;
    const d = +c.d, dh = agujero(d), pl = ACEROS[c.aceroPl], t = (+c.ang || 0) * Math.PI / 180, Pu = nz(c.Pu), e = nz(c.e);
    const pts = []; for(let j = 0; j < +c.cols; j++) for(let i = 0; i < +c.filas; i++) pts.push({ u:j * +c.g, v:i * +c.s });
    const rC = Math.min(fv(c, d), aplast(Math.min(+c.Lev, +c.Leh) - dh / 2, +c.tp, d, pl.Fu).phiRn, 0.75 * 2.4 * d * +c.tSop * ACEROS[c.aceroSop].Fu / 1000);
    const b = pernos3D(pts, { Fu:Pu * Math.sin(t), Fv:Pu * Math.cos(t), Mn:Pu * e / 1000, N:nz(c.Nt), Mu:nz(c.Mx), Mv:nz(c.My) }, { d, grado:c.grado, rosca:c.rosca, rCorte:rC });
    add('pernos', 'Pernos con fuerzas en el plano y fuera de él (método elástico, J3-3a)', 'F.2.10.3.7', b.rat, 1, '', `cortante ${r2(b.r)} kN (φrn ${r2(rC)}), tensión ${r2(b.t)} kN (φRn ${r2(b.capT)})`);
    av.push('Con tensión normal a la chapa los pernos pueden trabajar con efecto palanca; aquí no se calcula.'); },
  base(c, r, add, av){ if(!hayExtra(c, ['T'])) return;
    const R = r.geo.R, nB = +c.nB, T = nz(c.T), pts = [];
    for(const sx of [-1, 1]) for(let j = 0; j < nB; j++) pts.push({ u:sx * +c.S1 / 2, v:nB > 1 ? -+c.S2 / 2 + j * +c.S2 / (nB - 1) : 0 });
    const J = pts.reduce((a, p) => a + p.u * p.u + p.v * p.v, 0), n = pts.length; let peor = 0;
    for(const p of pts){ const vx = nz(c.Vx) / n - T * 1000 * p.v / J, vy = nz(c.Vy) / n + T * 1000 * p.u / J; peor = Math.max(peor, Math.hypot(vx, vy)); }
    add('anclajes', 'Cortante en el anclaje más cargado con torsión T', 'C-D.6.1 (acero)', peor, R.phiVsa / 1000, 'kN', `T = ${r2(T)} kN·m repartida en ${n} anclajes`);
    av.push('Con torsión, el arrancamiento del borde del concreto por cortante se revisa aquí solo con Vx y Vy; verifíquelo si la torsión es importante.'); },
};
EXTRA.ras = EXTRA.testa;

// ── Unión a momento soldada en todo el perímetro (pedido de Amo 11-nov) ─────────────
// Perfil I o tubo rectangular soldado directo a la columna o a una placa; filete en todo el contorno (método de la línea con las 6 fuerzas)
// o penetración completa (la soldadura iguala al metal base → se revisa la sección del miembro en la cara).
function defaultsSoldada(){
  return { tipo:'soldada', nom:'', desc:'', P:0, Vu:60, V3:0, T:0, M2:0, Mu:40,
    miembro:'I', viga:'IPE 300', aceroViga:'A572 Gr 50', H:150, B:100, tt:6,
    union:'filete', w:8, electrodo:'E70XX', soporte:'col', columna:'HEB 300', aceroCol:'A572 Gr 50', colTope:false, tSop:25, aceroSop:'A36' };
}
function calcSoldada(c){
  const ch = [], av = [], pasos = [], req = [], add = addF(ch);
  const P = nz(c.P), V2 = nz(c.Vu), V3 = nz(c.V3), T = nz(c.T), M2 = nz(c.M2), M3 = nz(c.Mu);
  const am = ACEROS[c.aceroViga], AEac = k => k === 'A992' ? 'A572 Gr 50' : k;
  let m;                                                                           // propiedades del miembro [mm]
  if(c.miembro === 'tubo'){ const H = +c.H, B = +c.B, t = +c.tt, Hi = H - 2 * t, Bi = B - 2 * t;
    m = { nom:`Tubo ${H}×${B}×${t}`, d:H, bf:B, tf:t, tw:t, A:H * B - Hi * Bi, Zx:(B * H * H - Bi * Hi * Hi) / 4, Zy:(H * B * B - Hi * Bi * Bi) / 4, Aw2:2 * H * t, Aw3:2 * B * t, tub:true }; }
  else { const pf = (G.PERFILES_LAM || []).find(x => x[0] === c.viga); if(!pf) return { error:'Escoja el perfil.' };
    m = { nom:pf[0], d:pf[2], bf:pf[3], tw:pf[4], tf:pf[5], r:pf[6], A:pf[7], Zx:pf[10], Zy:pf[13], Aw2:pf[2] * pf[4], Aw3:2 * pf[3] * pf[5] }; }
  const tMin = Math.min(m.tf, m.tw, c.soporte === 'placa' ? +c.tSop : (perfil(c.columna)?.tf || 99));
  pasos.push(`Miembro ${m.nom} (${c.aceroViga}): d = ${m.d}, b = ${m.bf}, tf = ${m.tf}, tw = ${m.tw} mm · P = ${r2(P)}, V2 = ${r2(V2)}, V3 = ${r2(V3)} kN · T = ${r2(T)}, M2 = ${r2(M2)}, M3 = ${r2(M3)} kN·m`);
  if(c.union === 'cjp'){
    pasos.push('Penetración completa en todo el perímetro: la soldadura tiene la resistencia del metal base (Tabla F.2.10.2-5); se revisa la sección del miembro en la cara del soporte.');
    const Pc = 0.9 * am.Fy * m.A / 1000, Mcx = 0.9 * am.Fy * m.Zx / 1e6, Mcy = 0.9 * am.Fy * m.Zy / 1e6, pr = Math.abs(P) / Pc;
    const inter = pr >= 0.2 ? pr + 8 / 9 * (Math.abs(M3) / Mcx + Math.abs(M2) / Mcy) : pr / 2 + Math.abs(M3) / Mcx + Math.abs(M2) / Mcy;
    add('soldadura', 'Sección en la cara: axial + flexión en ambos ejes', 'F.2.8.1 (H1-1a/b), φ = 0.90', inter, 1, '', `φPn ${r2(Pc)} kN, φMn3 ${r2(Mcx)}, φMn2 ${r2(Mcy)} kN·m`);
    const tors = m.tub ? Math.abs(T) * 1e6 / (2 * (m.d - m.tf) * (m.bf - m.tw) * m.tf) : Math.abs(T) * 1e6 * Math.max(m.tf, m.tw) / ((2 * m.bf * m.tf ** 3 + m.d * m.tw ** 3) / 3);
    add('soldadura', 'Cortante V2 con torsión', 'F.2.7 (G2-1) · esfuerzo', Math.abs(V2) * 1000 / m.Aw2 + tors, 0.6 * am.Fy, 'MPa', `V2/Aw + τ torsión (${r1(tors)} MPa)`);
    add('soldadura', 'Cortante V3 con torsión', 'F.2.7 (G6) · esfuerzo', Math.abs(V3) * 1000 / m.Aw3 + tors, 0.9 * 0.6 * am.Fy, 'MPa', `V3/Af + τ torsión`);
  } else {
    const AE = G.AnexoE || (typeof require !== 'undefined' ? require('../calc/anexoE.js') : null);
    const R = AE.soldadura({ forma:m.tub ? 'O' : 'I', b:m.bf, d:m.d, w:+c.w, electrodo:c.electrodo, t:tMin, acero:AEac(c.aceroViga), H:V3, V:V2, N:P, T, Mx:M3, My:M2 });
    pasos.push(`Filete de ${c.w} mm en todo el contorno (${m.tub ? 'perímetro rectangular' : 'alas por ambas caras y alma'}): método de la línea; f máx. = ${r1(R.peor.f)} N/mm; w requerido = ${r1(R.wReq)} mm`);
    R.checks.slice(0, 3).forEach(x => ch.push({ grupo:'soldadura', nombre:x.n, ref:x.ref, dem:x.soloOk ? x.dem : x.dem, cap:x.cap, ud:x.u, ratio:x.r, extra:'' }));
    av.push('Unión en T: no aplica el tamaño máximo del filete en el borde (F.2.10.2.2 es para bordes de platinas).');
  }
  // Soporte
  const Ffu = Math.abs(M3) * 1000 / (m.d - m.tf) + Math.abs(P) / 2;
  const N = m.tf + 2 * (c.union === 'cjp' ? 0 : +c.w);
  pasos.push(`Fuerza en cada ala Ffu = M3/(d − tf) + |P|/2 = ${r2(Ffu)} kN; longitud de apoyo N = tf + 2w = ${r1(N)} mm`);
  if(c.soporte === 'placa'){ const ps = ACEROS[c.aceroSop], tp = +c.tSop;
    add('soporte', 'Placa de apoyo: flexión local bajo el ala en tensión', 'F.2.10.10.1 (J10-1) aplicado a la placa', Ffu, 0.9 * 6.25 * ps.Fy * tp * tp / 1000, 'kN', `t = ${tp} mm`);
    if(Math.abs(M2) > 0 || Math.abs(T) > 0) av.push('M2 y T llegan a la placa fuera de su plano; revise la placa y lo que la sostiene (pernos o soldadura).'); }
  else { const cl = perfil(c.columna);
    if(cl){ const ac = ACEROS[c.aceroCol], kc = cl.tf + cl.r, E = 200000;
      add('columna', 'Flexión local del ala de la columna', 'F.2.10.10.1 (J10-1)', Ffu, 0.9 * 6.25 * ac.Fy * cl.tf ** 2 / 1000 * (c.colTope ? 0.5 : 1), 'kN', `6.25·Fy·tf²${c.colTope ? ' × 0.5 (en el tope)' : ''}`);
      const ly = (c.colTope ? 2.5 : 5) * kc + N;
      add('columna', 'Fluencia local del alma', `F.2.10.10.2 (J10-${c.colTope ? 3 : 2})`, Ffu, 1.0 * ac.Fy * cl.tw * ly / 1000, 'kN', `L = ${c.colTope ? '2.5' : '5'}k + N = ${r1(ly)} mm`);
      const rN = N / cl.d, f = c.colTope ? 0.4 : 0.8;
      const cr = (c.colTope && rN > 0.2) ? 0.4 * cl.tw ** 2 * (1 + (4 * rN - 0.2) * (cl.tw / cl.tf) ** 1.5) : f * cl.tw ** 2 * (1 + 3 * rN * (cl.tw / cl.tf) ** 1.5);
      add('columna', 'Aplastamiento del alma', 'F.2.10.10.3 (J10-4/5)', Ffu, 0.75 * cr * Math.sqrt(E * ac.Fy * cl.tf / cl.tw) / 1000, 'kN', `N/d = ${r3(rN)}`);
      add('columna', 'Zona de panel', 'F.2.10.10.6 (J10-9), φ = 0.90', Ffu, 0.9 * 0.6 * ac.Fy * cl.d * cl.tw / 1000, 'kN', '0.6·Fy·dc·tw (sin cortante de la columna)');
      req.push(['El miembro cabe en el ala de la columna: b ≤ bf de la columna', m.bf <= cl.bf + 1e-6, `${m.bf} ≤ ${cl.bf} mm`]);
      if(Math.abs(M2) > 0) av.push('M2 se transmite al ala de la columna como flexión fuera de su plano; si es importante, use rigidizadores o una placa.'); }
    else av.push('No se revisó la columna: escoja su perfil.'); }
  req.push(['Acceso para soldar todo el contorno (también por dentro de las alas)', true, 'verificar en obra']);
  if(c.union !== 'cjp') req.push(['Filete ≥ mínimo de la Tabla F.2.10.2-4', +c.w >= (tMin > 19 ? 8 : tMin > 12.7 ? 6 : tMin > 6.4 ? 5 : 3), `${c.w} mm (parte más delgada ${tMin} mm)`]);
  return fin(ch, req, av, pasos, { m, Ffu });
}

// ── Empalme de viga en Z soldado (pedido de Amo 12-nov) ─────────────
// Corte en Z: la mitad superior (ala + medio alma) se corta en x1, el alma se corta a lo largo de su eje entre x1 y x2 (desfase a)
// y la mitad inferior se corta en x2; así las soldaduras de las alas no quedan en la misma sección.
// Cada corte vertical lleva solo medio alma → el cortante V2 pasa por media alma; la soldadura longitudinal del alma toma el flujo V2·Q/I en la longitud a.
function defaultsEmpZ(){
  return { tipo:'empZ', nom:'', desc:'', P:0, Vu:60, V3:0, T:0, M2:0, Mu:40, viga:'IPE 300', aceroViga:'A572 Gr 50', a:150,
    union:'cjp', Ef:'', Ew:'', electrodo:'E70XX' };
}
function calcEmpZ(c){
  const ch = [], av = [], pasos = [], req = [], add = addF(ch);
  const P = nz(c.P), V2 = nz(c.Vu), V3 = nz(c.V3), T = nz(c.T), M2 = nz(c.M2), M3 = nz(c.Mu), a = +c.a || 0;
  const pf = (G.PERFILES_LAM || []).find(x => x[0] === c.viga); if(!pf) return { error:'Escoja el perfil de la viga.' };
  const [nom, , d, bf, tw, tf, r, A, Ix, Sx, Zx, Iy, Sy, Zy] = pf, ac = ACEROS[c.aceroViga], FEXX = ELECTRODOS[c.electrodo];
  const cjp = c.union !== 'pjp', Ef = cjp ? tf : Math.min(nz(c.Ef) || tf / 2, tf), Ew = cjp ? tw : Math.min(nz(c.Ew) || tw / 2, tw);
  const hw2 = d / 2 - tf, Af = bf * tf;
  const Q = Af * (d - tf) / 2 + tw * hw2 * hw2 / 2;                 // primer momento de media sección respecto al eje neutro [mm³]
  pasos.push(`${nom} (${c.aceroViga}): d = ${d}, bf = ${bf}, tf = ${tf}, tw = ${tw} mm, A = ${Math.round(A)} mm², Ix = ${(Ix / 1e6).toFixed(2)}·10⁶ mm⁴`);
  pasos.push(`Corte en Z con desfase a = ${a} mm · soldadura ${cjp ? 'de penetración completa (resistencia del metal base)' : `de penetración parcial: garganta efectiva alas ${r1(Ef)} mm, alma ${r1(Ew)} mm`}`);
  // 1. Ala cortada (cada corte vertical corta una sola ala): M3 + P + M2
  const Ff = Math.abs(M3) * 1000 / (d - tf) + Math.abs(P) * Af / A, Mf = Math.abs(M2) / 2;
  const fAla = Ff * 1000 / (bf * Ef) + Mf * 1e6 / (Ef * bf * bf / 6);
  const capAla = cjp ? 0.9 * ac.Fy : Math.min(0.8 * 0.6 * FEXX, 0.9 * ac.Fy);
  pasos.push(`Fuerza en el ala cortada Ff = M3/(d − tf) + P·Af/A = ${r2(Ff)} kN; flexión del ala en su plano por M2/2 = ${r2(Mf)} kN·m`);
  add('soldadura', 'Ala cortada: esfuerzo normal por M3, P y M2', cjp ? 'F.2.10.2 Tabla J2.5 (CJP = metal base, φ 0.90)' : 'F.2.10.2 Tabla J2.5 (PJP, φ 0.80·0.6FEXX)', fAla, capAla, 'MPa', `f = Ff/(bf·E) + (M2/2)/(E·bf²/6)`);
  const vAla = (Math.abs(V3) / 2 + Math.abs(T) * 1000 / (d - tf)) * 1000 / (bf * Ef);
  add('soldadura', 'Ala cortada: cortante lateral (V3/2 + T/(d − tf))', cjp ? 'F.2.10.4.2 (J4-3), φ 1.0' : 'Tabla J2.5 (PJP corte, φ 0.75)', vAla, cjp ? 0.6 * ac.Fy : 0.75 * 0.6 * FEXX, 'MPa', '');
  // 2. Media alma en el corte vertical: V2
  const vWeb = Math.abs(V2) * 1000 / (Ew * hw2);
  add('alma', 'Cortante V2 por la media alma del corte', cjp ? 'F.2.7.2 / J4-3 sobre d/2 − tf, φ 1.0' : 'Tabla J2.5 (PJP corte, φ 0.75)', vWeb, cjp ? 0.6 * ac.Fy : 0.75 * 0.6 * FEXX, 'MPa', `área = ${r1(Ew)} × ${r1(hw2)} mm`);
  // 3. Soldadura longitudinal del alma
  const H = Math.abs(V2) * Q / Ix * a;                               // kN
  const capH = cjp ? 1.0 * 0.6 * ac.Fy * tw * a / 1000 : 0.75 * 0.6 * FEXX * Ew * a / 1000;
  pasos.push(`Flujo de cortante en el eje del alma q = V2·Q/I = ${r2(Math.abs(V2) * Q / Ix * 1000)} N/mm (Q = ${Math.round(Q).toLocaleString('es-CO')} mm³); en a: H = ${r2(H)} kN`);
  add('alma', 'Soldadura longitudinal del alma (longitud a)', cjp ? 'F.2.10.4.2 (J4-3), φ 1.0' : 'Tabla J2.5 (PJP corte, φ 0.75)', H, capH, 'kN', `H = V2·Q·a/I`);
  // 4. Sección del perfil en el empalme (la otra mitad sigue entera)
  const Pc = 0.9 * ac.Fy * A / 1000, Mcx = 0.9 * ac.Fy * Zx / 1e6, Mcy = 0.9 * ac.Fy * Zy / 1e6, pr = Math.abs(P) / Pc;
  const inter = pr >= 0.2 ? pr + 8 / 9 * (Math.abs(M3) / Mcx + Math.abs(M2) / Mcy) : pr / 2 + Math.abs(M3) / Mcx + Math.abs(M2) / Mcy;
  add('viga', 'Sección del perfil en el empalme: axial + flexión en ambos ejes', 'F.2.8.1 (H1-1a/b), sin pandeo', inter, 1, '', `φPn ${r2(Pc)} kN, φMn3 ${r2(Mcx)}, φMn2 ${r2(Mcy)} kN·m`);
  // Requisitos
  req.push(['Desfase a ≥ máx(d/2; 100 mm) (recomendado)', a >= Math.max(d / 2, 100) - 1e-6, `${a} ≥ ${Math.max(d / 2, 100)} mm`]);
  if(!cjp) { const mE = t => t <= 6 ? 3 : t <= 13 ? 5 : t <= 19 ? 6 : t <= 38 ? 8 : 10;
    req.push(['Garganta efectiva mínima de penetración parcial (Tabla F.2.10.2-3)', Ef >= mE(tf) && Ew >= mE(tw), `alas ${r1(Ef)} ≥ ${mE(tf)}, alma ${r1(Ew)} ≥ ${mE(tw)} mm`]); }
  req.push(['Soldadura precalificada con bisel y respaldo, inspección por ultrasonido de las alas', true, 'indicar en planos']);
  req.push(['Agujero de acceso (ratonera) en el alma junto a las alas', true, 'AWS D1.1 / F.2.10.1.6']);
  if(Math.abs(T) > 0) av.push('La torsión se reparte como cortante lateral en las alas; el alabeo no se revisa.');
  if(!cjp) av.push('Penetración parcial: no se recomienda en empalmes de vigas sometidas a fatiga o a sismo con disipación (DES/DMO).');
  return fin(ch, req, av, pasos, { pf:{ nom, d, bf, tw, tf }, a, Q });
}

function defaultsRas(){ return { ...defaultsTesta(), tipo:'ras', Mu:40, filas:2, pb:75, pfi:45, tp:22.2, bp:170 }; }

// ── Nudo: varias vigas que llegan a la misma columna (opción C de Amo, 19-nov) ─────────────
// Cada conexión se diseña sola; el nudo revisa lo que comparten: zona de panel con las dos vigas del eje fuerte,
// pandeo del alma por las dos alas (J10-8), cargas concentradas de cada viga en la columna, placas de continuidad
// (también las que reciben las vigas a momento del eje débil), cortante de las alas por el eje débil y la coherencia
// de los datos de cada conexión con la columna del nudo.
const CARAS = { ala1:'Ala 1', ala2:'Ala 2 (opuesta)', alma1:'Alma, lado 1', alma2:'Alma, lado 2' };
const MOMENTO = ['testa', 'ras', 'soldada'], CORTANTE = ['aleta', 'angular', 'testaV', 'asiento'];
function defaultsNudo(){
  return { nom:'', desc:'', columna:'HEB 300', aceroCol:'A572 Gr 50', colTope:false, Pc:0, Vc:0,
    sentido:'opuesto', sentidoW:'opuesto', rigCol:'auto', tsC:'', wsC:'', aceroRigC:'A36', electrodo:'E70XX', cons:[] };
}
// Viga que llega con cada conexión: perfil, momento, cortante y axial
function vigaDe(c){
  let vg = null;
  if(c.tipo === 'soldada' && c.miembro === 'H') vg = { nom:`Tubo ${c.H}×${c.B}×${c.tt}`, d:+c.H, bf:+c.B, tw:+c.tt, tf:+c.tt, r:0 };
  else vg = perfil(c.viga);
  const mom = MOMENTO.includes(c.tipo);
  return { vg, mom, M:mom ? Math.abs(+c.Mu || 0) : 0, V:Math.abs(+c.Vu || 0), P:mom ? Math.abs(+c.P || 0) : 0 };
}
function calcNudo(n, lista){
  const ch = [], av = [], pasos = [], req = [], add = addF(ch), E = 200000;
  const cl = perfil(n.columna), ac = ACEROS[n.aceroCol];
  if(!cl) return { error:'Escoja el perfil de la columna del nudo.' };
  if(!lista.length) return { error:'Agregue las conexiones que llegan a esta columna (botón «＋ Agregar conexión al nudo»).' };
  const Pcol = (G.PERFILES_LAM || []).find(x => x[0] === n.columna), Acol = Pcol ? Pcol[7] : cl.d * cl.tw + 2 * cl.bf * cl.tf;
  const kc = cl.tf + cl.r, hcw = cl.d - 2 * kc, tope = !!n.colTope, ar = ACEROS[n.aceroRigC] || ACEROS.A36, FEXX = ELECTRODOS[n.electrodo] || 483;
  const wMin = tt => tt <= 6 ? 3 : tt <= 13 ? 5 : tt <= 19 ? 6 : 8;
  pasos.push(`Columna ${cl.nom} (${n.aceroCol}): d = ${cl.d}, bf = ${cl.bf}, tw = ${cl.tw}, tf = ${cl.tf}, k = tf + r = ${r1(kc)}, h = d − 2k = ${r1(hcw)} mm; Fy = ${ac.Fy}, Fu = ${ac.Fu} MPa.`);
  // Vigas por cara
  const V = lista.map(({ c, cara }) => { const v = vigaDe(c); return { c, cara, ...v, F: v.mom && v.vg ? v.M * 1000 / (v.vg.d - v.vg.tf) + v.P / 2 : 0 }; });
  V.forEach(v => { if(!v.vg) av.push(`${v.c.nom}: no se encontró el perfil de la viga.`);
    if(!MOMENTO.includes(v.c.tipo) && !CORTANTE.includes(v.c.tipo)) req.push([`${v.c.nom}: tipo de conexión que llega a una columna`, false, 'Empalmes, cartelas, grupos y placas base no van en un nudo']);
    else pasos.push(`${v.c.nom} en ${CARAS[v.cara].toLowerCase()}: ${v.vg ? v.vg.nom : '—'}; ${v.mom ? `M = ${r2(v.M)} kN·m, P = ${r2(v.P)} kN → fuerza en cada ala F = M/(d − tf) + P/2 = ${r2(v.F)} kN` : `solo cortante V = ${r2(v.V)} kN`}.`); });
  const en = cara => V.filter(v => v.cara === cara && v.vg);
  Object.keys(CARAS).forEach(k => { if(en(k).length > 1) av.push(`${CARAS[k]}: hay ${en(k).length} conexiones en la misma cara; revise que no choquen (alturas distintas).`); });
  const momF = k => en(k).filter(v => v.mom), Fcara = k => Math.max(0, ...momF(k).map(v => v.F));
  const F1 = Fcara('ala1'), F2 = Fcara('ala2'), W1 = Fcara('alma1'), W2 = Fcara('alma2');
  const hayFuerte = F1 > 0 || F2 > 0, hayDebil = W1 > 0 || W2 > 0;
  const opuesto = n.sentido !== 'mismo', opW = n.sentidoW !== 'mismo';

  // Coherencia de cada conexión con la columna del nudo
  V.forEach(v => { const c = v.c, ala = v.cara.startsWith('ala');
    if(MOMENTO.includes(c.tipo) && ala){
      if(c.tipo === 'soldada' && c.soporte === 'placa') req.push([`${c.nom}: se suelda al ala de la columna`, false, 'en la conexión está «a una placa»']);
      else req.push([`${c.nom}: revisa la misma columna (${n.columna}, ${n.aceroCol})`, c.columna === n.columna && c.aceroCol === n.aceroCol, c.columna ? `${c.columna} · ${c.aceroCol}` : 'la conexión no revisa la columna']);
      if(c.tipo !== 'soldada'){ const otro = momF(v.cara === 'ala1' ? 'ala2' : 'ala1')[0];
        if(otro) req.push([`${c.nom}: tiene en cuenta la viga del otro lado (${otro.c.nom})`, !!c.dosLados && Math.abs((+c.Mu2 || 0) - otro.M) < 0.01 && (c.sentido2 || 'opuesto') === n.sentido, c.dosLados ? `M₂ = ${c.Mu2} kN·m, ${c.sentido2}` : 'sin viga al otro lado']); }
    }
    if(MOMENTO.includes(c.tipo) && !ala){
      if(c.tipo === 'soldada') req.push([`${c.nom}: alas soldadas a las placas de continuidad`, c.soporte === 'placa', c.soporte === 'placa' ? `placa t ${c.tSop} mm` : 'en la conexión está «al ala de una columna»']);
      else av.push(`${c.nom} es una chapa de testa contra el alma de la columna: el alma tendría que resistir la flexión de los pernos (no se revisa). Lo usual en el eje débil es soldar las alas de la viga a las placas de continuidad prolongadas 50–75 mm fuera de las alas de la columna.`);
    }
    if(CORTANTE.includes(c.tipo)){ const t = ala ? cl.tf : cl.tw;
      if(c.soporte && c.soporte !== (ala ? 'ala' : 'alma')) req.push([`${c.nom}: soporte = ${ala ? 'ala' : 'alma'} de la columna`, false, `en la conexión: ${c.soporte}`]);
      req.push([`${c.nom}: espesor del soporte = ${ala ? 'tf' : 'tw'} de la columna`, Math.abs(+c.tSop - t) < 0.05 && c.aceroSop === n.aceroCol, `${c.tSop} mm ${c.aceroSop} (columna ${t} mm ${n.aceroCol})`]);
      const opu = !ala && en(v.cara === 'alma1' ? 'alma2' : 'alma1').some(o => !o.mom);
      if(opu && c.tipo !== 'asiento') req.push([`${c.nom}: marcada «otra conexión al otro lado del alma»`, !!c.dosLados, 'el alma recibe las dos vigas en el mismo sitio']);
      if(opu && c.tipo === 'asiento') av.push(`${c.nom}: hay otra viga al otro lado del alma; el asiento no revisa el alma con las dos reacciones.`);
    }
  });

  // Placas de continuidad (rigidizadores) de la columna
  const Ab = vv => vv.vg.tf;   // N = espesor del ala de la viga (conservador; sin contar soldaduras ni placa de testa)
  let Rst = 0;
  const locales = [];
  ['ala1', 'ala2'].forEach(k => momF(k).forEach(v => { const N = Ab(v), F = v.F, mitad = tope ? 0.5 : 1;
    const Rly = 1.0 * ac.Fy * cl.tw * ((tope ? 2.5 : 5) * kc + N) / 1000;
    const Rcr = 0.75 * (tope ? 0.40 : 0.80) * cl.tw ** 2 * (1 + 3 * (N / cl.d) * (cl.tw / cl.tf) ** 1.5) * Math.sqrt(E * ac.Fy * cl.tf / cl.tw) / 1000;
    const Rfb = v.c.tipo === 'soldada' ? 0.9 * 6.25 * ac.Fy * cl.tf ** 2 / 1000 * mitad : Infinity;
    locales.push({ v, N, F, Rly, Rcr, Rfb }); Rst = Math.max(Rst, F - Rly, F - Rcr, F - Rfb); }));
  const Rpb = opuesto && F1 > 0 && F2 > 0 ? 0.9 * 24 * cl.tw ** 3 * Math.sqrt(E * ac.Fy) / hcw / 1000 * (tope ? 0.5 : 1) : Infinity;
  if(isFinite(Rpb)) Rst = Math.max(Rst, Math.min(F1, F2) - Rpb);
  const pide = hayDebil || Rst > 0;
  const usar = n.rigCol === 'si' || (n.rigCol === 'auto' && pide);
  if(hayDebil && n.rigCol === 'no') req.push(['Placas de continuidad para las vigas a momento del eje débil', false, 'son obligatorias: escoja «Automático» o «Sí»']);
  if(!usar && Rst > 0) av.push(`Las alas de la viga piden rigidizadores en la columna (faltan ${r2(Rst)} kN); escoja «Automático» o «Sí» en placas de continuidad.`);
  const clip = Math.max(cl.r, 15), bs = (cl.bf - cl.tw) / 2, Lf = bs - clip, Lw = cl.d - 2 * cl.tf - 2 * clip;
  const tfV = Math.max(0, ...V.filter(v => v.mom && v.vg).map(v => v.vg.tf));
  const vDeb = [...momF('alma1'), ...momF('alma2')];
  let ts = 0, ws = 0;
  if(usar){
    // espesor: ≥ tf de las vigas que llegan (J10.8 y práctica), y que resista la fuerza que le toca
    const tReq = Math.max(tfV / (hayDebil ? 1 : 2), ...vDeb.map(v => v.F * 1000 / (0.9 * ar.Fy * Math.min(v.vg.bf, cl.d - 2 * cl.tf))),
      Rst > 0 ? Rst * 1000 / (0.9 * ar.Fy * 2 * Lf) : 0, bs / (0.56 * Math.sqrt(E / ar.Fy)));
    ts = +n.tsC > 0 ? +n.tsC : (ESP_PL.find(t => t >= tReq - 1e-6) || 38.1);
    const Fpl = Math.max(W1, W2, Rst);
    const capW = w => fw2(FEXX, w) * 4 * Lf;
    ws = +n.wsC > 0 ? +n.wsC : ([5, 6, 8, 10, 12, 14, 16].find(w => w >= wMin(Math.min(ts, cl.tf)) && capW(w) >= Fpl) || 16);
    pasos.push(`Placas de continuidad (un par a la altura de cada ala de las vigas): ancho por lado bs = (bf − tw)/2 = ${r1(bs)} mm, despunte ${r1(clip)} mm, largo junto al ala Lf = ${r1(Lf)} mm, junto al alma ${r1(Lw)} mm; ts = ${ts} mm (${n.aceroRigC}${+n.tsC > 0 ? ', escrito' : ', automático'}), filetes ${ws} mm ${n.electrodo}${+n.wsC > 0 ? '' : ' (automático)'}.`);
    req.push(['Placas: ts ≥ tf de las vigas a momento', ts >= tfV / (hayDebil ? 1 : 2) - 1e-6, `${ts} ≥ ${r1(tfV / (hayDebil ? 1 : 2))} mm${hayDebil ? '' : ' (tf/2, J10.8)'}`]);
    req.push(['Placas: bs/ts ≤ 0.56√(E/Fy) (J10.8)', bs / ts <= 0.56 * Math.sqrt(E / ar.Fy), `${r1(bs / ts)} ≤ ${r1(0.56 * Math.sqrt(E / ar.Fy))}`]);
    req.push(['Placas: filete ≥ mínimo Tabla J2.4', ws >= wMin(Math.min(ts, cl.tf)), `${ws} ≥ ${wMin(Math.min(ts, cl.tf))} mm`]);
    if(Fpl > 0) add('placas', 'Filetes de la placa a las dos alas de la columna', 'F.2.10.2.4 (J2-4), φ = 0.75', Fpl, capW(ws), 'kN', `2 alas × 2 filetes × Lf ${r1(Lf)} mm · ${ws} mm (fuerza paralela al cordón)`);
    if(Rst > 0) add('placas', 'Compresión / tensión de las placas (eje fuerte)', 'F.2.10.10.8 (J10.8), φ = 0.90', Rst, 0.9 * ar.Fy * 2 * (bs - clip) * ts / 1000, 'kN', `0.9·Fy·2·(bs − despunte)·ts; faltante de las cargas concentradas ${r2(Rst)} kN`);
  }
  const capPl = usar ? 0.9 * ar.Fy * 2 * (bs - clip) * ts / 1000 : 0;

  // Cargas concentradas de cada viga del eje fuerte
  locales.forEach(({ v, N, F, Rly, Rcr, Rfb }) => {
    pasos.push(`${v.c.nom}: N = tf de la viga = ${r1(N)} mm; J10-2 φRn = ${r2(Rly)}, J10-3 φRn = ${r2(Rcr)}${isFinite(Rfb) ? `, J10-1 φRn = ${r2(Rfb)}` : ''} kN${usar ? ` + placas ${r2(capPl)} kN` : ''}.`);
    add('columna', `${v.c.nom}: fluencia local del alma`, `F.2.10.10.2 (J10-2${tope ? ', J10-3' : ''}), φ = 1.00`, F, Rly + capPl, 'kN', `Fy·tw·(${tope ? '2.5' : '5'}k + N)${usar ? ' + placas' : ''}`);
    add('columna', `${v.c.nom}: aplastamiento del alma (crippling)`, `F.2.10.10.3 (J10-4${tope ? ', J10-5' : ''}), φ = 0.75`, F, Rcr + capPl, 'kN', usar ? 'con placas' : 'sin placas');
    if(isFinite(Rfb)) add('columna', `${v.c.nom}: flexión local del ala`, 'F.2.10.10.1 (J10-1), φ = 0.90', F, Rfb + capPl, 'kN', `6.25·Fy·tf²${tope ? ' × 0.5' : ''}`);
  });
  if(isFinite(Rpb)){ pasos.push(`Dos vigas en las alas con momentos opuestos (gravedad): las alas en compresión aprietan el alma desde los dos lados → J10-8: φRn = 0.9·24·tw³·√(E·Fy)/h = ${r2(Rpb)} kN.`);
    add('columna', 'Pandeo del alma por las dos alas', 'F.2.10.10.5 (J10-8), φ = 0.90', Math.min(F1, F2), Rpb + capPl, 'kN', `24·tw³·√(E·Fy)/h${usar ? ' + placas' : ''}`); }

  // Zona de panel (eje fuerte)
  if(hayFuerte){
    const dosF = F1 > 0 && F2 > 0, Vbr = !dosF ? Math.max(F1, F2) : opuesto ? Math.abs(F1 - F2) : F1 + F2, Vp = Math.max(0, Vbr - Math.abs(+n.Vc || 0));
    const Py = ac.Fy * Acol / 1000, Pr = Math.abs(+n.Pc || 0), base = 0.9 * 0.6 * ac.Fy * cl.d * cl.tw / 1000;
    const Rv = Pr <= 0.4 * Py ? base : base * (1.4 - Pr / Py);
    pasos.push(`Zona de panel: ${!dosF ? 'una viga a momento en las alas: Vu = F' : opuesto ? 'momentos opuestos (gravedad): Vu = |F₁ − F₂|' : 'momentos en el mismo sentido (sismo o viento): Vu = F₁ + F₂'} = ${r2(Vbr)} kN${+n.Vc ? ` − cortante de la columna ${r2(Math.abs(+n.Vc))} kN = ${r2(Vp)} kN` : ''}; Pr = ${r2(Pr)} kN, Py = ${r2(Py)} kN → ${Pr <= 0.4 * Py ? 'J10-11' : 'J10-12'}: φRv = ${r2(Rv)} kN.`);
    add('panel', 'Zona de panel del eje fuerte (cortante del alma)', `F.2.10.10.6 (${Pr <= 0.4 * Py ? 'J10-11' : 'J10-12'}), φ = 0.90`, Vp, Rv, 'kN', !dosF ? 'F de la viga' : opuesto ? '|F₁ − F₂|' : 'F₁ + F₂');
    if(Vp > Rv){ const tdq = Vp / (Rv / cl.tw) - cl.tw, td = ESP_PL.find(t => t >= Math.max(tdq, (cl.d - 2 * cl.tf) / 90) - 1e-6) || 38.1;
      av.push(`La zona de panel no alcanza (${r2(Vp)} > ${r2(Rv)} kN): agregue una placa de refuerzo del alma (doubler) de ${td} mm (${n.aceroCol}) soldada al alma y a las alas, o use una columna con alma más gruesa.`); }
    if(F1 > 0 && F2 > 0){ const d1 = momF('ala1')[0].vg.d, d2 = momF('ala2')[0].vg.d;
      if(Math.abs(d1 - d2) > 1) av.push(`Las vigas de las dos alas tienen alturas distintas (${d1} y ${d2} mm): las alas no quedan alineadas; ponga placas de continuidad a cada nivel o iguale la altura con una cartela.`); }
  }

  // Eje débil: vigas a momento contra el alma
  if(hayDebil){
    vDeb.forEach(v => { const b = Math.min(v.vg.bf, cl.d - 2 * cl.tf);
      req.push([`${v.c.nom}: el ala de la viga cabe entre las alas de la columna`, v.vg.bf <= cl.d - 2 * cl.tf, `bf ${v.vg.bf} ≤ d − 2tf = ${r1(cl.d - 2 * cl.tf)} mm`]);
      add('placas', `${v.c.nom}: placa de continuidad a tensión`, 'F.2.4 (D2-1), φ = 0.90', v.F, 0.9 * ar.Fy * b * ts / 1000, 'kN', `0.9·Fy·b·ts, b = ${r1(b)} mm`); });
    const dosW = W1 > 0 && W2 > 0, Vw = !dosW ? Math.max(W1, W2) : opW ? Math.abs(W1 - W2) : W1 + W2;
    const Rvf = 0.9 * 0.6 * ac.Fy * 2 * cl.bf * cl.tf / 1000;
    pasos.push(`Eje débil: las alas de la viga entregan F a las placas y estas a las alas de la columna; las dos alas trabajan a cortante en su plano: Vu = ${!dosW ? 'F' : opW ? '|F₁ − F₂|' : 'F₁ + F₂'} = ${r2(Vw)} kN; φVn = 0.9·0.6·Fy·2·bf·tf = ${r2(Rvf)} kN.`);
    add('panel', 'Zona de panel del eje débil (cortante de las dos alas)', 'F.2.7.6 (G7), φ = 0.90', Vw, Rvf, 'kN', !dosW ? 'F de la viga' : opW ? '|F₁ − F₂|' : 'F₁ + F₂');
    if(dosW && opW) av.push('Vigas a momento a los dos lados del alma con momentos opuestos: la parte que se equilibra pasa por el espesor del alma; suelde las placas al alma con penetración completa y revise el desgarre laminar del alma.');
    av.push('Prolongue las placas de continuidad 50–75 mm fuera de las alas de la columna para recibir las alas de la viga del eje débil (soldadura de penetración completa).');
    if(hayFuerte){ const dF = Math.max(...[...momF('ala1'), ...momF('ala2')].map(v => v.vg.d)), dW = Math.max(...vDeb.map(v => v.vg.d));
      if(Math.abs(dF - dW) > 1) av.push(`Las vigas del eje fuerte (${dF} mm) y del eje débil (${dW} mm) tienen alturas distintas: se necesitan placas de continuidad a cada nivel.`); }
  }
  // Dos vigas a cortante a los dos lados del alma
  const sCort = k => en(k).filter(v => !v.mom);
  if(sCort('alma1').length && sCort('alma2').length) pasos.push('Vigas a cortante a los dos lados del alma: el alma recibe las dos reacciones en el mismo sitio; por eso cada conexión debe tener marcada «otra conexión al otro lado» (pernos que comparten el alma o soldaduras sobre el mismo espesor).');
  av.push('El diseño de la columna como miembro (flexocompresión con los momentos de todas las vigas) va en el Anexo D del generador de memorias.');

  // Resultado de cada conexión (para el resumen)
  const cons = V.map(v => { const r = Conex.calc(v.c); return { nom:v.c.nom, cara:v.cara, tipo:v.c.tipo, ok:!r.error && r.ok, max:r.error ? null : r.max }; });
  cons.filter(x => x.max != null && !x.ok).forEach(x => av.push(`La conexión ${x.nom} no cumple por sí sola (relación ${r2(x.max)}).`));
  const max = ch.reduce((m, x) => Math.max(m, x.ratio), 0);
  return { ok:max <= 1 && !req.some(r => !r[1]) && cons.every(x => x.max == null || x.ok), max, ch, req, av, pasos,
    geo:{ cl, V, usar, ts, ws, bs, clip, F1, F2, W1, W2 }, cons };
}
// «Ajustar las conexiones al nudo»: copia la columna, el soporte y la viga del otro lado a cada conexión
function ajustarNudo(n, lista){
  const cl = perfil(n.columna); if(!cl) return 0; let k = 0;
  const r = calcNudo(n, lista), ts = r.geo?.ts || 0;
  lista.forEach(({ c, cara }) => { const ala = cara.startsWith('ala'), set = (key, val) => { if(c[key] !== val){ c[key] = val; k++; } };
    if(MOMENTO.includes(c.tipo) && ala){
      if(c.tipo === 'soldada') set('soporte', 'col');
      set('columna', n.columna); set('aceroCol', n.aceroCol); set('colTope', !!n.colTope);
      if(c.tipo !== 'soldada'){ const otro = lista.find(o => o.cara === (cara === 'ala1' ? 'ala2' : 'ala1') && MOMENTO.includes(o.c.tipo));
        if(otro){ set('dosLados', true); set('Mu2', Math.abs(+otro.c.Mu || 0)); set('sentido2', n.sentido); } else set('dosLados', false); }
    }
    if(c.tipo === 'soldada' && !ala && ts){ set('soporte', 'placa'); set('tSop', ts); set('aceroSop', n.aceroRigC); }
    if(CORTANTE.includes(c.tipo)){
      if('soporte' in c || c.tipo === 'angular' || c.tipo === 'aleta') set('soporte', ala ? 'ala' : 'alma');
      set('tSop', ala ? cl.tf : cl.tw); set('aceroSop', n.aceroCol);
      if(c.tipo !== 'asiento'){ const opu = !ala && lista.some(o => o.cara === (cara === 'alma1' ? 'alma2' : 'alma1') && CORTANTE.includes(o.c.tipo)); set('dosLados', opu); }
    }
  });
  return k;
}
const CALC = { aleta:calcAleta, grupo:calcGrupo, testa:calcTesta, ras:calcTesta, angular:calcAngular, testaV:calcTestaV, asiento:calcAsiento, empalme:calcEmpalme, cartela:calcCartela, base:calcBase, soldada:calcSoldada, empZ:calcEmpZ };
const DEF = { aleta:defaultsAleta, grupo:defaultsGrupo, testa:defaultsTesta, ras:defaultsRas, angular:defaultsAngular, testaV:defaultsTestaV, asiento:defaultsAsiento, empalme:defaultsEmpalme, cartela:defaultsCartela, base:defaultsBase, soldada:defaultsSoldada, empZ:defaultsEmpZ };
const Conex = { ACEROS, PERNOS, DIAM, ELECTRODOS, BORDE_MIN, BORDE_CIZ, bordeMin, agujero, icr, elastico, pernoCorte, aplast, perfil,
  calc: c => { CIZ = !!c.cizalla; const r = (CALC[c.tipo] || calcAleta)(c); if(!r.error && c.cizalla) r.pasos.unshift('Bordes cortados con cizalla: distancias mínimas al borde de la columna «cizalla» de la Tabla F.2.10.3-4 (J3.4).');
    if(r.error || !EXTRA[c.tipo]) return r;
    EXTRA[c.tipo](c, r, addF(r.ch), r.av); r.max = r.ch.reduce((m, x) => Math.max(m, x.ratio), 0); r.ok = r.max <= 1 && !r.req.some(q => !q[1]); return r; },
  defaults: t => (DEF[t] || defaultsAleta)(),
  CARAS, nudo:calcNudo, defaultsNudo, ajustarNudo, vigaDe };
G.Conex = Conex;
if(typeof module !== 'undefined') module.exports = Conex;
})(typeof window !== 'undefined' ? window : globalThis);
