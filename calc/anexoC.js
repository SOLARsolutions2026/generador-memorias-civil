/* ═══ Anexo C — Modelo SAP2000: lectura del archivo de texto .$2k (cálculo puro, sin pantalla) ═══
   El archivo .$2k (Archivo → Exportar → SAP2000 .s2k Text File) trae todas las tablas del modelo:
     TABLE:  "JOINT COORDINATES"
        Joint=1   CoordSys=GLOBAL   ...   GlobalX=8   GlobalY=0   GlobalZ=7.53
   Las líneas que terminan en " _" continúan en la siguiente. */
(function(root){
'use strict';
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };
const r3 = v => Math.round(v * 1000) / 1000;

// ─── 1. Lectura del texto: { "NOMBRE DE TABLA": [ {campo:valor} ] } ───
function leer(texto){
  const lineas = String(texto).replace(/\r/g, '').split('\n');
  const tablas = {}; let actual = null, buf = '';
  const fila = s => {
    const o = {}; let i = 0;
    while(i < s.length){
      while(s[i] === ' ' || s[i] === '\t') i++;
      const eq = s.indexOf('=', i); if(eq < 0) break;
      const k = s.slice(i, eq).trim(); i = eq + 1; let v = '';
      if(s[i] === '"'){                      // valor entre comillas (puede tener espacios y hasta comillas internas)
        let j = i + 1;
        while(j < s.length && !(s[j] === '"' && (j + 1 >= s.length || s[j+1] === ' ' || s[j+1] === '\t'))) j++;
        v = s.slice(i + 1, j).replace(/""/g, '"'); i = j + 1;   // SAP escribe la comilla interna doble: 3/8"" → 3/8"
      } else { let j = i; while(j < s.length && s[j] !== ' ' && s[j] !== '\t') j++; v = s.slice(i, j); i = j; }
      if(k) o[k] = v;
    }
    return o;
  };
  for(const l0 of lineas){
    let l = l0;
    if(/\s_\s*$/.test(l)){ buf += l.replace(/\s_\s*$/, ' '); continue; }
    l = buf + l; buf = '';
    const t = l.trim();
    if(!t) continue;
    const m = t.match(/^TABLE:\s+"?([^"]+)"?/i);
    if(m){ actual = m[1].trim().toUpperCase(); tablas[actual] = tablas[actual] || []; continue; }
    if(/^END TABLE DATA/i.test(t)){ actual = null; continue; }
    if(actual && t.includes('=')) tablas[actual].push(fila(t));
  }
  return tablas;
}

// Lista compacta de identificadores: 1,2,3,7,8 → "1–3, 7–8"
function rangos(ids){
  const nums = ids.filter(x => /^\d+$/.test(x)).map(Number).sort((a,b) => a - b), otros = ids.filter(x => !/^\d+$/.test(x));
  const out = []; let a = null, b = null;
  for(const n of [...new Set(nums)]){ if(a === null){ a = b = n; } else if(n === b + 1) b = n; else { out.push(a === b ? `${a}` : `${a}–${b}`); a = b = n; } }
  if(a !== null) out.push(a === b ? `${a}` : `${a}–${b}`);
  return [...out, ...otros].join(', ');
}

// Categoría de un patrón de carga: D muerta, L viva, W viento, E sismo
function categoria(n, tipo){
  const s = String(n).toUpperCase();
  if(/^IMP|IMPACT|CHOQUE|NOCIONAL|NOTIONAL/.test(s)) return 'N';     // impacto de vehículos u otras especiales: sin tipo esperado
  if(/WIND|VIENTO/.test(s) || /^W\d*$/.test(s)) return 'W';
  if(/LIVE|VIVA/.test(s) || /^L[RV]?\d*$/.test(s)) return 'L';
  if(/^(QUAKE|SEISMIC)$/i.test(tipo) || /SISMO|QUAKE|^[FTSE][XY]\b/.test(s)) return 'E';
  if(/^(LIVE|ROOF LIVE)$/i.test(tipo)) return 'L';
  if(/^WIND$/i.test(tipo)) return 'W';
  return 'D';
}
const TIPO_ESPERADO = { L:/^(live|roof live|reducible live)$/i, W:/^wind$/i, E:/^quake$/i, D:/^(dead|super dead)$/i };
const NOM_CAT = { D:'muerta', L:'viva', W:'viento', E:'sismo', N:'impacto u otra especial' };

