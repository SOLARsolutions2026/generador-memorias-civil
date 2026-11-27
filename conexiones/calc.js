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
  'A500 Gr B':   { Fy:317, Fu:400 },   // tubos estructurales (perfiles cuadrados/rectangulares)
  'A500 Gr C':   { Fy:345, Fu:427 },
  'A53 Gr B':    { Fy:240, Fu:415 },   // tubo redondo (pipe) — diagonales (24-nov)
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
// Revisión con Amo (22-nov): configuración convencional / extendida (Manual AISC 15.ª ed., parte 10, Tabla 10-9 y ec. 10-3),
// requisitos completos, soldadura de 5/8·tp (el momento solo en la extendida), viga con destaje y 💡.
function defaultsAleta(){
  return { tipo:'aleta', nom:'', desc:'',
    Vu:80, Nu:0,
    viga:'IPE 300', aceroViga:'A572 Gr 50',
    soporte:'ala', tSop:10.7, aceroSop:'A572 Gr 50', dosLados:false,        // ala | alma (de columna) | viga (alma de viga principal)
    n:3, s:75, Lev:38, Leh:38, a:76, holgura:13,
    tp:9.5, aceroPl:'A36',
    d:19.1, grado:'A325', rosca:'N', agujeros:'STD',                       // STD estándar | SSLT ranura corta horizontal (perpendicular a la carga)
    w:6, electrodo:'E70XX',
    destaje:'no', dct:35, dcb:35, cDes:110, LevB:38 };                      // viga con destaje: no | sup | ambos
}
function perfil(nom){
  const P = (G.PERFILES_LAM || []).find(x => x[0] === nom);
  if(!P) return null;
  const [n, fam, h, b, tw, tf, r] = P;
  return { nom:n, fam, d:h, bf:b, tw, tf, r, T:h - 2 * (tf + r) };
}
// Coeficiente C' del grupo con momento solo (centro instantáneo en el centroide), en mm: Manual AISC parte 7
function cMomento(pernos){
  const n = pernos.length, cy = pernos.reduce((a, p) => a + p.y, 0) / n, cx = pernos.reduce((a, p) => a + p.x, 0) / n;
  const c = pernos.map(p => Math.hypot(p.x - cx, p.y - cy)), cm = Math.max(...c);
  return cm > 0 ? c.reduce((a, ci) => a + Math.pow(1 - Math.exp(-10 * 0.34 * ci / cm), 0.55) * ci, 0) : 0;
}
function calcAleta(c, sinSug){
  const ch = [], av = [], pasos = [];
  const V = +c.Vu || 0, d = +c.d, n = Math.max(1, Math.round(+c.n || 1)), s = +c.s, Lev = +c.Lev, Leh = +c.Leh, a = +c.a, tp = +c.tp, hol = +c.holgura || 0;
  const pl = ACEROS[c.aceroPl], ac = ACEROS[c.aceroViga], sp = ACEROS[c.aceroSop], FEXX = ELECTRODOS[c.electrodo];
  const vg = perfil(c.viga); if(!vg) return { error:'Escoja el perfil de la viga.' };
  const ssl = c.agujeros === 'SSLT', des = ['sup', 'ambos'].includes(c.destaje) ? c.destaje : 'no';
  const dh = agujero(d), dn = anchoNeto(d), Lp = (n - 1) * s + 2 * Lev, LehB = a - hol;
  const add = (grupo, nombre, ref, dem, cap, ud, extra) => ch.push({ grupo, nombre, ref, dem, cap, ud, ratio: cap > 0 ? dem / cap : Infinity, extra });
  // Destaje: profundidades dct (arriba) y dcb (abajo), largo c desde el extremo de la viga, borde LevB del perno superior al corte
  const dct = des !== 'no' ? +c.dct || 0 : 0, dcb = des === 'ambos' ? +c.dcb || 0 : 0, cD = des !== 'no' ? +c.cDes || 0 : 0, LevB = +c.LevB || 0;
  const ho = vg.d - dct - dcb, yb = des !== 'no' ? dct + LevB - Lev : (vg.d - Lp) / 2;
  pasos.push(`Altura de la chapa Lp = (n − 1)·s + 2·Lev = (${n} − 1)·${s} + 2·${Lev} = ${r1(Lp)} mm`);
  pasos.push(`Agujero ${ssl ? 'de ranura corta horizontal (perpendicular a la carga): en el sentido de la carga mide' : 'estándar'} dh = d + 1.6 = ${r1(dh)} mm; para área neta se usa dh + 1.6 = ${r1(dn)} mm`);
  if(des !== 'no') pasos.push(`Destaje ${des === 'sup' ? 'del ala superior' : 'de las dos alas'}: dc = ${dct}${dcb ? ` / ${dcb}` : ''} mm, c = ${cD} mm → altura del alma que queda ho = ${r1(ho)} mm; perno superior a ${LevB} mm del corte`);

  // ── Configuración (Manual AISC 15.ª ed., parte 10): convencional si a ≤ 89 mm (3½"), 2 a 12 pernos y el espesor de la Tabla 10-9 ──
  const tmaxC = n <= 5 ? (ssl ? Infinity : d / 2 + 1.6) : (ssl ? d / 2 + 1.6 : d / 2 - 1.6);
  const espOk = tp <= tmaxC + 0.05 || vg.tw <= tmaxC + 0.05;
  const geoConv = a <= 89 + 0.5 && n >= 2 && n <= 12;
  const conv = geoConv && espOk;
  const eB = conv ? (n >= 6 && !ssl ? a : a / 2) : a;
  if(conv) pasos.push(`Configuración CONVENCIONAL (Manual AISC Tabla 10-9): a = ${a} ≤ 89 mm, n = ${n}, agujeros ${ssl ? 'de ranura corta' : 'estándar'} → excentricidad de los pernos e = ${eB === a ? 'a' : 'a/2'} = ${r1(eB)} mm; espesor máximo de la chapa o del alma ${tmaxC === Infinity ? 'sin límite' : `${r1(tmaxC)} mm`}`);
  else { const pq = [!(a <= 89 + 0.5) && `a = ${a} mm > 89 mm`, !(n <= 12) && `n = ${n} > 12`, geoConv && !espOk && `ni la chapa (${tp} mm) ni el alma (${vg.tw} mm) cumplen el espesor máximo de la convencional (${r1(tmaxC)} mm)`].filter(Boolean).join('; ');
    pasos.push(`Configuración EXTENDIDA (Manual AISC parte 10) porque ${pq || 'no cumple la convencional'}: pernos con e = a = ${a} mm y la chapa debe fluir antes de que fallen los pernos (espesor máximo, ec. 10-3)`);
    av.push(`Se revisa como configuración EXTENDIDA (${pq || 'no cumple la convencional'}): pernos con e = a, soldadura con el momento Vu·a y espesor máximo de la ec. 10-3.`); }

  // ── Requisitos de detallado ──
  const req = [];
  const bm = bordeMin(d);
  req.push(['Distancia al borde vertical Lev ≥ mín. Tabla F.2.10.3-4', Lev >= bm, `${Lev} ≥ ${bm} mm`]);
  req.push(['Distancia al borde horizontal de la chapa Leh ≥ 2d', Leh >= 2 * d - 0.5, `${Leh} ≥ ${r1(2 * d)} mm`]);
  req.push(['Distancia al borde en el alma de la viga Leh,v ≥ 2d', LehB >= 2 * d - 0.5, `${r1(LehB)} ≥ ${r1(2 * d)} mm (a − holgura)`]);
  req.push(['Separación entre pernos s ≥ 3d (mín. 2.67d)', n < 2 || s >= 2.67 * d, `${s} ≥ ${r1(3 * d)} mm`]);
  req.push(['Una columna de 2 a 12 pernos', n >= 2 && n <= 12, `n = ${n}`]);
  if(conv) req.push([`Espesor máximo (Tabla 10-9): tp ≤ ${tmaxC === Infinity ? '—' : r1(tmaxC)} o tw ≤ ${tmaxC === Infinity ? '—' : r1(tmaxC)} mm`, espOk, tmaxC === Infinity ? 'sin límite (ranura corta, n ≤ 5)' : `tp = ${tp}, tw = ${vg.tw} mm`]);
  else {
    // ec. 10-3: tmax = 6·Mmax/(Fy·Lp²), Mmax = (Fnv/0.90)·Ab·C'
    const pcR = pernoCorte(d, c.grado, c.rosca, 1), Cp = cMomento(Array.from({ length:n }, (_, i) => ({ x:0, y:-i * s })));
    const Mmax = pcR.Fnv / 0.9 * pcR.Ab * Cp;                             // N·mm
    const tP = 6 * Mmax / (pl.Fy * Lp * Lp), tW = 6 * Mmax / (ac.Fy * Lp * Lp);
    pasos.push(`Espesor máximo (ec. 10-3): C' (momento solo) = ${r1(Cp)} mm; Mmax = (Fnv/0.90)·Ab·C' = (${pcR.Fnv}/0.90)·${r1(pcR.Ab)}·${r1(Cp)} = ${r2(Mmax / 1e6)} kN·m; tmax = 6·Mmax/(Fy·Lp²) = ${r1(tP)} mm (chapa), ${r1(tW)} mm (alma)`);
    req.push(['Extendida: la chapa o el alma fluyen antes que los pernos, tp ≤ tmax o tw ≤ tmax (ec. 10-3)', tp <= tP + 0.05 || vg.tw <= tW + 0.05, `tp = ${tp} ≤ ${r1(tP)} o tw = ${vg.tw} ≤ ${r1(tW)} mm`]);
  }
  const yTop = des !== 'no' ? dct : vg.tf + vg.r, yBot = des === 'ambos' ? vg.d - dcb : vg.d - vg.tf - vg.r;
  if(des === 'no') req.push(['La chapa cabe en el alma recta de la viga: Lp ≤ T', Lp <= vg.T + 0.5, `${r1(Lp)} ≤ ${r1(vg.T)} mm`]);
  else req.push(['La chapa cabe en el alma bajo el destaje', yb >= yTop - 0.5 && yb + Lp <= yBot + 0.5, `de ${r1(yb)} a ${r1(yb + Lp)} mm (alma libre de ${r1(yTop)} a ${r1(yBot)} mm)`]);
  req.push(['Estabilidad de la viga en el apoyo: Lp ≥ T/2', Lp >= vg.T / 2 - 0.5, `${r1(Lp)} ≥ ${r1(vg.T / 2)} mm`]);
  req.push(['Soldadura que desarrolla la chapa: w ≥ 5/8·tp (dos filetes)', +c.w >= 0.625 * tp - 0.05, `${c.w} ≥ ${r1(0.625 * tp)} mm`]);
  { const tmin = Math.min(tp, +c.tSop || tp), wmin = tmin <= 6 ? 3 : tmin <= 13 ? 5 : tmin <= 19 ? 6 : 8;
    req.push(['Filete mínimo Tabla J2.4 (parte más delgada)', +c.w >= wmin, `${c.w} ≥ ${wmin} mm`]); }
  if(des !== 'no'){
    req.push(['Borde del perno superior al corte del destaje LevB ≥ mín.', LevB >= bm, `${LevB} ≥ ${bm} mm`]);
    req.push(['Largo del destaje c ≤ 2d (validez de las ecuaciones del Manual AISC parte 9)', cD <= 2 * vg.d, `${cD} ≤ ${2 * vg.d} mm`]);
    if(des === 'sup') req.push(['Profundidad del destaje dc ≤ d/2', dct <= vg.d / 2, `${dct} ≤ ${r1(vg.d / 2)} mm`]);
    else req.push(['Profundidades del destaje dc ≤ 0.2d (arriba y abajo)', Math.max(dct, dcb) <= 0.2 * vg.d, `${Math.max(dct, dcb)} ≤ ${r1(0.2 * vg.d)} mm`]);
    if(cD < a + Leh) av.push(`Revise que el destaje libre el ala del soporte: c = ${cD} mm (la chapa llega a a + Leh = ${r1(a + Leh)} mm de la cara).`);
  }
  if(ssl) av.push('Agujeros de ranura corta: van solo en la chapa o solo en el alma, con la ranura horizontal (perpendicular a la carga).');
  req.filter(r => !r[1]).forEach(r => av.push(`${r[0]}: ${r[2]}`));

  // 1. Pernos: grupo excéntrico (método del centro instantáneo) con la excentricidad de la configuración
  const pernos = Array.from({ length:n }, (_, i) => ({ x:0, y:-i * s }));
  const ic = icr(pernos, eB, 0);
  const pc = pernoCorte(d, c.grado, c.rosca, 1);
  const lcE = Lev - dh / 2, lcI = s - dh;
  const bpE = aplast(lcE, tp, d, pl.Fu), bpI = aplast(n > 1 ? lcI : 1e6, tp, d, pl.Fu), bv = aplast(n > 1 ? lcI : 1e6, vg.tw, d, ac.Fu);
  // con destaje la carga sube contra el borde del corte: el perno superior desgarra el alma hacia el destaje
  const bvE = des !== 'no' ? aplast(LevB - dh / 2, vg.tw, d, ac.Fu) : bv;
  // perno por perno (como el grupo excéntrico): la chapa empuja hacia abajo (borde inferior en el perno de abajo) y el alma de la viga
  // hacia arriba (borde del destaje en el perno de arriba); capacidad = C·rn − Σ(rn − rnᵢ)·C/n
  const rN = Math.min(pc.phiRn, bpI.phiRn, bv.phiRn);
  const rI = pernos.map((_, i) => Math.min(pc.phiRn, i === n - 1 ? bpE.phiRn : bpI.phiRn, i === 0 ? bvE.phiRn : bv.phiRn));
  const rn = rN, capP = ic.C * rN - rI.reduce((q, x) => q + (rN - x), 0) * ic.C / n, rMin = Math.min(...rI);
  const cual = rMin === pc.phiRn ? 'cortante del perno' : rMin === bvE.phiRn || rMin === bv.phiRn ? 'aplastamiento en el alma de la viga' : 'aplastamiento en la chapa';
  pasos.push(`Cortante de un perno (F.2.10.3.6): φrn = 0.75·Fnv·Ab = 0.75·${pc.Fnv}·${r1(pc.Ab)} = ${r2(pc.phiRn)} kN`);
  pasos.push(`Aplastamiento en la chapa (F.2.10.3.10): borde lc = ${r1(lcE)} mm → ${r2(bpE.phiRn)} kN; interior lc = ${r1(lcI)} mm → ${r2(bpI.phiRn)} kN`);
  pasos.push(`Aplastamiento en el alma de la viga: lc = ${r1(lcI)} mm, tw = ${vg.tw} mm → ${r2(bv.phiRn)} kN${des !== 'no' ? `; perno junto al destaje lc = ${r1(LevB - dh / 2)} mm → ${r2(bvE.phiRn)} kN` : ''}`);
  pasos.push(`Centro instantáneo con e = ${r1(eB)} mm: C = ${r3(ic.C)} (${ic.metodo}); por perno ${rI.map(x => r2(x)).join(' · ')} kN (de arriba hacia abajo) → φRn = C·rn − Σ(rn − rnᵢ)·C/n = ${r2(capP)} kN (rn = ${r2(rn)} kN; el más débil por ${cual})`);
  add('pernos', `Pernos con excentricidad e = ${eB === a ? 'a' : 'a/2'} (centro instantáneo, perno por perno): cortante y aplastamiento`, `F.2.10.3 (J3-1, J3-6) · Manual AISC ${conv ? 'Tabla 10-9' : 'parte 10 (extendida)'}`, V, capP, 'kN', `C = ${r2(ic.C)}; corte ${r2(pc.phiRn)}; aplastamiento chapa borde inferior ${r2(bpE.phiRn)} / interior ${r2(bpI.phiRn)}; alma de la viga ${r2(bv.phiRn)}${des !== 'no' ? ` / perno superior junto al destaje ${r2(bvE.phiRn)}` : ''} kN`);

  // 2. Chapa (flexión con Mu = Vu·a en las dos configuraciones: del lado seguro)
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

  // 3. Soldadura chapa–soporte: dos filetes de longitud Lp. Convencional: solo cortante (los filetes de 5/8·tp desarrollan la chapa, Manual parte 10);
  //    extendida: cortante + momento Vu·a (del lado seguro, decisión de Amo 22-nov)
  const qw = 0.75 * 0.6 * FEXX * 0.707 * (+c.w) / 1000;                   // kN/mm por filete
  const fv = V / (2 * Lp), fm = conv ? 0 : Mu * 1000 / (2 * Lp * Lp / 6), fr = Math.hypot(fv, fm);
  if(conv) add('soldadura', 'Resistencia de los filetes (cortante)', 'F.2.10.2.4 (J2-4) · Manual AISC parte 10', fr, qw, 'kN/mm', `fv = Vu/(2·Lp) = ${r3(fv)} kN/mm; φ·0.6·FEXX·0.707·w (con w ≥ 5/8·tp la soldadura es más fuerte que la chapa)`);
  else add('soldadura', 'Resistencia de los filetes (cortante + flexión Vu·a)', 'F.2.10.2.4 (J2-4)', fr, qw, 'kN/mm', `f = √(fv² + fm²); fv = ${r3(fv)}, fm = ${r3(fm)} kN/mm; φ·0.6·FEXX·0.707·w`);
  // metal base: la chapa recibe un filete por cada cara → cada filete cuenta con la mitad de su espesor (rotura por cortante, J4-4)
  const qbCh = 0.75 * 0.6 * pl.Fu * tp / 2 / 1000;
  add('soldadura', 'Metal base de la chapa junto a los filetes', 'F.2.10.2.4 (J2-2) · J4-4', fr, qbCh, 'kN/mm', `0.75·0.6·Fu·tp/2 por filete (un filete en cada cara)`);

  // 4. Soporte y viga
  // soporte: rotura por cortante a lo largo de cada filete; si hay conexión al otro lado del alma, cada lado cuenta con la mitad
  const qbS = 0.75 * 0.6 * sp.Fu * (+c.tSop) / (c.dosLados ? 2 : 1) / 1000;
  add('soporte', (c.soporte === 'ala' ? 'Ala de la columna' : 'Alma del soporte') + ': rotura bajo la soldadura', 'F.2.10.2.4 (J2-2) · Manual AISC (9-2)', fr, qbS, 'kN/mm', `0.75·0.6·Fu·t${c.dosLados ? '/2 (conexión a ambos lados)' : ''} por filete`);
  if(des === 'no'){
    const vb = 1.0 * 0.6 * ac.Fy * vg.d * vg.tw / 1000;
    add('viga', 'Cortante del alma de la viga', 'F.2.7.2 (G2-1), φv = 1.0', V, vb, 'kN', `0.6·Fy·d·tw = 0.6·${ac.Fy}·${vg.d}·${vg.tw}`);
  } else {
    const tw = vg.tw;
    add('viga', 'Alma con destaje: fluencia por cortante', 'F.2.10.4.2 (J4-3)', V, 1.0 * 0.6 * ac.Fy * ho * tw / 1000, 'kN', `0.6·Fy·ho·tw, ho = ${r1(ho)} mm`);
    add('viga', 'Alma con destaje: rotura por cortante', 'F.2.10.4.2 (J4-4)', V, 0.75 * 0.6 * ac.Fu * (ho - n * dn) * tw / 1000, 'kN', `Anv = (ho − n·${r1(dn)})·tw = ${r1((ho - n * dn) * tw)} mm²`);
    const agv = (LevB + (n - 1) * s) * tw, anv = agv - (n - 0.5) * dn * tw, ant = (LehB - 0.5 * dn) * tw;
    add('viga', 'Alma con destaje: bloque de cortante', 'F.2.10.4.3 (J4-5), Ubs = 1.0 · Manual AISC parte 9', V, 0.75 * Math.min(0.6 * ac.Fu * anv + ac.Fu * ant, 0.6 * ac.Fy * agv + ac.Fu * ant) / 1000, 'kN', `Agv = ${r1(agv)}, Anv = ${r1(anv)}, Ant = ${r1(ant)} mm² (hacia el destaje y el extremo de la viga)`);
    // Sección en la cara del destaje: T (ala inferior + alma) si se corta arriba; rectángulo si se cortan las dos alas
    const tf = vg.tf, bf = vg.bf, hw = des === 'sup' ? ho - tf : ho;
    const partes = des === 'sup' ? [{ b:bf, h:tf, y:tf / 2 }, { b:tw, h:hw, y:tf + hw / 2 }] : [{ b:tw, h:ho, y:ho / 2 }];
    const A = partes.reduce((q, p) => q + p.b * p.h, 0), yc = partes.reduce((q, p) => q + p.b * p.h * p.y, 0) / A;
    const I = partes.reduce((q, p) => q + p.b * p.h ** 3 / 12 + p.b * p.h * (p.y - yc) ** 2, 0), Snet = I / Math.max(yc, ho - yc);
    let yp; if(des === 'sup'){ yp = bf * tf >= A / 2 ? A / 2 / bf : tf + (A / 2 - bf * tf) / tw; } else yp = ho / 2;
    const Znet = partes.reduce((q, p) => { const y0 = p.y - p.h / 2, y1 = p.y + p.h / 2;
      const ab = Math.max(0, Math.min(y1, yp) - y0), ar = Math.max(0, y1 - Math.max(y0, yp));
      return q + p.b * ab * (yp - (y0 + ab / 2)) + p.b * ar * ((Math.max(y0, yp) + ar / 2) - yp); }, 0);
    const e = cD + hol, MuD = V * e / 1000;
    let Fcr, txt;
    if(des === 'sup'){
      const f = cD / vg.d <= 1 ? 2 * cD / vg.d : 1 + cD / vg.d, k = cD / ho <= 1 ? 2.2 * Math.pow(ho / Math.max(cD, 1), 1.65) : 2.2 * ho / cD;
      const Fe = 180700 * (tw / ho) ** 2 * f * k; Fcr = Math.min(ac.Fy, Fe);
      txt = `ala superior: f = ${r3(f)}, k = ${r3(k)}, Fcr = 26 210 ksi·(tw/ho)²·f·k = ${r1(Fe)} ≤ Fy → ${r1(Fcr)} MPa (Manual AISC 9-6)`;
    } else {
      const Fyk = ac.Fy / 6.89476, lm = ho * Math.sqrt(Fyk) / (10 * tw * Math.sqrt(475 + 280 * (ho / Math.max(cD, 1)) ** 2));
      const Qd = lm <= 0.7 ? 1 : lm <= 1.41 ? 1.34 - 0.486 * lm : 1.30 / (lm * lm); Fcr = ac.Fy * Qd;
      txt = `dos alas: λ = ${r3(lm)}, Q = ${r3(Qd)}, Fcr = Fy·Q = ${r1(Fcr)} MPa (Manual AISC 9-14 a 9-16)`;
    }
    pasos.push(`Sección en la cara del destaje: A = ${r1(A)} mm², ȳ = ${r1(yc)} mm, I = ${Math.round(I)} mm⁴, Snet = ${Math.round(Snet)} mm³, Znet = ${Math.round(Znet)} mm³; e = c + holgura = ${r1(e)} mm → Mu = Vu·e = ${r3(MuD)} kN·m`);
    add('viga', 'Alma con destaje: fluencia por flexión y pandeo local', 'Manual AISC parte 9 (9-6 / 9-14) · φb = 0.90', MuD, 0.9 * Fcr * Snet / 1e6, 'kN·m', txt);
    add('viga', 'Alma con destaje: rotura por flexión', 'Manual AISC (9-4) · φ = 0.75', MuD, 0.75 * ac.Fu * Znet / 1e6, 'kN·m', `0.75·Fu·Znet`);
    av.push('Viga con destaje: el borde cortado debe quedar con esquinas redondeadas (radio ≥ 13 mm, F.2.10 / J1.6) y sin muescas.');
  }

  const max = ch.reduce((m, x) => Math.max(m, x.ratio), 0);
  const R = { ok:max <= 1 && !req.some(r => !r[1]), max, ch, req, av, pasos, geo:{ Lp, dh, LehB, pernos, vg, ic, a, yb, ho, dct, dcb, cD, des, conv, eB }, Mu };
  if(sinSug || c._sinSug) return R;
  // 💡 (revisión con Amo 22-nov): la solución más liviana que cumple todo (también las 6 fuerzas), cambiando
  //    diámetro, número de pernos, espesor de la chapa y filete (5/8·tp); s y bordes a los mínimos si hace falta
  if(Conex.calc({ ...c, _sinSug:true }).ok) return R;
  const WS = [5, 6, 8, 10, 12, 14, 16], wDe = t => WS.find(x => x >= 0.625 * t - 0.05) || 16;
  const dA = DIAM.map(x => x[1]).filter(x => x >= Math.min(+c.d, 19.1) - 1e-6 && x <= 25.4 + 1e-6);
  let best = null;
  for(const dd of dA){
    for(let nn = 2; nn <= 12; nn++){
      for(const t of ESP_PL.filter(x => x <= 19.1 + 1e-6)){
        const o = { d:dd, n:nn, tp:t, w:Math.max(wDe(t), +c.w || 0) };
        if(+c.s < 3 * dd) o.s = Math.ceil(3 * dd / 5) * 5;
        const bmn = bordeMin(dd); if(+c.Lev < bmn) o.Lev = bmn; if(+c.Leh < 2 * dd) o.Leh = Math.ceil(2 * dd);
        if(des !== 'no' && +c.LevB < bmn) o.LevB = bmn;
        // con destaje también se prueba bajar la chapa lo más posible (perno superior más lejos del corte)
        const Lp2 = (nn - 1) * (o.s || s) + 2 * (o.Lev || Lev), LevMax = Math.floor(yBot - Lp2 - dct + (o.Lev || Lev));
        const ops = des !== 'no' && LevMax > (o.LevB || LevB) ? [o, { ...o, LevB:LevMax }] : [o];
        const okO = ops.find(x => { const r = Conex.calc({ ...c, ...x, _sinSug:true }); return !r.error && r.ok; });
        if(okO){ const peso = nn * dd * dd * 0.02 + t * Lp2 * 0.01;
          if(!best || peso < best.peso) best = { ...okO, peso }; break; } }
    }
  }
  if(best){ const { peso, ...o } = best, dnm = (DIAM.find(x => x[1] === o.d) || [o.d + ' mm'])[0];
    R.sug = { tipo:'sold', ok:true, ...o, txt:`💡 Usar ${o.n} pernos de ${dnm}, chapa de ${o.tp} mm y filete de ${o.w} mm${o.s && o.s !== s ? ` (s = ${o.s} mm)` : ''}${o.LevB && o.LevB !== LevB ? ` con el perno superior a ${o.LevB} mm del destaje` : ''}` }; }
  else R.av.push('No se encontró una chapa de aleta que cumpla (hasta 12 pernos de 1" y chapa de 19 mm): use doble angular, chapa de testa a cortante o revise la viga.');
  return R;
}

