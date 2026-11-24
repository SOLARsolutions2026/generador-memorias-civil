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
    metodoE:'env', nomEX:'100% X 30% Y', nomEY:'30% X 100% Y',
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

const T = (k, f, lbl) => ({ k, f, lbl });   // k = símbolo, o '@Nombre' para usar otra combinación de SAP
const fmtF = f => (Math.round(f * 1000) / 1000).toString();
// Expresión legible: 1.2D + 1.6Lr − 0.3Ey
const expr = ts => ts.map((t, i) => `${t.f < 0 ? (i ? ' − ' : '−') : (i ? ' + ' : '')}${Math.abs(t.f) === 1 ? '' : fmtF(Math.abs(t.f)) + (t.lbl ? '·' : '')}${t.lbl || t.k}`).join('');

// Genera la lista completa (antes de quitar las desactivadas)
function generar(K, conSismo){
  const R = coefR(K), out = [];
  const add = (id, grupo, ref, ts, nota, tipo) => out.push({ id, grupo, ref, ts:ts.filter(t => t.f), nota, tipo:tipo || 'Linear Add' });
  const env = K.metodoE !== 'lineal';
  // Casos de sismo: E = ±Ex ± Tx ± 0.3Ey ± 0.3Ty (y viceversa), todo dividido por R (corrección de Amo 24-nov:
  // el 30 % ortogonal es del efecto completo de la otra dirección, con su torsión accidental; 16 por dirección = 32,
  // con los mismos nombres de su modelo, p. ej. «FX+TX+0.3FY+0.3TY» y «0.3FX+0.3TX+FY+TY»).
  // La torsión accidental se toma con los dos signos (excentricidad ±5 %, A.3.6.7); el 30 % ortogonal según A.3.6.3.
  const casosE = [], sg = (v, first) => v < 0 ? '-' : first ? '' : '+';
  if(conSismo && R.R > 0){
    const e = 1 / R.R;
    for(const [P, S] of [['x','y'], ['y','x']])
      for(const sp of [1, -1]) for(const st of [1, -1]) for(const ss of (K.orto ? [1, -1] : [0])) for(const sq of (K.orto ? [1, -1] : [0])){
        const ts = [T('E' + P, sp * e), T('T' + P, st * e)];
        if(ss) ts.push(T('E' + S, ss * 0.3 * e), T('T' + S, sq * 0.3 * e));
        const p1 = `${sg(sp, P === 'x')}F${P.toUpperCase()}${sg(st)}T${P.toUpperCase()}`, p2 = ss ? `${sg(ss, P === 'y')}0.3F${S.toUpperCase()}${sg(sq)}0.3T${S.toUpperCase()}` : '';
        casosE.push({ P:P.toUpperCase(), sp, st, ss, sq, ts, nom:P === 'x' ? p1 + p2 : p2 + (p2 ? p1.replace(/^(?=F)/, '+') : p1) });
      }
  }
  // Resistencia B.2.4.2 (L = 0: cubiertas, la viva es Lr)
  add('U1', 'Resistencia', 'B.2.4-1', [T('D', 1.4)]);
  add('U2', 'Resistencia', 'B.2.4-2', [T('D', 1.2), T('Lr', 0.5)]);
  add('U3', 'Resistencia', 'B.2.4-3', [T('D', 1.2), T('Lr', 1.6)]);
  add('U4', 'Resistencia', 'B.2.4-3', [T('D', 1.2), T('Lr', 1.6), T('W', 0.8)]);
  add('U5', 'Resistencia', 'B.2.4-4', [T('D', 1.2), T('W', 1.6), T('Lr', 0.5)]);
  add('U6', 'Resistencia', 'B.2.4-6', [T('D', 0.9), T('W', 1.6)]);
  // Método de envolventes (el de Amo): componentes sin reducir → envolvente por dirección → 1.2D / 0.9D + ENV/R
  const nomE = { X:(K.nomEX || '100% X 30% Y').trim(), Y:(K.nomEY || '30% X 100% Y').trim() };
  if(env && casosE.length){
    const cont = { X:0, Y:0 };
    casosE.forEach(c => { const n = K.orto ? c.nom : `S${c.P}${++cont[c.P]}`; c.id = n;
      add(n, 'Sismo: componentes', 'A.3.6.3', c.ts.map(t => T(t.k, t.f * R.R)), 'sin reducir'); out[out.length - 1].dir = c.P; });
    for(const P of ['X','Y']) add(nomE[P], 'Sismo: envolventes', 'A.3.6.3', casosE.filter(c => c.P === P).map(c => T('@' + c.id, 1, c.id)), 'derivas y torsión', 'Envelope');
    const e = 1 / R.R;
    for(const P of ['X','Y']) add(`U7${P}`, 'Resistencia', 'B.2.4-5', [T('D', 1.2), T('@' + nomE[P], e, 'E' + P)], 'E = envolvente / R');
    for(const P of ['X','Y']) add(`U8${P}`, 'Resistencia', 'B.2.4-7', [T('D', 0.9), T('@' + nomE[P], e, 'E' + P)], 'E = envolvente / R');
  } else {
    casosE.forEach((c, i) => add(`U7-${i+1}`, 'Resistencia', 'B.2.4-5', [T('D', 1.2), ...c.ts], 'E = Fs/R'));
    casosE.forEach((c, i) => add(`U8-${i+1}`, 'Resistencia', 'B.2.4-7', [T('D', 0.9), ...c.ts], 'E = Fs/R'));
  }
  // Servicio B.2.3.1
  if(K.servicio){
    add('S1', 'Servicio', 'B.2.3-1', [T('D', 1)]);
    add('S2', 'Servicio', 'B.2.3-3', [T('D', 1), T('Lr', 1)]);
    add('S3', 'Servicio', 'B.2.3-5', [T('D', 1), T('W', 1)]);
    add('S4', 'Servicio', 'B.2.3-6', [T('D', 1), T('W', 0.75), T('Lr', 0.75)]);
    add('S5', 'Servicio', 'B.2.3-7', [T('D', 0.6), T('W', 1)]);
    if(K.servicioSismo && env && casosE.length) for(const P of ['X','Y']){
      add(`S6${P}`, 'Servicio', 'B.2.3-5', [T('D', 1), T('@' + nomE[P], 0.7 / R.R, 'E' + P)], '0.7E');
      add(`S7${P}`, 'Servicio', 'B.2.3-8', [T('D', 0.6), T('@' + nomE[P], 0.7 / R.R, 'E' + P)], '0.7E'); }
    if(K.servicioSismo && !env) casosE.forEach((c, i) => add(`S6-${i+1}`, 'Servicio', 'B.2.3-5', [T('D', 1), ...c.ts.map(t => T(t.k, t.f * 0.7))], '0.7E'));
    if(K.servicioSismo && !env) casosE.forEach((c, i) => add(`S7-${i+1}`, 'Servicio', 'B.2.3-8', [T('D', 0.6), ...c.ts.map(t => T(t.k, t.f * 0.7))], '0.7E'));
  }
  // Derivas (A.6): fuerzas sísmicas sin dividir por R
  if(K.derivas && casosE.length && !env){
    const cd = { X:0, Y:0 };
    casosE.filter(c => c.sp === 1).forEach(c => add(`DER${c.P}-${++cd[c.P]}`, 'Derivas', 'A.6', c.ts.map(t => T(t.k, t.f * R.R)), 'Fs sin dividir por R'));
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
    for(const t of c.ts){
      if(t.k[0] === '@'){ const n = t.k.slice(1); sap[n] = r3((sap[n] || 0) + t.f); continue; }
      if(!pats[t.k].length) faltaPat.add(t.k); for(const p of pats[t.k]) sap[p] = r3((sap[p] || 0) + t.f); }
    const txt = c.tipo === 'Envelope' ? `Envolvente de ${c.ts[0].lbl} a ${c.ts[c.ts.length-1].lbl}` : expr(c.ts);
    return { ...c, txt, sap, on:!off.has(c.id) };
  });
  return { ...G, lista, activas:lista.filter(c => c.on), pats, faltaPat:[...faltaPat] };
}