// ─── 2. Resumen del modelo (lo que se guarda en la memoria) ───
function analizar(texto){
  const T = leer(texto), tb = n => T[n] || [];
  const pc = tb('PROGRAM CONTROL')[0] || {};
  const unidades = pc.CurrUnits || '', okUnid = /^\s*kn\s*,\s*m\b/i.test(unidades);
  if(!Object.keys(T).length || !tb('JOINT COORDINATES').length) return { ok:false, error:'El archivo no parece ser un modelo en texto (.s2k / .$2k): no tiene la tabla de coordenadas de nudos.' };

  // Materiales: se unen las tablas 01, 02 y 03
  const mb = Object.fromEntries(tb('MATERIAL PROPERTIES 02 - BASIC MECHANICAL PROPERTIES').map(r => [r.Material, r]));
  const ms = Object.fromEntries(tb('MATERIAL PROPERTIES 03A - STEEL DATA').map(r => [r.Material, r]));
  const mc = Object.fromEntries(tb('MATERIAL PROPERTIES 03B - CONCRETE DATA').map(r => [r.Material, r]));
  const mr = Object.fromEntries(tb('MATERIAL PROPERTIES 03E - REBAR DATA').map(r => [r.Material, r]));
  const nombresMat = [...new Set([...tb('MATERIAL PROPERTIES 01 - GENERAL').map(r => r.Material), ...Object.keys(mb)])];
  const tipoMat = Object.fromEntries(tb('MATERIAL PROPERTIES 01 - GENERAL').map(r => [r.Material, r.Type]));
  const materiales = nombresMat.map(n => { const b = mb[n] || {}, s = ms[n] || mr[n] || {}, c = mc[n] || {};
    return { n, tipo: tipoMat[n] || '', gamma: num(b.UnitWeight), E: num(b.E1) / 1000, nu: b.U12 != null && b.U12 !== '' ? num(b.U12) : null,
      Fy: s.Fy ? num(s.Fy) / 1000 : null, Fu: s.Fu ? num(s.Fu) / 1000 : null, fc: c.Fc ? num(c.Fc) / 1000 : null }; });  // kN/m² → MPa

  const patrones = tb('LOAD PATTERN DEFINITIONS').map(r => ({ n:r.LoadPat, tipo:r.DesignType || '', swm:num(r.SelfWtMult), auto:r.AutoLoad || '', cat:categoria(r.LoadPat, r.DesignType) }));
  const catDe = Object.fromEntries(patrones.map(p => [p.n, p.cat]));

  // Nudos y apoyos
  const J = {}; for(const r of tb('JOINT COORDINATES')) J[r.Joint] = [num(r.GlobalX ?? r.XorR), num(r.GlobalY ?? r.Y), num(r.GlobalZ ?? r.Z)];
  const xs = Object.values(J);
  const ext = k => [Math.min(...xs.map(p => p[k])), Math.max(...xs.map(p => p[k]))];
  const tipoApoyo = r => { const u = ['U1','U2','U3'].every(k => r[k] === 'Yes'), g = ['R1','R2','R3'].every(k => r[k] === 'Yes'), g0 = ['R1','R2','R3'].every(k => r[k] !== 'Yes');
    return u && g ? 'Empotrado' : u && g0 ? 'Articulado' : ['U1','U2','U3','R1','R2','R3'].filter(k => r[k] === 'Yes').join(', ') || 'Libre'; };
  const apoyos = tb('JOINT RESTRAINT ASSIGNMENTS').map(r => ({ j:r.Joint, x:J[r.Joint]?.[0], y:J[r.Joint]?.[1], z:J[r.Joint]?.[2], tipo:tipoApoyo(r) }))
    .filter(a => a.tipo !== 'Libre');

  // Elementos: longitud, sección y peso
  const con = {}; for(const r of tb('CONNECTIVITY - FRAME')){
    const a = J[r.JointI], b = J[r.JointJ];
    con[r.Frame] = r.Length ? num(r.Length) : a && b ? Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]) : 0; }
  const props = Object.fromEntries(tb('FRAME SECTION PROPERTIES 01 - GENERAL').map(r => [r.SectionName, r]));
  const gam = Object.fromEntries(materiales.map(m => [m.n, m.gamma]));
  const sec = {};
  for(const r of tb('FRAME SECTION ASSIGNMENTS')){
    const s = r.AnalSect || r.DesignSect || '?', p = props[s] || {}, mat = r.MatProp && r.MatProp !== 'Default' ? r.MatProp : p.Material || '';
    const o = sec[s] = sec[s] || { s, tipo:r.SectionType || p.Shape || '', mat, n:0, L:0, area:num(p.Area), gamma:gam[mat] || 0, ids:[] };
    o.n++; o.L += con[r.Frame] || 0; o.ids.push(r.Frame);
  }
  const secciones = Object.values(sec).map(o => ({ s:o.s, tipo:o.tipo, mat:o.mat, n:o.n, L:r3(o.L), area:o.area, gamma:o.gamma,
    kN: r3(o.area * o.L * o.gamma), riel: /rail|riel|rial/i.test(o.s), sinLong: !Object.keys(con).length }))
    .sort((a,b) => b.kN - a.kN || a.s.localeCompare(b.s));

  // Cargas agrupadas por patrón, sistema, dirección y valor
  const agrupar = (filas, clave, val) => { const g = {};
    for(const r of filas){ const k = clave(r); const o = g[k] = g[k] || { ...val(r), ids:[] }; o.ids.push(r.Frame ?? r.Joint); }
    return Object.values(g).map(o => ({ ...o, n:o.ids.length, ids:rangos(o.ids.map(String)) })); };
  const dist = agrupar(tb('FRAME LOADS - DISTRIBUTED'), r => [r.LoadPat, r.CoordSys, r.Type, r.Dir, r.FOverLA, r.FOverLB].join('|'),
    r => ({ pat:r.LoadPat, cat:catDe[r.LoadPat] || categoria(r.LoadPat, ''), sis:r.CoordSys, tipo:r.Type || 'Force', dir:r.Dir, a:num(r.FOverLA), b:num(r.FOverLB) }))
    .sort((x,y) => x.pat.localeCompare(y.pat) || Math.abs(y.a) - Math.abs(x.a));
  const punt = agrupar(tb('FRAME LOADS - POINT'), r => [r.LoadPat, r.CoordSys, r.Type, r.Dir, r.Force ?? r.Moment, r.RelDist].join('|'),
    r => ({ pat:r.LoadPat, cat:catDe[r.LoadPat] || categoria(r.LoadPat, ''), sis:r.CoordSys, tipo:r.Type || 'Force', dir:r.Dir, P:num(r.Force ?? r.Moment), rel:num(r.RelDist) }));
  const jl = {}; for(const r of tb('JOINT LOADS - FORCE')){
    const o = jl[r.LoadPat] = jl[r.LoadPat] || { pat:r.LoadPat, cat:catDe[r.LoadPat] || categoria(r.LoadPat, ''), F1:0, F2:0, F3:0, M1:0, M2:0, M3:0, ids:[] };
    for(const k of ['F1','F2','F3','M1','M2','M3']) o[k] += num(r[k]); o.ids.push(r.Joint); }
  const nudosF = Object.values(jl).map(o => ({ ...o, F1:r3(o.F1), F2:r3(o.F2), F3:r3(o.F3), M1:r3(o.M1), M2:r3(o.M2), M3:r3(o.M3), n:o.ids.length, ids:rangos(o.ids.map(String)) }));

  // Combinaciones definidas en el modelo (para compararlas con el paso de Combinaciones)
  const cb = {}; let ult = '';
  for(const r of tb('COMBINATION DEFINITIONS')){ const n = r.ComboName || ult; ult = n; if(!n) continue;
    const o = cb[n] = cb[n] || { n, tipo:r.ComboType || '', casos:{} };
    if(r.CaseName) o.casos[r.CaseName] = r3((o.casos[r.CaseName] || 0) + num(r.ScaleSF)); }
  const combos = Object.values(cb);
  const dsp = desplazamientos(texto), fz = fuerzasDe(T, null);

  return { ok:true, ver:pc.Version || '', prog:pc.ProgramName || 'SAP2000', unidades, okUnid, materiales, patrones,
    nudos:{ n:xs.length, x:ext(0), y:ext(1), z:ext(2), apoyos }, frames:tb('FRAME SECTION ASSIGNMENTS').length, secciones, dist, punt, nudosF, combos, desp:{ casos:dsp.casos, n:dsp.n }, fuerzas:fz,
    tablas:Object.keys(T) };
}