// ── Grupo de pernos excéntrico (ménsula de chapa atornillada) ─────────────
function defaultsGrupo(){
  return { tipo:'grupo', nom:'', desc:'', Pu:60, ang:0, e:200,
    filas:3, cols:2, s:75, g:75, Lev:40, Leh:40,
    d:19.1, grado:'A325', rosca:'N',
    tp:12.7, aceroPl:'A36', tSop:12, aceroSop:'A572 Gr 50', desliz:false, claseSup:'A' };
}
function calcGrupo(c){
  const ch = [], av = [], pasos = [];
  const P = +c.Pu || 0, d = +c.d, nf = Math.max(1, Math.round(+c.filas)), nc = Math.max(1, Math.round(+c.cols)), s = +c.s, g = +c.g, e = +c.e, ang = +c.ang || 0;
  const pl = ACEROS[c.aceroPl], sp = ACEROS[c.aceroSop], tp = +c.tp, ts = +c.tSop, Lev = +c.Lev, Leh = +c.Leh;
  const dh = agujero(d), dn = anchoNeto(d), n = nf * nc, E = 200000;
  const pernos = []; for(let j = 0; j < nc; j++) for(let i = 0; i < nf; i++) pernos.push({ x:j * g, y:-i * s });
  const add = (grupo, nombre, ref, dem, cap, ud, extra) => ch.push({ grupo, nombre, ref, dem, cap, ud, ratio: cap > 0 ? dem / cap : Infinity, extra });
  const req = [], bm = bordeMin(d);
  req.push(['Distancias al borde Lev, Leh ≥ mín. Tabla F.2.10.3-4', Math.min(Lev, Leh) >= bm, `${Math.min(Lev, Leh)} ≥ ${bm} mm`]);
  req.push(['Separación s, g ≥ 2.67d (preferible 3d)', Math.min(nf > 1 ? s : 1e9, nc > 1 ? g : 1e9) >= 2.67 * d, `${Math.min(nf > 1 ? s : 1e9, nc > 1 ? g : 1e9) < 1e9 ? Math.min(nf > 1 ? s : 1e9, nc > 1 ? g : 1e9) : '—'} ≥ ${r1(2.67 * d)} mm`]);
  req.filter(r => !r[1]).forEach(r => av.push(`${r[0]}: ${r[2]}`));

  const ic = icr(pernos, e, ang), el = elastico(pernos, e, ang);
  const pc = pernoCorte(d, c.grado, c.rosca, 1), ta = ang * Math.PI / 180, Pv = P * Math.cos(ta), Ph = P * Math.sin(ta);
  // Aplastamiento perno por perno (revisión con Amo, 20-nov): borde libre de cada perno en el sentido de la carga sobre la chapa
  // (u = dirección de P). Hacia otro agujero lc = distancia − dh; hacia el borde lc = distancia − dh/2. El soporte se toma sin borde.
  const ux = Math.sin(ta), uy = -Math.cos(ta), xL = -Leh, xR = (nc - 1) * g + Leh, yT = Lev, yB = -(nf - 1) * s - Lev;
  const lcDe = p => {
    let dist = Infinity;
    if(ux > 1e-9) dist = Math.min(dist, (xR - p.x) / ux); if(ux < -1e-9) dist = Math.min(dist, (xL - p.x) / ux);
    if(uy > 1e-9) dist = Math.min(dist, (yT - p.y) / uy); if(uy < -1e-9) dist = Math.min(dist, (yB - p.y) / uy);
    let lc = dist - dh / 2, borde = true;
    pernos.forEach(q => { if(q === p) return; const dx = q.x - p.x, dy = q.y - p.y, t = dx * ux + dy * uy, off = Math.abs(dx * uy - dy * ux);
      if(t > 0 && off < dh && t - dh < lc){ lc = t - dh; borde = false; } });
    return { lc, borde };
  };
  const bS = 0.75 * 2.4 * d * ts * sp.Fu / 1000;
  const rnP = pernos.map(p => { const L = lcDe(p); return { ...L, r:Math.min(pc.phiRn, aplast(L.lc, tp, d, pl.Fu).phiRn, bS) }; });
  const rMax = Math.min(pc.phiRn, 0.75 * 2.4 * d * tp * pl.Fu / 1000, bS);
  // capacidad del grupo: C·rn con el perno "normal"; cada perno con menos resistencia descuenta su faltante en proporción C/n
  const capIC = ic.C * rMax - rnP.reduce((a, x) => a + (rMax - x.r), 0) * ic.C / n;
  const rMin = Math.min(...rnP.map(x => x.r));
  const cual = rMax === pc.phiRn ? 'cortante del perno' : rMax === bS ? 'aplastamiento en el soporte' : 'aplastamiento en la chapa';
  pasos.push(`${nf} filas × ${nc} columnas = ${n} pernos de ${d} mm ${c.grado}-${c.rosca}; s = ${s}, g = ${g} mm`);
  pasos.push(`Cortante de un perno: φrn = 0.75·${pc.Fnv}·${r1(pc.Ab)} = ${r2(pc.phiRn)} kN; aplastamiento en el soporte (sin borde) ${r2(bS)} kN`);
  pasos.push(`Aplastamiento en la chapa perno por perno, en el sentido de la carga (${ang}° de la vertical): ${rnP.map((x, k) => `${k + 1}: lc ${r1(x.lc)} mm → ${r2(x.r)} kN${x.borde ? ' (borde)' : ''}`).join(' · ')}`);
  pasos.push(`Centro instantáneo (e = ${e} mm): C = ${r3(ic.C)}; método elástico: C = ${r3(el.C)} (referencia). Capacidad = C·rn − Σ(rn − rnᵢ)·C/n = ${r2(capIC)} kN (rn = ${r2(rMax)} kN, ${cual})`);
  add('pernos', 'Grupo de pernos excéntrico (centro instantáneo, perno por perno)', 'F.2.10.3 · Manual AISC parte 7', Math.abs(P), capIC, 'kN', `C = ${r2(ic.C)} · perno más débil ${r2(rMin)} kN`);
  // Deslizamiento crítico (J3-8): un plano
  if(c.desliz){ const mu = c.claseSup === 'B' ? 0.50 : 0.30, Tb = pretension(c.grado, d), rs = 1.0 * mu * 1.13 * Tb;
    pasos.push(`Deslizamiento crítico (J3-8): φrn = 1.0·${mu}·1.13·1·${Tb} = ${r2(rs)} kN por perno (superficie clase ${c.claseSup === 'B' ? 'B' : 'A'})`);
    add('pernos', `Deslizamiento del grupo (${n} pernos, 1 plano)`, 'F.2.10.3.8 (J3-4), φ = 1.00', Math.abs(P), ic.C * rs, 'kN', `C = ${r2(ic.C)} · ${r2(rs)} kN`);
    if(!Tb) av.push('Pernos A307: no se pueden usar como deslizamiento crítico (no tienen pretensión).');
    req.push([`Pernos de deslizamiento crítico, superficies clase ${c.claseSup === 'B' ? 'B' : 'A'} (sin pintura en las caras de contacto)`, !!Tb, Tb ? 'indicar en planos' : 'A307 no sirve']); }

  // Chapa: sección vertical en la columna de pernos más cercana a la carga
  const Hp = (nf - 1) * s + 2 * Lev, cen = (nc - 1) * g / 2, e1 = Math.max(0, e - cen);   // brazo hasta la línea de pernos más cercana a la carga
  const Mu = Math.abs(Pv) * e1 / 1000, Nh = Math.abs(Ph), V = Math.abs(Pv);
  const Zg = tp * Hp * Hp / 4, Sg = tp * Hp * Hp / 6; let Zn = Zg; for(let i = 0; i < nf; i++) Zn -= dn * tp * Math.abs(i * s - (nf - 1) * s / 2);
  const An = (Hp - nf * dn) * tp, phMy = 0.9 * pl.Fy * Zg / 1e6, phMu = 0.75 * pl.Fu * Zn / 1e6, phPy = 0.9 * pl.Fy * Hp * tp / 1000, phPu = 0.75 * pl.Fu * Math.min(An, 0.85 * Hp * tp) / 1000;
  add('chapa', 'Fluencia por flexión en la línea de pernos', 'Manual AISC parte 15 · F.2.6', Mu, phMy, 'kN·m', `Mu = P·cos θ·e₁, e₁ = ${r1(e1)} mm`);
  add('chapa', 'Rotura por flexión en la línea de pernos', 'Manual AISC (9-4)', Mu, phMu, 'kN·m', `Znet = ${Math.round(Zn)} mm³`);
  add('chapa', 'Fluencia por cortante', 'F.2.10.4.2 (J4-3)', V, 0.6 * pl.Fy * Hp * tp / 1000, 'kN', `Agv = ${r1(Hp * tp)} mm²`);
  add('chapa', 'Rotura por cortante', 'F.2.10.4.2 (J4-4)', V, 0.75 * 0.6 * pl.Fu * (Hp - nf * dn) * tp / 1000, 'kN', `Anv = ${r1((Hp - nf * dn) * tp)} mm²`);
  // Flexión + cortante (Manual AISC ec. 10-5) y la parte horizontal de la carga (axial) con la flexión
  add('chapa', 'Flexión + cortante (fluencia)', 'Manual AISC ec. 10-5', Math.hypot(V / (0.6 * pl.Fy * Hp * tp / 1000), Mu / phMy), 1, '', '(V/φVn)² + (M/φMn)² ≤ 1');
  if(Nh > 0){
    pasos.push(`Parte horizontal de la carga: P·sen θ = ${r2(Nh)} kN → ${Ph >= 0 ? 'tensión' : 'compresión'} de la chapa en la línea de pernos, se suma a la flexión`);
    add('chapa', `Axial (P·sen θ) + flexión: fluencia`, 'F.2.8.1 (H1-1b), sección rectangular', Nh / phPy + Mu / phMy, 1, '', `N = ${r2(Nh)} kN, φPn = ${r2(phPy)} kN`);
    if(Ph > 0) add('chapa', 'Axial + flexión: rotura por los agujeros', 'F.2.10.4.1 (J4-2) + Manual (9-4)', Nh / phPu + Mu / phMu, 1, '', `φPn = 0.75·Fu·An = ${r2(phPu)} kN`); }
  // Bloque de cortante (forma en L): cortante a lo largo de la columna de pernos, tensión hacia el borde vertical
  { const agv = (Lev + (nf - 1) * s) * tp, anv = agv - (nf - 0.5) * dn * tp, ant = (Leh + (nc - 1) * g - (nc - 0.5) * dn) * tp, Ubs = nc > 1 ? 0.5 : 1;
    const cap = 0.75 * Math.min(0.6 * pl.Fu * anv + Ubs * pl.Fu * ant, 0.6 * pl.Fy * agv + Ubs * pl.Fu * ant) / 1000;
    add('chapa', 'Bloque de cortante (en L)', 'F.2.10.4.3 (J4-5)', V, cap, 'kN', `Agv ${r1(agv)}, Anv ${r1(anv)}, Ant ${r1(ant)} mm², Ubs = ${Ubs}`); }
  // Pandeo de la chapa (Manual AISC 9-18): λ = h√Fy / (10t√(475 + 280(h/c)²)), Fy en ksi
  if(e1 > 0){ const FyK = pl.Fy / 6.895, lam = (Hp / tp) * Math.sqrt(FyK) / (10 * Math.sqrt(475 + 280 * (Hp / e1) ** 2));
    const Q = lam <= 0.7 ? 1 : lam <= 1.41 ? 1.34 - 0.486 * lam : 1.30 / (lam * lam), phMb = 0.9 * pl.Fy * Q * Sg / 1e6;
    add('chapa', 'Pandeo de la chapa (flexión)', 'Manual AISC ec. 9-18 a 9-20', Mu, phMb, 'kN·m', `λ = ${r3(lam)}, Q = ${r3(Q)}, Fcr = Fy·Q, S = tp·h²/6`); }
  const max = ch.reduce((m, x) => Math.max(m, x.ratio), 0);
  const R = { ok:max <= 1 && !req.some(r => !r[1]), max, ch, req, av, pasos, geo:{ pernos, Hp, ic, el, e } };
  return R;
}
// Envoltura con la 💡 (fuerzas extra incluidas): filas, columnas, diámetro y espesor mínimos que cumplen
function calcGrupoS(c){
  const R = calcGrupo(c);
  if(c._sinSug) return R;
  const tot = x => { const r = Conex.calc({ ...c, ...x, _sinSug:true }); return r; };
  if(tot({}).ok) return R;
  const dA = DIAM.map(x => x[1]).filter(x => x >= +c.d - 1e-6), tA = ESP_PL.filter(x => x >= +c.tp - 1e-6);
  let best = null;
  for(const d of dA){ for(const t of tA){ for(let nc = Math.max(1, +c.cols); nc <= 3 && !best; nc++) for(let nf = 2; nf <= 8; nf++){
    const o = { d, tp:t, cols:nc, filas:nf }; if(+c.s < 2.67 * d) o.s = Math.ceil(3 * d / 5) * 5; if(nc > 1 && +c.g < 2.67 * d) o.g = Math.ceil(3 * d / 5) * 5;
    const bm = bordeMin(d); if(+c.Lev < bm) o.Lev = bm; if(+c.Leh < bm) o.Leh = bm;
    if(tot(o).ok){ best = o; break; } } if(best) break; } if(best) break; }
  if(best){ const dn = (DIAM.find(x => x[1] === best.d) || [best.d + ' mm'])[0];
    R.sug = { tipo:'sold', ok:true, ...best, txt:`💡 Usar ${best.filas} filas × ${best.cols} columna${best.cols > 1 ? 's' : ''} de pernos de ${dn} y chapa de ${best.tp} mm${best.s && best.s !== +c.s ? ` (s = ${best.s} mm)` : ''}` }; }
  else R.av.push('No se encontró un grupo que cumpla (hasta 8 filas × 3 columnas, pernos de 1-1/8" y chapa de 38 mm): reduzca la excentricidad o use otra solución.');
  return R;
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
const RY = ac => /A53/.test(ac) ? 1.6 : /A36/.test(ac) ? 1.5 : /A500 Gr B/.test(ac) ? 1.4 : /A500/.test(ac) ? 1.3 : 1.1;   // NSR-10 F.3 / AISC 341 Tabla A3.1
const RT = ac => /A53/.test(ac) ? 1.2 : /A36/.test(ac) ? 1.2 : /A500 Gr B/.test(ac) ? 1.3 : /A500/.test(ac) ? 1.2 : 1.1;   // Rt (Fu esperado)
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
  const nb = c.ambos ? (ras ? 2 * nfR : e8 ? 8 : 4) : Math.max(0, Math.round(+c.nbc || 0));
  // A ras (pedido de Amo 20-nov): el cortante lo pueden tomar todos los pernos → los de tensión se revisan con J3-7
  const todos = ras && !!c.cortTodos, nAll = 2 * nfR + nb, Fnv = B[c.rosca === 'X' ? 'X' : 'N'];
  let FntE = B.Fnt;
  if(todos){ const frv = Vu * 1000 / (nAll * Ab); FntE = Math.max(0, Math.min(B.Fnt, 1.3 * B.Fnt - B.Fnt / (phB * Fnv) * frv));
    pasos.push(`Cortante en todos los pernos (${nAll}): frv = Vu/(n·Ab) = ${r1(frv)} MPa → tensión disponible con cortante (J3-3a): F'nt = 1.3·Fnt − Fnt/(φ·Fnv)·frv = ${r1(FntE)} MPa ≤ Fnt = ${B.Fnt} MPa`); }
  const Pt = FntE * Ab / 1000, phiMnp = phB * 2 * Pt * sumH / 1000;
  const delg = ras && c.placaTipo === 'delgada';
  pasos.push(`Pernos: Ab = ${r1(Ab)} mm², Pt = ${todos ? "F'nt" : 'Fnt'}·Ab = ${r1(FntE)}·${r1(Ab)} = ${r2(Pt)} kN; φMnp = ${phB}·2·Pt·Σh = ${r2(phiMnp)} kN·m (Σh = ${r1(sumH)} mm)`);
  if(!delg) add('pernos', `Rotura de los pernos a tensión (sin palanca)${todos ? ' con cortante' : ''}`, `F.2.10.3.6 (J3-1${todos ? ', J3-3a' : ''}) · ${sis ? 'AISC 358 (6.10-?) φn = 0.90' : 'Guía AISC 4'}`, Mu, phiMnp, 'kN·m',
    `Pt = ${r2(Pt)} kN, ` + Object.entries(H).filter(([, v]) => v).map(([k, v]) => `${k.replace('h', 'h')} = ${r1(v)}`).join(', ') + ' mm');
  // 2. Pernos a cortante en la zona de compresión (o en todos)
  const rv = phB * Fnv * Ab / 1000;
  const bPl = ras ? Infinity : aplast(de - dh / 2, tp, d, pl.Fu).phiRn, bPlI = 2.4 * d * tp * pl.Fu * 0.75 / 1000;
  const bCol = cl ? 0.75 * 2.4 * d * cl.tf * ac.Fu / 1000 : Infinity;
  const rb = Math.min(rv, c.ambos ? Math.min(bPl, bPlI) : bPlI, bCol);
  add('pernos', todos ? `Cortante repartido en los ${nAll} pernos` : `Cortante en los ${nb} pernos de la zona de compresión`, 'F.2.10.3.6 y F.2.10.3.10 (J3-1, J3-6)', Vu, (todos ? nAll : nb) * rb, 'kN', `φrn = ${r2(rb)} kN por perno (corte ${r2(rv)}, aplastamiento placa ${r2(Math.min(bPl, bPlI))}${cl ? `, ala columna ${r2(bCol)}` : ''})`);
  if(!nb && !todos) av.push('No hay pernos en la zona de compresión para tomar el cortante.');

  // 3. Placa: líneas de fluencia (placa gruesa: φd·Mpl ≥ 1.11·Mf o 1.11·φMnp)
  const sP = 0.5 * Math.sqrt(bp * g), pfiY = Math.min(pfi, sP);
  let Yp;
  if(ras) Yp = nfR === 1 ? bp / 2 * (h1 * (1 / pfiY + 1 / sP)) + 2 / g * (h1 * (pfiY + sP))   // Guía AISC 16 (2 pernos a ras), confirmada 20-nov con el ejemplo de Murray et al. (NASCC 2003): Yp = 100.5 in
    : bp / 2 * (h1 * (1 / pfiY + 1 / sP) + h2 / sP - 0.5) + 2 / g * (h1 * (pfiY + 0.75 * pb) + h2 * (sP + 0.25 * pb)) + g / 2;    // Guía AISC 16
  else if(e8){ const { h1:a1, h2:a2, h3:a3, h4:a4 } = H;                // AISC 358 Tabla 6.4 / Guía 4 (8ES)
    Yp = de <= sP ? bp / 2 * (a1 / (2 * de) + a2 / pfo + a3 / pfi + a4 / sP) + 2 / g * (a1 * (de + pb / 4) + a2 * (pfo + 3 * pb / 4) + a3 * (pfi + pb / 4) + a4 * (sP + 3 * pb / 4) + pb * pb) + g
                  : bp / 2 * (a1 / sP + a2 / pfo + a3 / pfi + a4 / sP) + 2 / g * (a1 * (sP + pb / 4) + a2 * (pfo + 3 * pb / 4) + a3 * (pfi + pb / 4) + a4 * (sP + 3 * pb / 4) + pb * pb) + g; }
  else Yp = bp / 2 * (h1 * (1 / pfiY + 1 / sP) + h0 / pfo - 0.5) + 2 / g * (h1 * (pfiY + sP));
  const demPl = delg ? Mu : sis ? 1.11 * Mu : 1.11 * gr * phiMnp;
  const phiMpl = phD * pl.Fy * tp * tp * Yp / 1e6, tpReq = Math.sqrt(demPl * 1e6 / (phD * pl.Fy * Yp));
  pasos.push(`Placa: s = ½√(bp·g) = ${r1(sP)} mm${pfi > sP && !e8 ? ` (pfi se limita a s)` : ''}; Yp = ${Math.round(Yp)} mm; φMpl = ${phD}·Fy·tp²·Yp = ${r2(phiMpl)} kN·m`);
  if(delg){
    // Placa delgada (Guía AISC 16, cap. 3): la placa resiste Mu y los pernos se revisan con la fuerza de palanca (Kennedy modificado)
    pasos.push(`Placa delgada: φMpl = ${r2(phiMpl)} kN·m ≥ Mu; espesor mínimo tp = √(Mu/(φ·Fy·Yp)) = ${r1(tpReq)} mm`);
    add('placa', 'Placa delgada: flexión por líneas de fluencia', 'Guía AISC 16 §3 · φ = 0.90', demPl, phiMpl, 'kN·m', `Mu contra φ·Fy·tp²·Yp; tp,mín = ${r1(tpReq)} mm`);
    const TB = { A325:{ 12.7:53, 15.9:85, 19.1:125, 22.2:173, 25.4:227, 28.6:250 }, A490:{ 12.7:67, 15.9:106, 19.1:156, 22.2:218, 25.4:285, 28.6:357 } }[c.grado] || {};
    const kTb = Object.keys(TB).map(Number).reduce((m, x) => Math.abs(x - d) < Math.abs(m - d) ? x : m, 19.1), Tb = TB[kTb] || 0;
    const wp = bp / 2 - (dh + 1.6), aIn = 3.682 * (tp / d) ** 3 - 0.085, a = Math.max(1, 25.4 * aIn);
    const Fp = (tp * tp * pl.Fy * (0.85 * bp / 2 + 0.80 * wp) + Math.PI * d ** 3 * B.Fnt / 8) / (4 * pfiY);      // N
    const rad = pl.Fy ** 2 - 3 * (Fp / (wp * tp)) ** 2;
    const Q = rad > 0 ? wp * tp * tp / (4 * a) * Math.sqrt(rad) / 1000 : Pt;                                       // kN por perno
    const Mq1 = 2 * Math.max(0, Pt - Q) * sumH / 1000, Mq2 = 2 * Tb * sumH / 1000, phMq = 0.75 * Math.max(Mq1, Mq2);
    pasos.push(`Palanca (Kennedy modificado, Guía AISC 16): w' = bp/2 − (dh + 1.6) = ${r1(wp)} mm; a = 3.682(tp/db)³ − 0.085 = ${r1(a)} mm; F' = [tp²·Fy(0.85bp/2 + 0.80w') + π·db³·Fnt/8]/(4pfi) = ${r2(Fp / 1000)} kN; Qmáx = w'·tp²/(4a)·√(Fy² − 3(F'/(w'tp))²) = ${rad > 0 ? r2(Q) : '— (la placa no alcanza: se toma Q = Pt)'} kN`);
    pasos.push(`φMq = 0.75·máx[2(Pt − Qmáx)·Σh; 2·Tb·Σh] = 0.75·máx[${r2(Mq1)}; ${r2(Mq2)}] = ${r2(phMq)} kN·m (Tb = ${Tb} kN, pretensión mínima Tabla J3.1)`);
    add('pernos', `Pernos a tensión con palanca${todos ? ' y cortante' : ''}`, 'Guía AISC 16 §3 (Kennedy modificado) · F.2.10.3.6', Mu, phMq, 'kN·m', `Pt = ${r2(Pt)} kN, Qmáx = ${r2(Q)} kN, Tb = ${Tb} kN`);
    if(!Tb) av.push('Pernos A307: no tienen pretensión mínima; con placa delgada use A325 o A490.');
    if(aIn <= 0) av.push('La placa es muy delgada frente al perno (tp/db pequeño): la palanca es muy grande; aumente tp.');
    av.push('Placa delgada: los pernos trabajan con fuerza de palanca; deben ir pretensionados.');
  } else {
  pasos.push(`Espesor para comportamiento de placa gruesa: tp,req = √(${sis ? '1.11·Mf' : '1.11·γr·φMnp'}/(${phD}·Fy·Yp)) = ${r1(tpReq)} mm${sis ? '' : ` (γr = ${gr})`}`);
  add('placa', 'Placa gruesa: flexión por líneas de fluencia', `Guía AISC 4/16${sis ? ' · AISC 358' : ''} · φ = ${phD}`, demPl, phiMpl, 'kN·m', `exige ${sis ? '1.11·Mf' : `1.11·γr·φMnp (γr = ${gr})`}; tp,req = ${r1(tpReq)} mm`); }
  if(ras){
    // Cortante de la placa (pedido de Amo 20-nov): Vu pasa del alma a los pernos por dos planos verticales
    const hpl = db + 50, nfil = nfR + Math.ceil(nb / 2);
    add('placa', 'Fluencia por cortante de la placa', 'F.2.10.4.2 (J4-3), φ = 1.00', Vu, 1.0 * 0.6 * pl.Fy * 2 * hpl * tp / 1000, 'kN', `2 planos a cada lado del alma: Agv = 2·${hpl}·tp = ${r1(2 * hpl * tp)} mm²`);
    const Anv = 2 * (hpl - nfil * dn) * tp;
    add('placa', 'Rotura por cortante de la placa (por la línea de pernos)', 'F.2.10.4.2 (J4-4), φ = 0.75', Vu, 0.75 * 0.6 * pl.Fu * Anv / 1000, 'kN', `Anv = 2·(${hpl} − ${nfil}·${r1(dn)})·tp = ${r1(Anv)} mm²`); }
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
    // Chapa a ras: Yc de Eatherton y Murray (Virginia Tech, = Guías AISC 4 + 16 unificadas 2021), Tablas 3-1 y 3-4, confirmadas con
    // capturas de Amo (24-nov). c = pb (separación entre filas). En el tope de la columna de = tf + pfi (ala superior de la viga al ras del tope).
    const deC = tbf + pfi;
    if(ras) Yc = nfR === 1
      ? (c.colTope ? cl.bf / 2 * (h1 / sC - 0.5) + 2 / g * (h1 * (sC + deC)) + g / 4 : cl.bf * h1 / sC + 4 * h1 * sC / g)
      : (c.colTope ? cl.bf / 2 * (h2 / sC - 0.5) + 2 / g * (h1 * (deC + 3 * pb / 4) + h2 * (sC + pb / 4)) + 3 * g / 4
                   : cl.bf / 2 * (h1 / sC + h2 / sC) + 2 / g * (h1 * (sC + 3 * pb / 4) + h2 * (sC + pb / 4)) + g / 2);
    else if(e8) Yc = cl.bf / 2 * (H.h1 / sC + H.h4 / sC) + 2 / g * (H.h1 * (pb + cc / 2 + sC) + H.h2 * (pb / 2 + cc / 4) + H.h3 * (pb / 2 + cc / 2) + H.h4 * sC) + g / 2;   // AISC 358-22 Tabla 6.6 sin rigidizar (8ES), confirmada 20-nov
    else Yc = cl.bf / 2 * (h1 / sC + h0 / sC) + 2 / g * (h1 * (sC + 3 * cc / 4) + h0 * (sC + cc / 4) + cc * cc / 2) + g / 2;
    // Chapa a ras: la T equivalente con palanca (Manual AISC parte 9) queda solo como referencia (antes se usaba el menor; 24-nov).
    if(ras){
      const B = 0.75 * Pt, bb = g / 2 - cl.tw / 2, aa = Math.min((cl.bf - g) / 2, 1.25 * bb), bpr = bb - d / 2, apr = aa + d / 2, rho = bpr / apr;
      const pp = (2 * sC + (nfR - 1) * pb) / nfR, delta = 1 - agujero(d) / pp;
      const tcT = Math.sqrt(4 * B * 1000 * bpr / (0.9 * pp * ac.Fu));
      let alT = (1 / (delta * (1 + rho))) * ((tcT / cl.tf) ** 2 - 1); alT = Math.max(0, Math.min(1, alT));
      const QT = cl.tf >= tcT ? 1 : Math.min(1, (cl.tf / tcT) ** 2 * (1 + delta * alT));
      const phiMT = 2 * B * QT * sumH / 1000, YcT = phiMT * 1e6 / (phD * ac.Fy * cl.tf * cl.tf);
      pasos.push(`Ala de la columna a ras: Yc = ${Math.round(Yc)} mm (líneas de fluencia, ${nfR === 1 ? 'Tabla 3-1' : 'Tabla 3-4'} de Eatherton y Murray = Guías AISC 4/16, ${c.colTope ? `tope de la columna sin rigidizar, de = tf + pfi = ${r1(deC)} mm` : 'columna continua sin rigidizar'}${nfR === 2 ? `, c = pb = ${pb} mm` : ''}). Referencia: como T equivalente con palanca (Manual AISC parte 9: b = ${r1(bb)}, a = ${r1(aa)}, p = ${r1(pp)} mm, B = ${r2(B)} kN, Q = ${r3(QT)}) daría φM = ${r2(phiMT)} kN·m (Yc ≈ ${Math.round(YcT)} mm)`);
    }
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
      const ar = ACEROS[c.aceroRigC] || ACEROS.A36, KC = corteEsq(cl, sis), clip = KC.ala, bsMax = (cl.bf - cl.tw) / 2;
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
      const LwT = Lr - 2 * KC.alma, Vp0 = !dos ? Ffu : opuesto ? Math.abs(Ffu - F2) : Ffu + F2, DB = doublerTd(c, cl, ac, Vp0, 0.9 * 0.6 * ac.Fy * dc * cl.tw / 1000, vg.d - 2 * vg.tf, sis);
      const PA = { c, cl, ac, ar, ts, Lw:LwT, Fst, capA:capT(ts), Rv:DB.Rv, sis, FEXX, tdp:DB.tdp };
      const demW = demPlacasAlma(PA).dem;
      const wsReq = Math.max(wsMin, ...[3, 5, 6, 8, 10, 12, 14, 16].filter(w => 1.5 * fwr(w) * 4 * (bs - clip) >= Fst).slice(0, 1), wsAlmaAuto(FEXX, demW, LwT, cl.tw, wsMin));
      const ws = +c.wsC > 0 ? +c.wsC : wsReq;
      rig = { bs, ts, ws, Lr, clip, corte:KC };
      pasos.push(`Rigidizadores de la columna (${c.rigCol === 'si' ? 'pedidos' : sisPide ? 'exigidos con sismo' : 'necesarios'}): fuerza que deben tomar Rst = ${r2(Fst)} kN${faltas.filter(([, R, F]) => F > R).length ? ` (falla sin ellos: ${faltas.filter(([, R, F]) => F > R).map(([n]) => n).join(', ')})` : ''}`);
      pasos.push(`2 placas por cada ala de la viga (una a cada lado del alma): ${bs} × ${ts} mm, largo ${r1(Lr)} mm, ${c.aceroRigC || 'A36'}, corte de esquinas ${KC.ala} × ${KC.alma} mm (ala × alma); filetes de ${ws} mm`);
      // ala de la columna rigidizada: Yc con placas de continuidad (AISC 358 Tablas 6.5/6.6), pso = psi = (c − ts)/2
      // a ras: la placa queda a la altura del ala de la viga y la fila interior a psi = pfi + tf/2 − ts/2 de ella
      const ps = Math.max(ras ? pfi + tbf / 2 - ts / 2 : (cc - ts) / 2, 1);
      let YcS;
      if(e8) YcS = cl.bf / 2 * (H.h1 / sC + H.h2 / ps + H.h3 / ps + H.h4 / sC) + 2 / g * (H.h1 * (sC + pb / 4) + H.h2 * (ps + 3 * pb / 4) + H.h3 * (ps + pb / 4) + H.h4 * (sC + 3 * pb / 4) + pb * pb) + g;   // AISC 358-22 Tabla 6.6 rigidizada (8ES), confirmada 20-nov (el término final es pb², por unidades)
      // a ras (Tablas 3-1 y 3-4, confirmadas 24-nov): 2 pernos «Continuous Stiffened»; 4 pernos «Stiffened Above the Bolts»
      // (placa de continuidad a la altura del ala de la viga). En el tope con placa de tapa la fórmula es la misma con pcp = psi. psi ≤ s.
      else if(ras){ const pr = Math.min(ps, sC); YcS = nfR === 1 ? cl.bf / 2 * (h1 * (1 / pr + 1 / sC)) + 2 / g * (h1 * (pr + sC))
        : cl.bf / 2 * (h1 / pr + h2 / sC) + 2 / g * (h1 * (pr + 3 * pb / 4) + h2 * (sC + pb / 4)) + g / 2; }
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
      placasAlAlma({ ...PA, ws, add, req, av, pasos, grupo:'soldadura' }); }
      else pasos.push('El alma no necesita fuerza adicional: los rigidizadores van con las dimensiones mínimas de J10.8 para que el ala de la columna trabaje como placa gruesa (sin palanca en los pernos).');
      req.push(['Rigidizador: bs + tw/2 ≥ bf de la viga/3 (J10.8)', bs >= bsMin - 1e-6, `${bs} ≥ ${r1(bsMin)} mm`]);
      req.push(['Rigidizador: bs ≤ (bfc − twc)/2 (cabe en el ala)', bs <= bsMax + 1e-6, `${bs} ≤ ${r1(bsMax)} mm`]);
      req.push(['Rigidizador: ts ≥ tf de la viga/2 (J10.8)', ts >= tbf / 2 - 1e-6, `${ts} ≥ ${r1(tbf / 2)} mm`]);
      req.push(['Rigidizador: bs/ts ≤ 0.56·√(E/Fy) (J10.8)', bs / ts <= 0.56 * Math.sqrt(E / ar.Fy) + 1e-6, `${r1(bs / ts)} ≤ ${r1(0.56 * Math.sqrt(E / ar.Fy))}`]);
      if(sisPide) req.push([`Con sismo: placas de continuidad ts ≥ ${dos ? 'tf de la viga (conexión a los dos lados)' : 'tf/2 de la viga'} (AISC 341 E3.6f)`, ts >= (dos ? tbf : tbf / 2) - 1e-6, `${ts} mm`]);
      req.push(['Filete de los rigidizadores ≥ mín. Tabla J2.4', ws >= wsMin, `${ws} ≥ ${wsMin} mm`]);
      req.push(reqCorte(KC));
    }
    // d) zona de panel: una viga, suma (mismo sentido) o diferencia (opuestos)
    const Vp = !dos ? Ffu : opuesto ? Math.abs(Ffu - F2) : Ffu + F2, Rv = 0.9 * 0.6 * ac.Fy * dc * cl.tw / 1000;
    panelConDoubler({ c, cl, ac, Vp, Rv0:Rv, dz:vg.d - 2 * vg.tf, sis:['DMO', 'DES'].includes(c.sismo), add, req, av, pasos, grupo:'columna', nomCh:'Zona de panel (cortante del alma)', ref:'F.2.10.10.6 (J10-9), φ = 0.90', txt:`${!dos ? 'Ffu' : opuesto ? '|F₁ − F₂|' : 'F₁ + F₂'} contra 0.6·Fy·dc·tw (sin cortante de la columna)`, FEXX:ELECTRODOS[c.electrodo] || 483, cont:usar });
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
    tpw:8, hpw:210, nw:3, sw:65, Lew:38, Lehw:40, ncw:1, gw:75,      // ncw = columnas de pernos del alma a cada lado (1 o 2), gw = separación entre ellas
    d:19.1, grado:'A325', rosca:'N',
    interior:false, tpi:10, bpi:'',                 // cubrejuntas interiores de las alas (pedido de Amo 20-nov)
    desliz:false, claseSup:'A',                      // pernos de deslizamiento crítico (J3-8)
    resComp:false,                                   // empalme a resistencia completa de la viga
    sismo:'no', xEmp:'' };                           // sismo del proyecto (21-nov) y distancia del empalme a la cara de la columna [mm]
}
// Pretensión mínima Tb [kN] (Tabla J3.1)
const PRETEN = { A325:{ 12.7:53, 15.9:85, 19.1:125, 22.2:173, 25.4:227, 28.6:250 }, A490:{ 12.7:67, 15.9:106, 19.1:156, 22.2:218, 25.4:285, 28.6:357 } };
const pretension = (grado, d) => { const T = PRETEN[grado] || {}; const k = Object.keys(T).map(Number).reduce((m, x) => Math.abs(x - d) < Math.abs(m - d) ? x : m, 19.1); return T[k] || 0; };
function calcEmpalme(c, sinSug){
  const ch = [], av = [], pasos = [], req = [], add = addF(ch);
  let Mu = Math.abs(+c.Mu || 0), V = Math.abs(+c.Vu || 0); const d = +c.d, gap = +c.gap || 0;
  const vg = perfilX(c.viga); if(!vg) return { error:'Escoja el perfil de la viga.' };
  const pl = ACEROS[c.aceroPl], ac = ACEROS[c.aceroViga];
  // Resistencia completa (pedido de Amo 20-nov): el empalme se diseña para lo máximo que la viga puede llevar en esa sección
  const dnA = anchoNeto(d), AfgA = vg.bf * vg.tf, AfnA = (vg.bf - 2 * dnA) * vg.tf, YtA = ac.Fy / ac.Fu <= 0.8 ? 1.0 : 1.1;
  const phMp = 0.9 * ac.Fy * vg.Zx / 1e6, phMf13 = ac.Fu * AfnA < YtA * ac.Fy * AfgA ? 0.9 * ac.Fu * AfnA / AfgA * vg.Sx / 1e6 : Infinity;
  const hw = vg.d - 2 * vg.tf - 2 * (vg.r || 0), phiV = hw / vg.tw <= 2.24 * Math.sqrt(200000 / ac.Fy) ? 1.0 : 0.9, phVn = phiV * 0.6 * ac.Fy * vg.d * vg.tw / 1000;
  const MuM = Mu, VM = V;
  if(c.resComp){ Mu = Math.min(phMp, phMf13); V = phVn; }
  const dh = agujero(d), dn = anchoNeto(d), bm = bordeMin(d), rv = fv(c, d);
  if(c.resComp) pasos.push(`Empalme a resistencia completa: se diseña con lo máximo que la viga puede llevar en la sección del empalme. Momento: mín(φMp = 0.9·Fy·Zx = ${r2(phMp)}; ${isFinite(phMf13) ? `φMn por los agujeros del ala (F13-1) = ${r2(phMf13)}` : 'los agujeros no reducen (F13.1)'}) = ${r2(Mu)} kN·m (del modelo ${r2(MuM)}). Cortante: φVn = ${phiV}·0.6·Fy·d·tw = ${r2(V)} kN (del modelo ${r2(VM)}).`);
  // Alas: cubrejunta exterior y, si se pide, dos interiores (una a cada lado del alma) → pernos en doble cortante
  const tpf = +c.tpf, bpf = +c.bpf, nf = Math.max(1, Math.round(+c.nf)), sf = +c.sf, gf = +c.gf, Lef = +c.Lef, nbF = 2 * nf;      // 2 columnas por lado
  const inter = !!c.interior, tpi = +c.tpi || 0, x0I = vg.tw / 2 + (vg.r || 0) + 3;
  const bpi = +c.bpi > 0 ? +c.bpi : Math.floor((vg.bf / 2 - x0I) / 5) * 5;     // vacío = el ancho que cabe entre el radio y el borde del ala
  const Ao = bpf * tpf, Ai = inter ? 2 * bpi * tpi : 0;
  const yo = vg.d / 2 + tpf / 2, yi = vg.d / 2 - vg.tf - tpi / 2, brazo = inter ? 2 * (Ao * yo + Ai * yi) / (Ao + Ai) : vg.d + tpf;
  const Ff = Mu * 1000 / brazo, Fo = Ff * Ao / (Ao + Ai), Fi = Ff - Fo;
  pasos.push(inter
    ? `Cubrejunta exterior ${bpf} × ${tpf} mm + 2 interiores ${bpi} × ${tpi} mm: brazo entre centroides = ${r1(brazo)} mm → Ff = Mu/brazo = ${r2(Ff)} kN; se reparte por área: exterior ${r2(Fo)} kN, interiores ${r2(Fi)} kN (el alma solo toma el cortante)`
    : `Fuerza en cada ala Ff = Mu/(d + tpf) = ${r2(Ff)} kN (el alma solo toma el cortante)`);
  // Pernos de las alas: con interiores trabajan en doble cortante; el ala de la viga queda en medio y lleva toda la fuerza
  const ns = inter ? 2 : 1, Tb = pretension(c.grado, d), mu = c.claseSup === 'B' ? 0.50 : 0.30;
  const bPlE = aplast(Lef - dh / 2, tpf, d, pl.Fu).phiRn, bPlI = aplast(sf - dh, tpf, d, pl.Fu).phiRn;
  const biE = inter ? 2 * aplast(Lef - dh / 2, tpi, d, pl.Fu).phiRn / 2 : 0, biI = inter ? 2 * aplast(sf - dh, tpi, d, pl.Fu).phiRn / 2 : 0;   // por perno: una interior
  const bFlE = aplast(Lef - dh / 2, vg.tf, d, ac.Fu).phiRn, bFlI = aplast(sf - dh, vg.tf, d, ac.Fu).phiRn;
  const porPerno = (bP, bI, bF) => Math.min(ns * rv, bF, bP + bI);
  const capF = 2 * (porPerno(bPlE, biE, bFlE) + (nf - 1) * porPerno(bPlI, biI, bFlI));
  add('pernos', `Pernos de un ala, a cada lado (${nbF}, ${inter ? 'doble' : 'simple'} cortante)`, 'F.2.10.3.6 y F.2.10.3.10', Ff, capF, 'kN',
    `corte ${r2(ns * rv)} kN/perno; aplast. cubrejunta${inter ? 's' : ''} ${r2(bPlE + biE)}/${r2(bPlI + biI)}, ala ${r2(bFlE)}/${r2(bFlI)} kN`);
  // Deslizamiento crítico (J3-8): φ = 1.0 (agujeros estándar), Du = 1.13, hf = 1
    if(c.desliz){
    pasos.push(`Deslizamiento crítico (J3-8): φRn = φ·μ·Du·hf·Tb·ns = 1.0·${mu}·1.13·1·${Tb} kN = ${r2(1.0 * mu * 1.13 * Tb)} kN por plano (superficie clase ${c.claseSup === 'B' ? 'B' : 'A'})`);
    add('pernos', `Deslizamiento de los pernos de un ala (${nbF}, ${ns} plano${ns > 1 ? 's' : ''})`, 'F.2.10.3.8 (J3-4), φ = 1.00', Ff, nbF * ns * 1.0 * mu * 1.13 * Tb, 'kN', `μ = ${mu}, Tb = ${Tb} kN`);
    if(!Tb) av.push('Pernos A307: no se pueden usar como deslizamiento crítico (no tienen pretensión).');
  }
  const Ag = Ao, An = Math.min((bpf - 2 * dn) * tpf, 0.85 * Ag);
  add('alas', 'Cubrejunta exterior: fluencia a tensión', 'F.2.10.4.1 (J4-1)', Fo, 0.9 * pl.Fy * Ag / 1000, 'kN', `Ag = ${r1(Ag)} mm²`);
  add('alas', 'Cubrejunta exterior: rotura a tensión', 'F.2.10.4.1 (J4-2), An ≤ 0.85Ag', Fo, 0.75 * pl.Fu * An / 1000, 'kN', `An = ${r1(An)} mm²`);
  const KLr = 0.65 * (gap + 2 * Lef) / (tpf / Math.sqrt(12));
  add('alas', 'Cubrejunta exterior: compresión', 'F.2.10.4.4 (J4-6) / E3', Fo, 0.9 * fcrE3(pl.Fy, KLr) * Ag / 1000, 'kN', `KL/r = 0.65·(gap + 2Lef)/r = ${r1(KLr)}`);
  const agvP = 2 * (Lef + (nf - 1) * sf) * tpf, anvP = agvP - 2 * (nf - 0.5) * dn * tpf, antP = (gf - dn) * tpf;
  add('alas', 'Cubrejunta exterior: bloque de cortante', 'F.2.10.4.3 (J4-5)', Fo, bloqueRn(pl.Fy, pl.Fu, agvP, anvP, antP), 'kN', `bloque entre las dos líneas de pernos`);
  const antP2 = 2 * ((bpf - gf) / 2 - dn / 2) * tpf;
  add('alas', 'Cubrejunta exterior: bloque por los bordes', 'F.2.10.4.3 (J4-5)', Fo, bloqueRn(pl.Fy, pl.Fu, agvP, anvP, antP2), 'kN', `tensión hacia los bordes exteriores`);
  if(inter){
    const x0 = x0I, eI = x0 + bpi - gf / 2, eW = gf / 2 - x0;           // bordes de la interior: hacia afuera y hacia el alma
    const AgI = Ai, AnI = Math.min(2 * (bpi - dn) * tpi, 0.85 * AgI);
    add('alas', 'Cubrejuntas interiores (2): fluencia a tensión', 'F.2.10.4.1 (J4-1)', Fi, 0.9 * pl.Fy * AgI / 1000, 'kN', `Ag = 2·${bpi}·${tpi} = ${r1(AgI)} mm²`);
    add('alas', 'Cubrejuntas interiores (2): rotura a tensión', 'F.2.10.4.1 (J4-2), An ≤ 0.85Ag', Fi, 0.75 * pl.Fu * AnI / 1000, 'kN', `An = ${r1(AnI)} mm²`);
    const KLi = 0.65 * (gap + 2 * Lef) / (tpi / Math.sqrt(12));
    add('alas', 'Cubrejuntas interiores (2): compresión', 'F.2.10.4.4 (J4-6) / E3', Fi, 0.9 * fcrE3(pl.Fy, KLi) * AgI / 1000, 'kN', `KL/r = ${r1(KLi)}`);
    const agvI = 2 * (Lef + (nf - 1) * sf) * tpi, anvI = agvI - 2 * (nf - 0.5) * dn * tpi, antI = 2 * (Math.min(eI, eW) - dn / 2) * tpi;
    add('alas', 'Cubrejuntas interiores (2): bloque de cortante', 'F.2.10.4.3 (J4-5)', Fi, bloqueRn(pl.Fy, pl.Fu, agvI, anvI, antI), 'kN', `una línea de pernos por placa; borde menor ${r1(Math.min(eI, eW))} mm`);
    req.push(['Cubrejunta interior cabe en el ala: tw/2 + r + bpi ≤ bf/2', x0 + bpi <= vg.bf / 2 + 1e-6, `${r1(x0 + bpi)} ≤ ${r1(vg.bf / 2)} mm`]);
    req.push(['Bordes de la cubrejunta interior ≥ mín.', Math.min(eI, eW) >= bm, `${r1(Math.min(eI, eW))} ≥ ${bm} mm${eW < bm ? ` (hacia el alma: aumente el gramil gf a ≥ ${Math.ceil(2 * (x0 + bm))} mm)` : ''}`]);
  }
  const agvF = 2 * (Lef + (nf - 1) * sf) * vg.tf, anvF = agvF - 2 * (nf - 0.5) * dn * vg.tf, antF = 2 * ((vg.bf - gf) / 2 - dn / 2) * vg.tf;
  add('alas', 'Ala de la viga: bloque de cortante', 'F.2.10.4.3 (J4-5)', Ff, bloqueRn(ac.Fy, ac.Fu, agvF, anvF, antF), 'kN', `hacia los bordes del ala`);
  const Afg = vg.bf * vg.tf, Afn = (vg.bf - 2 * dn) * vg.tf, Yt = ac.Fy / ac.Fu <= 0.8 ? 1.0 : 1.1;
  if(c.resComp) pasos.push('Con resistencia completa el momento de diseño ya es el que permite la sección con agujeros (F13-1); no se repite el chequeo de la viga.');
  else if(ac.Fu * Afn < Yt * ac.Fy * Afg){ const Mn = ac.Fu * Afn / Afg * vg.Sx / 1e6;
    add('viga', 'Viga: rotura del ala en tensión por los agujeros', 'F.2.6.13.1 (F13-1)', Mu, 0.9 * Mn, 'kN·m', `Fu·Afn < Yt·Fy·Afg → Mn = Fu·Afn/Afg·Sx`); }
  else pasos.push(`Ala en tensión: Fu·Afn = ${r1(ac.Fu * Afn / 1000)} ≥ Yt·Fy·Afg = ${r1(Yt * ac.Fy * Afg / 1000)} kN → no reduce la resistencia (F13.1)`);
  // Alma
  const tpw = +c.tpw, hpw = +c.hpw, nw = Math.max(1, Math.round(+c.nw)), sw = +c.sw, Lew = +c.Lew, Lehw = +c.Lehw;
  const ncw = +c.ncw === 2 ? 2 : 1, gw = ncw === 2 ? +c.gw || 0 : 0;   // 1 o 2 columnas de pernos a cada lado de la junta (pedido de Amo 20-nov)
  const ew = gap / 2 + Lehw + gw / 2;                        // excentricidad del cortante al centro del grupo de pernos
  const pts = []; for(let j = 0; j < ncw; j++) for(let i = 0; i < nw; i++) pts.push({ x:j * gw, y:i * sw });
  const ic = icr(pts, ew, 0), nTw = ncw * nw;
  const bWp = aplast(Lew - dh / 2, tpw, d, pl.Fu).phiRn, bWb = 0.75 * 2.4 * d * vg.tw * ac.Fu / 1000;
  const rW = Math.min(2 * rv, 2 * bWp, bWb);
  pasos.push(`Alma: 2 cubrejuntas ${hpw} × ${tpw} mm; ${ncw === 2 ? `2 columnas de ${nw} pernos (${nTw}) separadas gw = ${gw} mm` : `${nw} pernos en una columna`} a cada lado (doble cortante) con e = gap/2 + Leh${ncw === 2 ? ' + gw/2' : ''} = ${r1(ew)} mm → C = ${r2(ic.C)} (centro instantáneo)`);
  add('pernos', `Pernos del alma, a cada lado (${ncw === 2 ? `2 × ${nw}` : nw}, doble cortante, excéntricos)`, 'F.2.10.3 · Manual AISC parte 7', V, ic.C * rW, 'kN', `C = ${r2(ic.C)} · φrn = ${r2(rW)} kN`);
  if(c.desliz) add('pernos', `Deslizamiento de los pernos del alma (${nTw}, 2 planos, excéntricos)`, 'F.2.10.3.8 (J3-4), φ = 1.00', V, ic.C * 2 * 1.0 * mu * 1.13 * Tb, 'kN', `C = ${r2(ic.C)} · ${r2(2 * mu * 1.13 * Tb)} kN por perno`);
  add('almaPl', 'Cubrejuntas del alma: fluencia por cortante (2)', 'F.2.10.4.2 (J4-3)', V, 0.6 * pl.Fy * 2 * hpw * tpw / 1000, 'kN', '');
  add('almaPl', 'Cubrejuntas del alma: rotura por cortante (2)', 'F.2.10.4.2 (J4-4)', V, 0.75 * 0.6 * pl.Fu * 2 * (hpw - nw * dn) * tpw / 1000, 'kN', '');
  const Mw = V * ew / 1000, Zw = 2 * tpw * hpw * hpw / 4;
  add('almaPl', 'Cubrejuntas del alma: flexión por la excentricidad', 'F.2.6 · φb = 0.90', Mw, 0.9 * pl.Fy * Zw / 1e6, 'kN·m', `Mu = Vu·e = ${r3(Mw)} kN·m`);
  if(!c.resComp) add('viga', 'Cortante del alma de la viga', 'F.2.7.2 (G2-1)', V, phVn, 'kN', `φv = ${phiV}`);
  // Bloque de cortante de las cubrejuntas del alma (pedido de Amo 20-nov): se arranca la parte entre la línea de pernos y el borde vertical
  { const agv = (Lew + (nw - 1) * sw) * tpw, anv = agv - (nw - 0.5) * dn * tpw, ant = (Lew + gw - (ncw - 0.5) * dn) * tpw;   // con 2 columnas la línea de tensión cruza los dos agujeros
    add('almaPl', 'Cubrejuntas del alma: bloque de cortante (2)', 'F.2.10.4.3 (J4-5)', V, 2 * bloqueRn(pl.Fy, pl.Fu, agv, anv, ant), 'kN', `por placa: Agv = ${r1(agv)}, Anv = ${r1(anv)}, Ant = ${r1(ant)} mm²`); }
  req.push(['Cubrejunta del ala bpf ≤ bf de la viga', bpf <= vg.bf + 1e-6, `${bpf} ≤ ${vg.bf} mm`]);
  req.push(['Bordes de la cubrejunta del ala (bpf − gf)/2 y Lef ≥ mín.', Math.min((bpf - gf) / 2, Lef) >= bm, `${r1(Math.min((bpf - gf) / 2, Lef))} ≥ ${bm} mm`]);
  req.push(['Cubrejunta del alma cabe entre las alas: hpw ≤ T', hpw <= vg.T + 1e-6, `${hpw} ≤ ${r1(vg.T)} mm`]);
  req.push(['Pernos del alma caben: (nw − 1)·sw + 2·Lew ≤ hpw', (nw - 1) * sw + 2 * Lew <= hpw + 1e-6, `${(nw - 1) * sw + 2 * Lew} ≤ ${hpw} mm`]);
  req.push(['Separaciones ≥ 2.67d', Math.min(sf, sw, ncw === 2 ? gw : Infinity) >= 2.67 * d - 1e-6, `${Math.min(sf, sw, ncw === 2 ? gw : Infinity)} ≥ ${r1(2.67 * d)} mm`]);
  if(ncw === 2) pasos.push(`Cubrejunta del alma: largo total = 2·(Lehw + gw + Lew) + gap = ${r1(2 * (Lehw + gw + Lew) + gap)} mm`);
  req.push([c.desliz ? `Pernos de deslizamiento crítico, superficies clase ${c.claseSup === 'B' ? 'B' : 'A'} (sin pintura en las caras de contacto)` : 'Pernos pretensionados (empalme a momento)', true, 'indicar en planos']);
  if(c.desliz && c.grado === 'A307') req.push(['Deslizamiento crítico requiere A325 o A490', false, 'A307']);
  if(['DMO', 'DES'].includes(c.sismo)){   // pedido de Amo 21-nov (NSR-10 F.3 = AISC 341-10)
    const xE = nz(c.xEmp);
    pasos.push(`Sismo ${c.sismo}: el empalme debe quedar fuera de la zona protegida de la viga (rótula plástica); sus pernos son pretensionados con superficies de contacto clase A o mejor (AISC 341 D2.2).`);
    req.push([`Sismo ${c.sismo}: empalme fuera de la zona protegida (a más de d de la cara de la columna)`, xE > 0 ? xE >= vg.d - 1e-6 : true, xE > 0 ? `${xE} ≥ ${vg.d} mm` : 'escriba la distancia; si no, indicar en planos']);
    req.push(['Sismo: pernos pretensionados, agujeros estándar y superficies de contacto clase A o mejor (AISC 341 D2.2)', true, 'indicar en planos']);
    av.push('Sismo: si el empalme queda cerca de la rótula, revíselo con el momento probable de la viga (Mpr = 1.1·Ry·Fy·Zx), no solo con el del modelo; «Diseñar a resistencia completa» lo cubre.');
  }
  const R = fin(ch, req, av, pasos, { vg, dh, Ff, ic, inter, bpi, tpi });
  // 💡 Sugerencia (pedido de Amo 20-nov): menos pernos y cubrejuntas más delgadas que cumplan; alas y alma se buscan por separado
  if(!sinSug){
    const ESP = [6.4, 8, 9.5, 12.7, 15.9, 19.1, 22.2, 25.4];
    const esAla = x => x.grupo === 'alas' || /un ala/.test(x.nombre), esAlma = x => x.grupo === 'almaPl' || /del alma/.test(x.nombre);
    const okParte = (o, parte) => { const r = calcEmpalme({ ...c, ...o }, true); if(r.error) return false;
      const f = parte === 'ala' ? esAla : esAlma, rq = parte === 'ala' ? (t => /ala/.test(t) && !/alma/.test(t)) : (t => /alma/.test(t));
      return r.ch.filter(f).every(x => x.ratio <= 1) && r.req.filter(x => rq(x[0])).every(x => x[1]); };
    let best = null; const gfMin = inter ? Math.ceil(2 * (x0I + bm) / 5) * 5 : 0, base = {};
    if(gfMin > gf && gfMin <= vg.bf - 2 * bm){ base.gf = gfMin; if((bpf - gfMin) / 2 < bm) base.bpf = Math.min(vg.bf, Math.ceil((gfMin + 2 * bm) / 5) * 5); }
    for(let nfS = 1; nfS <= 6 && !best; nfS++) for(const t of ESP){ const o = { ...base, nf:nfS, tpf:t }; if(okParte(o, 'ala')){ best = o; break; } }
    const hpwMax = Math.floor(vg.T / 5) * 5, swMin = Math.ceil(2.67 * d / 5) * 5;
    let bw = null;
    const gwS = Math.max(+c.gw || 0, Math.ceil(2.67 * d / 5) * 5, 60);
    for(const geo of [{}, { hpw:hpwMax }, { hpw:hpwMax, sw:swMin }, { ncw:2, gw:gwS }, { ncw:2, gw:gwS, hpw:hpwMax }, { ncw:2, gw:gwS, hpw:hpwMax, sw:swMin }]){ for(let nwS = 2; nwS <= 8 && !bw; nwS++) for(const t of ESP.filter(x => x <= 12.7)){ const o = { ...geo, nw:nwS, tpw:t }; if(okParte(o, 'alma')){ bw = o; break; } } if(bw) break; }
    const todo = { ...(best || {}), ...(bw || {}) }, cambia = Object.keys(todo).some(k => +todo[k] !== +c[k]);
    if(cambia){ const t1 = best ? `${best.nf} filas por lado en las alas con cubrejunta de ${best.tpf} mm${best.gf ? ` (gramil ${best.gf} mm${best.bpf ? `, ancho ${best.bpf} mm` : ''})` : ''}` : '';
      const t2 = bw ? `${+(bw.ncw ?? c.ncw) === 2 ? `2 columnas de ${bw.nw} pernos (gw ${bw.gw ?? c.gw} mm)` : `${bw.nw} pernos`} por lado en el alma con cubrejuntas de ${bw.tpw} mm${bw.hpw ? ` de ${bw.hpw} mm de alto` : ''}${bw.sw ? ` y separación ${bw.sw} mm` : ''}` : '';
      R.sug = { tipo:'sold', ok:true, ...todo, txt:`💡 Usar ${[t1, t2].filter(Boolean).join(' y ')}` }; }
    if(!best){ if(R.ch.some(x => x.grupo === 'viga' && x.ratio > 1)) R.av.push('La viga misma no resiste las fuerzas en la zona del empalme (ver «Viga»): no hay cubrejuntas que lo arreglen; revise el perfil o mueva el empalme.');
      else if(inter) R.av.push(`El ala de la viga (${vg.bf} mm) es angosta para cubrejuntas interiores con pernos de ${d} mm: los pernos no caben con los bordes mínimos a cada lado del alma. Use pernos más pequeños o solo la cubrejunta exterior.`);
      else R.av.push('Alas: con el diámetro y los anchos actuales no se encontró una combinación que cumpla (hasta 6 filas y 25.4 mm): aumente el diámetro de los pernos o use cubrejuntas interiores.'); }
    if(!bw) R.av.push(`Alma: ni con dos columnas de pernos de ${d} mm por lado se alcanza${c.resComp ? ' la resistencia completa a cortante de la viga' : ' el cortante'} (caben hasta ${Math.floor((hpwMax - 2 * c.Lew) / swMin) + 1} pernos por columna en ${hpwMax} mm): use pernos más grandes, un perfil de alma más gruesa o menos cortante de diseño.`);
  }
  return R;
}

