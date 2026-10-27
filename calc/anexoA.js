/* ═══ Anexo A — Cargas muerta, viva y de viento (NSR-10) ═══
   Funciones de cálculo puras: reciben los datos y devuelven resultados.
   No tocan la pantalla, así se pueden probar solas.
   Origen: plantillas Excel de Amo (paneles solares, láminas metálicas, viento B.6.5),
   con las correcciones acordadas el 26-oct-2026. */
(function(root){
'use strict';
const G = 9.81; // gravedad [m/s²] para pasar kg a N

// ─── Catálogos fijos (de las plantillas) ───
const LAMINAS = { // materiales de cubierta: los metálicos van por calibre (kg/m de lámina y ancho útil), los demás en kg/m²
  master1000: { nombre:'Lámina metálica galvanizada tipo Master 1000', fuente:'Catálogo del fabricante', calibres:{ 28:{ancho:1.08,peso:3.115}, 26:{ancho:1.08,peso:4.05}, 24:{ancho:1.08,peso:5.49} } },
  canaleta:   { nombre:'Canaleta metálica galvanizada', fuente:'Catálogo del fabricante', calibres:{ 24:{ancho:0.90,peso:5.49},  22:{ancho:0.90,peso:7.12}, 20:{ancho:0.90,peso:8.55} } },
  zinc:       { nombre:'Teja de zinc ondulada', w:5,  fuente:'Valor típico de fabricante (no figura en la Tabla B.3.4.1-4)' },
  eternit:    { nombre:'Teja de fibrocemento (Eternit)', w:20, fuente:'NSR-10 Tabla B.3.4.1-4 — cubiertas corrugadas de asbesto-cemento' },
  arcilla:    { nombre:'Teja de arcilla (barro), con mortero', w:80, fuente:'NSR-10 Tabla B.3.4.1-4 — teja de arcilla incluyendo el mortero' },
  otra:       { nombre:'Otro material de cubierta', w:0, fuente:'Valor escrito por el diseñador' },
};
const CIELOS = { // kg/m², editables
  'PVC':5, 'Drywall':15, 'Fibrocemento':20, 'Machimbre':15, 'Icopor':5, 'Cielo raso registrable':10 };
const EXTRAS_DEF = { ductoE:{ n:'Ductería eléctrica', w:5 }, ductoM:{ n:'Ductería mecánica', w:20 }, lum:{ n:'Iluminaria suspendida', w:5 } }; // ductos mecánicos: NSR-10 Tabla B.3.4.1-1
const GRUPOS = { // Tabla B.6.5-1 — factor de importancia I [no huracán, huracán]
  'I':   { nombre:'I — Estructuras de ocupación normal',            I:[0.87,0.77] },
  'II':  { nombre:'II — Estructuras de ocupación especial',         I:[1.00,1.00] },
  'III': { nombre:'III — Edificaciones de atención a la comunidad', I:[1.15,1.15] },
  'IV':  { nombre:'IV — Edificaciones indispensables',              I:[1.15,1.15] },
};
const VELOCIDADES = [17, 22, 28, 33, 36]; // Figura B.6.4-1 [m/s]
const EXPO = { B:{alfa:7.0, zg:365.8}, C:{alfa:9.5, zg:274.3}, D:{alfa:11.5, zg:213.4} }; // Tabla B.6.5-2
const SISTEMAS = [ // Tabla A.4.2-1 — periodo aproximado Ta = Ct·h^α
  { nombre:'Pórticos de acero estructural resistentes a momento', Ct:0.072, a:0.80 },
  { nombre:'Pórticos de concreto reforzado resistentes a momento', Ct:0.047, a:0.90 },
  { nombre:'Pórticos de acero arriostrados excéntricamente',      Ct:0.073, a:0.75 },
  { nombre:'Otros sistemas estructurales',                        Ct:0.049, a:0.75 },
];
// Figura B.6.5-18A (cubierta libre a un agua, SPRFV): θ → caso → [γ=0: libre CNW, CNL, obstruido CNW, CNL, γ=180: igual]
const CN_SPRFV = {
  0:   { A:[ 1.2, 0.3,-0.3,-1.2,  1.2, 0.3,-0.5,-1.2], B:[-1.1,-0.1,-1.1,-0.6, -1.1,-0.1,-1.1,-0.6] },
  7.5: { A:[-0.6,-1.0,-1.0,-1.5,  0.9, 1.5,-0.2,-1.2], B:[-1.4, 0.0,-1.7,-0.8,  1.6, 0.3, 0.8,-0.3] },
  15:  { A:[-0.9,-1.3,-1.1,-1.5,  1.3, 1.6, 0.4,-1.1], B:[-1.9, 0.0,-2.1,-0.6,  1.8, 0.6, 1.2,-0.3] },
  22.5:{ A:[-1.5,-1.6,-1.5,-1.7,  1.7, 1.8, 0.5,-1.0], B:[-2.4,-0.3,-2.3,-0.9,  2.2, 0.7, 1.3, 0.0] },
  30:  { A:[-1.8,-1.8,-1.5,-1.8,  2.1, 2.1, 0.6,-1.0], B:[-2.5,-0.5,-2.3,-1.1,  2.6, 1.0, 1.6, 0.1] },
  37.5:{ A:[-1.8,-1.8,-1.5,-1.8,  2.1, 2.2, 0.7,-0.9], B:[-2.4,-0.6,-2.2,-1.1,  2.7, 1.1, 1.9, 0.3] },
  45:  { A:[-1.6,-1.8,-1.3,-1.8,  2.2, 2.5, 0.8,-0.9], B:[-2.3,-0.7,-1.9,-1.2,  2.6, 1.4, 2.1, 0.4] },
};
// Figura B.6.5-19A (cubierta libre a un agua, componentes): θ → clase de área → flujo → [z3+, z3−, z2+, z2−, z1+, z1−]
const CN_CYR = {
  0:   { a1:{libre:[2.4,-3.3,1.8,-1.7,1.2,-1.1], obst:[1.0,-3.6,0.8,-1.8,0.5,-1.2]},
         a2:{libre:[1.8,-1.7,1.8,-1.7,1.2,-1.1], obst:[0.8,-1.8,0.8,-1.8,0.5,-1.2]},
         a3:{libre:[1.2,-1.1,1.2,-1.1,1.2,-1.1], obst:[0.5,-1.2,0.5,-1.2,0.5,-1.2]} },
  7.5: { a1:{libre:[3.2,-4.2,2.4,-2.1,1.6,-1.4], obst:[1.6,-5.1,1.2,-2.6,0.8,-1.7]},
         a2:{libre:[2.4,-2.1,2.4,-2.1,1.6,-1.4], obst:[1.2,-2.6,1.2,-2.6,0.8,-1.7]},
         a3:{libre:[1.6,-1.4,1.6,-1.4,1.6,-1.4], obst:[0.8,-1.7,0.8,-1.7,0.8,-1.7]} },
  15:  { a1:{libre:[3.6,-3.4,2.7,-2.9,1.8,-1.9], obst:[2.4,-4.2,1.8,-3.2,1.2,-2.1]},
         a2:{libre:[2.7,-3.9,2.7,-2.9,1.8,-1.9], obst:[1.8,-3.2,1.8,-3.2,1.2,-2.1]},
         a3:{libre:[1.8,-1.9,1.8,-1.9,1.8,-1.9], obst:[1.2,-2.1,1.2,-2.1,1.2,-2.1]} },
  30:  { a1:{libre:[5.2,-5.0,3.9,-3.8,2.6,-2.5], obst:[3.2,-4.6,2.4,-3.5,1.6,-2.3]},
         a2:{libre:[3.9,-3.8,3.9,-3.8,2.6,-2.5], obst:[2.4,-3.5,2.4,-3.5,1.6,-2.3]},
         a3:{libre:[2.6,-2.5,2.6,-2.5,2.6,-2.5], obst:[1.6,-2.3,1.6,-2.3,1.6,-2.3]} },
  45:  { a1:{libre:[5.2,-4.6,3.9,-3.5,2.6,-2.3], obst:[4.2,-3.8,3.2,-2.9,2.1,-1.9]},
         a2:{libre:[3.9,-3.5,3.9,-3.5,2.6,-2.3], obst:[3.2,-2.9,3.2,-2.9,2.1,-1.9]},
         a3:{libre:[2.6,-2.3,2.6,-2.3,2.6,-2.3], obst:[2.1,-1.9,2.1,-1.9,2.1,-1.9]} },
};

const r3 = x => Math.ceil(x * 1000 - 1e-9) / 1000; // redondeo hacia arriba a 3 decimales (como ROUNDUP del Excel)
const num = (v, d=0) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : d; };

// Interpolación lineal en una tabla indexada por ángulo
function interpTabla(tabla, theta, sacar, minAng){
  const angs = Object.keys(tabla).map(Number).sort((a,b) => a-b);
  let t = Math.max(angs[0], Math.min(angs[angs.length-1], theta));
  if(minAng != null && t < minAng) t = angs[0]; // SPRFV: θ < 7.5° se usa 0°
  let i = angs.findIndex(a => a >= t); if(angs[i] === t) return sacar(tabla[angs[i]]).slice();
  const a0 = angs[i-1], a1 = angs[i], v0 = sacar(tabla[a0]), v1 = sacar(tabla[a1]), f = (t-a0)/(a1-a0);
  return v0.map((v, k) => Math.round((v + (v1[k]-v)*f) * 1000) / 1000);
}

// Valores iniciales de una memoria nueva
function defaults(){
  return {
    tipo:{ paneles:true, lamina:false },
    panel:{ nombre:'TRINASOLAR 700-720W', L:2.382, W:1.31, peso:38.3 },
    riel:{ nombre:'Alurack Master Rail', alto:0.06, ancho:0.04, peso:0.906 },
    dBorde:0.40, tribRiel:'', qMant:15,
    lamina:{ perfil:'master1000', calibre:24, wManual:'', sep:1.61 },
    extras:{ cielo:{ aplica:false, tipo:'Drywall', w:15 }, ductoE:{ aplica:false, w:5 }, ductoM:{ aplica:false, w:20 }, lum:{ aplica:false, w:5 }, otras:[] },
    Lr:50,
    viento:{ grupo:'I', huracan:false, V:22, L:'', W:'', He:'', Hr:'', rug:'B', distRug:'', cercaD:false, distD:'',
      expManual:'', kzt:[false,false,false,false,false], kztManual:1, flujo:'libre', sistema:0, Gmanual:'', luz:1.60, fuente:'sprfv' },
  };
}

// ─── Cargas adicionales por área (cielo raso, ductos, luminarias, otras) ───
function extras(A){
  const e = A.extras || {}, out = [];
  if(e.cielo?.aplica) out.push({ n:`Cielo raso — ${e.cielo.tipo}`, w:num(e.cielo.w) });
  for(const k of ['ductoE','ductoM','lum']) if(e[k]?.aplica) out.push({ n:EXTRAS_DEF[k].n, w:num(e[k].w) });
  for(const o of (e.otras || [])) if((o.n || '').trim() || num(o.w)) out.push({ n:(o.n || 'Otra carga').trim(), w:num(o.w) });
  return out;
}

// ─── Carga muerta y viva: paneles solares sobre rieles ───
function paneles(A){
  const p = A.panel, L = num(p.L), W = num(p.W), peso = num(p.peso), dB = num(A.dBorde, 0.4);
  const wPanel = L && W ? peso / (L*W) : 0;                 // kg/m²
  const tribAuto = L / 2;                                    // cada riel recibe la mitad del panel
  const trib = num(A.tribRiel, 0) > 0 ? num(A.tribRiel) : tribAuto;
  const sepRieles = L - 2*dB;
  const kgmPanel = wPanel * trib;                            // kg/m sobre el riel
  const Dpanel = kgmPanel * G / 1000, Driel = num(A.riel.peso) * G / 1000;
  // si no hay cubierta de lámina/teja, las cargas adicionales cuelgan de la estructura de paneles
  const ext = A.tipo.lamina ? [] : extras(A), wExt = ext.reduce((a, x) => a + x.w, 0), Dext = wExt * trib * G / 1000;
  const D = Dpanel + Driel + Dext;
  const qM = num(A.qMant, 15), Lm = qM * trib * G / 1000;
  return { wPanel, trib, tribAuto, sepRieles, areaTrib: trib*W, kgmPanel, Dpanel, Driel, ext, wExt, Dext, D, Dr:r3(D), qM, L:Lm, Lr3:r3(Lm) };
}

// ─── Carga muerta y viva: cubierta en lámina sobre correas ───
function lamina(A){
  const l = A.lamina, mat = LAMINAS[l.perfil] || LAMINAS.master1000, s = num(l.sep);
  let wAuto = 0, cal = null;
  if(mat.calibres){ cal = mat.calibres[l.calibre]; wAuto = cal ? cal.peso / cal.ancho : 0; } // kg/m de lámina ÷ ancho útil = kg/m²
  else wAuto = mat.w;
  const manual = num(l.wManual, 0) > 0, wLam = manual ? num(l.wManual) : wAuto;
  const nomMat = mat.calibres ? `${mat.nombre} cal. ${l.calibre}` : mat.nombre;
  const items = [{ n:nomMat, w:wLam }, ...extras(A)];
  const wTot = items.reduce((a, x) => a + x.w, 0);
  const kgm = wTot * s;                                       // ancho aferente de la correa = separación (s/2 a cada lado)
  const D = kgm * G / 1000;
  const Lr = num(A.Lr, 50), Lm = Lr * s * G / 1000;
  return { perfil:mat.nombre, nomMat, metal:!!mat.calibres, calibre:l.calibre, ancho:cal?.ancho, pesoLin:cal?.peso, calOk:!mat.calibres || !!cal,
    wAuto, manual, fuente: manual ? 'Valor escrito por el diseñador' : mat.fuente, wLam, items, wTot, s, kgm, D, Dr:r3(D), Lr, L:Lm, Lr3:r3(Lm) };
}

// ─── Viento: método analítico B.6.5, cubierta libre a un agua (B.6.5.13) ───
function exposicion(v, hm){
  const h20 = 20 * hm, d = num(v.distRug, 0), dD = num(v.distD, 0);
  const limB = hm <= 9 ? 460 : Math.max(800, h20), limD = Math.max(1500, h20), limDvecina = Math.max(200, h20);
  let prop = 'C', razon = 'No se cumplen las condiciones de B ni de D (B.6.5.6.3).';
  if(v.rug === 'D' && d > limD){ prop = 'D'; razon = `Rugosidad D viento arriba en ${d} m > ${limD} m.`; }
  else if(v.cercaD && dD > 0 && dD <= limDvecina){ prop = 'D'; razon = `A ${dD} m de un terreno D (≤ ${limDvecina} m): se extiende la exposición D.`; }
  else if(v.rug === 'B' && d >= limB){ prop = 'B'; razon = `Rugosidad B viento arriba en ${d} m ≥ ${limB} m.`; }
  else if(v.rug === 'B') razon = `Rugosidad B solo en ${d} m (< ${limB} m requeridos): aplica C.`;
  const usada = ['B','C','D'].includes(v.expManual) ? v.expManual : prop;
  return { prop, razon, usada, manual: usada !== prop, limB, limD, limDvecina };
}
function Kz(exp, z, caso){
  const e = EXPO[exp]; let zz = Math.max(z, 4.0);
  if(exp === 'B' && caso === 1) zz = Math.max(zz, 9.0);       // Nota de la tabla B.6.5-3
  return 2.01 * Math.pow(zz / e.zg, 2 / e.alfa);
}
function viento(A, elementos){
  const v = A.viento, L = num(v.L), W = num(v.W), He = num(v.He), Hr = num(v.Hr);
  const faltan = [['L',L],['W',W],['He',He],['Hr',Hr]].filter(x => !(x[1] > 0)).map(x => x[0]);
  if(faltan.length) return { ok:false, faltan };
  const theta = Hr > He ? Math.atan((Hr - He) / W) * 180 / Math.PI : 0;
  const hm = (He + Hr) / 2;
  const g = GRUPOS[v.grupo] || GRUPOS.I, I = g.I[v.huracan ? 1 : 0];
  const V = num(v.V, 22);
  const ex = exposicion(v, hm);
  const kztCumple = v.kzt.every(Boolean), Kzt = kztCumple ? num(v.kztManual, 1) : 1;
  const Kd = 0.85;                                            // Tabla B.6.5-4: edificios / cubiertas
  const Kz2 = Kz(ex.usada, hm, 2), Kz1 = Kz(ex.usada, hm, 1);
  const qh2 = 0.613 * Kz2 * Kzt * Kd * V*V * I;               // N/m² — sistema principal (caso 2)
  const qh1 = 0.613 * Kz1 * Kzt * Kd * V*V * I;               // N/m² — componentes (caso 1)
  const sis = SISTEMAS[v.sistema] || SISTEMAS[0];
  const Ta = sis.Ct * Math.pow(hm, sis.a), f = 1 / Ta;
  const rigida = f > 1;
  const Gr = num(v.Gmanual, 0) > 0 ? num(v.Gmanual) : 0.85;
  const fl = v.flujo === 'obst' ? 2 : 0;
  // Sistema principal (SPRFV)
  const sp = [];
  for(const caso of ['A','B']) for(const gam of [0,180]){
    const cn = interpTabla(CN_SPRFV, theta, t => t[caso], 7.5), o = (gam ? 4 : 0) + fl;
    const CNW = cn[o], CNL = cn[o+1];
    sp.push({ caso, gam, CNW, CNL, pW: CNW * qh2 * Gr / 1000, pL: CNL * qh2 * Gr / 1000 });
  }
  // Componentes y revestimiento (CyR)
  const dmin = Math.min(L, W);
  const aCalc = Math.min(0.1 * dmin, 0.4 * hm), aMin = Math.max(0.04 * dmin, 1.0), a = Math.max(aCalc, aMin);
  const z1 = Math.max(0, (L - 4*a) * (W - 4*a)), z12 = Math.max(0, (L - 2*a) * (W - 2*a));
  const zonas = { z3: L*W - z12, z2: z12 - z1, z1 };
  const pMin = 0.40;                                          // kN/m², presión mínima de diseño
  const porElem = elementos.map(el => {
    const luz = num(el.luz, 1.6), Ae = luz * Math.max(el.trib, luz / 3);
    const clase = Ae <= a*a ? 'a1' : Ae <= 4*a*a ? 'a2' : 'a3';
    const cn = interpTabla(CN_CYR, theta, t => t[clase][v.flujo === 'obst' ? 'obst' : 'libre']);
    const cyr = [3,2,1].map((zn, k) => ({ zona:zn, CNp:cn[k*2], CNs:cn[k*2+1], pp:cn[k*2]*qh1*Gr/1000, ps:cn[k*2+1]*qh1*Gr/1000 }));
    const fuente = v.fuente === 'cyr' ? 'cyr' : 'sprfv';
    let pPres, pSucc;
    if(fuente === 'cyr'){ pPres = Math.max(...cyr.map(z => z.pp)); pSucc = Math.max(...cyr.map(z => -z.ps)); }
    else { const all = sp.flatMap(x => [x.pW, x.pL]); pPres = Math.max(0, ...all); pSucc = Math.max(0, ...all.map(x => -x)); }
    const dPres = Math.max(pPres, pMin), dSucc = Math.max(pSucc, pMin);
    return { ...el, luz, Ae, clase, cyr, fuente, pPres, pSucc, dPres, dSucc, Wp: r3(dPres * el.trib), Ws: r3(dSucc * el.trib) };
  });
  return { ok:true, theta, hm, aviso18: hm > 18, I, grupo:g.nombre, V, ex, kztCumple, Kzt, Kd, Kz1, Kz2, qh1, qh2,
    sis, Ta, f, rigida, G:Gr, sp, a, aCalc, aMin, zonas, pMin, porElem };
}

// ─── Todo junto ───
function calcular(A){
  const out = { paneles:null, lamina:null, viento:null };
  const elems = [];
  if(A.tipo.paneles){ out.paneles = paneles(A); elems.push({ id:'riel', nombre:'Riel de paneles', trib:out.paneles.trib, luz:A.viento.luz }); }
  if(A.tipo.lamina){ out.lamina = lamina(A); elems.push({ id:'correa', nombre:'Correa de cubierta', trib:out.lamina.s, luz:A.viento.luzCorrea || A.viento.luz }); }
  out.viento = viento(A, elems);
  return out;
}

const api = { G, LAMINAS, CIELOS, EXTRAS_DEF, extras, GRUPOS, VELOCIDADES, EXPO, SISTEMAS, CN_SPRFV, CN_CYR, defaults, calcular, paneles, lamina, viento, exposicion, Kz, interpTabla, r3, num };
if(typeof module !== 'undefined') module.exports = api; else root.AnexoA = api;
})(typeof window !== 'undefined' ? window : globalThis);
