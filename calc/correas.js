/* ═══ Revisión de cubierta: correas metálicas (NSR-10 Título F, LRFD) y de madera (Título G, esfuerzos admisibles) ═══
   Pasado de las calculadoras de Amo con las correcciones aprobadas el 29-oct (M1–M12 y W1–W12):
   - Metálicas: ángulo sencillo con F.2.6.10 (1.5My con el módulo menor, pandeo lateral-torsional del ángulo,
     pandeo local del ala; ejes principales si la lámina no arriostra), tubo rectangular con F.2.6.7 (0.93t, ancho efectivo),
     interacción biaxial con esfuerzos en los puntos de la sección (H2), combinaciones B.2.4 con presión y succión,
     coeficientes correctos de vigas continuas, deflexión en servicio, peso propio.
   - Madera: Lr mínimo según pendiente, desviación del grano con aviso fuera de tabla, flexión biaxial amplificada,
     le con tres tramos, opción de diafragma, E0.5/E0.05 para deflexión y Emin solo para estabilidad, deflexión diferida,
     límites de la Tabla G.3.2-1 según cielo raso, Cr solo en Fb (S ≤ 0.61 m), humedad interpolada, Cl continuo.
   - Viento: B.6.5, componentes y revestimiento; edificación cerrada / parcialmente cerrada (GCp de cubiertas, h ≤ 18 m)
     o cubierta libre (el mismo cálculo del Anexo A). Cálculo puro: sin pantalla. */