// ── Diagonal de angular(es) atornillada a una cartela soldada ─────────────
function defaultsCartela(){
  return { tipo:'cartela', nom:'', desc:'', Pu:150, nL:2, bL:76, tL:6.4, aceroL:'A36', n:3, s:65, Le:38, ga:45,
    tg:9.5, aceroG:'A36', Lcr:150, K:0.65, theta:45, Lwg:250, w:6, electrodo:'E70XX', d:19.1, grado:'A325', rosca:'N',
    // Diagonal de tubo cuadrado ranurado y soldado a la cartela (opción A de Amo, 20-nov)
    diag:'L', Bt:100, Dt:114.3, tt:4.8, aceroT:'A500 Gr C', Lws:150, wt:4,
    // Revisión con Amo (20-nov, puntos 1–8)
    Leg:38, bWg:'', duct:true, eW:0, sismo:'no', Pnd:'',
    // Platinas de refuerzo en la ranura del tubo cuadrado (27-nov, pedido de Amo; AISC 341 F2.5b): 2 platinas sobre las caras sin ranura
    rRef:false, bRf:100, tRf:6.4, LRf:'', aceroRf:'A572 Gr 50', wRf:4 };
}
function calcCartela0(c){
  const ch = [], av = [], pasos = [], req = [], add = addF(ch);
  const P = +c.Pu || 0, Pa = Math.abs(P), d = +c.d, n = Math.max(1, Math.round(+c.n)), s = +c.s, Le = +c.Le, b = +c.bL, t = +c.tL, nL = +c.nL === 1 ? 1 : 2, ga = +c.ga, tg = +c.tg;
  const aL = ACEROS[c.aceroL], ag = ACEROS[c.aceroG], FEXX = ELECTRODOS[c.electrodo];
  const dh = agujero(d), dn = anchoNeto(d), bm = bordeMin(d), rv = fv(c, d);
  const tub = esTubo(c), red = c.diag === 'redondo';
  let Lw, U = 0, xb = 0, LRg = 0;
  if(tub){
    // Tubo cuadrado B × t o redondo D × t (24-nov) ranurado en dos caras opuestas; la cartela entra por la ranura y se suelda con 4 filetes longitudinales de largo Lws
    const B = red ? +c.Dt : +c.Bt, td = 0.93 * +c.tt, at = ACEROS[c.aceroT] || ACEROS['A500 Gr C'], Lws = +c.Lws, wt = +c.wt, sl = tg + 3;
    const AgT = diagDe(c).Ag, AnT = AgT - 2 * td * sl;
    if(red){                                                         // Tabla D3.1 caso 5 (tubo redondo con una cartela concéntrica)
      xb = B / Math.PI;
      U = Lws >= 1.3 * B ? 1 : Lws >= B ? 1 - xb / Lws : Math.max(0, 1 - xb / Math.max(Lws, 1));
    } else {
      xb = (B * B + 2 * B * B) / (4 * (B + B));                     // Tabla D3.1 caso 6 (una cartela concéntrica): x̄ = (B² + 2BH)/(4(B + H))
      U = Lws > 0 ? Math.max(0, 1 - xb / Lws) : 0;
    }
    const AeT = U * AnT, nomT = red ? `redondo ⌀${B}×${c.tt}` : `${B}×${B}×${c.tt}`, casoU = red ? 'Tabla D3.1 caso 5' : 'Tabla D3.1 caso 6';
    pasos.push(`Diagonal tubo ${nomT} mm (${c.aceroT}; espesor de diseño 0.93t = ${r2(td)} mm): Ag = ${r1(AgT)} mm²; Pu = ${r2(P)} kN (${P >= 0 ? 'tensión' : 'compresión'})`);
    pasos.push(`Ranura en dos caras opuestas de ancho tg + 3 = ${r1(sl)} mm → An = Ag − 2·t·ancho = ${r1(AnT)} mm²; x̄ = ${red ? 'D/π' : '(B² + 2BH)/(4(B + H))'} = ${r1(xb)} mm, l = ${Lws} mm → U = ${red && Lws >= 1.3 * B ? '1.0 (l ≥ 1.3D)' : `1 − x̄/l = ${r3(U)}`}, Ae = ${r1(AeT)} mm²`);
    // Platinas de refuerzo (27-nov): 2 platinas bR × tR sobre las caras SIN ranura, de L1 antes del fin de la ranura y L2 después
    const ref = !red && !!c.rRef, bR = +c.bRf || 100, tR = +c.tRf || 6.4, aR = ACEROS[c.aceroRf] || ACEROS['A572 Gr 50'], wR = +c.wRf || 4;
    // largo automático: lo que piden los filetes (Fy·b·t con 2 cordones + el extremo) y la pared del tubo, y al menos el ancho de la platina
    const L1 = Math.max(Lws - 25, 0), FdevR = aR.Fy * bR * tR / 1000, fwR0 = fw(FEXX, wR), vPar = 2 * Math.min(0.6 * at.Fy, 0.75 * 0.6 * at.Fu) * td / 1000;
    const L2auto = Math.ceil(Math.max(bR, (FdevR / Math.max(fwR0, 1e-9) - bR) / 2, FdevR / Math.max(vPar, 1e-9)) / 25) * 25;
    const LR = ref ? (+c.LRf || (L1 + L2auto)) : 0, L2 = Math.max(LR - L1, 0), AR = ref ? 2 * bR * tR : 0; LRg = LR;
    if(ref) pasos.push(`Platinas de refuerzo: 2 de ${bR} × ${tR} mm (${c.aceroRf}), largo ${r1(LR)} mm${+c.LRf ? '' : ' (automático)'} (${r1(L1)} mm antes y ${r1(L2)} mm después del fin de la ranura); en la sección de la ranura suman A = 2·b·t = ${r1(AR)} mm² con su Fu = ${aR.Fu} MPa.`);
    if(P > 0){
      add('diagonal', 'Fluencia a tensión del tubo', 'F.2.4.2 (D2-1)', P, 0.9 * at.Fy * AgT / 1000, 'kN', '');
      const capRf = 0.75 * aR.Fu * AR / 1000;
      add('diagonal', 'Rotura a tensión del tubo en la ranura', `F.2.4.2 (D2-2), ${casoU}${ref ? ' + platinas de refuerzo' : ''}`, P, 0.75 * at.Fu * AeT / 1000 + capRf, 'kN', `U = ${r3(U)}, Ae = ${r1(AeT)} mm²${ref ? ` + 2 platinas ${bR}×${tR} (${r1(AR)} mm²)` : ''}`);
      if(ref) ch.at(-1).capR = capRf;                                   // la parte de las platinas no lleva Rt con sismo
      if(0.75 * at.Fu * AeT / 1000 + capRf < P) av.push(ref ? 'Con las platinas de refuerzo la sección de la ranura todavía no alcanza: súbales el ancho o el espesor.' : 'La sección neta del tubo en la ranura no alcanza: active «Platinas de refuerzo en la ranura» (2 platinas soldadas a las caras sin ranura).');
      if(ref){
        const Fdev = aR.Fy * bR * tR / 1000, Lmin = Math.min(L1, L2), fwR = fw(FEXX, wR);
        pasos.push(`Cada platina debe poder desarrollar su fluencia a cada lado de la ranura: Fy·b·t = ${aR.Fy}·${bR}·${tR} = ${r2(Fdev)} kN, con 2 filetes longitudinales de L = ${r1(Lmin)} mm (el lado más corto) + el filete transversal del extremo (b).`);
        add('soldadura', 'Filetes de cada platina de refuerzo al tubo (lado más corto de la ranura)', 'F.2.10.2.4 (J2-4)', Fdev, fwR * (2 * Lmin + bR), 'kN', `w = ${wR} mm × (2·${r1(Lmin)} + ${bR}) mm`);
        add('diagonal', 'Pared del tubo junto a los filetes de las platinas (cortante)', 'F.2.10.4.2 (J4-3, J4-4)', Fdev, 2 * Math.min(1.0 * 0.6 * at.Fy, 0.75 * 0.6 * at.Fu) * td * Lmin / 1000, 'kN', `2 planos × ${r1(Lmin)} mm × t ${r2(td)} mm`);
      }
    }
    if(ref){
      const plano = B - 4 * +c.tt, tmin = Math.min(td, tR), wMinR = tmin <= 6 ? 3 : tmin <= 13 ? 5 : tmin <= 19 ? 6 : 8;
      req.push([`Platinas de refuerzo dentro de la parte plana de la cara: b ≤ B − 4t = ${r1(plano)} mm`, bR <= plano + 1e-6, `${bR} mm`]);
      req.push([`Platinas pasan al menos su ancho más allá del fin de la ranura`, L2 >= bR - 1e-6, `${r1(L2)} ≥ ${bR} mm`]);
      req.push(['Filete de las platinas ≥ mín. Tabla J2.4', wR >= wMinR, `${wR} ≥ ${wMinR} mm`]);
      req.push(['Filete de las platinas ≤ espesor de la platina (− 1.6 mm si t ≥ 6.4)', wR <= (tR >= 6.4 ? tR - 1.6 : tR) + 1e-6, `${wR} mm`]);
      if(wR > td) av.push(`El filete de las platinas (${wR} mm) es mayor que la pared del tubo (${r2(td)} mm): la pared limita; se revisa aparte.`);
    } else pasos.push('Compresión: el pandeo del tubo se revisa como elemento (Anexo D); aquí solo la conexión.');
    const fwT = fw(FEXX, wt);
    add('soldadura', 'Filetes tubo–cartela (4 cordones longitudinales)', 'F.2.10.2.4 (J2-4)', Pa, 4 * fwT * Lws, 'kN', `4 × ${Lws} mm, w = ${wt} mm`);
    add('diagonal', 'Pared del tubo junto a los filetes (cortante)', 'F.2.10.4.2 (J4-3, J4-4)', Pa, 4 * Math.min(1.0 * 0.6 * at.Fy, 0.75 * 0.6 * at.Fu) * td * Lws / 1000, 'kN', `4 planos × ${Lws} mm × t ${r2(td)} mm`);
    add('cartela', 'Cartela junto a los filetes del tubo (cortante)', 'F.2.10.4.2 (J4-3, J4-4)', Pa, 2 * Math.min(1.0 * 0.6 * ag.Fy, 0.75 * 0.6 * ag.Fu) * tg * Lws / 1000, 'kN', `2 planos (un cordón por cara en cada línea) × ${Lws} mm × tg ${tg} mm`);
    Lw = B + 2 * Lws * Math.tan(Math.PI / 6);
    pasos.push(`Cartela t = ${tg} mm: ancho de Whitmore Lw = B + 2·Lws·tan30° = ${r1(Lw)} mm (empieza con el ancho del tubo)`);
    const wMinT = Math.min(td, tg) <= 6 ? 3 : Math.min(td, tg) <= 13 ? 5 : Math.min(td, tg) <= 19 ? 6 : 8;
    req.push([`Largo de la soldadura tubo–cartela ≥ ${red ? 'diámetro' : 'ancho'} del tubo (${casoU})`, Lws >= B - 1e-6, `${Lws} ≥ ${B} mm`]);
    if(red && Lws < 1.3 * B) av.push(`Tubo redondo: con l ≥ 1.3D = ${r1(1.3 * B)} mm la sección neta trabaja completa (U = 1.0).`);
    req.push(['Filete tubo–cartela ≥ mín. Tabla J2.4', wt >= wMinT, `${wt} ≥ ${wMinT} mm`]);
    req.push(['La cartela cabe en la ranura y queda dentro del tubo: tg + 3 < B − 2t', sl < B - 2 * +c.tt, `${r1(sl)} < ${r1(B - 2 * +c.tt)} mm`]);
    req.push(['Ranura 25 mm más larga que la punta de la cartela, o cerrada con soldadura; extremo del tubo sellado (galvanizado/agua)', true, 'indicar en planos']);
    if(wt > td) av.push(`El filete (${wt} mm) es mayor que la pared del tubo (${r2(td)} mm): no gana resistencia, la limita la pared; use w ≈ t.`);
    if(['V2', 'V3', 'T', 'M2', 'M3'].some(k => nz(c[k]))) av.push('Tubo: el cortante y los momentos fuera del eje de la diagonal no se reparten en los filetes del tubo; se revisan en la cartela y su soldadura.');
  } else {
  const A1 = (2 * b - t) * t, Ag = nL * A1; xb = (b * t * t / 2 + (b - t) * t * (t + (b - t) / 2)) / A1;   // centroide medido desde la espalda
  pasos.push(`Diagonal ${nL === 2 ? '2L' : 'L'} ${b}×${b}×${t} mm (${c.aceroL}): Ag = ${r1(Ag)} mm², x̄ = ${r1(xb)} mm; Pu = ${r2(P)} kN (${P >= 0 ? 'tensión' : 'compresión'})`);
  // Pernos
  // Aplastamiento con el sentido de la fuerza (20-nov): en tensión el angular desgarra hacia su extremo (Le, perno junto al soporte)
  // y la cartela hacia su borde libre (Leg, perno más lejano); en compresión los dos empujan hacia adentro (sin borde).
  const Leg = +c.Leg || 0, ten = P > 0;
  const bAE = aplast(Le - dh / 2, t, d, aL.Fu).phiRn, bAI = aplast(s - dh, t, d, aL.Fu).phiRn;
  const bGE = aplast(Leg - dh / 2, tg, d, ag.Fu).phiRn, bGI = aplast(s - dh, tg, d, ag.Fu).phiRn, bG0 = 0.75 * 2.4 * d * tg * ag.Fu / 1000;
  const rPer = Array.from({ length:n }, (_, i) => Math.min(nL * rv, nL * (ten && i === 0 ? bAE : n > 1 ? bAI : 0.75 * 2.4 * d * t * aL.Fu / 1000), ten && i === n - 1 ? bGE : n > 1 ? bGI : bG0));
  add('pernos', `Pernos (${n}, ${nL === 2 ? 'doble' : 'simple'} cortante)`, 'F.2.10.3.6 y F.2.10.3.10', Pa, rPer.reduce((a, x) => a + x, 0), 'kN',
    ten ? `junto al soporte ${r2(rPer[0])} (borde del angular Le), más lejano ${r2(rPer[n - 1])} (borde de la cartela Leg), interiores ${n > 2 ? r2(rPer[1]) : '—'} kN` : `compresión: los pernos empujan hacia adentro (sin borde); ${r2(rPer[0])} kN por perno`);
  req.push(['Borde de la cartela Leg (perno más lejano al borde) ≥ mín.', Leg >= bm, `${Leg} ≥ ${bm} mm`]);
  req.push(['Mínimo 2 pernos en la conexión de la diagonal', n >= 2, `${n} pernos`]);
  { const GU = [[51, 29], [64, 35], [76, 44], [89, 51], [102, 64], [127, 76], [152, 89]], gu = (GU.find(([bb]) => bb >= b - 2) || GU[GU.length - 1])[1];
    if(Math.abs(ga - gu) > 6) av.push(`Gramil del angular: el usual para un ala de ${b} mm es ≈ ${gu} mm (usted tiene ${ga} mm); revise que el perno no quede cerca del talón ni del borde.`); }
  if(nL === 2) av.push('Dos angulares espalda con espalda: lleve separadores (platinas de relleno) a lo largo de la diagonal; su separación se revisa con la diagonal en el Anexo D (E6).');
  // Diagonal
  const l = (n - 1) * s, An = Ag - nL * dn * t; U = Math.max(l > 0 ? 1 - xb / l : 0, n >= 4 ? 0.8 : n === 3 ? 0.6 : 0); const Ae = U * An;
  if(P > 0){
    add('diagonal', 'Fluencia a tensión de la diagonal', 'F.2.4.2 (D2-1)', P, 0.9 * aL.Fy * Ag / 1000, 'kN', '');
    add('diagonal', 'Rotura a tensión (con rezago de cortante U)', 'F.2.4.2 (D2-2), Tabla D3.1', P, 0.75 * aL.Fu * Ae / 1000, 'kN', `U = máx(1 − x̄/l; caso 8) = ${r3(U)}, Ae = ${r1(Ae)} mm²`);
  } else pasos.push('Compresión: el pandeo de la diagonal se revisa como elemento (Anexo D); aquí solo la conexión.');
  const agv = (Le + l) * t, anv = agv - (n - 0.5) * dn * t, ant = (b - ga - dn / 2) * t;
  if(P > 0) add('diagonal', `Bloque de cortante en el angular (×${nL})`, 'F.2.10.4.3 (J4-5)', Pa, nL * bloqueRn(aL.Fy, aL.Fu, agv, anv, ant), 'kN', `Agv ${r1(agv)}, Anv ${r1(anv)}, Ant ${r1(ant)} mm²`);
  // Cartela: sección de Whitmore
  Lw = 2 * l * Math.tan(Math.PI / 6) + (n > 1 ? 0 : dh);
  pasos.push(`Cartela t = ${tg} mm: ancho de Whitmore Lw = 2·(n − 1)·s·tan30° = ${r1(Lw)} mm`);
  req.push(['Separación s ≥ 2.67d', s >= 2.67 * d - 1e-6, `${s} ≥ ${r1(2.67 * d)} mm`]);
  req.push(['Borde Le ≥ mín.', Le >= bm, `${Le} ≥ ${bm} mm`]);
  req.push(['Borde del angular b − ga ≥ mín.', b - ga >= bm, `${b - ga} ≥ ${bm} mm`]);
  }
  const bWg = nz(c.bWg), Lw0 = Lw;
  if(bWg > 0 && bWg < Lw){ Lw = bWg; av.push(`La sección de Whitmore (${r1(Lw0)} mm) es más ancha que la cartela en ese punto (${r1(bWg)} mm): se usa el ancho real de la cartela.`); }
  if(bWg > 0) pasos.push(`Ancho de la cartela en la sección de Whitmore = ${r1(bWg)} mm → ancho efectivo = ${r1(Lw)} mm`);
  const Aw = Lw * tg;
  if(P > 0) add('cartela', 'Fluencia en la sección de Whitmore', 'F.2.10.4.1 (J4-1)', P, 0.9 * ag.Fy * Aw / 1000, 'kN', `Aw = ${r1(Aw)} mm²`);
  if(P > 0 && !tub){ const AnW = Math.min((Lw - dh) * tg, 0.85 * Aw);
    add('cartela', 'Rotura en la sección de Whitmore (por el agujero)', 'F.2.10.4.1 (J4-2), An ≤ 0.85·Ag', P, 0.75 * ag.Fu * AnW / 1000, 'kN', `An = mín((Lw − dh)·tg; 0.85·Aw) = ${r1(AnW)} mm²`); }
  if(P <= 0){ const KLr = +c.K * +c.Lcr / (tg / Math.sqrt(12));
    add('cartela', 'Pandeo de la cartela (sección de Whitmore)', 'F.2.10.4.4 (J4-6) / E3', Pa, 0.9 * fcrE3(ag.Fy, KLr) * Aw / 1000, 'kN', `KL/r = ${c.K}·${c.Lcr}/r = ${r1(KLr)}`); }
  if(c.tipo === 'esquina'){ const g = ufmEsquina(c, { ch, av, pasos, req, add, Pa, P, tg, ag, FEXX }); return g.error ? g : fin(ch, req, av, pasos, { dh, Lw, Lw0, U, xb, LRf:LRg, ...g }); }
  if(c.tipo === 'cruce'){ cruceX(c, { ch, av, pasos, req, add, Pa, P, tg, ag, dh }); return fin(ch, req, av, pasos, { dh, Lw, Lw0, U, xb, LRf:LRg }); }
  // Soldadura cartela–soporte
  const th = (+c.theta || 0) * Math.PI / 180, Lwg = +c.Lwg, w = +c.w, fd = c.duct === false ? 1 : 1.25, Pw = fd * Pa, eW = nz(c.eW);
  if(fd > 1) pasos.push(`Soldadura cartela–soporte con factor de ductilidad 1.25 (Manual AISC parte 13): fuerza de diseño ${r2(Pw)} kN`);
  add('soldadura', `Filetes cartela–soporte (ambas caras)${fd > 1 ? ' · ×1.25 ductilidad' : ''}`, 'F.2.10.2.4 (J2-4, J2-5)', Pw, 2 * fw(FEXX, w) * Lwg * (1 + 0.5 * Math.pow(Math.sin(th), 1.5)), 'kN', `L = ${Lwg} mm, θ = ${c.theta}° entre la fuerza y el cordón`);
  if(eW){ const Ppar = Pw * Math.cos(th), Pn = Pw * Math.sin(th), M = Pn * eW / 1000;              // kN·m: la componente normal no pasa por el centro del cordón
    const fs = Ppar / (2 * Lwg), fn = Pn / (2 * Lwg) + 6 * M * 1000 / (2 * Lwg * Lwg), f = Math.hypot(fs, fn);   // kN/mm por cordón
    add('soldadura', 'Filetes cartela–soporte con la excentricidad (método elástico)', 'F.2.10.2.4 (J2-4)', f, fw(FEXX, w), 'kN/mm', `e = ${eW} mm → M = ${r2(M)} kN·m; f = √(fs² + fn²) por cordón`); }
  else if(Pa > 0) pasos.push('Soldadura cartela–soporte: se supone que el eje de la diagonal pasa por el centro del cordón (e = 0); si no, escriba la excentricidad para revisar el momento.');
  add('cartela', 'Cartela junto a la soldadura (cortante + tensión)', 'F.2.10.4 · F.2.10.2.4', Pa, Math.min(0.6 * ag.Fy * tg * Lwg / 1000 / Math.max(Math.cos(th), 0.01), 0.9 * ag.Fy * tg * Lwg / 1000 / Math.max(Math.sin(th), 0.01)), 'kN', 'componentes de la fuerza contra fluencia por cortante y por tensión');
  req.push(['Filete ≥ mín. Tabla J2.4', w >= (tg > 19 ? 8 : tg > 12.7 ? 6 : tg > 6.4 ? 5 : 3), `${w} mm`]);
  return fin(ch, req, av, pasos, { dh, Lw, Lw0, U, xb, LRf:LRg });
}