// Texto para pegar en Excel / SAP (Load Combination Definitions)
function tablaSAP(lista){
  const combos = new Set(lista.map(c => c.id));
  const filas = [['ComboName', 'ComboType', 'CaseType', 'CaseName', 'ScaleSF']];
  for(const c of lista) for(const [p, f] of Object.entries(c.sap)) filas.push([c.id, c.tipo || 'Linear Add', combos.has(p) ? 'Combination' : 'Linear Static', p, f]);
  return filas.map(r => r.join('\t')).join('\n');
}

// Compara con las combinaciones que trae el modelo de SAP (Anexo C)
function compararSAP(lista, combosSAP){
  const firma = o => Object.entries(o).filter(([, f]) => f).map(([p, f]) => `${p.toUpperCase()}:${r3(f)}`).sort().join('|');
  const sapF = new Map((combosSAP || []).map(c => [firma(c.casos), c.n]));
  return lista.map(c => ({ id:c.id, txt:c.txt, en:sapF.get(firma(c.sap)) || null }));
}


// ═══ Revisión numérica de las irregularidades (pedido de Amo 24-nov; Figuras A.3-1 y A.3-2) ═══
// Datos en K.irrD = { '2P':{A,B,C,D}, '3P':{caso,A,B,C,D,E}, '4A':{a,b}, pisos:[{n,V,d,m,a,R}] } (pisos de abajo hacia arriba).
// Devuelve, por cada revisión con datos completos, { claves:{k:true|false}, txt, filas? }.
const nn = v => { const x = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(x) ? x : null; };
const f2 = x => (Math.round(x * 100) / 100).toString();
function irregularidades(K){
  const D = K.irrD || {}, out = {};
  { const d = D['2P'] || {}, A = nn(d.A), B = nn(d.B), C = nn(d.C), Dd = nn(d.D);
    if(A && B && C && Dd){ const s = A > 0.15 * B && C > 0.15 * Dd;
      out['2P'] = { claves:{ '2P':s }, txt:`Retrocesos: A = ${f2(A)} m ${A > 0.15 * B ? '>' : '≤'} 0.15·B = ${f2(0.15 * B)} m y C = ${f2(C)} m ${C > 0.15 * Dd ? '>' : '≤'} 0.15·D = ${f2(0.15 * Dd)} m → ${s ? 'hay' : 'no hay'} irregularidad 2P.` }; } }
  { const d = D['3P'] || {}, A = nn(d.A), B = nn(d.B), C = nn(d.C), Dd = nn(d.D), E = nn(d.E) || 0, c2 = d.caso === '2';
    if(A && B && C && Dd){ const ab = c2 ? C * Dd + C * E : C * Dd, lim = 0.5 * A * B, s = ab > lim;
      out['3P'] = { claves:{ '3P':s }, txt:`Aberturas del diafragma: ${c2 ? 'C·D + C·E' : 'C·D'} = ${f2(ab)} m² ${s ? '>' : '≤'} 0.5·A·B = ${f2(lim)} m² → ${s ? 'hay' : 'no hay'} irregularidad 3P.` }; } }
  { const d = D['4A'] || {}, a = nn(d.a), b = nn(d.b);
    if(a && b != null){ const s = b > a; out['4A'] = { claves:{ '4A':s }, txt:`Desplazamiento en el plano: b = ${f2(b)} m ${s ? '>' : '≤'} a = ${f2(a)} m → ${s ? 'hay' : 'no hay'} irregularidad 4A.` }; } }
  const P = (D.pisos || []).map((p, i) => ({ n:p.n || `Piso ${i + 1}`, V:nn(p.V), d:nn(p.d), m:nn(p.m), a:nn(p.a), R:nn(p.R) }));
  if(P.length >= 2){
    // 1aA / 1bA: rigidez de cada piso K = V/Δ frente al de arriba y al promedio de los tres de arriba
    const Ks = P.map(p => p.V && p.d ? p.V / p.d : null);
    if(Ks.every(x => x)){ const filas = []; let a = false, b = false;
      for(let i = 0; i < P.length - 1; i++){ const k = Ks[i], k1 = Ks[i + 1], tres = Ks.slice(i + 1, i + 4), pr = tres.length === 3 ? tres.reduce((x, y) => x + y, 0) / 3 : null;
        const r1 = k / k1, r3 = pr ? k / pr : null, eb = r1 < 0.6 || (r3 != null && r3 < 0.7), ea = !eb && (r1 < 0.7 || (r3 != null && r3 < 0.8));
        a = a || ea; b = b || eb; filas.push([P[i].n, f2(k), f2(r1), r3 == null ? '—' : f2(r3), eb ? '1bA' : ea ? '1aA' : 'No']); }
      out['1A'] = { claves:{ '1aA':a && !b, '1bA':b }, filas, cols:['Piso', 'K = V/Δ [kN/mm]', 'K / K arriba', 'K / prom. 3 arriba', 'Resultado'],
        txt:`Rigidez de cada piso K = V/Δ comparada con la del piso de arriba (1aA si < 0.70, 1bA si < 0.60) y con el promedio de los tres de arriba (1aA si < 0.80, 1bA si < 0.70) → ${b ? 'hay irregularidad 1bA' : a ? 'hay irregularidad 1aA' : 'no hay piso flexible'}.` }; }
    // 2A: masa de un piso > 1.5 la de un piso adyacente (la cubierta más liviana no se compara)
    if(P.every(p => p.m)){ const filas = []; let s = false, top = P.length - 1;
      P.forEach((p, i) => { const vec = [i > 0 ? P[i - 1] : null, i + 1 < top ? P[i + 1] : null].filter(Boolean);
        const mx = vec.length ? Math.max(...vec.map(q => p.m / q.m)) : null, e = mx != null && mx > 1.5 && i !== top; s = s || e;
        filas.push([p.n, f2(p.m), mx == null ? '—' : f2(mx), e ? '2A' : 'No']); });
      out['2A'] = { claves:{ '2A':s }, filas, cols:['Piso', 'Masa', 'Mayor relación con un piso vecino', 'Resultado'],
        txt:`Masa de cada piso frente a la de sus pisos vecinos (límite 1.50; la cubierta no se compara) → ${s ? 'hay' : 'no hay'} irregularidad 2A.` }; }
    // 3A: dimensión horizontal del sistema de resistencia sísmica > 1.30 la de un piso adyacente
    if(P.every(p => p.a)){ const filas = []; let s = false;
      P.forEach((p, i) => { const vec = [P[i - 1], P[i + 1]].filter(Boolean), mx = Math.max(...vec.map(q => p.a / q.a)), e = mx > 1.3; s = s || e; filas.push([p.n, f2(p.a), f2(mx), e ? '3A' : 'No']); });
      out['3A'] = { claves:{ '3A':s }, filas, cols:['Piso', 'Dimensión a [m]', 'Mayor relación con un piso vecino', 'Resultado'],
        txt:`Dimensión horizontal del sistema de resistencia sísmica de cada piso frente a la de sus pisos vecinos (límite 1.30) → ${s ? 'hay' : 'no hay'} irregularidad 3A.` }; }
    // 5aA / 5bA: resistencia del piso < 0.80 (< 0.65 extrema) la del piso de arriba
    if(P.every(p => p.R)){ const filas = []; let a = false, b = false;
      for(let i = 0; i < P.length - 1; i++){ const r = P[i].R / P[i + 1].R, eb = r < 0.65, ea = !eb && r < 0.8; a = a || ea; b = b || eb; filas.push([P[i].n, f2(P[i].R), f2(r), eb ? '5bA' : ea ? '5aA' : 'No']); }
      out['5A'] = { claves:{ '5aA':a && !b, '5bA':b }, filas, cols:['Piso', 'Resistencia [kN]', 'R / R arriba', 'Resultado'],
        txt:`Resistencia de cada piso frente a la del piso de arriba (5aA si < 0.80, 5bA si < 0.65) → ${b ? 'hay piso débil extremo 5bA' : a ? 'hay piso débil 5aA' : 'no hay piso débil'}.` }; }
  }
  return out;
}
// Grupo de revisión de cada irregularidad (las que comparten figura y datos)
const GRUPO_IRR = { '1aP':'1P', '1bP':'1P', '2P':'2P', '3P':'3P', '4P':'4P', '5P':'5P', '1aA':'1A', '1bA':'1A', '2A':'2A', '3A':'3A', '4A':'4A', '5aA':'5A', '5bA':'5A' };

const api = { irregularidades, GRUPO_IRR, torsion, IRR_P, IRR_A, R0S, SIMB, defaults, patronesDeModelo, coefR, generar, calcular, leerExpr, expr, tablaSAP, compararSAP };
if(typeof module !== 'undefined') module.exports = api; else root.Combos = api;
})(typeof window !== 'undefined' ? window : globalThis);
