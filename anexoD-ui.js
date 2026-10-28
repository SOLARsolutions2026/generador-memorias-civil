/* ═══ Pantalla del Anexo D — Diseño de elementos (usa calc/anexoD.js y las fuerzas del Anexo C) ═══ */
'use strict';
let tabD = 'met', selMet = null, _filas = null;   // _filas: { clave, G } filas del modelo por grupo (en memoria)

function datosD(){
  const m = S.m; m.anexos = m.anexos || {};
  const D = m.anexos.D = m.anexos.D || {};
  for(const k of ['met','zap','ped']) if(!Array.isArray(D[k])) D[k] = [];
  return D;
}
const nuevoMet = (n, extra={}) => ({ id:Date.now().toString(36) + Math.random().toString(36).slice(2, 5), nom:`PF-${n}`, desc:'', tipo:'I', perfil:'IPE 200', H:'', B:'', t:'', d:'',
  acero:'A572 Gr 50', Lx:'', Ly:'', Lb:'', Lz:'', Kx:1, Ky:1, Kz:1, Cb:1, tension:{ U:1, nAg:'', dperno:'', tAg:'', roscada:false }, pernos:{ n:'', d:'1/2"', tipo:'A325', tpl:'', rosca:true },
  fuerzas:'grupo', grupo:'', manual:{ P:'', V2:'', V3:'', T:'', M2:'', M3:'' }, res:null, ...extra });

// Filas del modelo por grupo (descarga el .s2k una vez por sesión)
async function filasModelo(){
  const C = S.m.anexos?.C, Fz = C?.modelo?.fuerzas; if(!Fz?.n || !C.archivo) return null;
  const clave = C.archivo.fecha + '|' + Fz.res.join(',');
  if(_filas?.clave === clave) return _filas.G;
  const G = AnexoC.filasGrupos(await textoModelo(C), Fz.res); _filas = { clave, G }; return G;
}
function filasDe(el, G){
  if(el.fuerzas === 'manual') return [{ ...el.manual, F:'—', c:'escritas a mano', st:0 }];
  if(G?.[el.grupo]) return G[el.grupo].filas;
  const g = S.m.anexos?.C?.modelo?.fuerzas?.grupos?.find(x => x.sec + '|' + x.fun === el.grupo);   // sin descarga: filas críticas guardadas
  return g ? [...Object.values(g.crit), ...Object.values(g.env).flatMap(e => [e.max, e.min])].filter(Boolean) : [];
}
// Calcula y guarda el resumen en el elemento (para la lista, la barra de «terminado» y la impresión)
function calcMet(el, G){
  const filas = filasDe(el, G);
  if(!filas.length){ el.res = { ok:false, error: el.fuerzas === 'manual' ? 'Escribe las fuerzas.' : 'Escoge el grupo de elementos del modelo.' }; return null; }
  const R = AnexoD.revisar(el, filas);
  el.res = R.ok ? { ok:true, ratio:+R.ratio.toFixed(3), cumple:R.cumple, n:R.filas, fecha:new Date().toISOString(),
    checks:Object.fromEntries(Object.entries(R.checks).map(([k, v]) => [k, { r:+v.r.toFixed(4), f:v.f }])), avisos:R.avisos } : { ok:false, error:R.error };
  return R;
}