const esTubo = c => c.diag === 'tubo' || c.diag === 'redondo';
// ── Cartela de esquina viga–columna: método de la fuerza uniforme (Manual AISC parte 13; pedido de Amo 24-nov) ──
// La fuerza de la diagonal se reparte en la interfaz cartela–viga (Hb, Vb) y cartela–columna (Hc, Vc) sin momentos
// cuando α = eb·tanθ − ec + β·tanθ (θ desde la vertical). Si la cartela real no cumple esa relación, queda un momento
// Mb = Vb·(α − ᾱ) en la interfaz con la viga (caso especial 3).
function defaultsEsquina(){
  return { ...defaultsCartela(), tipo:'esquina', viga:'IPE 300', columna:'HEA 300', aceroViga:'A36', aceroCol:'A36', cara:'ala',
    ang:45, Lh:400, Lv:350, wB:6, wC:6, Rv:0, Ab:0, K:0.5, Lcr:150 };
}
function ufmEsquina(c, o){
  const { ch, av, pasos, req, add, Pa, P, tg, ag, FEXX } = o;
  const vg = perfil(c.viga), cl = perfil(c.columna); if(!vg) return { error:'Escoja el perfil de la viga.' }; if(!cl) return { error:'Escoja el perfil de la columna.' };
  const av_ = ACEROS[c.aceroViga] || ACEROS.A36, ac = ACEROS[c.aceroCol] || ACEROS.A36, alma = c.cara === 'alma';
  const ang = Math.min(Math.max(+c.ang || 45, 5), 85), th = (90 - ang) * Math.PI / 180, tn = Math.tan(th);   // θ desde la vertical
  const Lh = +c.Lh, Lv = +c.Lv, eb = vg.d / 2, ec = alma ? cl.tw / 2 : cl.d / 2, ab = Lh / 2, bb = Lv / 2;
  const beta = bb, alpha = eb * tn - ec + beta * tn, r = Math.hypot(alpha + ec, beta + eb);
  const Hc = ec / r * Pa, Vc = beta / r * Pa, Hb = alpha / r * Pa, Vb = eb / r * Pa, Mb = Vb * (alpha - ab) / 1000;   // kN, kN·m
  pasos.push(`Método de la fuerza uniforme (Manual AISC parte 13): diagonal a ${ang}° de la horizontal (θ = ${r1(90 - ang)}° desde la vertical); eb = d viga/2 = ${r1(eb)} mm, ec = ${alma ? 'tw columna/2' : 'd columna/2'} = ${r1(ec)} mm`);
  pasos.push(`Cartela ${Lh} (sobre la viga) × ${Lv} (contra la columna) mm → β = ${r1(beta)} mm; α ideal = eb·tanθ − ec + β·tanθ = ${r1(alpha)} mm; ᾱ real = ${r1(ab)} mm; r = √((α + ec)² + (β + eb)²) = ${r1(r)} mm`);
  pasos.push(`Fuerzas (con |Pu| = ${r2(Pa)} kN): interfaz con la columna Hc = ec·P/r = ${r2(Hc)} kN (normal), Vc = β·P/r = ${r2(Vc)} kN (a lo largo); interfaz con la viga Hb = α·P/r = ${r2(Hb)} kN (a lo largo), Vb = eb·P/r = ${r2(Vb)} kN (normal)${Math.abs(Mb) > 0.005 ? `; Mb = Vb·(α − ᾱ) = ${r2(Mb)} kN·m` : ''}`);
  if(alpha < 0) av.push('El α ideal sale negativo: la cartela es muy alta contra la columna para el ángulo de la diagonal; acórtela (Lv) o alargue la parte sobre la viga.');
  if(Math.abs(alpha - ab) > 0.25 * ab) av.push(`La cartela no está proporcionada para el método (α ideal ${r1(alpha)} mm vs ᾱ ${r1(ab)} mm): aparece un momento en la soldadura a la viga. Para eliminarlo use Lh ≈ ${Math.round(2 * alpha / 5) * 5} mm.`);
  const fd = c.duct === false ? 1 : 1.25;
  if(fd > 1) pasos.push('Soldaduras de la cartela con factor de ductilidad 1.25 (Manual AISC parte 13).');
  const interfaz = (nom, L, w, fPar, fNor, M, tBase, Fyb, ref) => {
    const fs = fd * fPar / (2 * L), fn = fd * (fNor / (2 * L) + 6 * Math.abs(M) * 1000 / (2 * L * L)), f = Math.hypot(fs, fn), tht = Math.atan2(fn, Math.max(fs, 1e-9));
    add('soldadura', `Filetes cartela–${nom} (ambas caras${fd > 1 ? ', ×1.25' : ''})`, 'F.2.10.2.4 (J2-4, J2-5)', f, fw(FEXX, w) * (1 + 0.5 * Math.pow(Math.sin(tht), 1.5)), 'kN/mm', `L = ${L} mm, w = ${w} mm; por cordón fs = ${r3(fs)}, fn = ${r3(fn)} kN/mm`);
    add('cartela', `Cartela en la interfaz con la ${nom}: cortante`, 'F.2.10.4.2 (J4-3)', fPar, 1.0 * 0.6 * ag.Fy * tg * L / 1000, 'kN', '');
    add('cartela', `Cartela en la interfaz con la ${nom}: tensión normal + flexión`, 'F.2.10.4.1 (J4-1)', fNor / (tg * L) * 1000 + 6 * Math.abs(M) * 1e6 / (tg * L * L), 0.9 * ag.Fy, 'MPa', `esfuerzo normal en la cartela`);
    add(ref, `Metal base de la ${nom} junto a la soldadura`, 'F.2.10.2.4 (J4-3)', fd * fPar, 1.0 * 0.6 * Fyb * tBase * L / 1000, 'kN', `t = ${r1(tBase)} mm`);
    const wMin = Math.min(tg, tBase) <= 6 ? 3 : Math.min(tg, tBase) <= 13 ? 5 : Math.min(tg, tBase) <= 19 ? 6 : 8;
    req.push([`Filete cartela–${nom} ≥ mín. Tabla J2.4`, w >= wMin, `${w} ≥ ${wMin} mm`]);
  };
  interfaz('viga', Lh, +c.wB, Hb, Vb, Mb, vg.tf, av_.Fy, 'viga');
  interfaz('columna', Lv, +c.wC, Vc, Hc, 0, alma ? cl.tw : cl.tf, ac.Fy, 'columna');
  // Viga: alma bajo la fuerza normal Vb (la cartela está junto al extremo de la viga → 2.5k + N)
  const kv = vg.tf + vg.r, kc = cl.tf + cl.r;
  add('viga', 'Alma de la viga: fluencia local bajo Vb', 'F.2.10.10.2 (J10-3)', Vb, 1.0 * av_.Fy * vg.tw * (2.5 * kv + Lh) / 1000, 'kN', `N = ${Lh} mm junto al extremo`);
  { const N = Lh, dd = vg.d, k1 = N / dd <= 0.2 ? 1 + 3 * (N / dd) * Math.pow(vg.tw / vg.tf, 1.5) : 1 + (4 * N / dd - 0.2) * Math.pow(vg.tw / vg.tf, 1.5);
    add('viga', 'Alma de la viga: aplastamiento bajo Vb (diagonal en compresión)', 'F.2.10.10.3 (J10-5)', Vb, 0.75 * 0.40 * vg.tw * vg.tw * k1 * Math.sqrt(200000 * av_.Fy * vg.tf / vg.tw) / 1000, 'kN', ''); }
  if(!alma){
    add('columna', 'Alma de la columna: fluencia local bajo Hc', 'F.2.10.10.2 (J10-2)', Hc, 1.0 * ac.Fy * cl.tw * (5 * kc + Lv) / 1000, 'kN', `N = ${Lv} mm`);
    add('columna', 'Ala de la columna: flexión local bajo Hc (diagonal en tensión)', 'F.2.10.10.1 (J10-1)', Hc, 0.9 * 6.25 * ac.Fy * cl.tf * cl.tf / 1000, 'kN', '');
  } else {
    // Eje débil: la cartela tira del alma fuera de su plano. Líneas de fluencia aproximadas (placa empotrada en las dos alas, carga en línea de largo Lv)
    const h = cl.d - 2 * cl.tf, mp = ac.Fy * cl.tw * cl.tw / 4, Rn = 8 * mp * Lv / h / 1000;   // mecanismo: línea central + dos líneas en las alas (sin las zonas de los extremos)
    add('columna', 'Alma de la columna fuera de su plano bajo Hc (líneas de fluencia, aproximado)', 'Manual AISC parte 9 (placa empotrada en las alas)', Hc, 0.9 * Rn, 'kN', `Rn = 8·mp·Lv/h, mp = Fy·tw²/4; h = ${r1(h)} mm, tw = ${cl.tw} mm`);
    av.push('Cartela soldada al alma de la columna (eje débil): la fuerza normal Hc dobla el alma fuera de su plano. Si no alcanza, ponga placas entre las alas de la columna en los extremos del borde de la cartela.');
  }
  // Fuerzas para la unión viga–columna (se diseña aparte con una conexión a cortante)
  const Vvc = Vb + nz(c.Rv), Nvc = Hc + nz(c.Ab);
  pasos.push(`Unión viga–columna (diseñarla aparte, conexión a cortante): cortante = Vb + R = ${r2(Vb)} + ${r2(nz(c.Rv))} = ${r2(Vvc)} kN; axial = Hc + Ab = ${r2(Hc)} + ${r2(nz(c.Ab))} = ${r2(Nvc)} kN (Ab = fuerza que el piso le pasa a la viga).`);
  av.push(`Use en la conexión viga–columna (chapa de aleta o doble angular) V = ${r2(Vvc)} kN y P = ${r2(Nvc)} kN.`);
  req.push(['Separación de la cartela al ala de la viga y a la columna para la soldadura y el pandeo (franja de 2tg con sismo DES)', true, 'indicar en planos']);
  return { ufm:{ alpha, beta, ab, r, Hc, Vc, Hb, Vb, Mb, Vvc, Nvc }, vg, cl };
}
// ── Cruce de diagonales en X: una pasa continua y la otra se corta y se une a una platina en el cruce (pedido de Amo 24-nov) ──
function defaultsCruce(){
  return { ...defaultsCartela(), tipo:'cruce', bPl:250, LcX:120, KX:1.0, nH:0, Lcr:120, K:1.0 };
}
function cruceX(c, o){
  const { av, pasos, req, add, Pa, P, tg, ag, dh } = o;
  const b = +c.bPl, Ag = b * tg, nH = Math.max(0, Math.round(nz(c.nH))), An = Math.min((b - nH * dh) * tg, 0.85 * Ag);
  pasos.push(`Platina del cruce ${b} × ${tg} mm (${c.aceroG}): la fuerza de la diagonal interrumpida (${r2(Pa)} kN) pasa de una mitad a la otra a través de la platina, por encima de la diagonal continua.`);
  if(P > 0){
    add('cartela', 'Platina en el cruce: fluencia a tensión', 'F.2.10.4.1 (J4-1)', P, 0.9 * ag.Fy * Ag / 1000, 'kN', `Ag = ${r1(Ag)} mm²`);
    add('cartela', 'Platina en el cruce: rotura a tensión', 'F.2.10.4.1 (J4-2)', P, 0.75 * ag.Fu * An / 1000, 'kN', nH ? `${nH} agujeros de la unión a la diagonal continua; An = ${r1(An)} mm²` : `An = ${r1(An)} mm²`);
  } else {
    const KLr = nz(c.KX) * nz(c.LcX) / (tg / Math.sqrt(12));
    add('cartela', 'Platina en el cruce: pandeo entre los extremos de la diagonal interrumpida', 'F.2.10.4.4 (J4-6) / E3', Pa, 0.9 * fcrE3(ag.Fy, KLr) * Ag / 1000, 'kN', `KL/r = ${c.KX}·${c.LcX}/r = ${r1(KLr)}`);
  }
  req.push(['La platina se une a la diagonal continua (pernos o soldadura) solo para mantenerla en su sitio; esa unión no lleva la fuerza de la diagonal interrumpida', true, 'indicar en planos']);
  av.push('Anexo D: con el cruce unido, la longitud de pandeo fuera del plano de cada diagonal puede tomarse como la mitad (del extremo al cruce) si la otra diagonal trabaja en tensión; dentro del plano también es la mitad.');
  if(['DMO', 'DES'].includes(c.sismo)) av.push('Sismo: la diagonal interrumpida debe poder doblarse fuera del plano en el cruce; deje la franja de 2tg sin restringir en la platina o diseñe la unión para la resistencia a flexión de la diagonal (AISC 341 F2.5b).');
}
// Área y acero de la diagonal (para el sismo)
function diagDe(c){
  if(c.diag === 'tubo'){ const B = +c.Bt, td = 0.93 * +c.tt; return { Ag:B * B - (B - 2 * td) ** 2, ac:c.aceroT || 'A500 Gr C' }; }
  if(c.diag === 'redondo'){ const D = +c.Dt, td = 0.93 * +c.tt; return { Ag:Math.PI / 4 * (D * D - (D - 2 * td) ** 2), ac:c.aceroT || 'A500 Gr C' }; }
  const b = +c.bL, t = +c.tL, nL = +c.nL === 1 ? 1 : 2; return { Ag:nL * (2 * b - t) * t, ac:c.aceroL };
}
// Envoltura (20-nov): sismo (pórtico arriostrado concéntrico) y 💡 sugerencia
function calcCartela(c){
  const sis = ['DMO', 'DES'].includes(c.sismo) ? c.sismo : '';
  let R;
  if(sis){
    const { Ag, ac } = diagDe(c), A = ACEROS[ac] || ACEROS.A36, Ry = RY(ac), Pt = Ry * A.Fy * Ag / 1000, Pnd = nz(c.Pnd), Pc = 1.1 * Ry * Pnd;
    const Rt = calcCartela0({ ...c, Pu:Math.max(Pt, nz(c.Pu)) });
    if(Rt.error) return Rt;
    // la diagonal fluye por diseño: no se revisa su fluencia; en sus estados de rotura se puede usar Rt·Fu (AISC 341 A3.2)
    const rt = RT(ac);
    Rt.ch = Rt.ch.filter(x => !(x.grupo === 'diagonal' && /^Fluencia/.test(x.nombre)));
    Rt.ch.forEach(x => { if(x.grupo === 'diagonal' && /Rotura|Bloque|Pared/.test(x.nombre)){ x.cap = x.capR != null ? (x.cap - x.capR) * rt + x.capR : x.cap * rt; x.ratio = x.dem / x.cap; x.extra = `${x.extra ? x.extra + ' · ' : ''}con Rt = ${rt}`; } x.nombre += ' · tensión esperada'; });
    R = Rt;
    R.pasos.unshift(`Sismo ${sis} (pórtico arriostrado concéntrico ${sis === 'DES' ? 'especial' : 'ordinario/moderado'}, NSR-10 F.3 / AISC 341 ${sis === 'DES' ? 'F2.6c' : 'F1.6a'}): la conexión se diseña para lo que la diagonal puede llegar a dar → tensión Ry·Fy·Ag = ${r3(Ry)}·${A.Fy}·${Math.round(Ag)} = ${r2(Pt)} kN${Pnd ? `; compresión 1.1·Ry·Pn = 1.1·${r3(Ry)}·${r2(Pnd)} = ${r2(Pc)} kN` : ''}.`);
    if(Pnd > 0 || nz(c.Pu) < 0){ const Rc = calcCartela0({ ...c, Pu:-Math.max(Pc, Math.abs(Math.min(nz(c.Pu), 0))) });
      Rc.ch.filter(x => /Pandeo/.test(x.nombre)).forEach(x => { x.nombre += ' · compresión esperada'; R.ch.push(x); }); }
    else R.av.push('Sismo: escriba Pn de la diagonal (resistencia nominal a compresión, del Anexo D) para revisar la cartela con 1.1·Ry·Pn.');
    R.pasos.splice(1, 0, `La diagonal fluye por diseño: no se revisa su fluencia; en sus estados de rotura (sección neta, bloque, pared) se usa Rt·Fu con Rt = ${rt} (AISC 341 A3.2).`);
    if(sis === 'DES') R.req.push(['Sismo DES: franja libre de 2·tg entre el extremo de la diagonal y la línea donde la cartela queda restringida (para que se doble sin romperse)', true, `2·tg = ${2 * +c.tg} mm · indicar en planos`]);
    R.req.push([`Sismo: pernos pretensionados en agujeros estándar; soldaduras con electrodo de tenacidad (demanda crítica si es DES)`, true, 'indicar en planos']);
    if(R.ch.some(x => x.grupo === 'diagonal' && /Rotura|neta/.test(x.nombre) && x.ratio > 1)) R.av.push('Sismo: la sección neta de la diagonal no alcanza a desarrollar Ry·Fy·Ag: refuerce la diagonal en la conexión (platinas soldadas) o aumente la longitud de la conexión.');
    R.max = R.ch.reduce((m, x) => Math.max(m, x.ratio), 0); R.ok = R.max <= 1 && !R.req.some(q => !q[1]);
  } else R = calcCartela0(c);
  if(R.error || c._sinSug || R.ok) return R;
  // 💡 espesor de cartela, número de pernos (o largo de la soldadura del tubo) y largo de la soldadura al soporte mínimos que cumplen
  const tub = esTubo(c), tgs = ESP_PL.filter(x => x >= Math.min(+c.tg, 6.4)), base = { _sinSug:true };
  const conex = tub ? [100, 125, 150, 175, 200, 250, 300, 350, 400].filter(x => x >= +(c.diag === 'redondo' ? c.Dt : c.Bt) - 1e-6).map(Lws => ({ Lws })) : [2, 3, 4, 5, 6, 7, 8].map(n => ({ n }));
  const sop = c.tipo === 'cartela' || !c.tipo, largos = sop ? [+c.Lwg, ...[150, 200, 250, 300, 350, 400, 450, 500, 600].filter(x => x > +c.Lwg)] : [+c.Lwg];
  let best = null;
  // con sismo la rotura de la propia diagonal no se arregla con la cartela: se busca lo demás y se avisa aparte
  const okS = t => !t.error && t.ch.every(x => x.ratio <= 1 || (sis && x.grupo === 'diagonal' && /Rotura/.test(x.nombre))) && !t.req.some(q => !q[1]);
  for(const tg of tgs){ for(const cx of conex){ for(const Lwg of largos){ const t = calcCartela({ ...c, ...base, tg, ...cx, Lwg }); if(okS(t)){ best = { tg, ...cx, Lwg }; break; } } if(best) break; } if(best) break; }
  if(best){ const cambia = Object.keys(best).filter(k => +best[k] !== +c[k]);
    const fin2 = calcCartela({ ...c, ...base, ...best });
    if(cambia.length) R.sug = { tipo:'sold', ok:true, ...best, txt:`💡 Usar ${c.tipo === 'cruce' ? 'platina' : 'cartela'} de ${best.tg} mm${sop ? ',' : ' y'} ${tub ? `soldadura del tubo de ${best.Lws} mm` : `${best.n} pernos`}${sop ? ` y soldadura al soporte de ${best.Lwg} mm` : ''}${fin2.ok ? '' : ' (la diagonal sigue sin alcanzar en su sección neta: refuércela)'}` }; }
  else R.av.push('No se encontró una combinación de cartela, pernos y soldadura que cumpla: revise la diagonal (perfil o acero), el diámetro de los pernos o el filete.');
  return R;
}

// ── Placa base a momento: usa el mismo cálculo del Anexo E del generador (calc/anexoE.js) ─────────────
function defaultsBase(){
  return { tipo:'base', nom:'', desc:'', P:150, Mx:20, My:0, Vx:15, Vy:0, columna:'HEB 200',
    N:400, B:350, tp:25.4, aceroPlaca:'A36', Lp:650, Wp:600, ha:1000, fc:21,
    perno:'3/4"', anclaje:'F1554 Gr 36', nB:2, S1:300, S2:250, hef:300, arandela:50, cabeza:'tuerca', fisurado:true, mortero:true, w:8, electrodo:'E70XX',
    // Revisión con Amo (20-nov, puntos 1–8 menos el 6)
    colTipo:'I', Ht:200, Bt:200, tt:8, cortante:'anclajes', lugB:150, lugH:100, lugT:19, lugW:8, aceroLug:'A36', grout:25,
    sismo:'no', refT:false, refNT:4, refDT:12.7, refV:false, refNV:2, refDV:12.7, fyR:420, arandSold:true };
}
// «Qué cambiar» debajo de cada chequeo que no cumple de la placa base (opción A de Amo, 25-nov): para cada chequeo en rojo se prueba
// cambiar UNA medida a la vez (en el orden que más sentido tiene para ese chequeo) y se dice la primera que lo hace cumplir, con su relación.
const PER_BASE = ['1/2"', '5/8"', '3/4"', '7/8"', '1"', '1-1/8"', '1-1/4"'];
function arreglosBase(c, out){
  const clave = n => String(n).replace(/\(.*?\)/g, '').replace(/[\d.,]+/g, '').trim();
  const ip = Math.max(0, PER_BASE.indexOf(c.perno));
  const GEN = {
    tp: () => ESP_PL.concat([44.5, 50.8]).filter(t => t > +c.tp + 1e-6).map(t => ({ patch:{ tp:t }, txt:`Suba el espesor de la placa de ${c.tp} a ${t} mm` })),
    NB: () => [25, 50, 75, 100, 150, 200].map(k => ({ N:+c.N + k, B:+c.B + k })).filter(o => o.N <= +c.Lp - 50 && o.B <= +c.Wp - 50).map(o => ({ patch:o, txt:`Agrande la placa a ${o.N} × ${o.B} mm (ahora ${c.N} × ${c.B})` })),
    perno: () => PER_BASE.slice(ip + 1).map(pe => ({ patch:{ perno:pe }, txt:`Use pernos de ${pe} (ahora ${c.perno})` })),
    nB: () => [3, 4].filter(n => n > +c.nB).map(n => ({ patch:{ nB:n }, txt:`Ponga ${n} pernos por fila (ahora ${c.nB})` })),
    hef: () => [300, 400, 500, 600, 700, 800, 900].filter(h => h > +c.hef && h <= +c.ha - 50).map(h => ({ patch:{ hef:h }, txt:`Ancle más profundo: hef = ${h} mm (ahora ${c.hef})` })),
    fric: () => c.cortante === 'friccion' ? [] : [{ patch:{ cortante:'friccion' }, txt:'Pase el cortante por fricción con la carga axial, no por los pernos' }],
    llave: () => c.cortante === 'llave' ? [] : [{ patch:{ cortante:'llave' }, txt:`Ponga una llave de cortante bajo la placa (${c.lugB} × ${c.lugH} × ${c.lugT} mm)` }],
    arandela: () => c.cabeza === 'gancho' ? [] : [50, 64, 76, 100].filter(a => a > (+c.arandela || 0)).map(a => ({ patch:{ arandela:a }, txt:+c.arandela < 30 ? `Escriba el LADO de la arandela embebida, no su espesor: ${a} mm (ahora ${c.arandela} mm)` : `Use una arandela embebida más grande: ${a} × ${a} mm (ahora ${c.arandela})` })),
    refT: () => c.refT ? [] : [{ patch:{ refT:true }, txt:'Agregue refuerzo de anclaje a tensión (barras junto a los pernos)' }],
    refTmas: () => !c.refT ? [] : [[6, 12.7], [4, 15.9], [8, 12.7], [6, 15.9], [4, 19.1], [8, 15.9], [6, 19.1], [8, 19.1]].filter(([n, d]) => n*d*d > (+c.refNT || 4)*(+c.refDT || 12.7)**2).map(([n, d]) => ({ patch:{ refNT:n, refDT:d }, txt:`Más refuerzo de anclaje a tensión: ${n} barras de ${{ 12.7:'1/2"', 15.9:'5/8"', 19.1:'3/4"' }[d]} (ahora ${c.refNT || 4} de ${{ 12.7:'1/2"', 15.9:'5/8"', 19.1:'3/4"' }[+c.refDT || 12.7] || (c.refDT + ' mm')})` })),
    refV: () => c.refV ? [] : [{ patch:{ refV:true }, txt:'Agregue refuerzo de anclaje a cortante (barras en el borde del pedestal)' }],
    w: () => [5, 6, 8, 10, 12, 14, 16].filter(w => w > +c.w).map(w => ({ patch:{ w }, txt:`Suba el filete columna–placa de ${c.w} a ${w} mm` })) };
  const ORDEN = [[/Espesor/, ['tp', 'NB']], [/Aplastamiento del concreto|Longitud de apoyo/, ['NB', 'tp']], [/Tensión en el acero/, ['perno', 'nB']],
    [/Arrancamiento del concreto a tensión|cono/i, ['hef', 'refT', 'refTmas', 'nB', 'NB']], [/Refuerzo de anclaje a tensión/, ['refTmas']], [/Extracción|pullout/i, ['arandela', 'perno']], [/dúctil/, ['arandela', 'refT', 'refTmas', 'hef']], [/Interacción/, ['fric', 'llave', 'refV', 'perno', 'nB', 'hef']],
    [/Cortante en el acero/, ['perno', 'nB', 'fric', 'llave']], [/borde/, ['fric', 'llave', 'refV']], [/pryout/i, ['hef', 'fric', 'llave']], [/Soldadura/, ['w']],
    [/[Rr]event/, ['arandela', 'hef', 'NB']], [/llave|Llave/, ['llave']]];
  const cache = new Map(), prueba = patch => { const k = JSON.stringify(patch); if(!cache.has(k)) cache.set(k, calcBase({ ...c, ...patch, _sinSug:true })); return cache.get(k); };
  for(const x of out.ch.filter(x => x.ratio > 1)){
    const kx = clave(x.nombre), orden = (ORDEN.find(([re]) => re.test(x.nombre)) || [, []])[1];
    const tipos = [...orden, ...Object.keys(GEN).filter(t => !orden.includes(t))];
    let fx = null;
    busca: for(const t of tipos) for(const cand of GEN[t]()){
      const r = prueba(cand.patch); if(r.error) continue;
      const y = r.ch.find(z => clave(z.nombre) === kx);
      if(!y || y.ratio <= 1){ fx = { txt:cand.txt, patch:cand.patch, ratio:y ? y.ratio : null, todo:!!r.ok, otro:!orden.includes(t) }; break busca; }
    }
    const arMal = c.cabeza !== 'gancho' && (+c.arandela || 50) < 30;
    x.fix = fx || (arMal ? { txt:`Primero corrija la arandela embebida: escriba su LADO (p. ej. 50 mm), no el espesor (ahora ${c.arandela} mm)`, patch:{ arandela:50 }, ratio:undefined } : null) || { txt:'Ningún cambio de una sola medida lo arregla: agrande el pedestal, suba el f\'c o combine cambios', patch:null };
  }
}

function calcBase(c){
  const AE = G.AnexoE || (typeof require !== 'undefined' ? require('../calc/anexoE.js') : null);
  if(!AE) return { error:'No se cargó el cálculo de la placa base.' };
  const tubo = c.colTipo === 'tubo', tD = 0.93 * (+c.tt || 0);
  const cl = tubo ? { nom:`Tubo ${c.Ht}×${c.Bt}×${c.tt}`, d:+c.Ht, bf:+c.Bt, tw:tD, tf:tD, r:0, tub:true } : perfil(c.columna); if(!cl) return { error:'Escoja el perfil de la columna.' };
  const R = AE.placaBase({ ...c, bf:cl.bf, d:cl.d, tw:cl.tw, tf:cl.tf }, [{ P:+c.P, Mn:+c.Mx, Mb:+c.My, Vn:+c.Vx, Vb:+c.Vy }]);
  if(!R.ok) return { error:R.error };
  const ch = [], GR = { apl:'concreto', geo:'placa', tp:'placa', ten:'anclajes', cono:'concreto', pull:'anclajes', vs:'anclajes', vb:'concreto', vcp:'concreto', int:'anclajes', sb:'concreto', sold:'soldadura',
    fric:'cortante', lugApl:'cortante', lugFlex:'cortante', lugSold:'cortante', lugCon:'cortante', duc:'anclajes' };
  for(const [k, x] of Object.entries(R.checks)){
    const N = x.u === 'N', soloR = !x.u || x.soloOk;
    ch.push({ grupo:GR[k] || 'placa', nombre:x.n, ref:x.ref, dem: soloR ? x.r : N ? x.dem / 1000 : x.dem, cap: soloR ? 1 : N ? x.cap / 1000 : x.cap, ud: soloR ? '' : N ? 'kN' : x.u, ratio:x.r,
      extra: k === 'tp' ? `t requerido = ${r1(x.req)} mm` : '' });
  }
  // N·mm → kN·m y N/mm → kN/mm (chequeos nuevos de la llave)
  ch.forEach(x => { if(x.ud === 'N·mm'){ x.dem /= 1e6; x.cap /= 1e6; x.ud = 'kN·m'; } else if(x.ud === 'N/mm'){ x.dem /= 1000; x.cap /= 1000; x.ud = 'kN/mm'; } });
  const req = [];
  req.push(['Distancia de los pernos al borde del pedestal ≥ 6·da (C-D.8.2)', Math.min(R.caN, R.caB) >= 6 * R.da - 1e-6, `${r1(Math.min(R.caN, R.caB))} ≥ ${r1(6 * R.da)} mm`]);
  req.push(['Separación entre pernos ≥ 4·da (C-D.8.1)', Math.min(R.S1, R.S2 / Math.max(R.nB - 1, 1)) >= 4 * R.da - 1e-6, `${r1(Math.min(R.S1, R.S2 / Math.max(R.nB - 1, 1)))} ≥ ${r1(4 * R.da)} mm`]);
  req.push(['Empotramiento cabe en el pedestal: hef ≤ altura − 50 mm', R.hef <= R.ha - 50 + 1e-6, `${R.hef} ≤ ${R.ha - 50} mm`]);
  req.push(['Borde de la placa a los pernos ≥ 1.5·da', Math.min(R.a, R.aB) >= 1.5 * R.da - 1e-6, `${r1(Math.min(R.a, R.aB))} ≥ ${r1(1.5 * R.da)} mm`]);
  if(R.modoV === 'llave') req.push(['Llave: alto bajo el mortero ≥ 50 mm y espesor ≥ 13 mm (práctica de la Guía 1)', (+c.lugH - (c.mortero ? +c.grout : 0)) >= 50 && +c.lugT >= 12.7, `${+c.lugH - (c.mortero ? +c.grout : 0)} mm · t ${c.lugT} mm`]);
  if(c.cabeza !== 'gancho'){ const dA = { '1/2"':12.7, '5/8"':15.9, '3/4"':19.1, '7/8"':22.2, '1"':25.4, '1-1/8"':28.6, '1-1/4"':31.8 }[c.perno] || 19.1;
    req.push([`Arandela embebida: lado ≥ 2·d = ${Math.ceil(2*dA)} mm (el dato es el LADO, no el espesor)`, (+c.arandela || 50) >= 2*dA - 0.5, `${c.arandela || 50} mm`]); }
  if(R.sis) req.push(['Sismo: anclajes de acero dúctil (F1554 Gr 36/55 o A36) con tuerca y arandela; soldaduras con electrodo de tenacidad', !/105/.test(c.anclaje), c.anclaje]);
  const f = R.peor, pasos = [
    `Columna ${cl.nom} sobre placa N × B × tp = ${R.N} × ${R.B} × ${R.tp} mm; pedestal ${R.Lp} × ${R.Wp} mm, f'c = ${R.fc} MPa`,
    `Aplastamiento máximo fp,máx = 0.65·0.85·f'c·√(A2/A1) ≤ 2 → ${r2(R.fpMax)} MPa; voladizos m = ${r1(R.m)}, n = ${r1(R.nv)}, λn' = ${r1(R.lnp)} mm`,
    `Sentido X (N): ${f.rN.caso}; e = ${isFinite(f.rN.e) ? r1(f.rN.e) : '∞'} mm, e crít = ${r1(f.rN.ecrit)} mm, Y = ${r1(f.rN.Y)} mm, Tu = ${r2(f.rN.Tu / 1000)} kN`,
    `Sentido Y (B): ${f.rB.caso}; Tu = ${r2(f.rB.Tu / 1000)} kN · espesor requerido ${r1(f.tReq)} mm`,
    `Anclajes ${R.n} × ${c.perno} ${c.anclaje}: φNsa = ${r2(R.phiNsa / 1000)} kN, φVsa = ${r2(R.phiVsa / 1000)} kN por perno; hef = ${R.hef} mm` ];
  pasos.push(`Cortante: ${R.modoV === 'friccion' ? 'por fricción (μ = 0.55 con la compresión)' : R.modoV === 'llave' ? `llave de cortante ${c.lugB} × ${c.lugH} × ${c.lugT} mm (${c.aceroLug}) con filete ${c.lugW} mm` : `en los anclajes (${R.nV} de ${R.n} toman cortante)`}${R.sis ? ` · sismo ${c.sismo}: resistencias del concreto ×0.75 (C-D.3.3)` : ''}${R.refT ? ` · refuerzo de anclaje a tensión φNn = ${r2(R.refT / 1000)} kN` : ''}${R.refV ? ` · a cortante φVn = ${r2(R.refV / 1000)} kN` : ''}`);
  const out = fin(ch, req, [...R.avisos], pasos, { R, cl });
  if(!c._sinSug && !out.ok) arreglosBase(c, out);
  // 💡 mínimo que sirve (pedido de Amo 20-nov): espesor, tamaño de la placa, hef, pernos por fila y diámetro
  if(!c._sinSug && !out.ok){
    const PER = ['1/2"', '5/8"', '3/4"', '7/8"', '1"', '1-1/8"', '1-1/4"'], ip = Math.max(0, PER.indexOf(c.perno)), esp = ESP_PL.concat([44.5, 50.8]).filter(t => t >= +c.tp - 1e-6);
    const hefs = [+c.hef, ...[300, 400, 500, 600, 700, 800, 900].filter(h => h > +c.hef && h <= +c.ha - 50)];
    let best = null;
    busca: for(const pe of PER.slice(ip)) for(const nB of [2, 3, 4].filter(x => x >= +c.nB)) for(const hef of hefs) for(let k = 0; k <= 200; k += 25) for(const tp of esp){
      const o = { perno:pe, nB, hef, N:+c.N + k, B:+c.B + k, tp };
      if(o.N > +c.Lp - 50 || o.B > +c.Wp - 50) continue;
      const t = calcBase({ ...c, ...o, _sinSug:true }); if(t.error) continue;
      if(t.ok){ best = o; break busca; }
      // si solo falla la soldadura columna–placa, se prueba un filete más grande
      if(t.ch.every(x => x.ratio <= 1 || /Soldadura columna/.test(x.nombre)) && !t.req.some(q => !q[1]))
        for(const w of [5, 6, 8, 10, 12, 14, 16].filter(x => x > +c.w)){ if(calcBase({ ...c, ...o, w, _sinSug:true }).ok){ best = { ...o, w }; break busca; } } }
    if(best){ const cam = [best.tp !== +c.tp ? `placa de ${best.tp} mm` : '', best.N !== +c.N ? `${best.N} × ${best.B} mm` : '', best.hef !== +c.hef ? `hef ${best.hef} mm` : '', best.nB !== +c.nB ? `${best.nB} pernos por fila` : '', best.perno !== c.perno ? `pernos de ${best.perno}` : '', best.w ? `filete columna–placa de ${best.w} mm` : ''].filter(Boolean);
      out.sug = { tipo:'sold', ok:true, ...best, txt:`💡 Usar ${cam.join(', ')}` }; }
    else out.av.push('No se encontró una placa que cumpla con este pedestal (hasta pernos de 1-1/4", 4 por fila, la placa 200 mm más grande y hef hasta la altura del pedestal): agrande el pedestal, agregue refuerzo de anclaje o use una llave de cortante.');
  }
  return out;
}


