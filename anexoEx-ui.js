/* ═══ Anexo E — tipos de la app de conexiones dentro de la memoria (pedido de Amo 20-nov) ═══
   Amo escoge el tipo en la galería (los mismos de la app de conexiones), dice qué une (elementos del Anexo D) y la app:
   · toma los perfiles y aceros del Anexo D (con candado),
   · busca en el modelo los nudos donde se encuentran los dos grupos de perfiles (una conexión puede cubrir varios nudos),
   · revisa la conexión con TODAS las filas de resistencia de esos extremos y muestra la que controla.
   El resto de datos (placa, pernos, soldaduras, sismo…) se escribe en las mismas secciones de la app de conexiones (ConUI).
   Decisiones de Amo (20-nov): la placa base nueva reemplaza a la vieja en la galería; viga–columna vieja solo para memorias viejas;
   la soldadura libre se queda; cargas = todas las filas; una conexión puede cubrir varios nudos. */
'use strict';
const esCx = c => !!(c && window.ConUI && ConUI.NOMBRES[c.tipo]);
const CX_VC = ['aleta', 'angular', 'testaV', 'asiento', 'testa', 'ras', 'soldada'];   // viga que llega a una columna (o a otra viga)
const CX_MOM = ['testa', 'ras', 'soldada', 'empalme', 'empZ', 'empCol'];                      // M3 se guarda como Mu
const CX_EMP = ['empalme', 'empZ', 'empCol'];
const CX_DESC = { esquina:'Diagonal a la esquina viga–columna (fuerza uniforme)', cruce:'Cruce de dos diagonales en X', aleta:'Viga a columna o a viga, a cortante', angular:'Viga a columna o a viga, a cortante', testaV:'Viga a columna o a viga, a cortante', asiento:'Viga apoyada sobre un angular',
  testa:'Viga a columna a momento', ras:'Viga a columna a momento', soldada:'Viga soldada a la columna a momento', empalme:'Unión de dos tramos de viga', empZ:'Unión soldada de dos tramos de viga',
  cartela:'Diagonal a una placa', grupo:'Grupo de pernos con carga excéntrica (cargas a mano)', base:'Columna sobre pedestal (reacciones del modelo)', empCol:'Unión de dos tramos de columna' };
const CX_CORT = ['aleta', 'angular', 'testaV', 'asiento'];                        // conexiones a cortante (extremo articulado)
const REL_ICO = { lib:' · articulado', parc:' · rigidez parcial', emp:' · empotrado', '?':'' };
const REL_TXT = { lib:'M3 liberado en el modelo (articulado)', parc:'Rigidez parcial en el modelo', emp:'Sin liberar en el modelo: el extremo trabaja a momento', '?':'El archivo no trae las liberaciones' };
const relExt = (T, x) => (x.e === 'i' ? T?.[x.F]?.ri : T?.[x.F]?.rj) || '?';
// Coherencia entre el tipo de conexión y el modelo (pedido de Amo 20-nov): si la viga no tiene liberación (releases / partial fixity),
// el modelo la supone empotrada → la conexión debe ser a momento; una a cortante solo vale si se libera M3 en el modelo.
function avisoRel(c, ext, T){
  if(!T || !ext.length) return '';
  const est = ext.map(x => relExt(T, x)), n = k => est.filter(r => r === k).length, nud = k => [...new Set(ext.filter((x, i) => est[i] === k).map(x => x.j))].join(', ');
  if(CX_CORT.includes(c.tipo) && n('emp')) return `<div class="note" style="margin-top:8px;border-left:3px solid #b91c1c;background:#fef2f2;color:#991b1b"><b>Esta conexión es a cortante, pero en el modelo la viga está empotrada en ${n('emp') === ext.length ? 'todos los nudos' : 'los nudos ' + esc(nud('emp'))}</b> (no tiene liberación de momento): ahí el modelo supone una unión a momento. Use una conexión a momento (chapa de testa, soldada…), o, si usa esta, libere M3 en ese extremo de la viga en el modelo (Assign → Frame → Releases/Partial Fixity), vuelva a correrlo y súbalo de nuevo.</div>`;
  if(CX_CORT.includes(c.tipo) && n('parc')) return `<div class="note amber" style="margin-top:8px">En los nudos ${esc(nud('parc'))} la viga tiene rigidez parcial en el modelo: una conexión a cortante supone el extremo articulado. Revise que sea coherente.</div>`;
  if(['testa', 'ras', 'soldada'].includes(c.tipo) && n('lib')) return `<div class="note amber" style="margin-top:8px">En los nudos ${esc(nud('lib'))} la viga tiene M3 liberado en el modelo (articulada), pero esta conexión es a momento: el diseño queda del lado seguro, aunque el modelo no refleja la rigidez real del nudo. Revise que sea lo que quiere.</div>`;
  if(ext.some(x => T[x.F]?.rDed) && (CX_CORT.includes(c.tipo) || ['testa', 'ras', 'soldada'].includes(c.tipo))) return '<p class="hint" style="margin-top:6px">El archivo no trae la tabla de liberaciones: «articulado / empotrado» se dedujo de las fuerzas (M3 ≈ 0 en todas las combinaciones = articulado).</p>';
  if(est.every(r => r === '?')) return '<p class="hint" style="margin-top:6px">El archivo no trae las liberaciones de los elementos (exporte MODEL DEFINITION → Frame Assignments completo) para revisar si el extremo es articulado o empotrado.</p>';
  return '';
}
const cxPre = t => ({ aleta:'CA', angular:'DA', testaV:'TV', asiento:'AS', testa:'CT', ras:'CR', empalme:'EV', empZ:'EZ', soldada:'SP', cartela:'DC', grupo:'GE', base:'PB', empCol:'EC' }[t] || 'CX');
const cxNombre = t => ConUI.NOMBRES[t] || t;
let _topo = null, _cxCtx = null;