function paneAnexoD(){
  const D = datosD(), C = S.m.anexos?.C, Fz = C?.modelo?.fuerzas;
  const tabs = { met:`Elementos metálicos (${D.met.length})`, zap:`Concreto: zapatas (${D.zap.length})`, ped:`Concreto: pedestales (${D.ped.length})` };
  let h = `<div class="tabs" role="tablist">${Object.entries(tabs).map(([k, v]) => `<button type="button" role="tab" data-tabd="${k}" class="${tabD === k ? 'on' : ''}">${v}</button>`).join('')}</div>`;
  if(tabD !== 'met') return paneConcreto(tabD, h);
  const sel = D.met.find(e => e.id === selMet) || D.met[0]; selMet = sel?.id || null;
  h += `<div class="d-grid"><div class="d-lista">
      ${D.met.map(e => `<button type="button" class="d-el ${e.id === selMet ? 'on' : ''}" data-sel="${e.id}"><span><b>${esc(e.nom)}</b> ${esc(nomSec(e))}${e.desc ? ' · ' + esc(e.desc) : ''}
        <small>${e.fuerzas === 'manual' ? 'fuerzas escritas a mano' : esc(e.grupo ? e.grupo.replace('|', ' · ') : 'sin grupo')}</small></span>${pillRes(e.res)}</button>`).join('')}
      ${!D.met.length ? '<p class="hint">Aún no hay elementos.</p>' : ''}
      ${esIng() ? `${Fz?.grupos?.length ? '<button class="btn sm pri" type="button" id="dDesdeC" style="width:100%;margin-top:6px">⚡ Crear elementos desde el Anexo C</button>' : '<div class="note amber" style="margin-top:6px">Para traer las fuerzas, sube el modelo con resultados en el Anexo C (pestaña Resultados).</div>'}
        <button class="btn sm" type="button" id="dNuevo" style="width:100%;margin-top:6px">＋ Agregar elemento</button>` : ''}
    </div><div id="dDet">${sel ? detMetHTML(sel) : '<div class="card"><p class="muted">Crea o escoge un elemento.</p></div>'}</div></div>
    <div class="card"><div class="ct">Páginas del Anexo D</div><button class="btn grn" type="button" id="printD">🖨 Imprimir / Guardar PDF del Anexo D</button></div>`;
  pane(h);
  activarTabsD();
  $$('[data-sel]').forEach(b => b.onclick = () => { selMet = b.dataset.sel; paneAnexoD(); });
  if($('#printD')) $('#printD').onclick = () => imprimirD();
  if(!esIng()){ if(sel) pintarResMet(sel); return; }
  if($('#dNuevo')) $('#dNuevo').onclick = () => { const e = nuevoMet(D.met.length + 1); D.met.push(e); selMet = e.id; guardarMemoria(); paneAnexoD(); };
  if($('#dDesdeC')) $('#dDesdeC').onclick = async () => {
    const usados = new Set(D.met.map(e => e.grupo)), omit = [];
    let G = null; try{ toast('Leyendo el modelo…', 15000); G = await filasModelo(); }catch(e){ console.warn(e); }
    for(const g of Fz.grupos){
      const key = g.sec + '|' + g.fun; if(usados.has(key)) continue;
      const t = AnexoD.desdeNombre(g.sec); if(!t){ omit.push(g.sec); continue; }
      const L = G?.[key]?.Lmax ? +G[key].Lmax.toFixed(3) : '';
      const e = nuevoMet(D.met.length + 1, { ...t, desc:g.fun, grupo:key, Lx:L, acero: t.tipo === 'HSS' ? 'A500 Gr C' : t.tipo === 'BAR' ? 'A36' : 'A572 Gr 50' });
      calcMet(e, G); D.met.push(e);
    }
    selMet = D.met[0]?.id; guardarMemoria(); paneAnexoD();
    toast(omit.length ? `Elementos creados. Sin diseñar (no se reconoce la sección): ${[...new Set(omit)].join(', ')}.` : 'Elementos creados desde el Anexo C.', 6000);
  };
  if(sel) activarMet(sel);
}
function activarTabsD(){ $$('[data-tabd]').forEach(b => b.onclick = () => { tabD = b.dataset.tabd; paneAnexoD(); }); }
const nomSec = e => e.tipo === 'HSS' ? `Tubo ${e.H || '?'}×${e.B || '?'}×${e.t || '?'}` : e.tipo === 'BAR' ? `Barra Ø${e.d || '?'} mm` : (e.perfil || '?');
const pillRes = r => !r ? '<span class="pill gray">—</span>' : !r.ok ? '<span class="pill pend">!</span>' : `<span class="pill ${r.cumple ? (r.ratio > 0.9 ? 'pend' : 'ok') : 'no'}">${fx(r.ratio,2)}</span>`;