const pasos2 = (r, t) => { if(r && r.pasos) r.pasos.push(t); };
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
    if(Math.abs(P) > 0){ const ncw = +c.ncw === 2 ? 2 : 1, gw = ncw === 2 ? +c.gw || 0 : 0, ew = gap / 2 + +c.Lehw + gw / 2, Pw = Math.abs(P) * Aw / At, nw = Math.round(+c.nw);
      const rW = Math.min(2 * fv(c, d), aplast(+c.Lehw - dh / 2, vg.tw, d, ACEROS[c.aceroViga].Fu).phiRn, 2 * aplast(Math.min(+c.Lew, +c.Lehw) - dh / 2, +c.tpw, d, pl.Fu).phiRn);
      const ptw = []; for(let j = 0; j < ncw; j++) for(let i = 0; i < nw; i++) ptw.push({ u:j * gw, v:i * +c.sw });
      const bw = pernos3D(ptw, { Fu:Pw, Fv:V2, Mn:V2 * ew / 1000, N:0, Mu:0, Mv:0 }, { d, grado:c.grado, rosca:c.rosca, rCorte:rW });
      add('pernos', 'Pernos del alma con V2 y la parte de P (método elástico)', 'F.2.10.3.6', bw.rat, 1, '', `P en el alma ${r2(Pw)} kN; cortante crítico ${r2(bw.r)} kN`); } },
  cartela(c, r, add, av){ if(!hayExtra(c, ['V2', 'V3', 'T', 'M2', 'M3'])) return;
    const d = +c.d, n = Math.round(+c.n), s = +c.s, nL = +c.nL === 1 ? 1 : 2, dh = agujero(d), ag = ACEROS[c.aceroG], aL = ACEROS[c.aceroL];
    const P = nz(c.Pu), V2 = nz(c.V2), V3 = nz(c.V3), T = nz(c.T), M2 = nz(c.M2), M3 = nz(c.M3);
    const rC = Math.min(nL * fv(c, d), nL * aplast(+c.Le - dh / 2, +c.tL, d, aL.Fu).phiRn, 0.75 * 2.4 * d * +c.tg * ag.Fu / 1000);
    const tub = esTubo(c);
    if(!tub){ const b = pernos3D(Array.from({ length:n }, (_, i) => ({ u:i * s, v:0 })), { Fu:P, Fv:V2, Mn:M3, N:Math.abs(V3), Mu:T, Mv:M2 }, { d, grado:c.grado, rosca:c.rosca, planos:nL, rCorte:rC });
      add('pernos', 'Pernos con las 6 fuerzas de la diagonal (J3-3a)', 'F.2.10.3.7', b.rat, 1, '', `cortante ${r2(b.r)} kN (φrn ${r2(rC)}), tensión ${r2(b.t)} kN${b.nota}`); }
    const th = (+c.theta || 0) * Math.PI / 180, Lwg = +c.Lwg, hc = +c.Lcr + (tub ? +c.Lws / 2 : (n - 1) * s / 2);
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
    // Palanca (Manual AISC parte 9, pedido de Amo 20-nov): la chapa y el soporte se doblan entre los pernos y el punto de carga
    if(b.t > 0){ const nc = Math.round(+c.cols), nf = Math.round(+c.filas), g = +c.g, s = +c.s, Leh = +c.Leh;
      const B = 0.75 * PERNOS[c.grado].Fnt * Math.PI * d * d / 4 / 1000, T = b.t;                       // kN por perno
      const bb = nc > 1 ? g / 2 : Math.max(+c.Leh, 30), aa = nc > 1 ? Math.min(Leh, 1.25 * bb) : Math.min(Leh, 1.25 * bb);
      const bp = bb - d / 2, ap = aa + d / 2, rho = bp / ap, pp = nf > 1 ? Math.min(s, 2 * +c.Lev + 0) : 2 * +c.Lev, delta = 1 - dh / pp;
      const palanca = (t, Fu, nom) => {
        const tc = Math.sqrt(4 * B * 1000 * bp / (0.9 * pp * Fu)), tmin = Math.sqrt(4 * T * 1000 * bp / (0.9 * pp * Fu));
        let al = (1 / (delta * (1 + rho))) * ((tc / t) ** 2 - 1); al = Math.max(0, Math.min(1, al));
        const Q = t >= tc ? 1 : Math.min(1, (t / tc) ** 2 * (1 + delta * al));
        add('pernos', `Palanca: tensión de los pernos con ${nom}`, 'Manual AISC parte 9 (9-21 a 9-29)', T, B * Q, 'kN', `t ${t} mm, tc ${r1(tc)} mm, Q = ${r3(Q)}; sin palanca hace falta t ≥ ${r1(tmin)} mm`);
        return tmin; };
      pasos2(r, `Palanca (Manual AISC parte 9): ${nc > 1 ? `la carga normal se aplica entre las dos columnas: b = g/2 = ${r1(bb)} mm` : `una sola columna: b = Leh = ${r1(bb)} mm (supuesto)`}, a = ${r1(aa)} mm, p = ${r1(pp)} mm, B = ${r2(B)} kN por perno, T = ${r2(T)} kN`);
      palanca(+c.tp, pl.Fu, 'la chapa'); palanca(+c.tSop, ACEROS[c.aceroSop].Fu, 'el soporte');
      if(nc === 1) av.push('Palanca con una sola columna de pernos: se supuso b = Leh; revise con la geometría real del elemento que aplica la tensión.'); } },
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
    union:'filete', w:8, electrodo:'E70XX', soporte:'col', columna:'HEB 300', aceroCol:'A572 Gr 50', colTope:false, tSop:25, aceroSop:'A36',
    // Revisión con Amo (20-nov):
    wAlma:'', kds:false,                                         // filete del alma (vacío = igual al de las alas) · aumento por dirección J2-5
    dosLados:false, Mu2:40, sentido2:'opuesto',                  // viga al otro lado de la columna
    rigCol:'auto', tsC:'', wsC:'', aceroRigC:'A36',              // placas de continuidad de la columna
    sismo:'no', Lh:6, Vg:30,                                     // WUF-W (AISC 358 cap. 8)
    uDebil:'trasl', Lt:150, wT:6,                                // viga al alma de la columna: placas traslapadas (B) o alas a tope (A)
    // Cartela bajo el ala inferior (pedido de Amo 25-nov): 'no' | 'T' (de perfil) | 'arm' (platinas) | 'pl' (platina sola)
    cart:'no', LhC:600, hhC:300, perfilCart:'', tcw:10, bph:150, tph:12.7, aceroCart:'', wC:6, wCc:8, wPA:5, rigPunta:false };
}
// Cordón en todo el perímetro por el método elástico con la garganta de cada tramo (alas y alma pueden tener filetes distintos).
// Cada punto: σ = P/A + M3·y/Ix + M2·x/Iy; V2 lo toman los cordones del alma (lados verticales del tubo), V3 los de las alas; torsión T·r/J.
// Con kds (J2-5) cada punto usa 1 + 0.5·sen^1.5θ, θ = ángulo entre la resultante y el eje del cordón (aproximación elástica).
function soldPerim(m, o){
  const tF = 0.707 * o.wF, tW = 0.707 * o.wW, segs = [];
  const S = (x1, y1, x2, y2, te, tipo, cara) => segs.push({ x1, y1, x2, y2, te, tipo, cara });
  const h = m.d / 2, b = m.bf / 2;
  if(m.tub){ S(-b, h, b, h, tF, 'F', 'sup'); S(-b, -h, b, -h, tF, 'F', 'inf'); S(-b, -h, -b, h, tW, 'W', 'izq'); S(b, -h, b, h, tW, 'W', 'der'); }
  else { const hi = h - m.tf, r = m.r || 0, xi = m.tw / 2 + r, yw = hi - r;
    S(-b, h, b, h, tF, 'F', 'ext'); S(-b, -h, b, -h, tF, 'F', 'ext');
    S(-b, hi, -xi, hi, tF, 'F', 'int'); S(xi, hi, b, hi, tF, 'F', 'int'); S(-b, -hi, -xi, -hi, tF, 'F', 'int'); S(xi, -hi, b, -hi, tF, 'F', 'int');
    S(-m.tw / 2, -yw, -m.tw / 2, yw, tW, 'W', 'izq'); S(m.tw / 2, -yw, m.tw / 2, yw, tW, 'W', 'der'); }
  const pts = []; let A = 0, AF = 0, AW = 0, Ix = 0, Iy = 0, LF = 0, LW = 0;
  segs.forEach(s => { const L = Math.hypot(s.x2 - s.x1, s.y2 - s.y1), n = 24; s.L = L; if(s.tipo === 'F') LF += L; else LW += L;
    for(let i = 0; i < n; i++){ const t = (i + 0.5) / n, x = s.x1 + (s.x2 - s.x1) * t, y = s.y1 + (s.y2 - s.y1) * t, a = s.te * L / n;
      A += a; if(s.tipo === 'F') AF += a; else AW += a; Ix += a * y * y; Iy += a * x * x; }
    for(let i = 0; i <= 8; i++){ const t = i / 8; pts.push({ x:s.x1 + (s.x2 - s.x1) * t, y:s.y1 + (s.y2 - s.y1) * t, s }); } });
  const J = Ix + Iy, k = 1000, P = o.P * k, V2 = o.V2 * k, V3 = o.V3 * k, T = o.T * 1e6, M2 = o.M2 * 1e6, M3 = o.M3 * 1e6;
  const fd = 0.75 * 0.6 * o.FEXX;
  const peor = { F:null, W:null }, qmax = {};
  pts.forEach(p => { const F = p.s.tipo === 'F';
    const sz = P / A + M3 * p.y / Ix + M2 * p.x / Iy, tx = (F ? V3 / AF : 0) - T * p.y / J, ty = (F ? 0 : V2 / AW) + T * p.x / J;
    const f = Math.hypot(sz, tx, ty), lon = Math.abs(F ? tx : ty), sen = f > 0 ? Math.sqrt(Math.max(0, 1 - (lon / f) ** 2)) : 0;
    const kds = o.kds ? 1 + 0.5 * sen ** 1.5 : 1, cap = fd * kds, r = f / cap, q = f * p.s.te;
    const g = p.s.tipo; if(!peor[g] || r > peor[g].r) peor[g] = { f, cap, kds, r, x:p.x, y:p.y, sen };
    const kq = p.s.tipo + ':' + p.s.cara; qmax[kq] = Math.max(qmax[kq] || 0, q); });
  return { A, AF, AW, Ix, Iy, J, LF, LW, peor, qmax, fd };
}
// Corte de las esquinas de las placas de continuidad junto al radio alma–ala de la columna (pedido de Amo 20-nov, igual en todas):
// sin sismo a 45° con cateto = radio del perfil (mín. 15 mm); con sismo AWS D1.8 cláusula 4.1 (AISC 341 I2.4): a lo largo del alma
// por lo menos 38 mm más allá de k (desde la cara interior del ala = r + 38) y a lo largo del ala no más de 12 mm más allá de k1 (se usa r).
const corteEsq = (cl, sis) => { const r = Math.max(+cl.r || 0, 15); return { ala:r, alma:sis ? Math.ceil(r + 38) : r, sis:!!sis }; };
const reqCorte = k => [`Corte de las esquinas de las placas (radio alma–ala de la columna): ${k.ala} mm a lo largo del ala × ${k.alma} mm a lo largo del alma${k.sis ? ' (AWS D1.8 cl. 4.1 / AISC 341 I2.4)' : ' (a 45°, cateto = radio del perfil, mín. 15 mm)'}`, true, 'indicar en planos'];
// Ancho de la placa de continuidad que recibe el ala en el eje débil: con tubo, la lengüeta queda en la parte plana (B − 4t, pedido de Amo 20-nov)
const bPlDebil = (m, cl) => Math.min(m.tub ? m.bf - 4 * m.tf : m.bf, cl.d - 2 * cl.tf);
function calcSoldada0(c){
  const ch = [], av = [], pasos = [], req = [], add = addF(ch), E = 200000;
  const P = nz(c.P), V3 = nz(c.V3), T = nz(c.T), M2 = nz(c.M2);
  let V2 = nz(c.Vu), M3 = nz(c.Mu);
  const am = ACEROS[c.aceroViga], FEXX = ELECTRODOS[c.electrodo] || 483;
  let m;                                                                           // propiedades del miembro [mm]
  if(c.miembro === 'tubo'){ const H = +c.H, B = +c.B, t = +c.tt, Hi = H - 2 * t, Bi = B - 2 * t;
    m = { nom:`Tubo ${H}×${B}×${t}`, d:H, bf:B, tf:t, tw:t, A:H * B - Hi * Bi, Zx:(B * H * H - Bi * Hi * Hi) / 4, Zy:(H * B * B - Hi * Bi * Bi) / 4, Aw2:2 * H * t, Aw3:2 * B * t, tub:true }; }
  else { const pf = (G.PERFILES_LAM || []).find(x => x[0] === c.viga); if(!pf) return { error:'Escoja el perfil.' };
    m = { nom:pf[0], d:pf[2], bf:pf[3], tw:pf[4], tf:pf[5], r:pf[6], A:pf[7], Zx:pf[10], Zy:pf[13], kg:pf[16], Aw2:pf[2] * pf[4], Aw3:2 * pf[3] * pf[5] }; }
  const plSop = c.soporte === 'placa', cl = plSop ? null : perfil(c.columna), alma = c.soporte === 'alma' && !!cl;   // alma = eje débil (pedido de Amo 20-nov)
  const tS = plSop ? +c.tSop : (cl ? (alma ? cl.tw : cl.tf) : 0), acS = plSop ? ACEROS[c.aceroSop] : (cl ? ACEROS[c.aceroCol] : null);
  const wMinT = t => t <= 6 ? 3 : t <= 13 ? 5 : t <= 19 ? 6 : 8;
  pasos.push(`Miembro ${m.nom} (${c.aceroViga}): d = ${m.d}, b = ${m.bf}, tf = ${m.tf}, tw = ${m.tw} mm · P = ${r2(P)}, V2 = ${r2(V2)}, V3 = ${r2(V3)} kN · T = ${r2(T)}, M2 = ${r2(M2)}, M3 = ${r2(M3)} kN·m`);

  // ── Sismo: WUF-W (AISC 358 cap. 8): rótula en la cara de la columna, Mf = Mpr ──
  const sis = ['DMO', 'DES'].includes(c.sismo) ? c.sismo : '';
  let Mcol = Math.abs(M3);
  if(sis){
    const Fy = am.Fy, Fu = am.Fu, Ry = RY(c.aceroViga), Cpr = Math.min(1.2, (Fy + Fu) / (2 * Fy)), Mpr = Cpr * Ry * Fy * m.Zx / 1e6;
    const Lh = Math.max(+c.Lh || 0, 0.1) * 1000, Vh = 2 * Mpr * 1000 / Lh + Math.abs(+c.Vg || 0);
    pasos.push(`Sismo ${sis} — conexión WUF-W (AISC 358 cap. 8, NSR-10 F.3): Cpr = ${r3(Cpr)}, Ry = ${Ry} → Mpr = Cpr·Ry·Fy·Zx = ${r2(Mpr)} kN·m; la rótula está en la cara (Sh = 0) → Mf = Mpr; Vu = 2Mpr/L + Vg = ${r2(Vh)} kN (L = ${r2(Lh / 1000)} m)`);
    Mcol = Math.max(Mcol, Mpr); if(Vh > Math.abs(V2)) V2 = Vh;
    av.push(`Con sismo ${sis} la columna y el cortante se revisan con el momento probable de la viga Mf = ${r2(Mpr)} kN·m, no con el del modelo.`);
    if(m.tub) req.push(['WUF-W solo está precalificada para vigas de perfil I', false, 'use un perfil I']);
    req.push(['Sismo: alas y alma con soldadura de penetración completa (WUF-W, AISC 358 §8.7)', c.union === 'cjp', c.union === 'cjp' ? 'CJP' : 'el filete en todo el perímetro no está precalificado']);
    if(!m.tub){ const L = sis === 'DES' ? 7 : 5;
      req.push(['Precalificación WUF-W: altura de la viga ≤ 914 mm (W36)', m.d <= 914.5, `${m.d} mm`]);
      req.push(['Precalificación WUF-W: espesor del ala ≤ 25.4 mm', m.tf <= 25.5, `${m.tf} mm`]);
      req.push(['Precalificación WUF-W: peso ≤ 223 kg/m (150 lb/ft)', !m.kg || m.kg <= 223.5, m.kg ? `${m.kg} kg/m` : '—']);
      req.push([`Precalificación WUF-W: luz libre / altura ≥ ${L} (${sis})`, Lh / m.d >= L - 1e-6, `${r1(Lh / m.d)}`]); }
    req.push(['Huecos de acceso con la forma de AWS D1.8, soldaduras de demanda crítica, quitar respaldo del ala inferior', true, 'indicar en planos']);
    if(sis === 'DES') av.push('Pórtico DES: revise también columna fuerte–viga débil (ΣM*pc/ΣM*pb > 1) con NSR-10 F.3.5 (AISC 341 E3).');
  }

  // ── Alma de la columna (eje débil): placas de continuidad a la altura de las alas de la viga ──
  const FfuE = Mcol * 1000 / (m.d - m.tf) + Math.abs(P) / 2, arW = ACEROS[c.aceroRigC] || ACEROS.A36;
  let tsW = 0;
  if(alma && (Mcol > 0 || c.rigCol === 'si') && c.rigCol !== 'no'){
    const b = bPlDebil(m, cl), bsW = (cl.bf - cl.tw) / 2;
    const tReq = Math.max(c.uDebil === 'tope' && !m.tub ? m.tf : 6.4, FfuE * 1000 / (0.9 * arW.Fy * b), bsW / (0.56 * Math.sqrt(E / arW.Fy)));
    tsW = +c.tsC > 0 ? +c.tsC : (ESP_PL.find(t => t >= tReq - 1e-6) || 38.1); }
  const dosA = alma && !!c.dosLados, tope = c.uDebil === 'tope' && !m.tub;          // tubo: siempre placa traslapada sobre la cara (pedido de Amo 20-nov)
  // Traslapada: la fuerza de cada ala pasa a la placa con brazo d + ts (placas por fuera de las alas)
  const FfuA = alma && tsW && !tope ? Mcol * 1000 / (m.d + tsW) + Math.abs(P) / 2 : FfuE;

  // ── Soldadura ──
  let sug = null;
  if(alma){
    // Viga al alma de la columna (pedido de Amo 20-nov): el alma de la viga se suelda al alma de la columna (toma V2);
    // las alas van a las placas de continuidad: «tope» = CJP en el mismo plano · «trasl» = placa por fuera del ala con filetes (por defecto).
    const hw = m.tub ? m.d - 2 * m.tf : m.d - 2 * m.tf - 2 * (m.r || 0), w = +c.w || 0, Vw = Math.abs(V2);
    if(c.union === 'cjp') pasos.push(`Alma de la viga al alma de la columna con penetración completa (resistencia del metal base); toma V2 = ${r2(Vw)} kN.`);
    else {
      const qL = Vw / (2 * hw);                                                   // kN/mm por cordón (2 cordones)
      pasos.push(`Alma de la viga al alma de la columna: 2 filetes de ${w} mm, largo h = ${r1(hw)} mm; toman V2 = ${r2(Vw)} kN → ${r3(qL)} kN/mm por cordón${Math.abs(T) || Math.abs(V3) ? ' (T y V3 no se reparten aquí: avisos)' : ''}`);
      add('soldadura', 'Filetes del alma de la viga al alma de la columna', 'F.2.10.2.4 (J2-4), φ = 0.75', qL, fw2(FEXX, w), 'kN/mm', `V2/(2h), w = ${w} mm`);
      add('soldadura', 'Metal base del alma de la viga junto a los filetes', 'F.2.10.2.4 · φ = 0.75 · 0.6·Fu·t', m.tub ? qL : 2 * qL, 0.45 * am.Fu * m.tw / 1000, 'kN/mm', m.tub ? `pared t = ${m.tw} mm` : `dos cordones sobre tw = ${m.tw} mm`);
      add('columna', 'Metal base del alma de la columna junto a los filetes', 'F.2.10.2.4 · φ = 0.75 · 0.6·Fu·t', 2 * qL * (dosA ? 2 : 1), 0.45 * acS.Fu * cl.tw / 1000, 'kN/mm', `tw = ${cl.tw} mm${dosA ? '; con la viga del otro lado (×2)' : ''}`);
      req.push(['Filete del alma ≥ mínimo Tabla J2.4', w >= wMinT(Math.min(m.tw, cl.tw)), `${w} ≥ ${wMinT(Math.min(m.tw, cl.tw))} mm`]);
      const wOk = [3, 5, 6, 8, 10, 12, 14, 16].find(x => x >= wMinT(Math.min(m.tw, cl.tw)) && qL <= fw2(FEXX, x) + 1e-9 && 2 * qL * (dosA ? 2 : 1) <= 0.45 * acS.Fu * cl.tw / 1000);
      if(wOk && wOk !== w) sug = { tipo:'sold', ok:true, w:wOk, txt:`💡 Usar filete de ${wOk} mm en el alma` };
    }
    if(Math.abs(T) > 0 || Math.abs(V3) > 0) av.push('V3 y T no se revisan en la soldadura al alma de la columna; si son importantes, revíselos aparte.');
    if(Mcol > 0 && tsW){
      const b = bPlDebil(m, cl);
      if(tope){
        pasos.push(`Alas de la viga a tope con el borde de la placa (penetración completa, mismo plano): resistencia igual al metal base; la placa ts = ${tsW} mm ≥ tf = ${m.tf} mm.`);
        add('viga', 'Ala de la viga a tensión en la junta', 'F.2.4 (D2-1), φ = 0.90', FfuA, 0.9 * am.Fy * m.bf * m.tf / 1000, 'kN', '0.9·Fy·bf·tf');
        req.push(['Alas a tope: soldadura de penetración completa con bisel y respaldo; inspección (ultrasonido recomendado)', true, 'indicar en planos']);
      } else {
        const Lt = +c.Lt || 0, wT = +c.wT || 0, fwT = fw2(FEXX, wT), Rl = 2 * Lt * fwT, Rt = b * fwT, cap = Math.max(Rl + Rt, 0.85 * Rl + 1.5 * Rt);
        pasos.push(`${m.tub ? "Placas traslapadas por fuera del tubo (encima de la cara superior y debajo de la inferior)" : "Placas traslapadas por fuera de las alas (encima del ala superior y debajo de la inferior)"}: brazo d + ts → F = M/(d + ts) + P/2 = ${r2(FfuA)} kN; filetes de ${wT} mm: 2 longitudinales de ${Lt} mm + 1 transversal de ${r1(b)} mm (J2.4c: máx(Rl + Rt; 0.85Rl + 1.5Rt) = ${r2(cap)} kN)`);
        add('soldadura', m.tub ? 'Filetes de la placa sobre la cara del tubo' : 'Filetes de la placa sobre el ala de la viga', 'F.2.10.2.4 (J2-4, J2.4c), φ = 0.75', FfuA, cap, 'kN', `2 × ${Lt} mm + ${r1(b)} mm, w = ${wT} mm`);
        const blq = (Fu, t) => 0.75 * (0.6 * Fu * 2 * Lt * t + Fu * b * t) / 1000;
        add('placas', 'Placa: rotura junto a los filetes (bloque)', 'F.2.10.4.3 (J4-5), φ = 0.75', FfuA, blq(arW.Fu, tsW), 'kN', `0.6·Fu·2Lt·ts + Fu·b·ts, ts = ${tsW} mm`);
        add('viga', m.tub ? 'Cara del tubo: rotura junto a los filetes (bloque)' : 'Ala de la viga: rotura junto a los filetes (bloque)', 'F.2.10.4.3 (J4-5), φ = 0.75', FfuA, blq(am.Fu, m.tf), 'kN', `0.6·Fu·2Lt·t + Fu·b·t, ${m.tub ? 'pared' : 'tf'} = ${m.tf} mm`);
        const tm = Math.min(tsW, m.tf);
        req.push([m.tub ? 'Filete de la placa sobre el tubo ≥ mínimo Tabla J2.4' : 'Filete de la placa sobre el ala ≥ mínimo Tabla J2.4', wT >= wMinT(tm), `${wT} ≥ ${wMinT(tm)} mm`]);
        req.push(['Filete en el borde de la placa ≤ ts − 1.6 mm (J2.2b)', tsW < 6 ? wT <= tsW : wT <= tsW - 1.6 + 1e-6, `${wT} ≤ ${r1(tsW < 6 ? tsW : tsW - 1.6)} mm`]);
        if(Lt < b) av.push(`El traslapo (${Lt} mm) es más corto que el ancho de la placa (${r1(b)} mm); se recomienda Lt ≥ b para repartir bien la fuerza.`);
        if(m.tub){ if(c.uDebil === 'tope') av.push('Con viga de tubo las placas van traslapadas sobre las caras superior e inferior del tubo (no a tope); se calculó así.');
          pasos.push(`Tubo: la lengüeta de la placa sobre el tubo se hace con ancho b = ${r1(b)} mm, dentro de la parte plana de la cara (B − 4t = ${r1(m.bf - 4 * m.tf)} mm; radio exterior ≈ 2t), para que los filetes longitudinales queden sobre la cara plana.`);
          req.push(['Placa dentro de la parte plana del tubo: b ≤ B − 4t', b <= m.bf - 4 * m.tf + 1e-6 && b > 0, `${r1(b)} ≤ ${r1(m.bf - 4 * m.tf)} mm`]); }
        av.push(m.tub ? 'Placa traslapada: queda fuera del plano de la cara del tubo; la pequeña excentricidad (t + ts)/2 no se revisa. Las placas van encima de la cara superior y debajo de la inferior, soldadas también al alma y a las alas de la columna.' : 'Placa traslapada: queda fuera del plano del ala; la pequeña excentricidad (tf + ts)/2 no se revisa. Las placas van encima del ala superior y debajo de la inferior, soldadas también al alma y a las alas de la columna.');
        // 💡 traslapo y filete mínimos que cumplen
        { let best = null;
          [5, 6, 8, 10, 12, 14, 16].filter(x => x >= wMinT(tm) && x <= (tsW < 6 ? tsW : tsW - 1.6)).forEach(x => { for(let L = Math.max(75, Math.ceil(b / 25) * 25); L <= 450; L += 25){ const f = fw2(FEXX, x), rl = 2 * L * f, rt = b * f, cp = Math.max(rl + rt, 0.85 * rl + 1.5 * rt);
            if(cp >= FfuA && blq(arW.Fu, tsW) >= FfuA && blq(am.Fu, m.tf) >= FfuA){ const v = x * x * (2 * L + b); if(!best || v < best.v) best = { wT:x, Lt:L, v }; break; } } });
          if(best && (best.wT !== wT || best.Lt !== Lt)){ const t2 = `traslapo de ${best.Lt} mm con filete de ${best.wT} mm`;
            sug = sug ? { ...sug, wT:best.wT, Lt:best.Lt, txt:`${sug.txt} y ${t2}` } : { tipo:'sold', ok:true, wT:best.wT, Lt:best.Lt, txt:`💡 Usar ${t2}` }; } }
      }
    }
  } else if(c.union === 'cjp'){
    pasos.push('Penetración completa en todo el perímetro: la soldadura tiene la resistencia del metal base (Tabla F.2.10.2-5); se revisa la sección del miembro en la cara del soporte.');
    const Pc = 0.9 * am.Fy * m.A / 1000, Mcx = 0.9 * am.Fy * m.Zx / 1e6, Mcy = 0.9 * am.Fy * m.Zy / 1e6, pr = Math.abs(P) / Pc, M3m = Math.abs(nz(c.Mu));
    const inter = pr >= 0.2 ? pr + 8 / 9 * (M3m / Mcx + Math.abs(M2) / Mcy) : pr / 2 + M3m / Mcx + Math.abs(M2) / Mcy;
    add('soldadura', 'Sección en la cara: axial + flexión en ambos ejes', 'F.2.8.1 (H1-1a/b), φ = 0.90', inter, 1, '', `φPn ${r2(Pc)} kN, φMn3 ${r2(Mcx)}, φMn2 ${r2(Mcy)} kN·m${sis ? ' · con las cargas del modelo (la rótula sísmica se forma aquí por diseño)' : ''}`);
    const tors = m.tub ? Math.abs(T) * 1e6 / (2 * (m.d - m.tf) * (m.bf - m.tw) * m.tf) : Math.abs(T) * 1e6 * Math.max(m.tf, m.tw) / ((2 * m.bf * m.tf ** 3 + m.d * m.tw ** 3) / 3);
    add('soldadura', 'Cortante V2 con torsión', 'F.2.7 (G2-1) · esfuerzo', Math.abs(V2) * 1000 / m.Aw2 + tors, 0.6 * am.Fy, 'MPa', `V2/Aw + τ torsión (${r1(tors)} MPa)${sis ? '; V2 = 2Mpr/L + Vg' : ''}`);
    add('soldadura', 'Cortante V3 con torsión', 'F.2.7 (G6) · esfuerzo', Math.abs(V3) * 1000 / m.Aw3 + tors, 0.9 * 0.6 * am.Fy, 'MPa', `V3/Af + τ torsión`);
  } else {
    const wF = +c.w || 0, wW = nz(c.wAlma) > 0 ? nz(c.wAlma) : wF, kds = !!c.kds;
    const FuS = acS ? acS.Fu : Infinity;
    const evalW = (wf, ww) => { const R = soldPerim(m, { wF:wf, wW:ww, kds, FEXX, P, V2, V3, T, M2, M3 });
      const q = R.qmax, bF = m.tub ? q['F:sup'] || 0 : (q['F:ext'] || 0) + (q['F:int'] || 0), bW = m.tub ? Math.max(q['W:izq'] || 0, q['W:der'] || 0) : (q['W:izq'] || 0) + (q['W:der'] || 0);
      const capF = 0.45 * am.Fu * m.tf, capW = 0.45 * am.Fu * m.tw; let qS = Math.max(...Object.values(q)), capS = 0.45 * FuS * tS, qSF = 0, capSF = 0;
      if(alma){ const qF = Math.max(...Object.entries(q).filter(([k2]) => k2[0] === 'F').map(([, v]) => v), 0), qW = Math.max(...Object.entries(q).filter(([k2]) => k2[0] === 'W').map(([, v]) => v), 0);
        qS = qW * (dosA ? 2 : 1); capS = 0.45 * FuS * cl.tw;                                    // cordones del alma de la viga sobre el alma de la columna
        qSF = qF * (tsW ? 1 : (dosA ? 2 : 1)); capSF = tsW ? 0.45 * arW.Fu * tsW : 0.45 * FuS * cl.tw; }   // cordones de las alas sobre las placas (o sobre el alma)
      const rmax = Math.max(R.peor.F.r, R.peor.W.r, bF / capF, bW / capW, acS ? qS / capS : 0, alma ? qSF / capSF : 0);
      return { R, bF, bW, capF, capW, qS, capS, qSF, capSF, rmax }; };
    const X = evalW(wF, wW), R = X.R, nomF = m.tub ? 'caras horizontales (b)' : 'alas', nomW = m.tub ? 'caras verticales (d)' : 'alma', delW = m.tub ? 'de las' : 'del';
    pasos.push(`Filete en todo el contorno (${m.tub ? 'perímetro rectangular' : 'alas por ambas caras y alma por ambas caras'}): ${nomF} w = ${wF} mm, ${nomW} w = ${wW} mm${nz(c.wAlma) > 0 ? '' : ' (igual)'}; método elástico con la garganta de cada tramo: A = ${Math.round(R.A)} mm², Ix = ${(R.Ix / 1e6).toFixed(3)}·10⁶, Iy = ${(R.Iy / 1e6).toFixed(3)}·10⁶ mm⁴; V2 en el ${nomW}, V3 en las ${nomF}`);
    pasos.push(`Resistencia del cordón φ·0.60·FEXX = ${r1(R.fd)} MPa sobre la garganta${kds ? ' × (1 + 0.5·sen^1.5θ) en cada punto (J2-5)' : ' (sin aumento por dirección)'}`);
    const pf_ = R.peor.F, pw_ = R.peor.W;
    add('soldadura', `Cordón de las ${nomF}`, `F.2.10.2.4 (J2-4${kds ? ', J2-5' : ''}), φ = 0.75`, pf_.f, pf_.cap, 'MPa', `w = ${wF} mm; punto (${r1(pf_.x)}, ${r1(pf_.y)})${kds ? `, kds = ${r3(pf_.kds)}` : ''}`);
    add('soldadura', `Cordón ${delW} ${nomW}`, `F.2.10.2.4 (J2-4${kds ? ', J2-5' : ''}), φ = 0.75`, pw_.f, pw_.cap, 'MPa', `w = ${wW} mm; punto (${r1(pw_.x)}, ${r1(pw_.y)})${kds ? `, kds = ${r3(pw_.kds)}` : ''}`);
    add('soldadura', `Metal base del miembro: ${nomF}`, 'F.2.10.2.4 · φ = 0.75 · 0.6·Fu·t', X.bF, X.capF, 'N/mm', m.tub ? `pared t = ${m.tf} mm` : `cordones exterior + interior sobre tf = ${m.tf} mm`);
    add('soldadura', `Metal base del miembro: ${nomW}`, 'F.2.10.2.4 · φ = 0.75 · 0.6·Fu·t', X.bW, X.capW, 'N/mm', m.tub ? `pared t = ${m.tw} mm` : `cordones de las dos caras sobre tw = ${m.tw} mm`);
    if(alma){
      add('columna', `Metal base del alma de la columna junto al cordón del ${nomW}`, 'F.2.10.2.4 · φ = 0.75 · 0.6·Fu·t', X.qS, X.capS, 'N/mm', `tw = ${cl.tw} mm${dosA ? '; con la viga del otro lado (×2)' : ''}`);
      add(tsW ? 'placas' : 'columna', `Metal base ${tsW ? 'de la placa de continuidad' : 'del alma de la columna'} junto al cordón de las ${nomF}`, 'F.2.10.2.4 · φ = 0.75 · 0.6·Fu·t', X.qSF, X.capSF, 'N/mm', tsW ? `ts = ${tsW} mm` : `tw = ${cl.tw} mm`);
    } else if(acS) add(plSop ? 'soporte' : 'columna', `Metal base del ${plSop ? 'soporte (placa)' : 'ala de la columna'} junto al cordón`, 'F.2.10.2.4 · φ = 0.75 · 0.6·Fu·t', X.qS, X.capS, 'N/mm', `cordón más cargado sobre t = ${tS} mm`);
    const tmF = Math.min(m.tf, alma ? (tsW || cl.tw) : (tS || 99)), tmW = Math.min(m.tw, tS || 99);
    req.push([`Filete de las ${nomF} ≥ mínimo Tabla J2.4`, wF >= wMinT(tmF), `${wF} ≥ ${wMinT(tmF)} mm (parte más delgada ${tmF} mm)`]);
    req.push([`Filete ${delW} ${nomW} ≥ mínimo Tabla J2.4`, wW >= wMinT(tmW), `${wW} ≥ ${wMinT(tmW)} mm (parte más delgada ${tmW} mm)`]);
    if(kds) av.push('Aumento por dirección (J2-5) aplicado punto por punto con el método elástico: es una aproximación; la norma lo permite en grupos de filetes del mismo tamaño cargados en su plano.');
    av.push('Unión en T: no aplica el tamaño máximo del filete en el borde (F.2.10.2.2 es para bordes de platinas).');
    // 💡 Sugerencia: filetes más pequeños que cumplen (menor volumen de soldadura); si ninguno alcanza, penetración completa
    const W = [3, 5, 6, 8, 10, 12, 14, 16]; let best = null;
    W.filter(a => a >= wMinT(tmF)).forEach(a => W.filter(b2 => b2 >= wMinT(tmW)).forEach(b2 => { const Y = evalW(a, b2); if(Y.rmax > 1) return;
      const vol = a * a * R.LF + b2 * b2 * R.LW; if(!best || vol < best.vol - 1e-6) best = { w:a, wAlma:b2, vol, max:Y.rmax }; }));
    if(sis) sug = { tipo:'sold', ok:true, union:'cjp', txt:'💡 Cambiar a penetración completa (exigida por el sismo)' };
    else if(best && (best.w !== wF || best.wAlma !== wW)) sug = { tipo:'sold', ok:true, w:best.w, wAlma:best.wAlma === best.w ? '' : best.wAlma, max:best.max,
      txt:`💡 Usar filete de ${best.w} mm en las ${nomF} y ${best.wAlma} mm en ${m.tub ? 'las' : 'el'} ${nomW} (relación ${best.max.toFixed(2)})` };
    else if(!best){ sug = { tipo:'sold', ok:true, union:'cjp', txt:'💡 Ningún filete hasta 16 mm alcanza: cambiar a penetración completa' };
      av.push('Ningún filete hasta 16 mm alcanza: use soldadura de penetración completa o un miembro con paredes más gruesas.'); }
  }

  // ── Soporte ──
  const Ffu = alma ? FfuA : Mcol * 1000 / (m.d - m.tf) + Math.abs(P) / 2;
  const N = m.tf + 2 * (c.union === 'cjp' ? 0 : +c.w);
  pasos.push(`Fuerza en cada ala Ffu = ${sis ? 'Mf' : 'M3'}/(d − tf) + |P|/2 = ${r2(Ffu)} kN; longitud de apoyo N = tf + 2w = ${r1(N)} mm`);
  let rig = null;
  if(alma){
    // Viga al alma de la columna (eje débil): el alma no resiste la fuerza de las alas fuera de su plano → placas de continuidad
    // a la altura de las alas, soldadas al alma y a las dos alas de la columna; las alas de la columna trabajan a cortante en su plano.
    const ac = ACEROS[c.aceroCol], Mu2 = dosA ? Math.abs(+c.Mu2 || 0) : 0, F2 = dosA ? Mu2 * 1000 / (m.d - m.tf) : 0, op = dosA && c.sentido2 !== 'mismo';
    const KC = corteEsq(cl, sis), clip = KC.ala, bsW = (cl.bf - cl.tw) / 2, Lf = bsW - clip, b = bPlDebil(m, cl);
    pasos.push(`Viga al alma de ${cl.nom} (eje débil): espacio entre alas d − 2tf = ${r1(cl.d - 2 * cl.tf)} mm; ancho por lado del alma bs = (bf − tw)/2 = ${r1(bsW)} mm`);
    req.push(['El ala de la viga cabe entre las alas de la columna: b ≤ d − 2tf', m.bf <= cl.d - 2 * cl.tf + 1e-6, `${m.bf} ≤ ${r1(cl.d - 2 * cl.tf)} mm`]);
    if(m.bf > cl.d - 2 * cl.tf - 2 * cl.r) av.push(`El ala de la viga (${m.bf} mm) choca con los radios de la columna (T = ${r1(cl.d - 2 * cl.tf - 2 * cl.r)} mm): recorte las esquinas del ala o use placas prolongadas fuera de las alas.`);
    if(dosA) pasos.push(`Viga al otro lado del alma: M₂ = ${r2(Mu2)} kN·m → F₂ = ${r2(F2)} kN; momentos ${op ? 'opuestos' : 'del mismo sentido'}`);
    if(Mcol > 0 && c.rigCol === 'no') req.push(['Placas de continuidad para la viga al alma de la columna', false, 'el alma no resiste la fuerza de las alas fuera de su plano: escoja «Automático» o «Sí»']);
    if(tsW){
      const Fm = Math.max(Ffu, F2), capWl = w => fw2(FEXX, w) * 4 * Lf;
      const ws = +c.wsC > 0 ? +c.wsC : ([5, 6, 8, 10, 12, 14, 16].find(w => w >= wMinT(Math.min(tsW, cl.tf)) && capWl(w) >= Fm) || 16);
      rig = { ts:tsW, ws, bs:bsW, clip, corte:KC, debil:true };
      pasos.push(`Placas de continuidad a la altura de las alas de la viga: ts = ${tsW} mm (${c.aceroRigC}${+c.tsC > 0 ? ', escrito' : ', automático'}), soldadas a las dos alas de la columna con filetes de ${ws} mm${+c.wsC > 0 ? '' : ' (automático)'} (Lf = ${r1(Lf)} mm por ala) y al alma`);
      add('placas', 'Placa de continuidad a tensión (recibe el ala de la viga)', 'F.2.4 (D2-1), φ = 0.90', Ffu, 0.9 * arW.Fy * b * tsW / 1000, 'kN', `0.9·Fy·b·ts, b = ${r1(b)} mm`);
      add('placas', 'Filetes de la placa a las dos alas de la columna', 'F.2.10.2.4 (J2-4)', Fm, capWl(ws), 'kN', `2 alas × 2 filetes × ${r1(Lf)} mm · ${ws} mm`);
      if(tope) req.push(['Placas: ts ≥ tf de la viga (alas a tope en el mismo plano)', tsW >= m.tf - 1e-6, `${tsW} ≥ ${m.tf} mm`]);
      req.push(['Placas: bs/ts ≤ 0.56√(E/Fy)', bsW / tsW <= 0.56 * Math.sqrt(E / arW.Fy) + 1e-6, `${r1(bsW / tsW)} ≤ ${r1(0.56 * Math.sqrt(E / arW.Fy))}`]);
      req.push(['Placas: filete ≥ mínimo Tabla J2.4', ws >= wMinT(Math.min(tsW, cl.tf)), `${ws} ≥ ${wMinT(Math.min(tsW, cl.tf))} mm`]);
      req.push(reqCorte(KC));
      if(Mcol > 0 && (tope ? m.bf : b) < cl.d - 2 * cl.tf - 1) req.push([`Placa en forma de T (más angosta donde ${tope ? 'sale de la columna' : 'monta sobre ' + (m.tub ? 'el tubo' : 'el ala')}): esquinas entrantes con radio ≥ 13 mm (recomendado 25 mm), sin cortes en ángulo recto`, true, 'indicar en planos']);
      if(tope) av.push('Prolongue las placas de continuidad 50–75 mm fuera de las alas de la columna y suelde el ala de la viga a tope (penetración completa) con el borde de la placa.');
      if(dosA && op) av.push('Vigas a los dos lados del alma con momentos opuestos: la parte que se equilibra pasa por el espesor del alma; suelde las placas al alma con penetración completa.');
    }
    if(Mcol > 0){ const Vw = !dosA ? Ffu : op ? Math.abs(Ffu - F2) : Ffu + F2, Rvf = 0.9 * 0.6 * ac.Fy * 2 * cl.bf * cl.tf / 1000;
      add('columna', 'Zona de panel del eje débil (cortante de las dos alas de la columna)', 'F.2.7.6 (G7), φ = 0.90', Vw, Rvf, 'kN', `${!dosA ? 'Ffu' : op ? '|F₁ − F₂|' : 'F₁ + F₂'} contra 0.6·Fy·2·bf·tf`); }
    if(sis) req.push(['Sismo: la conexión WUF-W solo está precalificada al ala de la columna (eje fuerte)', false, 'en el eje débil no hay conexión precalificada']);
    if(Math.abs(M2) > 0) av.push('M2 de la viga dobla el alma de la columna fuera de su plano en la dirección vertical; revíselo si es importante.');
    if(!Mcol) pasos.push('Solo cortante: la viga se suelda directo al alma de la columna; no hacen falta placas de continuidad.');
  }
  else if(plSop){ const ps = ACEROS[c.aceroSop], tp = +c.tSop;
    add('soporte', 'Placa de apoyo: flexión local bajo el ala en tensión', 'F.2.10.10.1 (J10-1) aplicado a la placa', Ffu, 0.9 * 6.25 * ps.Fy * tp * tp / 1000, 'kN', `t = ${tp} mm`);
    if(Math.abs(M2) > 0 || Math.abs(T) > 0) av.push('M2 y T llegan a la placa fuera de su plano; revise la placa y lo que la sostiene (pernos o soldadura).'); }
  else if(cl){
    const ac = ACEROS[c.aceroCol], kc = cl.tf + cl.r, hcw = cl.d - 2 * kc, tope = !!c.colTope, ar = ACEROS[c.aceroRigC] || ACEROS.A36;
    const dos = !!c.dosLados, Mu2 = dos ? Math.abs(+c.Mu2 || 0) : 0, F2 = dos ? Mu2 * 1000 / (m.d - m.tf) : 0, op = dos && c.sentido2 !== 'mismo';
    if(dos) pasos.push(`Viga al otro lado: M₂ = ${r2(Mu2)} kN·m → F₂ = ${r2(F2)} kN (misma altura); momentos ${op ? 'opuestos (gravedad)' : 'del mismo sentido (sismo/viento)'}`);
    const Fc = Math.max(Ffu, F2);
    const Rfb = 0.9 * 6.25 * ac.Fy * cl.tf ** 2 / 1000 * (tope ? 0.5 : 1);
    const ly = (tope ? 2.5 : 5) * kc + N, Rly = 1.0 * ac.Fy * cl.tw * ly / 1000;
    const rN = N / cl.d, cr = (tope && rN > 0.2) ? 0.4 * cl.tw ** 2 * (1 + (4 * rN - 0.2) * (cl.tw / cl.tf) ** 1.5) : (tope ? 0.4 : 0.8) * cl.tw ** 2 * (1 + 3 * rN * (cl.tw / cl.tf) ** 1.5);
    const Rcr = 0.75 * cr * Math.sqrt(E * ac.Fy * cl.tf / cl.tw) / 1000;
    const Rpb = op ? 0.9 * 24 * cl.tw ** 3 * Math.sqrt(E * ac.Fy) / hcw / 1000 * (tope ? 0.5 : 1) : Infinity;
    const Rst = Math.max(0, Fc - Rfb, Fc - Rly, Fc - Rcr, op ? Math.min(Ffu, F2) - Rpb : 0);
    // Placas de continuidad exigidas por sismo (AISC 341 E3.6f)
    let sisPide = false;
    if(sis){ const Ryb = RY(c.aceroViga), Ryc = RY(c.aceroCol), tcfMin = Math.max(0.4 * Math.sqrt(1.8 * m.bf * m.tf * Ryb * am.Fy / (Ryc * ac.Fy)), m.bf / 6);
      sisPide = cl.tf < tcfMin; pasos.push(`Sismo: placas de continuidad si tcf < máx(0.4√(1.8·bf·tf·Ryb·Fyb/(Ryc·Fyc)); bf/6) = ${r1(tcfMin)} mm → ${sisPide ? 'se requieren' : 'no se requieren'} (tcf = ${cl.tf} mm)`); }
    const usar = c.rigCol === 'si' || (c.rigCol === 'auto' && (Rst > 0 || sisPide));
    if(c.rigCol === 'no' && (Rst > 0 || sisPide)) req.push(['Placas de continuidad de la columna', false, sisPide ? 'el sismo las exige (AISC 341)' : `faltan ${r2(Rst)} kN en el ala o el alma`]);
    let capPl = 0;
    if(usar){
      const KC = corteEsq(cl, sis), clip = KC.ala, bs = (cl.bf - cl.tw) / 2, Lf = bs - clip, Lwc = cl.d - 2 * cl.tf - 2 * KC.alma;
      const Vp0 = !dos ? Ffu : op ? Math.abs(Ffu - F2) : Ffu + F2, Rv00 = 0.9 * 0.6 * ac.Fy * cl.d * cl.tw / 1000, DB = doublerTd(c, cl, ac, Vp0, Rv00, m.d - 2 * m.tf, sis);
      const tMinP = (dos || sis) ? m.tf : m.tf / 2;
      const Fst = Math.max(Rst, sisPide ? Ffu : 0);
      const tReq = Math.max(tMinP, bs / (0.56 * Math.sqrt(E / ar.Fy)), Fst > 0 ? Fst * 1000 / (0.9 * ar.Fy * 2 * Lf) : 0);
      const ts = +c.tsC > 0 ? +c.tsC : (ESP_PL.find(t => t >= tReq - 1e-6) || 38.1);
      const capFl = w => 1.5 * fw2(FEXX, w) * 2 * 2 * Lf;
      capPl = 0.9 * ar.Fy * 2 * Lf * ts / 1000;
      const PA = { c, cl, ac, ar, ts, Lw:Lwc, Fst, capA:capPl, Rv:DB.Rv, sis, FEXX, tdp:DB.tdp };
      const wMinW = wMinT(Math.min(ts, cl.tw)), demW = demPlacasAlma(PA).dem;
      // con sismo las placas van a las alas con CJP: el filete escrito o automático es el del alma
      const ws = +c.wsC > 0 ? +c.wsC : Math.max(wsAlmaAuto(FEXX, demW, Lwc, cl.tw, wMinW), sis ? 0 : ([5, 6, 8, 10, 12, 14, 16].find(w => w >= wMinT(Math.min(ts, cl.tf)) && capFl(w) >= Fst) || 16));
      rig = { ts, ws, bs, clip, corte:KC };
      pasos.push(`Placas de continuidad (2 por ala de la viga): bs = (bf − tw)/2 = ${r1(bs)} mm, corte de esquinas ${KC.ala} × ${KC.alma} mm (ala × alma), ts = ${ts} mm (${c.aceroRigC}${+c.tsC > 0 ? ', escrito' : ', automático'}), filetes ${ws} mm${+c.wsC > 0 ? '' : ' (automático)'}; fuerza que toman ${r2(Fst)} kN`);
      req.push([`Placas: ts ≥ ${dos || sis ? 'tf' : 'tf/2'} de la viga (J10.8${sis ? ', AISC 341' : ''})`, ts >= tMinP - 1e-6, `${ts} ≥ ${r1(tMinP)} mm`]);
      req.push(['Placas: bs + tw/2 ≥ bf de la viga/3 (J10.8)', bs + cl.tw / 2 >= m.bf / 3 - 1e-6, `${r1(bs + cl.tw / 2)} ≥ ${r1(m.bf / 3)} mm`]);
      req.push(['Placas: bs/ts ≤ 0.56√(E/Fy) (J10.8)', bs / ts <= 0.56 * Math.sqrt(E / ar.Fy) + 1e-6, `${r1(bs / ts)} ≤ ${r1(0.56 * Math.sqrt(E / ar.Fy))}`]);
      req.push(['Placas: filete ≥ mínimo Tabla J2.4', ws >= wMinT(Math.min(ts, cl.tf)), `${ws} ≥ ${wMinT(Math.min(ts, cl.tf))} mm`]);
      req.push(reqCorte(KC));
      if(Fst > 0){
        add('placas', 'Placas de continuidad: fluencia (tensión / compresión corta)', 'F.2.10.10.8 (J10.8), φ = 0.90', Fst, capPl, 'kN', `0.9·Fy·2·(bs − despunte)·ts`);
        if(!sis) add('placas', 'Filetes de las placas al ala de la columna', 'F.2.10.2.4 (J2-4, J2-5 ×1.5)', Fst, capFl(ws), 'kN', `2 placas × 2 caras × ${r1(Lf)} mm · ${ws} mm`);
        placasAlAlma({ ...PA, ws, add, req, av, pasos, grupo:'placas' }); }
      if(sis) req.push(['Sismo: placas de continuidad soldadas a las alas de la columna con penetración completa (AISC 341 E3.6f)', true, 'indicar en planos']);
    }
    const mp = usar ? ' + placas' : '';
    add('columna', 'Flexión local del ala de la columna', 'F.2.10.10.1 (J10-1)', Fc, Rfb + capPl, 'kN', `6.25·Fy·tf²${tope ? ' × 0.5 (en el tope)' : ''}${mp}`);
    add('columna', 'Fluencia local del alma', `F.2.10.10.2 (J10-${tope ? 3 : 2})`, Fc, Rly + capPl, 'kN', `L = ${tope ? '2.5' : '5'}k + N = ${r1(ly)} mm${mp}`);
    add('columna', 'Aplastamiento del alma', 'F.2.10.10.3 (J10-4/5)', Fc, Rcr + capPl, 'kN', `N/d = ${r3(rN)}${mp}`);
    if(op) add('columna', 'Pandeo del alma por las dos alas (vigas a los dos lados)', 'F.2.10.10.5 (J10-8), φ = 0.90', Math.min(Ffu, F2), Rpb + capPl, 'kN', `24·tw³·√(E·Fy)/h${mp}`);
    const Vp = !dos ? Ffu : op ? Math.abs(Ffu - F2) : Ffu + F2, Rv = 0.9 * 0.6 * ac.Fy * cl.d * cl.tw / 1000;
    panelConDoubler({ c, cl, ac, Vp, Rv0:Rv, dz:m.d - 2 * m.tf, sis, add, req, av, pasos, grupo:'columna', nomCh:'Zona de panel', ref:'F.2.10.10.6 (J10-9), φ = 0.90', txt:`${!dos ? 'Ffu' : op ? '|F₁ − F₂|' : 'F₁ + F₂'} contra 0.6·Fy·dc·tw (sin cortante de la columna)`, FEXX, cont:usar });
    req.push(['El miembro cabe en el ala de la columna: b ≤ bf de la columna', m.bf <= cl.bf + 1e-6, `${m.bf} ≤ ${cl.bf} mm`]);
    if(Math.abs(M2) > 0) av.push('M2 se transmite al ala de la columna como flexión fuera de su plano; si es importante, use rigidizadores o una placa.');
  } else av.push('No se revisó la columna: escoja su perfil.');
  req.push(['Acceso para soldar todo el contorno (también por dentro de las alas)', true, 'verificar en obra']);
  const r = fin(ch, req, av, pasos, { m, Ffu, rig });
  if(sug) r.sug = sug;
  return r;
}