// ─── Topología del modelo (nudos de cada elemento), descargada una vez por archivo ───
async function topoModelo(){
  const C = S.m.anexos?.C; if(!C?.archivo) return null;
  const k = C.archivo.path + '|' + C.archivo.fecha;
  if(_topo?.k === k) return _topo.T;
  const T = AnexoC.topologia(await textoModelo(C)); _topo = { k, T }; return T;
}
// Extremos del grupo de «de» que llegan a un nudo del grupo de «a»: [{ F, e:'i'|'j', j }]
function extremosCx(c, D, T){
  const de = metDe(D, c.eDe), a = metDe(D, c.eA); if(!T || !de?.grupo) return [];
  const en = (g, F) => T[F]?.g === g;
  if(CX_EMP.includes(c.tipo)) return [];
  if(!a?.grupo) return [];
  const nA = new Set(); for(const F in T) if(en(a.grupo, F)){ nA.add(T[F].i); nA.add(T[F].j); }
  const out = []; for(const F in T) if(en(de.grupo, F)){ if(nA.has(T[F].i)) out.push({ F, e:'i', j:T[F].i }); if(nA.has(T[F].j)) out.push({ F, e:'j', j:T[F].j }); }
  return out.sort((x, y) => (+x.j || 0) - (+y.j || 0) || String(x.j).localeCompare(String(y.j)));
}
// Fila del modelo → campos de la conexión (ejes del miembro: 1 = P y T, 2 = V2 y M2, 3 = V3 y M3)
function cargasDeFila(tipo, f0){
  const f = {}; for(const k of ['P', 'V2', 'V3', 'T', 'M2', 'M3', 'Vx', 'Vy', 'Mx', 'My']) f[k] = Math.round((+f0[k] || 0) * 1000) / 1000;
  if(tipo === 'base') return { P:f.P, Vx:f.Vx, Vy:f.Vy, T:f.T, Mx:f.Mx, My:f.My };
  if(CX_ARR.includes(tipo)) return { Pu:f.P, V2:f.V2, V3:f.V3, T:f.T, M2:f.M2, M3:f.M3 };
  const k3 = CX_MOM.includes(tipo) ? 'Mu' : 'M3';
  return { P:f.P, Vu:Math.abs(f.V2), V3:f.V3, T:f.T, M2:f.M2, [k3]:CX_MOM.includes(tipo) ? Math.abs(f.M3) : f.M3 };
}
// Filas que revisan la conexión (todas las combinaciones de resistencia en los extremos escogidos)
function filasCx(c, D, ctx){
  if(c.tipo === 'grupo' || c.cargas === 'manual') return [{ _man:true, _t:'escritas a mano' }];
  if(c.tipo === 'base'){
    const p = pedDe(D, c.eA), M = S.m.anexos?.C?.modelo, oy = c.ori !== 'x'; if(!p) return [];
    return filasReac(ctx.R, p.nudos || [], combosD(D, M).res).map(f => ({ P:f.F3, Mx:oy ? f.M1 : f.M2, My:oy ? f.M2 : f.M1, Vx:oy ? f.F2 : f.F1, Vy:oy ? f.F1 : f.F2, T:f.M3, _t:filaReacTxt(f), _j:f.j, _c:f.c }));
  }
  const de = metDe(D, c.eDe); if(!de) return [];
  if(de.fuerzas === 'manual'){ const m = de.manual || {}; return [{ P:+m.P || 0, V2:+m.V2 || 0, V3:+m.V3 || 0, T:+m.T || 0, M2:+m.M2 || 0, M3:+m.M3 || 0, _t:'fuerzas del Anexo D (a mano)' }]; }
  const g = ctx.G?.[de.grupo]; if(!g) return [];
  const lim = {}; for(const f of g.filas){ const l = lim[f.F] = lim[f.F] || [Infinity, -Infinity]; l[0] = Math.min(l[0], f.st); l[1] = Math.max(l[1], f.st); }
  const fila = (f, e, j) => ({ P:f.P, V2:f.V2, V3:f.V3, T:f.T, M2:f.M2, M3:f.M3, _t:`E${f.F}${e ? ' (' + e + ')' : ''}${j ? ' · nudo ' + j : ''} · ${f.c}${f.step ? ' (' + f.step + ')' : ''}${e ? '' : ' · x = ' + fx(f.st, 2) + ' m'}`, _F:f.F, _e:e, _j:j, _c:f.c });
  if(CX_EMP.includes(c.tipo)){   // empalme: en el elemento y la distancia escogidos, o en todas las estaciones del grupo (el peor)
    if(c.empF && lim[c.empF]){ const x = +c.empX || 0, fs = g.filas.filter(f => f.F === c.empF); const st = fs.reduce((a, f) => Math.abs(f.st - x) < Math.abs(a - x) ? f.st : a, fs[0]?.st ?? 0);
      return fs.filter(f => Math.abs(f.st - st) < 1e-6).map(f => fila(f)); }
    return g.filas.map(f => fila(f));
  }
  const off = new Set(c.nudosOff || []), ext = (ctx.T ? extremosCx(c, D, ctx.T) : []).filter(x => !off.has(String(x.j)));
  const out = [];
  for(const x of ext){ const l = lim[x.F]; if(!l) continue; const st = x.e === 'i' ? l[0] : l[1];
    for(const f of g.filas) if(f.F === x.F && Math.abs(f.st - st) < 1e-6) out.push(fila(f, x.e, x.j)); }
  return out;
}
// Datos de la conexión con los perfiles del Anexo D (lo que tiene candado)
const CX_LOCK = {};
// Sismo de las conexiones del Anexo E = el del paso «Combinaciones» (sistema estructural; pedido de Amo 21-nov); los empalmes de vigas de gravedad van sin sismo
window.ConSisProy = 'Sale del paso «Combinaciones» (sistema estructural de la memoria)';
const CX_SIS = ['testa', 'ras', 'soldada', 'empalme', 'empZ', 'cartela', 'esquina', 'cruce', 'base', 'empCol'];
const CX_ARR = ['cartela', 'esquina', 'cruce'];   // la primera pieza es una diagonal
function sisMemoria(){ const an = S.m?.anexos || {}, k = String(an.K?.sisR || '').toLowerCase(); return an.B && an.B.aplica !== false ? (k === 'des' ? 'DES' : k === 'dmo' ? 'DMO' : 'no') : 'no'; }
function entradaCx(c, D, T){
  const z = { ...c }, lock = new Set(), avisos = [];
  if(CX_SIS.includes(c.tipo)) z.sismo = ['empalme', 'empZ'].includes(c.tipo) && c.vigaGrav ? 'no' : sisMemoria();
  const de = metDe(D, c.eDe), a = metDe(D, c.eA), sd = de ? secDe(de) : null, sa = a ? secDe(a) : null;
  const ponI = (k, kA, el, s) => { if(el && s?.tipo === 'I'){ z[k] = el.perfil; z[kA] = el.acero || z[kA]; lock.add(k); lock.add(kA); return true; } return false; };
  if(CX_VC.includes(c.tipo)){
    if(c.tipo === 'soldada' && sd?.tipo === 'HSS'){ z.miembro = 'tubo'; z.H = +de.H; z.B = +de.B; z.tt = +de.t; z.aceroViga = de.acero || z.aceroViga; ['miembro', 'H', 'B', 'tt', 'aceroViga'].forEach(k => lock.add(k)); }
    else if(de){ if(ponI('viga', 'aceroViga', de, sd)){ if(c.tipo === 'soldada'){ z.miembro = 'I'; lock.add('miembro'); } } else avisos.push(`${de.nom} no es un perfil I: escoja otro elemento o use otro tipo de conexión.`); }
    if(a && sa?.tipo === 'I'){
      const esCol = /Columna/i.test(a.grupo || '') || /col/i.test(a.desc || ''), ala = c.cara !== 'alma';
      if(['testa', 'ras'].includes(c.tipo)){ z.columna = esCol && ala ? a.perfil : ''; z.aceroCol = a.acero || z.aceroCol; lock.add('columna'); lock.add('aceroCol'); if(!ala) avisos.push('La chapa de testa va contra el ala de la columna: con «alma» no se revisa la columna.'); }
      else if(c.tipo === 'soldada'){ z.soporte = ala ? 'col' : 'alma'; z.columna = a.perfil; z.aceroCol = a.acero || z.aceroCol; ['soporte', 'columna', 'aceroCol'].forEach(k => lock.add(k)); }
      else { if('soporte' in z || ['aleta', 'angular'].includes(c.tipo)){ z.soporte = esCol ? (ala ? 'ala' : 'alma') : 'viga'; lock.add('soporte'); }
        z.tSop = esCol && ala ? sa.tf : sa.tw; z.aceroSop = a.acero || z.aceroSop; lock.add('tSop'); lock.add('aceroSop'); }
    }
  }
  if(c.tipo === 'empCol'){
    if(de && sd?.tipo === 'I'){ z.colI = de.perfil; z.acero = de.acero || z.acero; lock.add('colI'); lock.add('acero'); } else if(de) avisos.push(`${de.nom} no es un perfil I: el empalme de columna se revisa con perfiles I.`);
    if(a && sa?.tipo === 'I'){ z.colS = a.perfil; lock.add('colS'); } else if(!c.eA){ z.colS = ''; lock.add('colS'); }
  }
  else if(CX_EMP.includes(c.tipo) && de && !ponI('viga', 'aceroViga', de, sd)) avisos.push(`${de.nom} no es un perfil I.`);
  if(c.tipo === 'esquina' && a && sa?.tipo === 'I'){ const esCol = /Columna/i.test(a.grupo || '') || /col/i.test(a.desc || ''); if(esCol){ z.columna = a.perfil; z.aceroCol = a.acero || z.aceroCol; lock.add('columna'); lock.add('aceroCol'); } else { z.viga = a.perfil; z.aceroViga = a.acero || z.aceroViga; lock.add('viga'); lock.add('aceroViga'); } }
  if(CX_ARR.includes(c.tipo) && de && sd?.tipo === 'HSS'){ z.diag = 'tubo'; z.Bt = +de.B; z.tt = +de.t; z.aceroT = de.acero && /A500/.test(de.acero) ? de.acero : z.aceroT; ['diag', 'Bt', 'tt'].forEach(k => lock.add(k)); if(+de.B !== +de.H) avisos.push('La diagonal de tubo se revisa como tubo cuadrado de lado B.'); }
  if(c.tipo === 'base'){
    if(de && sd?.tipo === 'I'){ z.colTipo = 'I'; z.columna = de.perfil; lock.add('colTipo'); lock.add('columna'); }
    else if(de && sd?.tipo === 'HSS'){ z.colTipo = 'tubo'; z.Ht = +de.H; z.Bt = +de.B; z.tt = +de.t; ['colTipo', 'Ht', 'Bt', 'tt'].forEach(k => lock.add(k)); }
    const p = pedDe(D, c.eA), oy = c.ori !== 'x';
    if(p){ z.Lp = numE(oy ? p.h : p.b); z.Wp = numE(oy ? p.b : p.h); z.ha = numE(p.Hp) * 1000; z.fc = numE(p.fc); ['Lp', 'Wp', 'ha', 'fc'].forEach(k => lock.add(k)); }
  }
  // Longitud para clasificar la rigidez (K = Sj·L/EI): la del modelo (la menor de los extremos escogidos, del lado seguro para llamarla rígida)
  if(T){
    if(['testa', 'ras', 'soldada'].includes(c.tipo)){ const off = new Set((c.nudosOff || []).map(String)), Ls = extremosCx(c, D, T).filter(x => !off.has(String(x.j))).map(x => T[x.F]?.L).filter(x => x > 0);
      if(Ls.length){ z.Lviga = +Math.min(...Ls).toFixed(3); lock.add('Lviga'); } }
    if(c.tipo === 'base'){ const p = pedDe(D, c.eA), de = metDe(D, c.eDe), ns = new Set((p?.nudos || []).map(String));
      const Ls = de?.grupo ? Object.values(T).filter(f => f.g === de.grupo && (ns.has(String(f.i)) || ns.has(String(f.j)))).map(f => f.L) : [];
      if(Ls.length){ z.Lcol = +Math.min(...Ls).toFixed(3); lock.add('Lcol'); } }
  }
  return { z, lock, avisos };
}
// Cálculo con todas las filas: se guarda la fila que controla y el resultado completo con ella (con su 💡)
function calcCx(c, D, ctx){
  const { z, avisos } = entradaCx(c, D, ctx.T), filas = filasCx(c, D, ctx);
  if(!filas.length){ const e = c.tipo === 'base' ? 'Sin reacciones: escoja el pedestal (con sus nudos) y revise el archivo del modelo.' : !metDe(D, c.eDe) ? 'Escoja los elementos que une (Anexo D).'
      : CX_EMP.includes(c.tipo) ? 'El perfil no tiene fuerzas del modelo.' : 'No hay extremos con fuerzas: revise qué une, los nudos o escriba las cargas a mano.';
    c.res = { ok:false, error:e }; return { ok:false, error:e }; }
  let peor = null, pR = -1;
  for(const f of filas){ const inp = f._man ? z : { ...z, ...cargasDeFila(c.tipo, f) }; const r = Conex.calc({ ...inp, _sinSug:true });
    if(r.error){ c.res = { ok:false, error:r.error }; return { ok:false, error:r.error }; }
    // a igual relación (p. ej. controla un chequeo que no depende de la carga) se muestra la fila con más fuerza
    const mag = f._man ? 0 : Math.abs(f.M3 ?? f.Mx ?? 0) + Math.abs(f.V2 ?? f.Vx ?? 0) + Math.abs(f.P ?? 0) + Math.abs(f.M2 ?? f.My ?? 0);
    const m = (isFinite(r.max) ? r.max : 99) + 1e-7 * Math.min(mag, 1e4); if(m > pR){ pR = m; peor = f; } }
  const inp = peor._man ? z : { ...z, ...cargasDeFila(c.tipo, peor) }, R = Conex.calc(inp);
  if(CX_CORT.includes(c.tipo) && c.cargas !== 'manual'){ const mM = Math.max(0, ...filas.map(f => Math.abs(f.M3 || 0)));
    const emp = ctx.T ? [...new Set(filas.filter(f => f._F && relExt(ctx.T, { F:f._F, e:f._e }) === 'emp').map(f => f._j))] : [];
    if(emp.length) avisos.push(`NO USAR ESTA CONEXIÓN TAL COMO ESTÁ EL MODELO: en los nudos ${emp.join(', ')} la viga no tiene liberación de momento (está empotrada${mM > 0.05 ? `, M3 hasta ${fx(mM, 1)} kN·m` : ''}), así que el modelo supone una unión a momento. Use una conexión a momento, o libere M3 en ese extremo en el modelo (Assign → Frame → Releases/Partial Fixity), vuelva a correrlo y suba el archivo de nuevo.`);
    else if(mM > 1) avisos.push(`El modelo tiene momento en el extremo de la viga (M3 hasta ${fx(mM, 1)} kN·m), pero esta conexión es a cortante (extremo articulado): libere los momentos de ese extremo en el modelo o use una conexión a momento.`); }
  if(avisos.some(a => a.startsWith('NO USAR'))) R.req = [['Coherencia con el modelo: extremo de la viga liberado (articulado) para una conexión a cortante', false, 'en el modelo está empotrado'], ...(R.req || [])];
  const rojo = avisos.filter(a => a.startsWith('NO USAR'));
  R.av = [...avisos.filter(a => !a.startsWith('NO USAR')), ...(R.av || [])];
  const ratio = isFinite(R.max) ? R.max : 99;
  c.res = { ok:true, ratio:+ratio.toFixed(3), cumple:!!R.ok, fecha:new Date().toISOString() };
  const X = { ok:true, tipo:'cx', R, inp, ratio, cumple:!!R.ok, _filas:filas, ctrl:peor, avisos:R.av, rojo };
  X.comp = compRig(c, D, X, ctx.T);
  if(R.rigid) c.res.rig = { Sj:isFinite(R.rigid.Sj) ? Math.round(R.rigid.Sj) : null, K:R.rigid.K != null && isFinite(R.rigid.K) ? +R.rigid.K.toFixed(2) : R.rigid.K === Infinity ? 999 : null, clase:R.rigid.clase, modelo:X.comp?.tono || null, ...(R.rigid.debil ? { debil:{ Sj:Math.round(R.rigid.debil.Sj), K:R.rigid.debil.K != null ? +R.rigid.debil.K.toFixed(2) : null, clase:R.rigid.debil.clase } } : {}) };
  return X;
}