function detMetHTML(e){
  const ro_ = esIng() ? '' : 'disabled', Fz = S.m.anexos?.C?.modelo?.fuerzas;
  const fams = [...new Set((window.PERFILES_LAM || []).map(p => p[1]))];
  const opt = (v, t, cur) => `<option value="${esc(v)}" ${String(cur) === String(v) ? 'selected' : ''}>${esc(t)}</option>`;
  const perfilSel = `<div class="f"><label>Perfil</label><select data-a="perfil" ${ro_}>${fams.map(f => `<optgroup label="${f}">${PERFILES_LAM.filter(p => p[1] === f).map(p => opt(p[0], p[0], e.perfil)).join('')}</optgroup>`).join('')}</select></div>`;
  const tipoSeg = `<div class="seg" role="group">${[['I','Perfil I'],['HSS','Tubo rectangular'],['BAR','Barra']].map(([k, t]) => `<button type="button" data-tipo="${k}" class="${e.tipo === k ? 'on' : ''}" ${ro_}>${t}</button>`).join('')}</div>`;
  return `<div class="card"><div class="ct">${esc(e.nom)} · ${esc(nomSec(e))}${esIng() ? '<button class="btn sm danger" type="button" id="dBorrar">Borrar</button>' : ''}</div>
    <div class="fg g4">${fIn(e,'nom','Nombre',{num:false})}${fIn(e,'desc','Descripción',{num:false,ph:'Columna, viga, correa…',cls:'span2'})}
      <div class="f"><label>Acero</label><select data-a="acero" ${ro_}>${Object.keys(AnexoD.ACEROS).map(a => opt(a, `${a} (Fy ${AnexoD.ACEROS[a][0]})`, e.acero)).join('')}</select></div></div>
    <div class="f" style="margin:8px 0"><label>Tipo de sección</label>${tipoSeg}</div>
    <div class="fg g4">${e.tipo === 'I' ? perfilSel : e.tipo === 'HSS' ? fIn(e,'H','Alto H [mm]') + fIn(e,'B','Ancho B [mm]') + fIn(e,'t','Espesor t [mm]',{h:'Se usa 0.93·t (F.2.2.4.2)'}) : fIn(e,'d','Diámetro [mm]',{h:'1/2" = 12.7 · 5/8" = 15.9'}) + fChk(e,'tension.roscada','Barra roscada (rotura en la rosca)')}</div>
    <h4 class="sub">Longitudes y coeficientes</h4>
    <div class="fg g4">${fIn(e,'Lx','Lx [m] (pandeo eje fuerte)')}${e.tipo !== 'BAR' ? fIn(e,'Ly','Ly [m] (eje débil)',{ph:'= Lx'}) + fIn(e,'Lb','Lb [m] (arriostramiento lateral)',{ph:'= Lx'}) + fIn(e,'Lz','Lz [m] (torsión)',{ph:'= Lx'}) : ''}</div>
    ${e.tipo !== 'BAR' ? `<div class="fg g4">${fIn(e,'Kx','Kx')}${fIn(e,'Ky','Ky')}${fIn(e,'Kz','Kz')}${e.tipo === 'I' ? fIn(e,'Cb','Cb',{h:'1.0 = conservador'}) : ''}</div>` : ''}
    <details class="d-opc"><summary>Tensión: área neta y pernos (opcional)</summary>
      <div class="fg g4">${e.tipo !== 'BAR' ? fIn(e,'tension.U','Factor U (Tabla F.2.4.3-1)') + fIn(e,'tension.nAg','Agujeros en la sección crítica') + fIn(e,'tension.dperno','Ø perno de los agujeros',{num:false,ph:'1/2"'}) + fIn(e,'tension.tAg','Espesor donde están [mm]',{ph:e.tipo === 'I' ? 'tf' : 't'}) : ''}</div>
      ${e.tipo !== 'BAR' ? `<div class="fg g4">${fIn(e,'pernos.n','Número de pernos')}<div class="f"><label>Ø perno</label><select data-a="pernos.d" ${ro_}>${Object.keys(AnexoD.PULG).map(k => opt(k, k, e.pernos.d)).join('')}</select></div>
        <div class="f"><label>Tipo de perno</label><select data-a="pernos.tipo" ${ro_}>${Object.keys(AnexoD.PERNOS).map(k => opt(k, k, e.pernos.tipo)).join('')}</select></div>${fIn(e,'pernos.tpl','Espesor menor conectado [mm]')}</div>` : ''}</details>
    <h4 class="sub">Fuerzas</h4>
    <div class="seg" role="group" style="margin-bottom:8px"><button type="button" data-fz="grupo" class="${e.fuerzas !== 'manual' ? 'on' : ''}" ${ro_}>Del modelo (Anexo C)</button><button type="button" data-fz="manual" class="${e.fuerzas === 'manual' ? 'on' : ''}" ${ro_}>Escribir a mano</button></div>
    ${e.fuerzas === 'manual' ? `<div class="fg g4">${['P','V2','V3','T','M2','M3'].map(k => fIn(e,'manual.' + k, `${k} [${k[0] === 'M' || k === 'T' ? 'kN·m' : 'kN'}]`, {ph: k === 'P' ? '− compresión' : ''})).join('')}</div>`
      : Fz?.grupos?.length ? `<div class="f"><label>Grupo de elementos del modelo</label><select data-a="grupo" ${ro_}>${opt('', '— escoge —', e.grupo)}${Fz.grupos.map(g => opt(g.sec + '|' + g.fun, `${g.sec} · ${g.fun} (${g.n} elem.)`, e.grupo)).join('')}</select>
          <div class="hint">Se revisan todas las filas del grupo en las combinaciones de resistencia del Anexo C y se toma la que controla en cada chequeo.</div></div>`
      : '<div class="note amber">No hay fuerzas del modelo: súbelo con resultados en el Anexo C o escríbelas a mano.</div>'}
    <div id="dRes" style="margin-top:12px"><p class="muted">Calculando…</p></div></div>`;
}