(function(root){
const G = 9.81, E_AC = 200000, GAMMA_AC = 77.0;                       // m/s², MPa, kN/m³
const num = (v, d = 0) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : d; };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

const ACEROS = {
  A36:  { n:'ASTM A36', Fy:250, Fu:400 },
  A572: { n:'ASTM A572 Gr.50', Fy:345, Fu:450 },
  A500B:{ n:'ASTM A500 Gr.B', Fy:317, Fu:400 },
  A500C:{ n:'ASTM A500 Gr.C', Fy:345, Fu:427 },
  A1085:{ n:'ASTM A1085', Fy:345, Fu:448 },
};
const ACEROS_L = ['A36', 'A572'], ACEROS_HSS = ['A500B', 'A500C', 'A1085', 'A36'];
// Coeficientes de viga para carga repartida (momento máximo, cortante máximo y deflexión máxima: Δ = cD·w·L⁴/EI)
const APOYOS = {
  simple:{ n:'Simplemente apoyada', cM:1/8, cV:0.5, cD:5/384, txtM:'wL²/8', txtV:'wL/2', txtD:'5wL⁴/384EI' },
  cont2: { n:'Continua de 2 vanos', cM:1/8, cV:0.625, cD:1/185, txtM:'wL²/8 (apoyo central)', txtV:'0.625wL', txtD:'wL⁴/185EI' },
  cont3: { n:'Continua de 3 o más vanos', cM:0.1, cV:0.6, cD:0.0069, txtM:'wL²/10 (primer apoyo interior)', txtV:'0.6wL', txtD:'0.0069wL⁴/EI' },
};
// Catálogos para las sugerencias (mm)
const CAT_L = [[25.4,3.18],[31.75,3.18],[38.1,3.18],[38.1,4.76],[38.1,6.35],[50.8,3.18],[50.8,4.76],[50.8,6.35],[63.5,4.76],[63.5,6.35],[76.2,4.76],[76.2,6.35],[76.2,7.94],[101.6,6.35],[101.6,7.94],[101.6,9.53]];
const CAT_HSS = [[50,25,1.5],[50,30,2],[60,40,1.5],[60,40,2],[80,40,2],[90,50,2],[100,50,2],[100,50,3],[120,60,2],[120,60,3],[150,50,2],[150,50,3],[150,100,3],[150,100,4],[200,100,4]];   // H × B × t (H perpendicular a la cubierta)
const CAT_MAD = [[45,90],[45,110],[45,140],[45,190],[65,140],[65,190],[90,140],[90,190],[90,240]];   // b × d

// Madera: Tablas G.2.2-1 / G.2.2-2 (MPa)
const MADERAS = {
  ES1:{Fb:29.5,Ft:21,Fc:23,Fp:6,  Fv:2,  E05:18000,E005:13250,Emin:7130},
  ES2:{Fb:28.5,Ft:20,Fc:22,Fp:4.3,Fv:2,  E05:18000,E005:13250,Emin:7130},
  ES3:{Fb:23,  Ft:17,Fc:19,Fp:3.8,Fv:1.6,E05:14000,E005:11000,Emin:5500},
  ES4:{Fb:17,  Ft:12,Fc:15,Fp:2.8,Fv:1.5,E05:12500,E005:10000,Emin:5000},
  ES5:{Fb:15,  Ft:11,Fc:13,Fp:2,  Fv:1.1,E05:11200,E005:8250, Emin:4435},
  ES6:{Fb:12.5,Ft:9, Fc:10,Fp:1.5,Fv:1.3,E05:9000, E005:6500, Emin:3564},
};
const TXT_ARRIOSTRE = {
  a:'No se requiere soporte lateral (d/b ≤ 2).',
  b:'Se debe restringir el giro y el desplazamiento lateral en los apoyos. Para esto se acepta el uso de bloques de la misma altura del elemento, arriostramiento en "x", fijación a otros elementos estructurales por medio de clavos o pernos, u otros medios aceptables.',
  c:'El borde a compresión del elemento debe ser soportado lateralmente en toda su longitud para prevenir desplazamiento (se acepta el revestimiento estructural del piso o techo); además se debe restringir el giro y el desplazamiento lateral en los apoyos.',
  d:'Se deben instalar arriostramientos en "x" o bloques de la misma altura del elemento a intervalos que no excedan 2.40 m. El borde a compresión debe ser soportado lateralmente en toda su longitud con el revestimiento estructural del piso o techo, y se debe restringir el giro y el desplazamiento lateral en los apoyos.',
  e:'Los bordes superior e inferior del elemento deben contar con soporte lateral continuo en toda su longitud y se debe restringir el giro y el desplazamiento lateral en los apoyos.',
};

// ─── Datos por defecto ───
function defaults(){
  return {
    cub:{ perfil:'master1000', calibre:26, wManual:'' }, cielo:{ aplica:false, tipo:'Drywall', w:15 }, otras:'',     // kg/m²
    paneles:true, panel:null, riel:null, nRieles:2, Lr:'',                                                          // Lr kN/m² (vacío = mínimo por pendiente)
    viento:{ tipoEd:'cerrada', grupo:'I', huracan:false, V:22, L:'', W:'', He:'', Hr:'', rug:'B', distRug:'', cercaD:false, distD:'', expManual:'', flujo:'libre', zona:'3' },
    correas:[], fotos:[], obs:'',
  };
}
function nuevaCorrea(mat, n){
  const base = { id:'c' + Math.random().toString(36).slice(2, 9), nom:`CR-${n}`, mat, desc:'', s:1.5, L:4.0, alfa:'', apoyo:'simple', zona:'', limV:'', limT:'', res:null, huella:'' };
  return mat === 'mad'
    ? { ...base, grupo:'ES4', b:45, d:140, dens:600, CHc:12, CHs:12, temp:25, incision:false, conjunta:false, BA:0, AC:100, diafragma:true, restr:false, lu:'', Kcr:'' }
    : { ...base, sec:'L', acero:'A36', b:38.1, t:3.18, H:100, B:50, tH:2, arriostre:true };
}

// ─── Cargas por área (kN/m²) ───
function cargasArea(R, AnexoA, bib){
  const items = [];
  const c = R.cub || {}, mat = AnexoA.LAMINAS[c.perfil] || AnexoA.LAMINAS.master1000;
  let wC = 0, nomC = mat.nombre, fuente = mat.fuente;
  if(num(c.wManual, 0) > 0){ wC = num(c.wManual); fuente = 'Valor escrito por el diseñador'; }
  else if(mat.calibres){ const cal = mat.calibres[c.calibre]; wC = cal ? cal.peso / cal.ancho : 0; nomC += ` cal. ${c.calibre}`; }
  else wC = mat.w;
  items.push({ n:nomC, kg:wC, fuente });
  if(R.cielo?.aplica) items.push({ n:`Cielo raso — ${R.cielo.tipo}`, kg:num(R.cielo.w), fuente:'Peso del cielo raso (editable)' });
  let pan = null;
  if(R.paneles){
    const p = R.panel || bib?.paneles?.[0] || {}, r = R.riel || bib?.rieles?.[0] || {};
    const Lp = num(p.L), Wp = num(p.W), wP = Lp && Wp ? num(p.peso) / (Lp * Wp) : 0;
    const nR = num(R.nRieles, 2), wR = Lp ? nR * num(r.peso) / Lp : 0;      // nR rieles por fila de paneles de largo Lp
    pan = { p, r, Lp, Wp, wP, nR, wR };
    items.push({ n:`Paneles solares ${p.nombre || ''}`.trim(), kg:wP, fuente:`${num(p.peso)} kg / (${Lp} × ${Wp} m)` });
    items.push({ n:`Rieles ${r.nombre || ''}`.trim(), kg:wR, fuente:`${nR} rieles × ${num(r.peso)} kg/m / ${Lp} m (largo del panel)` });
  }
  if(num(R.otras, 0) > 0) items.push({ n:'Otras cargas permanentes', kg:num(R.otras), fuente:'Valor escrito por el diseñador' });
  const kg = items.reduce((a, x) => a + x.kg, 0);
  return { items, kg, qD:kg * G / 1000, pan };
}
// Lr mínimo, Tabla B.4.2.1-2: cubiertas inclinadas ≤ 15° → 0.50 kN/m²; > 15° → 0.35 kN/m²
const LrMin = th => th > 15 ? 0.35 : 0.50;

// ─── Viento B.6.5: componentes y revestimiento sobre la correa ───
// GCp de cubiertas, edificios con h ≤ 18 m (Figuras B.6.5-11B/C/D): [A ≤ 0.93 m², A ≥ 9.3 m²], interpolación logarítmica
const GCP = [
  { hasta:7,  pos:[0.3,0.2], z1:[-1.0,-0.9], z2:[-1.8,-1.1], z3:[-2.8,-1.1], fig:'Figura B.6.5-11B (θ ≤ 7°)' },
  { hasta:27, pos:[0.5,0.3], z1:[-0.9,-0.8], z2:[-1.7,-1.2], z3:[-2.6,-1.6], fig:'Figura B.6.5-11C (7° < θ ≤ 27°)' },
  { hasta:45, pos:[0.9,0.8], z1:[-1.0,-0.8], z2:[-1.2,-1.0], z3:[-1.2,-1.0], fig:'Figura B.6.5-11D (27° < θ ≤ 45°)' },
];
const logInterp = (A, [a, b]) => A <= 0.93 ? a : A >= 9.3 ? b : a + (b - a) * Math.log10(A / 0.93) / Math.log10(9.3 / 0.93);
function geomViento(v){
  const L = num(v.L), W = num(v.W), He = num(v.He), Hr = num(v.Hr);
  const faltan = [['largo L', L], ['ancho W', W], ['altura de cornisa', He], ['altura de cumbrera', Hr]].filter(x => !(x[1] > 0)).map(x => x[0]);
  if(faltan.length) return { ok:false, faltan };
  const theta = Hr > He ? Math.atan((Hr - He) / W) * 180 / Math.PI : 0, hm = (He + Hr) / 2;
  return { ok:true, L, W, He, Hr, theta, hm };
}
function vientoCorrea(R, AnexoA, luz, s, zona){
  const v = R.viento || {}, g = geomViento(v);
  if(!g.ok) return g;
  const zn = String(zona || v.zona || '3');
  const Ae = luz * Math.max(s, luz / 3), pMin = 0.40;
  if(v.tipoEd === 'libre'){
    // Cubierta libre: el mismo cálculo del Anexo A (Figura B.6.5-19A, componentes y revestimiento)
    const A = { tipo:{ paneles:false, lamina:true }, panel:{}, viento:{ ...AnexoA.defaults().viento, ...v, fuente:'cyr' } };
    const r = AnexoA.viento(A, [{ id:'c', nombre:'Correa', trib:s, luz }]);
    if(!r.ok) return { ok:false, faltan:r.faltan };
    const e = r.porElem[0], z = e.cyr.find(x => String(x.zona) === zn) || e.cyr[0];
    const pP = Math.max(z.pp, 0), pS = Math.max(-z.ps, 0);
    return { ok:true, tipo:'libre', g, Ae, zona:zn, clase:e.clase, a:r.a, qh:r.qh1 / 1000, Kz:r.Kz1, I:r.I, V:r.V, ex:r.ex, Kd:r.Kd, Gr:r.G,
      CNp:z.CNp, CNs:z.CNs, pPres:pP, pSucc:pS, dPres:Math.max(pP, pMin), dSucc:Math.max(pS, pMin), pMin,
      ref:'B.6.5.13 — cubierta libre, componentes y revestimiento (Figura B.6.5-19A)' };
  }
  const grupo = AnexoA.GRUPOS[v.grupo] || AnexoA.GRUPOS.I, I = grupo.I[v.huracan ? 1 : 0], V = num(v.V, 22);
  const ex = AnexoA.exposicion(v, g.hm), Kz = AnexoA.Kz(ex.usada, g.hm, 1), Kd = 0.85, Kzt = 1;
  const qh = 0.613 * Kz * Kzt * Kd * V * V * I / 1000;                       // kN/m²
  const t = GCP.find(x => g.theta <= x.hasta) || GCP[2];
  const GCpP = logInterp(Ae, t.pos), GCpN = logInterp(Ae, t['z' + zn] || t.z3);
  const GCpi = v.tipoEd === 'parcial' ? 0.55 : 0.18;
  const dmin = Math.min(g.L, g.W), a = Math.max(Math.min(0.1 * dmin, 0.4 * g.hm), Math.max(0.04 * dmin, 0.9));
  const pP = qh * (GCpP + GCpi), pS = qh * (-GCpN + GCpi);
  return { ok:true, tipo:v.tipoEd === 'parcial' ? 'parcial' : 'cerrada', g, Ae, zona:zn, a, qh, Kz, Kzt, Kd, I, V, ex, fig:t.fig, GCpP, GCpN, GCpi,
    pPres:pP, pSucc:pS, dPres:Math.max(pP, pMin), dSucc:Math.max(pS, pMin), pMin,
    ref:'B.6.5.12.4.1 — p = qh[(GCp) − (GCpi)], componentes y revestimiento, h ≤ 18 m' };
}

// ─── Cargas lineales sobre la correa (kN/m), componentes normal (n, hacia la cubierta +) y tangencial (t, pendiente abajo +) ───
function cargasCorrea(R, cor, ctx, pp){
  const s = num(cor.s), L = num(cor.L), th = cor.alfa !== '' && cor.alfa != null ? num(cor.alfa) : (ctx.g?.ok ? ctx.g.theta : 0);
  const r = th * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r);
  const qD = ctx.area.qD, Dv = qD * s + pp;                                 // vertical por metro de correa
  const LrA = R.Lr !== '' && R.Lr != null ? num(R.Lr) : LrMin(th), Lv = LrA * s * c;   // Lr sobre la proyección horizontal
  const w = vientoCorrea(R, ctx.AnexoA, L, s, cor.zona);
  const Wp = w.ok ? w.dPres * s : 0, Ws = w.ok ? w.dSucc * s : 0;
  return { s, L, th, c, sn, qD, pp, Dv, Dn:Dv * c, Dt:Dv * sn, LrA, LrMin:LrMin(th), LrBajo:LrA < LrMin(th) - 1e-9, Lv, Ln:Lv * c, Lt:Lv * sn, w, Wp, Ws };
}
// Combinaciones B.2.4 (LRFD) y B.2.3 (servicio) en componentes n/t
function combosLRFD(q){
  const C = (nom, ref, fD, fL, fW, W) => ({ nom, ref, n:fD * q.Dn + fL * q.Ln + fW * W, t:fD * q.Dt + fL * q.Lt });
  return [
    C('1.4D', 'B.2.4-1', 1.4, 0, 0, 0),
    C('1.2D + 1.6Lr', 'B.2.4-3', 1.2, 1.6, 0, 0),
    C('1.2D + 1.6Lr + 0.8W (presión)', 'B.2.4-3', 1.2, 1.6, 0.8, q.Wp),
    C('1.2D + 1.6W (presión) + 0.5Lr', 'B.2.4-4', 1.2, 0.5, 1.6, q.Wp),
    C('0.9D + 1.6W (succión)', 'B.2.4-6', 0.9, 0, 1.6, -q.Ws),
  ];
}