// Rigidez de la conexión frente a cómo está modelado el nudo (pedido de Amo 20-nov: «el modelo se acercaría más a lo real»)
function compRig(c, D, X, T){
  const g = X?.R?.rigid; if(!g || !T || !g.clase || g.tipo === 'cortante') return null;
  const nom = { rigida:'rígida', semi:'semirrígida', art:'articulada' }[g.clase], res = isFinite(g.Sj) && g.Sj > 0 ? Math.round(g.Sj / g.eta) : null;
  const fmt = v => Math.round(v).toLocaleString('es-CO');
  if(g.tipo === 'base'){
    // Los dos ejes (20-nov): fuerte (Mx, peralte) y débil (My). Con el peralte paralelo a Y el giro fuerte es alrededor de X = R1.
    const p = pedDe(D, c.eA), ap = T._apoyos || {}, nudos = (p?.nudos || []).filter(j => ap[j]); if(!nudos.length) return null;
    const oy = c.ori !== 'x', ejes = [['fuerte', g, oy ? 'R1' : 'R2'], ['débil', g.debil, oy ? 'R2' : 'R1']].filter(e => e[1] && e[1].clase);
    const ok = [], mal = [];
    for(const [nomE, h, R] of ejes){
      const n = R === 'R1' ? '1' : '2', rs = isFinite(h.Sj) && h.Sj > 0 ? Math.round(h.Sj / 3) : null, res = nudos.map(j => ap[j][R]), todos = res.every(Boolean), ning = res.every(x => !x);
      const kN = `${nomE} (K = ${fx(h.K, 1)}, ${{ rigida:'rígida', semi:'semirrígida', art:'articulada' }[h.clase]})`;
      if(h.clase === 'rigida') (todos ? ok : mal).push(todos ? `eje ${kN}: «Rotation about ${n}» restringida` : `eje ${kN}: restrinja «Rotation about ${n}» en Restraints`);
      else if(h.clase === 'art') (ning ? ok : mal).push(ning ? `eje ${kN}: «Rotation about ${n}» libre` : `eje ${kN}: libere «Rotation about ${n}» en Restraints`);
      else if(todos) mal.push(`eje ${kN}: en el modelo está empotrado; libere «Rotation about ${n}» en Restraints y en Joint Springs escriba ${fmt(rs)} kN·m/rad en «Rotation about ${n}»`);
      else { const sp = T._resortes || {}, vals = nudos.map(j => sp[j]?.[R] || 0), gir = nudos.filter(j => sp[j]?.giro);
        if(gir.length) mal.push(`eje ${kN}: ${gir.join(', ')} tiene ejes locales girados; asigne el resorte con «Direction = Global» o revise el eje`);
        else if(vals.every(v => v > 0 && Math.abs(v - rs) <= 0.3 * rs)) ok.push(`eje ${kN}: resorte «Rotation about ${n}» = ${vals.map(fmt).join(', ')} kN·m/rad, cerca de Sj,ini/η = ${fmt(rs)}`);
        else if(!T._hayResortes) mal.push(`eje ${kN}: «Rotation about ${n}» está libre pero el archivo no trae resortes; en Joint Springs escriba ${fmt(rs)} kN·m/rad`);
        else mal.push(`eje ${kN}: «Rotation about ${n}» está libre y el resorte del modelo es ${vals.map(fmt).join(', ')} kN·m/rad; escriba ${fmt(rs)} kN·m/rad (Sj,ini/η)`); }
    }
    if(!ejes.length) return null;
    const pre = `Base en ${nudos.length > 1 ? 'los nudos' : 'el nudo'} ${nudos.join(', ')} (peralte de la columna paralelo a ${oy ? 'Y' : 'X'}): `;
    if(!mal.length) return { tono:'ok', txt:pre + ok.join('; ') + ': coherente con el modelo.' };
    return { tono:'amber', txt:pre + mal.concat(ok).join('; ') + '. Deje en 0 las traslaciones y «Rotation about 3» del resorte, vuelva a correr y suba el archivo.' };
  }
  const off = new Set((c.nudosOff || []).map(String)), ext = extremosCx(c, D, T).filter(x => !off.has(String(x.j)));
  if(!ext.length) return null;
  const est = ext.map(x => ({ x, r:relExt(T, x), k:x.e === 'i' ? T[x.F]?.ki : T[x.F]?.kj }));
  const nud = f => { const l = [...new Set(est.filter(f).map(e => e.x.j))]; return !l.length ? '' : (l.length > 1 ? 'los nudos ' : 'el nudo ') + l.join(', '); };
  if(g.clase === 'rigida'){ const malos = nud(e => e.r !== 'emp');
    return malos ? { tono:'amber', txt:`La conexión es rígida (K = ${fx(g.K, 1)}), pero en ${malos} el modelo no la tiene empotrada. Quite la liberación (release / partial fixity) de ese extremo.` }
      : { tono:'ok', txt:`La conexión es rígida (K = ${fx(g.K, 1)} ≥ 20) y en el modelo los extremos están empotrados: coherente.` }; }
  if(g.clase === 'semi'){
    const emp = nud(e => e.r === 'emp'), lib = nud(e => e.r === 'lib'), lejos = nud(e => e.r === 'parc' && res && Math.abs(e.k - res) / res > 0.3), bien = nud(e => e.r === 'parc' && res && Math.abs(e.k - res) / res <= 0.3);
    const t = [];
    if(emp) t.push(`en ${emp} el modelo la tiene empotrada`);
    if(lib) t.push(`en ${lib} el modelo la tiene articulada`);
    if(lejos) t.push(`en ${lejos} el resorte del modelo difiere más de 30 %`);
    if(!t.length) return { tono:'ok', txt:`La conexión es semirrígida (K = ${fx(g.K, 1)}) y el resorte del modelo en ${bien} está cerca de Sj,ini/η = ${fmt(res)} kN·m/rad: coherente.` };
    return { tono:'amber', txt:`La conexión es semirrígida (K = ${fx(g.K, 1)}), pero ${t.join('; ')}. Para acercar el modelo a la realidad asigne en ese extremo de la viga Partial Fixity M3 = ${fmt(res)} kN·m/rad (Assign → Frame → Releases/Partial Fixity: marque M33 y escriba el resorte), vuelva a correr y suba el archivo.` };
  }
  const emp = nud(e => e.r !== 'lib');
  return emp ? { tono:'amber', txt:`La conexión es prácticamente articulada (K = ${fx(g.K, 2)} ≤ 2), pero en ${emp} el modelo no la tiene liberada: libere M3 en ese extremo o use una conexión más rígida.` } : { tono:'ok', txt:'La conexión es articulada y en el modelo el extremo está liberado: coherente.' };
}
const compRigHTML = (o, imp) => !o ? '' : imp ? `<p class="ax-nota"><b>Modelo:</b> ${esc(o.txt)}</p>`
  : `<div class="note ${o.tono === 'ok' ? '' : 'amber'}" style="margin-bottom:10px">${o.tono === 'ok' ? '✓ ' : '⚠ '}${esc(o.txt)}</div>`;
