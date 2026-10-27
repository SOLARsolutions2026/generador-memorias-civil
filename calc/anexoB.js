/* ═══ Anexo B — Fuerza horizontal equivalente (NSR-10, Título A) ═══
   Cálculo puro. Origen: plantilla Excel de Amo, con correcciones acordadas el 26-oct-2026:
   Sa del cortante según el periodo (no fijo en la meseta), tramos del espectro por To/Tc/TL,
   Fa y Fv interpolados de las tablas A.2.4-3/4, g = 9.81, k según A.4.3.2. */
(function(root){
'use strict';
const G = 9.81;
const num = (v, d=0) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : d; };

// Tablas A.2.4-3 (Fa) y A.2.4-4 (Fv): columnas para Aa/Av = 0.1, 0.2, 0.3, 0.4, 0.5
const FA = { A:[0.8,0.8,0.8,0.8,0.8], B:[1.0,1.0,1.0,1.0,1.0], C:[1.2,1.2,1.1,1.0,1.0], D:[1.6,1.4,1.2,1.1,1.0], E:[2.5,1.7,1.2,0.9,0.9] };
const FV = { A:[0.8,0.8,0.8,0.8,0.8], B:[1.0,1.0,1.0,1.0,1.0], C:[1.7,1.6,1.5,1.4,1.3], D:[2.4,2.0,1.8,1.6,1.5], E:[3.5,3.2,2.8,2.4,2.4] };
const IMP = { I:1.00, II:1.10, III:1.25, IV:1.50 };                 // Tabla A.2.5-1
const GRUPOS = { I:'I — Estructuras de ocupación normal', II:'II — Estructuras de ocupación especial', III:'III — Edificaciones de atención a la comunidad', IV:'IV — Edificaciones indispensables' };
const SUELOS = { A:'A — Roca competente', B:'B — Roca de rigidez media', C:'C — Suelos muy densos o roca blanda', D:'D — Suelos rígidos', E:'E — Suelos blandos' };
const SISTEMAS = [ // Tabla A.4.2-1
  { nombre:'Pórticos de acero estructural resistentes a momento', Ct:0.072, a:0.80 },
  { nombre:'Pórticos de concreto reforzado resistentes a momento', Ct:0.047, a:0.90 },
  { nombre:'Pórticos de acero arriostrados excéntricamente', Ct:0.073, a:0.75 },
  { nombre:'Otros sistemas estructurales', Ct:0.049, a:0.75 },
];

// Biblioteca de perfiles: peso por metro [kg/m]. IPE/HEA/HEB según tablas Euronorm;
// tubos A500 calculados con 7850 kg/m³ y esquinas rectas: A = 2t(b+h−2t) (aproximado)
const tubo = (b, h, t) => Math.round(2 * t * (b + h - 2 * t) * 7.85e-3 * 100) / 100;
const PERFILES = (() => {
  const P = {};
  for(const [n,w] of [[80,6.0],[100,8.1],[120,10.4],[140,12.9],[160,15.8],[180,18.8],[200,22.4],[220,26.2],[240,30.7],[270,36.1],[300,42.2],[330,49.1],[360,57.1],[400,66.3]]) P['IPE '+n] = w;
  for(const [n,w] of [[100,16.7],[120,19.9],[140,24.7],[160,30.4],[180,35.5],[200,42.3],[220,50.5],[240,60.3],[260,68.2],[280,76.4],[300,88.3]]) P['HEA '+n] = w;
  for(const [n,w] of [[100,20.4],[120,26.7],[140,33.7],[160,42.6],[180,51.2],[200,61.3],[220,71.5],[240,83.2]]) P['HEB '+n] = w;
  for(const [b,h,t] of [[50,50,2],[60,60,2],[75,75,2],[90,90,2],[100,100,2],[100,100,3],[120,120,3],[150,150,3],[100,50,2],[120,60,2],[150,50,2],[150,75,2],[200,100,3]])
    P[`Tubo ${b}×${h}×${t}`] = (b === 120 && h === 60 && t === 2) ? 5.59 : tubo(b, h, t);   // 120×60×2: valor de la plantilla de Amo
  return P;
})();

function interp(fila, x){ // interpola en columnas 0.1…0.5 (fuera de rango toma el extremo)
  const xs = [0.1,0.2,0.3,0.4,0.5];
  if(x <= xs[0]) return fila[0]; if(x >= xs[4]) return fila[4];
  const i = xs.findIndex(v => v >= x), f = (x - xs[i-1]) / (xs[i] - xs[i-1]);
  return fila[i-1] + (fila[i] - fila[i-1]) * f;
}
function defaults(){
  return { aplica:true, texto:'', metodo:'tabla', depto:'', munCode:'', lat:'', lon:'', mapa:'aa', Aa:'', Av:'', suelo:'D', FaManual:'', FvManual:'', grupo:'I', sistema:0, h:'', Tx:'', Ty:'',
    area:'', dimX:'', dimY:'', excent:0.05, Vtx:'', Vty:'', irregular:false,
    items:{},                                                   // ① { clave: { on, area } } de las cargas del Anexo A
    estructura:{ modo:'lista', perfiles:[], sapKN:'', sapFuente:'SAP2000 — Material List by Section', sapImg:'' },   // ②
    otras:[],                                                   // ③ [{ n, cant, unidad, pu, ubic }]
    iter:[], notaIter:'' };                                     // historial de iteraciones con SAP2000 [{ n, fecha, nota, W, Tx, Ty, VsX, VsY, Vtx, Vty, fX, fY, pct, ok }]
}
// Foto de los resultados actuales para el historial de iteraciones
function foto(B, R){
  const [mx, my] = R.modal, r3 = v => v == null ? null : Math.round(v * 1000) / 1000;
  return { W:r3(R.W), Tx:r3(R.tx.T), Ty:r3(R.ty.T), VsX:r3(R.tx.Vs), VsY:r3(R.ty.Vs), Vtx:r3(mx.Vt), Vty:r3(my.Vt),
    fX: mx.Vt ? r3(mx.factor) : null, fY: my.Vt ? r3(my.factor) : null, pct:R.pct, ok: R.modal.every(r => r.Vt && r.okV) };
}
const mismaFoto = (a, b) => !!a && !!b && ['W','Tx','Ty','Vtx','Vty','pct'].every(k => a[k] === b[k]);
// Sa en fracción de g (A.2.6): meseta, tramo 1/T y tramo 1/T²
function Sa(T, p){
  if(T <= p.Tc) return 2.5 * p.Aa * p.Fa * p.I;
  if(T <= p.TL) return 1.2 * p.Av * p.Fv * p.I / T;
  return 1.2 * p.Av * p.Fv * p.TL * p.I / (T * T);
}
const kExp = T => T <= 0.5 ? 1 : T <= 2.5 ? 0.75 + 0.5 * T : 2;   // A.4.3.2

const clave = n => String(n).toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
// Cargas por área que vienen del Anexo A (kg/m² de planta)
function cargasDeA(A, RA){
  const out = [];
  if(RA?.paneles){ const p = RA.paneles, Lp = num(A.panel.L);
    out.push({ n:`Panel solar ${A.panel.nombre || ''}`.trim(), w:p.wPanel });
    if(Lp > 0) out.push({ n:`Riel ${A.riel.nombre || ''} (2 por panel)`.trim(), w:num(A.riel.peso) * 2 / Lp });
    for(const x of p.ext) out.push(x);
  }
  if(RA?.lamina) for(const x of RA.lamina.items) out.push(x);
  return out;
}

function calcular(B, A, RA){
  const v = A?.viento || {};
  const Aa = num(B.Aa), Av = num(B.Av);
  const faltan = [];
  if(!(Aa > 0)) faltan.push('Aa'); if(!(Av > 0)) faltan.push('Av');
  const FaT = interp(FA[B.suelo] || FA.D, Aa), FvT = interp(FV[B.suelo] || FV.D, Av);
  const Fa = num(B.FaManual) > 0 ? num(B.FaManual) : FaT, Fv = num(B.FvManual) > 0 ? num(B.FvManual) : FvT;
  const I = IMP[B.grupo] || 1;
  const p = { Aa, Av, Fa, Fv, I };
  p.To = Aa && Fa ? 0.1 * Av * Fv / (Aa * Fa) : 0;
  p.Tc = Aa && Fa ? 0.48 * Av * Fv / (Aa * Fa) : 0;
  p.TL = 2.4 * Fv;
  const sis = SISTEMAS[B.sistema] || SISTEMAS[0];
  const hA = num(v.Hr), h = num(B.h) > 0 ? num(B.h) : hA;
  if(!(h > 0)) faltan.push('altura h');
  const Ta = sis.Ct * Math.pow(h, sis.a);
  const Cu = Math.max(1.75 - 1.2 * Av * Fv, 1.2), CuTa = Cu * Ta;
  const dirT = Tdin => { const t = num(Tdin); return t > 0 ? { T:Math.min(t, CuTa), din:t, limitado:t > CuTa } : { T:Ta, din:null, limitado:false }; };
  const tx = dirT(B.Tx), ty = dirT(B.Ty);
  tx.Sa = Sa(tx.T, p); ty.Sa = Sa(ty.T, p); tx.k = kExp(tx.T); ty.k = kExp(ty.T);
  // Peso sísmico: cargas del Anexo A × área + peso propio (pendiente de definir cómo se ingresa)
  const areaAuto = num(v.L) * num(v.W), area = num(B.area) > 0 ? num(B.area) : areaAuto;
  // ① Cargas por área del Anexo A: cada una se puede quitar o aplicar en otra área
  const items = B.items || {};
  const cargas = cargasDeA(A, RA).map(x => { const key = clave(x.n), it = items[key] || {};
    const on = it.on !== false, ar = num(it.area) > 0 ? num(it.area) : area;
    return { ...x, key, on, area:ar, kN: on ? x.w * ar * G / 1000 : 0 }; });
  const wArea = cargas.filter(x => x.on).reduce((s, x) => s + x.w, 0);
  const Wcargas = cargas.reduce((s, x) => s + x.kN, 0);
  // ② Peso propio de la estructura
  const est = B.estructura || {};
  const perfiles = (est.perfiles || []).map(p => { const kgmT = PERFILES[p.perfil];
    const kgm = num(p.kgm) > 0 ? num(p.kgm) : (kgmT || 0), L = num(p.L);
    return { ...p, kgmT, kgmU:kgm, Lm:L, kg:kgm * L, kN:kgm * L * G / 1000 }; });
  const Wprop = est.modo === 'sap' ? num(est.sapKN) : perfiles.reduce((s, p) => s + p.kN, 0);
  // ③ Otras cargas (anuncios, tanques, equipos…)
  const otras = (B.otras || []).map(o => ({ ...o, kN: num(o.cant) * num(o.pu) * G / 1000 }));
  const Wotras = otras.reduce((s, o) => s + o.kN, 0);
  const W = Wcargas + Wprop + Wotras;
  tx.Vs = tx.Sa * W; ty.Vs = ty.Sa * W;                                            // Vs = Sa·g·M = Sa·W (A.4.3-1)
  // Torsión accidental (A.3.6.7.1): excentricidad 5 % de la dimensión perpendicular a la fuerza
  const dimX = num(B.dimX) > 0 ? num(B.dimX) : num(v.L), dimY = num(B.dimY) > 0 ? num(B.dimY) : num(v.W), e = num(B.excent, 0.05);
  const MtX = tx.Vs * e * dimY, MtY = ty.Vs * e * dimX;   // fuerza en X → brazo en Y; fuerza en Y → brazo en X
  // Comparación con el análisis modal de SAP2000 (A.4.2.1 y A.5.4.5)
  const pct = B.irregular ? 0.90 : 0.80;
  const modal = [['X', tx, num(B.Vtx)], ['Y', ty, num(B.Vty)]].map(([dir, t, Vt]) => {
    const r = { dir, Tdin:t.din, Ta, relTa: t.din ? t.din / Ta : null, CuTa, okT: t.din ? t.din <= CuTa : null, Vs:t.Vs, Vt: Vt > 0 ? Vt : null, pct };
    if(r.Vt){ r.rel = r.Vt / t.Vs; r.Vmin = pct * t.Vs; r.okV = r.Vt >= r.Vmin; r.factor = r.okV ? 1 : r.Vmin / r.Vt; }
    return r; });
  // Puntos del espectro para la gráfica
  const Tmax = Math.max(6, p.TL * 1.15), pts = [];
  if(Aa > 0 && Av > 0) for(let t = 0; t <= Tmax + 1e-9; t += Tmax / 240) pts.push([t, Sa(t, p)]);
  return { ok: !faltan.length, faltan, p, FaT, FvT, sis, h, hA, Ta, Cu, CuTa, tx, ty, areaAuto, area, cargas, wArea, Wcargas, perfiles, Wprop, otras, Wotras, W,
    dimX, dimY, e, MtX, MtY, modal, pct, pts, Tmax };
}

const api = { foto, mismaFoto, G, PERFILES, clave, FA, FV, IMP, GRUPOS, SUELOS, SISTEMAS, defaults, calcular, Sa, kExp, interp, num };
if(typeof module !== 'undefined') module.exports = api; else root.AnexoB = api;
})(typeof window !== 'undefined' ? window : globalThis);
