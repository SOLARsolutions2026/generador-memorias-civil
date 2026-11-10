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
const bordeMin = d => BORDE_MIN[d] ?? Math.ceil(1.25 * d);

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
  add('pernos', 'Pernos con excentricidad (centro instantáneo)', 'F.2.10.3 · Manual AISC parte 7', V, ic.C * rn, 'kN', `C = ${r2(ic.C)} · φrn = ${r2(rn)} kN (${cual})`);

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
    soldAla:'filete', wAla:8, wAlma:8, electrodo:'E70XX' };
}
function calcTesta(c){
  const ch = [], av = [], pasos = [], req = [];
  const Mu = Math.abs(+c.Mu || 0), Vu = Math.abs(+c.Vu || 0), d = +c.d, tp = +c.tp, bp = +c.bp, g = +c.g, pfo = +c.pfo, pfi = +c.pfi, de = +c.de;
  const vg = perfil(c.viga); if(!vg) return { error:'Escoja el perfil de la viga.' };
  const cl = c.columna ? perfil(c.columna) : null;
  const pl = ACEROS[c.aceroPl], av_ = ACEROS[c.aceroViga], ac = ACEROS[c.aceroCol], FEXX = ELECTRODOS[c.electrodo], B = PERNOS[c.grado];
  const add = (grupo, nombre, ref, dem, cap, ud, extra) => ch.push({ grupo, nombre, ref, dem, cap, ud, ratio: cap > 0 ? dem / cap : Infinity, extra });
  const dh = agujero(d), dn = anchoNeto(d), bm = bordeMin(d), Ab = Math.PI * d * d / 4;
  const db = vg.d, tbf = vg.tf, bbf = vg.bf, tbw = vg.tw;
  const h0 = db - tbf / 2 + pfo, h1 = db - 1.5 * tbf - pfi;          // brazos desde el centro del ala en compresión
  const Ffu = Mu * 1000 / (db - tbf);                                   // fuerza en el ala [kN]
  pasos.push(`Viga ${vg.nom}: d = ${db}, bf = ${bbf}, tf = ${tbf}, tw = ${tbw} mm · Mu = ${r2(Mu)} kN·m, Vu = ${r2(Vu)} kN`);
  pasos.push(`h₀ = d − tf/2 + pfo = ${r1(h0)} mm; h₁ = d − 1.5tf − pfi = ${r1(h1)} mm; Ffu = Mu/(d − tf) = ${r2(Ffu)} kN`);

  // Requisitos de geometría
  req.push(['Ancho de la placa bp ≤ bf + 25 mm (Guía 4)', bp <= bbf + 25 + 1e-6, `${bp} ≤ ${bbf + 25} mm`]);
  req.push(['Ancho de la placa bp ≥ bf de la viga', bp >= bbf - 1e-6, `${bp} ≥ ${bbf} mm`]);
  req.push(['Gramil g ≥ 3d (llave) y g ≤ bp − 2·borde mín.', g >= 3 * d - 1e-6 && g <= bp - 2 * bm + 1e-6, `${r1(3 * d)} ≤ ${g} ≤ ${bp - 2 * bm} mm`]);
  req.push(['pfo, pfi ≥ d + 12.7 mm (espacio para apretar)', Math.min(pfo, pfi) >= d + 12.7 - 1e-6, `${Math.min(pfo, pfi)} ≥ ${r1(d + 12.7)} mm`]);
  req.push(['Borde de la extensión de ≥ mín. Tabla F.2.10.3-4', de >= bm, `${de} ≥ ${bm} mm`]);
  req.push(['Borde lateral (bp − g)/2 ≥ mín.', (bp - g) / 2 >= bm, `${r1((bp - g) / 2)} ≥ ${bm} mm`]);
  if(cl) req.push(['Gramil cabe en el ala de la columna: (bfc − g)/2 ≥ borde mín.', (cl.bf - g) / 2 >= bm, `${r1((cl.bf - g) / 2)} ≥ ${bm} mm`]);
  req.push(['Pernos pretensionados (F.2.10.3.1, conexión a momento)', true, 'indicar en planos']);
  req.filter(r => !r[1]).forEach(r => av.push(`${r[0]}: ${r[2]}`));

  // 1. Pernos a tensión sin palanca: φMnp = φ·2·Pt·(h0 + h1)
  const Pt = B.Fnt * Ab / 1000, phiMnp = 0.75 * 2 * Pt * (h0 + h1) / 1000;
  pasos.push(`Pernos: Ab = ${r1(Ab)} mm², Pt = Fnt·Ab = ${B.Fnt}·${r1(Ab)} = ${r2(Pt)} kN; φMnp = 0.75·2·Pt·(h₀ + h₁) = ${r2(phiMnp)} kN·m`);
  add('pernos', 'Rotura de los pernos a tensión (sin palanca)', 'F.2.10.3.6 (J3-1) · Guía AISC 4', Mu, phiMnp, 'kN·m', `Pt = ${r2(Pt)} kN, h₀ = ${r1(h0)}, h₁ = ${r1(h1)} mm`);
  // 2. Pernos a cortante en la zona de compresión
  const nb = c.ambos ? 4 : Math.max(0, Math.round(+c.nbc || 0));
  const rv = 0.75 * B[c.rosca === 'X' ? 'X' : 'N'] * Ab / 1000;
  const bPl = aplast(de - dh / 2, tp, d, pl.Fu).phiRn, bPlI = 2.4 * d * tp * pl.Fu * 0.75 / 1000;
  const bCol = cl ? 0.75 * 2.4 * d * cl.tf * ac.Fu / 1000 : Infinity;
  const rb = Math.min(rv, c.ambos ? Math.min(bPl, bPlI) : bPlI, bCol);
  add('pernos', `Cortante en los ${nb} pernos de la zona de compresión`, 'F.2.10.3.6 y F.2.10.3.10 (J3-1, J3-6)', Vu, nb * rb, 'kN', `φrn = ${r2(rb)} kN por perno (corte ${r2(rv)}, aplastamiento placa ${r2(Math.min(bPl, bPlI))}${cl ? `, ala columna ${r2(bCol)}` : ''})`);
  if(!nb) av.push('No hay pernos en la zona de compresión para tomar el cortante.');

  // 3. Placa: líneas de fluencia (placa gruesa: φb·Mpl ≥ 1.11·φMnp)
  const sP = 0.5 * Math.sqrt(bp * g), pfiY = Math.min(pfi, sP);
  const Yp = bp / 2 * (h1 * (1 / pfiY + 1 / sP) + h0 / pfo - 0.5) + 2 / g * (h1 * (pfiY + sP));
  const phiMpl = 0.9 * pl.Fy * tp * tp * Yp / 1e6, tpReq = Math.sqrt(1.11 * phiMnp * 1e6 / (0.9 * pl.Fy * Yp));
  pasos.push(`Placa: s = ½√(bp·g) = ${r1(sP)} mm${pfi > sP ? ` (pfi se limita a s)` : ''}; Yp = ${Math.round(Yp)} mm; φMpl = 0.9·Fy·tp²·Yp = ${r2(phiMpl)} kN·m`);
  pasos.push(`Espesor para comportamiento de placa gruesa: tp,req = √(1.11·φMnp/(0.9·Fy·Yp)) = ${r1(tpReq)} mm`);
  add('placa', 'Placa gruesa: flexión por líneas de fluencia', 'Guía AISC 4/16 · φb = 0.90', 1.11 * phiMnp, phiMpl, 'kN·m', `exige 1.11·φMnp; tp,req = ${r1(tpReq)} mm`);
  add('placa', 'Fluencia por cortante de la extensión', 'F.2.10.4.2 (J4-3)', Ffu / 2, 1.0 * 0.6 * pl.Fy * bp * tp / 1000, 'kN', `Ffu/2; Agv = bp·tp = ${r1(bp * tp)} mm²`);
  const An = (bp - 2 * dn) * tp;
  add('placa', 'Rotura por cortante de la extensión', 'F.2.10.4.2 (J4-4)', Ffu / 2, 0.75 * 0.6 * pl.Fu * An / 1000, 'kN', `Anv = (bp − 2·${r1(dn)})·tp = ${r1(An)} mm²`);

  // 4. Soldaduras
  const fw = w => 0.75 * 0.6 * FEXX * 0.707 * w / 1000;                // kN/mm, F.2.10.2.4 (J2-4)
  if(c.soldAla === 'cjp') pasos.push('Alas: soldadura de penetración completa (resistencia igual a la del ala, F.2.10.2.4 Tabla J2.5)');
  else { const Lw = 2 * bbf - tbw, wA = +c.wAla;
    add('soldadura', 'Filetes ala–placa (transversales, ambas caras)', 'F.2.10.2.4 (J2-4, J2-5: 1.0 + 0.5 sen¹·⁵θ = 1.5)', Ffu, 1.5 * fw(wA) * Lw, 'kN', `w = ${wA} mm, L = 2bf − tw = ${r1(Lw)} mm`);
    req.push(['Filete del ala ≥ mín. Tabla J2.4', wA >= (Math.max(tp, tbf) > 19 ? 8 : Math.max(tp, tbf) > 12.7 ? 6 : 5), `${wA} mm`]); }
  const wW = +c.wAlma;
  add('soldadura', 'Alma–placa cerca de los pernos en tensión (desarrolla Fy del alma)', 'Guía AISC 4 · F.2.10.2.4', 0.9 * av_.Fy * tbw / 1000, 2 * fw(wW), 'kN/mm', `0.9·Fy·tw contra 2 filetes de ${wW} mm`);
  const LwV = Math.max(0, Math.min(db / 2 - tbf, db - 2 * tbf - pfi - 2 * d));
  add('soldadura', 'Alma–placa a cortante', 'F.2.10.2.4 (J2-4)', Vu, 2 * fw(wW) * LwV, 'kN', `L = mín(d/2 − tf; d − 2tf − pfi − 2d) = ${r1(LwV)} mm por cara`);
  add('viga', 'Cortante del alma de la viga', 'F.2.7.2 (G2-1), φv = 1.0', Vu, 1.0 * 0.6 * av_.Fy * db * tbw / 1000, 'kN', `0.6·Fy·d·tw`);

  // 5. Columna (ala sin rigidizar y alma)
  if(cl){
    const sC = 0.5 * Math.sqrt(cl.bf * g), cc = pfo + pfi + tbf, kc = cl.tf + cl.r;
    const Yc = cl.bf / 2 * (h1 / sC + h0 / sC) + 2 / g * (h1 * (sC + 3 * cc / 4) + h0 * (sC + cc / 4) + cc * cc / 2) + g / 2;
    const phiMcf = 0.9 * ac.Fy * cl.tf * cl.tf * Yc / 1e6, tcfReq = Math.sqrt(1.11 * phiMnp * 1e6 / (0.9 * ac.Fy * Yc));
    pasos.push(`Columna ${cl.nom}: bf = ${cl.bf}, tf = ${cl.tf}, tw = ${cl.tw}, k = tf + r = ${r1(kc)} mm; s = ${r1(sC)}, c = ${r1(cc)} mm; Yc = ${Math.round(Yc)} mm; φMcf = ${r2(phiMcf)} kN·m`);
    add('columna', 'Flexión del ala de la columna (sin rigidizadores)', 'Guía AISC 4/16 · φb = 0.90', Mu, phiMcf, 'kN·m', `Yc = ${Math.round(Yc)} mm; tcf para placa gruesa = ${r1(tcfReq)} mm`);
    if(cl.tf < tcfReq) av.push(`El ala de la columna (${cl.tf} mm) es más delgada que ${r1(tcfReq)} mm: habrá algo de palanca en los pernos. Considere rigidizadores o una columna de ala más gruesa.`);
    const N = tbf + 2 * (c.soldAla === 'cjp' ? 0 : +c.wAla);
    const ly = c.colTope ? 2.5 * kc + N + 2 * tp : 6 * kc + N + 2 * tp;
    add('columna', 'Fluencia local del alma (compresión)', `F.2.10.10.2 (J10-${c.colTope ? 3 : 2})`, Ffu, 1.0 * ac.Fy * cl.tw * ly / 1000, 'kN', `L = ${c.colTope ? '2.5' : '6'}k + N + 2tp = ${r1(ly)} mm`);
    const dc = cl.d, lN = N + 2 * tp;
    const crip = c.colTope && lN / dc > 0.2
      ? 0.4 * cl.tw * cl.tw * (1 + (4 * lN / dc - 0.2) * Math.pow(cl.tw / cl.tf, 1.5)) * Math.sqrt(200000 * ac.Fy * cl.tf / cl.tw)
      : (c.colTope ? 0.4 : 0.8) * cl.tw * cl.tw * (1 + 3 * (lN / dc) * Math.pow(cl.tw / cl.tf, 1.5)) * Math.sqrt(200000 * ac.Fy * cl.tf / cl.tw);
    add('columna', 'Aplastamiento del alma (compresión)', 'F.2.10.10.3 (J10-4/5)', Ffu, 0.75 * crip / 1000, 'kN', `lb = N + 2tp = ${r1(lN)} mm`);
    const lt = (c.colTope ? 3 : 6) * kc + cc;
    add('columna', 'Fluencia local del alma (tensión)', 'Guía AISC 4 · F.2.10.10.2', Ffu, 1.0 * ac.Fy * cl.tw * lt / 1000, 'kN', `L = ${c.colTope ? '3' : '6'}k + c = ${r1(lt)} mm`);
    add('columna', 'Zona de panel (cortante del alma)', 'F.2.10.10.6 (J10-9), φ = 0.90', Ffu, 0.9 * 0.6 * ac.Fy * dc * cl.tw / 1000, 'kN', `0.6·Fy·dc·tw (sin cortante de la columna)`);
  } else av.push('No se revisó la columna: escoja su perfil para revisar el ala y el alma.');

  const max = ch.reduce((m, x) => Math.max(m, x.ratio), 0);
  const Hp = c.ambos ? db + 2 * (pfo + de) : db + pfo + de + 25;
  return { ok:max <= 1 && !req.some(r => !r[1]), max, ch, req, av, pasos, geo:{ vg, cl, Hp, h0, h1, dh, nTot: c.ambos ? 8 : 4 + nb } };
}