// ─── Galería y creación ───
function galCxHTML(){
  const ver = S.m.tipo === 'verificacion' && S.m.anexos?.her ? S.m.anexos.her : null;
  const ok = t => !ver || (t === 'base' ? ver.includes('placa') : ver.includes('vc'));
  const cats = ConUI.CATS.map(([ct, L]) => [ct, L.filter(ok)]).filter(([, L]) => L.length);
  const libre = !ver || ver.includes('sold');
  return cats.map(([ct, L]) => `<div class="e-gal-cat">${esc(ct)}</div><div class="e-gal cx-gal">${L.map(t => `<button type="button" class="e-tc" data-nuevacx="${t}"><span class="cx-ico">${ConUI.ICO[t] || ''}</span><b>${esc(cxNombre(t))}</b><span>${esc(CX_DESC[t] || '')}</span></button>`).join('')}</div>`).join('')
    + (libre ? `<div class="e-gal-cat">Otras</div><div class="e-gal cx-gal"><button type="button" class="e-tc" data-nueva="sold">${miniE('sold')}<b>${TIPOS_E.sold.n}</b><span>${TIPOS_E.sold.s}</span></button></div>` : '');
}
function sigNomCx(E, t){ const pre = cxPre(t), ns = E.con.filter(c => String(c.nom).startsWith(pre + '-')).map(c => parseInt(String(c.nom).split('-')[1]) || 0); return `${pre}-${Math.max(0, ...ns) + 1}`; }
function nuevaCx(t, E, D){
  const c = { ...Conex.defaults(t), id:'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), tipo:t, nom:sigNomCx(E, t), etiqueta:'', desc:'',
    cargas:t === 'grupo' || !S.m.anexos?.C?.modelo ? 'manual' : 'modelo', eDe:'', eA:'', cara:'ala', nudosOff:[], ori:'y', res:null };
  const I = D.met.filter(e => e.tipo === 'I' || e.tipo === 'HSS'), esCol = e => /Columna/i.test(e.grupo || '') || /col/i.test(e.desc || ''), esViga = e => /Viga/i.test(e.grupo || '') || /viga/i.test(e.desc || '');
  const col = I.find(esCol), viga = I.find(e => esViga(e) && e !== col), diag = I.find(e => /Diagonal/i.test(e.grupo || ''));
  if(t === 'base'){ c.eDe = col?.id || ''; c.eA = D.ped[0]?.id || ''; }
  else if(CX_ARR.includes(t)){ c.eDe = diag?.id || ''; c.eA = t === 'cruce' ? (I.find(e => /Diagonal/i.test(e.grupo || '') && e !== diag)?.id || '') : col?.id || viga?.id || ''; }
  else if(t === 'empCol') c.eDe = col?.id || '';
  else if(CX_EMP.includes(t)) c.eDe = viga?.id || '';
  else if(t !== 'grupo'){ c.eDe = viga?.id || ''; c.eA = col?.id || ''; }
  return c;
}
// Bloque «qué une» (en la ventana de creación y arriba del editor)
function uneHTML(c, D, T){
  const ro_ = esIng() ? '' : 'disabled', op = (v, t, cur) => `<option value="${esc(v)}" ${String(cur) === String(v) ? 'selected' : ''}>${esc(t)}</option>`;
  const mets = D.met.map(e => [e.id, `${e.nom} · ${nomSec(e)}${e.grupo ? ' · ' + e.grupo.split('|')[1] : ''}${e.desc ? ' · ' + e.desc : ''}`]);
  const sel = (k, l, opts, h) => `<div class="f"><label>${l}</label><select data-cxu="${k}" ${ro_}>${opts.map(([v, t]) => op(v, t, c[k])).join('')}</select>${h ? `<div class="hint">${h}</div>` : ''}</div>`;
  if(c.tipo === 'grupo') return `<div class="cx-une"><b>Grupo de pernos excéntrico</b><p class="hint" style="margin:4px 0 0">No depende de un elemento del modelo: escriba las cargas en la franja naranja.</p></div>`;
  if(c.tipo === 'base'){ const p = pedDe(D, c.eA);
    return `<div class="cx-une"><div class="fg g3">${sel('eDe', 'Columna (Anexo D)', [['', '— escoja —'], ...mets])}${sel('eA', 'Pedestal (Anexo D)', [['', '— escoja —'], ...D.ped.map(x => [x.id, `${x.nom} · ${x.b}×${x.h} mm`])])}${sel('ori', 'Peralte d de la columna paralelo a', [['y', 'eje Y del modelo (h del pedestal)'], ['x', 'eje X del modelo (b del pedestal)']])}</div>
      <p class="hint" style="margin:2px 0 0">${p ? `Reacciones de los nudos ${esc((p.nudos || []).join(', ') || '(sin nudos: escójalos en el pedestal del Anexo D)')} del pedestal ${esc(p.nom)}, con las combinaciones de resistencia del Anexo D. Medidas y f'c del pedestal tomadas del Anexo D.` : 'Escoja el pedestal: de ahí salen sus medidas y sus nudos.'}</p></div>`; }
  if(CX_EMP.includes(c.tipo)){ const de = metDe(D, c.eDe), Fs = T && de?.grupo ? Object.keys(T).filter(F => T[F].g === de.grupo) : [];
    return `<div class="cx-une"><div class="fg g3">${sel('eDe', c.tipo === 'empCol' ? 'Columna (Anexo D)' : 'Viga (Anexo D)', [['', '— escoja —'], ...mets])}${c.tipo === 'empCol' ? sel('eA', 'Columna de arriba (Anexo D)', [['', 'La misma (no cambia de perfil)'], ...mets.filter(([id]) => id !== c.eDe)], 'Si arriba cambia el perfil') : ''}${sel('empF', 'Elemento del modelo donde va el empalme', [['', 'Cualquiera (el peor punto del grupo)'], ...Fs.map(F => [F, `E${F} · nudos ${T[F].i}–${T[F].j} · L ${fx(T[F].L, 2)} m`])])}
      ${c.empF ? `<div class="f"><label>Distancia desde el nudo inicial [m]</label><input data-cxu="empX" inputmode="decimal" value="${esc(c.empX ?? '')}" ${ro_}/><div class="hint">Se usa la estación del modelo más cercana.</div></div>` : ''}</div></div>`; }
  const de = metDe(D, c.eDe), a = metDe(D, c.eA), ext = T ? extremosCx(c, D, T) : null, off = new Set((c.nudosOff || []).map(String));
  const nudos = ext ? [...new Map(ext.map(x => [String(x.j), x])).values()] : [];
  const lado = CX_VC.includes(c.tipo) ? sel('cara', 'La viga llega a la columna por', [['ala', 'el ala (eje fuerte)'], ['alma', 'el alma (eje débil)']]) : '';
  return `<div class="cx-une"><div class="fg g3">${sel('eDe', CX_ARR.includes(c.tipo) ? (c.tipo === 'cruce' ? 'Diagonal interrumpida (Anexo D)' : 'Diagonal (Anexo D)') : 'Viga (Anexo D)', [['', '— escoja —'], ...mets])}${sel('eA', 'Llega a (Anexo D)', [['', '— escoja —'], ...mets.filter(([id]) => id !== c.eDe)])}${lado}</div>
    ${c.cargas === 'manual' ? '<p class="hint" style="margin:2px 0 0">Cargas escritas a mano: los nudos no se usan.</p>'
      : !S.m.anexos?.C?.modelo ? '<p class="hint" style="margin:2px 0 0">Sin modelo en el Anexo C: escriba las cargas a mano.</p>'
      : ext === null ? '<p class="hint" style="margin:2px 0 0">Buscando los nudos en el modelo…</p>'
      : !de || !a ? '<p class="hint" style="margin:2px 0 0">Escoja los dos elementos.</p>'
      : !nudos.length ? `<div class="note amber" style="margin-top:6px">En el modelo, ${esc(de.nom)} (${esc(de.grupo || 'sin grupo')}) no llega a ${esc(a.nom)} (${esc(a.grupo || 'sin grupo')}) en ningún nudo. Revise los grupos en el Anexo D.</div>`
      : `<p class="hint" style="margin:4px 0 0">En el modelo, ${esc(de.nom)} llega a ${esc(a.nom)} en <b>${nudos.length} nudo${nudos.length > 1 ? 's' : ''}</b>. Toque un nudo para quitarlo si esa unión es de otro tipo:</p>
        <div class="chips">${ext.map(x => { const r = relExt(T, x); return `<button type="button" class="chip ${off.has(String(x.j)) ? 'off' : ''} ${CX_CORT.includes(c.tipo) && r === 'emp' ? 'rig' : ''}" data-cxnudo="${esc(x.j)}" ${ro_} title="${esc(REL_TXT[r])}">nudo ${esc(x.j)}${ejeNudo(T, x.j) ? ` · ${esc(ejeNudo(T, x.j))}` : ''} · E${esc(x.F)} (${x.e})${REL_ICO[r]}</button>`; }).join('')}</div>
        ${avisoRel(c, ext.filter(x => !off.has(String(x.j))), T)}`}</div>`;
}
async function crearCx(t){
  const E = datosE(), D = datosD(), c = nuevaCx(t, E, D);
  if(t === 'grupo'){ E.con.push(c); selE = c.id; guardarMemoria(); paneAnexoE(); toast(`${c.nom} creada.`); return; }
  const { md, cerrar } = abrirModal(`${hdModal(`Nueva ${esc(cxNombre(t).toLowerCase())} · ¿qué une?`)}<div class="cxE" id="cxNew"></div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px"><button class="btn sm" type="button" data-cerrar>Cancelar</button><button class="btn sm pri" type="button" id="cxCrear">Crear ${esc(c.nom)}</button></div>`);
  let T = null;
  const pinta = () => { $('#cxNew', md).innerHTML = uneHTML(c, D, T); enlazaUne(c, D, md, pinta); };
  pinta();
  try{ if(S.m.anexos?.C?.modelo) T = await topoModelo(); }catch(e){ console.warn(e); T = {}; }
  pinta();
  $('#cxCrear', md).onclick = () => { E.con.push(c); selE = c.id; guardarMemoria(); cerrar(); paneAnexoE(); toast(`${c.nom} creada: ${etiquetaE(c, D)}.`); };
}
function enlazaUne(c, D, raiz, alCambiar){
  $$('[data-cxu]', raiz).forEach(s => s.addEventListener(s.tagName === 'SELECT' ? 'change' : 'input', () => { const k = s.dataset.cxu; c[k] = s.value;
    if(k === 'eDe' || k === 'eA') c.nudosOff = []; if(k === 'empF' && !s.value) c.empX = ''; if(s.tagName === 'SELECT') alCambiar(); else alCambiar(true); }));
  $$('[data-cxnudo]', raiz).forEach(b => b.onclick = () => { const j = b.dataset.cxnudo, s = new Set((c.nudosOff || []).map(String)); s.has(j) ? s.delete(j) : s.add(j); c.nudosOff = [...s]; alCambiar(); });
}

// ─── Editor dentro del Anexo E ───
function detCxHTML(c, D){
  return `<div class="card cxE"><div class="ct"><span>${esc(c.nom)} · ${esc(cxNombre(c.tipo))}</span>${esIng() ? '<button class="btn sm danger" type="button" id="eBorrar">Borrar</button>' : ''}</div>
    <div class="e-tag">🔗 <b id="eTag">${esc(etiquetaE(c, D))}</b></div>
    <div class="fg g4">${fIn(c, 'nom', 'Nombre', { num:false })}${fIn(c, 'desc', 'Descripción', { num:false, ph:'Ejes 2 y 3…' })}${fIn(c, 'etiqueta', 'Etiqueta (qué une)', { num:false, cls:'span2', ph:etiquetaE({ ...c, etiqueta:'' }, D), h:'Vacío = se arma sola' })}</div>
    <div id="cxUne"></div><div id="cxLock"></div><div id="cxCarg"></div>
    <div class="ed-grid"><div id="form"></div><div><div class="dib" id="dib"></div></div></div></div>
    <div class="card cxE" id="cxRes"><p class="muted">Calculando…</p></div>`;
}
function cargasCxHTML(c, X){
  const ro_ = esIng() ? '' : 'disabled';
  const seg = c.tipo === 'grupo' ? '' : `<span class="seg" role="group" style="margin-left:auto"><button type="button" data-cxcarg="modelo" class="${c.cargas !== 'manual' ? 'on' : ''}" ${ro_}>Del modelo</button><button type="button" data-cxcarg="manual" class="${c.cargas === 'manual' ? 'on' : ''}" ${ro_}>A mano</button></span>`;
  if(c.cargas === 'manual' || c.tipo === 'grupo') return (seg ? `<div style="display:flex;margin-bottom:6px">${seg}</div>` : '') + ConUI.cargasHTML(c);
  const fs = X?._filas || [];
  if(!X?.ok) return `<div class="cx-auto"><div class="hd"><b>Cargas del modelo (automáticas)</b>${seg}</div><p class="hint" style="margin:0">${esc(X?.error || 'Sin filas.')}</p></div>`;
  const cols = c.tipo === 'base' ? [['P', 'P (+ comp.)'], ['Vx', 'Vx'], ['Vy', 'Vy'], ['T', 'T'], ['Mx', 'Mx'], ['My', 'My']] : [['P', 'P'], ['V2', 'V2'], ['V3', 'V3'], ['T', 'T'], ['M2', 'M2'], ['M3', 'M3']];
  const ab = c.tipo === 'base' ? null : (k => x => Math.abs(x[k] || 0));
  const crit = c.tipo === 'base' ? [['P máx.', x => x.P], ['P mín.', x => -x.P], ['Mx máx.', x => Math.abs(x.Mx)], ['My máx.', x => Math.abs(x.My)], ['V máx.', x => Math.hypot(x.Vx, x.Vy)]]
    : [['M3 máx.', ab('M3')], ['V2 máx.', ab('V2')], ['P tensión máx.', x => x.P], ['P compresión máx.', x => -x.P], ['M2 máx.', ab('M2')], ['V3 máx.', ab('V3')], ['T máx.', ab('T')]];
  const sel = [['Controla', X.ctrl], ...crit.map(([n, fn]) => [n, fs.reduce((a, x) => fn(x) > fn(a) ? x : a, fs[0])])];
  const vistos = new Set(), filas = sel.filter(([, x]) => x && !vistos.has(x) && vistos.add(x));
  const r = (v, d = 2) => fx(v || 0, d);
  return `<div class="cx-auto"><div class="hd"><b>Cargas del modelo (automáticas)</b><span class="hint">kN y kN·m · ${fs.length} filas de resistencia revisadas</span>${seg}</div>
    <div class="tw"><table><tr><th>Criterio</th><th>Fila</th>${cols.map(([, t]) => `<th>${t}</th>`).join('')}</tr>
    ${filas.map(([n, x]) => `<tr class="${x === X.ctrl ? 'ctrl' : ''}"><td>${n}</td><td>${esc(x._t || '')}</td>${cols.map(([k]) => `<td class="n">${r(x[k])}</td>`).join('')}</tr>`).join('')}</table></div>
    <p class="hint" style="margin:6px 0 0">La fila amarilla es la que da la mayor relación (la conexión se revisó con las ${fs.length}). Las de servicio no entran.</p></div>`;
}
function pintarCx(c, D){
  const box = $('#cxRes'); if(!box) return;
  const ctx = _cxCtx, X = ctx ? calcE(c, D, ctx) : null;
  $('#cxUne').innerHTML = uneHTML(c, D, ctx ? ctx.T || {} : null);
  enlazaUne(c, D, $('#cxUne'), (soloTexto) => { guardarMemoria(); if(soloTexto) debCx(c, D); else pintarCx(c, D); });
  const { z, lock } = entradaCx(c, D, ctx?.T);
  $('#cxLock').innerHTML = lock.size ? `<div class="cx-lock">${[['viga', 'Viga'], ['columna', 'Columna'], ['tSop', 'Soporte t'], ['Lp', 'Pedestal N'], ['Wp', 'Pedestal B'], ['fc', "f'c"], ['Bt', 'Tubo B'], ['tt', 'Tubo t'], ['H', 'Tubo H']].filter(([k]) => lock.has(k) && z[k] !== '' && z[k] != null).map(([k, t]) => `<span>${t} <b>${esc(z[k])}</b> 🔒</span>`).join('')}<span class="hint" style="background:none">del Anexo D (se cambian allá)</span></div>` : '';
  $('#cxCarg').innerHTML = cargasCxHTML(c, X);
  // secciones de datos (las de la app de conexiones) con los valores del Anexo D
  const ab = ConUI.abiertas();
  const inp = X?.ok ? X.inp : z;
  $('#form').innerHTML = `<div class="sec-tools"><button type="button" class="lnk" data-secall="1">Abrir todo</button> · <button type="button" class="lnk" data-secall="0">Cerrar todo</button></div>`
    + ConUI.seccionesDe(inp).map(([k, t, res, body], i) => `<section class="sec ${ab.includes(k) ? 'on' : ''}" data-sec="${k}"><button type="button" class="sec-hd" aria-expanded="${ab.includes(k)}"><i>${i + 1}</i><b>${t}</b><small data-res="${k}">${esc(res())}</small><span class="car" aria-hidden="true">▾</span></button><div class="sec-bd">${body}</div></section>`).join('');
  $$('#form [data-k]').forEach(el => { if(lock.has(el.dataset.k)){ el.disabled = true; el.dataset.lock = '1'; el.title = 'Viene del Anexo D'; } });
  const R = X?.ok ? X.R : null;
  $('#dib').innerHTML = R && !R.error ? ConUI.dibujo(inp, R) : '';
  box.innerHTML = !X ? '<p class="muted">Calculando…</p>' : !X.ok ? `<div class="note amber">${esc(X.error)}</div>` : (X.rojo || []).map(a => `<div class="note" style="margin-bottom:10px;border-left:4px solid #b91c1c;background:#fef2f2;color:#991b1b"><b>⚠ ${esc(a)}</b></div>`).join('') + compRigHTML(X.comp) + ConUI.resHTML(inp, R) + (X.ctrl && !X.ctrl._man ? `<p class="hint" style="margin-top:6px">Fila que controla: ${esc(X.ctrl._t || '')}</p>` : '');
  if($('#eTag')) $('#eTag').textContent = etiquetaE(c, D);
  const li = document.querySelector(`[data-sele="${c.id}"]`); if(li){ const p = li.querySelector('.pill'); if(p) p.outerHTML = pillRes(c.res); const l = li.querySelector('.e-lbl'); if(l) l.textContent = etiquetaE(c, D); }
  activarCx(c, D); pintarListo();
}
let _debCx = null; const debCx = (c, D) => { _debCx = _debCx || debounce((c2, D2) => pintarCx(c2, D2), 350); _debCx(c, D); };
const CX_RENDER = ['cizalla', 'd', 'rig', 'config', 'dosLados', 'rigCol', 'sismo', 'placaTipo', 'cortTodos', 'union', 'soporte', 'miembro', 'columna', 'uDebil', 'interior', 'desliz', 'resComp', 'ncw', 'diag', 'colTipo', 'cortante', 'refT', 'refV', 'mortero', 'unSop', 'destaje', 'viga', 'soldAla', 'ambos', 'filas', 'nL'];
function activarCx(c, D){
  const guardaAb = () => { try{ localStorage.conSecc = JSON.stringify($$('#form .sec.on').map(x => x.dataset.sec)); }catch(e){} };
  $$('#form .sec-hd').forEach(b => b.onclick = () => { const s = b.parentElement; s.classList.toggle('on'); b.setAttribute('aria-expanded', s.classList.contains('on')); guardaAb(); });
  $$('#form [data-secall]').forEach(b => b.onclick = () => { $$('#form .sec').forEach(s => s.classList.toggle('on', b.dataset.secall === '1')); guardaAb(); });
  $$('[data-cxcarg]').forEach(b => b.onclick = () => { c.cargas = b.dataset.cxcarg; guardarMemoria(); pintarCx(c, D); });
  if(!esIng()) return;
  $$('#form [data-k], #cxCarg [data-k]').forEach(el => { if(el.dataset.lock) return; const k = el.dataset.k;
    el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', () => {
      if(el.type === 'checkbox') c[k] = el.checked; else if(el.dataset.num) c[k] = el.value === '' ? '' : Number(el.value.replace(',', '.')); else c[k] = el.value;
      if(k === 'destaje' && c.dct == null) Object.assign(c, { dct:35, dcb:35, cDes:110, LevB:38 });
      if(k === 'unSop' && c.wS == null) Object.assign(c, { wS:6, electrodo:c.electrodo || 'E70XX' });
      if(k === 'rig' && c.rig && c.ts == null) Object.assign(c, { ts:12.7, W:+c.bh || 102, hs:+c.bv || 152, aceroRig:c.aceroAng || 'A36', wR:6, electrodo:c.electrodo || 'E70XX' });
      guardarMemoria();
      if(CX_RENDER.includes(k) || el.tagName === 'SELECT' || el.type === 'checkbox') pintarCx(c, D); else debCx(c, D);
    }); });
  $$('#cxRes [data-apsug]').forEach(b => b.onclick = () => { const X = calcE(c, D, _cxCtx); const sug = X?.R?.sug; if(!sug) return;
    if(sug.tipo === 'sold'){ const { tipo, ok, max, txt, ...v } = sug; Object.assign(c, v); }
    else { const { max, ok, peso, txt, ...v } = sug; Object.assign(c, v, c.tipo === 'asiento' ? { rig:true, aceroRig:c.aceroRig || c.aceroAng, electrodo:c.electrodo || 'E70XX' } : {}); }
    guardarMemoria(); pintarCx(c, D); toast('Sugerencia aplicada.'); });
  if($('#eBorrar')) $('#eBorrar').onclick = () => { if(!confirm(`¿Borrar ${c.nom}?`)) return; const E = datosE(); E.con = E.con.filter(x => x.id !== c.id); selE = null; guardarMemoria(); paneAnexoE(); };
}
async function abrirCx(c, D){
  pintarCx(c, D);
  if(esIng()) $$('.cxE [data-a]').forEach(inp => inp.addEventListener('input', () => { setP(c, inp.dataset.a, inp.value); guardarMemoria(); if(inp.dataset.a === 'nom'){ const b = document.querySelector(`[data-sele="${c.id}"] b`); if(b) b.textContent = c.nom; } if($('#eTag')) $('#eTag').textContent = etiquetaE(c, D); }));
  try{ _cxCtx = await ctxE(); }catch(e){ console.warn(e); _cxCtx = { R:null, G:null, T:null }; }
  if(selE === c.id && $('#cxRes')) pintarCx(c, D);
}