// ─── 3. Tablas completas (solo para imprimir si se pide) ───
function completas(texto){
  const T = leer(texto), tb = n => T[n] || [];
  const J = {}; for(const r of tb('JOINT COORDINATES')) J[r.Joint] = [num(r.GlobalX ?? r.XorR), num(r.GlobalY ?? r.Y), num(r.GlobalZ ?? r.Z)];
  const con = {}; for(const r of tb('CONNECTIVITY - FRAME')){ const a = J[r.JointI], b = J[r.JointJ]; con[r.Frame] = [r.JointI, r.JointJ, r.Length ? num(r.Length) : a && b ? Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]) : null]; }
  return {
    nudos: Object.entries(J).map(([j, p]) => [j, ...p]),
    secciones: tb('FRAME SECTION ASSIGNMENTS').map(r => [r.Frame, ...(con[r.Frame] || ['', '', null]), r.SectionType || '', r.AnalSect || '']),
    dist: tb('FRAME LOADS - DISTRIBUTED').map(r => [r.Frame, r.LoadPat, r.CoordSys, r.Type || 'Force', r.Dir, num(r.FOverLA), num(r.FOverLB)]),
    punt: tb('FRAME LOADS - POINT').map(r => [r.Frame, r.LoadPat, r.CoordSys, r.Type || 'Force', r.Dir, num(r.RelDist), num(r.Force ?? r.Moment)]),
    jl: tb('JOINT LOADS - FORCE').map(r => [r.Joint, r.LoadPat, num(r.F1), num(r.F2), num(r.F3), num(r.M1), num(r.M2), num(r.M3)]),
  };
}

