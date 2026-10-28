/* ═══ Anexo D — Elementos de concreto: zapatas aisladas y pedestales (NSR-10 Título C). Cálculo puro. ═══
   Unidades internas: N, mm, MPa. Fuerzas de entrada en kN y kN·m (reacciones del modelo: F3 + = compresión).
   Decisiones de Amo (27-oct-2026):
   Zapatas — método clásico NSR-10 + momento del modelo como comparación: presión con cargas de servicio vs qa (e en el núcleo),
   cortante en una dirección y punzonamiento (αs 40/30/20 según la posición del pedestal), flexión en la cara con el momento total,
   As mín 0.0018·b·h, s ≤ mín(3h, 450) con (n−1), d por capa, Ld contra lo disponible y gancho, aplastamiento.
   Pedestales — diagrama P–M por compatibilidad (φ variable, Pn,máx = 0.80·φ·Po, concreto desplazado, β1 según f'c),
   relación por carga, biaxial (Bresler), esbeltez klu/r ≤ 22, cortante (d correcto, Vc con Nu, Vs, s, Av,mín),
   confinamiento C.21.3.5 (Lo ≥ 500, Ash con Ach y bc correctos, ÷ s), cargas simultáneas por combinación y anclaje en la zapata.
   Cuantía mínima 1 % de Ag (C.10.9.1) es chequeo (Amo, 28-oct-2026); la máxima 4 % solo se informa. */