// ─── Impresión y memoria ───
function cxPrintSec(c, X, D, num){
  const R = X.R, inp = X.inp;
  const carg = c.cargas === 'manual' || c.tipo === 'grupo' ? `escritas por el diseñador: ${esc(ConUI.cargasTxt(inp))}` : `${X._filas.length} combinaciones de resistencia del modelo; controla ${esc(X.ctrl?._t || '')} → ${esc(ConUI.cargasTxt(inp))}`;
  return `<section class="ax-cont cxE"><h3>${num} ${esc(c.nom)} · ${esc(etiquetaE(c, D))} — ${esc(cxNombre(c.tipo))}${c.desc ? ' (' + esc(c.desc) + ')' : ''}</h3>
    <div class="ax-mapas"><figure style="grid-column:1/-1">${ConUI.dibujo(inp, R)}</figure></div>
    ${ConUI.datosPrint(inp).replace('<table class="t kv">', '<table class="ax-kv">').replace(/<tr><th>/g, '<tr><td>').replace(/<\/th><td>/g, '</td><td>').replace(/<tr><td>Cargas<\/td><td>[^<]*<\/td><\/tr>/, '')}
    <table class="ax-kv"><tr><td>Cargas</td><td>${carg}</td></tr></table>
    ${(X.rojo || []).map(a => `<p class="ax-nota"><b>${esc(a)}</b></p>`).join('')}${ConUI.rigHTML(R, true)}${compRigHTML(X.comp, true)}${ConUI.chequeosHTML(R)}${R.av.length ? `<p class="ax-nota"><b>Observaciones:</b> ${R.av.map(esc).join(' ')}</p>` : ''}
    <h4>Requisitos de geometría y detallado</h4>${ConUI.reqHTML(R)}
    <div class="ax-box">Relación máxima = ${fx(X.ratio, 3)} — ${X.cumple ? 'CUMPLE' : 'NO CUMPLE'}</div>
    <h4>Cálculo</h4><div class="calc">${R.pasos.map(esc).join('<br/>')}</div></section>`;
}
function descCx(c, D, X){
  const de = metDe(D, c.eDe), a = metDe(D, c.eA), n = cxNombre(c.tipo).toLowerCase();
  const nud = X?._filas ? [...new Set(X._filas.map(f => f._j).filter(Boolean))] : [];
  return `Esta conexión es una ${n}${de ? ` del elemento ${de.nom} (${nomSec(de)})` : ''}${a ? ` a ${a.nom} (${nomSec(a)})` : ''}${c.tipo === 'base' && pedDe(D, c.eA) ? ` sobre el pedestal ${pedDe(D, c.eA).nom}` : ''}${nud.length ? `, en los nudos ${nud.join(', ')} del modelo` : ''}. Se revisó con ${X?._filas?.length || 0} combinación(es) de resistencia; controla ${X?.ctrl?._t || 'la carga escrita'}.${rigTxt(X)}`;
}