// ─── Desplazamientos de nudos (resultados del análisis) ───
// Del archivo exportado con la tabla «JOINT DISPLACEMENTS», o de la tabla copiada desde SAP (columnas separadas por tabulador).
function desplazamientos(texto){
  const out = {}, put = (j, c, u1, u2, u3) => {
    if(j == null || !c) return; const k = `${String(j).trim()}|${String(c).trim()}`, o = out[k];
    const v = { U1:num(u1), U2:num(u2), U3:num(u3) };
    if(!o) out[k] = v; else for(const q of ['U1','U2','U3']) if(Math.abs(v[q]) > Math.abs(o[q])) o[q] = v[q];   // Max/Min: el mayor en valor absoluto
  };
  const T = leer(texto), nomT = Object.keys(T).filter(n => /JOINT DISPLACEMENTS/.test(n) && !/ABSOLUTE|GENERALIZED/.test(n));
  const filas = nomT.flatMap(n => T[n]);
  for(const r of filas) put(r.Joint, r.OutputCase, r.U1, r.U2, r.U3);
  if(!filas.length){   // tabla pegada
    const ls = String(texto).replace(/\r/g, '').split('\n').map(l => l.split('\t').map(x => x.trim()));
    const hi = ls.findIndex(l => l.includes('Joint') && l.includes('U1')); if(hi >= 0){
      const H = ls[hi], ix = n => H.indexOf(n);
      for(const l of ls.slice(hi + 1)) if(l[ix('Joint')] && !/^text$/i.test(l[ix('Joint')]) && l[ix('U1')] !== '' && isFinite(num(l[ix('U1')])) && !/^m$/i.test(l[ix('U1')]))
        put(l[ix('Joint')], l[ix('OutputCase')], l[ix('U1')], l[ix('U2')], l[ix('U3')]);
    }
  }
  const casos = [...new Set(Object.keys(out).map(k => k.split('|')[1]))];
  return { mapa:out, casos, n:Object.keys(out).length, tablas:Object.keys(T), conResultados:Object.keys(T).filter(n => /DISPLACEMENT|REACTION|FORCES|MODAL|RESULT/.test(n)) };
}

