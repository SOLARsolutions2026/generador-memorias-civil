/* ═══ Anexo D — Diseño de elementos metálicos (NSR-10 Título F.2 ≡ AISC 360-10). Cálculo puro, sin pantalla. ═══
   Unidades internas: N, mm, MPa. Las fuerzas entran en kN y kN·m y se convierten.
   Convención de SAP: P (+ tensión, − compresión), V2/M3 = eje fuerte (alma), V3/M2 = eje débil, T = torsión.
   Correcciones aprobadas por Amo (27-oct-2026) frente a sus plantillas: Cw con b³ (= Iw), rts con el eje débil,
   pandeo lateral A/B/C con Cb y ≤ Mp, pandeo local de aleta no compacta, φ en el eje menor, interacción H1-1,
   cortante (φv, Aw con peralte total, eje débil 2·bf·tf), torsión por esfuerzo en perfiles I, Lx/Ly/Lb/Lz y K por elemento,
   J de la tabla; tubos con t = 0.93t, Q con la pared esbelta, torsión (i)(ii)(iii), cortante con el alma correcta;
   esbeltez a tensión con r mín (≤ 300), aplastamiento 0.75·2.4·d·t·Fu + corte del perno; barra: rotura φ 0.75, sin KL/r. */
(function(root){
'use strict';
const num = (v, d=0) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : d; };
const E = 200000, G = 77200, PI2 = Math.PI * Math.PI;

const ACEROS = {   // Fy, Fu [MPa] (tabla de la plantilla de Amo)
  'A572 Gr 50': [345, 450], 'A36': [250, 400], 'A500 Gr B': [317, 400], 'A500 Gr C': [345, 427], 'A1065': [345, 413], 'A1085': [345, 448] };
const PERNOS = {   // Fnt, Fnv sin rosca en el plano de corte, Fnv con rosca [MPa] (tabla de la plantilla de Amo)
  'A307': [310, 165, 165], 'A325': [620, 413, 330], 'A490': [778, 516, 413] };

// ─── Propiedades de sección ───
function secI(nombre){
  const L = (root.PERFILES_LAM || []).find(p => p[0] === nombre); if(!L) return null;
  const [n, fam, h, b, tw, tf, r, A, Ix, Sx, Zx, Iy, Sy, Zy, J, Cw, kgm] = L;
  const ho = h - tf, hw = h - 2*tf - 2*r;
  return { tipo:'I', n, fam, h, b, tw, tf, r, A, Ix, Sx, Zx, rx:Math.sqrt(Ix/A), Iy, Sy, Zy, ry:Math.sqrt(Iy/A), J, Cw: Cw || tf*b**3*ho**2/24, ho, hw, kgm,
    CwFormula: tf*b**3*ho**2/24 };
}
// Tubo rectangular: espesor de diseño 0.93·t (F.2.2.4.2); esquinas rectas (aproximación del lado seguro en A e I)
function secHSS(H, B, tn){
  H = num(H); B = num(B); tn = num(tn); if(!(H > 0 && B > 0 && tn > 0)) return null;
  const t = 0.93 * tn, Hi = H - 2*t, Bi = B - 2*t;
  const A = B*H - Bi*Hi;
  const Ix = (B*H**3 - Bi*Hi**3)/12, Iy = (H*B**3 - Hi*Bi**3)/12;
  const Zx = B*H*H/4 - Bi*Hi*Hi/4, Zy = H*B*B/4 - Hi*Bi*Bi/4;
  const J = 2*t*(B - t)**2*(H - t)**2 / (B + H - 2*t);
  const C = 2*(B - t)*(H - t)*t - 4.5*(4 - Math.PI)*t**3;           // constante torsional (H3.1)
  return { tipo:'HSS', n:`${H}×${B}×${tn}`, H, B, tn, t, A, Ix, Sx:2*Ix/H, Zx, rx:Math.sqrt(Ix/A), Iy, Sy:2*Iy/B, Zy, ry:Math.sqrt(Iy/A), J, C,
    bP:B - 3*t, hP:H - 3*t, kgm: A * 7850 / 1e6 };
}
function secBar(d){
  d = num(d); if(!(d > 0)) return null;
  const A = Math.PI*d*d/4, I = Math.PI*d**4/64;
  return { tipo:'BAR', n:`Ø${d} mm`, d, A, Ix:I, Iy:I, rx:d/4, ry:d/4, Sx:I/(d/2), Zx:d**3/6, kgm:A*7850/1e6 };
}
const PULG = { '3/8"':9.525, '1/2"':12.7, '5/8"':15.875, '3/4"':19.05, '7/8"':22.225, '1"':25.4 };

// Cv de cortante (F.2.7.2.1(b))
function cv(hw, kv, Fy){
  const a = 1.10*Math.sqrt(kv*E/Fy), b = 1.37*Math.sqrt(kv*E/Fy);
  return hw <= a ? { Cv:1, caso:'i' } : hw <= b ? { Cv:a/hw, caso:'ii' } : { Cv:1.51*kv*E/(hw*hw*Fy), caso:'iii' };
}
// Fcr de compresión (F.2.5.3 / F.2.5.7) con Q
function fcr(Fe, Fy, Q){
  return Fe >= 0.44*Q*Fy ? { Fcr:Q*Math.pow(0.658, Q*Fy/Fe)*Fy, ec:'F.2.5-2' } : { Fcr:0.877*Fe, ec:'F.2.5-3' };
}

// ─── Capacidades de un elemento ───
function capacidades(el){
  const ac = ACEROS[el.acero] || ACEROS['A572 Gr 50'], Fy = ac[0], Fu = ac[1], rq = Math.sqrt(E/Fy);
  const s = el.tipo === 'HSS' ? secHSS(el.H, el.B, el.t) : el.tipo === 'BAR' ? secBar(el.d) : secI(el.perfil);
  if(!s) return { ok:false, error:'Falta escoger la sección.' };
  const Lx = num(el.Lx)*1000, Ly = num(el.Ly || el.Lx)*1000, Lb = num(el.Lb || el.Lx)*1000, Lz = num(el.Lz || el.Lx)*1000;
  const Kx = num(el.Kx, 1), Ky = num(el.Ky, 1), Kz = num(el.Kz, 1), Cb = num(el.Cb, 1);
  if(!(Lx > 0)) return { ok:false, error:'Falta la longitud del elemento.' };
  const R = { ok:true, s, Fy, Fu, E, G, Lx, Ly, Lb, Lz, Kx, Ky, Kz, Cb, pasos:{} };

  // Tensión (F.2.4): fluencia y rotura en área neta efectiva; esbeltez con r mínimo
  const rmin = Math.min(s.rx, s.ry), tc = el.tension || {};
  const nA = num(tc.nAg), dp = PULG[tc.dperno] || num(tc.dperno), tAg = num(tc.tAg) || (s.tipo === 'I' ? s.tf : s.t || 0);
  const An = s.tipo === 'BAR' ? s.A : Math.max(0, s.A - nA*(dp > 0 ? dp + 3.2 : 0)*tAg);     // agujero = d + 1/8"
  const U = s.tipo === 'BAR' ? 1 : num(tc.U, 1), Ae = U*An;
  const tenY = 0.9*Fy*s.A, tenR = s.tipo === 'BAR' && tc.roscada ? 0.75*0.75*Fu*s.A : 0.75*Fu*Ae;
  let tenB = Infinity, pern = null;
  const pe = el.pernos || {};
  if(s.tipo !== 'BAR' && num(pe.n) > 0 && (PULG[pe.d] || num(pe.d)) > 0 && num(pe.tpl) > 0){
    const d = PULG[pe.d] || num(pe.d), Ab = Math.PI*d*d/4, F = PERNOS[pe.tipo] || PERNOS.A325, Fnv = pe.rosca === false ? F[1] : F[2];
    const corte = 0.75*Fnv*Ab, apl = 0.75*2.4*d*num(pe.tpl)*Fu;
    pern = { d, Ab, Fnv, corte, apl, uno:Math.min(corte, apl), n:num(pe.n) }; tenB = pern.uno * pern.n;
  }
  R.ten = { An, U, Ae, tenY, tenR, tenB, pern, phiPn:Math.min(tenY, tenR, tenB), esb:Math.max(Lx, Ly)/rmin, lim:s.tipo === 'BAR' ? null : 300 };
  R.ten.gob = R.ten.phiPn === tenY ? 'Fluencia en el área bruta' : R.ten.phiPn === tenR ? 'Rotura en el área neta efectiva' : 'Pernos (corte / aplastamiento)';
  if(s.tipo === 'BAR') return R;   // la barra solo trabaja a tensión

  if(s.tipo === 'I'){
    // Clasificación (Tabla F.2.2.4-1b flexión, F.2.2.4-1a compresión)
    const lf = s.b/(2*s.tf), lw = s.hw/s.tw;
    const cl = { lf, lw, lpf:0.38*rq, lrf:1.0*rq, lpw:3.76*rq, lrw:5.70*rq, lrfc:0.56*rq, lrwc:1.49*rq };
    cl.aleta = lf <= cl.lpf ? 'Compacta' : lf <= cl.lrf ? 'No compacta' : 'Esbelta';
    cl.alma = lw <= cl.lpw ? 'Compacta' : lw <= cl.lrw ? 'No compacta' : 'Esbelta';
    R.cl = cl;
    // Compresión con Q (F.2.5.7)
    let Qs = 1; const a1 = cl.lrfc, a2 = 1.03*rq;
    if(lf > a1) Qs = lf <= a2 ? 1.415 - 0.74*lf*Math.sqrt(Fy/E) : 0.69*E/(Fy*lf*lf);
    const KLx = Kx*Lx/s.rx, KLy = Ky*Ly/s.ry, KL = Math.max(KLx, KLy);
    const Fef = PI2*E/(KL*KL);
    const Fet = (PI2*E*s.Cw/((Kz*Lz)**2) + G*s.J) / (s.Ix + s.Iy);       // pandeo torsional (doble simetría, F.2.5-9)
    let Qa = 1;
    if(lw > cl.lrwc){ const f = fcr(Math.min(Fef, Fet), Fy, Qs).Fcr, be = Math.min(s.hw, 1.92*s.tw*Math.sqrt(E/f)*(1 - 0.34/lw*Math.sqrt(E/f))); Qa = (s.A - (s.hw - be)*s.tw)/s.A; }
    const Q = Qs*Qa;
    const cf = fcr(Fef, Fy, Q), ct = fcr(Fet, Fy, Q);
    R.comp = { KLx, KLy, KL, Fef, Fet, Qs, Qa, Q, flex:{ ...cf, phiPn:0.9*cf.Fcr*s.A }, tors:{ ...ct, phiPn:0.9*ct.Fcr*s.A } };
    R.comp.phiPn = Math.min(R.comp.flex.phiPn, R.comp.tors.phiPn);
    R.comp.gob = R.comp.phiPn === R.comp.flex.phiPn ? 'Pandeo por flexión' : 'Pandeo torsional';
    R.comp.esbOk = KL <= 200;
    // Flexión eje mayor (F.2.6.2 y F.2.6.3)
    const Mp = Fy*s.Zx, Lp = 1.76*s.ry*rq;
    const rts = Math.sqrt(Math.sqrt(s.Iy*s.Cw)/s.Sx), c = 1, jc = s.J*c/(s.Sx*s.ho);
    const Lr = 1.95*rts*E/(0.7*Fy)*Math.sqrt(jc + Math.sqrt(jc*jc + 6.76*(0.7*Fy/E)**2));
    let ltb, casoL;
    if(Lb <= Lp){ ltb = Mp; casoL = 'A (Lb ≤ Lp): no hay pandeo lateral'; }
    else if(Lb <= Lr){ ltb = Math.min(Mp, Cb*(Mp - (Mp - 0.7*Fy*s.Sx)*(Lb - Lp)/(Lr - Lp))); casoL = 'B (Lp < Lb ≤ Lr): pandeo inelástico'; }
    else { const Fcr = Cb*PI2*E/((Lb/rts)**2)*Math.sqrt(1 + 0.078*jc*(Lb/rts)**2); ltb = Math.min(Mp, Fcr*s.Sx); casoL = 'C (Lb > Lr): pandeo elástico'; R.fcrLTB = Fcr; }
    let flb = Mp;
    if(cl.aleta === 'No compacta') flb = Mp - (Mp - 0.7*Fy*s.Sx)*(lf - cl.lpf)/(cl.lrf - cl.lpf);
    else if(cl.aleta === 'Esbelta'){ const kc = Math.min(0.76, Math.max(0.35, 4/Math.sqrt(lw))); flb = 0.9*E*kc*s.Sx/(lf*lf); }
    R.fx = { Mp, Lp, Lr, rts, jc, casoL, ltb, flb, Mn:Math.min(ltb, flb), avisoAlma: cl.alma !== 'Compacta' };
    R.fx.phiMn = 0.9*R.fx.Mn; R.fx.gob = R.fx.Mn === ltb ? (Lb <= Lp ? 'Fluencia' : 'Pandeo lateral-torsional') : 'Pandeo local de la aleta';
    // Flexión eje menor (F.2.6.6)
    const Mpy = Math.min(Fy*s.Zy, 1.6*Fy*s.Sy);
    let flby = Mpy;
    if(cl.aleta === 'No compacta') flby = Mpy - (Mpy - 0.7*Fy*s.Sy)*(lf - cl.lpf)/(cl.lrf - cl.lpf);
    else if(cl.aleta === 'Esbelta') flby = 0.69*E/(lf*lf)*s.Sy;
    R.fy = { Mp:Mpy, flb:flby, Mn:Math.min(Mpy, flby) }; R.fy.phiMn = 0.9*R.fy.Mn; R.fy.gob = R.fy.Mn === Mpy ? 'Fluencia' : 'Pandeo local de la aleta';
    // Cortante (F.2.7.2)
    const lim224 = 2.24*rq;
    let vx;
    if(lw <= lim224) vx = { phi:1.0, Cv:1, caso:'a: h/tw ≤ 2.24√(E/Fy)' };
    else { const r2 = cv(lw, 5, Fy); vx = { phi:0.9, Cv:r2.Cv, caso:'b(' + r2.caso + ')' }; }
    vx.Aw = s.h*s.tw; vx.phiVn = vx.phi*0.6*Fy*vx.Aw*vx.Cv;
    const ry2 = cv(lf, 1.2, Fy), vy = { phi:0.9, Cv:ry2.Cv, caso:'b(' + ry2.caso + '), kv = 1.2', Aw:2*s.b*s.tf };
    vy.phiVn = vy.phi*0.6*Fy*vy.Aw*vy.Cv;
    R.vx = vx; R.vy = vy;
    // Torsión (perfil abierto): esfuerzo cortante τ = T·tmáx/J ≤ φ·0.6·Fy (H3.3)
    const tmax = Math.max(s.tf, s.tw);
    R.tor = { tmax, Fn:0.6*Fy, phi:0.9, phiTn: 0.9*0.6*Fy*s.J/tmax };     // capacidad equivalente en N·mm
  } else {
    // Tubo rectangular (HSS)
    const t = s.t, bt = s.bP/t, ht = s.hP/t;
    const cl = { bt, ht, lpf:1.12*rq, lrf:1.40*rq, lpw:2.42*rq, lrw:5.70*rq, lrc:1.40*rq };
    const clasif = (l, p, r) => l <= p ? 'Compacta' : l <= r ? 'No compacta' : 'Esbelta';
    cl.aletaX = clasif(bt, cl.lpf, cl.lrf); cl.almaX = clasif(ht, cl.lpw, cl.lrw);     // flexión eje mayor: aleta = pared B
    cl.aletaY = clasif(ht, cl.lpf, cl.lrf); cl.almaY = clasif(bt, cl.lpw, cl.lrw);     // flexión eje menor: aleta = pared H
    R.cl = cl;
    // Compresión: Q = Aef/Ag con las paredes esbeltas (F.2.5.7.2)
    const KLx = Kx*Lx/s.rx, KLy = Ky*Ly/s.ry, KL = Math.max(KLx, KLy), Fe = PI2*E/(KL*KL);
    const f = fcr(Fe, Fy, 1).Fcr;
    const bef = w => { const l = w/t; return l <= cl.lrc ? w : Math.min(w, 1.92*t*Math.sqrt(E/f)*(1 - 0.38/l*Math.sqrt(E/f))); };
    const beB = bef(s.bP), beH = bef(s.hP), Aef = s.A - 2*(s.bP - beB)*t - 2*(s.hP - beH)*t, Q = Math.min(1, Aef/s.A);
    const cf = fcr(Fe, Fy, Q);
    R.comp = { KLx, KLy, KL, Fef:Fe, Q, beB, beH, Aef, flex:{ ...cf, phiPn:0.9*cf.Fcr*s.A } };
    R.comp.phiPn = R.comp.flex.phiPn; R.comp.gob = 'Pandeo por flexión'; R.comp.esbOk = KL <= 200;
    // Flexión (F.2.6.7): fluencia, pandeo local de aleta y de alma
    const flex = (Z, S, Hdim, lAl, clAl, lAm, clAm, wAl) => {
      const Mp = Fy*Z; let fl = Mp, wb = Mp;
      if(clAl === 'No compacta') fl = Math.min(Mp, Mp - (Mp - Fy*S)*(3.57*lAl*Math.sqrt(Fy/E) - 4.0));
      else if(clAl === 'Esbelta'){   // F.2.6.7: Mn = Fy·Se, con la aleta en compresión de ancho efectivo be
        const be = Math.min(wAl, 1.92*t*rq*(1 - 0.38/lAl*rq)), Ar = (wAl - be)*t, yc = Hdim/2 - t/2, I = S*Hdim/2, A0 = Hdim === s.H ? s.A : s.A;
        const A1 = A0 - Ar, yb = -Ar*yc/A1, I1 = I - Ar*yc*yc - A1*yb*yb; fl = Fy*I1/(Hdim/2 - yb); }
      if(clAm === 'No compacta') wb = Math.min(Mp, Mp - (Mp - Fy*S)*(0.305*lAm*Math.sqrt(Fy/E) - 0.738));
      return { Mp, flb:fl, wlb:wb, Mn:Math.min(Mp, fl, wb), avisoAlma: clAm === 'Esbelta' };
    };
    const fx = flex(s.Zx, s.Sx, s.H, bt, cl.aletaX, ht, cl.almaX, s.bP), fy = flex(s.Zy, s.Sy, s.B, ht, cl.aletaY, bt, cl.almaY, s.hP);
    const gobF = r => r.Mn === r.Mp ? 'Fluencia' : r.Mn === r.flb ? 'Pandeo local de la aleta' : 'Pandeo local del alma';
    R.fx = { ...fx, phiMn:0.9*fx.Mn, gob:gobF(fx), casoL:'No aplica pandeo lateral-torsional en tubos rectangulares' }; R.fy = { ...fy, phiMn:0.9*fy.Mn, gob:gobF(fy) };
    // Cortante (G5): Aw = 2·h·t, kv = 5
    const vxc = cv(ht, 5, Fy), vyc = cv(bt, 5, Fy);
    R.vx = { phi:0.9, Cv:vxc.Cv, caso:vxc.caso, Aw:2*s.hP*t }; R.vx.phiVn = 0.9*0.6*Fy*R.vx.Aw*R.vx.Cv;
    R.vy = { phi:0.9, Cv:vyc.Cv, caso:vyc.caso, Aw:2*s.bP*t }; R.vy.phiVn = 0.9*0.6*Fy*R.vy.Aw*R.vy.Cv;
    // Torsión (H3.1) con la pared más esbelta
    const hT = Math.max(ht, bt), l1 = 2.45*rq, l2 = 3.07*rq;
    let Fcr, caso;
    if(hT <= l1){ Fcr = 0.6*Fy; caso = '(i)'; } else if(hT <= l2){ Fcr = 0.6*Fy*l1/hT; caso = '(ii)'; } else { Fcr = 0.458*PI2*E/(hT*hT); caso = '(iii)'; }
    R.tor = { hT, Fcr, caso, phi:0.9, phiTn:0.9*Fcr*s.C };
  }
  return R;
}

// ─── Revisión con las fuerzas (todas las filas del grupo) ───
// fila: { P, V2, V3, T, M2, M3 } en kN y kN·m (+ F, c, st para saber cuál controla)
function revisar(el, filas){
  const R = capacidades(el); if(!R.ok) return R;
  const out = { ...R, checks:{}, filas:filas.length };
  const upd = (k, r, f) => { if(!out.checks[k] || r > out.checks[k].r) out.checks[k] = { r, f }; };
  for(const f of filas){
    const P = num(f.P)*1e3, Mx = Math.abs(num(f.M3))*1e6, My = Math.abs(num(f.M2))*1e6, Vx = Math.abs(num(f.V2))*1e3, Vy = Math.abs(num(f.V3))*1e3, T = Math.abs(num(f.T))*1e6;
    if(P > 0) upd('ten', P/R.ten.phiPn, f);
    if(R.s.tipo === 'BAR'){ if(P < 0) upd('compBar', -P/1e3, f); continue; }
    if(P < 0) upd('comp', -P/R.comp.phiPn, f);
    upd('fx', Mx/R.fx.phiMn, f); upd('fy', My/R.fy.phiMn, f);
    upd('vx', Vx/R.vx.phiVn, f); upd('vy', Vy/R.vy.phiVn, f); upd('tor', T/R.tor.phiTn, f);
    const Pc = P < 0 ? R.comp.phiPn : R.ten.phiPn, pr = Math.abs(P)/Pc, mm = Mx/R.fx.phiMn + My/R.fy.phiMn;
    let inter = pr >= 0.2 ? pr + 8/9*mm : pr/2 + mm, ec = pr >= 0.2 ? 'H1-1a' : 'H1-1b';
    if(R.s.tipo === 'HSS' && T > 0.2*R.tor.phiTn){ inter = (pr + mm) + (Math.max(Vx/R.vx.phiVn, Vy/R.vy.phiVn) + T/R.tor.phiTn)**2; ec = 'H3-6'; }
    upd('int', inter, { ...f, ec, pr, mm });
  }
  const rs = Object.entries(out.checks).filter(([k]) => k !== 'compBar').map(([, v]) => v.r);
  out.ratio = rs.length ? Math.max(...rs) : 0;
  out.cumple = out.ratio <= 1 + 1e-9;
  out.avisos = [];
  if(out.checks.compBar) out.avisos.push(`La barra solo trabaja a tensión y el modelo le da compresión de ${out.checks.compBar.r.toFixed(2)} kN (elemento E${out.checks.compBar.f.F}). Revisa el modelo.`);
  if(R.s.tipo !== 'BAR' && R.ten && R.ten.esb > 300) out.avisos.push(`Esbeltez a tensión L/r = ${R.ten.esb.toFixed(0)} > 300 (límite recomendado F.2.4.1).`);
  if(R.comp && !R.comp.esbOk) out.avisos.push(`Esbeltez KL/r = ${R.comp.KL.toFixed(0)} > 200 (F.2.5.2).`);
  if(R.fx?.avisoAlma) out.avisos.push('El alma no es compacta para flexión: el caso del alma no compacta/esbelta no está programado, revísalo aparte.');
  return out;
}

// Tipo y sección a partir del nombre de sección del modelo («SEC IPE 200», «SEC 120x60x2 mm», «Rebar 3/8"»)
function desdeNombre(nombre){
  const s = String(nombre).toUpperCase().replace(/^SEC\s+/, '');
  const m = s.match(/\b(IPE|IPN|HEA|HEB|HEM)\s*(\d+)/); if(m) return { tipo:'I', perfil:`${m[1]} ${m[2]}` };
  const t = s.match(/(\d+(?:[.,]\d+)?)\s*[X×]\s*(\d+(?:[.,]\d+)?)\s*[X×]\s*(\d+(?:[.,]\d+)?)/); if(t) return { tipo:'HSS', H:num(t[1]), B:num(t[2]), t:num(t[3]) };
  const b = s.match(/(\d+\/\d+|\d+(?:[.,]\d+)?)\s*"/); if(/REBAR|VARILLA|BARRA|Ø|D=/.test(s) && b){ const v = b[1].includes('/') ? b[1].split('/').reduce((a, c) => a / c) : num(b[1]); return { tipo:'BAR', d:+(v*25.4).toFixed(2) }; }
  return null;
}

const api = { ACEROS, PERNOS, PULG, E, G, secI, secHSS, secBar, capacidades, revisar, desdeNombre };
if(typeof module !== 'undefined') module.exports = api; else root.AnexoD = api;
})(typeof window !== 'undefined' ? window : globalThis);