// Texto de la rigidez para la memoria general (pedido de Amo: citar el método)
function rigTxt(X){
  const g = X?.R?.rigid; if(!g) return '';
  if(g.tipo === 'cortante') return g.clase === 'art' ? ' Es una conexión simple: se clasifica como articulada por sus requisitos de detallado (AISC 360-10 B3.6a; Manual AISC parte 10) y se modela con M3 liberado.' : '';
  const nom = { rigida:'rígida', semi:'semirrígida', art:'articulada' }[g.clase];
  const Sj = isFinite(g.Sj) ? `${Math.round(g.Sj).toLocaleString('es-CO')} kN·m/rad` : 'muy alta (se considera infinita)';
  return ` Su rigidez inicial a rotación es Sj,ini = ${Sj}, calculada con el método de los componentes de la norma europea EN 1993-1-8, numeral 6.3, porque el Reglamento NSR-10 (Título F.2, basado en AISC 360-10, sección B3.6) exige clasificar las conexiones por su rigidez pero no da fórmulas para calcularla.${g.K != null ? ` Con K = Sj·L/(E·I) = ${isFinite(g.K) ? fx(g.K, 1) : '∞'} la conexión se clasifica como ${nom} según el comentario de la sección B3.6 del AISC 360-10 (rígida si K ≥ 20, articulada si K ≤ 2).` : ''}${g.clase === 'semi' && isFinite(g.Sj) ? ` En el modelo estructural se representa con un resorte a rotación de Sj,ini/η = ${Math.round(g.Sj / g.eta).toLocaleString('es-CO')} kN·m/rad (EN 1993-1-8, numeral 5.1.2, η = ${g.eta}).` : ''}${g.debil ? debilTxt(g) : ''}${X.comp && X.comp.tono === 'ok' ? (g.tipo === 'base' ? ' Los apoyos del modelo estructural coinciden con esta clasificación.' : ' ' + X.comp.txt) : ''}`;
}
function debilTxt(g){
  const h = g.debil, nom = { rigida:'rígida', semi:'semirrígida', art:'articulada' }[h.clase];
  return ` Los valores anteriores corresponden al eje fuerte de la columna; en el eje débil Sj,ini = ${Math.round(h.Sj).toLocaleString('es-CO')} kN·m/rad${h.K != null ? `, K = ${fx(h.K, 1)} (con la inercia del eje débil) y la base se clasifica como ${nom}` : ''}${h.clase === 'semi' ? `, con un resorte de ${Math.round(h.Sj / g.eta).toLocaleString('es-CO')} kN·m/rad` : ''}.`;
}