// ─── 4. Peso propio del modelo (sin los rieles, que ya están en el Anexo A) ───
function pesoPropio(M, sinPeso){
  if(!M?.ok) return 0;
  const ex = new Set(sinPeso || M.secciones.filter(s => s.riel).map(s => s.s));
  return r3(M.secciones.filter(s => !ex.has(s.s)).reduce((a, s) => a + s.kN, 0));
}

// ─── 5. Revisión cruzada con los Anexos A y B (solo en pantalla) ───
// Devuelve filas { grupo, que, esperado, sap, estado:'ok'|'no'|'info', txt }
function revisar(M, RA, RB, CB){
  const out = []; if(!M?.ok) return out;
  // la categoría se recalcula siempre (así las reglas nuevas aplican también a modelos ya cargados)
  M = { ...M, patrones:M.patrones.map(p => ({ ...p, cat:categoria(p.n, p.tipo) })) };
  const catDe = Object.fromEntries(M.patrones.map(p => [p.n, p.cat]));
  M.dist = M.dist.map(d => ({ ...d, cat:catDe[d.pat] || categoria(d.pat, '') }));
  M.nudosF = M.nudosF.map(o => ({ ...o, cat:catDe[o.pat] || categoria(o.pat, '') }));
  const cerca = (a, b) => Math.abs(Math.abs(a) - Math.abs(b)) <= Math.max(0.006, 0.03 * Math.abs(b));
  const f2 = v => (Math.round(v * 1000) / 1000).toString();
  if(!M.okUnid) out.push({ grupo:'Unidades', estado:'no', txt:`El archivo está en «${M.unidades || 'sin dato'}». Para comparar, exporta el modelo con las unidades KN, m, C.` });

  // Patrones: tipo coherente con el nombre y peso propio una sola vez
  for(const p of M.patrones){ const esp = TIPO_ESPERADO[p.cat];
    if(esp && p.tipo && !esp.test(p.tipo)) out.push({ grupo:'Patrones', estado:'info', txt:`El patrón ${p.n} (carga ${NOM_CAT[p.cat]}) está definido como tipo «${p.tipo}». Si usas las combinaciones automáticas del software, debería ser ${({L:'Live',W:'Wind',E:'Quake',D:'Dead'})[p.cat]}.` }); }
  const sw = M.patrones.reduce((a, p) => a + p.swm, 0);
  out.push(sw === 1 ? { grupo:'Patrones', estado:'ok', txt:`El peso propio se incluye una sola vez (${M.patrones.filter(p => p.swm).map(p => p.n).join(', ')}, multiplicador 1).` }
    : { grupo:'Patrones', estado:'no', txt: sw === 0 ? 'Ningún patrón incluye el peso propio (SelfWtMult = 0 en todos).' : `El peso propio se suma ${sw} veces (revisa SelfWtMult en los patrones).` });
  if(!M.okUnid) return out;

  // Cargas distribuidas frente al Anexo A
  const refs = [];
  if(RA?.paneles){ const w = RA.viento?.ok ? RA.viento.porElem.find(e => e.id === 'riel') : null;
    refs.push({ el:'Riel de paneles', cat:'D', v:RA.paneles.Dr }, { el:'Riel de paneles', cat:'L', v:RA.paneles.Lr3 });
    if(w) refs.push({ el:'Riel de paneles', cat:'W', v:w.Wp, n:'presión' }, { el:'Riel de paneles', cat:'W', v:w.Ws, n:'succión' }); }
  if(RA?.lamina){ const w = RA.viento?.ok ? RA.viento.porElem.find(e => e.id === 'correa') : null;
    refs.push({ el:'Correa de cubierta', cat:'D', v:RA.lamina.Dr }, { el:'Correa de cubierta', cat:'L', v:RA.lamina.Lr3 });
    if(w) refs.push({ el:'Correa de cubierta', cat:'W', v:w.Wp, n:'presión' }, { el:'Correa de cubierta', cat:'W', v:w.Ws, n:'succión' }); }
  const usados = new Set();
  for(const r of refs.filter(r => r.v > 0)){
    const g = M.dist.filter(d => d.cat === r.cat && d.tipo === 'Force' && cerca(d.a, r.v) && cerca(d.b, r.v));
    g.forEach(x => usados.add(x));
    const que = `${r.el} — ${NOM_CAT[r.cat]}${r.n ? ' (' + r.n + ')' : ''}`;
    if(g.length) out.push({ grupo:'Cargas del Anexo A', estado:'ok', que, esperado:r.v, txt:`${que}: ${f2(r.v)} kN/m → en el modelo ${g.map(x => `${x.pat} ${f2(x.a)} kN/m en ${x.n} elemento${x.n>1?'s':''}`).join('; ')}.` });
    else { const hay = [...new Set(M.dist.filter(d => d.cat === r.cat).map(d => f2(d.a)))];
      out.push({ grupo:'Cargas del Anexo A', estado:'no', que, esperado:r.v, txt:`${que}: ${f2(r.v)} kN/m no aparece en el modelo.${hay.length ? ' Valores de carga ' + NOM_CAT[r.cat] + ' en el modelo: ' + hay.join(', ') + ' kN/m.' : ''}` }); }
  }
  for(const d of M.dist.filter(d => !usados.has(d) && !['E','N'].includes(d.cat) && (d.a || d.b)))
    out.push({ grupo:'Cargas sin referencia', estado:'info', txt:`${d.pat} ${f2(d.a)}${d.b !== d.a ? '→' + f2(d.b) : ''} kN/m (${d.dir === 'Gravity' ? 'gravedad' : (d.sis === 'Local' ? 'local ' : '') + d.dir}) en ${d.n} elemento${d.n>1?'s':''} (${d.ids}). No corresponde a un valor del Anexo A; verifica de dónde sale (p. ej. otras cargas del Anexo B).` });

  // Combinaciones del paso «Combinaciones» frente a las del modelo
  if(CB && CB.length){
    if(!M.combos) out.push({ grupo:'Combinaciones', estado:'info', txt:'Este modelo se cargó antes de que la app leyera las combinaciones. Usa «Reemplazar» con el mismo archivo para revisarlas.' });
    else {
      const firma = o => Object.entries(o).filter(([, f]) => f).map(([p, f]) => `${p.toUpperCase()}:${r3(f)}`).sort().join('|');
      const sapF = new Map(M.combos.map(c => [firma(c.casos), c.n]));
      const falt = CB.filter(c => !sapF.has(firma(c.sap)));
      const ok = CB.length - falt.length;
      if(ok) out.push({ grupo:'Combinaciones', estado:'ok', txt:`${ok} de ${CB.length} combinaciones de la app están en el modelo con los mismos factores.` });
      for(const c of falt.slice(0, 15)) out.push({ grupo:'Combinaciones', estado:'no', txt:`Falta ${c.id}: ${c.txt} (${Object.entries(c.sap).map(([p, f]) => p + ' ' + f).join(', ')}).` });
      if(falt.length > 15) out.push({ grupo:'Combinaciones', estado:'no', txt:`… y ${falt.length - 15} combinaciones más que no están en el modelo.` });
    }
  }
  // Fuerzas sísmicas frente a la FHE del Anexo B
  if(RB?.ok){
    const qs = M.nudosF.filter(o => o.cat === 'E');
    if(!qs.length) out.push({ grupo:'Sismo (Anexo B)', estado:'info', txt:'No se encontraron cargas en nudos en los patrones sísmicos; compara manualmente la FHE aplicada en el modelo.' });
    for(const o of qs){
      const F = Math.abs(o.F1) >= Math.abs(o.F2) ? ['X', o.F1, RB.tx.Vs] : ['Y', o.F2, RB.ty.Vs];
      if(Math.abs(F[1]) > 1e-6) out.push({ grupo:'Sismo (Anexo B)', estado: cerca(F[1], F[2]) ? 'ok' : 'no', txt:`${o.pat}: suma de fuerzas en ${F[0]} = ${f2(F[1])} kN; FHE del Anexo B = ${f2(F[2])} kN.` });
      else if(Math.abs(o.M3) > 1e-6){ const okT = cerca(o.M3, RB.MtX) || cerca(o.M3, RB.MtY);
        out.push({ grupo:'Sismo (Anexo B)', estado: okT ? 'ok' : 'no', txt:`${o.pat}: momento torsor aplicado = ${f2(o.M3)} kN·m; Anexo B: Mt en X = ${f2(RB.MtX)}, Mt en Y = ${f2(RB.MtY)} kN·m.` }); }
    }
  }
  return out;
}