(function(root){
'use strict';
const num = (v, d=0) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : d; };
const BARRAS = { '3/8"':[9.5, 71], '1/2"':[12.7, 129], '5/8"':[15.9, 199], '3/4"':[19.1, 284], '7/8"':[22.2, 387], '1"':[25.4, 510], '1-1/8"':[28.7, 645], '1-1/4"':[32.3, 819] };
const barra = n => BARRAS[n] || BARRAS['1/2"'];
const beta1 = fc => Math.max(0.65, Math.min(0.85, 0.85 - 0.05*(fc - 28)/7));
const ALFA_S = { centrada:40, medianera:30, esquinera:20 };

// Longitud de desarrollo en tensión (C.12.2.2) y gancho estándar (C.12.5.2), λ = ψt = ψe = 1
function ld(db, fy, fc){ return Math.max(300, (db <= 19.1 ? fy/(2.1*Math.sqrt(fc)) : fy/(1.7*Math.sqrt(fc)))*db); }
function ldh(db, fy, fc){ return Math.max(8*db, 150, 0.24*fy/Math.sqrt(fc)*db); }
function ldc(db, fy, fc){ return Math.max(200, 0.24*fy/Math.sqrt(fc)*db, 0.043*fy*db); }

// Acero de una franja de ancho b [mm] para Mu [N·mm]
function aceroFranja(Mu, b, d, h, fc, fy, bar, rec){
  const [db, Ab] = barra(bar), phi = 0.9;
  const Rn = Mu/(phi*b*d*d), m = fy/(0.85*fc), disc = 1 - 2*m*Rn/fy;
  const Asreq = disc > 0 ? (1 - Math.sqrt(disc))/m*b*d : Infinity;
  const Asmin = 0.0018*b*h, smax = Math.min(3*h, 450);
  let n = Math.max(2, Math.ceil(Math.max(Asreq, Asmin)/Ab));
  const sep = n => (b - 2*rec - db)/(n - 1);
  while(sep(n) > smax) n++;
  const As = n*Ab, a = As*fy/(0.85*fc*b), c = a/beta1(fc), et = 0.003*(d - c)/c, phiMn = phi*As*fy*(d - a/2);
  return { db, Ab, Asreq, Asmin, smax, n, s:sep(n), As, a, c, et, phiMn, rige: Asreq >= Asmin ? 'resistencia' : 'mínimo 0.0018·b·h' };
}

// ═══ Zapata aislada ═══
// z: { B, L, h [m], bx, by [m] pedestal, Hp [m] altura del pedestal sobre la zapata, Df [m] profundidad de la base,
//      pos 'centrada'|'medianera'|'esquinera', qa [kN/m²], gs [kN/m³] suelo, gc 24, qsup [kN/m²] sobre el terreno,
//      fc, fy [MPa], rec [m], barX, barY, Mmx, Mmy [kN·m/m] momento leído del modelo (opcional) }
function zapata(z, servicio, resistencia){
  const B = num(z.B)*1000, L = num(z.L)*1000, h = num(z.h)*1000, bx = num(z.bx)*1000, by = num(z.by)*1000;
  const Hp = num(z.Hp)*1000, Df = num(z.Df)*1000, rec = num(z.rec, 0.075)*1000, fc = num(z.fc, 21), fy = num(z.fy, 420);
  const qa = num(z.qa), gs = num(z.gs, 18), gc = num(z.gc, 24), qsup = num(z.qsup), pos = ALFA_S[z.pos] ? z.pos : 'centrada';
  const falta = [['B', B], ['L', L], ['h', h], ['pedestal bx', bx], ['pedestal by', by], ['qa', qa]].filter(x => !(x[1] > 0)).map(x => x[0]);
  if(falta.length) return { ok:false, error:'Faltan: ' + falta.join(', ') };
  if(!servicio.length || !resistencia.length) return { ok:false, error:'Faltan reacciones de servicio o de resistencia.' };
  const A = B*L/1e6;                                                   // m²
  // Posición del pedestal respecto al centro de la zapata (excentricidad propia)
  const xc = pos === 'centrada' ? 0 : (B - bx)/2, yc = pos === 'esquinera' ? (L - by)/2 : 0;
  // Pesos propios [kN]: zapata, pedestal y suelo encima, más sobrecarga en superficie
  const hs = Math.max(0, Df - h);                                      // altura de relleno sobre la zapata
  const Wz = gc*A*h/1000, Wp = gc*(bx*by/1e6)*(Math.max(0, Hp)/1000), Ws = gs*(A - bx*by/1e6)*hs/1000, Wq = qsup*A;
  const brazoS = (Hp + h)/1000, brazoU = Hp/1000;                      // m: el cortante del apoyo se traslada a la base (suelo) o a la cara superior (concreto)
  const cargas = (f, brazo) => ({ P:Math.max(0, f.F3), Mx:Math.abs(f.M1) + Math.abs(f.F2)*brazo, My:Math.abs(f.M2) + Math.abs(f.F1)*brazo });

  // Z1 — presión de contacto con cargas de servicio (q = P/A ± 6M/…; e dentro del núcleo)
  let serv = null;
  for(const f of servicio){
    const c = cargas(f, brazoS), P = c.P + Wz + Wp + Ws + Wq;
    const Mx = c.Mx + c.P*yc/1000, My = c.My + c.P*xc/1000;          // + momento por la excentricidad del pedestal
    const ex = My/P, ey = Mx/P, k = 6*ex/(B/1000) + 6*ey/(L/1000);
    const qmax = P/A*(1 + k), qmin = P/A*(1 - k);
    const r = { f, P, Mx, My, ex, ey, qmax, qmin, nucleo:k <= 1 + 1e-9, rel:qmax/qa };
    if(!serv || r.qmax > serv.qmax) serv = r;
  }
  // Presión última neta (cargas mayoradas del apoyo, sin pesos propios que se cancelan con el suelo)
  const dx = h - rec - barra(z.barX)[0]/2, dy = h - rec - barra(z.barX)[0] - barra(z.barY)[0]/2, dm = (dx + dy)/2;
  let ult = null;
  for(const f of resistencia){
    const c = cargas(f, brazoU), P = c.P, Mx = c.Mx + P*yc/1000, My = c.My + P*xc/1000;
    const k = P > 0 ? 6*(My/P)/(B/1000) + 6*(Mx/P)/(L/1000) : 0, qu = P/A*(1 + k);
    if(!ult || qu > ult.qu) ult = { f, P, Mx, My, qu, quMin:P/A*(1 - k) };
  }
  const qu = ult.qu/1000;                                              // kN/m² → N/mm²·… (qu en MPa = kN/m² /1000)
  // Voladizos desde la cara del pedestal (si el pedestal está en un borde, el voladizo es el lado largo)
  const vx = pos === 'centrada' ? (B - bx)/2 : B - bx, vy = pos === 'esquinera' ? L - by : (L - by)/2;
  // Z2 — cortante en una dirección a d de la cara (C.11.2), presión uniforme qu,máx (conservador)
  const corte = (v, ancho, d) => { const Vu = qu*ancho*Math.max(0, v - d), phiVc = 0.75*0.17*Math.sqrt(fc)*ancho*d; return { Vu, phiVc, rel:Vu/phiVc, d }; };
  const cx = corte(vx, L, dx), cy = corte(vy, B, dy);
  // Z2 — punzonamiento a d/2 (C.11.11.2.1)
  const d = dm, alfa = ALFA_S[pos];
  let bo, Ain;
  if(pos === 'centrada'){ bo = 2*(bx + d) + 2*(by + d); Ain = (bx + d)*(by + d); }
  else if(pos === 'medianera'){ bo = 2*(bx + d/2) + (by + d); Ain = (bx + d/2)*(by + d); }
  else { bo = (bx + d/2) + (by + d/2); Ain = (bx + d/2)*(by + d/2); }
  const beta = Math.max(bx, by)/Math.min(bx, by), sq = Math.sqrt(fc);
  const vc1 = 0.17*(1 + 2/beta)*sq, vc2 = 0.083*(alfa*d/bo + 2)*sq, vc3 = 0.33*sq;
  const vc = Math.min(vc1, vc2, vc3), phiVcP = 0.75*vc*bo*d;
  const VuP = Math.max(0, ult.P*1000*(1 - Ain/(B*L)));            // alivio con la presión promedio dentro de bo
  const punz = { bo, d, alfa, beta, vc1, vc2, vc3, vc, phiVc:phiVcP, Vu:VuP, rel:VuP/phiVcP };
  // Z3 — flexión en la cara del pedestal con el momento total de la franja; Z6 — comparación con el modelo
  const flex = (v, ancho, dd, Mmod, bar) => {
    const Mcl = qu*ancho*v*v/2, Mmo = num(Mmod) > 0 ? num(Mmod)*1e6/1000*ancho : 0;   // kN·m/m × ancho
    const Mu = Math.max(Mcl, Mmo), a = aceroFranja(Mu, ancho, dd, h, fc, fy, bar, rec);
    // Z4 — desarrollo: disponible = voladizo − recubrimiento
    const disp = v - rec, lD = ld(a.db, fy, fc), lH = ldh(a.db, fy, fc);
    return { Mcl, Mmo, Mu, rigeM: Mmo > Mcl ? 'modelo' : 'método clásico', ...a, rel:Mu/a.phiMn, disp, ld:lD, ldh:lH,
      anclaje: lD <= disp ? 'recta' : lH <= disp ? 'con gancho' : 'no alcanza', anclOk: lH <= disp };
  };
  const fxz = flex(vx, L, dx, z.MmX, z.barX), fyz = flex(vy, B, dy, z.MmY, z.barY);   // barras en x (paralelas a B) resisten el voladizo en x
  // Z5 — aplastamiento del pedestal sobre la zapata (C.10.14)
  const A1 = bx*by, A2 = Math.min(B, bx + 4*h)*Math.min(L, by + 4*h), fac = Math.min(2, Math.sqrt(A2/A1));
  const apl = { A1, A2, fac, phiBn:0.65*0.85*fc*A1*fac, Pu:ult.P*1000 }; apl.rel = apl.Pu/apl.phiBn;
  const checks = { suelo:serv.rel, nucleo:serv.nucleo ? 0 : 99, corteX:cx.rel, corteY:cy.rel, punz:punz.rel, flexX:fxz.rel, flexY:fyz.rel, apl:apl.rel,
    anclX:fxz.anclOk ? 0 : 99, anclY:fyz.anclOk ? 0 : 99 };
  const ratio = Math.max(serv.rel, cx.rel, cy.rel, punz.rel, fxz.rel, fyz.rel, apl.rel);
  return { ok:true, B, L, h, bx, by, Hp, Df, rec, fc, fy, qa, A, xc, yc, pos, pesos:{ Wz, Wp, Ws, Wq, hs }, serv, ult, dx, dy, vx, vy, cx, cy, punz, fx:fxz, fy:fyz, apl,
    ratio, cumple: ratio <= 1 && serv.nucleo && fxz.anclOk && fyz.anclOk, checks };
}

// ═══ Pedestal ═══
// p: { b, h [mm] (b en x, h en y), Hp [m], rec [mm], fc, fy, bar, nx (barras por cara paralela a x, incluye esquinas), ny, est (estribo), ramasX, ramasY,
//      sConf, sFuera [mm], k (esbeltez), hz [mm] altura de la zapata, recZ [mm], barZ (barra de la zapata) }
function barrasPed(p){
  const b = num(p.b), h = num(p.h), rec = num(p.rec, 50), [db, Ab] = barra(p.bar), de = barra(p.est)[0];
  const nx = Math.max(2, Math.round(num(p.nx, 3))), ny = Math.max(2, Math.round(num(p.ny, 3)));
  const x0 = rec + de + db/2, x1 = b - x0, y0 = rec + de + db/2, y1 = h - y0, out = [];
  for(let i = 0; i < nx; i++){ const x = x0 + (x1 - x0)*i/(nx - 1); out.push([x, y0], [x, y1]); }
  for(let j = 1; j < ny - 1; j++){ const y = y0 + (y1 - y0)*j/(ny - 1); out.push([x0, y], [x1, y]); }
  return { bars:out.map(([x, y]) => ({ x, y, A:Ab })), db, Ab, de, Ast:out.length*Ab };
}
// Diagrama de interacción alrededor de un eje: dim = peralte en la dirección de flexión, ancho = la otra dimensión
function diagrama(p, eje){
  const b = num(p.b), h = num(p.h), fc = num(p.fc, 21), fy = num(p.fy, 420), Es = 200000, ey = fy/Es, b1 = beta1(fc);
  const { bars, Ast } = barrasPed(p);
  const D = eje === 'x' ? h : b, W = eje === 'x' ? b : h;              // flexión alrededor de x: el peralte es h (dirección y)
  const pos = bars.map(r => ({ y: eje === 'x' ? r.y : r.x, A:r.A }));   // distancia desde la fibra comprimida
  const Ag = b*h, Po = 0.85*fc*(Ag - Ast) + fy*Ast, PnMax = 0.80*Po;
  const dt = Math.max(...pos.map(r => r.y));
  const pts = [];
  const punto = c => {
    const a = Math.min(b1*c, D), Cc = 0.85*fc*a*W;
    let Pn = Cc, Mn = Cc*(D/2 - a/2), et = 0;
    for(const r of pos){
      const es = 0.003*(c - r.y)/c; let fs = Math.max(-fy, Math.min(fy, es*Es));
      if(r.y < a) fs -= 0.85*fc;                                        // concreto desplazado por la barra
      Pn += fs*r.A; Mn += fs*r.A*(D/2 - r.y);
    }
    et = 0.003*(dt - c)/c;
    const phi = et >= 0.005 ? 0.9 : et <= ey ? 0.65 : 0.65 + (et - ey)*0.25/(0.005 - ey);
    return { c, Pn, Mn, et, phi, phiPn:Math.min(phi*Pn, 0.65*PnMax), phiMn:phi*Mn };
  };
  for(let i = 1; i <= 60; i++) pts.push(punto(D*1.4*i/60));
  const Tn = -fy*Ast; pts.unshift({ c:0, Pn:Tn, Mn:0, et:1, phi:0.9, phiPn:0.9*Tn, phiMn:0 });
  pts.sort((a, b) => a.phiPn - b.phiPn);
  return { eje, D, W, Ag, Ast, Po, PnMax, phiPnMax:0.65*PnMax, phiTn:0.9*Tn, pts, b1 };
}
// φMn para un Pu dado (interpolando en la rama del diagrama)
function phiMnEn(dg, Pu){
  const pts = dg.pts; if(Pu >= dg.phiPnMax) return 0; if(Pu <= dg.phiTn) return 0;
  let best = 0;
  for(let i = 1; i < pts.length; i++){ const a = pts[i-1], b = pts[i];
    if((Pu - a.phiPn)*(Pu - b.phiPn) <= 0 && b.phiPn !== a.phiPn){ const t = (Pu - a.phiPn)/(b.phiPn - a.phiPn); best = Math.max(best, a.phiMn + t*(b.phiMn - a.phiMn)); } }
  return best;
}
// Pn nominal para una excentricidad e = M/P (para Bresler): intersección de la recta M = e·P con el diagrama nominal
function pnEn(dg, e){
  const pts = dg.pts.filter(q => q.Pn > 0).sort((a, b) => b.Pn - a.Pn);
  for(let i = 1; i < pts.length; i++){ const a = pts[i-1], b = pts[i], fa = a.Mn - e*a.Pn, fb = b.Mn - e*b.Pn;
    if(fa*fb <= 0){ const t = fa/(fa - fb); return Math.min(dg.PnMax, a.Pn + t*(b.Pn - a.Pn)); } }
  return Math.min(dg.PnMax, pts[0]?.Pn || 0);
}

function pedestal(p, resistencia){
  const b = num(p.b), h = num(p.h), fc = num(p.fc, 21), fy = num(p.fy, 420), rec = num(p.rec, 50), Hp = num(p.Hp)*1000;
  if(!(b > 0 && h > 0)) return { ok:false, error:'Faltan las dimensiones del pedestal.' };
  if(!resistencia.length) return { ok:false, error:'Faltan las reacciones de resistencia.' };
  const B = barrasPed(p), dgx = diagrama(p, 'x'), dgy = diagrama(p, 'y'), Ag = b*h, sq = Math.sqrt(fc);
  const rho = B.Ast/Ag, rhoOk = rho >= 0.01 - 1e-9;      // cuantía mínima 1 % de Ag (C.10.9.1, pedido de Amo 28-oct); la máxima 4 % queda informativa
  // Esbeltez (C.10.10.1): k·lu/r ≤ 22, r = 0.3·dimensión
  const k = num(p.k, 2), esbX = k*Hp/(0.3*h), esbY = k*Hp/(0.3*b);
  // Cortante (C.11): d = dim − rec − estribo − db/2
  const de = B.de, Ae = barra(p.est)[1], dX = b - rec - de - B.db/2, dY = h - rec - de - B.db/2;
  const rx = Math.max(2, num(p.ramasX, 2)), ry = Math.max(2, num(p.ramasY, 2));
  const sConf = num(p.sConf), sFuera = num(p.sFuera);
  // Confinamiento C.21.3.5 (DMO)
  const so = Math.min(8*B.db, 16*de, Math.min(b, h)/3, 150);
  const Lo = Math.max(Hp/6, Math.max(b, h), 500);
  const bcX = b - 2*rec, bcY = h - 2*rec, Ach = bcX*bcY;
  const ashS = bc => Math.max(0.2*bc*fc/fy*(Ag/Ach - 1), 0.06*bc*fc/fy);   // Ash/s requerido [mm²/mm]
  const sAshX = rx*Ae/ashS(bcY), sAshY = ry*Ae/ashS(bcX);                    // ramas paralelas a x confinan el núcleo de alto bc_y
  const sConfMax = Math.min(so, sAshX, sAshY);
  const sFueraMax = Math.min(dX/2, dY/2, 16*B.db, 48*de, Math.min(b, h));
  // Anclaje de las barras del pedestal dentro de la zapata (C.15.8 / C.12.5 y C.12.3)
  const hz = num(p.hz), disp = hz > 0 ? hz - num(p.recZ, 75) - 2*barra(p.barZ)[0] : 0;
  const anc = { disp, ldh:ldh(B.db, fy, fc), ldc:ldc(B.db, fy, fc) }; anc.ok = disp > 0 && Math.max(anc.ldh, anc.ldc) <= disp;
  // Revisión por combinación (fuerzas del mismo instante); momentos en la base = M + V·Hp
  const filas = [];
  for(const f of resistencia){
    const Pu = f.F3*1000, Mux = (Math.abs(f.M1) + Math.abs(f.F2)*Hp/1000)*1e6, Muy = (Math.abs(f.M2) + Math.abs(f.F1)*Hp/1000)*1e6;
    const Vx = Math.abs(f.F1)*1000, Vy = Math.abs(f.F2)*1000;
    const mx = phiMnEn(dgx, Pu), my = phiMnEn(dgy, Pu);
    let rel, met;
    if(Pu > dgx.phiPnMax){ rel = Pu/dgx.phiPnMax; met = 'Pu > φPn,máx'; }
    else if(Pu >= 0.1*fc*Ag && Mux > 0 && Muy > 0){
      const Pnx = pnEn(dgx, Mux/Math.max(Pu, 1)), Pny = pnEn(dgy, Muy/Math.max(Pu, 1)), Po = dgx.Po;
      const Pni = 1/(1/Pnx + 1/Pny - 1/Po); rel = Pu/(0.65*Pni); met = 'Bresler (C.10.3)';
    } else { rel = (mx > 0 ? Mux/mx : 9) + (my > 0 ? Muy/my : 9); met = 'Mux/φMnx + Muy/φMny'; }
    const vc = (dd, bw) => 0.17*(1 + Math.max(0, Pu)/(14*Ag))*sq*bw*dd;
    const cort = (V, dd, bw, ramas) => { const Vc = vc(dd, bw), Vs = Math.max(0, V/0.75 - Vc), Av = ramas*Ae;
      const sReq = Vs > 0 ? Av*fy*dd/Vs : Infinity, sMax = Vs > 0.33*sq*bw*dd ? dd/4 : dd/2, Avmin = Math.max(0.062*sq*bw/fy, 0.35*bw/fy);
      return { Vu:V, Vc, phiVc:0.75*Vc, Vs, VsMax:0.66*sq*bw*dd, sReq, sMax, Avmin, Av, rel:V/(0.75*(Vc + Av*fy*dd/Math.max(sFuera || sMax, 1))) }; };
    filas.push({ f, Pu, Mux, Muy, Vx, Vy, mx, my, rel, met, cx:cort(Vx, dX, h, ry), cy:cort(Vy, dY, b, rx) });
  }
  const gob = filas.reduce((a, c) => c.rel > a.rel ? c : a, filas[0]);
  const gobV = filas.reduce((a, c) => Math.max(c.cx.rel, c.cy.rel) > Math.max(a.cx.rel, a.cy.rel) ? c : a, filas[0]);
  const relV = Math.max(gobV.cx.rel, gobV.cy.rel);
  const sOk = sConf > 0 ? sConf <= sConfMax + 0.5 : null, sfOk = sFuera > 0 ? sFuera <= sFueraMax + 0.5 : null;
  const ratio = Math.max(gob.rel, relV);
  return { ok:true, b, h, Hp, rec, fc, fy, Ag, ...B, rho, dgx, dgy, esbX, esbY, esbOk:Math.max(esbX, esbY) <= 22, dX, dY, so, Lo, bcX, bcY, Ach, ashX:ashS(bcY), ashY:ashS(bcX),
    sAshX, sAshY, sConfMax, sFueraMax, sConf, sFuera, sOk, sfOk, anc, filas, gob, gobV, relV, ratio, rhoOk, AstMin:0.01*Ag,
    cumple: ratio <= 1 && rhoOk && Math.max(esbX, esbY) <= 22 && sOk !== false && sfOk !== false && (hz > 0 ? anc.ok : true) };
}

const api = { BARRAS, ALFA_S, beta1, ld, ldh, ldc, zapata, pedestal, diagrama, barrasPed, phiMnEn, pnEn };
if(typeof module !== 'undefined') module.exports = api; else root.Concreto = api;
})(typeof window !== 'undefined' ? window : globalThis);
