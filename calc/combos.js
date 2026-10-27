/* ═══ Combinaciones de carga e irregularidades (cálculo puro, sin pantalla) ═══
   NSR-10 A.3.3 (irregularidades → R = φa·φp·φr·R0), B.2.4.2 (resistencia) y B.2.3.1 (servicio).
   Decisiones de Amo: la viva de cubiertas es Lr; el impacto de vehículos va en combinaciones aparte 1.2D + 1.0IMP + 1.0L. */
(function(root){
'use strict';
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };
const r3 = v => Math.round(v * 1000) / 1000;

const IRR_P = [ // Tabla A.3-6 — irregularidades en planta
  { k:'1aP', n:'Irregularidad torsional', phi:0.9 },
  { k:'1bP', n:'Irregularidad torsional extrema', phi:0.8 },
  { k:'2P',  n:'Retrocesos excesivos en las esquinas', phi:0.9 },
  { k:'3P',  n:'Discontinuidades en el diafragma', phi:0.9 },
  { k:'4P',  n:'Desplazamientos del plano de acción de elementos verticales', phi:0.8 },
  { k:'5P',  n:'Sistemas no paralelos', phi:0.9 },
];
const IRR_A = [ // Tabla A.3-7 — irregularidades en altura
  { k:'1aA', n:'Piso flexible (irregularidad en rigidez)', phi:0.9 },
  { k:'1bA', n:'Piso flexible (irregularidad extrema en rigidez)', phi:0.8 },
  { k:'2A',  n:'Irregularidad en la distribución de las masas', phi:0.9 },
  { k:'3A',  n:'Irregularidad geométrica', phi:0.9 },
  { k:'4A',  n:'Desplazamientos dentro del plano de acción', phi:0.8 },
  { k:'5aA', n:'Piso débil (discontinuidad en la resistencia)', phi:0.9 },
  { k:'5bA', n:'Piso débil (discontinuidad extrema en la resistencia)', phi:0.8 },
];
const R0S = [ // Tabla A.3-3 — pórticos de acero resistentes a momento
  { k:'des', n:'Pórtico de acero resistente a momento con disipación especial (DES)', R0:7.0 },
  { k:'dmo', n:'Pórtico de acero resistente a momento con disipación moderada (DMO)', R0:5.0 },
  { k:'dmi', n:'Pórtico de acero resistente a momento con disipación mínima (DMI)', R0:3.0 },
  { k:'otro', n:'Otro sistema (escribir R0)', R0:null },
];
// Símbolos de carga y su nombre
const SIMB = { D:'Muerta', Lr:'Viva de cubierta', W:'Viento', Ex:'Sismo X', Ey:'Sismo Y', Tx:'Torsión X', Ty:'Torsión Y', IMPx:'Impacto X', IMPy:'Impacto Y' };

function defaults(){
  return { irrP:{}, irrA:{}, notasIrr:{}, redundante:true, sisR:'dmo', R0:'',
    pat:{ D:'DEAD, DEAD SI', Lr:'LIVE', W:'WIND', Ex:'Fx', Ey:'Fy', Tx:'Tx', Ty:'Ty', IMPx:'IMPx', IMPy:'IMPy' }, patAuto:true,
    tor:{ nudos:'', nudosY:'', casoX:'', casoY:'', res:null }, redCalc:'', redImg:'', redNota:'',
    orto:true, servicio:true, servicioSismo:false, derivas:true, impacto:true, off:[], otras:[] };
}

// Patrones de SAP para cada símbolo, propuestos desde el modelo del Anexo C (si existe)
function patronesDeModelo(M, categoria){
  if(!M?.patrones?.length) return null;
  const c = p => categoria(p.n, p.tipo), ps = M.patrones;
  const de = f => ps.filter(f).map(p => p.n).join(', ');
  const xy = (cat, re, eje) => ps.filter(p => c(p) === cat && re.test(p.n) && new RegExp(eje + '$', 'i').test(p.n)).map(p => p.n).join(', ');
  return { D:de(p => c(p) === 'D'), Lr:de(p => c(p) === 'L'), W:de(p => c(p) === 'W'),
    Ex:xy('E', /^(F|S|E)/i, 'x'), Ey:xy('E', /^(F|S|E)/i, 'y'), Tx:xy('E', /^T/i, 'x'), Ty:xy('E', /^T/i, 'y'),
    IMPx:xy('N', /^IMP/i, 'x'), IMPy:xy('N', /^IMP/i, 'y') };
}

// Irregularidad torsional (Tabla A.3-6, 1aP / 1bP) con los desplazamientos de dos nudos extremos
// Δ = √(U1² + U2²); 1aP si Δmáx > 1.2·prom (φp 0.9); 1bP si Δmáx > 1.4·prom (φp 0.8)
function torsion(n1, n2){
  if(!n1 || !n2) return null;
  const d = n => Math.hypot(num(n.U1), num(n.U2)), D1 = d(n1), D2 = d(n2), prom = (D1 + D2) / 2, max = Math.max(D1, D2);
  const l12 = 1.2 * prom, l14 = 1.4 * prom;
  return { D1, D2, prom, max, l12, l14, tipo: max > l14 ? '1bP' : max > l12 ? '1aP' : null };
}

// R = φa · φp · φr · R0
function coefR(K){
  const pres = (lista, sel) => lista.filter(i => sel[i.k]);
  const p = pres(IRR_P, K.irrP || {}), a = pres(IRR_A, K.irrA || {});
  const phiP = p.length ? Math.min(...p.map(i => i.phi)) : 1, phiA = a.length ? Math.min(...a.map(i => i.phi)) : 1;
  const phiR = K.redundante === false ? 0.75 : 1;
  const sis = R0S.find(s => s.k === K.sisR) || R0S[1];
  const R0 = sis.R0 ?? num(K.R0);
  return { p, a, phiP, phiA, phiR, R0, R: r3(phiA * phiP * phiR * R0), irregular: !!(p.length || a.length), sis };
}

const T = (k, f) => ({ k, f });
const fmtF = f => (Math.round(f * 1000) / 1000).toString();
// Expresión legible: 1.2D + 1.6Lr − 0.3Ey
const expr = ts => ts.map((t, i) => `${t.f < 0 ? (i ? ' − ' : '−') : (i ? ' + ' : '')}${Math.abs(t.f) === 1 ? '' : fmtF(Math.abs(t.f))}${t.k}`).join('');

// Genera la lista completa (antes de quitar las desactivadas)
function generar(K, conSismo){
  const R = coefR(K), out = [];
  const add = (id, grupo, ref, ts, nota) => out.push({ id, grupo, ref, ts:ts.filter(t => t.f), nota });
  // Casos de sismo: E = ±Ex ± Tx ± 0.3Ey (y viceversa), todo dividido por R.
  // La torsión accidental se toma con los dos signos (excentricidad ±5 %, A.3.6.7); el 30 % ortogonal según A.3.6.3.
  const casosE = [];
  if(conSismo && R.R > 0){
    const e = 1 / R.R;
    for(const [P, S] of [['x','y'], ['y','x']])
      for(const sp of [1, -1]) for(const st of [1, -1]) for(const ss of (K.orto ? [1, -1] : [0])){
        const ts = [T('E' + P, sp * e), T('T' + P, st * e)];
        if(ss) ts.push(T('E' + S, ss * 0.3 * e));
        casosE.push({ P:P.toUpperCase(), sp, st, ss, ts });
      }
  }
  // Resistencia B.2.4.2 (L = 0: cubiertas, la viva es Lr)
  add('U1', 'Resistencia', 'B.2.4-1', [T('D', 1.4)]);
  add('U2', 'Resistencia', 'B.2.4-2', [T('D', 1.2), T('Lr', 0.5)]);
  add('U3', 'Resistencia', 'B.2.4-3', [T('D', 1.2), T('Lr', 1.6)]);
  add('U4', 'Resistencia', 'B.2.4-3', [T('D', 1.2), T('Lr', 1.6), T('W', 0.8)]);
  add('U5', 'Resistencia', 'B.2.4-4', [T('D', 1.2), T('W', 1.6), T('Lr', 0.5)]);
  add('U6', 'Resistencia', 'B.2.4-6', [T('D', 0.9), T('W', 1.6)]);
  casosE.forEach((c, i) => add(`U7-${i+1}`, 'Resistencia', 'B.2.4-5', [T('D', 1.2), ...c.ts], 'E = Fs/R'));
  casosE.forEach((c, i) => add(`U8-${i+1}`, 'Resistencia', 'B.2.4-7', [T('D', 0.9), ...c.ts], 'E = Fs/R'));
  // Servicio B.2.3.1
  if(K.servicio){
    add('S1', 'Servicio', 'B.2.3-1', [T('D', 1)]);
    add('S2', 'Servicio', 'B.2.3-3', [T('D', 1), T('Lr', 1)]);
    add('S3', 'Servicio', 'B.2.3-5', [T('D', 1), T('W', 1)]);
    add('S4', 'Servicio', 'B.2.3-6', [T('D', 1), T('W', 0.75), T('Lr', 0.75)]);
    add('S5', 'Servicio', 'B.2.3-7', [T('D', 0.6), T('W', 1)]);
    if(K.servicioSismo) casosE.forEach((c, i) => add(`S6-${i+1}`, 'Servicio', 'B.2.3-5', [T('D', 1), ...c.ts.map(t => T(t.k, t.f * 0.7))], '0.7E'));
    if(K.servicioSismo) casosE.forEach((c, i) => add(`S7-${i+1}`, 'Servicio', 'B.2.3-8', [T('D', 0.6), ...c.ts.map(t => T(t.k, t.f * 0.7))], '0.7E'));
  }
  // Derivas (A.6): fuerzas sísmicas sin dividir por R
  if(K.derivas && casosE.length){
    casosE.filter(c => c.sp === 1).forEach((c, i) => add(`DER${c.P}-${i % (K.orto ? 4 : 2) + 1}`, 'Derivas', 'A.6', c.ts.map(t => T(t.k, t.f * R.R)), 'Fs sin dividir por R'));
  }
  // Impacto de vehículos (combinación aparte, criterio de Amo)
  if(K.impacto){
    for(const [s, ax] of [[1, 'x'], [-1, 'x'], [1, 'y'], [-1, 'y']])
      add(`IMP${ax.toUpperCase()}${s > 0 ? '+' : '-'}`, 'Impacto', 'Criterio del diseñador', [T('D', 1.2), T('IMP' + ax, s), T('Lr', 1.0)]);
  }
  // Otras escritas a mano: "1.2D + 1.0IMPx"
  (K.otras || []).forEach((o, i) => { const ts = leerExpr(o.txt); if(ts.length) add(o.nom || `OTRA${i+1}`, 'Otras', 'Criterio del diseñador', ts); });
  return { lista:out, R, nE:casosE.length };
}

function leerExpr(txt){
  const ts = [], re = /([+\-−]?)\s*(\d*[.,]?\d*)\s*\*?\s*(IMPx|IMPy|Lr|Ex|Ey|Tx|Ty|D|W)\b/gi;
  let m; while((m = re.exec(String(txt || '')))){
    const sg = m[1] === '-' || m[1] === '−' ? -1 : 1, f = m[2] ? num(m[2]) : 1;
    const k = Object.keys(SIMB).find(s => s.toLowerCase() === m[3].toLowerCase());
    if(k) ts.push(T(k, sg * f));
  }
  return ts;
}

// Lista final con los factores por patrón de SAP
function calcular(K, conSismo){
  const G = generar(K, conSismo), off = new Set(K.off || []);
  const pats = Object.fromEntries(Object.keys(SIMB).map(k => [k, String(K.pat?.[k] || '').split(',').map(s => s.trim()).filter(Boolean)]));
  const faltaPat = new Set();
  const lista = G.lista.map(c => {
    const sap = {};
    for(const t of c.ts){ if(!pats[t.k].length) faltaPat.add(t.k); for(const p of pats[t.k]) sap[p] = r3((sap[p] || 0) + t.f); }
    return { ...c, txt:expr(c.ts), sap, on:!off.has(c.id) };
  });
  return { ...G, lista, activas:lista.filter(c => c.on), pats, faltaPat:[...faltaPat] };
}

// Texto para pegar en Excel / SAP (Load Combination Definitions)
function tablaSAP(lista){
  const filas = [['ComboName', 'ComboType', 'CaseName', 'ScaleSF']];
  for(const c of lista) for(const [p, f] of Object.entries(c.sap)) filas.push([c.id, 'Linear Add', p, f]);
  return filas.map(r => r.join('\t')).join('\n');
}

// Compara con las combinaciones que trae el modelo de SAP (Anexo C)
function compararSAP(lista, combosSAP){
  const firma = o => Object.entries(o).filter(([, f]) => f).map(([p, f]) => `${p.toUpperCase()}:${r3(f)}`).sort().join('|');
  const sapF = new Map((combosSAP || []).map(c => [firma(c.casos), c.n]));
  return lista.map(c => ({ id:c.id, txt:c.txt, en:sapF.get(firma(c.sap)) || null }));
}

const api = { torsion, IRR_P, IRR_A, R0S, SIMB, defaults, patronesDeModelo, coefR, generar, calcular, leerExpr, expr, tablaSAP, compararSAP };
if(typeof module !== 'undefined') module.exports = api; else root.Combos = api;
})(typeof window !== 'undefined' ? window : globalThis);