// ─── Fuerzas en los elementos (ELEMENT FORCES - FRAMES) condensadas por grupo (sección + función) ───
// Por grupo: envolvente (máx/mín de cada fuerza con su elemento y combinación) y filas críticas con las fuerzas
// concomitantes (la misma fila de SAP), que son las que se usan para la interacción P–M en el Anexo D.
const FZ = ['P','V2','V3','T','M2','M3'];
function funcionElem(a, b){
  if(!a || !b) return 'Elemento';
  const L = Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]); if(!(L > 0)) return 'Elemento';
  const r = Math.abs(a[2]-b[2]) / L;
  return r > 0.9 ? 'Columna' : r < 0.15 ? 'Viga' : 'Diagonal';
}
// Combinaciones de resistencia por defecto: llevan carga muerta y (algún factor > 1, sismo o impacto). Las de servicio (1.0D + 1.0Lr) y las envolventes sin carga muerta (derivas) quedan fuera.
function combosResistencia(T){
  const pat = Object.fromEntries((T['LOAD PATTERN DEFINITIONS'] || []).map(r => [r.LoadPat, categoria(r.LoadPat, r.DesignType)]));
  const cb = {}; let ult = '';
  for(const r of T['COMBINATION DEFINITIONS'] || []){ const n = r.ComboName || ult; ult = n; if(!n || !r.CaseName) continue; (cb[n] = cb[n] || []).push([r.CaseName, num(r.ScaleSF)]); }
  const info = (n, prof = 0) => { const o = { D:false, E:false, N:false, max:0 };
    for(const [c, f] of cb[n] || []){
      if(cb[c] && prof < 5){ const i = info(c, prof + 1); o.D ||= i.D; o.E ||= i.E; o.N ||= i.N; o.max = Math.max(o.max, Math.abs(f) * (i.max || 1)); continue; }
      const k = pat[c] || categoria(c, ''); if(k === 'D') o.D = true; if(k === 'E') o.E = true; if(k === 'N') o.N = true; o.max = Math.max(o.max, Math.abs(f)); }
    return o; };
  return Object.keys(cb).filter(n => { const i = info(n); return i.D && (i.max > 1.0001 || i.E || i.N); });
}
function fuerzasDe(T, res){
  const filas = T['ELEMENT FORCES - FRAMES'] || [];
  if(!filas.length) return { n:0, casos:[], res:[], grupos:[] };
  const casos = [...new Set(filas.map(r => r.OutputCase))];
  const defRes = combosResistencia(T).filter(c => casos.includes(c));
  const usar = new Set(res || (defRes.length ? defRes : casos));
  const J = {}; for(const r of T['JOINT COORDINATES'] || []) J[r.Joint] = [num(r.GlobalX ?? r.XorR), num(r.GlobalY ?? r.Y), num(r.GlobalZ ?? r.Z)];
  const fun = {}; for(const r of T['CONNECTIVITY - FRAME'] || []) fun[r.Frame] = funcionElem(J[r.JointI], J[r.JointJ]);
  const sec = {}; for(const r of T['FRAME SECTION ASSIGNMENTS'] || []) sec[r.Frame] = r.AnalSect || r.DesignSect || '?';
  const G = {};
  for(const r of filas){
    if(!usar.has(r.OutputCase)) continue;
    const f = { F:r.Frame, c:r.OutputCase, st:num(r.Station), step:r.StepType || '' }; for(const k of FZ) f[k] = num(r[k]);
    const s = sec[r.Frame] || '?', fn = fun[r.Frame] || 'Elemento', key = s + '|' + fn;
    const g = G[key] = G[key] || { sec:s, fun:fn, ids:new Set(), env:{}, crit:{} };
    g.ids.add(r.Frame);
    for(const k of FZ){ const e = g.env[k] = g.env[k] || { max:null, min:null };
      if(!e.max || f[k] > e.max[k]) e.max = f; if(!e.min || f[k] < e.min[k]) e.min = f; }
    const cr = g.crit, upd = (n, better) => { if(!cr[n] || better(f, cr[n])) cr[n] = f; };
    upd('comp', (a, b) => a.P < b.P); upd('tens', (a, b) => a.P > b.P);
    upd('M3', (a, b) => Math.abs(a.M3) > Math.abs(b.M3)); upd('M2', (a, b) => Math.abs(a.M2) > Math.abs(b.M2));
    upd('V2', (a, b) => Math.abs(a.V2) > Math.abs(b.V2)); upd('V3', (a, b) => Math.abs(a.V3) > Math.abs(b.V3)); upd('T', (a, b) => Math.abs(a.T) > Math.abs(b.T));
  }
  const red = f => f && ({ ...f, ...Object.fromEntries(FZ.map(k => [k, Math.round(f[k] * 1e4) / 1e4])) });
  const grupos = Object.values(G).map(g => ({ sec:g.sec, fun:g.fun, n:g.ids.size, ids:rangos([...g.ids]),
    env:Object.fromEntries(FZ.map(k => [k, { max:red(g.env[k].max), min:red(g.env[k].min) }])),
    crit:Object.fromEntries(Object.entries(g.crit).map(([k, f]) => [k, red(f)])) }))
    .sort((a, b) => a.sec.localeCompare(b.sec) || a.fun.localeCompare(b.fun));
  return { n:filas.length, casos, res:[...usar], defRes, grupos, envMaxMin: filas.some(r => r.StepType === 'Max' || r.StepType === 'Min') };
}
const fuerzas = (texto, res) => fuerzasDe(leer(texto), res);
// Todas las filas por grupo (para el diseño del Anexo D) y la longitud de cada grupo (estación máxima de sus elementos)
function filasGrupos(texto, res){
  const T = leer(texto), filas = T['ELEMENT FORCES - FRAMES'] || [], usar = res ? new Set(res) : null;
  const J = {}; for(const r of T['JOINT COORDINATES'] || []) J[r.Joint] = [num(r.GlobalX ?? r.XorR), num(r.GlobalY ?? r.Y), num(r.GlobalZ ?? r.Z)];
  const fun = {}, lon = {}; for(const r of T['CONNECTIVITY - FRAME'] || []){ fun[r.Frame] = funcionElem(J[r.JointI], J[r.JointJ]); const a = J[r.JointI], b = J[r.JointJ]; if(a && b) lon[r.Frame] = Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]); }
  const sec = {}; for(const r of T['FRAME SECTION ASSIGNMENTS'] || []) sec[r.Frame] = r.AnalSect || r.DesignSect || '?';
  const G = {};
  for(const r of filas){
    if(usar && !usar.has(r.OutputCase)) continue;
    const key = (sec[r.Frame] || '?') + '|' + (fun[r.Frame] || 'Elemento');
    const g = G[key] = G[key] || { filas:[], Lmax:0 };
    const f = { F:r.Frame, c:r.OutputCase, st:num(r.Station), step:r.StepType || '' }; for(const k of FZ) f[k] = num(r[k]);
    g.filas.push(f); g.Lmax = Math.max(g.Lmax, lon[r.Frame] || f.st);
  }
  return G;
}

const api = { filasGrupos, fuerzas, desplazamientos, leer, analizar, completas, pesoPropio, revisar, rangos, categoria, NOM_CAT };
if(typeof module !== 'undefined') module.exports = api; else root.AnexoC = api;
})(typeof window !== 'undefined' ? window : globalThis);