// ═══ ACERO ═══
// Ángulo de alas iguales: ala 1 sobre la cubierta (x de 0 a b, y de −t a 0), ala 2 colgando (x de 0 a t, y de −b a −t)
function propsAngulo(b, t){
  const A1 = b * t, A2 = t * (b - t), A = A1 + A2;
  const c = (b * b + b * t - t * t) / (2 * (2 * b - t));
  const xb = c, yb = -c;
  const r1 = { A:A1, x:b / 2, y:-t / 2, Ix:b * t ** 3 / 12, Iy:t * b ** 3 / 12 }, r2 = { A:A2, x:t / 2, y:-t - (b - t) / 2, Ix:t * (b - t) ** 3 / 12, Iy:(b - t) * t ** 3 / 12 };
  const Ix = [r1, r2].reduce((s, r) => s + r.Ix + r.A * (r.y - yb) ** 2, 0), Iy = [r1, r2].reduce((s, r) => s + r.Iy + r.A * (r.x - xb) ** 2, 0);
  const Pxy = [r1, r2].reduce((s, r) => s + r.A * (r.x - xb) * (r.y - yb), 0);
  const Imax = (Ix + Iy) / 2 + Math.hypot((Ix - Iy) / 2, Pxy), Imin = (Ix + Iy) / 2 - Math.hypot((Ix - Iy) / 2, Pxy);
  const pts = [[0, 0], [b, 0], [b, -t], [0, -b], [t, -b]].map(([x, y]) => ({ x:x - xb, y:y - yb }));
  return { tipo:'L', b, t, A, c, Ix, Iy, Pxy, Iw:Imax, Iz:Imin, rx:Math.sqrt(Ix / A), rz:Math.sqrt(Imin / A), pts, kgm:A * 1e-6 * 7850 };
}
// Inercia de la sección con respecto a la dirección u (∫ (r·u)² dA) — para carga en la dirección u
const Iu = (P, ux, uy) => P.Iy * ux * ux + P.Ix * uy * uy + 2 * P.Pxy * ux * uy;
// Momento nominal del ángulo para flexión con módulo Sc (punta a compresión): fluencia 1.5My y pandeo local del ala (F.2.6.10.1 y .3)
function MnAlaAngulo(b, t, Fy, S){
  const lam = b / t, lp = 0.54 * Math.sqrt(E_AC / Fy), lr = 0.91 * Math.sqrt(E_AC / Fy), My = Fy * S;
  let Mlb = Infinity, clase = 'compacta';
  if(lam > lr){ Mlb = 0.71 * E_AC / lam ** 2 * S; clase = 'esbelta'; }
  else if(lam > lp){ Mlb = Fy * S * (2.43 - 1.72 * lam * Math.sqrt(Fy / E_AC)); clase = 'no compacta'; }
  return { My, Mp:1.5 * My, Mlb, Mn:Math.min(1.5 * My, Mlb), lam, lp, lr, clase };
}
function calcAngulo(cor, q, combos, srv, ac){
  const b = num(cor.b), t = num(cor.t), Fy = ac.Fy, P = propsAngulo(b, t), Lmm = q.L * 1000, ap = APOYOS[cor.apoyo] || APOYOS.simple;
  // Direcciones de trabajo: con arriostramiento de la lámina, ejes geométricos (x a lo largo de la cubierta, y normal);
  // sin él, ejes principales del ángulo (a 45°), y se revisa el pandeo lateral-torsional del eje mayor (F.2.6.10.2)
  const restr = cor.arriostre !== false, k = Math.SQRT1_2;
  const dirs = restr ? [{ ux:1, uy:0, nom:'x (a lo largo de la cubierta)' }, { ux:0, uy:1, nom:'y (normal a la cubierta)' }]
                     : [{ ux:k, uy:-k, nom:'w (eje de simetría)' }, { ux:k, uy:k, nom:'z' }];
  dirs.forEach(d => { d.I = Iu(P, d.ux, d.uy); d.cmax = Math.max(...P.pts.map(p => Math.abs(p.x * d.ux + p.y * d.uy))); d.S = d.I / d.cmax; });
  // Capacidad por dirección de carga: la carga en la dirección d flexiona alrededor del eje perpendicular
  dirs.forEach((d, i) => {
    const m = MnAlaAngulo(b, t, Fy, d.S);
    d.My = m.My; d.Mn = m.Mn; d.mAla = m;
    // sin arriostramiento: la carga en la dirección z (perpendicular al eje de simetría w) flexiona alrededor del eje mayor w → pandeo lateral-torsional
    if(!restr && i === 1){
      const Cb = 1.0, Me = 0.46 * E_AC * b * b * t * t * Cb / Lmm, My = Fy * d.S;
      const Mltb = Me <= My ? (0.92 - 0.17 * Me / My) * Me : Math.min((1.92 - 1.17 * Math.sqrt(My / Me)) * My, 1.5 * My);
      d.Me = Me; d.Mltb = Mltb; d.Mn = Math.min(d.Mn, Mltb);
    }
    d.phiMn = 0.9 * d.Mn; d.Fc = d.phiMn / d.S;                             // esfuerzo de capacidad (MPa)
  });
  // Esfuerzos en los 5 puntos de la sección para cada combinación (signo: + compresión). Se prueban los dos sentidos del ala sobre la cubierta.
  let peor = null;
  for(const cb of combos) for(const sx of [1, -1]){
    const qx = sx * cb.t, qy = -cb.n;                                        // n hacia la cubierta = −y
    const parts = dirs.map(d => ({ d, qd:qx * d.ux + qy * d.uy }));
    let rmax = 0, punto = null;
    for(const p of P.pts){
      let r = 0;
      for(const { d, qd } of parts){ const M = ap.cM * qd * Lmm * Lmm; const f = M * (-(p.x * d.ux + p.y * d.uy)) / d.I; r += f / d.Fc; }   // M en N·mm (q en kN/m = N/mm)
      if(Math.abs(r) > Math.abs(rmax)){ rmax = r; punto = p; }
    }
    if(!peor || Math.abs(rmax) > Math.abs(peor.r)) peor = { r:rmax, cb, sx, punto, M:parts.map(x => ({ dir:x.d.nom, M:ap.cM * x.qd * q.L * q.L })) };
  }
  // Cortante (F.2.7.4): Vn = 0.6·Fy·b·t, Cv = 1 (kv = 1.2)
  const cvLim = 1.10 * Math.sqrt(1.2 * E_AC / Fy), Cv = b / t <= cvLim ? 1 : cvLim / (b / t);
  const phiVn = 0.9 * 0.6 * Fy * b * t * Cv / 1000;
  const Vu = Math.max(...combos.map(cb => ap.cV * Math.hypot(cb.n, cb.t) * q.L));
  // Deflexión en servicio: componentes en las direcciones de trabajo
  const defl = srv.map(sv => { const qx = sv.t, qy = -sv.n;
    const dd = dirs.map(d => ap.cD * (qx * d.ux + qy * d.uy) * Lmm ** 4 / (E_AC * d.I)); return { ...sv, delta:Math.hypot(...dd) }; });
  return { P, dirs, restr, peor, Cv, phiVn, Vu, defl, kgm:P.kgm };
}
// Tubo rectangular: H perpendicular a la cubierta, B a lo largo de ella; espesor de diseño 0.93t (F.2.2.4.2)
function propsHSS(H, B, tn){
  const t = 0.93 * tn, Hi = H - 2 * t, Bi = B - 2 * t, A = B * H - Bi * Hi;
  const Ix = (B * H ** 3 - Bi * Hi ** 3) / 12, Iy = (H * B ** 3 - Hi * Bi ** 3) / 12;
  const Zx = B * H * H / 4 - Bi * Hi * Hi / 4, Zy = H * B * B / 4 - Hi * Bi * Bi / 4;
  return { tipo:'HSS', H, B, tn, t, A, Ix, Iy, Sx:Ix / (H / 2), Sy:Iy / (B / 2), Zx, Zy, rx:Math.sqrt(Ix / A), ry:Math.sqrt(Iy / A), kgm:A * 1e-6 * 7850 };
}
// Mn de un tubo rectangular alrededor de un eje: «ala» = pared a compresión de ancho bw, «alma» = paredes de alto hw (F.2.6.7)
function MnHSS(bw, hw, t, I, Z, Fy){
  const S = I / (hw / 2), Mp = Fy * Z, sq = Math.sqrt(E_AC / Fy);
  const lf = (bw - 3 * t) / t, lw = (hw - 3 * t) / t;
  const lpf = 1.12 * sq, lrf = 1.40 * sq, lpw = 2.42 * sq, lrw = 5.70 * sq;
  let Mf = Mp, claseF = 'compacta';
  if(lf > lrf){
    const bf = bw - 3 * t, be = Math.min(bf, 1.92 * t * sq * (1 - 0.38 / lf * sq)), dA = (bf - be) * t, yA = hw / 2 - t / 2;
    const A = (bw * hw - (bw - 2 * t) * (hw - 2 * t)), yc = -dA * yA / (A - dA);
    const Ie = I - dA * yA * yA - (A - dA) * yc * yc, Se = Ie / (hw / 2 + Math.abs(yc));
    Mf = Fy * Se; claseF = 'esbelta';
  } else if(lf > lpf){ Mf = Math.min(Mp, Mp - (Mp - Fy * S) * (3.57 * lf / sq - 4.0)); claseF = 'no compacta'; }
  let Mw = Mp, claseW = 'compacta';
  if(lw > lpw){ Mw = Math.min(Mp, Mp - (Mp - Fy * S) * (0.305 * lw / sq - 0.738)); claseW = lw > lrw ? 'esbelta' : 'no compacta'; }
  return { Mp, S, Mn:Math.min(Mf, Mw), lf, lw, lpf, lrf, lpw, lrw, claseF, claseW };
}
function VnHSS(hw, t, Fy){   // F.2.7.5: Aw = 2·h·t, h = hw − 3t, kv = 5
  const h = hw - 3 * t, l = h / t, kv = 5, s = Math.sqrt(kv * E_AC / Fy);
  const Cv = l <= 1.10 * s ? 1 : l <= 1.37 * s ? 1.10 * s / l : 1.51 * E_AC * kv / (l * l * Fy);
  return { Aw:2 * h * t, Cv, phiVn:0.9 * 0.6 * Fy * 2 * h * t * Cv / 1000, l };
}
function calcHSS(cor, q, combos, srv, ac){
  const P = propsHSS(num(cor.H), num(cor.B), num(cor.tH)), Fy = ac.Fy, ap = APOYOS[cor.apoyo] || APOYOS.simple, Lmm = q.L * 1000;
  const mx = MnHSS(P.B, P.H, P.t, P.Ix, P.Zx, Fy), my = MnHSS(P.H, P.B, P.t, P.Iy, P.Zy, Fy);   // x: carga normal; y: carga tangencial
  const phiMx = 0.9 * mx.Mn / 1e6, phiMy = 0.9 * my.Mn / 1e6;               // kN·m
  let peor = null;
  for(const cb of combos){ const Mx = ap.cM * Math.abs(cb.n) * q.L ** 2, My = ap.cM * Math.abs(cb.t) * q.L ** 2, r = Mx / phiMx + My / phiMy;
    if(!peor || r > peor.r) peor = { r, cb, Mx, My }; }
  const vx = VnHSS(P.H, P.t, Fy), vy = VnHSS(P.B, P.t, Fy);
  const Vn = Math.max(...combos.map(cb => ap.cV * Math.abs(cb.n) * q.L)), Vt = Math.max(...combos.map(cb => ap.cV * Math.abs(cb.t) * q.L));
  const defl = srv.map(sv => ({ ...sv, delta:Math.hypot(ap.cD * sv.n * Lmm ** 4 / (E_AC * P.Ix), ap.cD * sv.t * Lmm ** 4 / (E_AC * P.Iy)) }));
  return { P, mx, my, phiMx, phiMy, peor, vx, vy, Vn, Vt, defl, kgm:P.kgm };
}