// Espesor de la placa de refuerzo del alma y φRv del panel con ella (lo usan la zona de panel y las placas de continuidad)
function doublerTd(c, cl, ac, Vp, Rv0, dz0, sis){
  if(c.dp !== 'si') return { tdp:0, Rv:Rv0 };
  const E = 200000, ad = ACEROS[c.aceroDp] || ac, fac = Math.min(1, ad.Fy / ac.Fy), rv1 = Rv0 / cl.tw;
  const wz = cl.d - 2 * cl.tf, dz = Math.max(dz0 || 0, 1), t90 = (dz + wz) / 90;
  const tdq = Math.max(0, (Vp / rv1 - cl.tw) / fac), lim = 2.24 * Math.sqrt(E / ad.Fy);
  const tdp = +c.tdp > 0 ? +c.tdp : (ESP_PL.find(t => t >= Math.max(tdq, sis ? t90 : 0, wz / lim, 6) - 1e-6) || 38.1);
  return { tdp, Rv:Rv0 + rv1 * tdp * fac, tdq, fac, ad, rv1, wz, t90, lim };
}
// Unión de las placas de continuidad al alma de la columna (pedido de Amo 25-nov, puntos A y B):
// demanda: sin sismo la fuerza que toman las placas; con sismo la MENOR de AISC 341 E3.6f: (a) tensión de las placas en las alas,
// (b) cortante de las placas junto al alma, (c) zona de panel, (d) fuerza de las alas de la viga. Filete (≤ espesor del alma) o CJP,
// y metal base del alma (2 planos, arriba y abajo de la placa; con placa de refuerzo se suma su espesor).
const WS_LISTA = [5, 6, 8, 10, 12, 14, 16];
function demPlacasAlma(o){
  const { ar, ts, Lw, Fst, capA, Rv, sis } = o, capB = 1.0 * 0.6 * ar.Fy * ts * Lw * 2 / 1000;
  if(!sis) return { dem:Fst, capB, txt:'fuerza que toman las placas' };
  const op = [[Fst, '(d) fuerza de las alas de la viga'], [capA, '(a) tensión de las placas en las alas'], [capB, '(b) cortante de las placas junto al alma'], [Rv, '(c) zona de panel']].filter(x => isFinite(x[0]) && x[0] > 0);
  const m = op.reduce((a, x) => x[0] < a[0] ? x : a, op[0] || [0, '']);
  return { dem:m[0], capB, txt:`AISC 341 E3.6f: la menor de (a) ${r2(capA)}, (b) ${r2(capB)}, (c) ${r2(Rv)}, (d) ${r2(Fst)} kN → ${m[1]}` };
}
function wsAlmaAuto(FEXX, dem, Lw, tw, wMin){
  const ok = w => fw2(FEXX, w) * 4 * Lw >= dem;
  return WS_LISTA.find(w => w >= wMin && w <= tw + 1e-6 && ok(w)) || WS_LISTA.filter(w => w >= wMin && w <= Math.max(tw, wMin) + 1e-6).pop() || wMin;
}
function placasAlAlma(o){
  const { c, cl, ac, Lw, FEXX, ws, add, req, av, pasos, grupo, tdp } = o, { dem, capB, txt } = demPlacasAlma(o);
  if(!(dem > 0)) return;
  pasos.push(`Unión de las placas de continuidad al alma: demanda ${r2(dem)} kN (${txt}); largo junto al alma Lw = ${r1(Lw)} mm`);
  if(c.unPlW === 'cjp'){
    req.push(['Placas de continuidad al alma con penetración completa (desarrolla el cortante de las placas)', true, 'indicar en planos']);
    if(!o.sis) add(grupo, 'Placas de continuidad: cortante junto al alma (penetración completa)', 'F.2.10.10.8 · G2 · φ = 1.00', dem, capB, 'kN', `0.6·Fy·ts·Lw × 2 placas`);
  } else {
    add(grupo, 'Filetes de las placas al alma de la columna', 'F.2.10.2.4 (J2-4)', dem, fw2(FEXX, ws) * 4 * Lw, 'kN', `2 placas × 2 caras × ${r1(Lw)} mm · ${ws} mm`);
    req.push(['Filete de las placas al alma ≤ espesor del alma (uno mayor no aporta: manda el metal base)', ws <= cl.tw + 1e-6, `${ws} ≤ ${cl.tw} mm`]);
    if(fw2(FEXX, Math.min(ws, cl.tw)) * 4 * Lw < dem) av.push(`El filete de las placas al alma no alcanza sin pasar el espesor del alma (${cl.tw} mm): suéldelas con penetración completa («Placas al alma: penetración completa»).`);
  }
  const tAl = cl.tw + (tdp || 0), capAl = Math.min(1.0 * 0.6 * ac.Fy, 0.75 * 0.6 * ac.Fu) * tAl * Lw * 2 / 1000;
  add('columna', 'Metal base del alma de la columna junto a las placas', 'F.2.10.2.4 · mín(1.0·0.6·Fy; 0.75·0.6·Fu)', dem, capAl, 'kN', `2 planos × ${r1(Lw)} mm × t = ${r1(tAl)} mm${tdp ? ' (alma + placa de refuerzo)' : ''}`);
}

// ── Placa de refuerzo del alma de la columna (doubler) en la zona de panel (pedido de Amo 25-nov) ─────────────
// o = { c (campos dp, tdp, aceroDp, wdp, unDp), cl, ac (acero de la columna), Vp, Rv0 (φRv del alma sola), dz (alto del panel = d − 2tf de la viga),
//       sis, add, req, av, pasos, grupo, nomCh, ref, txt, FEXX, cont (hay placas de continuidad) } → φRv final (y agrega el chequeo)
function panelConDoubler(o){
  const { c, cl, ac, Vp, Rv0, sis, add, req, av, pasos, grupo, nomCh, ref, txt, FEXX } = o;
  if(c.dp !== 'si'){
    add(grupo, nomCh, ref, Vp, Rv0, 'kN', txt);
    if(Vp > Rv0){ const tdq = Vp / (Rv0 / cl.tw) - cl.tw, td = ESP_PL.find(t => t >= Math.max(tdq, (cl.d - 2 * cl.tf) / 90) - 1e-6) || 38.1;
      av.push(`La zona de panel no alcanza (${r2(Vp)} > ${r2(Rv0)} kN): active «Placa de refuerzo del alma» (unos ${td} mm, soldada al alma y a las alas) o use una columna de alma más gruesa.`); }
    return Rv0;
  }
  const E = 200000, { tdp, Rv, tdq, fac, ad, rv1, wz, t90, lim } = doublerTd(c, cl, ac, Vp, Rv0, o.dz, sis);
  add(grupo, nomCh + ' con placa de refuerzo', ref, Vp, Rv, 'kN', `${txt}; tw + ${tdp} mm de placa${fac < 1 ? ` × Fy,placa/Fy,col = ${r3(fac)}` : ''}`);
  pasos.push(`Placa de refuerzo del alma (doubler) ${tdp} mm${+c.tdp > 0 ? '' : ' (automática)'} (${c.aceroDp || 'acero de la columna'}): φRv = ${r2(Rv0)} + 0.9·0.6·Fy·dc·td = ${r2(Rv)} kN (espesor que hacía falta ${r1(tdq)} mm)`);
  // soldadura de la placa a las alas: desarrolla su resistencia a cortante (AISC 341 E3.6e.3; sin sismo, la fuerza que toma)
  const Vd = Vp * tdp * fac / (cl.tw + tdp * fac);                    // parte del cortante del panel que toma la placa
  const qDem = sis ? 0.9 * 0.6 * ad.Fy * tdp / 1000 : Vd / cl.d;     // por mm de cada borde vertical
  const wMin = tdp <= 6 ? 3 : tdp <= 13 ? 5 : tdp <= 19 ? 6 : 8, un = c.unDp || (sis ? 'cjp' : 'filete');
  if(un === 'filete' && sis && !([5, 6, 8, 10, 12, 14, 16].some(w => w <= tdp && fw2(FEXX, w) >= qDem))) av.push('Con sismo un filete no alcanza a desarrollar la resistencia de la placa de refuerzo sin pasar su espesor: suéldela a las alas con penetración completa.');
  if(un === 'cjp') req.push(['Placa de refuerzo a las alas de la columna con penetración completa (desarrolla su resistencia)', true, 'indicar en planos']);
  else {
    const wdp = +c.wdp > 0 ? +c.wdp : ([5, 6, 8, 10, 12, 14, 16].find(w => w >= wMin && w <= tdp && fw2(FEXX, w) >= qDem) || [5, 6, 8, 10, 12, 14, 16].find(w => w >= wMin && fw2(FEXX, w) >= qDem) || 16);
    add(grupo, 'Placa de refuerzo: filetes a las alas de la columna (cada borde)', sis ? 'AISC 341 E3.6e.3 · F.2.10.2.4 (J2-4)' : 'F.2.10.2.4 (J2-4)', qDem, fw2(FEXX, wdp), 'kN/mm', `${sis ? 'desarrolla 0.9·0.6·Fy·td' : `cortante que toma la placa Vd/dc, Vd = ${r2(Vd)} kN`}; filete ${wdp} mm${+c.wdp > 0 ? '' : ' (automático)'}`);
    req.push(['Placa de refuerzo: filete ≥ mínimo Tabla J2.4 y ≤ td', wdp >= wMin && wdp <= tdp + 1e-6, `${wMin} ≤ ${wdp} ≤ ${tdp} mm`]);
    req.push(['Placa de refuerzo: bisel o separación para no soldar sobre el radio (k) de la columna', true, `k = ${r1(cl.tf + (cl.r || 0))} mm; indicar en planos`]);
  }
  if(sis) req.push([`Placa de refuerzo: cada placa td ≥ (dz + wz)/90 (AISC 341 E3.6e.2), o soldaduras de tapón`, tdp >= t90 - 1e-6, `${tdp} ≥ ${r1(t90)} mm`]);
  else req.push(['Placa de refuerzo: wz/td ≤ 2.24√(E/Fy) (sin pandeo por cortante, G2.1)', wz / tdp <= lim + 1e-6, `${r1(wz / tdp)} ≤ ${r1(lim)}`]);
  req.push([o.cont ? 'Placa de refuerzo: de placa de continuidad a placa de continuidad, soldada a ellas' : 'Placa de refuerzo: se extiende al menos 150 mm por encima y por debajo de las alas de la viga', true, 'indicar en planos']);
  return Rv;
}

// ── Cartela bajo el ala inferior de la viga soldada (pedido de Amo 25-nov; opciones A, B y D) ─────────────
// Modelo de cercha en la cara: el ala superior de la viga toma la tensión y el patín inclinado de la cartela la compresión,
// con brazo z entre sus centroides → F = M/z + |P|/2 (horizontal). El patín lleva F/cosθ; la componente vertical F·tanθ la toma el alma
// de la cartela en la cara y entra como carga concentrada al alma de la viga en la punta. La unión viga–columna (perímetro o CJP)
// y la columna se revisan con la misma fuerza de ala (momento equivalente M·(d − tf)/z). Con sismo la rótula queda en la punta.
const CART_TIPOS = { T:'de perfil (T cortada)', arm:'de platinas (alma + patín)', pl:'de platina sola (sin patín)' };
function calcSoldada(c){
  const k = c.cart;
  if(!CART_TIPOS[k]) return calcSoldada0(c);
  if(c.miembro === 'tubo' || c.soporte === 'alma'){ const r = calcSoldada0(c);
    r.av.push('La cartela solo se calcula con viga de perfil I soldada al ala de una columna o a una placa; no se tuvo en cuenta.'); return r; }
  const E = 200000, ch = [], req = [], av = [], pasos = [], add = addF(ch);
  const m = perfilX(c.viga); if(!m) return { error:'Escoja el perfil de la viga.' };
  const am = ACEROS[c.aceroViga], ac = ACEROS[c.aceroCart] || am, FEXX = ELECTRODOS[c.electrodo] || 483;
  const Lh = +c.LhC || 0, hh = +c.hhC || 0; if(!(Lh > 0 && hh > 0)) return { error:'Escriba el largo Lh y el alto hh de la cartela.' };
  const th = Math.atan(hh / Lh), cs = Math.cos(th), sn = Math.sin(th), Lc = Math.hypot(Lh, hh), deg = th * 180 / Math.PI;
  let bfh = 0, tfh = 0, twh = 0, pc = null;
  if(k === 'T'){ pc = perfil(c.perfilCart || c.viga); if(!pc) return { error:'Escoja el perfil del que se corta la cartela.' }; bfh = pc.bf; tfh = pc.tf; twh = pc.tw; }
  else if(k === 'arm'){ bfh = +c.bph || 0; tfh = +c.tph || 0; twh = +c.tcw || 0; }
  else twh = +c.tcw || 0;
  if(!(twh > 0) || (k !== 'pl' && !(bfh > 0 && tfh > 0))) return { error:'Faltan los espesores de la cartela.' };
  const be = k === 'pl' ? Math.min(12 * twh, hh * cs) : 0;                                 // franja del borde libre (platina sola)
  const Ah = k === 'pl' ? be * twh : bfh * tfh;
  const yH = k === 'pl' ? m.d + hh - be / (2 * cs) : m.d + hh - tfh / (2 * cs), z = yH - m.tf / 2;
  const P = nz(c.P); let V2 = nz(c.Vu), Mf = Math.abs(nz(c.Mu));
  pasos.push(`Cartela ${CART_TIPOS[k]} bajo el ala inferior (${c.aceroCart || c.aceroViga}): Lh = ${Lh} mm, hh = ${hh} mm → θ = atan(hh/Lh) = ${r1(deg)}°, largo del borde inclinado ${r1(Lc)} mm`
    + (k === 'T' ? `; cortada de ${pc.nom} (patín ${bfh} × ${tfh} mm, alma ${twh} mm)` : k === 'arm' ? `; alma ${twh} mm y patín ${bfh} × ${tfh} mm` : `; platina ${twh} mm, franja del borde be = mín(12t; hh·cosθ) = ${r1(be)} mm`));
  // Sismo: no precalificada; la rótula se forma en la punta de la cartela
  const sis = ['DMO', 'DES'].includes(c.sismo) ? c.sismo : '';
  if(sis){
    const Fy = am.Fy, Ry = RY(c.aceroViga), Cpr = Math.min(1.2, (Fy + am.Fu) / (2 * Fy)), Mpr = Cpr * Ry * Fy * m.Zx / 1e6;
    const Lrot = Math.max(100, Math.max(0.1, +c.Lh || 6) * 1000 - 2 * Lh);    // luz entre rótulas (en las puntas de las cartelas; c.Lh = luz libre en m)
    const Vh = 2 * Mpr * 1000 / Lrot + Math.abs(+c.Vg || 0);
    Mf = Math.max(Mf, Mpr + Vh * Lh / 1000); V2 = Math.max(Math.abs(V2), Vh);
    pasos.push(`Sismo ${sis}: la rótula plástica se forma en la punta de la cartela → Mpr = Cpr·Ry·Fy·Zx = ${r2(Mpr)} kN·m, Vu = 2Mpr/L' + Vg = ${r2(Vh)} kN (L' = L − 2Lh = ${r2(Lrot / 1000)} m) → en la cara Mf = Mpr + Vu·Lh = ${r2(Mf)} kN·m`);
    req.push([`Sismo ${sis}: la viga con cartela soldada no es una conexión precalificada (AISC 358 / NSR-10 F.3)`, false, 'necesita ensayos de calificación; use una conexión precalificada (WUF-W o chapa extendida)']);
  }
  const F = Mf * 1000 / z + Math.abs(P) / 2, Fh = F / cs, Fv = F * Math.tan(th);
  pasos.push(`Brazo entre el centroide del ala superior y el del ${k === 'pl' ? 'borde de la platina' : 'patín de la cartela'}: z = ${r1(z)} mm (altura total en la cara d + hh = ${r1(m.d + hh)} mm) → F = M/z + |P|/2 = ${r2(F)} kN; patín: F/cosθ = ${r2(Fh)} kN; componente vertical F·tanθ = ${r2(Fv)} kN`);
  // Unión viga–columna y columna: con la fuerza de ala F (momento equivalente M·(d − tf)/z)
  const Meq = Mf * (m.d - m.tf) / z;
  const base = calcSoldada0({ ...c, cart:'no', Mu:Meq, Vu:V2, sismo:'no' });
  if(base.error) return base;
  pasos.push(...base.pasos.map(t => t.replace(/^Miembro /, 'Unión viga–columna — miembro ')));
  pasos.splice(3, 0, `La unión de la viga a la columna y la columna se revisan con la fuerza de ala F (momento equivalente M·(d − tf)/z = ${r2(Meq)} kN·m); el ala inferior de la viga queda del lado seguro.`);
  // ── Cartela ──
  const lam = k === 'pl' ? null : (bfh / 2) / tfh, lamLim = 0.56 * Math.sqrt(E / ac.Fy);
  add('cartela', k === 'pl' ? 'Borde inclinado de la platina a compresión' : 'Patín de la cartela a compresión', 'F.2.5 (E3) · φ = 0.90 · sin pandeo global (arriostrado por el alma)', Fh, 0.9 * ac.Fy * Ah / 1000, 'kN', k === 'pl' ? `franja be × t = ${r1(be)} × ${twh} mm` : `${bfh} × ${tfh} mm`);
  if(k === 'pl'){ const lim = 0.75 * Math.sqrt(E / ac.Fy), okB = Lc / twh <= lim + 1e-6;
    req.push(['Platina sola: borde libre L/t ≤ 0.75√(E/Fy) (Manual AISC, cartelas)', okB, `${r1(Lc / twh)} ≤ ${r1(lim)}`]);
    if(!okB){ const tq = ESP_PL.find(t => Lc / t <= lim + 1e-6); av.push(`💡 El borde libre es muy largo para la platina: ${tq ? `use platina de ${tq} mm, ` : ''}acorte la cartela o agréguele un patín (opción B, cartela de platinas).`); } }
  else req.push(['Patín de la cartela: b/2t ≤ 0.56√(E/Fy) (pandeo local, Tabla B4.1a)', lam <= lamLim + 1e-6, `${r1(lam)} ≤ ${r1(lamLim)}`]);
  add('cartela', 'Alma de la cartela a cortante en la cara (componente vertical)', 'F.2.7 (G2-1), φ = 0.90', Fv, 0.9 * 0.6 * ac.Fy * hh * twh / 1000, 'kN', `0.6·Fy·hh·t, t = ${twh} mm`);
  if(k === 'T') req.push([`La cartela cabe en el perfil del que se corta: hh·cosθ ≤ d − tf de ${pc.nom}`, hh * cs <= pc.d - pc.tf + 1e-6, `${r1(hh * cs)} ≤ ${r1(pc.d - pc.tf)} mm`]);
  if(k === 'T' && (bfh > m.bf + 1e-6)) req.push(['El patín de la cartela no sobresale del ala de la viga', false, `${bfh} > ${m.bf} mm`]);
  if(k === 'arm' && bfh > m.bf + 1e-6) req.push(['El patín de la cartela no sobresale del ala de la viga', false, `${bfh} > ${m.bf} mm`]);
  if(deg < 20 - 1e-6 || deg > 45 + 1e-6) av.push(`El ángulo de la cartela (${r1(deg)}°) está fuera de lo usual (20°–45°; se recomienda unos 30°).`);
  // ── Soldaduras de la cartela ──
  const wMinT = t => t <= 6 ? 3 : t <= 13 ? 5 : t <= 19 ? 6 : 8, wC = +c.wC || 0, wCc = +c.wCc || 0;
  add('soldadura', 'Cartela–ala inferior de la viga: 2 filetes a lo largo de Lh', 'F.2.10.2.4 (J2-4), φ = 0.75', F / (2 * Lh), fw2(FEXX, wC), 'kN/mm', `F/(2·Lh), w = ${wC} mm`);
  add('soldadura', 'Metal base del alma de la cartela junto a esos filetes', 'F.2.10.2.4 · φ = 0.75 · 0.6·Fu·t', F / Lh, 0.45 * ac.Fu * twh / 1000, 'kN/mm', `t = ${twh} mm`);
  req.push(['Filete cartela–viga ≥ mínimo Tabla J2.4', wC >= wMinT(Math.min(twh, m.tf)), `${wC} ≥ ${wMinT(Math.min(twh, m.tf))} mm`]);
  const tSop = c.soporte === 'placa' ? +c.tSop : (perfil(c.columna)?.tf || 0), acS = c.soporte === 'placa' ? ACEROS[c.aceroSop] : ACEROS[c.aceroCol];
  if(c.union === 'cjp'){
    pasos.push('Cartela a la columna con penetración completa (patín y alma): resistencia del metal base de la cartela, ya revisada.');
    req.push(['Cartela a la columna: penetración completa en el patín y el alma (bisel y respaldo)', true, 'indicar en planos']);
  } else {
    let qMax;
    if(k === 'pl'){ qMax = Math.hypot(F, Fv) / (2 * hh);
      add('soldadura', 'Platina a la columna: 2 filetes de alto hh (F y F·tanθ)', 'F.2.10.2.4 (J2-4), φ = 0.75', qMax, fw2(FEXX, wCc), 'kN/mm', `√(F² + (F·tanθ)²)/(2·hh), w = ${wCc} mm`); }
    else { const Lpat = 2 * bfh - twh, qF = Fh * cs / Lpat, qW = Fv / (2 * hh); qMax = Math.max(qF, qW);
      add('soldadura', 'Patín de la cartela a la columna: filetes por las dos caras (F)', 'F.2.10.2.4 (J2-4), φ = 0.75', qF, fw2(FEXX, wCc), 'kN/mm', `F/(2bf − tw), largo ${r1(Lpat)} mm, w = ${wCc} mm`);
      add('soldadura', 'Alma de la cartela a la columna: 2 filetes de alto hh (F·tanθ)', 'F.2.10.2.4 (J2-4), φ = 0.75', qW, fw2(FEXX, wCc), 'kN/mm', `F·tanθ/(2·hh), w = ${wCc} mm`); }
    if(acS && tSop) add(c.soporte === 'placa' ? 'soporte' : 'columna', `Metal base del ${c.soporte === 'placa' ? 'soporte' : 'ala de la columna'} junto a los filetes de la cartela`, 'F.2.10.2.4 · φ = 0.75 · 0.6·Fu·t', qMax, 0.45 * acS.Fu * tSop / 1000, 'kN/mm', `t = ${tSop} mm`);
    const tm = Math.min(k === 'pl' ? twh : Math.min(tfh, twh), tSop || 99);
    req.push(['Filete cartela–columna ≥ mínimo Tabla J2.4', wCc >= wMinT(tm), `${wCc} ≥ ${wMinT(tm)} mm`]);
  }
  if(k === 'arm'){ const wPA = +c.wPA || 0; req.push(['Patín–alma de la cartela: filetes por las dos caras ≥ mínimo Tabla J2.4', wPA >= wMinT(Math.min(tfh, twh)), `${wPA} ≥ ${wMinT(Math.min(tfh, twh))} mm`]); }
  // ── Viga en la punta de la cartela ──
  const Mtip = Math.max(0, Mf - Math.abs(V2) * Lh / 1000), phiMp = 0.9 * am.Fy * m.Zx / 1e6;
  if(!sis) add('viga', 'Viga sola en la punta de la cartela (flexión)', 'F.2.6 (F2-1), φ = 0.90', Mtip, phiMp, 'kN·m', `M − V2·Lh = ${r2(Mtip)} kN·m (sin pandeo lateral: viga arriostrada)`);
  else pasos.push(`Con sismo la rótula plástica de la viga queda en la punta de la cartela (diseño por capacidad); allí no se revisa la flexión.`);
  if(!sis) av.push('La flexión en la punta de la cartela se estima con M − V2·Lh (momento que baja con el cortante); revísela con el diagrama de momentos del modelo si la carga es distinta.');
  const kb = m.tf + (m.r || 0), N = Math.max(tfh / Math.max(sn, 0.2), 2 * kb);
  if(c.rigPunta){ const tsP = Math.max(tfh || twh, 6.4), Ast = (m.bf - m.tw) * tsP;
    add('viga', 'Rigidizadores de la viga en la punta de la cartela', 'F.2.10.10.8 (J10.8), φ = 0.90', Fv, 0.9 * am.Fy * Ast / 1000, 'kN', `par de placas ${r1((m.bf - m.tw) / 2)} × ${tsP} mm`);
    req.push(['Rigidizadores en la punta: soldados al alma y a las dos alas de la viga', true, 'indicar en planos']); }
  else {
    add('viga', 'Alma de la viga en la punta: fluencia local', 'F.2.10.10.2 (J10-2), φ = 1.00', Fv, am.Fy * m.tw * (5 * kb + N) / 1000, 'kN', `F·tanθ con N = ${r1(N)} mm`);
    const crip = 0.75 * 0.8 * m.tw ** 2 * (1 + 3 * (N / m.d) * (m.tw / m.tf) ** 1.5) * Math.sqrt(E * am.Fy * m.tf / m.tw) / 1000;
    add('viga', 'Alma de la viga en la punta: aplastamiento', 'F.2.10.10.3 (J10-4), φ = 0.75', Fv, crip, 'kN', 'carga concentrada del patín de la cartela');
    if(Fv > Math.min(am.Fy * m.tw * (5 * kb + N) / 1000, crip)) av.push('El alma de la viga no aguanta la fuerza del patín en la punta: marque «Rigidizadores en la punta de la cartela».'); }
  if(c.soporte !== 'placa' && c.columna) av.push('Placas de continuidad de la columna: a la altura del ala superior de la viga y del patín de la cartela (recomendable también al nivel del ala inferior de la viga).');
  // ── Unir ──
  const failed = req.filter(r => !r[1]).map(r => `${r[0]}: ${r[2]}`);
  const allCh = [...ch, ...base.ch], allReq = [...base.req, ...req], max = allCh.reduce((a, x) => Math.max(a, x.ratio), 0);
  const r = { ok:max <= 1 && !allReq.some(x => !x[1]), max, ch:allCh, req:allReq, av:[...base.av, ...av, ...failed], pasos,
    geo:{ ...base.geo, cart:{ k, Lh, hh, th:deg, bfh, tfh, twh, be, z, F, Fh, Fv, rigPunta:!!c.rigPunta } } };
  if(base.sug) r.sug = base.sug;
  return r;
}

// ── Empalme de viga en Z soldado (pedido de Amo 12-nov) ─────────────
// Corte en Z: la mitad superior (ala + medio alma) se corta en x1, el alma se corta a lo largo de su eje entre x1 y x2 (desfase a)
// y la mitad inferior se corta en x2; así las soldaduras de las alas no quedan en la misma sección.
// Cada corte vertical lleva solo medio alma → el cortante V2 pasa por media alma; la soldadura longitudinal del alma toma el flujo V2·Q/I en la longitud a.
function defaultsEmpZ(){
  return { tipo:'empZ', nom:'', desc:'', P:0, Vu:60, V3:0, T:0, M2:0, Mu:40, viga:'IPE 300', aceroViga:'A572 Gr 50', a:150,
    union:'cjp', Ef:'', Ew:'', electrodo:'E70XX',
    // Revisión con Amo (20-nov): ratonera en el cálculo, reparto del cortante en la media alma, sismo
    hRat:'', Lrat:'', vMedia:'todo', sismo:'no', xEmp:'' };
}
function calcEmpZ(c){
  const ch = [], av = [], pasos = [], req = [], add = addF(ch);
  const P = nz(c.P), V2 = nz(c.Vu), V3 = nz(c.V3), T = nz(c.T), M2 = nz(c.M2), M3 = nz(c.Mu), a = +c.a || 0;
  const pf = (G.PERFILES_LAM || []).find(x => x[0] === c.viga); if(!pf) return { error:'Escoja el perfil de la viga.' };
  const [nom, , d, bf, tw, tf, r, A, Ix, Sx, Zx, Iy, Sy, Zy] = pf, ac = ACEROS[c.aceroViga], FEXX = ELECTRODOS[c.electrodo];
  const cjp = c.union !== 'pjp', Ef = cjp ? tf : Math.min(nz(c.Ef) || tf / 2, tf), Ew = cjp ? tw : Math.min(nz(c.Ew) || tw / 2, tw);
  const hw2 = d / 2 - tf, Af = bf * tf;
  // Ratonera (agujero de acceso F.2.10.1.6 / J1.6): largo ≥ máx(1.5tw; 38) mm, alto ≥ máx(tw; 19) mm; vacío = mínimos
  const hRm = Math.max(tw, 19), LRm = Math.max(1.5 * tw, 38), hRat = nz(c.hRat) > 0 ? +c.hRat : Math.ceil(hRm), Lrat = nz(c.Lrat) > 0 ? +c.Lrat : Math.ceil(LRm);
  const hwN = Math.max(hw2 - hRat, 1);                               // media alma que queda en el corte vertical
  const sis = ['DMO', 'DES'].includes(c.sismo) ? c.sismo : '', mitad = c.vMedia === 'mitad';
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
  // 2. Media alma en el corte vertical: V2 (sin la altura de la ratonera)
  const Vw = mitad ? Math.abs(V2) / 2 : Math.abs(V2);
  pasos.push(`Ratonera junto al ala en cada corte: alto ${hRat} mm × largo ${Lrat} mm (mínimos J1.6: ${r1(hRm)} × ${r1(LRm)} mm) → media alma que queda en el corte = d/2 − tf − alto = ${r1(hwN)} mm`);
  pasos.push(mitad ? `Cortante en la media alma cortada = V2/2 = ${r2(Vw)} kN (la otra mitad del alma sigue entera y toma la otra parte)` : `Cortante en la media alma cortada = V2 completo = ${r2(Vw)} kN (conservador)`);
  const vWeb = Vw * 1000 / (Ew * hwN);
  add('alma', `Cortante ${mitad ? 'V2/2' : 'V2'} por la media alma del corte (sin la ratonera)`, cjp ? 'F.2.7.2 / J4-3 sobre d/2 − tf − ratonera, φ 1.0' : 'Tabla J2.5 (PJP corte, φ 0.75)', vWeb, cjp ? 0.6 * ac.Fy : 0.75 * 0.6 * FEXX, 'MPa', `área = ${r1(Ew)} × ${r1(hwN)} mm`);
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
  const aMin = Math.max(d / 2, 100);
  req.push(['Desfase a ≥ máx(d/2; 100 mm) (recomendado)', a >= aMin - 1e-6, `${a} ≥ ${aMin} mm`]);
  req.push(['Ratonera: alto ≥ máx(tw; 19 mm) y largo ≥ máx(1.5tw; 38 mm), bordes redondeados (F.2.10.1.6 / J1.6)', hRat >= hRm - 1e-6 && Lrat >= LRm - 1e-6, `${hRat} × ${Lrat} ≥ ${r1(hRm)} × ${r1(LRm)} mm`]);
  if(sis){
    pasos.push(`Sismo ${sis}: el empalme debe quedar fuera de la zona protegida de la viga (rótula plástica) y sus soldaduras de las alas son de demanda crítica (AISC 341 A3.4b, NSR-10 F.3).`);
    req.push([`Sismo ${sis}: soldadura de penetración completa en alas y alma`, cjp, cjp ? 'CJP' : 'con penetración parcial no se permite']);
    const xE = nz(c.xEmp);
    req.push([`Sismo ${sis}: empalme fuera de la zona protegida (a más de d de la cara de la columna, o más allá de Sh + d/2 de la conexión)`, xE > 0 ? xE >= d - 1e-6 : true, xE > 0 ? `${xE} ≥ ${d} mm` : 'escriba la distancia a la cara de la columna; si no, indicar en planos']);
    req.push(['Sismo: soldaduras de demanda crítica — ultrasonido 100 %, respaldo retirado y filete de refuerzo en la raíz (AWS D1.8)', true, 'indicar en planos']);
    av.push('Sismo: si el empalme queda cerca de la rótula, revíselo con las fuerzas que llegan cuando la viga plastifica (Mpr), no solo con las del modelo.');
  }
  const mE = t => t <= 6 ? 3 : t <= 13 ? 5 : t <= 19 ? 6 : t <= 38 ? 8 : 10;
  if(!cjp) {
    req.push(['Garganta efectiva mínima de penetración parcial (Tabla F.2.10.2-3)', Ef >= mE(tf) && Ew >= mE(tw), `alas ${r1(Ef)} ≥ ${mE(tf)}, alma ${r1(Ew)} ≥ ${mE(tw)} mm`]); }
  req.push(['Soldadura precalificada con bisel y respaldo, inspección por ultrasonido de las alas', true, 'indicar en planos']);
  req.push(['Agujero de acceso (ratonera) en el alma junto a las alas', true, 'AWS D1.1 / F.2.10.1.6']);
  if(Math.abs(T) > 0) av.push('La torsión se reparte como cortante lateral en las alas; el alabeo no se revisa.');
  if(!cjp && !sis) av.push('Penetración parcial: no se recomienda en empalmes de vigas sometidas a fatiga o a sismo con disipación (DES/DMO).');
  const R = fin(ch, req, av, pasos, { pf:{ nom, d, bf, tw, tf }, a, Q, hRat, Lrat, cjp });
  // 💡 gargantas mínimas (PJP) que cumplen, o pasar a CJP; desfase mínimo recomendado
  if(!c._sinSug && (!R.ok || a < aMin)){
    const dif = {}, txts = [], gMal = !cjp && (Ef < mE(tf) || Ew < mE(tw));
    if(!cjp && (R.max > 1 || gMal)){
      if(sis){ dif.union = 'cjp'; txts.push('penetración completa (sismo)'); }
      else { let best = null;
        for(let ef = mE(tf); ef <= tf + 1e-6 && !best; ef += 1) for(let ew = mE(tw); ew <= tw + 1e-6; ew += 1){
          const t = calcEmpZ({ ...c, Ef:ef, Ew:ew, a:Math.max(a, aMin), _sinSug:true }); if(!t.error && t.max <= 1){ best = { ef, ew }; break; } }
        if(best){ dif.Ef = best.ef; dif.Ew = best.ew; txts.push(`garganta ${best.ef} mm en las alas y ${best.ew} mm en el alma`); }
        else { const t = calcEmpZ({ ...c, union:'cjp', a:Math.max(a, aMin), _sinSug:true }); if(t.max <= 1){ dif.union = 'cjp'; txts.push('penetración completa'); } } } }
    else if(sis && !cjp){ dif.union = 'cjp'; txts.push('penetración completa (sismo)'); }
    if(a < aMin){ dif.a = aMin; txts.push(`desfase a = ${aMin} mm`); }
    if(txts.length){ const t = calcEmpZ({ ...c, ...dif, _sinSug:true });
      R.sug = { tipo:'sold', ok:true, ...dif, txt:`💡 Usar ${txts.join(' y ')}${t.max > 1 ? ' (aún falta: la viga o el cortante no alcanzan)' : ''}` }; }
    if(!mitad && vWeb > (cjp ? 0.6 * ac.Fy : 0.75 * 0.6 * FEXX) && vWeb / 2 <= (cjp ? 0.6 * ac.Fy : 0.75 * 0.6 * FEXX))
      R.av.push('El cortante V2 completo no pasa por la media alma cortada, pero la mitad sí: si acepta que la otra mitad del alma (entera) toma su parte, escoja «V2/2» en el reparto del cortante.');
    else if(!txts.length && R.max > 1) R.av.push('Con penetración completa tampoco alcanza: la sección de la viga no resiste estas fuerzas en el empalme (cambie el perfil o mueva el empalme a una zona con menos momento).');
  }
  return R;
}

function defaultsRas(){ return { ...defaultsTesta(), tipo:'ras', Mu:40, filas:2, pb:75, pfi:45, tp:22.2, bp:170, placaTipo:'gruesa', cortTodos:false }; }

