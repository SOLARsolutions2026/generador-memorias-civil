/* ═══ Sugerencias para los chequeos que no cumplen (Anexo D) — bombillo 💡 en pantalla. Cálculo puro. ═══
   Cada sugerencia se comprueba volviendo a calcular el elemento con las MISMAS fuerzas (no son consejos genéricos).
   Devuelve { por: 'por qué falla', ops: [{ t:'texto', r: relación del chequeo, todo: true si todos los chequeos cumplen, mejor: true }] }.
   Nunca cambia los datos: solo propone (opción A aprobada por Amo, 28-oct-2026). */
(function(root){
'use strict';
const num = (v, d=0) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : d; };
const f2 = v => (Math.round(v*100)/100).toFixed(2);
const r3 = v => (Math.round(v*1000)/1000).toFixed(3);
const pisoA = (v, p) => Math.floor(v/p + 1e-9)*p, techoA = (v, p) => Math.ceil(v/p - 1e-9)*p;

// Mayor valor de x en [a, b] con ok(x) (ok es verdadero para x pequeños): bisección
function mayorQue(ok, a, b, it=28){ if(!ok(a)) return null; if(ok(b)) return b; for(let i = 0; i < it; i++){ const m = (a + b)/2; if(ok(m)) a = m; else b = m; } return a; }
// Menor valor de x en [a, b] con ok(x) (ok es verdadero para x grandes)
function menorQue(ok, a, b, it=28){ if(!ok(b)) return null; if(ok(a)) return a; for(let i = 0; i < it; i++){ const m = (a + b)/2; if(ok(m)) b = m; else a = m; } return b; }

// ══════════ Elementos metálicos ══════════
const HSS_T = [1.5, 2, 2.5, 3, 4, 4.5, 5, 6, 8, 10];
const HSS_DIM = [[80,40],[100,50],[120,60],[150,50],[150,75],[160,80],[200,100],[250,150],[300,200]];
const BARRAS_D = [9.52, 12.7, 15.88, 19.05, 22.23, 25.4];
const NOM_CHK = { ten:'tensión', comp:'compresión', fx:'flexión en el eje mayor', fy:'flexión en el eje menor', vx:'cortante en el eje mayor', vy:'cortante en el eje menor', tor:'torsión', int:'interacción' };

function metal(el, filas, k){
  const AD = root.AnexoD, LIB = root.PERFILES_LAM || [];
  const prueba = cambio => { const R = AD.revisar({ ...el, ...cambio }, filas); return R.ok ? { r:R.checks[k]?.r ?? 0, max:R.ratio, todo:R.cumple, R } : null; };
  const base = prueba({}); if(!base) return null;
  const R = base.R, s = R.s, ops = [];
  const add = (t, x, mejor) => { if(x) ops.push({ t, r:x.r, todo:x.todo, max:x.max, mejor:!!mejor }); };
  const cumpleK = x => x && x.r <= 1;
  const m = v => f2(v/1000) + ' m';

  // ── Por qué falla ──
  let por = '';
  if(k === 'fx'){
    if(s.tipo === 'I') por = R.fx.gob === 'Pandeo lateral-torsional'
      ? `Controla el pandeo lateral-torsional (volcamiento): Lb = ${m(R.Lb)} es mayor que Lp = ${m(R.fx.Lp)}${R.Lb > R.fx.Lr ? ` y que Lr = ${m(R.fx.Lr)}` : ''}. El perfil se voltea de lado antes de llegar a su capacidad plástica.`
      : R.fx.gob === 'Pandeo local de la aleta' ? 'La aleta no es compacta: se pandea localmente antes de llegar a la capacidad plástica.'
      : 'El perfil ya llega a su capacidad plástica (Mp): hace falta más sección.';
    else por = `Controla ${R.fx.gob.toLowerCase()}: hace falta más sección o más espesor.`;
  } else if(k === 'fy') por = 'La flexión alrededor del eje débil necesita más módulo plástico Zy (perfil más ancho o más espesor de aleta).';
  else if(k === 'comp') por = `Controla el pandeo ${R.comp.KLy >= R.comp.KLx ? 'en el eje débil' : 'en el eje fuerte'}: KL/r = ${R.comp.KL.toFixed(0)}${R.comp.gob === 'Pandeo torsional' ? ' (con pandeo torsional)' : ''}.`;
  else if(k === 'ten') por = `Controla: ${R.ten.gob.toLowerCase()}.`;
  else if(k === 'vx' || k === 'vy') por = 'El cortante supera la capacidad del alma o de las aletas: hace falta más área a cortante.';
  else if(k === 'tor') por = s.tipo === 'I' ? 'Los perfiles abiertos (I) resisten poca torsión; un tubo cerrado resiste mucho más con el mismo peso.' : 'La torsión supera la capacidad del tubo: más espesor o más sección.';
  else if(k === 'int'){ const f = R.checks?.int?.f; por = f ? `La combinación de carga axial (P/φPn = ${r3(f.pr)}) y flexión (ΣM/φMn = ${r3(f.mm)}) supera 1.0 (${f.ec}).` : 'La combinación de carga axial y flexión supera 1.0.'; }

  // ── 1. Arriostramiento lateral o del eje débil (perfiles I y tubos) — no cambia el perfil ──
  if(s.tipo !== 'BAR' && ['fx','int','comp'].includes(k)){
    if(s.tipo === 'I' && (k === 'fx' || k === 'int') && R.Lb > R.fx.Lp){
      const lb = mayorQue(x => cumpleK(prueba({ Lb:x/1000, Lz:x/1000 })), 50, R.Lb);
      if(lb && lb < R.Lb - 1){ const L = pisoA(lb, 50); add(`Poner correas o riostras laterales cada <b>${f2(L/1000)} m</b> como máximo (Lb), sin cambiar el perfil`, prueba({ Lb:L/1000, Lz:L/1000 }), true); }
    }
    if(k === 'comp' || k === 'int'){
      const dbl = R.comp.KLy >= R.comp.KLx ? 'Ly' : 'Lx', act = dbl === 'Ly' ? R.Ly : R.Lx;
      const lv = mayorQue(x => cumpleK(prueba(dbl === 'Ly' ? { Ly:x/1000 } : { Lx:x/1000 })), 50, act);
      if(lv && lv < act - 1){ const L = pisoA(lv, 50); add(`Arriostrar el ${dbl === 'Ly' ? 'eje débil' : 'eje fuerte'} cada <b>${f2(L/1000)} m</b> (${dbl})`, prueba(dbl === 'Ly' ? { Ly:L/1000 } : { Lx:L/1000 }), !ops.length); }
    }
  }
  // ── 2. Cb (si el diagrama de momentos lo justifica) ──
  if(s.tipo === 'I' && (k === 'fx' || k === 'int') && num(el.Cb, 1) < 2.27 && R.fx.gob === 'Pandeo lateral-torsional'){
    const cb = menorQue(x => cumpleK(prueba({ Cb:x })), num(el.Cb, 1), 2.27);
    if(cb){ const c = techoA(cb, 0.05); add(`Si el diagrama de momentos lo justifica, con <b>Cb = ${c.toFixed(2)}</b> cumple (el software lo calcula: revisa su valor)`, prueba({ Cb:c })); }
  }
  // ── 3. Tensión controlada por los pernos ──
  if(k === 'ten' && R.ten.pern && R.ten.gob.startsWith('Pernos')){
    for(let n = num(el.pernos?.n) + 1; n <= num(el.pernos?.n) + 8; n++){ const x = prueba({ pernos:{ ...el.pernos, n } }); if(cumpleK(x)){ add(`Usar <b>${n} pernos</b> en la conexión`, x, !ops.length); break; } }
  }
  // ── 4. Cambiar la sección ──
  if(s.tipo === 'I'){
    const act = LIB.find(p => p[0] === el.perfil), kg = act ? act[16] : 0;
    const misma = LIB.filter(p => p[1] === (act && act[1]) && p[16] > kg).sort((a, b) => a[16] - b[16]);
    let sigK = null, sigT = null;
    for(const p of misma){ const x = prueba({ perfil:p[0] }); if(!sigK && cumpleK(x)) sigK = { p, x }; if(x && x.todo){ sigT = { p, x }; break; } }
    if(sigK) add(`Cambiar a <b>${sigK.p[0]}</b> (misma familia, ${f2(sigK.p[16])} kg/m)`, sigK.x, !ops.length);
    if(sigT && sigT.p !== sigK?.p) add(`Cambiar a <b>${sigT.p[0]}</b> para que cumplan <u>todos</u> los chequeos (${f2(sigT.p[16])} kg/m)`, sigT.x);
    const todas = LIB.filter(p => p[1] !== (act && act[1]) && p[16] > kg*0.6).sort((a, b) => a[16] - b[16]);
    for(const p of todas){ const x = prueba({ perfil:p[0] }); if(x && x.todo){ add(`Otra familia: <b>${p[0]}</b> (${f2(p[16])} kg/m) cumple todos los chequeos`, x); break; } }
    if(k === 'tor') ops.push({ t:'Para torsión conviene un <b>tubo rectangular</b> (sección cerrada): cambia el tipo de sección a «Tubo rectangular» y prueba.', r:null });
  } else if(s.tipo === 'HSS'){
    const H = num(el.H), Bw = num(el.B), t0 = num(el.t);
    for(const t of HSS_T.filter(t => t > t0)){ const x = prueba({ t }); if(cumpleK(x)){ add(`Mismo tubo con más espesor: <b>${H}×${Bw}×${t} mm</b>`, x, !ops.length); break; } }
    const A0 = H*Bw;
    for(const [h, b] of HSS_DIM.filter(([h, b]) => h*b > A0)){ let hecho = false;
      for(const t of HSS_T){ const x = prueba({ H:h, B:b, t }); if(x && x.todo){ add(`Tubo más grande: <b>${h}×${b}×${t} mm</b> (cumplen todos los chequeos)`, x); hecho = true; break; } } if(hecho) break; }
  } else if(s.tipo === 'BAR'){
    for(const d of BARRAS_D.filter(d => d > num(el.d))){ const x = prueba({ d }); if(cumpleK(x)){ add(`Barra de <b>Ø ${d} mm</b>`, x, !ops.length); break; } }
  }
  if(!ops.some(o => o.mejor) && ops.length) ops[0].mejor = true;
  if(!ops.length) ops.push({ t:'No encontré un cambio sencillo en la biblioteca: revisa el modelo (cargas, apoyos) o usa una sección armada.', r:null });
  return { tit:NOM_CHK[k] || k, por, ops };
}

// ══════════ Zapatas ══════════
const BAR_ORDEN = ['3/8"','1/2"','5/8"','3/4"','7/8"','1"','1-1/8"','1-1/4"'];
function zapata(z, serv, res, k){
  const C = root.Concreto, run = mod => C.zapata({ ...z, ...mod }, serv, res);
  const X = run({}); if(!X.ok) return null;
  const ops = [], add = (t, x, rel, mejor) => { if(x && x.ok) ops.push({ t, r:rel(x), todo:x.cumple, mejor:!!mejor }); };
  const B = num(z.B), L = num(z.L), h = num(z.h);
  let por = '', tit = '';
  if(k === 'suelo' || k === 'nucleo'){
    tit = k === 'suelo' ? 'presión del suelo' : 'excentricidad dentro del núcleo';
    const s = X.serv, kx = 6*s.ex/(X.B/1000), ky = 6*s.ey/(X.L/1000);
    por = !s.nucleo ? `La carga sale del núcleo (6ex/B + 6ey/L = ${f2(kx + ky)} > 1): el momento levanta un lado de la zapata.` : `La presión máxima (${s.qmax.toFixed(1)} kN/m²) pasa de qa = ${X.qa} kN/m².`;
    const okS = x => x.ok && x.serv.rel <= 1 && x.serv.nucleo;
    for(let d = Math.max(B, L) + 0.05; d <= 6.001; d += 0.05){ const x = run({ B:d.toFixed(2), L:d.toFixed(2) }); if(okS(x)){ add(`Zapata cuadrada de <b>${d.toFixed(2)} × ${d.toFixed(2)} m</b> → q máx ${x.serv.qmax.toFixed(0)} kN/m²`, x, y => y.serv.rel, true); break; } }
    const enX = kx >= ky;
    for(let d = (enX ? B : L) + 0.05; d <= 8.001; d += 0.05){ const x = run(enX ? { B:d.toFixed(2) } : { L:d.toFixed(2) }); if(okS(x)){ add(`Alargar solo en el sentido del momento: <b>${enX ? 'B' : 'L'} = ${d.toFixed(2)} m</b> → q máx ${x.serv.qmax.toFixed(0)} kN/m²`, x, y => y.serv.rel); break; } }
    ops.push({ t:'Confirmar qa con el estudio de suelos (y la profundidad Df a la que aplica).', r:null });
  } else if(['corteX','corteY','punz'].includes(k)){
    tit = k === 'punz' ? 'punzonamiento' : 'cortante en una dirección';
    por = k === 'punz' ? 'El cortante alrededor del pedestal (a d/2) supera φVc: falta altura efectiva d.' : 'El cortante a una distancia d de la cara del pedestal supera φVc: falta altura efectiva d.';
    const rel = x => k === 'punz' ? x.punz.rel : k === 'corteX' ? x.cx.rel : x.cy.rel;
    for(let d = h + 0.05; d <= 2.001; d += 0.05){ const x = run({ h:d.toFixed(2) }); if(x.ok && rel(x) <= 1){ add(`Espesor <b>h = ${d.toFixed(2)} m</b>`, x, rel, true); break; } }
    if(num(z.fc, 21) < 28){ const x = run({ fc:28 }); if(x.ok && rel(x) <= 1) add("Concreto de <b>f'c = 28 MPa</b> con el mismo espesor", x, rel); }
  } else if(k === 'flexX' || k === 'flexY'){
    tit = 'flexión en la cara del pedestal';
    const ej = k === 'flexX' ? 'barX' : 'barY', rel = x => k === 'flexX' ? x.fx.rel : x.fy.rel;
    por = 'El momento en la cara del pedestal supera φMn con el refuerzo actual.';
    for(const b of BAR_ORDEN.slice(BAR_ORDEN.indexOf(z[ej]) + 1)){ const x = run({ [ej]:b }); if(x.ok && rel(x) <= 1){ add(`Barra de <b>${b}</b> en ${k === 'flexX' ? 'x' : 'y'} (la separación se ajusta sola)`, x, rel, true); break; } }
    for(let d = h + 0.05; d <= 2.001; d += 0.05){ const x = run({ h:d.toFixed(2) }); if(x.ok && rel(x) <= 1){ add(`Espesor <b>h = ${d.toFixed(2)} m</b> con la misma barra`, x, rel); break; } }
  } else if(k === 'apl'){
    tit = 'aplastamiento';
    por = 'La carga del pedestal sobre la zapata supera la resistencia al aplastamiento del concreto.';
    const rel = x => x.apl.rel;
    for(let d = num(z.bx) + 0.05; d <= 1.5; d += 0.05){ const x = run({ bx:d.toFixed(2), by:Math.max(num(z.by), d).toFixed(2) }); if(x.ok && rel(x) <= 1){ add(`Pedestal de <b>${d.toFixed(2)} × ${Math.max(num(z.by), d).toFixed(2)} m</b>`, x, rel, true); break; } }
    if(num(z.fc, 21) < 28){ const x = run({ fc:28 }); if(x.ok && rel(x) <= 1) add("Concreto de <b>f'c = 28 MPa</b>", x, rel); }
  } else if(k === 'anclX' || k === 'anclY'){
    tit = 'anclaje del refuerzo';
    const ej = k === 'anclX' ? 'barX' : 'barY', f = k === 'anclX' ? X.fx : X.fy;
    por = `El gancho necesita ${f.ldh.toFixed(0)} mm y en el voladizo solo hay ${f.disp.toFixed(0)} mm.`;
    const okA = x => x.ok && (k === 'anclX' ? x.fx.anclOk && x.fx.rel <= 1 : x.fy.anclOk && x.fy.rel <= 1);
    for(const b of BAR_ORDEN.slice(0, BAR_ORDEN.indexOf(z[ej])).reverse()){ const x = run({ [ej]:b }); if(okA(x)){ add(`Barra más delgada: <b>${b}</b> (más barras, el gancho sí cabe)`, x, () => 0, true); break; } }
    const dim = k === 'anclX' ? 'B' : 'L', act = k === 'anclX' ? B : L;
    for(let d = act + 0.05; d <= 6.001; d += 0.05){ const x = run({ [dim]:d.toFixed(2) }); if(okA(x)){ add(`Zapata más ancha: <b>${dim} = ${d.toFixed(2)} m</b> (más voladizo)`, x, () => 0); break; } }
  }
  if(!ops.length) ops.push({ t:'No encontré un cambio sencillo: revisa las dimensiones o las cargas.', r:null });
  return { tit, por, ops };
}

// ══════════ Pedestales ══════════
function pedestal(p, res, k){
  const C = root.Concreto, run = mod => C.pedestal({ ...p, ...mod }, res);
  const X = run({}); if(!X.ok) return null;
  const ops = [], add = (t, x, rel, mejor) => { if(x && x.ok) ops.push({ t, r:rel ? rel(x) : null, todo:x.cumple, mejor:!!mejor }); };
  const b = num(p.b), h = num(p.h);
  let por = '', tit = '';
  if(k === 'pm'){
    tit = 'flexo-compresión'; por = `La combinación más exigente (${X.gob.met}) queda fuera del diagrama de interacción.`;
    const rel = x => x.gob.rel;
    for(let i = 1; i <= 6; i++){ const nx = num(p.nx, 3) + Math.ceil(i/2), ny = num(p.ny, 3) + Math.floor(i/2), x = run({ nx, ny }); if(x.ok && rel(x) <= 1){ add(`Más barras: <b>${nx} por cara en x y ${ny} en y</b> (${2*nx + 2*ny - 4} barras)`, x, rel, true); break; } }
    for(const bb of BAR_ORDEN.slice(BAR_ORDEN.indexOf(p.bar) + 1)){ const x = run({ bar:bb }); if(x.ok && rel(x) <= 1){ add(`Barras de <b>${bb}</b> con la misma cantidad`, x, rel); break; } }
    for(let d = Math.max(b, h) + 50; d <= 1200; d += 50){ const x = run({ b:d, h:d }); if(x.ok && rel(x) <= 1){ add(`Sección de <b>${d} × ${d} mm</b>`, x, rel); break; } }
  } else if(k === 'corte'){
    tit = 'cortante'; por = 'El cortante supera φ(Vc + Vs) con los estribos actuales.';
    const rel = x => x.relV;
    for(let s = pisoA(num(p.sFuera, 150) - 10, 10); s >= 50; s -= 10){ const x = run({ sFuera:s }); if(x.ok && rel(x) <= 1){ add(`Estribos fuera de Lo cada <b>${s} mm</b>`, x, rel, true); break; } }
    { const x = run({ ramasX:num(p.ramasX, 2) + 1, ramasY:num(p.ramasY, 2) + 1 }); if(x.ok && rel(x) <= 1) add('Una rama más en cada dirección (gancho suplementario)', x, rel); }
  } else if(k === 'esb'){
    tit = 'esbeltez'; const need = techoA(num(p.k, 2)*X.Hp/(0.3*22), 50);
    por = `k·lu/r = ${Math.max(X.esbX, X.esbY).toFixed(1)} > 22: el pedestal es esbelto para su altura.`;
    ops.push({ t:`Lado mínimo de <b>${need} mm</b> (k·Hp / (0.3 · 22)), o reducir la altura Hp`, r:null, mejor:true });
  } else if(k === 'sConf'){
    tit = 'separación de estribos en Lo'; const s = pisoA(X.sConfMax, 5);
    por = `En la zona confinada (Lo = ${X.Lo.toFixed(0)} mm) la separación máxima es ${X.sConfMax.toFixed(0)} mm (${X.sConfMax === X.so ? 'so' : 'área de confinamiento Ash'}).`;
    ops.push({ t:`Estribos en Lo cada <b>${s} mm</b>`, r:null, mejor:true });
    if(X.sConfMax < X.so){ const x = run({ ramasX:num(p.ramasX, 2) + 1, ramasY:num(p.ramasY, 2) + 1 }); if(x.ok) ops.push({ t:`Con una rama más en cada dirección, la separación máxima sube a ${x.sConfMax.toFixed(0)} mm`, r:null }); }
  } else if(k === 'sFuera'){
    tit = 'separación de estribos fuera de Lo'; por = `Fuera de Lo la separación máxima es ${X.sFueraMax.toFixed(0)} mm.`;
    ops.push({ t:`Estribos fuera de Lo cada <b>${pisoA(X.sFueraMax, 5)} mm</b>`, r:null, mejor:true });
  } else if(k === 'anc'){
    tit = 'anclaje en la zapata'; const need = Math.max(X.anc.ldh, X.anc.ldc);
    por = `Las barras necesitan ${need.toFixed(0)} mm dentro de la zapata y solo hay ${X.anc.disp.toFixed(0)} mm.`;
    const hz = techoA((need + num(p.recZ, 75) + 2*(C.BARRAS[p.barZ] || [12.7])[0])/1000, 0.05);
    ops.push({ t:`Zapata de <b>h = ${hz.toFixed(2)} m</b> como mínimo`, r:null, mejor:true });
    for(const bb of BAR_ORDEN.slice(0, BAR_ORDEN.indexOf(p.bar)).reverse()){ const x = run({ bar:bb }); if(x.ok && x.anc.ok && x.gob.rel <= 1){ add(`Barras más delgadas: <b>${bb}</b> (siguen cumpliendo la flexo-compresión)`, x, y => y.gob.rel); break; } }
  }
  if(!ops.length) ops.push({ t:'No encontré un cambio sencillo: revisa la sección o las cargas.', r:null });
  return { tit, por, ops };
}

const api = { metal, zapata, pedestal };
if(typeof module !== 'undefined') module.exports = api; else root.Sugerir = api;
})(typeof window !== 'undefined' ? window : globalThis);