const CHK = {   // nombre, referencia, unidad de la demanda, capacidad desde R
  ten:['Tensión', 'F.2.4', 'kN', R => R.ten.phiPn/1e3, f => Math.max(0, f.P)],
  comp:['Compresión', 'F.2.5', 'kN', R => R.comp.phiPn/1e3, f => -Math.min(0, f.P)],
  fx:['Flexión eje mayor', 'F.2.6', 'kN·m', R => R.fx.phiMn/1e6, f => Math.abs(f.M3)],
  fy:['Flexión eje menor', 'F.2.6.6', 'kN·m', R => R.fy.phiMn/1e6, f => Math.abs(f.M2)],
  vx:['Cortante eje mayor (V2)', 'F.2.7', 'kN', R => R.vx.phiVn/1e3, f => Math.abs(f.V2)],
  vy:['Cortante eje menor (V3)', 'F.2.7', 'kN', R => R.vy.phiVn/1e3, f => Math.abs(f.V3)],
  tor:['Torsión', 'F.2.8.3', 'kN·m', R => R.tor.phiTn/1e6, f => Math.abs(f.T)],
  int:['Interacción', 'F.2.8.1', '', null, null],
};
const filaTxt = f => !f ? '' : f.F === '—' ? 'fuerzas escritas a mano' : `E${esc(f.F)} · ${esc(f.c)}${f.step ? ' (' + esc(f.step) + ')' : ''} · x = ${fx(f.st,2)} m`;