// Límites de deflexión: con cielo raso L/360 (viva o viento) y L/240 (total); sin cielo raso L/240 y L/180
const limites = (R, cor) => { const cr = !!R.cielo?.aplica; return { V:num(cor.limV, 0) || (cr ? 360 : 240), T:num(cor.limT, 0) || (cr ? 240 : 180), cielo:cr }; };

function revisarMetal(R, cor, ctx){
  const ac = ACEROS[cor.acero] || ACEROS.A36, esL = cor.sec !== 'HSS';
  const faltan = [];
  if(!(num(cor.s) > 0)) faltan.push('separación entre correas'); if(!(num(cor.L) > 0)) faltan.push('luz de la correa');
  if(esL ? !(num(cor.b) > 0 && num(cor.t) > 0 && num(cor.t) < num(cor.b)) : !(num(cor.H) > 0 && num(cor.B) > 0 && num(cor.tH) > 0)) faltan.push('medidas de la sección');
  if(faltan.length) return { ok:false, faltan };
  const kgm = esL ? propsAngulo(num(cor.b), num(cor.t)).kgm : propsHSS(num(cor.H), num(cor.B), num(cor.tH)).kgm;
  const pp = kgm * G / 1000;
  const q = cargasCorrea(R, cor, ctx, pp);
  if(!q.w.ok) return { ok:false, faltan:(q.w.faltan || []).map(x => 'viento: ' + x) };
  const combos = combosLRFD(q);
  const srv = [
    { nom:'Lr', n:q.Ln, t:q.Lt, lim:'V' }, { nom:'W (presión)', n:q.Wp, t:0, lim:'V' },
    { nom:'D + Lr', n:q.Dn + q.Ln, t:q.Dt + q.Lt, lim:'T' }, { nom:'D + W (presión)', n:q.Dn + q.Wp, t:q.Dt, lim:'T' },
    { nom:'0.6D + W (succión)', n:0.6 * q.Dn - q.Ws, t:0.6 * q.Dt, lim:'T' },
  ];
  const lim = limites(R, cor), Lmm = q.L * 1000;
  const r = esL ? calcAngulo(cor, q, combos, srv, ac) : calcHSS(cor, q, combos, srv, ac);
  const chk = [];
  if(esL){
    const pe = r.peor;
    chk.push({ g:'Flexión', nom:`Flexión biaxial (esfuerzos en la sección)${r.restr ? '' : ', ejes principales'}`, ref:'F.2.6.10 / F.2.8.2', dem:Math.abs(pe.r), cap:1, u:'', dc:Math.abs(pe.r),
      det:`Combinación ${pe.cb.nom}. ${r.dirs.map(d => `Dirección ${d.nom}: I = ${fmt(d.I, 0)} mm⁴, S = ${fmt(d.S, 0)} mm³, My = ${fmt(d.My / 1e6, 3)} kN·m, Mn = ${fmt(d.Mn / 1e6, 3)} kN·m${d.Me ? ` (Me = ${fmt(d.Me / 1e6, 3)}, pandeo lateral-torsional ${fmt(d.Mltb / 1e6, 3)})` : ''}, φMn = ${fmt(d.phiMn / 1e6, 3)} kN·m`).join('. ')}. Σ f/Fc en el punto más esforzado = ${fmt(Math.abs(pe.r), 3)}.` });
    chk.push({ g:'Cortante', nom:'Cortante', ref:'F.2.7.4', dem:r.Vu, cap:r.phiVn, u:'kN', dc:r.Vu / r.phiVn, det:`φVn = 0.9·0.6·Fy·b·t·Cv = 0.9·0.6·${ac.Fy}·${num(cor.b)}·${num(cor.t)}·${fmt(r.Cv, 2)} = ${fmt(r.phiVn, 2)} kN` });
  } else {
    const pe = r.peor;
    chk.push({ g:'Flexión', nom:'Flexión biaxial (interacción)', ref:'F.2.6.7 / F.2.8.1 (H1-1b)', dem:pe.r, cap:1, u:'', dc:pe.r,
      det:`Combinación ${pe.cb.nom}: Mux = ${fmt(pe.Mx, 3)} kN·m, Muy = ${fmt(pe.My, 3)} kN·m; φMnx = ${fmt(r.phiMx, 3)} kN·m (ala ${r.mx.claseF}, alma ${r.mx.claseW}), φMny = ${fmt(r.phiMy, 3)} kN·m (ala ${r.my.claseF}). Mux/φMnx + Muy/φMny = ${fmt(pe.r, 3)}` });
    chk.push({ g:'Cortante', nom:'Cortante normal a la cubierta', ref:'F.2.7.5', dem:r.Vn, cap:r.vx.phiVn, u:'kN', dc:r.Vn / r.vx.phiVn, det:`Aw = 2·h·t = ${fmt(r.vx.Aw, 0)} mm², Cv = ${fmt(r.vx.Cv, 2)}` });
    chk.push({ g:'Cortante', nom:'Cortante a lo largo de la cubierta', ref:'F.2.7.5', dem:r.Vt, cap:r.vy.phiVn, u:'kN', dc:r.Vt / r.vy.phiVn, det:`Aw = ${fmt(r.vy.Aw, 0)} mm², Cv = ${fmt(r.vy.Cv, 2)}` });
  }
  const dV = r.defl.filter(x => x.lim === 'V'), dT = r.defl.filter(x => x.lim === 'T');
  const mV = dV.reduce((a, x) => x.delta > a.delta ? x : a), mT = dT.reduce((a, x) => x.delta > a.delta ? x : a);
  chk.push({ g:'Deflexión', nom:'Deflexión por carga viva o viento', ref:'servicio', dem:mV.delta, cap:Lmm / lim.V, u:'mm', dc:mV.delta / (Lmm / lim.V), det:`${mV.nom}: Δ = ${(APOYOS[cor.apoyo] || APOYOS.simple).txtD} = ${fmt(mV.delta, 1)} mm ≤ L/${lim.V} = ${fmt(Lmm / lim.V, 1)} mm` });
  chk.push({ g:'Deflexión', nom:'Deflexión total', ref:'servicio', dem:mT.delta, cap:Lmm / lim.T, u:'mm', dc:mT.delta / (Lmm / lim.T), det:`${mT.nom}: Δ = ${fmt(mT.delta, 1)} mm ≤ L/${lim.T} = ${fmt(Lmm / lim.T, 1)} mm` });
  const avisos = [];
  if(q.LrBajo) avisos.push(`Lr = ${q.LrA} kN/m² es menor que el mínimo de la Tabla B.4.2.1-2 (${q.LrMin} kN/m²).`);
  if(esL && r.P.b / r.P.t > 0.91 * Math.sqrt(E_AC / ac.Fy)) avisos.push('El ala del ángulo es esbelta (b/t > 0.91√(E/Fy)): pandeo local del ala.');
  if(!esL && (r.mx.claseF === 'esbelta' || r.my.claseF === 'esbelta')) avisos.push('Una pared del tubo es esbelta: se usa el ancho efectivo.');
  return fin({ tipo:'met', ac, esL, q, combos, r, chk, lim, avisos, kgm:r.kgm });
}