// ── Nudo: varias vigas que llegan a la misma columna (opción C de Amo, 19-nov) ─────────────
// Cada conexión se diseña sola; el nudo revisa lo que comparten: zona de panel con las dos vigas del eje fuerte,
// pandeo del alma por las dos alas (J10-8), cargas concentradas de cada viga en la columna, placas de continuidad
// (también las que reciben las vigas a momento del eje débil), cortante de las alas por el eje débil y la coherencia
// de los datos de cada conexión con la columna del nudo.
const CARAS = { ala1:'Ala 1', ala2:'Ala 2 (opuesta)', alma1:'Alma, lado 1', alma2:'Alma, lado 2' };
const MOMENTO = ['testa', 'ras', 'soldada'], CORTANTE = ['aleta', 'angular', 'testaV', 'asiento'];
function defaultsNudo(){
  return { nom:'', desc:'', columna:'HEB 300', aceroCol:'A572 Gr 50', colTope:false, Pc:0, Vc:0,
    sentido:'opuesto', sentidoW:'opuesto', rigCol:'auto', tsC:'', wsC:'', aceroRigC:'A36', electrodo:'E70XX', cons:[], colArriba:'', PcA:'' };
}
// Viga que llega con cada conexión: perfil, momento, cortante y axial
function vigaDe(c){
  let vg = null;
  if(c.tipo === 'soldada' && c.miembro === 'tubo') vg = { nom:`Tubo ${c.H}×${c.B}×${c.tt}`, d:+c.H, bf:+c.B, tw:+c.tt, tf:+c.tt, r:0 };
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
      if(c.tipo === 'soldada') req.push([`${c.nom}: soporte = alma de la columna (${n.columna})`, (c.soporte === 'alma' && c.columna === n.columna) || c.soporte === 'placa', c.soporte === 'alma' ? `alma de ${c.columna}` : c.soporte === 'placa' ? `placa t ${c.tSop} mm` : 'en la conexión está «al ala de una columna»']);
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
  const KC = corteEsq(cl, false), clip = KC.ala, bs = (cl.bf - cl.tw) / 2, Lf = bs - clip, Lw = cl.d - 2 * cl.tf - 2 * KC.alma;
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
    pasos.push(`Placas de continuidad (un par a la altura de cada ala de las vigas): ancho por lado bs = (bf − tw)/2 = ${r1(bs)} mm, corte de esquinas a 45° de ${r1(clip)} mm, largo junto al ala Lf = ${r1(Lf)} mm, junto al alma ${r1(Lw)} mm; ts = ${ts} mm (${n.aceroRigC}${+n.tsC > 0 ? ', escrito' : ', automático'}), filetes ${ws} mm ${n.electrodo}${+n.wsC > 0 ? '' : ' (automático)'}.`);
    req.push(['Placas: ts ≥ tf de las vigas a momento', ts >= tfV / (hayDebil ? 1 : 2) - 1e-6, `${ts} ≥ ${r1(tfV / (hayDebil ? 1 : 2))} mm${hayDebil ? '' : ' (tf/2, J10.8)'}`]);
    req.push(['Placas: bs/ts ≤ 0.56√(E/Fy) (J10.8)', bs / ts <= 0.56 * Math.sqrt(E / ar.Fy), `${r1(bs / ts)} ≤ ${r1(0.56 * Math.sqrt(E / ar.Fy))}`]);
    req.push(['Placas: filete ≥ mínimo Tabla J2.4', ws >= wMin(Math.min(ts, cl.tf)), `${ws} ≥ ${wMin(Math.min(ts, cl.tf))} mm`]);
    req.push(reqCorte(KC));
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
    const vgs = [...momF('ala1'), ...momF('ala2')].map(v => v.vg), dzN = vgs.length ? Math.max(...vgs.map(v => v.d - 2 * v.tf)) : cl.d;
    panelConDoubler({ c:n, cl, ac, Vp, Rv0:Rv, dz:dzN, sis:['DMO', 'DES'].includes(n.sismo), add, req, av, pasos, grupo:'panel', nomCh:'Zona de panel del eje fuerte (cortante del alma)', ref:`F.2.10.10.6 (${Pr <= 0.4 * Py ? 'J10-11' : 'J10-12'}), φ = 0.90`, txt:!dosF ? 'F de la viga' : opuesto ? '|F₁ − F₂|' : 'F₁ + F₂', FEXX:ELECTRODOS[n.electrodo] || 483, cont:usar });
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
  // Columna fuerte – viga débil (pedido de Amo 21-nov; proyecto DES, NSR-10 F.3 = AISC 341-10 E3.4a): ΣM*pc / ΣM*pb > 1 en cada sentido
  if(n.sismo === 'DES'){
    const PL = G.PERFILES_LAM || [], pC = PL.find(x => x[0] === n.columna), arribaNo = n.colArriba === 'ninguna' || tope;
    const pA = arribaNo ? null : n.colArriba ? PL.find(x => x[0] === n.colArriba) : pC;
    const Pu = Math.abs(nz(n.Pc)), PuA = String(n.PcA ?? '').trim() === '' ? Pu : Math.abs(nz(n.PcA));
    const mpc = (pp, P, eje) => pp ? Math.max(0, (eje === 'x' ? pp[10] : pp[13]) * (ac.Fy - P * 1000 / pp[7]) / 1e6) : 0;
    for(const [ini, nomS, eje] of [['ala', 'de las alas (eje fuerte de la columna)', 'x'], ['alma', 'del alma (eje débil de la columna)', 'y']]){
      const vs = V.filter(v => v.mom && v.vg && v.cara.startsWith(ini)); if(!vs.length) continue;
      const Mpc = mpc(pC, Pu, eje) + mpc(pA, PuA, eje); let Mpb = 0; const tB = [];
      for(const v of vs){ const pv = PL.find(x => x[0] === v.vg.nom), Zb = pv ? pv[10] : 0, acv = ACEROS[v.c.aceroViga] || ACEROS['A572 Gr 50'], Ryb = /A36/.test(v.c.aceroViga || '') ? 1.5 : 1.1;
        const Mpr = 1.1 * Ryb * acv.Fy * Zb / 1e6, Lp = nz(v.c.Lh) || nz(v.c.Lviga), sh = v.vg.d / 2000, Muv = Lp > 0 ? 2 * Mpr / Lp * (sh + cl.d / 2000) : 0;
        if(!(Lp > 0)) av.push(`${v.c.nom}: escriba la luz de la viga (sección Sismo o Rigidez) para sumar el momento por cortante en la rótula; sin ella se toma solo 1.1·Ry·Fy·Zb.`);
        Mpb += Mpr + Muv; tB.push(`${v.c.nom} ${v.vg.nom}: 1.1·${Ryb}·${acv.Fy}·Zb = ${r2(Mpr)}${Muv ? ` + Vpr·(sh + dc/2) = ${r2(Muv)}` : ''} kN·m`); }
      const exc = arribaNo && Pu < 0.3 * ac.Fy * Acol / 1000;
      pasos.push(`Columna fuerte – viga débil, sentido ${nomS}: ΣM*pc = Zc·(Fy − Puc/Ag) = ${r2(mpc(pC, Pu, eje))} (abajo, Puc ${r1(Pu)} kN)${pA ? ` + ${r2(mpc(pA, PuA, eje))} (arriba ${pA[0]}, Puc ${r1(PuA)} kN)` : ' (sin columna arriba)'} = ${r2(Mpc)} kN·m; ΣM*pb: ${tB.join('; ')} = ${r2(Mpb)} kN·m → ΣM*pc/ΣM*pb = ${Mpb > 0 ? r2(Mpc / Mpb) : '—'}`);
      if(exc && Mpc <= Mpb) av.push(`Columna fuerte – viga débil (sentido ${nomS}): no cumple (${r2(Mpc / Mpb)}), pero está exceptuada: último piso con Puc < 0.3·Fy·Ag (AISC 341 E3.4a, excepción (a)).`);
      else add('scwb', `Columna fuerte – viga débil: sentido ${nomS}`, 'NSR-10 F.3 · AISC 341-10 E3.4a (ΣM*pc/ΣM*pb > 1)', Mpb, Mpc, 'kN·m', 'demanda = ΣM*pb de las vigas, capacidad = ΣM*pc de las columnas');
    }
    av.push('Columna fuerte – viga débil: no incluye el cortante de gravedad de las vigas; Puc debe venir de las combinaciones con sobrerresistencia Ω0.');
  }

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
    if(c.tipo === 'soldada' && !ala){ set('soporte', 'alma'); set('columna', n.columna); set('aceroCol', n.aceroCol); if(ts) set('tsC', ts); set('aceroRigC', n.aceroRigC);
      const otro = lista.find(o => o.cara === (cara === 'alma1' ? 'alma2' : 'alma1') && MOMENTO.includes(o.c.tipo));
      if(otro){ set('dosLados', true); set('Mu2', Math.abs(+otro.c.Mu || 0)); set('sentido2', n.sentidoW); } else set('dosLados', false); }
    if(CORTANTE.includes(c.tipo)){
      if('soporte' in c || c.tipo === 'angular' || c.tipo === 'aleta') set('soporte', ala ? 'ala' : 'alma');
      set('tSop', ala ? cl.tf : cl.tw); set('aceroSop', n.aceroCol);
      if(c.tipo !== 'asiento'){ const opu = !ala && lista.some(o => o.cara === (cara === 'alma1' ? 'alma2' : 'alma1') && CORTANTE.includes(o.c.tipo)); set('dosLados', opu); }
    }
  });
  return k;
}

// ── Rigidez a rotación y clasificación (pedido de Amo 20-nov) ─────────────
// La NSR-10 F.2 (AISC 360-10 B3.6) pide clasificar las conexiones por su rigidez pero no da fórmulas para calcularla:
// se usa el método de los componentes de EN 1993-1-8 §6.3 (Sj,ini = E·z²/Σ(1/ki)) y la clasificación del AISC 360-10
// (comentario B3.6): K = Ks·L/(E·I) ≥ 20 rígida (FR), ≤ 2 articulada (simple), en medio semirrígida (PR).
// Resorte para el modelo: Sj = Sj,ini/η (EN 1993-1-8 §5.1.2, Tabla 5.2: η = 2 viga–columna, 3 placa base).
const REF_RIG = 'EN 1993-1-8 §6.3 (método de los componentes) · clasificación AISC 360-10 B3.6';
function inerciaPerfil(nom){ const P = (G.PERFILES_LAM || []).find(x => x[0] === nom); return P ? P[8] : null; }
const inerciaTubo = (H, B, t) => (B * H ** 3 - (B - 2 * t) * (H - 2 * t) ** 3) / 12;
function clasificaRig(Sj, L, I, E){   // Sj [N·mm/rad], L [mm], I [mm⁴]
  if(!(L > 0) || !(I > 0)) return { K:null, clase:null };
  if(!isFinite(Sj)) return { K:Infinity, clase:'rigida' };
  const K = Sj * L / (E * I); return { K, clase:K >= 20 ? 'rigida' : K <= 2 ? 'art' : 'semi' };
}
const inv = k => !isFinite(k) || k <= 0 ? (k <= 0 ? Infinity : 0) : 1 / k;
// EN 1993-1-8 Tabla 6.12 (placa base): P > 0 = compresión, M ≥ 0. Devuelve Sj [N·mm/rad] y el texto del caso.
// Corrección 20-nov: con compresión e = M/N es negativa en la norma → factor |e|/(|e| − ek) (la compresión rigidiza); si |e| < zc no hay pernos en tensión
// (caso compresión–compresión: z = 2zc, concreto de los dos lados).
function sjBase(E, P, M, zc, zt, kc, kt){
  const z1 = zt + zc, S1 = E * z1 * z1 / (inv(kc) + inv(kt)), ek = (zc * kc - zt * kt) / (kc + kt);
  if(!(M > 0)){ if(P > 0){ const z = 2 * zc; return { Sj:E * z * z / (2 * inv(kc)), z, txt:`sin momento y con compresión: los dos lados en compresión, z = 2·zc = ${r1(z)} mm, Sj = E·z²/(2/kc) (Tabla 6.12)` }; }
    return { Sj:S1, z:z1, txt:'' }; }
  if(!P) return { Sj:S1, z:z1, txt:'' };
  const e = M * 1e6 / (Math.abs(P) * 1e3);
  if(P > 0 && e < zc){ const z = 2 * zc; return { Sj:E * z * z / (2 * inv(kc)), z, txt:`compresión con e = M/N = ${r1(e)} mm < zc = ${r1(zc)} mm: los pernos no trabajan a tensión, los dos lados en compresión → z = 2·zc = ${r1(z)} mm, Sj = E·z²/(2/kc) (Tabla 6.12)` }; }
  const f = P > 0 ? (e - ek > 0 ? e / (e - ek) : 1) : (e + ek > 0 ? e / (e + ek) : 1);
  return { Sj:S1 * f, z:z1, txt:`${P > 0 ? 'compresión' : 'tensión'} con e = |M/N| = ${r1(e)} mm, ek = (zc·kc − zt·kt)/(kc + kt) = ${r1(ek)} mm → factor ${P > 0 ? '|e|/(|e| − ek)' : 'e/(e + ek)'} = ${r3(f)} (Tabla 6.12)` };
}
function rigidez(c, R){
  const E = 200000, pasos = [], notas = [], comps = [];
  const kc = (n, k, f) => { comps.push({ n, k, f }); return k; };
  const out = (o) => ({ ref:REF_RIG, pasos, notas, comps, ...o });
  // Conexiones a cortante: articuladas por detallado (no hay fórmula de rigidez en EN 1993-1-8 ni en el AISC)
  if(['aleta', 'angular', 'testaV', 'asiento'].includes(c.tipo)){
    const okDet = !(R.req || []).some(q => !q[1]);
    return out({ tipo:'cortante', clase:okDet ? 'art' : null, Sj:0,
      notas:[okDet ? 'Conexión simple (AISC 360-10 B3.6a; Manual AISC parte 10): su capacidad de rotación la dan los requisitos de detallado, que se cumplen. Se modela articulada (M3 liberado).'
        : 'Conexión simple: no cumple todos los requisitos de detallado, así que no se garantiza que gire como articulada. Revise los requisitos.'] });
  }
  const Lm = +c.Lviga > 0 ? +c.Lviga * 1000 : null;
  if(c.tipo === 'testa' || c.tipo === 'ras'){
    const g = R.geo || {}, vg = g.vg, cl = g.cl, H = g.H || {}; if(!vg) return null;
    const d = +c.d, tp = +c.tp, bp = +c.bp, gg = +c.g, pfo = +c.pfo, de = +c.de, wA = +c.wAlma || 0, wF = c.soldAla === 'cjp' ? 0 : (+c.wAla || 0);
    const As = 0.76 * Math.PI * d * d / 4, tfc = cl ? cl.tf : 0;
    const Lb = tp + (cl ? tfc : tp) + 8 + 0.8 * d, k10 = 1.6 * As / Lb;
    const m = Math.max(gg / 2 - vg.tw / 2 - 0.8 * wA, 0.5 * d), ep = (bp - gg) / 2, mx = Math.max(pfo - 0.8 * wF, 0.5 * d), ex = de;
    const mc = cl ? Math.max(gg / 2 - cl.tw / 2 - 0.8 * (cl.r || 0), 0.5 * d) : 0, ec = cl ? (cl.bf - gg) / 2 : 0, dc = cl ? cl.d - 2 * (cl.tf + (cl.r || 0)) : 0;
    const rigC = !!g.rig;   // placas de continuidad en la columna
    const filas = Object.entries(H).filter(([, h]) => h > 0).map(([k, h]) => ({ k, h }));
    const ext = k => !c.tipo.startsWith('ras') && (k === 'h0' || (g.e8 && (k === 'h1' || k === 'h2')));
    pasos.push(`Pernos: As ≈ 0.76·π·d²/4 = ${r1(As)} mm²; Lb = tp + tfc + arandelas + ½(cabeza + tuerca) ≈ ${r1(Lb)} mm → k10 = 1.6·As/Lb = ${r2(k10)} mm (por fila de 2 pernos)`);
    pasos.push(`Placa: m = g/2 − tw/2 − 0.8·w = ${r1(m)} mm, e = ${r1(ep)} mm${filas.some(f => ext(f.k)) ? `; extensión mx = pfo − 0.8·w = ${r1(mx)} mm, ex = ${r1(ex)} mm` : ''}. α de la Figura 6.11 tomado como 2π (fila junto al ala).`);
    if(cl) pasos.push(`Columna ${cl.nom}: m = g/2 − tw/2 − 0.8·r = ${r1(mc)} mm, e = ${r1(ec)} mm, dc = ${r1(dc)} mm${rigC ? ' · con placas de continuidad: alma en tensión y compresión rígidas (k3 = k2 = ∞)' : ''}`);
    else notas.push('No se escogió la columna: no se incluyen su ala, su alma ni su zona de panel (la rigidez real es menor).');
    let sumKh = 0, sumKh2 = 0;
    filas.forEach(({ k, h }, i) => {
      const lp = ext(k) ? Math.min(2 * Math.PI * mx, Math.PI * mx + gg, Math.PI * mx + 2 * ep, 4 * mx + 1.25 * ex, ep + 2 * mx + 0.625 * ex, 0.5 * bp, 0.5 * gg + 2 * mx + 0.625 * ex)
        : (i === filas.findIndex(f => !ext(f.k)) ? 2 * Math.PI * m : Math.min(2 * Math.PI * m, 4 * m + 1.25 * ep));
      const mm = ext(k) ? mx : m, k5 = 0.9 * lp * tp ** 3 / mm ** 3;
      let k3 = Infinity, k4 = Infinity, lc = 0;
      if(cl){ lc = Math.min(2 * Math.PI * mc, 4 * mc + 1.25 * ec); k4 = 0.9 * lc * tfc ** 3 / mc ** 3; k3 = rigC ? Infinity : 0.7 * lc * cl.tw / dc; }
      const keff = 1 / (inv(k3) + inv(k4) + inv(k5) + inv(k10));
      pasos.push(`Fila a h = ${r1(h)} mm: leff placa ${r1(lp)} → k5 = 0.9·leff·tp³/m³ = ${r2(k5)}${cl ? `; leff ala col. ${r1(lc)} → k4 = ${r2(k4)}; k3 = ${isFinite(k3) ? r2(k3) : '∞'}` : ''}; k10 = ${r2(k10)} → keff = ${r2(keff)} mm`);
      sumKh += keff * h; sumKh2 += keff * h * h;
    });
    const zeq = sumKh2 / sumKh, keq = sumKh / zeq;
    kc('Filas de pernos en tensión (keq: pernos, placa, ala y alma de la columna)', keq, 'keq = Σ keff·h / zeq');
    let k1 = Infinity, k2 = Infinity;
    if(cl){
      const pX = (G.PERFILES_LAM || []).find(x => x[0] === cl.nom), A = pX ? pX[7] : 0, Avc = Math.max(A - 2 * cl.bf * cl.tf + (cl.tw + 2 * (cl.r || 0)) * cl.tf, cl.d * cl.tw);
      const beta = !c.dosLados ? 1 : c.sentido2 === 'mismo' ? 2 : 0;
      k1 = beta === 0 ? Infinity : 0.38 * Avc / (beta * zeq);
      const sp = 2 * tp, beffc = vg.tf + 2 * Math.SQRT2 * 0.707 * wF + 5 * (tfc + (cl.r || 0)) + sp;
      k2 = rigC ? Infinity : 0.7 * beffc * cl.tw / dc;
      pasos.push(`Zona de panel: Avc = ${r1(Avc)} mm², β = ${beta}${beta === 0 ? ' (vigas a los dos lados con momentos opuestos: panel equilibrado)' : ''} → k1 = 0.38·Avc/(β·z) = ${isFinite(k1) ? r2(k1) : '∞'} mm`);
      pasos.push(`Alma en compresión: beff = tfb + 2√2·a + 5(tfc + r) + 2tp = ${r1(beffc)} mm → k2 = 0.7·beff·tw/dc = ${isFinite(k2) ? r2(k2) : '∞'} mm`);
      kc('Zona de panel de la columna (k1)', k1); kc('Alma de la columna en compresión (k2)', k2);
    }
    const Sj = E * zeq * zeq / (inv(k1) + inv(k2) + inv(keq));
    pasos.push(`z = zeq = Σkeff·h²/Σkeff·h = ${r1(zeq)} mm → Sj,ini = E·z²/Σ(1/ki) = 200000·${r1(zeq)}²/(${[k1, k2, keq].map(k => isFinite(k) ? '1/' + r2(k) : '0').join(' + ')}) = ${r2(Sj / 1e6)} kN·m/rad`);
    const I = inerciaPerfil(vg.nom), cls = clasificaRig(Sj, Lm, I, E);
    return out({ tipo:'momento', Sj:Sj / 1e6, z:zeq, I, L:Lm, eta:2, ...cls });
  }
  if(c.tipo === 'soldada'){
    const g = R.geo || {}, mm = g.m; if(!mm) return null;
    const I = mm.tub ? inerciaTubo(mm.d, mm.bf, mm.tf) : inerciaPerfil(mm.nom);
    if(c.soporte !== 'col'){ notas.push(c.soporte === 'alma' ? 'Viga al alma de la columna (eje débil) con placas de continuidad: fuera del alcance de EN 1993-1-8; se considera rígida.' : 'Soldada a una placa: se considera rígida si la placa no se deforma fuera de su plano.');
      return out({ tipo:'momento', Sj:Infinity, I, L:Lm, eta:2, ...clasificaRig(Infinity, Lm, I, E) }); }
    const cl = perfil(c.columna);
    if(!cl){ notas.push('No se escogió la columna: la unión soldada sola se considera rígida.'); return out({ tipo:'momento', Sj:Infinity, I, L:Lm, eta:2, ...clasificaRig(Infinity, Lm, I, E) }); }
    const z = mm.d - mm.tf, rigC = !!g.rig, dc = cl.d - 2 * (cl.tf + (cl.r || 0)), aF = c.union === 'cjp' ? 0 : 0.707 * (+c.w || 0);
    const pX = (G.PERFILES_LAM || []).find(x => x[0] === cl.nom), A = pX ? pX[7] : 0, Avc = Math.max(A - 2 * cl.bf * cl.tf + (cl.tw + 2 * (cl.r || 0)) * cl.tf, cl.d * cl.tw);
    const beta = !c.dosLados ? 1 : c.sentido2 === 'mismo' ? 2 : 0, k1 = beta === 0 ? Infinity : 0.38 * Avc / (beta * z);
    const beff = mm.tf + 2 * Math.SQRT2 * aF + 5 * (cl.tf + (cl.r || 0)), k2 = rigC ? Infinity : 0.7 * beff * cl.tw / dc, k3 = rigC ? Infinity : 0.7 * beff * cl.tw / dc;
    kc('Zona de panel de la columna (k1)', k1); kc('Alma de la columna en compresión (k2)', k2); kc('Alma de la columna en tensión (k3)', k3);
    const Sj = E * z * z / (inv(k1) + inv(k2) + inv(k3));
    pasos.push(`z = d − tf = ${r1(z)} mm; Avc = ${r1(Avc)} mm², β = ${beta} → k1 = ${isFinite(k1) ? r2(k1) : '∞'}; beff = tfb + 2√2·a + 5(tfc + r) = ${r1(beff)} mm → k2 = k3 = ${isFinite(k2) ? r2(k2) : '∞'} mm${rigC ? ' (placas de continuidad)' : ''}`);
    pasos.push(`Sj,ini = E·z²/Σ(1/ki) = ${isFinite(Sj) ? r2(Sj / 1e6) + ' kN·m/rad' : '∞ (rígida)'}`);
    return out({ tipo:'momento', Sj:Sj / 1e6, z, I, L:Lm, eta:2, ...clasificaRig(Sj, Lm, I, E) });
  }
  if(c.tipo === 'base'){
    const AE = G.AnexoE; if(!AE) return null;
    const tubo = c.colTipo === 'tubo', tt = 0.93 * (+c.tt || 0);
    const cl = tubo ? { nom:`Tubo ${c.Ht}×${c.Bt}×${c.tt}`, d:+c.Ht, bf:+c.Bt, tf:tt, tw:tt } : perfil(c.columna); if(!cl) return null;
    const I = tubo ? inerciaTubo(+c.Ht, +c.Bt, tt) : inerciaPerfil(cl.nom);
    const da = (AE.PERNOS[c.perno] || [19.05])[0], N = +c.N, B = +c.B, tp = +c.tp, S1 = +c.S1, nB = Math.max(1, Math.round(+c.nB)), fc = +c.fc, w = +c.w || 0;
    const Fy = (AE.ACEROS?.[c.aceroPlaca]?.[0]) || 250, Ec = 4700 * Math.sqrt(fc);
    const A1 = N * B, A2 = (+c.Lp || N) * (+c.Wp || B), fjd = (2 / 3) * 0.85 * fc * Math.min(Math.sqrt(A2 / A1), 2);
    const cc = tp * Math.sqrt(Fy / (3 * fjd)), beffC = Math.min(cl.tf + 2 * cc, N), leffC = Math.min(cl.bf + 2 * cc, B);
    const k13 = Ec * Math.sqrt(beffC * leffC) / (1.275 * E);
    const m = Math.max((S1 - cl.d) / 2 - 0.8 * w, 0.5 * da), ex = (N - S1) / 2;
    if((S1 - cl.d) / 2 <= 0) notas.push('Los pernos quedan dentro de las alas de la columna: la flexión de la placa se aproxima con m = 0.5·d del perno.');
    const leff = Math.min(B, nB * 2 * Math.PI * m, nB * (4 * m + 1.25 * ex)), k15 = 0.425 * leff * tp ** 3 / m ** 3;
    const As = 0.76 * Math.PI * da * da / 4, Lb = 8 * da + (c.mortero ? (+c.grout || 25) : 0) + tp + 6 + 0.4 * da, k16 = 2.0 * nB * As / Lb;
    const kt = 1 / (inv(k15) + inv(k16)), zt = S1 / 2, zc = cl.d / 2 - cl.tf / 2, z = zt + zc;
    kc('Concreto en compresión bajo el ala (k13)', k13); kc('Placa a flexión del lado en tensión (k15)', k15); kc(`Pernos de anclaje en tensión, ${nB} por fila (k16)`, k16);
    // Opción A de Amo (20-nov): el valor para el modelo se calcula SIN carga axial (solo momento): depende solo de la geometría,
    // así todas las bases con el mismo detalle llevan el mismo resorte y no cambia entre corridas; la carga axial queda de referencia.
    const P = +c.P || 0, Mx = Math.abs(+c.Mx || 0), Sj = sjBase(E, 0, 1, zc, zt, k13, kt).Sj, sb = sjBase(E, P, Mx, zc, zt, k13, kt);
    if(sb.txt) pasos.push(`Referencia con la carga axial de la fila que controla (no se usa para el modelo): ${sb.txt} → Sj = ${r2(sb.Sj / 1e6)} kN·m/rad`);
    pasos.push(`Concreto: Ec = 4700√f'c = ${Math.round(Ec)} MPa, fjd ≈ ⅔·0.85·f'c·√(A2/A1) = ${r2(fjd)} MPa, c = tp·√(Fy/(3·fjd)) = ${r1(cc)} mm → T equivalente ${r1(beffC)} × ${r1(leffC)} mm → k13 = Ec·√(beff·leff)/(1.275·E) = ${r2(k13)} mm`);
    pasos.push(`Placa: m = (S1 − d)/2 − 0.8·w = ${r1(m)} mm, leff = ${r1(leff)} mm → k15 = 0.425·leff·tp³/m³ = ${r2(k15)} mm (sin palanca: anclajes largos)`);
    pasos.push(`Anclajes: As ≈ ${r1(As)} mm², Lb = 8d + mortero + tp + arandela + ½ tuerca = ${r1(Lb)} mm → k16 = 2.0·n·As/Lb = ${r2(k16)} mm`);
    pasos.push(`z = zt + zc = ${r1(zt)} + ${r1(zc)} = ${r1(z)} mm → Sj,ini = ${r2(Sj / 1e6)} kN·m/rad (sentido N, eje fuerte de la columna; solo momento, sin carga axial)`);
    const Lc = +c.Lcol > 0 ? +c.Lcol * 1000 : null;
    // Eje débil (pedido de Amo 20-nov): momento en el sentido B (My). Tensión = los 2 pernos de la columna extrema (uno por fila);
    // compresión bajo las puntas de las 2 alas (perfil I) o bajo la pared lateral (tubo); m = distancia del perno al contorno de la columna.
    const db = (() => {
      const cw = [], pw = [], kw = (n, k) => { cw.push({ n, k }); return k; };
      const S2 = +c.S2, aB = (B - S2) / 2, Iw = tubo ? inerciaTubo(+c.Bt, +c.Ht, tt) : ((G.PERFILES_LAM || []).find(x => x[0] === cl.nom) || [])[11];
      if(!(S2 > 0) || !(Iw > 0)) return null;
      let k13w, zc, txtC;
      if(tubo){ const be = Math.min(cl.tf + 2 * cc, B), le = Math.min(cl.d + 2 * cc, N); k13w = Ec * Math.sqrt(be * le) / (1.275 * E); zc = cl.bf / 2 - cl.tf / 2;
        txtC = `bajo la pared lateral del tubo: T equivalente ${r1(be)} × ${r1(le)} mm`; }
      else { const fuera = Math.max(0, Math.min(cc, (B - cl.bf) / 2)), be = Math.min(cl.tf + 2 * cc, (N - cl.d) / 2 + cl.tf + cc), le = cc + fuera;
        k13w = 2 * Ec * Math.sqrt(be * le) / (1.275 * E); zc = cl.bf / 2 - (cc - fuera) / 2;
        txtC = `bajo las puntas de las 2 alas: 2 T equivalentes de ${r1(be)} × ${r1(le)} mm`; }
      const dN = Math.max(S1 / 2 - cl.d / 2, 0), dB = Math.max(S2 / 2 - cl.bf / 2, 0);
      const mw = Math.max(Math.hypot(dN, dB) - 0.8 * w, 0.5 * da), nT = 2;
      const leffw = Math.min(N, nT * Math.min(2 * Math.PI * mw, 4 * mw + 1.25 * aB)), k15w = 0.425 * leffw * tp ** 3 / mw ** 3, k16w = 2.0 * nT * As / Lb;
      kw('Concreto en compresión (k13)', k13w); kw('Placa a flexión del lado en tensión (k15)', k15w); kw('Pernos de anclaje en tensión, 2 de la columna extrema (k16)', k16w);
      const ktw = 1 / (inv(k15w) + inv(k16w)), zt = S2 / 2, zw = zt + zc, My = Math.abs(+c.My || 0), Sjw = sjBase(E, 0, 1, zc, zt, k13w, ktw).Sj, sw = sjBase(E, P, My, zc, zt, k13w, ktw);
      if(sw.txt) pw.push(`Referencia con la carga axial (no se usa para el modelo): ${sw.txt} → Sj = ${r2(sw.Sj / 1e6)} kN·m/rad`);
      pw.push(`Concreto ${txtC} → k13 = ${r2(k13w)} mm`);
      pw.push(`Placa: m = √(${r1(dN)}² + ${r1(dB)}²) − 0.8·w = ${r1(mw)} mm (perno extremo al contorno de la columna), leff = ${r1(leffw)} mm → k15 = 0.425·leff·tp³/m³ = ${r2(k15w)} mm`);
      pw.push(`Anclajes: 2 pernos en tensión → k16 = 2.0·2·As/Lb = ${r2(k16w)} mm${nB > 2 ? ' (los pernos intermedios de la fila, más cerca del eje, no se cuentan: del lado seguro)' : ''}`);
      pw.push(`z = S2/2 + zc = ${r1(zt)} + ${r1(zc)} = ${r1(zw)} mm → Sj,ini = ${r2(Sjw / 1e6)} kN·m/rad (sentido B, eje débil de la columna); I débil = ${Math.round(Iw).toLocaleString('es-CO')} mm⁴`);
      return { Sj:Sjw / 1e6, z:zw, I:Iw, L:Lc, comps:cw, pasos:pw, ...clasificaRig(Sjw, Lc, Iw, E) };
    })();
    if(db){ pasos.unshift('— Eje fuerte (sentido N) —'); pasos.push('— Eje débil (sentido B) —', ...db.pasos); }
    return out({ tipo:'base', Sj:Sj / 1e6, z, I, L:Lc, eta:3, debil:db, ...clasificaRig(Sj, Lc, I, E) });
  }
  return null;
}
// ── Empalme de columna (pedido de Amo 20-nov): atornillado con cubrejuntas, soldado de penetración completa o con placa de tope ─────────────
// Decisiones de Amo: siempre SIN contacto (los empalmes toman toda la carga, también la compresión); sismo DMO/DES según AISC 341
// (D2.5: ubicación ≥ 1.2 m de las conexiones viga–columna, fuerzas con Ω0; E2.6g/E3.6g: flexión ≥ Ry·Fy·Zx de la columna menor,
// cortante ΣMpc/H y, si es soldado, penetración completa). Ejes del miembro como el Anexo D: P (+ tensión), V2/M3 eje fuerte, V3/M2 eje débil.
function defaultsEmpCol(){
  return { tipo:'empCol', nom:'', desc:'', P:-400, Vu:30, V3:10, T:0, M2:5, Mu:60,
    colI:'HEB 200', colS:'', acero:'A572 Gr 50', union:'pernos', gap:10,
    tpf:12.7, bpf:180, aceroPl:'A36', nf:3, sf:75, gf:100, Lef:40,
    tpw:8, hpw:130, nw:2, sw:60, Lew:35, Lehw:40,
    d:19.1, grado:'A325', rosca:'N', desliz:false, claseSup:'A',
    tpb:25.4, Bpl:'', Npl:'', wS:8, wI:8, electrodo:'E70XX',
    sismo:'no', hEmp:'', Hcol:'' };
}
// Método elástico de un grupo de pernos en su plano: Fx a lo largo del miembro, Fy transversal [kN], M [kN·m] → fuerza del perno más cargado [kN]
function grupoElastico(pts, Fx, Fy, M){
  const n = pts.length, cx = pts.reduce((s, p) => s + p.x, 0) / n, cy = pts.reduce((s, p) => s + p.y, 0) / n;
  const J = pts.reduce((s, p) => s + (p.x - cx) ** 2 + (p.y - cy) ** 2, 0); let mx = 0;
  for(const p of pts){ const fx = Fx / n - (J > 0 ? M * 1000 * (p.y - cy) / J : 0), fy = Fy / n + (J > 0 ? M * 1000 * (p.x - cx) / J : 0); mx = Math.max(mx, Math.hypot(fx, fy)); }
  return mx;
}
function calcEmpCol(c){
  const ch = [], av = [], pasos = [], req = [], add = addF(ch);
  const P = nz(c.P), V2 = Math.abs(nz(c.Vu)), V3 = Math.abs(nz(c.V3)), T = Math.abs(nz(c.T)), M2 = Math.abs(nz(c.M2)), M3m = Math.abs(nz(c.Mu));
  const busca = n => (G.PERFILES_LAM || []).find(x => x[0] === n);
  const pI = busca(c.colI); if(!pI) return { error:'Escoja el perfil de la columna de abajo.' };
  const pS = c.colS ? busca(c.colS) : pI; if(!pS) return { error:'Escoja el perfil de la columna de arriba.' };
  const sec = p => { const [nom, , d, bf, tw, tf, r, A, Ix, Sx, Zx, Iy, Sy, Zy] = p; return { nom, d, bf, tw, tf, r, A, Ix, Sx, Zx, Iy, Sy, Zy, T:d - 2 * (tf + r) }; };
  const I = sec(pI), Su = sec(pS), m = I.A <= Su.A ? I : Su, igual = I.nom === Su.nom;
  const ac = ACEROS[c.acero] || ACEROS['A572 Gr 50'], E = 200000, un = ['pernos', 'cjp', 'placa'].includes(c.union) ? c.union : 'pernos';
  const sis = ['DMO', 'DES'].includes(c.sismo) ? c.sismo : '', Hc = nz(c.Hcol) * 1000;
  pasos.push(`Columna de abajo ${I.nom}${igual ? '' : `, columna de arriba ${Su.nom}`} (${c.acero}, Fy ${ac.Fy} MPa); el empalme se revisa con la ${igual ? 'sección' : `menor (${m.nom})`}: d = ${m.d}, bf = ${m.bf}, tf = ${m.tf}, tw = ${m.tw} mm, A = ${Math.round(m.A)} mm²`);
  pasos.push('Sin contacto entre los extremos de las columnas (decisión de Amo): el empalme toma toda la carga, también la compresión.');
  // Sismo: resistencia mínima (AISC 341 E2.6g / E3.6g) y ubicación (D2.5a)
  let M3 = M3m, V2d = V2;
  if(sis){
    const Ry = RY(c.acero), Mreq = Ry * ac.Fy * m.Zx / 1e6;
    pasos.push('Con sismo el empalme (pernos, cubrejuntas y soldaduras) se diseña para la resistencia mínima; la sección de la columna se revisa con las fuerzas del modelo.');
    pasos.push(`Sismo ${sis}: flexión requerida ≥ Ry·Fy·Zx de la columna menor = ${Ry}·${ac.Fy}·${Math.round(m.Zx).toLocaleString('es-CO')} = ${r2(Mreq)} kN·m (del modelo ${r2(M3m)} kN·m)`);
    M3 = Math.max(M3m, Mreq);
    if(Hc > 0){ const Vreq = 2 * ac.Fy * m.Zx / 1e6 / (Hc / 1000); pasos.push(`Cortante requerido ≥ ΣMpc/H = 2·Fy·Zx/H = ${r2(Vreq)} kN (H = ${r2(Hc / 1000)} m; del modelo ${r2(V2)} kN)`); V2d = Math.max(V2, Vreq); }
    else av.push('Sismo: escriba la altura libre de la columna H para revisar el cortante mínimo ΣMpc/H.');
    av.push(`Sismo ${sis}: la carga axial y los cortantes del modelo deben venir de las combinaciones con sobrerresistencia Ω0 (AISC 341 D2.5b, NSR-10 F.3).`);
    const hE = nz(c.hEmp) * 1000, lim = Hc > 0 && Hc < 2400 ? Hc / 2 : 1200;
    req.push([`Sismo: empalme a ${lim < 1200 ? 'la mitad de la altura libre' : '1.2 m o más'} de las conexiones viga–columna (AISC 341 D2.5a)`, hE > 0 ? hE >= lim - 1e-6 : true, hE > 0 ? `${r1(hE)} ≥ ${r1(lim)} mm` : 'escriba la distancia; si no, indicar en planos']);
  }
  const Af = m.bf * m.tf, Aw = m.A - 2 * Af, Pt = Math.max(P, 0), Pc = Math.max(-P, 0);
  const Pcap = 0.9 * ac.Fy * m.A / 1000, Mc3 = 0.9 * ac.Fy * m.Zx / 1e6, Mc2 = 0.9 * ac.Fy * m.Zy / 1e6;
  const h1 = (p, pc, m3, mc3, m2, mc2) => { const pr = p / pc; return pr >= 0.2 ? pr + 8 / 9 * (m3 / mc3 + m2 / mc2) : pr / 2 + m3 / mc3 + m2 / mc2; };
  const hwm = m.d - 2 * m.tf - 2 * m.r, phiV = hwm / m.tw <= 2.24 * Math.sqrt(E / ac.Fy) ? 1.0 : 0.9;
  const FEXX = ELECTRODOS[c.electrodo] || 483;
  let geo = { I, Su, m, un };
  if(un === 'pernos'){
    const d = +c.d, dh = agujero(d), dn = anchoNeto(d), bm = bordeMin(d), rv = fv(c, d), pl = ACEROS[c.aceroPl] || ACEROS.A36, gap = nz(c.gap);
    const tpf = +c.tpf, bpf = +c.bpf, nf = Math.max(1, Math.round(+c.nf)), sf = +c.sf, gf = +c.gf, Lef = +c.Lef;
    const tpw = +c.tpw, hpw = +c.hpw, nw = Math.max(1, Math.round(+c.nw)), sw = +c.sw, Lew = +c.Lew, Lehw = +c.Lehw;
    const brazo = m.d + tpf, Ft = M3 * 1000 / brazo + Pt * Af / m.A, Fc = M3 * 1000 / brazo + Pc * Af / m.A, Ff = Math.max(Ft, Fc);
    const Vf = V3 / 2 + T * 1000 / brazo, Mf = M2 / 2, Pw = Math.abs(P) * Aw / m.A, ew = gap / 2 + Lehw;
    pasos.push(`Alas: F = M3/(d + tpf) + P·Af/A → tensión ${r2(Ft)} kN, compresión ${r2(Fc)} kN por ala; en el plano del ala V = V3/2 + T/(d + tpf) = ${r2(Vf)} kN y M = M2/2 = ${r2(Mf)} kN·m`);
    pasos.push(`Alma: axial P·Aw/A = ${r2(Pw)} kN y cortante V2 = ${r2(V2d)} kN con excentricidad e = gap/2 + Lehw = ${r1(ew)} mm`);
    // Rellenos (J5.2) cuando cambia el perfil: se reduce el corte del perno si el relleno pasa de 6 mm (salvo deslizamiento crítico)
    const tFill = Math.abs(I.d - Su.d) / 2, tFillW = Math.abs(I.tw - Su.tw) / 2, kF = t => c.desliz || t <= 6 ? 1 : Math.max(0.5, 1 - 0.0154 * (t - 6));
    if(tFill > 0.5) pasos.push(`Rellenos en las alas de la columna menor: t = (d₁ − d₂)/2 = ${r1(tFill)} mm${kF(tFill) < 1 ? ` → corte del perno × ${r3(kF(tFill))} (F.2.10.5 / J5.2: 1 − 0.0154(t − 6))` : ''}`);
    if(tFillW > 0.5) pasos.push(`Rellenos en el alma: t = ${r1(tFillW)} mm${kF(tFillW) < 1 ? ` → corte × ${r3(kF(tFillW))}` : ''}`);
    // Pernos de las alas: 2 columnas × nf filas a cada lado, método elástico con F, V y M2/2
    const ptsF = []; for(let i = 0; i < nf; i++) for(const s of [-1, 1]) ptsF.push({ x:i * sf, y:s * gf / 2 });
    const fF = grupoElastico(ptsF, Ff, Vf, Mf), tMin = Math.min(I.tf, Su.tf);
    const bP = Math.min(aplast(Lef - dh / 2, tpf, d, pl.Fu).phiRn, aplast(sf - dh, tpf, d, pl.Fu).phiRn), bC = Math.min(aplast(Lef - dh / 2, tMin, d, ac.Fu).phiRn, aplast(sf - dh, tMin, d, ac.Fu).phiRn);
    const capF = Math.min(rv * kF(tFill), bP, bC);
    add('pernos', `Pernos de un ala, a cada lado (${2 * nf}, corte simple, método elástico)`, 'F.2.10.3.6 y F.2.10.3.10 · Manual AISC parte 7', fF, capF, 'kN', `perno más cargado; corte ${r2(rv * kF(tFill))}, aplast. cubrejunta ${r2(bP)}, ala ${r2(bC)} kN`);
    const Tb = pretension(c.grado, d), mu = c.claseSup === 'B' ? 0.50 : 0.30;
    if(c.desliz){ add('pernos', 'Deslizamiento de los pernos de un ala', 'F.2.10.3.8 (J3-4), φ = 1.00', fF, 1.0 * mu * 1.13 * Tb, 'kN', `μ = ${mu}, Tb = ${Tb} kN`); if(!Tb) av.push('Pernos A307: no sirven para deslizamiento crítico.'); }
    // Cubrejuntas de las alas
    const Ag = bpf * tpf, An = Math.min((bpf - 2 * dn) * tpf, 0.85 * Ag), KLr = 0.65 * (gap + 2 * Lef) / (tpf / Math.sqrt(12));
    const PtC = Math.min(0.9 * pl.Fy * Ag, 0.75 * pl.Fu * An) / 1000, PcC = 0.9 * fcrE3(pl.Fy, KLr) * Ag / 1000, MpC = 0.9 * pl.Fy * tpf * bpf * bpf / 4 / 1e6;
    add('alas', 'Cubrejunta del ala: fluencia a tensión', 'F.2.10.4.1 (J4-1)', Ft, 0.9 * pl.Fy * Ag / 1000, 'kN', `Ag = ${r1(Ag)} mm²`);
    add('alas', 'Cubrejunta del ala: rotura a tensión', 'F.2.10.4.1 (J4-2), An ≤ 0.85Ag', Ft, 0.75 * pl.Fu * An / 1000, 'kN', `An = ${r1(An)} mm²`);
    add('alas', 'Cubrejunta del ala: compresión (sin contacto)', 'F.2.10.4.4 (J4-6) / E3', Fc, PcC, 'kN', `KL/r = 0.65·(gap + 2Lef)/r = ${r1(KLr)}`);
    if(Mf > 0) add('alas', 'Cubrejunta del ala: axial + flexión en su plano (M2/2)', 'F.2.8.1 (H1-1)', h1(Ff, Ft >= Fc ? PtC : PcC, Mf, MpC, 0, 1), 1, '', `φMn = 0.9·Fy·t·b²/4 = ${r2(MpC)} kN·m`);
    const agv = 2 * (Lef + (nf - 1) * sf) * tpf, anv = agv - 2 * (nf - 0.5) * dn * tpf;
    add('alas', 'Cubrejunta del ala: bloque de cortante', 'F.2.10.4.3 (J4-5)', Ft, Math.min(bloqueRn(pl.Fy, pl.Fu, agv, anv, (gf - dn) * tpf), bloqueRn(pl.Fy, pl.Fu, agv, anv, 2 * ((bpf - gf) / 2 - dn / 2) * tpf)), 'kN', 'entre las líneas de pernos o hacia los bordes');
    const agvC = 2 * (Lef + (nf - 1) * sf) * tMin, anvC = agvC - 2 * (nf - 0.5) * dn * tMin;
    add('columna', 'Ala de la columna: bloque de cortante', 'F.2.10.4.3 (J4-5)', Ft, bloqueRn(ac.Fy, ac.Fu, agvC, anvC, 2 * ((Math.min(I.bf, Su.bf) - gf) / 2 - dn / 2) * tMin), 'kN', 'hacia los bordes del ala');
    // Pernos del alma: 1 columna de nw a cada lado, doble cortante, método elástico con Pw, V2 y V2·e
    const ptsW = []; for(let i = 0; i < nw; i++) ptsW.push({ x:0, y:i * sw });
    const fW = grupoElastico(ptsW, Pw, V2d, V2d * ew / 1000), twMin = Math.min(I.tw, Su.tw);
    const bWp = 2 * Math.min(aplast(Lew - dh / 2, tpw, d, pl.Fu).phiRn, aplast(sw - dh, tpw, d, pl.Fu).phiRn), bWc = 0.75 * 2.4 * d * twMin * ac.Fu / 1000;
    add('pernos', `Pernos del alma, a cada lado (${nw}, doble cortante, método elástico)`, 'F.2.10.3 · Manual AISC parte 7', fW, Math.min(2 * rv * kF(tFillW), bWp, bWc), 'kN', `corte ${r2(2 * rv * kF(tFillW))}, aplast. cubrejuntas ${r2(bWp)}, alma ${r2(bWc)} kN`);
    if(c.desliz) add('pernos', 'Deslizamiento de los pernos del alma (2 planos)', 'F.2.10.3.8 (J3-4), φ = 1.00', fW, 2 * mu * 1.13 * Tb, 'kN', '');
    // Cubrejuntas del alma (2)
    const AgW = 2 * hpw * tpw, KLw = 0.65 * (gap + 2 * Lehw) / (tpw / Math.sqrt(12)), ZW = 2 * tpw * hpw * hpw / 4;
    add('almaPl', 'Cubrejuntas del alma: fluencia por cortante (2)', 'F.2.10.4.2 (J4-3)', V2d, 0.6 * pl.Fy * AgW / 1000, 'kN', '');
    add('almaPl', 'Cubrejuntas del alma: rotura por cortante (2)', 'F.2.10.4.2 (J4-4)', V2d, 0.75 * 0.6 * pl.Fu * 2 * (hpw - nw * dn) * tpw / 1000, 'kN', '');
    const PwC = P >= 0 ? 0.9 * pl.Fy * AgW / 1000 : 0.9 * fcrE3(pl.Fy, KLw) * AgW / 1000;
    add('almaPl', 'Cubrejuntas del alma: axial + flexión por la excentricidad', 'F.2.8.1 (H1-1)', h1(Pw, PwC, V2d * ew / 1000, 0.9 * pl.Fy * ZW / 1e6, 0, 1), 1, '', `axial ${r2(Pw)} kN (${P >= 0 ? 'tensión' : `compresión, KL/r ${r1(KLw)}`}), M = V2·e = ${r3(V2d * ew / 1000)} kN·m`);
    // Columna en el empalme: sección neta con los agujeros
    const AnC = m.A - 4 * dn * m.tf - nw * dn * m.tw, Afn = (m.bf - 2 * dn) * m.tf, Yt = ac.Fy / ac.Fu <= 0.8 ? 1.0 : 1.1;
    const Mn3 = ac.Fu * Afn < Yt * ac.Fy * Af ? Math.min(Mc3, 0.9 * ac.Fu * Afn / Af * m.Sx / 1e6) : Mc3;
    const PcapN = P > 0 ? Math.min(Pcap, 0.75 * ac.Fu * AnC / 1000) : Pcap;
    add('columna', 'Columna en el empalme (con los agujeros): axial + flexión', 'F.2.8.1 (H1-1) · F.2.4 (D2) · F.2.6.13 (F13-1)', h1(Math.abs(P), PcapN, M3m, Mn3, M2, Mc2), 1, '', `φPn ${r2(PcapN)} kN${P > 0 ? ` (rotura An = ${Math.round(AnC)} mm²)` : ' (sin pandeo: el pandeo de la columna va en el Anexo D)'}, φMn3 ${r2(Mn3)}, φMn2 ${r2(Mc2)} kN·m`);
    add('columna', 'Cortante del alma de la columna', 'F.2.7.2 (G2-1)', V2, phiV * 0.6 * ac.Fy * m.d * m.tw / 1000, 'kN', `φv = ${phiV}`);
    // Requisitos
    const bfMin = Math.min(I.bf, Su.bf), Tmin = Math.min(I.T, Su.T);
    req.push(['Cubrejunta del ala bpf ≤ bf de la columna menor', bpf <= bfMin + 1e-6, `${bpf} ≤ ${bfMin} mm`]);
    req.push(['Bordes de la cubrejunta del ala (bpf − gf)/2 y Lef ≥ mín.', Math.min((bpf - gf) / 2, Lef) >= bm, `${r1(Math.min((bpf - gf) / 2, Lef))} ≥ ${bm} mm`]);
    req.push(['Bordes del ala de la columna (bf − gf)/2 ≥ mín.', (bfMin - gf) / 2 >= bm, `${r1((bfMin - gf) / 2)} ≥ ${bm} mm`]);
    req.push(['Cubrejunta del alma cabe entre las alas: hpw ≤ T', hpw <= Tmin + 1e-6, `${hpw} ≤ ${r1(Tmin)} mm`]);
    req.push(['Al menos 2 pernos por lado en el alma (para tomar el momento V2·e)', nw >= 2, `${nw}`]);
    req.push(['Bordes de las cubrejuntas del alma Lew y Lehw ≥ mín.', Math.min(Lew, Lehw) >= bm, `${Math.min(Lew, Lehw)} ≥ ${bm} mm`]);
    req.push(['Pernos del alma caben: (nw − 1)·sw + 2·Lew ≤ hpw', (nw - 1) * sw + 2 * Lew <= hpw + 1e-6, `${(nw - 1) * sw + 2 * Lew} ≤ ${hpw} mm`]);
    req.push(['Separaciones ≥ 2.67d', Math.min(sf, gf, nw > 1 ? sw : Infinity) >= 2.67 * d - 1e-6, `${Math.min(sf, gf, nw > 1 ? sw : Infinity)} ≥ ${r1(2.67 * d)} mm`]);
    if(tFill > 0.5) req.push([`Rellenos de ${r1(tFill)} mm en las alas${tFillW > 0.5 ? ` y ${r1(tFillW)} mm en el alma` : ''} de la columna menor (J5)`, tFill <= 19 + 1e-6 || c.desliz, tFill <= 19 ? 'indicar en planos' : 'relleno grueso: extiéndalo más allá de la cubrejunta con pernos adicionales (J5.2b) o use placa de tope']);
    req.push([sis ? 'Sismo: pernos pretensionados, agujeros estándar y superficies de contacto clase A o mejor (AISC 341 D2.2)' : c.desliz ? `Pernos de deslizamiento crítico, superficie clase ${c.claseSup === 'B' ? 'B' : 'A'}` : 'Pernos apretados sin holgura (empalme a momento: se recomienda pretensionarlos)', true, 'indicar en planos']);
    geo = { ...geo, dh, gap, tpf, bpf, nf, sf, Lef, tpw, hpw, nw, sw, Lew, Lehw, tFill };
  } else if(un === 'cjp'){
    pasos.push('Soldadura de penetración completa en las alas y el alma: la resistencia es la del metal base de la columna menor (Tabla J2.5).');
    add('columna', 'Sección de la columna menor en la junta: axial + flexión', 'F.2.8.1 (H1-1) · Tabla J2.5 (CJP = metal base)', h1(Math.abs(P), Pcap, M3m, Mc3, M2, Mc2), 1, '', `φPn ${r2(Pcap)} kN (sin pandeo: va en el Anexo D), φMn3 ${r2(Mc3)}, φMn2 ${r2(Mc2)} kN·m`);
    add('columna', 'Cortante V2 por el alma', 'F.2.7.2 (G2-1)', V2, phiV * 0.6 * ac.Fy * m.d * m.tw / 1000, 'kN', `φv = ${phiV}`);
    add('columna', 'Cortante V3 + torsión por las alas', 'F.2.7.2 (G2-1), φ 0.9', V3 + 2 * T * 1000 / (m.d - m.tf), 0.9 * 0.6 * ac.Fy * 2 * m.bf * m.tf / 1000, 'kN', 'V3 + 2·T/(d − tf)');
    const dd = Math.abs(I.d - Su.d), db = Math.abs(I.bf - Su.bf), dt = Math.max(Math.abs(I.tf - Su.tf), Math.abs(I.tw - Su.tw));
    if(!igual){
      req.push(['Penetración completa entre perfiles distintos: las alas deben quedar alineadas (diferencia de peralte ≤ 10 mm)', dd <= 10, `${r1(dd)} mm${dd > 10 ? ': use placa de tope o el empalme atornillado con rellenos' : ''}`]);
      if(dt > 0 || db > 0) req.push(['Transición de espesor y de ancho con pendiente ≤ 1:2.5 en la pieza más gruesa o más ancha (AWS D1.1; AISC 341 D2.5c con sismo)', true, `diferencia de espesor ${r1(dt)} mm, de ancho ${r1(db)} mm: indicar en planos`]);
    }
    req.push(['Junta precalificada con bisel y respaldo; ultrasonido de las alas', true, 'indicar en planos']);
    req.push(['Agujero de acceso (ratonera) en el alma junto a las alas (F.2.10.1.6 / J1.6)', true, 'indicar en planos']);
    if(sis) req.push(['Sismo: soldaduras de demanda crítica (AISC 341 A3.4b): respaldo retirado o sellado y ultrasonido 100 %', true, 'indicar en planos']);
  } else {
    // Placa de tope: columna de arriba soldada a la placa y la placa soldada a la columna de abajo, con filetes en todo el contorno
    const tp = +c.tpb, pl = ACEROS[c.aceroPl] || ACEROS.A36, Bmin = Math.max(I.bf, Su.bf), Nmin = Math.max(I.d, Su.d);
    const Bp = nz(c.Bpl) > 0 ? +c.Bpl : Bmin + 40, Np = nz(c.Npl) > 0 ? +c.Npl : Nmin + 40, wS = +c.wS, wI = +c.wI;
    pasos.push(`Placa de tope ${Bp} × ${Np} × ${tp} mm (${c.aceroPl}); filetes en todo el contorno: columna de arriba ${wS} mm, columna de abajo ${wI} mm (${c.electrodo})`);
    for(const [col, w, txt] of [[Su, wS, 'de arriba'], [I, wI, 'de abajo']]){
      const R = soldPerim({ d:col.d, bf:col.bf, tf:col.tf, tw:col.tw, r:col.r }, { wF:w, wW:w, kds:false, FEXX, P:Math.abs(P), V2:V2d, V3, T, M2, M3 });
      add('soldadura', `Filetes columna ${txt}–placa: alas (${w} mm)`, 'F.2.10.2.4 (J2-4), método elástico', R.peor.F ? R.peor.F.f : 0, R.fd, 'MPa', `contorno ${col.nom}`);
      add('soldadura', `Filetes columna ${txt}–placa: alma (${w} mm)`, 'F.2.10.2.4 (J2-4), método elástico', R.peor.W ? R.peor.W.f : 0, R.fd, 'MPa', '');
      const tmin = Math.min(col.tf, tp), wMin = tmin <= 6 ? 3 : tmin <= 13 ? 5 : tmin <= 19 ? 6 : 8;
      req.push([`Filete columna ${txt}: mínimo según la parte más delgada (J2.4)`, w >= wMin, `${w} ≥ ${wMin} mm`]);
    }
    // Flexión de la placa cuando las alas no quedan una sobre otra
    const e = Math.abs(I.d - Su.d) / 2, Fala = M3 * 1000 / (m.d - m.tf) + Math.abs(P) * Af / m.A, b = Math.min(I.bf, Su.bf);
    if(e > 1){ const Mu = Fala * e / 1000, Mn = 0.9 * pl.Fy * b * tp * tp / 4 / 1e6;
      pasos.push(`Las alas están desfasadas e = (d₁ − d₂)/2 = ${r1(e)} mm: la placa se dobla con M = F·e = ${r2(Fala)}·${r1(e)} = ${r3(Mu)} kN·m`);
      add('placa', 'Placa: flexión por el desfase de las alas', 'F.2.6 · φb = 0.90 (Z = b·t²/4)', Mu, Mn, 'kN·m', `b = ${b} mm`);
      add('placa', 'Placa: cortante entre las alas', 'F.2.10.4.2 (J4-3)', Fala, 0.6 * pl.Fy * b * tp / 1000, 'kN', ''); }
    else pasos.push('Las alas de las dos columnas quedan una sobre otra: la placa solo transmite la fuerza a través de su espesor.');
    add('columna', 'Sección de la columna menor junto a la placa: axial + flexión', 'F.2.8.1 (H1-1)', h1(Math.abs(P), Pcap, M3m, Mc3, M2, Mc2), 1, '', `φPn ${r2(Pcap)} kN, φMn3 ${r2(Mc3)}, φMn2 ${r2(Mc2)} kN·m`);
    req.push(['Placa más grande que las dos columnas', Bp >= Bmin && Np >= Nmin, `${Bp} × ${Np} ≥ ${Bmin} × ${Nmin} mm`]);
    if(Pt > 0 || M3 > 0) av.push('La placa de tope trabaja a tensión en su espesor (por la tensión o el momento): use acero con buena ductilidad en el espesor y revise el desgarro laminar en planos.');
    if(sis) req.push(['Sismo: en empalmes soldados se exige penetración completa (AISC 341 E2.6g/E3.6g); con filetes a una placa de tope no se acepta', false, 'use el empalme atornillado o el soldado de penetración completa']);
    geo = { ...geo, tp, Bp, Np, wS, wI, e };
  }
  if(T > 0 && un !== 'cjp') av.push('La torsión se reparte como cortante lateral en las alas; el alabeo no se revisa.');
  const R = fin(ch, req, av, pasos, geo);
  // 💡 sugerencia: lo mínimo que cumple
  if(!c._sinSug && !R.ok){
    const ESP = [6.4, 8, 9.5, 12.7, 15.9, 19.1, 22.2, 25.4, 31.8, 38.1];
    const prueba = o => { const r = calcEmpCol({ ...c, ...o, _sinSug:true }); return !r.error && r.ok; };
    let s = null;
    if(un === 'pernos'){
      // Alas y alma por separado (como el empalme de viga); luego se confirma todo junto
      const Tm = Math.min(I.T, Su.T), hMax = Math.floor(Tm / 5) * 5, bfMin = Math.min(I.bf, Su.bf), base = {};
      if(+c.bpf > bfMin) base.bpf = Math.floor(bfMin / 5) * 5;
      if(Math.abs(I.d - Su.d) / 2 > 19 && !c.desliz) base.desliz = true;
      const esAla = x => x.grupo === 'alas' || /un ala|Ala de la columna/.test(x.nombre), esAlma = x => x.grupo === 'almaPl' || /del alma/.test(x.nombre);
      const okP = (o, f, rq) => { const r = calcEmpCol({ ...c, ...base, ...o, _sinSug:true }); return !r.error && r.ch.filter(f).every(x => x.ratio <= 1) && r.req.filter(q => rq(q[0])).every(q => q[1]); };
      let sF = null, sW = null;
      const dL = [+c.d, ...DIAM.map(x => x[1]).filter(x => x !== +c.d).sort((x, y) => Math.abs(x - +c.d) - Math.abs(y - +c.d) || y - x)];
      buscar: for(const d of dL) for(const acp of [...new Set([c.aceroPl, 'A572 Gr 50'])]){
        const sMin = Math.ceil(2.67 * d / 5) * 5, bpfS = base.bpf || +c.bpf, bmS = bordeMin(d), gfS = Math.max(sMin, Math.min(+c.gf, bpfS - 2 * bmS, bfMin - 2 * bmS));
        sF = null; for(let nf = 2; nf <= 6 && !sF; nf++) for(const t of ESP){ const o = { aceroPl:acp, d, nf, tpf:t, sf:Math.max(+c.sf, sMin), gf:gfS };
          if(okP(o, esAla, q => /ala/.test(q) && !/alma/.test(q))){ sF = o; break; } }
        if(!sF) continue;
        sW = null;
        for(let nw = 2; nw <= 6 && !sW; nw++) for(const tw of ESP.filter(x => x <= 15.9)){ const LewS = Math.max(bmS, Math.min(+c.Lew, 40, Math.floor((hMax - (nw - 1) * sMin) / 2)));
          const o = { ...sF, nw, tpw:tw, sw:sMin, Lew:LewS, hpw:Math.min(hMax, Math.max(+c.hpw, (nw - 1) * sMin + 2 * LewS)) };
          if(okP(o, esAlma, q => /alma/.test(q))){ sW = o; break; } }
        if(sW && prueba({ ...base, ...sW })) break buscar; sW = null; }
      if(sF && sW && prueba({ ...base, ...sW })){ const o = { ...base, ...sW };
        s = { ...o, txt:`💡 Usar pernos de ${(DIAM.find(x => x[1] === o.d) || [o.d])[0]}${o.desliz ? ' de deslizamiento crítico' : ''}, ${o.nf} filas por lado en las alas con cubrejunta de ${o.tpf} mm${o.aceroPl !== c.aceroPl ? ` en ${o.aceroPl}` : ''} y ${o.nw} pernos por lado en el alma con cubrejuntas de ${o.tpw} mm` }; }
    } else if(un === 'placa'){
      for(const w of [5, 6, 8, 10, 12, 14, 16]){ for(const t of ESP.filter(x => x >= 12.7)){ if(prueba({ wS:w, wI:w, tpb:t })){ s = { wS:w, wI:w, tpb:t, txt:`💡 Usar placa de ${t} mm y filetes de ${w} mm` }; break; } } if(s) break; }
    }
    if(s) R.sug = { tipo:'sold', ok:true, ...s };
    else if(un === 'pernos' && !R.ch.some(x => x.grupo === 'columna' && x.ratio > 1)) R.av.push(`No se encontró una combinación de pernos y cubrejuntas que cumpla (hasta 6 filas, 38 mm y pernos de 1-1/8")${igual ? '' : ': con perfiles distintos el alma de la columna menor deja poco espacio y los rellenos son gruesos; considere la placa de tope'}.`);
    else if(R.ch.some(x => x.grupo === 'columna' && x.ratio > 1)) R.av.push('La columna misma no resiste las fuerzas en la junta: no hay empalme que lo arregle; revise el perfil o mueva el empalme.');
  }
  return R;
}