async function pintarResMet(e){
  const box = $('#dRes'); if(!box) return;
  let G = null; try{ G = await filasModelo(); }catch(err){ console.warn(err); }
  const R = calcMet(e, G);
  const b = $('#dRes'); if(!b || selMet !== e.id) return;
  if(!R || !R.ok){ b.innerHTML = `<div class="note amber">${esc(e.res?.error || 'Faltan datos.')}</div>`; return; }
  const filas = Object.entries(CHK).filter(([k]) => R.checks[k]).map(([k, [n, ref, u, cap, dem]]) => {
    const c = R.checks[k], f = c.f, col = c.r > 1 ? '#dc2626' : c.r > 0.9 ? '#d97706' : '#10b981';
    return [`<b>${n}</b> <span class="hint">${k === 'int' ? (f.ec || ref) : ref}</span>`, k === 'int' ? `P/φPn = ${fx(f.pr,3)} · ΣM/φMn = ${fx(f.mm,3)}` : `${fx(dem(f),2)} ${u}`, k === 'int' ? '1.00' : `${fx(cap(R),2)} ${u}`,
      `<span class="bar-d"><i style="width:${Math.min(100, c.r*100)}%;background:${col}"></i></span> <b>${fx(c.r,3)}</b>`, pill(c.r <= 1 ? 'ok' : 'no', c.r <= 1 ? 'Cumple' : 'No cumple'), `<span class="ids">${filaTxt(f)}</span>`]; });
  b.innerHTML = `${tabla(['Chequeo','Demanda','Capacidad (φRn)','Relación','','Fila que controla'], filas)}
    <div class="wtot" style="background:${R.cumple ? '' : '#b91c1c'}"><span>Relación demanda / capacidad máxima (${R.filas} filas revisadas)</span><span>${fx(R.ratio,3)} — ${R.cumple ? 'CUMPLE' : 'NO CUMPLE'}</span></div>
    ${R.avisos.map(a => `<div class="note amber" style="margin-top:8px">${esc(a)}</div>`).join('')}
    <details class="d-opc" style="margin-top:10px"><summary>Ver cálculo detallado</summary>${detalleMetHTML(R)}</details>`;
  const lista = document.querySelector(`[data-sel="${e.id}"] .pill`); if(lista) lista.outerHTML = pillRes(e.res);
  pintarListo();
}
// Valores intermedios (pantalla e impresión)
function detalleMetHTML(R, imp){
  const s = R.s, k = (a, b) => [a, b], m6 = v => fx(v/1e6, 2), k3 = v => fx(v/1e3, 2), ex = v => Number(v).toExponential(3).replace('e+', 'e');
  const T = imp ? (cab, filas) => `<table class="ax-kv">${filas.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>` : (cab, filas) => tabla(cab, filas);
  const g = [];
  g.push(['Sección y material', [k('Sección', esc(s.n)), k('A [mm²]', fx(s.A,1)), k('Ix · Iy [mm⁴]', `${ex(s.Ix)} · ${ex(s.Iy)}`), k('rx · ry [mm]', `${fx(s.rx,1)} · ${fx(s.ry,1)}`),
    ...(s.tipo !== 'BAR' ? [k('Sx · Zx [mm³]', `${ex(s.Sx)} · ${ex(s.Zx)}`), k('Sy · Zy [mm³]', `${ex(s.Sy)} · ${ex(s.Zy)}`), k('J [mm⁴]', ex(s.J))] : []),
    ...(s.tipo === 'I' ? [k('Cw [mm⁶]', ex(s.Cw))] : []), ...(s.tipo === 'HSS' ? [k('t diseño = 0.93·t [mm]', fx(s.t,2))] : []),
    k('Fy · Fu · E [MPa]', `${R.Fy} · ${R.Fu} · ${R.E}`)]]);
  g.push(['Tensión (F.2.4)', [k('An [mm²] · U · Ae [mm²]', `${fx(R.ten.An,1)} · ${fx(R.ten.U,2)} · ${fx(R.ten.Ae,1)}`), k('φPn fluencia = 0.9·Fy·Ag', k3(R.ten.tenY) + ' kN'), k('φPn rotura = 0.75·Fu·Ae', k3(R.ten.tenR) + ' kN'),
    ...(R.ten.pern ? [k('Perno: corte 0.75·Fnv·Ab · aplastamiento 0.75·2.4·d·t·Fu', `${k3(R.ten.pern.corte)} · ${k3(R.ten.pern.apl)} kN × ${R.ten.pern.n}`)] : []), k('Controla', R.ten.gob),
    ...(s.tipo !== 'BAR' ? [k('L / r mín (≤ 300 recomendado)', fx(R.ten.esb,0))] : [])]]);
  if(s.tipo !== 'BAR'){
    const cl = R.cl;
    g.push(['Clasificación (Tabla F.2.2.4-1)', s.tipo === 'I'
      ? [k('Aleta b/2tf', `${fx(cl.lf,2)} (λp ${fx(cl.lpf,2)}, λr ${fx(cl.lrf,2)}) → ${cl.aleta}`), k('Alma h/tw', `${fx(cl.lw,2)} (λp ${fx(cl.lpw,2)}, λr ${fx(cl.lrw,2)}) → ${cl.alma}`)]
      : [k('Pared B: b/t', `${fx(cl.bt,2)} → eje mayor: ${cl.aletaX}`), k('Pared H: h/t', `${fx(cl.ht,2)} → eje mayor (alma): ${cl.almaX} · eje menor (aleta): ${cl.aletaY}`)]]);
    g.push(['Compresión (F.2.5)', [k('KxLx/rx · KyLy/ry', `${fx(R.comp.KLx,1)} · ${fx(R.comp.KLy,1)}`), k('Fe por flexión [MPa]', fx(R.comp.Fef,1)), ...(R.comp.Fet ? [k('Fe torsional [MPa]', fx(R.comp.Fet,1))] : []),
      k('Q', fx(R.comp.Q,3)), k('Fcr [MPa] (' + R.comp.flex.ec + ')', fx(R.comp.flex.Fcr,1)), k('φPn = 0.9·Fcr·Ag', k3(R.comp.phiPn) + ' kN — ' + R.comp.gob)]]);
    g.push(['Flexión eje mayor (F.2.6)', [k('Mp = Fy·Zx', m6(R.fx.Mp) + ' kN·m'), ...(s.tipo === 'I' ? [k('Lp · Lr · rts [mm]', `${fx(R.fx.Lp,0)} · ${fx(R.fx.Lr,0)} · ${fx(R.fx.rts,2)}`), k('Lb [mm] · Cb', `${fx(R.Lb,0)} · ${R.Cb}`), k('Caso', R.fx.casoL),
      k('Mn pandeo lateral · pandeo local de aleta', `${m6(R.fx.ltb)} · ${m6(R.fx.flb)} kN·m`)] : [k('Mn aleta · alma', `${m6(R.fx.flb)} · ${m6(R.fx.wlb)} kN·m`)]),
      k('φMn = 0.9·Mn', m6(R.fx.phiMn) + ' kN·m — ' + R.fx.gob)]]);
    g.push(['Flexión eje menor (F.2.6.6)', [k('Mp = mín(Fy·Zy ; 1.6·Fy·Sy)', m6(R.fy.Mp) + ' kN·m'), k('φMn', m6(R.fy.phiMn) + ' kN·m — ' + R.fy.gob)]]);
    g.push(['Cortante (F.2.7)', [k('Eje mayor: Aw [mm²] · Cv · φv', `${fx(R.vx.Aw,0)} · ${fx(R.vx.Cv,3)} · ${R.vx.phi} (${R.vx.caso})`), k('φVn eje mayor = φv·0.6·Fy·Aw·Cv', k3(R.vx.phiVn) + ' kN'),
      k('Eje menor: Aw [mm²] · Cv · φv', `${fx(R.vy.Aw,0)} · ${fx(R.vy.Cv,3)} · ${R.vy.phi}`), k('φVn eje menor', k3(R.vy.phiVn) + ' kN')]]);
    g.push(['Torsión (F.2.8.3)', s.tipo === 'I' ? [k('τ = T·tmáx/J ≤ φ·0.6·Fy → φTn = 0.9·0.6·Fy·J/tmáx', m6(R.tor.phiTn) + ' kN·m')]
      : [k('h/t · caso', `${fx(R.tor.hT,1)} · ${R.tor.caso}`), k('Fcr [MPa] · C [mm³]', `${fx(R.tor.Fcr,1)} · ${fx(s.C,0)}`), k('φTn = 0.9·Fcr·C', m6(R.tor.phiTn) + ' kN·m')]]);
  }
  return g.map(([t, f]) => `<h4 class="sub">${t}</h4>${T(['', ''], f)}`).join('');
}