// ─── Resortes para el modelo (pedido de Amo 20-nov, opción A: un valor por detalle, sin carga axial) ───
// Una fila por conexión (cada conexión del Anexo E = un detalle que puede cubrir varios nudos): qué poner en el modelo por eje y,
// en cada nudo o extremo, si el archivo del modelo ya lo tiene (✓) o falta (✗).
function resortesCardHTML(){
  if(!S.m.anexos?.C?.modelo || !datosE().con.some(c => esCx(c) && !CX_EMP.includes(c.tipo) && c.tipo !== 'grupo')) return '';
  return `<div class="card"><details id="eRes"><summary class="ct" style="cursor:pointer">🔧 Resortes para el modelo <span class="hint" style="text-transform:none;letter-spacing:0">qué poner en cada nudo y si el modelo ya lo tiene</span></summary>
    <div id="eResT"><p class="muted">Calculando…</p></div></details></div>`;
}
async function pintarResortes(){
  const box = $('#eResT'); if(!box) return;
  const E = datosE(), D = datosD(), ctx = await ctxE(), T = ctx.T, fmt = v => Math.round(v).toLocaleString('es-CO');
  if(!T){ box.innerHTML = '<p class="hint">No se pudo leer el archivo del modelo.</p>'; return; }
  const ap = T._apoyos || {}, sp = T._resortes || {}, filas = [];
  const chip = (txt, ok, t) => `<span title="${esc(t || '')}" style="display:inline-block;margin:2px 4px 2px 0;padding:1px 8px;border-radius:999px;font-size:12px;white-space:nowrap;${ok ? 'background:#ecfdf3;color:#166534;border:1px solid #bbf7d0' : 'background:#fef2f2;color:#991b1b;border:1px solid #fecaca'}">${esc(txt)} ${ok ? '✓' : '✗'}${ok ? '' : ` <small>(${esc(t || '')})</small>`}</span>`;
  for(const c of E.con.filter(c => esCx(c) && !CX_EMP.includes(c.tipo) && c.tipo !== 'grupo')){
    let X = null; try{ X = calcE(c, D, ctx); }catch(e){ console.warn(e); }
    let g = X?.R?.rigid; const nom = `<b>${esc(c.nom)}</b><br/><small>${esc(cxNombre(c.tipo))}</small>`;
    if(g && g.tipo === 'cortante' && !g.clase) g = { ...g, clase:'art', _req:true };
    if(!g || !g.clase){ filas.push([nom, '—', `<span class="hint">${X && !X.ok ? 'sin calcular: ' + esc(X.error || '') : 'sin clasificar (falta la longitud)'}</span>`, '']); continue; }
    if(g.tipo === 'base'){
      const p = pedDe(D, c.eA), nudos = p?.nudos || [], oy = c.ori !== 'x';
      for(const [ej, h, R] of [['fuerte', g, oy ? 'R1' : 'R2'], ['débil', g.debil, oy ? 'R2' : 'R1']]){
        if(!h || !h.clase) continue;
        const n = R === 'R1' ? '1' : '2', rs = h.Sj / 3;
        const que = h.clase === 'rigida' ? `Rotation ${n} restringida` : h.clase === 'art' ? `Rotation ${n} libre` : `Rotation ${n} libre + resorte <b>${fmt(rs)}</b> kN·m/rad`;
        const est = nudos.map(j => { const a = ap[j]; if(!a) return chip(j + (ejeNudo(T, j) ? ` · ${ejeNudo(T, j)}` : ''), false, 'el nudo no es apoyo en el modelo');
          const v = sp[j]?.[R] || 0, ok = h.clase === 'rigida' ? a[R] : h.clase === 'art' ? !a[R] : !a[R] && v > 0 && Math.abs(v - rs) <= 0.3 * rs;
          return chip(j + (ejeNudo(T, j) ? ` · ${ejeNudo(T, j)}` : ''), ok, a[R] ? 'restringida' : v ? `resorte ${fmt(v)}` : 'libre sin resorte'); }).join('');
        filas.push([nom, `Nudos (Joint Springs)<br/><small>eje ${ej} · K = ${fx(h.K, 1)}</small>`, que, est || '<span class="hint">sin nudos</span>']);
      }
      continue;
    }
    const off = new Set((c.nudosOff || []).map(String)), ext = extremosCx(c, D, T).filter(x => !off.has(String(x.j)));
    const rs = g.tipo === 'cortante' ? null : g.Sj / g.eta;
    const que = g.clase === 'rigida' ? 'Extremo empotrado (sin liberar)' : g.clase === 'art' ? `M3 liberado${g._req ? '<br/><small style="color:#b45309">no cumple todos los requisitos de detallado</small>' : ''}` : `Partial Fixity M3 = <b>${fmt(rs)}</b> kN·m/rad`;
    const est = ext.map(x => { const r = relExt(T, x), k = x.e === 'i' ? T[x.F]?.ki : T[x.F]?.kj;
      const ok = g.clase === 'rigida' ? r === 'emp' : g.clase === 'art' ? r === 'lib' : r === 'parc' && k > 0 && Math.abs(k - rs) <= 0.3 * rs;
      return chip(`${x.F}-${x.e} (n ${x.j}${ejeNudo(T, x.j) ? ` · ${ejeNudo(T, x.j)}` : ''})`, ok, (r === 'emp' ? 'empotrado' : r === 'lib' ? 'M3 liberado' : r === 'parc' ? `resorte ${fmt(k || 0)}` : '?') + (T[x.F]?.rDed ? ' (deducido de las fuerzas: el archivo no trae la tabla de liberaciones)' : '')); }).join('');
    if(ext.some(x => T[x.F]?.rDed)) T._ded = true;
    filas.push([nom, `Extremos de viga (Frame Releases)<br/><small>${g.K != null && isFinite(g.K) ? `K = ${fx(g.K, 1)}` : g.tipo === 'cortante' ? 'conexión simple' : ''}</small>`, que, est || '<span class="hint">sin extremos del modelo</span>']);
  }
  const mal = (box.innerHTML = '', filas.reduce((s, f) => s + (f[3].match(/✗/g) || []).length, 0));
  box.innerHTML = `<p class="hint" style="margin:6px 0">Valores sin carga axial (solo momento): dependen solo del detalle, así que todos los nudos de una misma conexión llevan el mismo valor; en el software seleccione esos nudos o elementos juntos y asígnelo una vez. Los chips dicen cómo está cada uno en el archivo cargado: ✓ correcto, ✗ falta (pase el cursor para ver qué tiene). En los extremos «F-i (n N)» = elemento F, extremo i, nudo N. Resorte = Sj,ini/η (EN 1993-1-8 §5.1.2); se acepta ±30 %.</p>
    ${T._ded ? '<p class="hint" style="margin:0 0 6px">El archivo no trae la tabla de liberaciones de los elementos: el estado de las vigas se dedujo de las fuerzas (no distingue resortes). Exporte con las liberaciones (Frame Item Assignments) para confirmarlo.</p>' : ''}
    ${mal ? `<div class="note amber" style="margin-bottom:8px">Faltan ${mal} nudo${mal > 1 ? 's' : ''} o extremo${mal > 1 ? 's' : ''} por ajustar en el modelo. Después de ajustarlos, vuelva a correr y cargue el archivo en el Anexo C.</div>` : '<div class="note" style="margin-bottom:8px">✓ El modelo tiene todos los resortes y liberaciones de acuerdo con las conexiones.</div>'}
    <div style="overflow-x:auto"><table class="ax-tb"><thead><tr><th>Conexión</th><th>Dónde</th><th>Qué poner</th><th>Estado en el modelo</th></tr></thead>
    <tbody>${filas.map(f => `<tr>${f.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

// Ubicación de un nudo por los ejes del modelo (pedido de Amo 22-nov): «Ejes 1 y B»
const ejeNudo = (T, j) => T?._G && T._J?.[j] ? AnexoC.ubicar(T._G, T._J[j]) : '';

// ─── Columna fuerte – viga débil (pedido de Amo 21-nov; solo pórticos DES, NSR-10 F.3 = AISC 341-10 E3.4a) ───
// En cada nudo y en cada sentido (X, Y): ΣM*pc / ΣM*pb > 1. M*pc = Zc·(Fyc − Puc/Ag) de cada columna que llega (Puc = mayor compresión del
// modelo en ese extremo); M*pb = Σ(1.1·Ry·Fyb·Zb + Muv), Muv = Vpr·(sh + dc/2), Vpr = 2·Mpr/Lh, rótula a sh = db/2 de la cara (sin cortante de gravedad).
// Eje de la columna según el ángulo de sus ejes locales (0° = peralte paralelo a X). Vigas con M3 liberado en ese extremo no cuentan.
// Excepción E3.4a(a)(i): último piso (sin columna arriba) con Puc < 0.3·Fy·Ag.
const esDES = () => String(S.m?.anexos?.K?.sisR || '').toLowerCase() === 'des' && S.m?.anexos?.B?.aplica !== false;
function scwb(D, ctx){
  const T = ctx?.T, G = ctx?.G; if(!T || !T._J) return null;
  const J = T._J, ang = T._ang || {}, PL = window.PERFILES_LAM || [];
  const elDe = g => D.met.find(e => e.grupo === g && e.tipo === 'I' && e.perfil);
  const prop = el => { const P = PL.find(x => x[0] === el.perfil); if(!P) return null; const ac = AnexoD.ACEROS[el.acero] || AnexoD.ACEROS['A572 Gr 50'];
    return { nom:P[0], d:P[2], A:P[7], Zx:P[10], Zy:P[13], Fy:ac[0], Ry:/A36/.test(el.acero || '') ? 1.5 : 1.1 }; };
  const porNudo = {}; for(const F in T){ const f = T[F]; for(const [e, j] of [['i', f.i], ['j', f.j]]) (porNudo[j] = porNudo[j] || []).push({ F, e, f }); }
  // Composición de cada combinación del modelo (pedido de Amo 22-nov: cortante de gravedad y Ω0): factor de D, de la viva de entrepiso y si lleva sismo
  const Cm = S.m.anexos?.C?.modelo, cats = Object.fromEntries((Cm?.patrones || []).map(p => [p.n, p.cat])), cbs = Object.fromEntries((Cm?.combos || []).map(c => [c.n, c]));
  const Lf = S.m.anexos?.K?.pat?.L || '';      // viva de entrepiso (la de cubierta Lr no entra en las combinaciones con sismo)
  const info = (n, f = 1, prof = 0, o = { D:0, Lf:0, E:false, otro:false }) => { const c = cbs[n];
    if(!c || prof > 6){ const k = cats[n] || AnexoC.categoria(n, ''); if(k === 'D') o.D += f; else if(k === 'E') o.E = true; else if(Lf && n === Lf) o.Lf += f; else o.otro = true; return o; }
    const env = /envelope/i.test(c.tipo || '');
    for(const [cs, fc] of Object.entries(c.casos || {})){ if(env){ const q = info(cs, 1, prof + 1); if(q.E) o.E = true; if(q.otro || q.D || q.Lf) o.otro = true; } else info(cs, f * fc, prof + 1, o); }
    return o; };
  const INF = {}, inf = n => INF[n] ??= info(n);
  const O0 = 3.0;                               // Ω0 de los pórticos de acero resistentes a momento (NSR-10 Tabla A.3-3)
  // fuerzas de gravedad sin mayorar (D y viva de entrepiso) en un extremo, a partir de las combinaciones de solo D y de D + L
  const grav = (fs, k) => { const pD = fs.find(r => { const i = inf(r.c); return i.D > 0 && !i.Lf && !i.E && !i.otro; });
    if(!pD) return null; const D = pD[k] / inf(pD.c).D;
    const pL = Lf ? fs.find(r => { const i = inf(r.c); return i.Lf > 0 && !i.E && !i.otro; }) : null;
    const L = pL ? (pL[k] - inf(pL.c).D * D) / inf(pL.c).Lf : 0;
    return { D, L, comb:pD.c }; };
  const out = [];
  for(const j of Object.keys(porNudo).sort((a, b) => (+a || 0) - (+b || 0))){
    const lst = porNudo[j], pj = J[j]; if(!pj) continue;
    const cols = lst.filter(x => /\|Columna$/.test(x.f.g)), vigas = lst.filter(x => /\|Viga$/.test(x.f.g) && relExt(T, { F:x.F, e:x.e }) !== 'lib');
    if(!cols.length || !vigas.length) continue;
    for(const dir of ['X', 'Y']){
      const vs = vigas.filter(v => { const q = J[v.e === 'i' ? v.f.j : v.f.i]; if(!q) return false; const dx = Math.abs(q[0] - pj[0]), dy = Math.abs(q[1] - pj[1]); return dir === 'X' ? dx >= dy : dy > dx; });
      if(!vs.length) continue;
      let Mpc = 0, Mpb = 0, arriba = false, PucMax = 0, Pc = Infinity, dc = 0, sinO = false, sinVg = false; const tC = [], tB = [], falta = [];
      for(const c of cols){ const el = elDe(c.f.g), s = el && prop(el); if(!s){ falta.push(`columna ${c.f.g.split('|')[0]} sin perfil I en el Anexo D`); continue; }
        const q = J[c.e === 'i' ? c.f.j : c.f.i]; if(q && q[2] > pj[2] + 1e-6) arriba = true;
        const a = (ang[c.F] || 0) * Math.PI / 180, pX = Math.abs(Math.cos(a)) >= Math.abs(Math.sin(a)), fuerte = (dir === 'X') === pX, Z = fuerte ? s.Zx : s.Zy;
        const fs = (G?.[c.f.g]?.filas || []).filter(r => String(r.F) === String(c.F));
        const st = fs.length ? (c.e === 'i' ? Math.min(...fs.map(r => r.st)) : Math.max(...fs.map(r => r.st))) : null;
        const fe = fs.filter(r => Math.abs(r.st - st) < 1e-6), g = grav(fe, 'P'), sis = fe.filter(r => inf(r.c).E);
        // Puc con la carga sísmica amplificada: 1.2D + 0.5L + Ω0·E, con E = (fila con sismo) − (su parte de gravedad)
        let Puc, conO = false;
        if(g && sis.length){ conO = true; Puc = Math.max(0, ...sis.map(r => { const i = inf(r.c), PE = r.P - i.D * g.D - i.Lf * g.L; return -(1.2 * g.D + 0.5 * g.L + O0 * PE); })); }
        else { Puc = Math.max(0, ...fe.map(r => -r.P)); sinO = true; }
        PucMax = Math.max(PucMax, Puc); Pc = Math.min(Pc, s.Fy * s.A / 1000); dc = Math.max(dc, s.d);
        Mpc += Math.max(0, Z * (s.Fy - Puc * 1000 / s.A) / 1e6);
        tC.push(`${s.nom} ${q && q[2] > pj[2] ? 'arriba' : 'abajo'} (eje ${fuerte ? 'fuerte' : 'débil'}, Puc ${fx(Puc, 0)} kN${conO ? ' con Ω0' : ''})`); }
      for(const v of vs){ const el = elDe(v.f.g), s = el && prop(el); if(!s){ falta.push(`viga ${v.f.g.split('|')[0]} sin perfil I en el Anexo D`); continue; }
        const Mpr = 1.1 * s.Ry * s.Fy * s.Zx / 1e6, sh = s.d / 2000, Lh = Math.max(0.5, (v.f.L || 0) - dc / 1000 - 2 * sh), Vpr = 2 * Mpr / Lh;
        // cortante de gravedad en el extremo de la viga (1.2D + 0.5L, la viva de cubierta no entra con sismo)
        const fv = (G?.[v.f.g]?.filas || []).filter(r => String(r.F) === String(v.F)), stv = fv.length ? (v.e === 'i' ? Math.min(...fv.map(r => r.st)) : Math.max(...fv.map(r => r.st))) : null;
        const gv = grav(fv.filter(r => Math.abs(r.st - stv) < 1e-6), 'V2'), Vg = gv ? Math.abs(1.2 * gv.D + 0.5 * gv.L) : 0; if(!gv) sinVg = true;
        Mpb += Mpr + (Vpr + Vg) * (sh + dc / 2000); tB.push(`${s.nom} (L ${fx(v.f.L, 2)} m${gv ? `, Vg ${fx(Vg, 1)} kN` : ''})`); }
      const ratio = Mpb > 0 ? Mpc / Mpb : Infinity, exc = !arriba && PucMax < 0.3 * Pc;
      if(sinO) falta.length || tC.push('sin Ω0: el archivo no trae una combinación de solo carga muerta o las de sismo');
      if(sinVg) tB.push('sin cortante de gravedad: el archivo no trae una combinación de solo carga muerta');
      out.push({ j, eje:ejeNudo(T, j), dir, cols:tC, vigas:tB, Mpc, Mpb, ratio, ok:ratio > 1, exc, falta });
    }
  }
  return out;
}
const scwbEstado = f => f.falta.length ? 'Sin datos' : f.ok ? 'Cumple' : f.exc ? 'Exceptuado' : 'No cumple';
const SCWB_NOTA = 'ΣM*pc = Σ Zc·(Fyc − Puc/Ag) de las columnas que llegan al nudo, con Puc = compresión con la carga sísmica amplificada: 1.2D + 0.5L + Ω0·E (Ω0 = 3.0, Tabla A.3-3; E se obtiene de cada combinación con sismo del modelo restándole su parte de gravedad). ΣM*pb = Σ (1.1·Ry·Fyb·Zb + Muv), con la rótula a db/2 de la cara de la columna y Muv = (Vpr + Vg)·(sh + dc/2), Vpr = 2·Mpr/Lh y Vg = cortante de gravedad de la viga en ese extremo (1.2D + 0.5L; la viva de cubierta no entra con sismo). Exceptuado = último piso con Puc < 0.3·Fy·Ag (AISC 341 E3.4a, excepción (a)).';
function scwbTablaHTML(fs, imp){
  const pillE = f => { const e = scwbEstado(f); return imp ? e : `<span class="pill ${e === 'Cumple' ? 'ok' : e === 'No cumple' ? 'no' : 'gray'}">${e}</span>`; };
  return `<div style="overflow-x:auto"><table class="ax-tb"><thead><tr><th>Nudo</th><th>Sentido</th><th>Columnas</th><th>Vigas</th><th>ΣM*pc [kN·m]</th><th>ΣM*pb [kN·m]</th><th>ΣM*pc / ΣM*pb</th><th>Resultado</th></tr></thead>
    <tbody>${fs.map(f => `<tr><td>${esc(f.j)}${f.eje ? `<br/><small>${esc(f.eje)}</small>` : ''}</td><td>${f.dir}</td><td style="text-align:left">${f.cols.map(esc).join('<br/>')}</td><td style="text-align:left">${f.vigas.map(esc).join('<br/>')}${f.falta.length ? `<br/><small>${esc(f.falta.join('; '))}</small>` : ''}</td><td>${fx(f.Mpc, 1)}</td><td>${fx(f.Mpb, 1)}</td><td><b>${isFinite(f.ratio) ? fx(f.ratio, 2) : '—'}</b></td><td>${pillE(f)}</td></tr>`).join('')}</tbody></table></div>`;
}
function scwbCardHTML(){
  if(!esDES() || !S.m.anexos?.C?.modelo) return '';
  return `<div class="card"><details id="eScwb"><summary class="ct" style="cursor:pointer">🏛 Columna fuerte – viga débil <span class="hint" style="text-transform:none;letter-spacing:0">pórtico DES · NSR-10 F.3 (AISC 341 E3.4a)</span></summary><div id="eScwbT"><p class="muted">Calculando…</p></div></details></div>`;
}
async function pintarScwb(){
  const box = $('#eScwbT'); if(!box) return;
  const fs = scwb(datosD(), await ctxE());
  if(!fs){ box.innerHTML = '<p class="hint">No se pudo leer el archivo del modelo.</p>'; return; }
  if(!fs.length){ box.innerHTML = '<p class="hint">No se encontraron nudos donde lleguen columnas y vigas a momento (revise los grupos del Anexo D y las liberaciones del modelo).</p>'; return; }
  const mal = fs.filter(f => scwbEstado(f) === 'No cumple').length;
  box.innerHTML = `${mal ? `<div class="note amber" style="margin:8px 0">${mal} nudo${mal > 1 ? 's' : ''} no cumple${mal > 1 ? 'n' : ''}: las rótulas se formarían en las columnas. Aumente la columna o use una viga más liviana (o con sección reducida).</div>` : `<div class="note" style="margin:8px 0">✓ ${fs.some(f => scwbEstado(f) === 'Exceptuado') ? 'Todos los nudos cumplen o están exceptuados (último piso con poca carga axial: ahí la norma permite que la columna sea más débil).' : 'En todos los nudos las columnas son más fuertes que las vigas.'}</div>`}
    ${scwbTablaHTML(fs)}<p class="hint" style="margin-top:6px">${SCWB_NOTA}</p>`;
}