// ── Doble angular de alma (atornillado a la viga y al soporte) — Manual AISC parte 10, fórmulas NSR-10 F.2.10 ─────────────
function defaultsAngular(){
  return { tipo:'angular', nom:'', desc:'', Vu:80,
    viga:'IPE 300', aceroViga:'A572 Gr 50', holgura:13,
    soporte:'ala', tSop:10.7, aceroSop:'A572 Gr 50', dosLados:false,
    bAng:89, tAng:7.9, aceroAng:'A36', n:3, s:75, Lev:38, g1:51, g2:51,
    d:19.1, grado:'A325', rosca:'N' };
}
function calcAngular(c){
  const ch = [], av = [], pasos = [], req = [];
  const V = Math.abs(+c.Vu || 0), d = +c.d, n = Math.max(1, Math.round(+c.n || 1)), s = +c.s, Lev = +c.Lev, b = +c.bAng, t = +c.tAng, g1 = +c.g1, g2 = +c.g2, hol = +c.holgura || 0;
  const vg = perfil(c.viga); if(!vg) return { error:'Escoja el perfil de la viga.' };
  const an = ACEROS[c.aceroAng], av_ = ACEROS[c.aceroViga], sp = ACEROS[c.aceroSop], B = PERNOS[c.grado];
  const add = (grupo, nombre, ref, dem, cap, ud, extra) => ch.push({ grupo, nombre, ref, dem, cap, ud, ratio: cap > 0 ? dem / cap : Infinity, extra });
  const dh = agujero(d), dn = anchoNeto(d), bm = bordeMin(d), Ab = Math.PI * d * d / 4, L = (n - 1) * s + 2 * Lev;
  const LehA = b - Math.max(g1, g2), LehV = g1 - hol;
  pasos.push(`Viga ${vg.nom}: d = ${vg.d}, tw = ${vg.tw}, T = ${r1(vg.T)} mm · Vu = ${r2(V)} kN`);
  pasos.push(`Angulares 2L ${b}×${b}×${t} mm (${c.aceroAng}), largo L = (n − 1)·s + 2·Lev = ${r1(L)} mm; ${n} pernos en el alma (doble cortante) y ${2 * n} en el soporte (cortante simple)`);
  req.push(['Largo de los angulares L ≥ T/2 (estabilidad)', L >= vg.T / 2 - 1e-6, `${r1(L)} ≥ ${r1(vg.T / 2)} mm`]);
  req.push(['Largo de los angulares L ≤ T (caben entre las alas)', L <= vg.T + 1e-6, `${r1(L)} ≤ ${r1(vg.T)} mm`]);
  req.push(['Separación s ≥ 2.67d (preferible 3d)', s >= 2.67 * d - 1e-6, `${s} ≥ ${r1(2.67 * d)} mm`]);
  req.push(['Borde vertical Lev ≥ mín. Tabla F.2.10.3-4', Lev >= bm, `${Lev} ≥ ${bm} mm`]);
  req.push(['Borde horizontal del angular b − g ≥ mín.', LehA >= bm, `${r1(LehA)} ≥ ${bm} mm`]);
  req.push(['Borde horizontal en la viga g₁ − holgura ≥ mín.', LehV >= bm, `${r1(LehV)} ≥ ${bm} mm`]);
  req.push(['Espacio para apretar: g ≥ d + 12.7 mm', Math.min(g1, g2) >= d + 12.7 - 1e-6, `${Math.min(g1, g2)} ≥ ${r1(d + 12.7)} mm`]);
  req.push(['Angulares flexibles: t ≤ 16 mm (Manual AISC parte 10)', t <= 16, `${t} mm`]);
  req.filter(r => !r[1]).forEach(r => av.push(`${r[0]}: ${r[2]}`));

  // Pernos en el alma de la viga: doble cortante
  const rv = 0.75 * B[c.rosca === 'X' ? 'X' : 'N'] * Ab / 1000;
  const brg = (lc, tt, Fu) => aplast(lc, tt, d, Fu).phiRn;
  const lcE = Lev - dh / 2, lcI = s - dh;
  const angE = brg(lcE, t, an.Fu), angI = brg(lcI, t, an.Fu), web = 0.75 * 2.4 * d * vg.tw * av_.Fu / 1000;
  const rWebE = Math.min(2 * rv, web, 2 * angE), rWebI = Math.min(2 * rv, web, 2 * angI);
  const capWeb = rWebE + (n - 1) * rWebI;
  pasos.push(`Corte de un perno φrn = 0.75·Fnv·Ab = ${r2(rv)} kN; aplastamiento en el angular: borde ${r2(angE)} kN (lc = ${r1(lcE)}), interior ${r2(angI)} kN (lc = ${r1(lcI)}); alma de la viga ${r2(web)} kN`);
  add('pernos', `Pernos en el alma de la viga (${n}, doble cortante)`, 'F.2.10.3.6 y F.2.10.3.10 (J3-1, J3-6)', V, capWeb, 'kN', `por perno: borde ${r2(rWebE)}, interior ${r2(rWebI)} kN`);
  // Pernos en el soporte: cortante simple, 2 por fila
  const sop = 0.75 * 2.4 * d * +c.tSop * sp.Fu / 1000 / (c.dosLados ? 2 : 1);
  const rSE = Math.min(rv, angE, sop), rSI = Math.min(rv, angI, sop), capSop = 2 * (rSE + (n - 1) * rSI);
  add('pernos', `Pernos en el soporte (${2 * n}, cortante simple)`, 'F.2.10.3.6 y F.2.10.3.10 (J3-1, J3-6)', V, capSop, 'kN', `por perno: borde ${r2(rSE)}, interior ${r2(rSI)} kN; soporte ${r2(sop)} kN${c.dosLados ? ' (comparte agujeros)' : ''}`);
  pasos.push('Se desprecia la excentricidad de los pernos (angulares flexibles, Manual AISC parte 10).');

  // Angulares (los dos)
  const Agv = 2 * L * t, Anv = 2 * (L - n * dn) * t;
  add('angulares', 'Fluencia por cortante (2 angulares)', 'F.2.10.4.2 (J4-3)', V, 1.0 * 0.6 * an.Fy * Agv / 1000, 'kN', `Agv = 2·L·t = ${r1(Agv)} mm²`);
  add('angulares', 'Rotura por cortante (2 angulares)', 'F.2.10.4.2 (J4-4)', V, 0.75 * 0.6 * an.Fu * Anv / 1000, 'kN', `Anv = 2·(L − n·${r1(dn)})·t = ${r1(Anv)} mm²`);
  const bloque = Lh => { const agv = (L - Lev) * t, anv = (L - Lev - (n - 0.5) * dn) * t, ant = (Lh - 0.5 * dn) * t;
    return { phiRn: 2 * 0.75 * Math.min(0.6 * an.Fu * anv + an.Fu * ant, 0.6 * an.Fy * agv + an.Fu * ant) / 1000, agv, anv, ant }; };
  const bkW = bloque(b - g1), bkS = bloque(b - g2);
  add('angulares', 'Bloque de cortante, ala sobre la viga (×2)', 'F.2.10.4.3 (J4-5), Ubs = 1.0', V, bkW.phiRn, 'kN', `por angular Agv = ${r1(bkW.agv)}, Anv = ${r1(bkW.anv)}, Ant = ${r1(bkW.ant)} mm²`);
  add('angulares', 'Bloque de cortante, ala sobre el soporte (×2)', 'F.2.10.4.3 (J4-5), Ubs = 1.0', V, bkS.phiRn, 'kN', `por angular Agv = ${r1(bkS.agv)}, Anv = ${r1(bkS.anv)}, Ant = ${r1(bkS.ant)} mm²`);
  // Viga
  add('viga', 'Cortante del alma de la viga', 'F.2.7.2 (G2-1), φv = 1.0', V, 1.0 * 0.6 * av_.Fy * vg.d * vg.tw / 1000, 'kN', '0.6·Fy·d·tw (viga sin destaje)');
  const max = ch.reduce((m, x) => Math.max(m, x.ratio), 0);
  return { ok:max <= 1 && !req.some(r => !r[1]), max, ch, req, av, pasos, geo:{ vg, L, dh, gage:2 * g2 + vg.tw } };
}

const Conex = { ACEROS, PERNOS, DIAM, ELECTRODOS, bordeMin, agujero, icr, elastico, pernoCorte, aplast, perfil,
  defaultsAleta, calcAleta, defaultsGrupo, calcGrupo, defaultsTesta, calcTesta, defaultsAngular, calcAngular,
  calc: c => c.tipo === 'grupo' ? calcGrupo(c) : c.tipo === 'testa' ? calcTesta(c) : c.tipo === 'angular' ? calcAngular(c) : calcAleta(c),
  defaults: t => t === 'grupo' ? defaultsGrupo() : t === 'testa' ? defaultsTesta() : t === 'angular' ? defaultsAngular() : defaultsAleta() };
G.Conex = Conex;
if(typeof module !== 'undefined') module.exports = Conex;
})(typeof window !== 'undefined' ? window : globalThis);