// «Qué cambiar» en todas las conexiones (26-nov, pedido de Amo: igual a la placa base): bajo cada chequeo que no cumple, el cambio de UNA medida
// que lo arregla con el menor paso. Se prueban los campos que tiene la conexión (pernos, espesores, filetes, cantidades, largos, acero, opciones);
// se descarta un cambio que haga fallar más requisitos de detallado. Resultado en x.fix {txt, patch, ratio, todo} (lo pinta ui-con.js).
const FX_W = [3, 5, 6, 8, 10, 12, 14, 16];
const FX = {
  pern:{ d:'pernos', grado:'grado', rosca:'rosca', n:'pernos', nf:'filas de pernos en cada ala', nw:'pernos en el alma', filas:'filas de pernos', cols:'columnas de pernos', nbc:'pernos de compresión', ncw:'columnas de pernos en el alma' },
  esp:{ tRf:'las platinas de refuerzo de la ranura', tp:'la platina', tAng:'los angulares', t:'el angular', tpf:'las cubrejuntas de las alas', tpw:'las cubrejuntas del alma', tpi:'las cubrejuntas interiores', tg:'la cartela', tL:'los angulares', ts:'la platina de rigidez', tsE:'el rigidizador de la extensión', tsC:'las placas de continuidad', tcw:'la platina de la cartela', tph:'el patín de la cartela', tdp:'la placa de refuerzo', tpb:'la placa de tope' },
  sol:{ wRf:'el filete de las platinas de refuerzo', w:'el filete', wAla:'el filete de las alas', wAlma:'el filete del alma', wS:'el filete al soporte', wR:'los filetes de la platina', wC:'el filete cartela–viga', wCc:'el filete cartela–columna', wPA:'el filete patín–alma', wsC:'el filete de las placas de continuidad', wsE:'el filete del rigidizador', wdp:'el filete de la placa de refuerzo', wT:'el filete placa–ala', wt:'el filete al tubo', wB:'el filete cartela–viga', wI:'el filete inferior' },
  lar:{ bRf:'el ancho de las platinas de refuerzo', LRf:'el largo de las platinas de refuerzo', bp:'el ancho de la placa', bpf:'el ancho de las cubrejuntas de las alas', hpw:'el alto de las cubrejuntas del alma', Lws:'el largo de la soldadura del tubo', Lwg:'el largo de la cartela', LhC:'el largo de la cartela Lh', hhC:'el alto de la cartela hh', Lt:'el traslapo', La:'el largo del angular', W:'el ancho de la platina de rigidez', hs:'el alto de la platina de rigidez', Lh:'el largo de la cartela sobre la viga', Lv:'el alto de la cartela', a:'el desfase del corte', bPl:'el ancho de la platina del cruce', bv:'el ala vertical', bh:'el ala horizontal' },
  ace:{ aceroRf:'las platinas de refuerzo', aceroPl:'la platina', aceroAng:'el angular', aceroG:'la cartela', aceroL:'los angulares', aceroRig:'la platina de rigidez', aceroRigC:'las placas de continuidad', aceroCart:'la cartela' } };
function fxRelevante(c, k){
  if(['bRf', 'tRf', 'LRf', 'wRf', 'aceroRf'].includes(k)) return !!c.rRef && c.diag === 'tubo' && (k !== 'LRf' || c[k] !== '');
  if(c[k] === '' || c[k] == null) return k === 'wAlma' && c.union !== 'cjp' && c.tipo === 'soldada';
  if(['ts', 'W', 'hs', 'wR', 'aceroRig'].includes(k)) return c.tipo === 'asiento' && !!c.rig;
  if(['tsC', 'wsC', 'aceroRigC'].includes(k)) return c.rigCol !== 'no';
  if(['tdp', 'wdp'].includes(k)) return c.dp === 'si';
  if(['LhC', 'hhC', 'tcw', 'tph', 'wC', 'wCc', 'wPA', 'aceroCart'].includes(k) && c.tipo === 'soldada') return c.cart && c.cart !== 'no';
  if(['tsE', 'wsE'].includes(k)) return c.config === '8ES';
  if(k === 'tpi') return !!c.interior;
  if(['w', 'wAlma'].includes(k) && c.tipo === 'soldada') return c.union !== 'cjp';
  if(['wS'].includes(k)) return c.unSop === 'sold' || c.tipo === 'empCol';
  if(['tL', 'nL', 'bL'].includes(k)) return !c.diag || c.diag === 'L';
  if(['Lws', 'wt'].includes(k)) return c.diag === 'tubo' || c.diag === 'redondo';
  if(k === 'Lt' || k === 'wT') return c.soporte === 'alma';
  if(k === 'a') return c.tipo === 'empZ';
  if(['bv', 'bh', 'La', 't'].includes(k)) return c.tipo === 'asiento';
  if(k === 'n' && c.tipo === 'cartela' && (c.diag === 'tubo' || c.diag === 'redondo')) return false;
  if(['tpb', 'wI'].includes(k)) return c.tipo === 'empCol' && c.union === 'placa';
  if(['tpf', 'tpw', 'nf', 'nw', 'bpf', 'hpw'].includes(k) && c.tipo === 'empCol') return c.union === 'pernos';
  return true; }
function fxCands(c, k, grupo){
  const v = c[k], nv = +v, L = FX[grupo][k], out = [];
  if(grupo === 'pern'){
    if(k === 'd'){ const i = DIAM.findIndex(x => Math.abs(x[1] - nv) < 0.2); DIAM.slice(i + 1, i + 3).forEach(x => out.push({ patch:{ d:x[1] }, txt:`Use pernos de ${x[0]} (ahora ${(DIAM[i] || [nv + ' mm'])[0]})` })); }
    else if(k === 'grado'){ if(v === 'A325') out.push({ patch:{ grado:'A490' }, txt:'Use pernos A490 (ahora A325)' }); }
    else if(k === 'rosca'){ if(v === 'N') out.push({ patch:{ rosca:'X' }, txt:'Pida los pernos con la rosca fuera del plano de corte (tipo X)' }); }
    else if(k === 'ncw'){ if(nv < 2) out.push({ patch:{ ncw:2 }, txt:'Ponga 2 columnas de pernos en el alma (ahora 1)' }); }
    else [1, 2, 3].forEach(a => out.push({ patch:{ [k]:nv + a }, txt:`Ponga ${nv + a} ${L} (ahora ${nv})` }));
  } else if(grupo === 'esp'){ ESP_PL.filter(t => t > nv + 1e-6).slice(0, 5).forEach(t => out.push({ patch:{ [k]:t }, txt:`Suba el espesor de ${L} de ${v} a ${t} mm`.replace(' de el ', ' del ') })); }
  else if(grupo === 'sol'){ const b = k === 'wAlma' && v === '' ? +c.w : nv; FX_W.filter(w => w > b).slice(0, 3).forEach(w => out.push({ patch:{ [k]:w }, txt:`Suba ${L} de ${b} a ${w} mm` })); }
  else if(grupo === 'lar'){ [25, 50, 100].forEach(a => out.push({ patch:{ [k]:nv + a }, txt:`Aumente ${L} de ${v} a ${nv + a} mm` })); }
  else if(grupo === 'ace'){ const ac = c[k] || ''; if(!/572|A500|50/.test(ac) && ACEROS['A572 Gr 50']) out.push({ patch:{ [k]:'A572 Gr 50' }, txt:`Haga ${L} en acero A572 Gr 50 (ahora ${ac || 'el mismo del perfil'})` }); }
  return out; }
function fxOpciones(c){
  const o = [];
  if(['testa', 'ras', 'soldada'].includes(c.tipo) && c.rigCol !== 'si' && (c.columna || c.soporte === 'alma')) o.push({ patch:{ rigCol:'si' }, txt:'Ponga placas de continuidad en la columna' });
  if(['testa', 'ras', 'soldada'].includes(c.tipo) && c.dp !== 'si' && c.columna) o.push({ patch:{ dp:'si' }, txt:'Ponga una placa de refuerzo en el alma de la columna' });
  if(c.tipo === 'soldada' && c.union !== 'cjp') o.push({ patch:{ union:'cjp' }, txt:'Haga la soldadura de penetración completa' });
  if((c.tipo === 'testa' || c.tipo === 'ras') && c.soldAla !== 'cjp') o.push({ patch:{ soldAla:'cjp' }, txt:'Suelde las alas a la placa con penetración completa' });
  if(c.tipo === 'empZ' && c.union !== 'cjp') o.push({ patch:{ union:'cjp' }, txt:'Haga las soldaduras de penetración completa' });
  if(c.tipo === 'empalme' && !c.interior) o.push({ patch:{ interior:true }, txt:'Agregue cubrejuntas interiores en las alas' });
  if(c.tipo === 'asiento' && !c.rig) o.push({ patch:{ rig:true }, txt:'Agregue una platina de rigidez (pie de amigo) bajo el asiento' });
  if(c.tipo === 'testa' && c.config !== '8ES') o.push({ patch:{ config:'8ES' }, txt:'Pase a la chapa de 8 pernos con rigidizador (8ES)' });
  if(['cartela', 'esquina', 'cruce'].includes(c.tipo) && c.diag === 'tubo' && !c.rRef) o.push({ patch:{ rRef:true }, txt:`Ponga platinas de refuerzo en la ranura: 2 de ${c.bRf || 100} × ${c.tRf || 6.4} mm sobre las caras sin ranura` });
  if(c.tipo === 'cartela' && (c.diag || 'L') === 'L' && +c.nL < 2) o.push({ patch:{ nL:2 }, txt:'Use dos angulares en vez de uno' });
  return o; }
const FX_ORDEN = [[/perno|aplastamiento|desgarro|deslizamiento|palanca|tensión de los/i, ['pern', 'esp', 'ace', 'lar', 'op']],
  [/soldadura|filete|cordón|metal base|penetración|garganta/i, ['sol', 'esp', 'lar', 'op']],
  [/columna|panel|alma de la columna|ala de la columna|J10|continuidad|refuerzo/i, ['op', 'esp', 'sol', 'ace']],
  [/bloque|fluencia|rotura|flexión|pandeo|whitmore|cortante|tensión|compresión|platina|placa|cubrejunta|angular|cartela/i, ['esp', 'lar', 'ace', 'pern', 'op', 'sol']]];
function arreglosGen(c, out){
  const clave = x => x.grupo + '|' + String(x.nombre).replace(/ con placa de refuerzo/, '').replace(/\(.*?\)/g, '').replace(/[\d.,]+/g, '').trim();
  const nReq = r => (r.req || []).filter(q => !q[1]).length, req0 = nReq(out);
  const porG = {}; for(const g of Object.keys(FX)) porG[g] = Object.keys(FX[g]).filter(k => k in c && fxRelevante(c, k)).map(k => fxCands(c, k, g)).filter(a => a.length);
  porG.op = fxOpciones(c).map(x => [x]);
  // por pasos: primero el cambio más pequeño de cada campo, luego el siguiente
  const lista = gs => { const res = []; for(const g of gs){ const fs = porG[g] || []; const m = Math.max(0, ...fs.map(a => a.length)); for(let i = 0; i < m; i++) fs.forEach(a => a[i] && res.push(a[i])); } return res; };
  const cache = new Map(), prueba = patch => { const k = JSON.stringify(patch); if(!cache.has(k)){ let r; try{ r = Conex.calc({ ...c, ...patch, _sinSug:true }); }catch(e){ r = { error:e.message }; } cache.set(k, r); } return cache.get(k); };
  let n = 0;
  for(const x of out.ch.filter(x => x.ratio > 1)){
    if(++n > 12) break;
    const kx = clave(x), ord = (FX_ORDEN.find(([re]) => re.test(x.nombre)) || [, ['esp', 'pern', 'sol', 'lar', 'ace', 'op']])[1];
    const gs = [...ord, ...['pern', 'esp', 'sol', 'lar', 'ace', 'op'].filter(g => !ord.includes(g))];
    let fx = null; const L = lista(gs);
    // 1.ª vuelta: sin dañar los requisitos de detallado; 2.ª: se acepta, avisando que hay que revisarlos
    for(const flojo of [false, true]){
      for(const cand of L){
        const r = prueba(cand.patch); if(r.error || (!flojo && nReq(r) > req0)) continue;
        const ys = r.ch.filter(z => clave(z) === kx), y = ys.length ? ys.reduce((a, b) => a.ratio >= b.ratio ? a : b) : null;
        if(!y || y.ratio <= 1){ fx = { txt:cand.txt + (nReq(r) > req0 ? ' (luego revise los requisitos de detallado)' : ''), patch:cand.patch, ratio:y ? y.ratio : null, todo:!!r.ok }; break; }
      }
      if(fx) break;
    }
    x.fix = fx || { txt:'Ningún cambio de una sola medida lo arregla: combine cambios o use un perfil o una conexión más grande', patch:null };
  } }
const CALC = { esquina:calcCartela, cruce:calcCartela, aleta:calcAleta, grupo:calcGrupoS, testa:calcTesta, ras:calcTesta, angular:calcAngular, testaV:calcTestaV, asiento:calcAsiento, empalme:calcEmpalme, cartela:calcCartela, base:calcBase, soldada:calcSoldada, empZ:calcEmpZ, empCol:calcEmpCol };
const DEF = { esquina:defaultsEsquina, cruce:defaultsCruce, aleta:defaultsAleta, grupo:defaultsGrupo, testa:defaultsTesta, ras:defaultsRas, angular:defaultsAngular, testaV:defaultsTestaV, asiento:defaultsAsiento, empalme:defaultsEmpalme, cartela:defaultsCartela, base:defaultsBase, soldada:defaultsSoldada, empZ:defaultsEmpZ, empCol:defaultsEmpCol };
const Conex = { ACEROS, PERNOS, DIAM, ELECTRODOS, BORDE_MIN, BORDE_CIZ, bordeMin, agujero, icr, elastico, pernoCorte, aplast, perfil,
  calc: c => { CIZ = !!c.cizalla; const r = (CALC[c.tipo] || calcAleta)(c, !!c._sinSug); if(!r.error && c.cizalla) r.pasos.unshift('Bordes cortados con cizalla: distancias mínimas al borde de la columna «cizalla» de la Tabla F.2.10.3-4 (J3.4).');
    if(r.error) return r;
    if(EXTRA[c.tipo]){ EXTRA[c.tipo](c, r, addF(r.ch), r.av); r.max = r.ch.reduce((m, x) => Math.max(m, x.ratio), 0); r.ok = r.max <= 1 && !r.req.some(q => !q[1]); }
    if(!c._sinSug) try{ r.rigid = rigidez(c, r); }catch(e){ r.rigid = null; }
    if(!c._sinSug && !r.ok && c.tipo !== 'base' && r.ch) try{ arreglosGen(c, r); }catch(e){ }
    return r; },
  defaults: t => (DEF[t] || defaultsAleta)(),
  CARAS, nudo:calcNudo, defaultsNudo, ajustarNudo, vigaDe };
G.Conex = Conex;
if(typeof module !== 'undefined') module.exports = Conex;
})(typeof window !== 'undefined' ? window : globalThis);