// ═══ MADERA (esfuerzos admisibles) ═══
function coefMadera(c){
  const m = MADERAS[c.grupo] || MADERAS.ES4, CHs = num(c.CHs, 12), CHc = num(c.CHc, 12), T = num(c.temp, 25), b = num(c.b), d = num(c.d), L = num(c.L);
  // Humedad (Tabla G.2.2-5): de 12 % a 19 % se interpola hasta el factor de madera húmeda; E se reduce si cualquiera de las dos humedades es alta
  const kS = clamp((CHs - 12) / 7, 0, 1), kE = clamp((Math.max(CHs, CHc) - 12) / 7, 0, 1), red = (f, k) => 1 - k * (1 - f);
  const Cm = { Fb:red(0.8, kS), Ft:red(0.8, kS), Fc:red(0.75, kS), Fp:red(0.6, kS), Fv:red(0.85, kS), E:red(0.85, kE) };
  const iT = T <= 37.8 ? 0 : T <= 51.7 ? 1 : 2, seco = CHs < 12, ctO = seco ? [1, 0.8, 0.7][iT] : [1, 0.7, 0.5][iT], ctE = [1, 0.9, 0.9][iT];
  const Ct = { Fb:ctO, Ft:ctE, Fc:ctO, Fp:ctO, Fv:ctO, E:ctE };
  const inc = !!c.incision, Cin = { Fb:inc ? 0.8 : 1, Ft:inc ? 0.8 : 1, Fc:inc ? 0.8 : 1, Fp:1, Fv:inc ? 0.8 : 1, E:inc ? 0.95 : 1 };
  const S = num(c.s), crOk = !!c.conjunta && S <= 0.61, Cr = crOk ? 1.15 : 1;                 // solo en Fb
  const pend = num(c.AC) > 0 ? num(c.BA) / num(c.AC) : 0, fuera = pend > 1 / 8 + 1e-9;
  const cdgB = pend <= 1/20 ? 1 : pend <= 1/18 ? 0.85 : pend <= 1/16 ? 0.80 : pend <= 1/15 ? 0.76 : pend <= 1/14 ? 0.74 : pend <= 1/12 ? 0.69 : pend <= 1/10 ? 0.61 : 0.53;
  const CF = h => h <= 100 ? 1.15 : h <= 203 ? 1.10 : 1.0;                               // Tabla G.3.3-1, por la altura de la cara a flexión
  const Cl = L > 3 ? Math.pow(3 / L, 0.2) : 1;                                           // coeficiente de longitud (fórmula continua)
  const filas = [[50, 1, 1], [100, 1, 1], [127, 1.05, 1.05], [152, 1.05, 1.05], [200, 1.05, 1.05], [254, 1.10, 1.05]];
  let fila = filas[0]; filas.forEach(f => { if(d >= f[0]) fila = f; }); const Cfu = b <= 75 ? fila[1] : fila[2];
  return { m, Cm, Ct, Cin, Cr, crOk, crPedido:!!c.conjunta, pend, fuera, cdgB, CFx:CF(d), CFy:CF(b), Cl, Cfu, seco, iT };
}
function revisarMadera(R, cor, ctx){
  const faltan = [];
  if(!(num(cor.s) > 0)) faltan.push('separación entre correas'); if(!(num(cor.L) > 0)) faltan.push('luz de la correa');
  if(!(num(cor.b) > 0 && num(cor.d) > 0)) faltan.push('base y altura de la sección');
  if(faltan.length) return { ok:false, faltan };
  const b = num(cor.b), d = num(cor.d), L = num(cor.L), Lmm = L * 1000, ap = APOYOS[cor.apoyo] || APOYOS.simple;
  const k = coefMadera(cor), m = k.m;
  const pp = num(cor.dens, 0) * b * d * 1e-6 * G / 1000;                   // kN/m
  const q = cargasCorrea(R, cor, ctx, pp);
  if(!q.w.ok) return { ok:false, faltan:(q.w.faltan || []).map(x => 'viento: ' + x) };
  const diaf = cor.diafragma !== false, ft = x => diaf ? 0 : x;           // con diafragma, la componente a lo largo de la cubierta la toma la cubierta
  const A = b * d, Ix = b * d ** 3 / 12, Iy = d * b ** 3 / 12, Sx = b * d * d / 6, Sy = d * b * b / 6;
  // Combinaciones de servicio (B.2.3) con su Cd (Tabla G.2.2-3)
  const C = (nom, ref, Cd, fD, fL, fW, W) => ({ nom, ref, Cd, n:fD * q.Dn + fL * q.Ln + fW * W, t:ft(fD * q.Dt + fL * q.Lt) });
  const combos = [
    C('D', 'B.2.3-1', 0.90, 1, 0, 0, 0), C('D + Lr', 'B.2.3-3', 1.25, 1, 1, 0, 0), C('D + W (presión)', 'B.2.3-5', 1.60, 1, 0, 1, q.Wp),
    C('D + 0.75Lr + 0.75W', 'B.2.3-6', 1.60, 1, 0.75, 0.75, q.Wp), C('0.6D + W (succión)', 'B.2.3-7', 1.60, 0.6, 0, 1, -q.Ws),
  ];
  // Estabilidad lateral (G.3.3.4): le con tres tramos; Emin solo para estabilidad
  const lu = (num(cor.lu, 0) > 0 ? num(cor.lu) : L) * 1000, ratio = lu / d;
  const le = ratio < 7 ? 2.06 * lu : ratio <= 14.3 ? 1.63 * lu + 3 * d : 1.84 * lu;
  const RB = Math.sqrt(le * d / (b * b)), EminP = m.Emin * k.Cm.E * k.Ct.E * k.Cin.E, FbE = 1.20 * EminP / (RB * RB);
  const db = d / b, arr = db <= 2 ? 'a' : db <= 4 ? 'b' : db <= 5 ? 'c' : db <= 6 ? 'd' : 'e';
  const fbBase = Cd => m.Fb * Cd * k.Cm.Fb * k.Ct.Fb * k.Cin.Fb * k.Cr * k.cdgB * k.Cl;
  const CLde = Cd => { if(db <= 2 || cor.restr) return 1; const Fs = fbBase(Cd) * k.CFx, a = FbE / Fs, t = (1 + a) / 1.9; return t - Math.sqrt(t * t - a / 0.95); };
  const res = combos.map(cb => {
    const M1 = ap.cM * Math.abs(cb.n) * L * L, M2 = ap.cM * Math.abs(cb.t) * L * L;
    const fb1 = M1 * 1e6 / Sx, fb2 = M2 * 1e6 / Sy, CL = CLde(cb.Cd);
    const Fb1 = fbBase(cb.Cd) * k.CFx * CL, Fb2 = fbBase(cb.Cd) * k.CFy * k.Cfu;
    const inest = fb2 > 0 && fb1 >= FbE;
    const inter = fb2 > 0 ? (inest ? 99 : fb1 / Fb1 + fb2 / (Fb2 * (1 - (fb1 / FbE) ** 2))) : fb1 / Fb1;
    const Fv = m.Fv * cb.Cd * k.Cm.Fv * k.Ct.Fv * k.Cin.Fv;
    const fv1 = 1.5 * ap.cV * Math.abs(cb.n) * L * 1000 / A, fv2 = 1.5 * ap.cV * Math.abs(cb.t) * L * 1000 / A;
    return { ...cb, M1, M2, fb1, fb2, CL, Fb1, Fb2, inest, inter, Fv, fv1, fv2 };
  });
  const cF = res.reduce((a, x) => x.inter > a.inter ? x : a), cV1 = res.reduce((a, x) => x.fv1 / x.Fv > a.fv1 / a.Fv ? x : a), cV2 = res.reduce((a, x) => x.fv2 / x.Fv > a.fv2 / a.Fv ? x : a);
  // Deflexión: E0.5 con acción de conjunto, E0.05 sin ella (modificado por humedad, temperatura e incisiones); deflexión diferida de la carga muerta
  const Ebase = k.crOk ? m.E05 : m.E005, Ep = Ebase * k.Cm.E * k.Ct.E * k.Cin.E;
  const Kcr = num(cor.Kcr, 0) > 0 ? num(cor.Kcr) : (num(cor.CHs, 12) <= 19 ? 1.8 : 2.0);
  const dl = (n, t) => Math.hypot(ap.cD * n * Lmm ** 4 / (Ep * Ix), ap.cD * t * Lmm ** 4 / (Ep * Iy));
  const dD = dl(q.Dn, ft(q.Dt)), dLr = dl(q.Ln, ft(q.Lt)), dW = dl(q.Wp, 0);
  const tot = [{ nom:`${Kcr}·D + Lr`, v:Kcr * dD + dLr }, { nom:`${Kcr}·D + W`, v:Kcr * dD + dW }, { nom:`${Kcr}·D + 0.75(Lr + W)`, v:Kcr * dD + 0.75 * (dLr + dW) }];
  const dT = tot.reduce((a, x) => x.v > a.v ? x : a);
  const lim = limites(R, cor);
  const chk = [
    { g:'Flexión', nom:'Flexión biaxial', ref:'G.3.3 / G.5', dem:cF.inter, cap:1, u:'', dc:cF.inter,
      det:cF.inest ? `Combinación ${cF.nom}: fb1 = ${fmt(cF.fb1, 2)} MPa ≥ FbE = ${fmt(FbE, 2)} MPa → la viga es inestable lateralmente.`
        : `Combinación ${cF.nom} (Cd = ${cF.Cd}): fb1 = ${fmt(cF.fb1, 2)} MPa, F'b1 = ${fmt(cF.Fb1, 2)} MPa (CL = ${fmt(cF.CL, 3)})${cF.fb2 > 0 ? `; fb2 = ${fmt(cF.fb2, 2)} MPa, F'b2 = ${fmt(cF.Fb2, 2)} MPa; fb1/F'b1 + fb2/[F'b2·(1 − (fb1/FbE)²)] = ${fmt(cF.inter, 3)}` : `; fb1/F'b1 = ${fmt(cF.inter, 3)}`}` },
    { g:'Cortante', nom:'Cortante — eje fuerte', ref:'G.3.4', dem:cV1.fv1, cap:cV1.Fv, u:'MPa', dc:cV1.fv1 / cV1.Fv, det:`fv = 1.5·V/(b·d), combinación ${cV1.nom}, F'v = ${fmt(cV1.Fv, 2)} MPa` },
  ];
  if(!diaf) chk.push({ g:'Cortante', nom:'Cortante — eje débil', ref:'G.3.4', dem:cV2.fv2, cap:cV2.Fv, u:'MPa', dc:cV2.fv2 / cV2.Fv, det:`Combinación ${cV2.nom}` });
  chk.push({ g:'Deflexión', nom:'Deflexión — carga viva Lr', ref:'G.3.2', dem:dLr, cap:Lmm / lim.V, u:'mm', dc:dLr / (Lmm / lim.V), det:`E' = ${fmt(Ep, 0)} MPa, límite L/${lim.V}` });
  chk.push({ g:'Deflexión', nom:'Deflexión — viento W', ref:'G.3.2', dem:dW, cap:Lmm / lim.V, u:'mm', dc:dW / (Lmm / lim.V), det:`Límite L/${lim.V}` });
  chk.push({ g:'Deflexión', nom:'Deflexión total (con deflexión diferida)', ref:'G.3.2', dem:dT.v, cap:Lmm / lim.T, u:'mm', dc:dT.v / (Lmm / lim.T), det:`${dT.nom}: ΔD = ${fmt(dD, 1)} mm × ${Kcr} (diferida) → ${fmt(dT.v, 1)} mm ≤ L/${lim.T} = ${fmt(Lmm / lim.T, 1)} mm` });
  chk.push({ g:'Estabilidad', nom:'Esbeltez lateral RB ≤ 50', ref:'G.3.3.4', dem:RB, cap:50, u:'', dc:RB / 50, det:`le = ${fmt(le, 0)} mm, RB = √(le·d/b²) = ${fmt(RB, 1)}` });
  if(k.fuera) chk.push({ g:'Material', nom:'Desviación del grano dentro de la Tabla G.2.2-9', ref:'G.2.2.3.7', dem:k.pend, cap:1 / 8, u:'', dc:k.pend * 8, det:`Pendiente BA/AC = ${fmt(k.pend, 3)} > 1/8: fuera de tabla, la pieza no es apta sin ensayo.` });
  const avisos = [];
  if(q.LrBajo) avisos.push(`Lr = ${q.LrA} kN/m² es menor que el mínimo de la Tabla B.4.2.1-2 (${q.LrMin} kN/m²).`);
  if(k.crPedido && !k.crOk) avisos.push('Se marcó acción de conjunto, pero la separación es mayor de 0.61 m: no se aplica Cr.');
  if(Lmm / d > 20) avisos.push(`Relación l/d = ${fmt(Lmm / d, 1)} > 20: la pieza es muy esbelta para correa (G.3.2.4).`);
  if(diaf) avisos.push('La cubierta (entablado o lámina fijada) toma la componente de la carga a lo largo de la pendiente.');
  return fin({ tipo:'mad', k, q, combos:res, chk, lim, avisos, props:{ A, Ix, Iy, Sx, Sy }, le, RB, FbE, EminP, Ep, Ebase, Kcr, dD, dLr, dW, arr, txtArr:TXT_ARRIOSTRE[arr], kgm:pp / G * 1000 });
}

function fin(o){
  o.chk.forEach(c => { c.ok = c.dc <= 1 + 1e-9; });
  o.ok = true; o.max = Math.max(...o.chk.map(c => c.dc)); o.nOk = o.chk.filter(c => c.ok).length; o.nNo = o.chk.length - o.nOk; o.cumple = o.nNo === 0;
  return o;
}
const fmt = (x, d = 2) => (x == null || !isFinite(x)) ? '—' : Number(x).toLocaleString('es-CO', { minimumFractionDigits:d, maximumFractionDigits:d });

function revisar(R, cor, ctx){ return cor.mat === 'mad' ? revisarMadera(R, cor, ctx) : revisarMetal(R, cor, ctx); }

// 💡 Sugerencias: sección más liviana que cumple (misma familia), separación máxima y apoyo intermedio; todo recalculado con las mismas cargas
function sugerir(R, cor, ctx){
  const out = [], prueba = c => { const r = revisar(R, c, ctx); return r.ok ? r : null; };
  if(cor.mat === 'mad'){
    for(const [b, d] of CAT_MAD){ const r = prueba({ ...cor, b, d }); if(r?.cumple){ out.push({ txt:`Sección ${b} × ${d} mm`, dc:r.max, cambio:{ b, d } }); break; } }
  } else if(cor.sec === 'HSS'){
    const ord = CAT_HSS.map(([H, B, t]) => ({ H, B, t, kg:propsHSS(H, B, t).kgm })).sort((a, b) => a.kg - b.kg);
    for(const x of ord){ const r = prueba({ ...cor, H:x.H, B:x.B, tH:x.t }); if(r?.cumple){ out.push({ txt:`Tubo ${x.H} × ${x.B} × ${x.t} mm (${fmt(x.kg, 2)} kg/m)`, dc:r.max, cambio:{ H:x.H, B:x.B, tH:x.t } }); break; } }
  } else {
    const ord = CAT_L.map(([b, t]) => ({ b, t, kg:propsAngulo(b, t).kgm })).sort((a, b) => a.kg - b.kg);
    for(const x of ord){ const r = prueba({ ...cor, b:x.b, t:x.t }); if(r?.cumple){ out.push({ txt:`Ángulo L ${x.b} × ${x.t} mm (${fmt(x.kg, 2)} kg/m)`, dc:r.max, cambio:{ b:x.b, t:x.t } }); break; } }
    if(cor.arriostre === false){ const r = prueba({ ...cor, arriostre:true }); if(r?.cumple) out.push({ txt:'Fijar la lámina al ala para que arriostre la correa', dc:r.max, cambio:{ arriostre:true } }); }
  }
  // separación máxima que cumple (bisección)
  let lo = 0.2, hi = num(cor.s);
  if(prueba({ ...cor, s:lo })?.cumple){ for(let i = 0; i < 18; i++){ const mid = (lo + hi) / 2; if(prueba({ ...cor, s:mid })?.cumple) lo = mid; else hi = mid; }
    const sMax = Math.floor(lo * 100) / 100; if(sMax < num(cor.s)) out.push({ txt:`Reducir la separación entre correas a ${fmt(sMax, 2)} m`, cambio:{ s:sMax } }); }
  const r2 = prueba({ ...cor, L:num(cor.L) / 2 }); if(r2?.cumple) out.push({ txt:`Poner un apoyo intermedio (luz ${fmt(num(cor.L) / 2, 2)} m)`, dc:r2.max, cambio:{ L:num(cor.L) / 2 } });
  return out;
}

const api = { G, ACEROS, ACEROS_L, ACEROS_HSS, APOYOS, MADERAS, TXT_ARRIOSTRE, GCP, CAT_L, CAT_HSS, CAT_MAD, defaults, nuevaCorrea, cargasArea, LrMin, geomViento, vientoCorrea,
  cargasCorrea, combosLRFD, propsAngulo, propsHSS, MnHSS, coefMadera, revisar, revisarMetal, revisarMadera, sugerir, limites, num, fmt };
if(typeof module !== 'undefined') module.exports = api; else root.Correas = api;
})(typeof window !== 'undefined' ? window : globalThis);