function activarMet(e){
  const D = datosD(), re = () => { guardarMemoria(); pintarResMet(e); };
  $('#dDet [data-a="nom"]')?.addEventListener('change', () => paneAnexoD());
  $$('#dDet [data-a]').forEach(inp => inp.addEventListener(inp.type === 'checkbox' || inp.tagName === 'SELECT' ? 'change' : 'input', debounce(() => {
    setP(e, inp.dataset.a, inp.type === 'checkbox' ? inp.checked : inp.value);
    if(inp.dataset.a === 'grupo' && !e.Lx && _filas?.G?.[e.grupo]?.Lmax) e.Lx = +_filas.G[e.grupo].Lmax.toFixed(3);
    if(['perfil','grupo','acero'].includes(inp.dataset.a)) paneAnexoD(); else re();
  }, 350)));
  $$('[data-tipo]').forEach(b => b.onclick = () => { e.tipo = b.dataset.tipo; guardarMemoria(); paneAnexoD(); });
  $$('[data-fz]').forEach(b => b.onclick = () => { e.fuerzas = b.dataset.fz; guardarMemoria(); paneAnexoD(); });
  if($('#dBorrar')) $('#dBorrar').onclick = () => { if(!confirm(`¿Borrar ${e.nom}?`)) return; D.met = D.met.filter(x => x.id !== e.id); selMet = null; guardarMemoria(); paneAnexoD(); };
  pintarResMet(e);
}

