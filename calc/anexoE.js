/* ═══ Anexo E — Conexiones metálicas (NSR-10 Título F.2 y Título C, Apéndice C-D). Cálculo puro. ═══
   Unidades internas: N, mm, MPa. Cargas de entrada en kN y kN·m.
   Decisiones de Amo (28-oct-2026): opción A (catálogo + edición sobre el dibujo), etiqueta «Conexión X a Y»,
   correcciones aprobadas a sus Excel: P1–P12 (placa base y anclajes), V1–V9 (viga–columna a momento), S1–S5 (soldaduras);
   soldaduras de filete por el método de la línea (formas de las Tablas 2 y 3 de Ringegni + a tope), criterio NSR-10:
   φ·0.60·FEXX sobre la garganta (φ = 0.75), sin el aumento por dirección (del lado seguro). */
(function(root){
'use strict';
const num = (v, d=0) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : d; };
const E = 200000;

// ── Tablas ──
// Pernos: [diámetro mm, área nominal Ab, área efectiva a tensión At] (tabla de Amo, A325)
const PERNOS = { '1/2"':[12.7,126.7,91.5], '5/8"':[15.88,197.9,145.8], '3/4"':[19.05,285,215.5], '7/8"':[22.23,387.9,298.1], '1"':[25.4,506.7,391], '1-1/8"':[28.58,641.3,492.3], '1-1/4"':[31.75,791.7,625.2] };
// Pernos estructurales (Tabla F.2.10.3-2): Fnt, Fnv sin rosca en el plano de corte, Fnv con rosca
const TIPOS_PERNO = { A307:[310,165,165], A325:[620,413,330], A490:[778,516,413] };
// Barras de anclaje: fya, futa [MPa]
const ANCLAJES = { 'A36':[250,400], 'F1554 Gr 36':[248,400], 'F1554 Gr 55':[380,517], 'F1554 Gr 105':[724,862] };
const ACEROS = { 'A36':[250,400], 'A572 Gr 50':[345,450], 'A500 Gr C':[345,427] };
const ELECTRODOS = { E60XX:413.7, E70XX:482.6 };
// Distancia mínima al borde (Tabla F.2.10.3-4, bordes laminados / cortados con soplete) [mm]
const BORDE_MIN = { '1/2"':19, '5/8"':22, '3/4"':25, '7/8"':29, '1"':32, '1-1/8"':38, '1-1/4"':41 };
const perno = d => PERNOS[d] || PERNOS['1/2"'];
// Tamaño mínimo del filete según la parte más delgada (Tabla F.2.10.2-4) y máximo en bordes (F.2.10.2.2)
const filMin = t => t <= 6 ? 3 : t <= 13 ? 5 : t <= 19 ? 6 : 8;
const filMax = t => t < 6 ? t : t - 2;
const chk = (n, ref, dem, cap, u, extra={}) => ({ n, ref, dem, cap, u, r: cap > 0 ? dem/cap : (dem > 0 ? 9 : 0), ...extra });

// ══════════ Soldaduras de filete: método de la línea ══════════
// Formas: segmentos [x1,y1,x2,y2] en mm (b en x, d en y), origen en la esquina inferior izquierda
const FORMAS = {
  '1':{ n:'1 cordón', au:'d', ju:'d³/12', seg:(b, d) => [[0,0,0,d]] },
  '2':{ n:'2 cordones paralelos', au:'2d', ju:'d(3b² + d²)/6', seg:(b, d) => [[0,0,0,d],[b,0,b,d]] },
  '3':{ n:'2 cordones transversales', au:'2b', ju:'b(b² + 3d²)/6', seg:(b, d) => [[0,0,b,0],[0,d,b,d]] },
  'L':{ n:'En L', au:'b + d', ju:'[(b+d)⁴ − 6b²d²] / [12(b+d)]', seg:(b, d) => [[0,d,b,d],[0,0,0,d]] },
  'C':{ n:'En C', au:'2b + d', ju:'(2b+d)³/12 − b²(b+d)²/(2b+d)', seg:(b, d) => [[0,0,b,0],[0,0,0,d],[0,d,b,d]] },
  'U':{ n:'En U (∏)', au:'b + 2d', ju:'(b+2d)³/12 − d²(b+d)²/(b+2d)', seg:(b, d) => [[0,d,b,d],[0,0,0,d],[b,0,b,d]] },
  'O':{ n:'Perímetro rectangular', au:'2b + 2d', ju:'(b+d)³/6', seg:(b, d) => [[0,0,b,0],[b,0,b,d],[b,d,0,d],[0,d,0,0]] },
  'I':{ n:'Perfil I (alas + alma)', au:'2b + 2d', ju:'(b³ + 3bd² + d³)/6', seg:(b, d) => [[0,0,b,0],[0,d,b,d],[b/2-3,0,b/2-3,d],[b/2+3,0,b/2+3,d]] },
  'c':{ n:'Circular (tubo)', au:'π·d', ju:'π·d³/4', seg:(b, d) => { const r = d/2, o = []; for(let i = 0; i < 48; i++){ const a1 = i/48*2*Math.PI, a2 = (i+1)/48*2*Math.PI; o.push([r + r*Math.cos(a1), r + r*Math.sin(a1), r + r*Math.cos(a2), r + r*Math.sin(a2)]); } return o; } },
  'T':{ n:'A tope (penetración completa)', au:'L', ju:'—', seg:(b, d) => [[0,0,0,d]] },
  // Formas que dependen del perfil (decisión de Amo 28-oct: solo se ofrecen las que tienen sentido para el elemento)
  'Ia':{ n:'Solo alas (perfil I)', au:'4b − 2tw', ju:'—', seg:(b, d) => [[0,0,b,0],[0,d,b,d],[0,5,b/2-3,5],[b/2+3,5,b,5],[0,d-5,b/2-3,d-5],[b/2+3,d-5,b,d-5]] },
  'Iw':{ n:'Solo alma, a ambos lados (perfil I)', au:'2(d − 2tf)', ju:'—', seg:(b, d) => [[b/2-3,0,b/2-3,d],[b/2+3,0,b/2+3,d]] },
  'Hd':{ n:'Dos lados de altura H (tubo)', au:'2H', ju:'H(3B² + H²)/6', seg:(b, d) => [[0,0,0,d],[b,0,b,d]] },
  'Hb':{ n:'Dos lados de ancho B (tubo)', au:'2B', ju:'B(B² + 3H²)/6', seg:(b, d) => [[0,0,b,0],[0,d,b,d]] },
};
// Formas posibles según el elemento soldado
const FORMAS_EL = { I:['I','Ia','Iw','T'], HSS:['O','Hd','Hb','T'], BAR:['c','T'], PL:['1','2','3','L','C','U','O','T'] };
// Segmentos con las medidas reales del perfil (sec de AnexoD: I {b,h,tw,tf} · HSS {B,H} · BAR {d}); sin perfil = platina con b, d
function segPerfil(forma, sec, b, d){
  if(sec?.tipo === 'I'){
    const B = sec.b, H = sec.h, tw = sec.tw, tf = sec.tf, a = (B - tw)/2, all = contornoI(B, H, tw, tf);
    if(forma === 'Ia') return all.slice(0, 6);
    if(forma === 'Iw') return all.slice(6);
    if(forma === 'T') return [[0,0,B,0],[0,H,B,H],[B/2,tf,B/2,H-tf]];   // a tope: alas + alma (línea media)
    return all;
  }
  if(sec?.tipo === 'HSS') return (FORMAS[forma === 'T' ? 'O' : forma] || FORMAS.O).seg(sec.B, sec.H);
  if(sec?.tipo === 'BAR') return FORMAS.c.seg(0, sec.d);
  return (FORMAS[forma] || FORMAS.L).seg(b, d);
}
// Contorno real de un perfil I (alas por fuera y por dentro + alma por ambos lados), para columna–placa (S2)
function contornoI(bf, d, tw, tf){
  const o = [[0,0,bf,0],[0,d,bf,d]], a = (bf - tw)/2;
  o.push([0,tf,a,tf],[a+tw,tf,bf,tf],[0,d-tf,a,d-tf],[a+tw,d-tf,bf,d-tf]);
  o.push([a,tf,a,d-tf],[a+tw,tf,a+tw,d-tf]);
  return o;
}
// Propiedades de un grupo de líneas: A [mm], centroide, Ix, Iy [mm³], J = Ix + Iy (S3)
function propLineas(seg){
  let A = 0, sx = 0, sy = 0;
  for(const [x1,y1,x2,y2] of seg){ const L = Math.hypot(x2-x1, y2-y1); A += L; sx += L*(x1+x2)/2; sy += L*(y1+y2)/2; }
  const xg = sx/A, yg = sy/A; let Ix = 0, Iy = 0;
  for(const [x1,y1,x2,y2] of seg){ const L = Math.hypot(x2-x1, y2-y1), dx = x2-x1, dy = y2-y1, cx = (x1+x2)/2 - xg, cy = (y1+y2)/2 - yg;
    Ix += L*(cy*cy + dy*dy/12); Iy += L*(cx*cx + dx*dx/12); }
  return { A, xg, yg, Ix, Iy, J:Ix + Iy };
}
// Esfuerzos en cada extremo de segmento (N/mm de cordón):
// en el plano: H (x), V (y), T torsión; fuera del plano: N, Mx (alrededor de x), My (alrededor de y)
function soldadura(s){
  const fm = FORMAS[s.forma] || FORMAS.L, w = num(s.w, 6), Fexx = ELECTRODOS[s.electrodo] || ELECTRODOS.E70XX;
  const b = num(s.b, 100), d = num(s.d, 150), t = num(s.t, 9.5), ac = ACEROS[s.acero] || ACEROS.A36;
  const seg = s.seg || fm.seg(b, d), P = propLineas(seg);
  const k = 1000, H = num(s.H)*k, V = num(s.V)*k, N = num(s.N)*k, T = num(s.T)*1e6, Mx = num(s.Mx)*1e6, My = num(s.My)*1e6;
  const pts = []; for(const [x1,y1,x2,y2] of seg){ pts.push([x1,y1],[x2,y2]); }
  let peor = null;
  for(const [x, y] of pts){
    const dx = x - P.xg, dy = y - P.yg;
    const fx = H/P.A - T*dy/P.J, fy = V/P.A + T*dx/P.J, fz = N/P.A + (P.Ix > 0 ? Mx*dy/P.Ix : 0) + (P.Iy > 0 ? My*dx/P.Iy : 0);
    const f = Math.hypot(fx, fy, fz);
    if(!peor || f > peor.f) peor = { x, y, fx, fy, fz, f };
  }
  if(s.forma === 'T'){   // a tope de penetración completa: controla el metal base (Tabla F.2.10.2-5); esfuerzos de la línea / espesor
    const sig = Math.abs(peor.fz)/t, tau = Math.hypot(peor.fx, peor.fy)/t;
    const c1 = chk('Tensión o compresión normal al cordón (metal base, φ = 0.90)', 'F.2.10.2-5', sig, 0.9*ac[0], 'MPa');
    const c2 = chk('Cortante (metal base, φ = 1.00)', 'F.2.10.2-5', tau, 1.0*0.6*ac[0], 'MPa');
    const ratio = Math.max(c1.r, c2.r);
    return { ok:true, forma:'T', P, seg, peor, checks:[c1, c2], ratio, cumple:ratio <= 1, wReq:null, b, d, t, w, sig, tau };
  }
  const phiRn = 0.75*0.6*Fexx;                        // MPa sobre la garganta
  const garg = 0.707*w, esf = peor.f/garg;            // MPa
  const wReq = peor.f/(0.707*phiRn);
  const base = 0.75*0.6*ac[1]*t;                      // N/mm: rotura por cortante del metal base junto al cordón
  const checks = [
    chk('Resistencia del cordón (φ·0.60·FEXX sobre la garganta)', 'F.2.10.2.4', esf, phiRn, 'MPa'),
    chk('Metal base junto al cordón (rotura por cortante)', 'F.2.10.4.2', peor.f, base, 'N/mm'),
    chk(`Tamaño mínimo del filete (espesor ${t} mm)`, 'Tabla F.2.10.2-4', filMin(t), w, 'mm', { soloOk:true }),
    chk('Tamaño máximo del filete en el borde', 'F.2.10.2.2', w, filMax(t), 'mm', { soloOk:true }),
  ];
  const ratio = Math.max(...checks.map(c => c.r));
  return { ok:true, forma:s.forma, P, seg, peor, esf, phiRn, wReq, checks, ratio, cumple:ratio <= 1 + 1e-9, b, d, t, w, Fexx };
}

// ══════════ Placa base y pernos de anclaje (AISC Guía de diseño 1 + NSR-10 C-D) ══════════
// c: { bf, d, tw, tf (columna) [mm], N, B, tp [mm] placa (N en el sentido de d), aceroPlaca,
//      Lp, Wp [mm] pedestal (Lp en el sentido de N), ha [mm] altura del pedestal, fc,
//      perno, anclaje (acero), nB (pernos por fila, 2–4), S1 (entre filas, sentido N), S2 (entre pernos extremos de la fila, sentido B),
//      hef, arandela [mm] (lado), cabeza 'tuerca'|'gancho', eh [mm] (gancho), fisurado (bool), mortero (bool),
//      w (pierna soldadura columna–placa), electrodo }
// Fuerzas por fila: { P (kN, + compresión), Mn (kN·m, flexión en el sentido de N), Mb (en el sentido de B), Vn, Vb (kN), c, F, j }
function placaBase(c, filas){
  const bf = num(c.bf, 200), d = num(c.d, 190), tw = num(c.tw, 6.5), tf = num(c.tf, 10);
  const N = num(c.N, 290), B = num(c.B, 250), tp = num(c.tp, 9.5), Fyp = (ACEROS[c.aceroPlaca] || ACEROS.A36)[0];
  const Lp = num(c.Lp, 400), Wp = num(c.Wp, 400), ha = num(c.ha, 1180), fc = num(c.fc, 21);
  const [da, Ab, Ase] = perno(c.perno), [fya, futa0] = ANCLAJES[c.anclaje] || ANCLAJES.A36, futa = Math.min(futa0, 1.9*fya, 860);
  const nB = Math.max(2, Math.round(num(c.nB, 2))), n = 2*nB, S1 = num(c.S1, 240), S2 = num(c.S2, 106), hef0 = num(c.hef, 500);
  const fis = c.fisurado !== false, psiC = fis ? 1.0 : 1.25, psiCP = fis ? 1.0 : 1.4, psiCV = fis ? 1.0 : 1.4;
  if(!filas?.length) return { ok:false, error:'Faltan las cargas (reacciones del modelo o escritas a mano).' };
  // Distancias de los pernos al borde del pedestal
  const caN = (Lp - S1)/2, caB = (Wp - S2)/2, a = (N - S1)/2, aB = (B - S2)/2;
  // P1 — aplastamiento máximo del concreto
  const A1 = N*B, A2 = Lp*Wp, fpMax = 0.65*0.85*fc*Math.min(Math.sqrt(A2/A1), 2);
  // Voladizos (P3)
  const m = (N - 0.95*d)/2, nv = (B - 0.8*bf)/2, lnp = Math.sqrt(d*bf)/4, l = Math.max(m, nv, lnp);
  // Revisión de una dirección: dimensión D en el sentido del momento, ancho W, distancia del eje a la fila de pernos f
  const dir = (P, M, D, W, Sx, aE, dcol, tfc) => {
    const e = P > 0 ? M/P : Infinity, q = fpMax*W, ecrit = P > 0 ? D/2 - P/(2*q) : -Infinity;    // P2 (con D = N)
    const f = Sx/2;
    let Y, Tu = 0, fp, caso, a1 = null, a2 = null, okY = true;
    if(P <= 0){ caso = 'levantamiento'; Y = 0; fp = 0; Tu = Math.abs(P)/2 + M/(2*f); }
    else if(e <= ecrit){ caso = 'momento pequeño'; Y = D - 2*e; fp = P/(W*Y); }
    else { caso = 'momento grande'; a1 = (f + D/2)**2; a2 = 2*P*(e + f)/q; okY = a1 >= a2;
      Y = okY ? (f + D/2) - Math.sqrt(a1 - a2) : D; Tu = Math.max(0, q*Y - P); fp = fpMax; }                // P4
    // Espesor requerido (fase de compresión y de tensión)
    const lc = D === N ? Math.max(m, nv, lnp) : Math.max((B - 0.95*d)/2, (N - 0.8*bf)/2, lnp);
    const lm = D === N ? m : (W - 0.8*bf)/2 > 0 ? (D - 0.8*bf)/2 : m;
    let tReqC = 0;
    if(fp > 0) tReqC = Y >= lc ? 1.5*lc*Math.sqrt(fp/Fyp) : 2.11*Math.sqrt(fp*Y*(lc - Y/2)/Fyp);
    const x = f - dcol/2 + tfc/2, tReqT = Tu > 0 ? 2.11*Math.sqrt(Tu*Math.max(x, 0)/(W*Fyp)) : 0;
    return { e, q, ecrit, f, Y, Tu, fp, caso, a1, a2, okY, tReq:Math.max(tReqC, tReqT), tReqC, tReqT, x };
  };
  // Concreto a tensión de un grupo de pernos (P6) — pernos en tensión: una fila (momento) o todos (levantamiento)
  const breakout = (todos, sentido) => {
    // bordes: en el sentido de N (caN a ambos lados de la fila) y de B (caB)
    const cas = [caN, caN, caB, caB], cerca = cas.filter(x => x < 1.5*hef0).length;
    let hef = hef0; if(cerca >= 3) hef = Math.min(hef0, Math.max(Math.max(...cas)/1.5, (todos ? Math.max(S1, S2) : S2)/3));
    const s1 = todos ? S1 : 0, s2 = S2;
    const ANc = (Math.min(caN, 1.5*hef)*2 + s1)*(Math.min(caB, 1.5*hef)*2 + s2), ANco = 9*hef*hef;
    const nt = todos ? n : nB;
    const caMin = Math.min(caN, caB), psiEd = Math.min(1, 0.7 + 0.3*caMin/(1.5*hef)), psiEc = 1;        // tensión simétrica en el grupo
    const Nb = hef >= 280 && hef <= 635 ? Math.min(10*Math.sqrt(fc)*hef**1.5, 3.9*Math.sqrt(fc)*hef**(5/3)) : 10*Math.sqrt(fc)*hef**1.5;
    const Ncbg = Math.min(ANc/ANco, nt)*psiEc*psiEd*psiC*Nb;
    return { hef, ANc, ANco, nt, psiEd, psiEc, psiC, Nb, Ncbg, phiN:0.70*Ncbg };
  };
  // Extracción del perno (P7)
  const Abrg = Math.max(num(c.arandela, 50)**2 - Ab, 0);
  const Np = c.cabeza === 'gancho' ? 0.9*fc*num(c.eh, 4.5*da)*da : 8*Abrg*fc;
  const phiNpn = 0.70*psiCP*Np;
  // Acero (P8): tensión y cortante
  const phiNsa = 0.75*Ase*futa, phiVsa = 0.65*0.6*Ase*futa*(c.mortero ? 0.8 : 1);
  // Cortante: arrancamiento del borde (P9) y desprendimiento (P10), en cada sentido
  const cortBorde = (ca1, ca2, sAc, nfila) => {
    const le = Math.min(hef0, 8*da), Vb = Math.min(0.6*(le/da)**0.2*Math.sqrt(da)*Math.sqrt(fc)*ca1**1.5, 3.7*Math.sqrt(fc)*ca1**1.5);
    const Avc = (Math.min(1.5*ca1, ca2) + sAc + Math.min(1.5*ca1, ca2))*Math.min(1.5*ca1, ha), Avco = 4.5*ca1*ca1;
    const psiEdV = ca2 >= 1.5*ca1 ? 1 : 0.7 + 0.3*ca2/(1.5*ca1), psiHV = Math.max(1, Math.sqrt(1.5*ca1/ha));
    const Vcbg = Math.min(Avc/Avco, nfila)*psiEdV*psiCV*psiHV*Vb;
    return { ca1, ca2, le, Vb, Avc, Avco, psiEdV, psiHV, Vcbg, phiV:0.70*Vcbg };
  };
  const vN = cortBorde(caN, caB, S2, nB), vB = cortBorde(caB, caN, S1, 2);    // cortante en el sentido de N (hacia el borde del lado N) y de B
  const bTodos = breakout(true), kcp = hef0 < 65 ? 1 : 2, phiVcp = 0.70*kcp*bTodos.Ncbg;
  // Revisión de cada combinación
  let peor = null;
  const res = [];
  for(const fl of filas){
    const P = num(fl.P)*1000, Mn = Math.abs(num(fl.Mn))*1e6, Mb = Math.abs(num(fl.Mb))*1e6, Vn = Math.abs(num(fl.Vn))*1000, Vb = Math.abs(num(fl.Vb))*1000;
    const rN = dir(P, Mn, N, B, S1, a, d, tf), rB = dir(P, Mb, B, N, S2, aB, bf, tf);
    // Tensión en pernos: suma de las dos direcciones (del lado seguro) y levantamiento
    const TuGrupo = rN.Tu + rB.Tu, todos = P <= 0 || (rN.Tu > 0 && rB.Tu > 0);
    const ntPernos = todos ? n : nB, Tr = TuGrupo/ntPernos;
    const bo = breakout(todos);
    const tReq = Math.max(rN.tReq, rB.tReq);
    const Vu = Math.hypot(Vn, Vb);
    const phiVn = Math.min(n*phiVsa, phiVcp, Vn >= Vb ? vN.phiV : vB.phiV);
    const bN = Vn/vN.phiV >= Vb/vB.phiV;   // el borde que controla: cada sentido con su propia capacidad
    const phiNn = Math.min(ntPernos*phiNsa, bo.phiN, ntPernos*phiNpn);
    // P11 — interacción (C-D.7): si una relación ≤ 0.2 no hay interacción; si no, N/φNn + V/φVn ≤ 1.2
    const rT = TuGrupo/phiNn, rV = Math.max(Vu/Math.min(n*phiVsa, phiVcp), Vn/vN.phiV, Vb/vB.phiV), inter = rT <= 0.2 ? rV : rV <= 0.2 ? rT : (rT + rV)/1.2;
    const fpU = Math.max(rN.fp, rB.fp);
    const cks = {
      apl: chk('Aplastamiento del concreto bajo la placa', 'F.2.10.8 / C.10.14', fpU, fpMax, 'MPa'),
      geo: chk('Longitud de apoyo (momento grande: a₁ ≥ a₂)', 'Guía de diseño 1', rN.okY && rB.okY ? 0 : 2, 1, '', { soloOk:true }),
      tp: chk(`Espesor de la placa (colocada ${tp} mm)`, 'Guía de diseño 1', (tReq/tp)**2, 1, '', { req:tReq }),
      ten: chk('Tensión en el acero del perno', 'C-D.5.1', Tr, phiNsa, 'N'),
      cono: chk('Arrancamiento del concreto a tensión (cono)', 'C-D.5.2', TuGrupo, bo.phiN, 'N'),
      pull: chk('Extracción del perno (pullout)', 'C-D.5.3', Tr, phiNpn, 'N'),
      vs: chk('Cortante en el acero de los pernos', 'C-D.6.1', Vu, n*phiVsa, 'N'),
      vb: chk(`Cortante: arrancamiento del borde del concreto (sentido ${bN ? 'N' : 'B'})`, 'C-D.6.2', bN ? Vn : Vb, bN ? vN.phiV : vB.phiV, 'N'),
      vcp: chk('Cortante: desprendimiento por palanca (pryout)', 'C-D.6.3', Vu, phiVcp, 'N'),
      int: chk('Interacción tensión – cortante', 'C-D.7', inter, 1, ''),
    };
    const rmax = Math.max(...Object.values(cks).map(x => x.r));
    const fila = { fl, P, Mn, Mb, Vn, Vb, rN, rB, TuGrupo, Tr, todos, ntPernos, bo, tReq, Vu, phiVn, phiNn, rT, rV, inter, cks, rmax };
    res.push(fila); if(!peor || rmax > peor.rmax) peor = fila;
  }
  // Por chequeo, la combinación que controla
  const checks = {};
  for(const f of res) for(const [k, v] of Object.entries(f.cks)) if(!checks[k] || v.r > checks[k].r) checks[k] = { ...v, fila:f };
  // P12 — distancias mínimas (avisos) y soldadura columna–placa (S2: contorno real del perfil I)
  const avisos = [];
  if(Math.min(caN, caB) < 6*da) avisos.push(`Distancia del perno al borde del pedestal ${Math.min(caN, caB).toFixed(0)} mm < 6·da = ${(6*da).toFixed(0)} mm (C-D.8.2, pernos que se aprietan): revisa el recubrimiento o separa los pernos.`);
  if(Math.min(a, aB) < 1.5*da) avisos.push(`Distancia del perno al borde de la placa ${Math.min(a, aB).toFixed(0)} mm < 1.5·d = ${(1.5*da).toFixed(0)} mm.`);
  if(Math.min(S1, S2) < 4*da) avisos.push(`Separación entre pernos ${Math.min(S1, S2).toFixed(0)} mm < 4·da = ${(4*da).toFixed(0)} mm (C-D.8.1).`);
  if(hef0 > ha - 50) avisos.push(`La longitud de anclaje hef = ${hef0} mm no cabe en el pedestal (altura ${ha} mm).`);
  if(peor.bo.hef < hef0 - 1) avisos.push(`Por la cercanía a los bordes, el cono se calcula con h'ef = ${peor.bo.hef.toFixed(0)} mm en vez de ${hef0} mm (C-D.5.2.3).`);
  // Reventón lateral (si ca < 0.4 hef)
  const caMin = Math.min(caN, caB);
  if(caMin < 0.4*hef0 && c.cabeza !== 'gancho'){
    const Nsb = 13*caMin*Math.sqrt(Abrg)*Math.sqrt(fc), fT = res.reduce((m, f) => f.Tr > m.Tr ? f : m, res[0]);
    checks.sb = chk('Reventón lateral del concreto', 'C-D.5.4', fT.Tr, 0.70*Nsb, 'N', { fila:fT, Nsb });
  }
  let sold = null;
  if(num(c.w) > 0){
    let pw = null;
    for(const f of res){
      const sw = soldadura({ forma:'I', seg:contornoI(bf, d, tw, tf), w:c.w, electrodo:c.electrodo, t:Math.min(tp, tf), acero:c.aceroPlaca,
        N:-f.P/1000, Mx:f.Mn/1e6, My:f.Mb/1e6, V:f.Vn/1000, H:f.Vb/1000 });
      if(!sold || sw.ratio > sold.ratio){ sold = sw; pw = f; }
    }
    checks.sold = chk('Soldadura columna – placa (contorno del perfil)', 'F.2.10.2.4', sold.ratio, 1, '', { fila:pw });
  }
  const ratio = Math.max(...Object.values(checks).map(x => x.r));
  return { ok:true, tipo:'placa', bf, d, tw, tf, N, B, tp, Fyp, Lp, Wp, ha, fc, da, Ab, Ase, futa, fya, nB, n, S1, S2, hef:hef0, caN, caB, a, aB,
    A1, A2, fpMax, m, nv, lnp, l, Abrg, Np, phiNpn, phiNsa, phiVsa, vN, vB, kcp, phiVcp, bTodos, psiC, fis, res, peor, checks, avisos, sold, ratio, cumple:ratio <= 1 + 1e-9 };
}

// ══════════ Viga – columna a momento: cubrejuntas pernadas + cartela a cortante ══════════
// c: { viga:{h,b,tw,tf,r}, col:{h,b,tw,tf,r}, aceroViga, aceroCol,
//      pl:{L,b,t,acero}, pc:{d,tipo,rosca(bool),nf (filas a lo ancho),nc (pernos por fila),s,le,g,lu (cara de la columna al primer perno)},
//      ct:{h,b,t,acero,d,tipo,rosca,n,s,le,e (línea de pernos a la soldadura)}, wPl, wCt, electrodo }
// Fuerzas por fila: { M (kN·m), V (kN), P (kN, + tensión) }
function vigaColumna(c, filas){
  const vg = c.viga || {}, cl = c.col || {};
  const hb = num(vg.h, 240), bb = num(vg.b, 120), twb = num(vg.tw, 6.2), tfb = num(vg.tf, 9.8);
  const hc = num(cl.h, 190), bc = num(cl.b, 200), twc = num(cl.tw, 6.5), tfc = num(cl.tf, 10), rc = num(cl.r, 18);
  const [Fyb, Fub] = ACEROS[c.aceroViga] || ACEROS['A572 Gr 50'], [Fyc] = ACEROS[c.aceroCol] || ACEROS['A572 Gr 50'];
  const pl = c.pl || {}, pc = c.pc || {}, ct = c.ct || {};
  const Lp = num(pl.L, 230), bp = num(pl.b, 120), tp = num(pl.t, 9.525), [Fyp, Fup] = ACEROS[pl.acero] || ACEROS.A36;
  const [dp, Abp] = perno(pc.d), [Fnt, FnvN, FnvX] = TIPOS_PERNO[pc.tipo] || TIPOS_PERNO.A325, Fnv = pc.rosca === false ? FnvN : FnvX;
  const nf = Math.max(1, Math.round(num(pc.nf, 2))), ncP = Math.max(1, Math.round(num(pc.nc, 5))), nP = nf*ncP;
  const s = num(pc.s, 3*dp), le = num(pc.le, 1.5*dp), g = num(pc.g, 70), dh = dp + 1.6, dn = dh + 1.6;
  if(!filas?.length) return { ok:false, error:'Faltan las cargas (grupo de la viga en el modelo o escritas a mano).' };
  // Cartela
  const hct = num(ct.h, 110), bct = num(ct.b, 90), tct = num(ct.t, 9.525), [Fyt, Fut] = ACEROS[ct.acero] || ACEROS.A36;
  const [dt, Abt] = perno(ct.d), [, FnvNt, FnvXt] = TIPOS_PERNO[ct.tipo] || TIPOS_PERNO.A325, Fnvt = ct.rosca === false ? FnvNt : FnvXt;
  const nt = Math.max(1, Math.round(num(ct.n, 2))), st = num(ct.s, 3*dt), let_ = num(ct.le, 1.5*dt), et = num(ct.e, 50), dht = dt + 1.6, dnt = dht + 1.6;
  const Fexx = ELECTRODOS[c.electrodo] || ELECTRODOS.E70XX, wPl = num(c.wPl, 6), wCt = num(c.wCt, 5);
  // Resistencias (independientes de la carga)
  const phiRnPerno = 0.75*Fnv*Abp;                                                         // V2 — área nominal
  const apl = (t, Fu) => { const borde = Math.min(1.2*(le - dh/2)*t*Fu, 2.4*dp*t*Fu), inter = Math.min(1.2*(s - dh)*t*Fu, 2.4*dp*t*Fu);
    return 0.75*nf*(borde + (ncP - 1)*inter); };                                          // V3
  const aplPl = apl(tp, Fup), aplAla = apl(tfb, Fub);
  const Ag = bp*tp, An = Math.min((bp - nf*dn)*tp, 0.85*Ag);                                // V4
  const tenPl = Math.min(0.9*Fyp*Ag, 0.75*Fup*An);
  const largo = le + (ncP - 1)*s;
  const bloque = (t, Fy, Fu, anchoT) => {
    const Agv = 2*largo*t, Anv = 2*(largo - (ncP - 0.5)*dn)*t, Ant = anchoT*t;
    return 0.75*Math.min(0.6*Fu*Anv + Fu*Ant, 0.6*Fy*Agv + Fu*Ant);
  };
  const bloquePl = Math.min(bloque(tp, Fyp, Fup, Math.max(g - dn, 0)), bloque(tp, Fyp, Fup, Math.max(bp - g - dn, 0)));
  const bloqueAla = bloque(tfb, Fyb, Fub, Math.max(bb - g - dn, 0));
  // Platina a compresión (K = 0.65, L = lu)
  const lu = num(pc.lu, 40), rr = tp/Math.sqrt(12), KL = 0.65*lu/rr, Fe = Math.PI**2*E/(KL*KL);
  const Fcr = KL <= 4.71*Math.sqrt(E/Fyp) ? 0.658**(Fyp/Fe)*Fyp : 0.877*Fe, compPl = 0.9*Fcr*Ag;
  // V6 — soldadura cubrejunta–columna: filete a ambos lados del extremo de la platina (2·b)
  const Lw = 2*bp, soldPl = 0.75*0.6*Fexx*0.707*wPl*Lw;
  // V7 — columna: flexión local del ala, fluencia y aplastamiento del alma, zona de panel
  const kdes = tfc + rc, lb = tp;
  const alaCol = 0.9*6.25*Fyc*tfc*tfc;
  const almaFl = 1.0*(5*kdes + lb)*Fyc*twc;
  const almaApl = 0.75*0.8*twc*twc*(1 + 3*(lb/hc)*(twc/tfc)**1.5)*Math.sqrt(E*Fyc*tfc/twc);
  const panel = 0.9*0.6*Fyc*hc*twc;
  // Cartela (V5, V9): grupo de pernos en una línea con excentricidad et
  const sumd2 = (() => { let q = 0; for(let i = 0; i < nt; i++){ const y = (i - (nt - 1)/2)*st; q += y*y; } return q; })(), cmax = (nt - 1)/2*st;
  const phiRnPt = 0.75*Fnvt*Abt;
  const aplCt = t_ => Math.min(1.2*(let_ - dht/2)*t_*Fut, 2.4*dt*t_*Fut);   // por perno (el de borde controla)
  const cortY = 1.0*0.6*Fyt*hct*tct, cortR = 0.75*0.6*Fut*(hct - nt*dnt)*tct;
  const bloqueCt = 0.75*Math.min(0.6*Fut*(let_ + (nt - 1)*st - (nt - 0.5)*dnt)*tct + Fut*(bct - et - dnt/2)*tct*0.5, 0.6*Fyt*(let_ + (nt - 1)*st)*tct + Fut*(bct - et - dnt/2)*tct*0.5);
  const Swt = 2*hct*hct/6, soldCtPhi = 0.75*0.6*Fexx*0.707*wCt;    // N/mm
  let peor = null; const res = [];
  for(const fl of filas){
    const M = Math.abs(num(fl.M))*1e6, V = Math.abs(num(fl.V))*1000, P = num(fl.P)*1000;
    const Nf = M/(hb - tfb) + Math.abs(P)/2;                                                  // V1
    const rb = Math.hypot(V/nt, V*et*cmax/(sumd2 || 1));
    const fw = Math.hypot(V/(2*hct), V*et/Swt);
    const cks = {
      perno: chk('Cortante en los pernos de la cubrejunta', 'F.2.10.3.6', Nf/nP, phiRnPerno, 'N'),
      aplPl: chk('Aplastamiento en los agujeros de la cubrejunta', 'F.2.10.3.10', Nf, aplPl, 'N'),
      aplAla: chk('Aplastamiento en los agujeros del ala de la viga', 'F.2.10.3.10', Nf, aplAla, 'N'),
      ten: chk('Cubrejunta a tensión (fluencia y rotura, An ≤ 0.85Ag)', 'F.2.10.4.1', Nf, tenPl, 'N'),
      bloq: chk('Bloque de cortante en la cubrejunta', 'F.2.10.4.3', Nf, bloquePl, 'N'),
      bloqAla: chk('Bloque de cortante en el ala de la viga', 'F.2.10.4.3', Nf, bloqueAla, 'N'),
      comp: chk('Cubrejunta a compresión', 'F.2.10.4.4', Nf, compPl, 'N'),
      sold: chk('Soldadura cubrejunta – columna', 'F.2.10.2.4', Nf, soldPl, 'N'),
      alaCol: chk('Columna: flexión local del ala', 'F.2.10.10.1', Nf, alaCol, 'N'),
      almaFl: chk('Columna: fluencia local del alma', 'F.2.10.10.2', Nf, almaFl, 'N'),
      almaApl: chk('Columna: aplastamiento del alma', 'F.2.10.10.3', Nf, almaApl, 'N'),
      panel: chk('Columna: cortante en la zona de panel', 'F.2.10.10.6', Nf, panel, 'N'),
      pernoCt: chk('Cartela: cortante en los pernos (con excentricidad)', 'F.2.10.3.6', rb, phiRnPt, 'N'),
      aplCt: chk('Cartela: aplastamiento (cartela y alma de la viga)', 'F.2.10.3.10', rb, 0.75*Math.min(aplCt(tct), aplCt(twb)), 'N'),
      cortCt: chk('Cartela: cortante (fluencia y rotura)', 'F.2.10.4.2', V, Math.min(cortY, cortR), 'N'),
      bloqCt: chk('Cartela: bloque de cortante', 'F.2.10.4.3', V, bloqueCt, 'N'),
      soldCt: chk('Soldadura cartela – columna', 'F.2.10.2.4', fw, soldCtPhi, 'N/mm'),
    };
    const rmax = Math.max(...Object.values(cks).map(x => x.r));
    const fila = { fl, M, V, P, Nf, rb, fw, cks, rmax }; res.push(fila); if(!peor || rmax > peor.rmax) peor = fila;
  }
  const checks = {};
  for(const f of res) for(const [k, v] of Object.entries(f.cks)) if(!checks[k] || v.r > checks[k].r) checks[k] = { ...v, fila:f };
  // V8 — geometría (avisos) y tamaños de soldadura
  const avisos = [], bmin = BORDE_MIN[pc.d] || 19;
  if(le < bmin) avisos.push(`Distancia al borde de la cubrejunta ${le} mm < ${bmin} mm (Tabla F.2.10.3-4).`);
  if(s < 2.67*dp) avisos.push(`Separación entre pernos ${s} mm < 2.67·d = ${(2.67*dp).toFixed(0)} mm (F.2.10.3.3).`);
  // Largo necesario de la cubrejunta = lu + (n − 1)·s + le (cara de la columna → 1er perno → último perno → borde)
  const Lnec = lu + (ncP - 1)*s + le;
  if(Lnec > Lp + 0.5) avisos.push(`Los pernos no caben en la cubrejunta: L ≥ lu + (n − 1)·s + le = ${lu} + ${ncP - 1}×${s} + ${le} = ${Lnec.toFixed(0)} mm y la platina mide ${Lp} mm.`);
  if(nf > 1 && (bp - g)/2 < le - 0.5) avisos.push(`Borde lateral de la cubrejunta (b − g)/2 = ${((bp - g)/2).toFixed(0)} mm < ${le} mm: reduce el gramil o ensancha la platina.`);
  if(nf > 1 && (bb - g)/2 < bmin - 0.5) avisos.push(`Borde lateral en el ala de la viga (bf − g)/2 = ${((bb - g)/2).toFixed(0)} mm < ${bmin} mm (Tabla F.2.10.3-4).`);
  const Hnec = (nt - 1)*st + 2*let_;
  if(Hnec > hct + 0.5) avisos.push(`Los pernos no caben en la cartela: h ≥ (n − 1)·s + 2·le = ${Hnec.toFixed(0)} mm y la cartela mide ${hct} mm.`);
  if(bct - et < let_ - 0.5) avisos.push(`Borde libre de la cartela b − e = ${(bct - et).toFixed(0)} mm < ${let_} mm.`);
  if(st < 2.67*dt) avisos.push(`Separación entre pernos de la cartela ${st} mm < 2.67·d = ${(2.67*dt).toFixed(0)} mm (F.2.10.3.3).`);
  const tMinPl = Math.min(tp, tfc);
  if(wPl < filMin(tMinPl)) avisos.push(`Soldadura de la cubrejunta: ${wPl} mm < mínimo ${filMin(tMinPl)} mm (Tabla F.2.10.2-4).`);
  if(wCt < filMin(Math.min(tct, tfc))) avisos.push(`Soldadura de la cartela: ${wCt} mm < mínimo ${filMin(Math.min(tct, tfc))} mm.`);
  const ratio = Math.max(...Object.values(checks).map(x => x.r));
  const rig = ['alaCol','almaFl','almaApl','panel'].some(k => checks[k].r > 1);
  if(rig) avisos.push('La columna necesita rigidizadores (placas de continuidad) a la altura de las alas de la viga, o una platina de refuerzo en el alma.');
  return { ok:true, tipo:'vc', hb, bb, twb, tfb, hc, bc, twc, tfc, Fyb, Fub, Fyc, Lp, bp, tp, Fyp, Fup, dp, Abp, Fnv, nf, ncP, nP, s, le, g, dh, dn, lu, KL, Fcr,
    hct, bct, tct, dt, nt, st, let_, et, Fexx, wPl, wCt, phiRnPerno, aplPl, aplAla, Ag, An, tenPl, bloquePl, bloqueAla, compPl, Lw, soldPl, kdes, alaCol, almaFl, almaApl, panel,
    phiRnPt, cortY, cortR, bloqueCt, soldCtPhi, res, peor, checks, avisos, ratio, cumple:ratio <= 1 + 1e-9 };
}

const api = { FORMAS_EL, segPerfil, PERNOS, TIPOS_PERNO, ANCLAJES, ACEROS, ELECTRODOS, BORDE_MIN, FORMAS, contornoI, propLineas, soldadura, placaBase, vigaColumna, filMin, filMax };
if(typeof module !== 'undefined') module.exports = api; else root.AnexoE = api;
})(typeof window !== 'undefined' ? window : globalThis);