// ═══ Páginas imprimibles del Anexo D (elementos metálicos) ═══
async function imprimirD(){
  const D = datosD(); if(!D.met.length && !D.zap.length && !D.ped.length) return toast('No hay elementos para imprimir.');
  let G = null; toast('Calculando todos los elementos…', 20000);
  if(D.met.length) try{ G = await filasModelo(); }catch(e){ console.warn(e); }
  const Rs = D.met.map(e => ({ e, R:calcMet(e, G) }));
  const conc = await conPrintHTML(D, 'D'); guardarMemoria();
  $('#print-area').innerHTML = anexoDPrintHTML(Rs, conc);
  await document.fonts.ready; toast('Listo.', 800); imprimirConMargen(`${S.m.consecutivo}_ANEXO_D`);
}
function anexoDPrintHTML(Rs, conc=''){
  const m = S.m, f = m.ficha, c = S.cfg, L = 'D';
  const fecha = f.fecha ? new Date(f.fecha + 'T12:00').toLocaleDateString('es-CO', { month:'long', year:'numeric' }) : '';
  const tb = (cab, filas) => `<table class="ax-tb"><thead><tr>${cab.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${filas.map(r => `<tr>${r.map((x,i) => `<td class="${i?'c':''}">${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const ok = Rs.filter(x => x.R?.ok);
  return `<div class="ax"><section>
    <div class="ax-hd"><div class="ax-t">ANEXO ${L} - DISEÑO DE ELEMENTOS</div><div class="ax-n">NSR-10 ${Rs.length && conc ? 'Títulos F y C' : Rs.length ? 'Título F' : 'Título C'}</div><div class="ax-n2">${[Rs.length ? 'Elementos metálicos' : '', conc ? 'Elementos de concreto' : ''].filter(Boolean).join(' y ')}</div>
      <table class="ax-id"><tr><td><b>Proyecto:</b></td><td>${esc(f.proyecto||m.titulo||'')}</td><td><b>Ingeniero:</b></td><td>${esc((c.nombre_firma||'').replace(/^ING\.\s*/,''))}</td></tr>
      <tr><td><b>Proyecto No.:</b></td><td>${esc(m.consecutivo)}</td><td><b>Fecha:</b></td><td>${esc(fecha)}</td></tr></table></div>
    ${Rs.length ? `<h3>${L}-1 Elementos metálicos — resumen</h3>
    <p>Los elementos se diseñan por el método de resistencia (NSR-10 F.2) con las fuerzas del modelo estructural en las combinaciones de resistencia. Para cada chequeo se revisan todas las filas de resultados del grupo y se presenta la que controla; la interacción de carga axial y flexión se evalúa con las ecuaciones H1-1 con fuerzas que actúan simultáneamente.</p>
    ${tb(['Elemento','Sección','Descripción','Acero','Relación D/C','Resultado'], Rs.map(({ e, R }) => [`<b>${esc(e.nom)}</b>`, esc(nomSec(e)), esc(e.desc || ''), esc(e.acero), R?.ok ? fx(R.ratio,3) : '—', R?.ok ? (R.cumple ? 'Cumple' : '<b>No cumple</b>') : 'Sin datos']))}` : ''}
  </section>
  ${ok.map(({ e, R }, i) => `<section class="ax-cont"><h3>${L}-1.${i+1} ${esc(e.nom)} — ${esc(nomSec(e))}${e.desc ? ' (' + esc(e.desc) + ')' : ''}</h3>
    <table class="ax-kv"><tr><td>Longitudes Lx · Ly · Lb · Lz [m]</td><td>${[R.Lx, R.Ly, R.Lb, R.Lz].map(v => fx(v/1000,2)).join(' · ')}</td></tr>
      ${R.s.tipo !== 'BAR' ? `<tr><td>Kx · Ky · Kz · Cb</td><td>${R.Kx} · ${R.Ky} · ${R.Kz} · ${R.Cb}</td></tr>` : ''}
      <tr><td>Fuerzas</td><td>${e.fuerzas === 'manual' ? 'escritas por el diseñador' : `grupo ${esc(e.grupo.replace('|', ' · '))} — ${R.filas} filas de resultados`}</td></tr></table>
    ${tb(['Chequeo','Demanda','Capacidad φRn','Relación','Fila que controla'], Object.entries(CHK).filter(([k]) => R.checks[k]).map(([k, [n, ref, u, cap, dem]]) => { const ch = R.checks[k], fl = ch.f;
      return [`${n} (${k === 'int' ? fl.ec : ref})`, k === 'int' ? `${fx(fl.pr,3)} / ${fx(fl.mm,3)}` : `${fx(dem(fl),2)} ${u}`, k === 'int' ? '≤ 1.00' : `${fx(cap(R),2)} ${u}`, fx(ch.r,3), filaTxt(fl)]; }))}
    <div class="ax-box">Relación máxima = ${fx(R.ratio,3)} — ${R.cumple ? 'CUMPLE' : 'NO CUMPLE'}</div>
    ${R.avisos.map(a => `<p class="ax-nota">${esc(a)}</p>`).join('')}
    ${detalleMetHTML(R, true)}</section>`).join('')}${conc}</div>`;
}
