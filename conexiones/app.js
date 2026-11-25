/* Diseño de conexiones metálicas — P. Electric S.A.S. (pedido de Amo 10-nov, opción B: app aparte)
   Misma tecnología y mismo proyecto de Supabase que el generador de memorias (tabla con_proyectos);
   comparte la sesión porque vive en la subcarpeta /conexiones/ del mismo sitio. */
'use strict';
const CFG = window.APP_CONFIG;
const sb = supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY);
const BUCKET = 'memorias';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const S = { user:null, rol:null, cfg:{}, perfiles:[], lista:[], p:null, sel:null, q:'' };
const f2 = (x, d = 2) => x == null || !isFinite(x) ? '—' : (+x).toLocaleString('es-CO', { minimumFractionDigits:d, maximumFractionDigits:d });
const { rigHTML, NOMBRES, CATS, PREF, recalcular, campo, SEL_DIAM, SEL_ACERO, dnom, SOPN, conFig, svgCorteEsq, figLcr, figContinuidad, opDebil, svgPlantaDebil, figDebil, svgCorteDebil, figCorteDebil, figPlacaApoyo, seccionesDe, abiertas, ejesCon, cargasHTML, cargasTxt, nz, formHTML, GRUPOS, chequeosHTML, reqHTML, resHTML, ICO_ALETA, ICO_GRUPO, cotaV, cotaH, dibujo, ICO_ANG, dibAngular, ICO_TESTA, ICO_TV, ICO_AS, ICO_EMP, ICO_CAR, ICO_BASE, ICO_SP, ICO_EZ, ICO, svgW, dibTestaV, dibAsiento, dibEmpalme, dibCartela, dibBase, dibSoldada, dibEmpZ, dibTesta, dibAleta, dibGrupo, datosPrint } = ConUI;   // piezas compartidas con el Anexo E (ui-con.js)
const hoyISO = () => new Date().toISOString().slice(0, 10);
const fmtFecha = s => s ? new Date(s.length === 10 ? s + 'T12:00' : s).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' }) : '—';
function toast(m, ms = 2600){ const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, ms); }
function err(e, pre = 'Error'){ console.error(e); toast(`${pre}: ${e?.message || e}`, 4500); }
const esIng = () => S.rol === 'ingeniero';
const ir = h => { if(location.hash === h) ruta(); else location.hash = h; };
async function urlDe(path){ if(!path) return ''; const { data } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600); return data?.signedUrl || ''; }

// ── Inicio de sesión (la misma cuenta del generador de memorias) ─────────────
async function arrancar(){
  const { data } = await sb.auth.getSession();
  sb.auth.onAuthStateChange((ev, ses) => { if(ev === 'SIGNED_OUT'){ S.user = null; renderLogin(); } });
  if(!data.session) return renderLogin();
  S.user = data.session.user; await cargarBase(); ruta();
}
function renderLogin(){
  $('#userbox').hidden = true;
  $('#app').innerHTML = `<div class="login"><div class="card"><h2>Diseño de conexiones</h2>
    <p class="muted">Entre con la misma cuenta del generador de memorias.</p>
    <form id="lf"><div class="f"><label for="lEmail">Correo</label><input id="lEmail" type="email" autocomplete="username" required/></div>
    <div class="f"><label for="lPass">Contraseña</label><input id="lPass" type="password" autocomplete="current-password" required/></div>
    <button class="btn pri" type="submit" style="width:100%;margin-top:6px">Entrar</button></form></div></div>`;
  $('#lf').onsubmit = async e => { e.preventDefault();
    const { data, error } = await sb.auth.signInWithPassword({ email:$('#lEmail').value.trim(), password:$('#lPass').value });
    if(error) return toast('No se pudo entrar: revise el correo y la contraseña.', 4000);
    S.user = data.session.user; await cargarBase(); ruta(); };
}
async function cargarBase(){
  const [u, c, pf] = await Promise.all([
    sb.from('mem_usuarios').select('rol').eq('user_id', S.user.id).maybeSingle(),
    sb.from('mem_config').select('*').eq('id', 1).maybeSingle(),
    sb.from('mem_perfiles_pie').select('*').order('nombre') ]);
  S.rol = u.data?.rol || 'consulta'; S.cfg = c.data || {}; S.perfiles = pf.data || [];
  // Respaldo y Configuración (íconos arriba, igual que el generador; Amo 21-nov): llevan a esas pantallas del generador
  if(S.rol === 'ingeniero'){ document.getElementById('btnResp').hidden = false; document.getElementById('btnCfg').hidden = false;
    const ult = S.cfg.ultimo_respaldo, dias = ult ? (Date.now() - new Date(ult).getTime()) / 86400000 : Infinity;
    document.getElementById('respDot').hidden = dias <= (+S.cfg.respaldo_dias || 15); }
  $('#userbox').hidden = false;
}
window.addEventListener('hashchange', ruta);
function ruta(){
  if(!S.user) return;
  const m = location.hash.match(/^#\/p\/([^/]+)(?:\/(c|n)\/([^/]+))?/);
  if(m) return abrirProyecto(m[1], m[2] === 'n' ? 'N:' + m[3] : m[3]);
  renderLista();
}

// ── Lista de proyectos ─────────────
async function renderLista(){
  S.p = null;
  $('#app').innerHTML = '<p class="muted">Cargando…</p>';
  const { data, error } = await sb.from('con_proyectos').select('id,consecutivo,titulo,estado,ficha,updated_at,datos').order('updated_at', { ascending:false });
  if(error) return err(error, 'No se pudo cargar la lista');
  S.lista = data || [];
  $('#app').innerHTML = `<div class="main-hd"><div><h2>Diseño de conexiones metálicas</h2>
      <p class="lead">NSR-10 Título F.2 (AISC 360-10, LRFD). Cada proyecto agrupa las conexiones de una estructura y se imprime como memoria.</p></div>
      <div class="nav-btns">${esIng() ? '<button class="btn pri" type="button" id="nuevo">+ Nuevo proyecto</button>' : ''}</div></div>
    <div class="lbar"><input type="search" id="q" placeholder="🔍 Buscar: proyecto, cliente, municipio, consecutivo…" value="${esc(S.q)}"/></div>
    <div id="cl"></div>`;
  const pinta = () => {
    const q = S.q.toLowerCase();
    const L = S.lista.filter(p => !q || [p.consecutivo, p.titulo, p.ficha?.prop, p.ficha?.mun].join(' ').toLowerCase().includes(q));
    $('#cl').innerHTML = L.map(p => { const n = (p.datos?.con || []).length, mal = (p.datos?.con || []).filter(c => c.res && !c.res.ok).length;
      return `<div class="mi"><div><div class="code">${esc(p.consecutivo)}</div><div class="nm">${esc(p.titulo)}</div>
        <div class="meta">${esc([p.ficha?.mun, p.ficha?.depto].filter(Boolean).join(', ') || 'Sin ubicación')} · ${esc(p.ficha?.prop || 'Sin cliente')} · ${n} conexi${n === 1 ? 'ón' : 'ones'}${mal ? ` · <b style="color:var(--red)">${mal} no cumple${mal > 1 ? 'n' : ''}</b>` : ''} · editado ${fmtFecha(p.updated_at)}</div></div>
        <div class="acts">${p.estado === 'apr' ? '<span class="pill ok">Terminado</span>' : '<span class="pill wip">En proceso</span>'}
        ${esIng() ? `<button class="btn sm danger" type="button" data-borrar="${p.id}">Eliminar</button>` : ''}<button class="btn sm pri" type="button" data-abrir="${p.id}">Abrir</button></div></div>`; }).join('')
      || `<div class="card empty">${S.lista.length ? 'Ningún proyecto coincide.' : 'Todavía no hay proyectos. Cree el primero con <b>+ Nuevo proyecto</b>.'}</div>`;
    $$('[data-abrir]').forEach(b => b.onclick = () => ir(`#/p/${b.dataset.abrir}`));
    $$('[data-borrar]').forEach(b => b.onclick = async () => { const p = S.lista.find(x => x.id === b.dataset.borrar);
      if(!confirm(`¿Eliminar ${p.consecutivo} «${p.titulo}» y todas sus conexiones? No se puede deshacer.`)) return;
      const { error } = await sb.from('con_proyectos').delete().eq('id', p.id); if(error) return err(error); toast('Proyecto eliminado.'); renderLista(); });
  };
  pinta();
  $('#q').oninput = e => { S.q = e.target.value; pinta(); };
  if($('#nuevo')) $('#nuevo').onclick = nuevoProyecto;
}
async function nuevoProyecto(){
  const d = new Date(), base = `DOC-CON-${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getFullYear()).slice(2)}`;
  const { data:ex } = await sb.from('con_proyectos').select('consecutivo').like('consecutivo', base + '%');
  const usados = new Set((ex || []).map(x => x.consecutivo)); let cons = base, k = 2; while(usados.has(cons)) cons = `${base}-${k++}`;
  const perfil = S.perfiles.find(p => p.predeterminado) || S.perfiles[0];
  const { data, error } = await sb.from('con_proyectos').insert({ consecutivo:cons, titulo:'Sin nombre', ficha:{ fecha:hoyISO() }, datos:{ con:[] }, perfil_id:perfil?.id || null }).select().single();
  if(error) return err(error, 'No se pudo crear');
  toast(`Proyecto ${cons} creado.`); ir(`#/p/${data.id}`);
}

// ── Proyecto ─────────────
async function abrirProyecto(id, cid){
  if(!S.p || S.p.id !== id){
    $('#app').innerHTML = '<p class="muted">Cargando…</p>';
    const { data, error } = await sb.from('con_proyectos').select('*').eq('id', id).maybeSingle();
    if(error || !data){ toast('No se encontró el proyecto.'); return ir('#/'); }
    S.p = data; S.p.datos = S.p.datos || {}; S.p.datos.con = S.p.datos.con || []; S.p.ficha = S.p.ficha || {};
  }
  S.p.datos.nudos = S.p.datos.nudos || [];
  S.sel = cid && (S.p.datos.con.some(c => c.id === cid) || S.p.datos.nudos.some(n => 'N:' + n.id === cid)) ? cid : (S.p.datos.con[0]?.id || null);
  renderProyecto();
}
let tGuardar = null;
function guardar(){ clearTimeout(tGuardar); $('#gEst') && ($('#gEst').textContent = 'Guardando…');
  tGuardar = setTimeout(async () => { const p = S.p; if(!p) return;
    const { error } = await sb.from('con_proyectos').update({ ficha:p.ficha, datos:p.datos, titulo:(p.ficha.proyecto || '').trim() || 'Sin nombre', estado:p.estado, perfil_id:p.perfil_id }).eq('id', p.id);
    if($('#gEst')) $('#gEst').textContent = error ? '⚠ Sin guardar' : '✓ Guardado'; if(error) err(error, 'No se pudo guardar'); }, 700); }
const conSel = () => S.p.datos.con.find(c => c.id === S.sel);
const resumenDatos = F => [F.proyecto, F.prop, [F.mun, F.depto].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || 'Sin datos: toque para llenarlos (van a la portada)';
// Disipación de energía del proyecto (pedido de Amo 21-nov): se escoge una vez y la toman todas las conexiones y nudos;
// con DMO o DES las conexiones a momento no precalificadas (AISC 358) quedan en gris en la galería.
window.ConSisProy = true;
const TIENE_SIS = ['testa', 'ras', 'soldada', 'empalme', 'empZ', 'cartela', 'esquina', 'cruce', 'base', 'empCol'];
const NO_PRECAL = { DMO:['ras'], DES:['ras'] };
const SIS_OP = [['no', 'Sin sismo'], ['DMI', 'DMI · pórtico ordinario (OMF)'], ['DMO', 'DMO · pórtico intermedio (IMF)'], ['DES', 'DES · pórtico especial (SMF)']];
function sisProyecto(p){
  if(!p.datos.sismo){ const v = p.datos.con.map(c => c.sismo); p.datos.sismo = v.includes('DES') ? 'DES' : v.includes('DMO') ? 'DMO' : 'no'; }   // proyectos viejos: el mayor que tenían
  return p.datos.sismo;
}
function aplicarSis(p){ const s = sisProyecto(p), v = ['DMO', 'DES'].includes(s) ? s : 'no';
  p.datos.con.forEach(c => { if(TIENE_SIS.includes(c.tipo)) c.sismo = ['empalme', 'empZ'].includes(c.tipo) && c.vigaGrav ? 'no' : v; });   // empalmes de vigas de gravedad: sin sismo (Amo 21-nov)
  (p.datos.nudos || []).forEach(n => { n.sismo = s; }); }
const noPrecal = (p, t) => (NO_PRECAL[sisProyecto(p)] || []).includes(t);
function renderProyecto(){
  const p = S.p, F = p.ficha, ro = esIng() ? '' : 'disabled';
  aplicarSis(p); const sisP = sisProyecto(p);
  p.datos.nudos = p.datos.nudos || []; p.datos.nudos.forEach(recalcNudo);
  const inp = (k, l, ph = '') => `<div class="f"><label>${l}</label><input data-fk="${k}" value="${esc(F[k] || '')}" placeholder="${esc(ph)}" ${ro}/></div>`;
  $('#app').innerHTML = `<div class="ws-bar"><a class="btn sm" href="#/">← Proyectos</a><span class="code">${esc(p.consecutivo)}</span><span class="muted" id="gEst"></span>
      <span class="sp"></span>${esIng() ? `<select id="pEst" class="est-sel est-${p.estado === 'apr' ? 'apr' : 'wip'}"><option value="wip" ${p.estado !== 'apr' ? 'selected' : ''}>En proceso</option><option value="apr" ${p.estado === 'apr' ? 'selected' : ''}>Terminado</option></select>` : ''}
      <button class="btn sm pri" type="button" id="imp">🖨 Imprimir memoria</button></div>
    <details class="card pd" id="pDatos" ${F.proyecto ? '' : 'open'}><summary class="pd-hd" title="Toque para abrir o cerrar">
        <span class="pd-ico" aria-hidden="true">▸</span><span class="pd-tt">Datos del proyecto<small id="pdRes">${esc(resumenDatos(F))}</small></span>
        <span class="pd-btn"><span class="ab">Ver y editar ▾</span><span class="ce">Ocultar ▴</span></span></summary>
      <div class="fg g3">${inp('proyecto', 'Nombre del proyecto', 'Ej.: Conexiones bodega Pérez')}${inp('prop', 'Cliente / propietario')}${inp('doc', 'Identificación (NIT / C.C.)')}
        ${inp('dir', 'Dirección del predio')}${inp('mun', 'Municipio')}${inp('depto', 'Departamento')}
        <div class="f"><label>Fecha</label><input type="date" data-fk="fecha" value="${esc(F.fecha || '')}" ${ro}/></div>
        <div class="f"><label>Membrete y pie de página</label><select id="pPerfil" ${ro}>${S.perfiles.map(x => `<option value="${x.id}" ${x.id === p.perfil_id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></div></div></details>
    <div class="card sis-card"><div class="sis-hd"><b>Disipación de energía</b><div class="sis-op" role="radiogroup" aria-label="Disipación de energía del proyecto">${SIS_OP.map(([k, t]) => `<button type="button" class="${sisP === k ? 'on' : ''}" data-sisp="${k}" role="radio" aria-checked="${sisP === k}" ${ro}>${t}</button>`).join('')}</div></div>
      <div class="hint">Vale para todas las conexiones del proyecto. ${['DMO', 'DES'].includes(sisP) ? 'Con DMO o DES las conexiones a momento deben estar precalificadas (AISC 358): las que no lo están quedan en gris en la galería. Las conexiones a cortante solo van en vigas de gravedad, fuera del pórtico resistente a momento.' : 'Sin requisitos sísmicos especiales en las conexiones.'}</div></div>
    <div class="d-grid"><div class="d-lista">
        ${p.datos.con.map(c => { const r = c.res; return `<button type="button" class="d-el ${c.id === S.sel ? 'on' : ''}" data-sel="${c.id}"><span><b>${esc(c.nom)}</b> ${esc(NOMBRES[c.tipo].split(' (')[0])}<small>${esc(c.desc || '')}</small>${noPrecal(p, c.tipo) ? `<small class="np">🔒 No precalificada para ${sisP}</small>` : ''}</span>${r ? `<span class="pill ${r.ok ? 'ok' : 'no'}">${f2(r.max)}</span>` : ''}</button>`; }).join('')}
        ${p.datos.nudos.length ? `<div class="gal-cat">Nudos de columna</div>${p.datos.nudos.map(n => { const r = n.res; return `<button type="button" class="d-el ${'N:' + n.id === S.sel ? 'on' : ''}" data-sel="N:${n.id}"><span><b>${esc(n.nom)}</b> Nudo · ${esc(n.columna)}<small>${esc(nudoCons(n).map(x => x.c.nom).join(', ') || 'sin conexiones')}</small></span>${r ? `<span class="pill ${r.ok ? 'ok' : 'no'}">${f2(r.max)}</span>` : ''}</button>`; }).join('')}` : ''}
        ${esIng() ? '<div class="gal-zona">' + (['DMO', 'DES'].includes(sisP) ? `<div class="sis-pill">Disipación del proyecto: ${sisP}</div>` : '') + CATS.map(([ct, L]) => `<div class="gal-cat">${ct}</div>${['DMO', 'DES'].includes(sisP) && L.includes('aleta') ? '<div class="hint gal-nota">Solo para vigas de gravedad (fuera del pórtico a momento)</div>' : ''}<div class="gal">${L.map(t => noPrecal(p, t)
          ? `<button type="button" class="gal-it np" disabled title="No precalificada para ${sisP} (AISC 358)">${ICO[t] || ''}<span>＋ ${NOMBRES[t]}<small>🔒 No precalificada para ${sisP}</small></span></button>`
          : `<button type="button" class="gal-it" data-nueva="${t}">${ICO[t] || ''}<span>＋ ${NOMBRES[t]}</span></button>`).join('')}</div>`).join('')
          + `<div class="gal-cat">Varias vigas a una columna</div><div class="gal"><button type="button" class="gal-it" data-nnudo="1">${ICO_NUDO}<span>＋ Nudo de columna (agrupar conexiones)</span></button></div></div>` : ''}
      </div><div id="ed">${S.sel ? '' : '<div class="card empty">Agregue una conexión con los botones de la izquierda.</div>'}</div></div>`;
  $$('[data-fk]').forEach(el => el.oninput = () => { F[el.dataset.fk] = el.value; const r = $('#pdRes'); if(r) r.textContent = resumenDatos(F); guardar(); });
  if($('#pPerfil')) $('#pPerfil').onchange = e => { p.perfil_id = e.target.value; guardar(); };
  $$('[data-sisp]').forEach(b => b.onclick = () => { if(!esIng() || p.datos.sismo === b.dataset.sisp) return; p.datos.sismo = b.dataset.sisp; aplicarSis(p);
    p.datos.con.forEach(c => recalcular(c)); p.datos.nudos.forEach(recalcNudo); guardar(); renderProyecto();
    const np = p.datos.con.filter(c => noPrecal(p, c.tipo)); toast(`Disipación del proyecto: ${b.dataset.sisp === 'no' ? 'sin sismo' : b.dataset.sisp}.${np.length ? ` ${np.map(c => c.nom).join(', ')} no está${np.length > 1 ? 'n' : ''} precalificada${np.length > 1 ? 's' : ''}.` : ''}`, 6000); });
  if($('#pEst')) $('#pEst').onchange = e => { p.estado = e.target.value; e.target.className = `est-sel est-${p.estado}`; guardar(); toast(p.estado === 'apr' ? 'Terminado: lo puede ver el personal de consulta.' : 'En proceso.'); };
  $$('[data-sel]').forEach(b => b.onclick = () => { S.sel = b.dataset.sel; history.replaceState(null, '', `#/p/${p.id}${hashSel()}`); renderProyecto(); });
  $$('[data-nnudo]').forEach(b => b.onclick = () => { const n = Conex.defaultsNudo(); n.id = Math.random().toString(36).slice(2, 10); n.nom = `N-${p.datos.nudos.length + 1}`;
    const ult = [...p.datos.con].reverse().find(c => c.columna); if(ult){ n.columna = ult.columna; n.aceroCol = ult.aceroCol; }
    p.datos.nudos.push(n); S.sel = 'N:' + n.id; recalcNudo(n); guardar(); history.replaceState(null, '', `#/p/${p.id}${hashSel()}`); renderProyecto(); });
  $$('[data-nueva]').forEach(b => b.onclick = () => { const t = b.dataset.nueva, c = Conex.defaults(t);
    c.id = Math.random().toString(36).slice(2, 10); c.nom = `${PREF[t]}-${p.datos.con.filter(x => x.tipo === t).length + 1}`;
    if(TIENE_SIS.includes(t)) c.sismo = ['DMO', 'DES'].includes(sisP) ? sisP : 'no';
    p.datos.con.push(c); S.sel = c.id; recalcular(c); guardar(); history.replaceState(null, '', `#/p/${p.id}/c/${c.id}`); renderProyecto(); });
  $('#imp').onclick = imprimir;
  armarListaMovil();
  if(S.sel) S.sel.startsWith('N:') ? renderNudo() : renderEditor();
}
const hashSel = () => !S.sel ? '' : S.sel.startsWith('N:') ? `/n/${S.sel.slice(2)}` : `/c/${S.sel}`;
function renderEditor(){
  const c = conSel(); if(!c) return;
  const r = recalcular(c), ro = esIng() ? '' : 'disabled';
  $('#ed').innerHTML = `<div class="card"><div class="ct">${esc(c.nom)} · ${esc(NOMBRES[c.tipo])}
      ${esIng() ? `<span style="margin-left:auto;display:flex;gap:6px"><button class="btn sm" type="button" id="dup">⧉ Duplicar</button><button class="btn sm danger" type="button" id="del">Eliminar</button></span>` : ''}</div>
    <div class="fg g2">${campo(c, 'nom', 'Nombre', { num:false })}${campo(c, 'desc', 'Descripción / ubicación', { num:false })}</div>
    <div class="ed-grid"><div id="form">${formHTML(c)}</div><div><div class="dib" id="dib">${r.error ? '' : dibujo(c, r)}</div></div></div></div>
    <div class="card" id="res">${resHTML(c, r)}</div>`;
  const re = () => { pintaRes(); const r2 = recalcular(c); $('#dib').innerHTML = r2.error ? '' : dibujo(c, r2); $('#res').innerHTML = resHTML(c, r2);
    const it = $(`[data-sel="${c.id}"] .pill`); if(it && c.res){ it.className = `pill ${c.res.ok ? 'ok' : 'no'}`; it.textContent = f2(c.res.max); } const sa = $('.sb-av'); if(sa) sa.innerHTML = resumenHTML(S.p.datos.con); guardar(); };
  const pintaRes = () => seccionesDe(c).forEach(([k, , res]) => { const e = $(`[data-res="${k}"]`); if(e) e.textContent = res(); });
  const guardaAb = () => { try{ localStorage.conSecc = JSON.stringify($$('#ed .sec.on').map(x => x.dataset.sec)); }catch(e){} };
  $$('#ed .sec-hd').forEach(b => b.onclick = () => { const s = b.parentElement; s.classList.toggle('on'); b.setAttribute('aria-expanded', s.classList.contains('on')); guardaAb(); });
  $$('#ed [data-secall]').forEach(b => b.onclick = () => { $$('#ed .sec').forEach(s => { s.classList.toggle('on', b.dataset.secall === '1'); $('.sec-hd', s).setAttribute('aria-expanded', b.dataset.secall === '1'); }); guardaAb(); });
  $$('#ed [data-k]').forEach(el => { const k = el.dataset.k;
    const fn = () => { if(el.type === 'checkbox') c[k] = el.checked; else if(el.dataset.num) c[k] = el.value === '' ? '' : Number(el.value.replace(',', '.')); else c[k] = el.value;
      if(k === 'destaje' && c.dct == null) Object.assign(c, { dct:35, dcb:35, cDes:110, LevB:38 });
      if(k === 'unSop' && c.wS == null) Object.assign(c, { wS:6, electrodo:c.electrodo || 'E70XX' });
      if(k === 'rig' && c.rig && c.ts == null) Object.assign(c, { ts:12.7, W:+c.bh || 102, hs:+c.bv || 152, aceroRig:c.aceroAng || 'A36', wR:6, electrodo:c.electrodo || 'E70XX' });
      if(k === 'vigaGrav'){ aplicarSis(S.p); recalcular(c); renderEditor(); guardar(); return; }
      if(['cizalla', 'd', 'rig', 'config', 'dosLados', 'rigCol', 'sismo', 'placaTipo', 'cortTodos', 'union', 'soporte', 'miembro', 'columna', 'uDebil', 'interior', 'desliz', 'resComp', 'ncw', 'diag', 'colTipo', 'cortante', 'refT', 'refV', 'mortero', 'cart', 'rigPunta', 'dp', 'unDp'].includes(k) || (['unSop', 'destaje'].includes(k) && c.tipo !== 'grupo')){ renderEditor(); guardar(); return; }
      if(['viga', 'soporte', 'soldAla', 'ambos', 'filas', 'nL', 'miembro', 'union'].includes(k) && c.tipo !== 'grupo'){ if(k === 'viga'){ const v = Conex.perfil(c.viga); if(v && c.soporte === 'viga'){} } renderEditor(); guardar(); return; }
      if(k === 'nom' || k === 'desc'){ const b = $(`[data-sel="${c.id}"] b`); if(b && k === 'nom') b.textContent = c.nom; guardar(); return; }
      re(); };
    el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', fn); });
  if($('#del')) $('#del').onclick = () => { if(!confirm(`¿Eliminar la conexión ${c.nom}?`)) return; S.p.datos.con = S.p.datos.con.filter(x => x.id !== c.id); (S.p.datos.nudos || []).forEach(n => { n.cons = n.cons.filter(x => x.cid !== c.id); }); S.sel = S.p.datos.con[0]?.id || null; guardar(); renderProyecto(); };
  if($('#dup')) $('#dup').onclick = () => { const n = JSON.parse(JSON.stringify(c)); n.id = Math.random().toString(36).slice(2, 10); n.nom = `${PREF[c.tipo]}-${S.p.datos.con.filter(x => x.tipo === c.tipo).length + 1}`;
    S.p.datos.con.splice(S.p.datos.con.indexOf(c) + 1, 0, n); S.sel = n.id; guardar(); renderProyecto(); };
}
// «Aplicar» de la línea «Qué cambiar» bajo un chequeo
document.addEventListener('click', e => { const b = e.target.closest('[data-fixap]'); if(!b || !S.p) return;
  const c = S.p.datos.con.find(x => x.id === S.sel); if(!c) return; try{ Object.assign(c, JSON.parse(b.dataset.fixap)); }catch(_){ return; }
  renderEditor(); guardar(); toast('Cambio aplicado'); });
// «Aplicar platina de rigidez» del asiento (sugerencia del cálculo)
document.addEventListener('click', e => { const b = e.target.closest('[data-apsug]'); if(!b || !S.p) return;
  const c = S.p.datos.con.find(x => x.id === S.sel); if(!c) return; const r = Conex.calc(c); if(!r.sug) return;
  if(r.sug.tipo === 'sold'){ const { tipo, ok, max, txt, ...v } = r.sug; Object.assign(c, v); renderEditor(); guardar(); toast(v.union === 'cjp' ? 'Cambiado a penetración completa' : 'Sugerencia aplicada'); return; }
  const { max, ok, peso, ...v } = r.sug; Object.assign(c, v, { rig:true, aceroRig:c.aceroRig || c.aceroAng, electrodo:c.electrodo || 'E70XX' }); renderEditor(); guardar(); toast('Platina de rigidez aplicada'); });
const TIPOS_NUDO = ['testa', 'ras', 'soldada', 'aleta', 'angular', 'testaV', 'asiento'];
const nudoSel = () => (S.p.datos.nudos || []).find(n => 'N:' + n.id === S.sel);
const nudoCons = n => (n.cons || []).map(x => ({ c:S.p.datos.con.find(c => c.id === x.cid), cara:x.cara })).filter(x => x.c);
// Resumen del proyecto en la barra lateral (se repinta al recalcular una conexión, 24-nov)
function resumenHTML(L){ const ok = L.filter(c => c.res && c.res.ok).length, mal = L.filter(c => c.res && !c.res.ok);
  return `<small>Resumen del proyecto</small><b>${ok} de ${L.length} cumplen</b><div class="bar"><i style="width:${Math.round(100 * ok / L.length)}%"></i></div><small>${mal.length ? esc(mal.slice(0, 3).map(c => `${c.nom} (${f2(c.res.max)})`).join(', ')) + ' no cumple' + (mal.length > 1 ? 'n' : '') : 'Todas las conexiones calculadas cumplen'}</small>`; }
function recalcNudo(n){ const r = Conex.nudo(n, nudoCons(n)); n.res = r.error ? null : { ok:r.ok, max:r.max }; return r; }
const ICO_NUDO = '<svg viewBox="0 0 60 40" aria-hidden="true"><rect x="22" y="8" width="16" height="3" fill="#64748b"/><rect x="22" y="29" width="16" height="3" fill="#64748b"/><rect x="29" y="11" width="2" height="18" fill="#64748b"/><rect x="2" y="17" width="19" height="6" fill="#cbd5e1" stroke="#475569"/><rect x="39" y="17" width="19" height="6" fill="#cbd5e1" stroke="#475569"/><rect x="27" y="33" width="6" height="7" fill="#cbd5e1" stroke="#475569"/><rect x="27" y="0" width="6" height="7" fill="#cbd5e1" stroke="#475569"/></svg>';
function nudoFormHTML(n){
  const ro = esIng() ? '' : 'disabled', L = S.p.datos.con.filter(c => TIPOS_NUDO.includes(c.tipo));
  const SELP = (k, l) => campo(n, k, l, { sel:(window.PERFILES_LAM || []).map(x => [x[0], x[0]]) });
  const ck = (k, t) => `<div class="f"><label class="ck"><input type="checkbox" data-k="${k}" ${n[k] ? 'checked' : ''} ${ro}/> ${t}</label></div>`;
  const g3 = (...x) => `<div class="fg g3">${x.join('')}</div>`;
  const filas = n.cons.map((x, i) => { const c = S.p.datos.con.find(k => k.id === x.cid), v = c ? Conex.vigaDe(c) : null;
    return `<tr><td><select data-ncara="${i}" ${ro}>${Object.entries(Conex.CARAS).map(([k, t]) => `<option value="${k}" ${x.cara === k ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
      <td><select data-ncon="${i}" ${ro}>${c ? '' : '<option value="">— escoja —</option>'}${L.map(k => `<option value="${k.id}" ${k.id === x.cid ? 'selected' : ''}>${esc(k.nom)} · ${esc(NOMBRES[k.tipo].split(' (')[0])}</option>`).join('')}</select></td>
      <td class="hint">${v ? `${esc(v.vg ? v.vg.nom : '?')} · ${v.mom ? `<b>M ${f2(v.M, 1)}</b> kN·m · ` : 'cortante · '}V ${f2(v.V, 1)} kN` : ''}</td>
      <td>${esIng() ? `<button type="button" class="btn sm" data-nquita="${i}" title="Quitar del nudo">✕</button>` : ''}</td></tr>`; }).join('');
  const sec = (i, t, res, body) => `<section class="sec on"><div class="sec-hd" style="cursor:default"><i>${i}</i><b>${t}</b><small>${esc(res)}</small></div><div class="sec-bd">${body}</div></section>`;
  return sec(1, 'Columna', `${n.columna} · ${n.aceroCol}`, g3(SELP('columna', 'Perfil'), campo(n, 'aceroCol', 'Acero', { sel:SEL_ACERO }), '<div></div>',
      campo(n, 'Pc', 'Axial de la columna Pu [kN]', { h:'Compresión mayorada; reduce la zona de panel si pasa de 0.4·Py' }), campo(n, 'Vc', 'Cortante de la columna Vc [kN]', { h:'Descuenta en la zona de panel; vacío = 0' }))
      + ck('colTope', 'El nudo está en el extremo superior de la columna (menos de d de la punta)')
      + (n.sismo === 'DES' ? `<h4 class="sub">Columna fuerte – viga débil (proyecto DES)</h4>` + g3(campo(n, 'colArriba', 'Columna de arriba', { sel:[['', 'La misma'], ['ninguna', 'Ninguna (último piso)'], ...(window.PERFILES_LAM || []).map(x => [x[0], x[0]])] }),
          n.colArriba === 'ninguna' || n.colTope ? '' : campo(n, 'PcA', 'Axial de la columna de arriba Pu [kN]', { h:'Vacío = la misma de abajo' })) : ''))
    + sec(2, 'Conexiones que llegan', `${n.cons.length} conexi${n.cons.length === 1 ? 'ón' : 'ones'}`,
      `<div class="tw"><table class="t nd-t"><thead><tr><th>Cara de la columna</th><th>Conexión</th><th>Viga y cargas</th><th></th></tr></thead><tbody>${filas || '<tr><td colspan="4" class="hint">Todavía no hay conexiones en este nudo.</td></tr>'}</tbody></table></div>
      ${esIng() ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0"><button type="button" class="btn sm" id="nAdd" ${L.length ? '' : 'disabled'}>＋ Agregar conexión al nudo</button>
        <button type="button" class="btn sm pri" id="nAjus" ${n.cons.length ? '' : 'disabled'}>⇄ Ajustar las conexiones al nudo</button></div>
        <div class="hint">«Ajustar» copia a cada conexión la columna, el soporte (ala o alma), su espesor y acero, y la viga del otro lado. Solo cambia esos datos.</div>` : ''}
      ${L.length ? '' : '<div class="note amber">Primero cree las conexiones de las vigas (chapa de testa, soldada, chapa de aleta, angulares…).</div>'}
      ${g3(campo(n, 'sentido', 'Vigas de las dos alas', { sel:[['opuesto', 'Momentos opuestos (gravedad)'], ['mismo', 'Mismo sentido (sismo o viento)']] }),
        campo(n, 'sentidoW', 'Vigas a los dos lados del alma', { sel:[['opuesto', 'Momentos opuestos (gravedad)'], ['mismo', 'Mismo sentido (sismo o viento)']] }))}`)
    + sec(3, 'Placas de continuidad', { auto:'automático', si:'siempre', no:'sin placas' }[n.rigCol] + (n.tsC ? ` · ts ${n.tsC} mm` : ''),
      conFig(`<div class="fg g2">${[campo(n, 'rigCol', '¿Lleva placas?', { sel:[['auto', 'Automático (si hacen falta)'], ['si', 'Sí'], ['no', 'No']] }), campo(n, 'tsC', 'Espesor ts [mm]', { h:'Vacío = automático' }), campo(n, 'wsC', 'Filete a las alas [mm]', { h:'Vacío = automático' }),
        campo(n, 'aceroRigC', 'Acero de las placas', { sel:SEL_ACERO }), campo(n, 'electrodo', 'Electrodo', { sel:Object.keys(Conex.ELECTRODOS) })].join('')}</div>`, figContinuidad(nudoCons(n).some(x => x.cara === 'ala2'), Conex.perfil(n.columna), false)))
    + sec(4, 'Placa de refuerzo del alma', n.dp === 'si' ? `sí${n.tdp ? ` · td ${n.tdp} mm` : ' · automática'}` : 'no', ConUI.doublerHTML(n, campo, () => '').replace(/^<h4 class="sub">[^<]*<\/h4>/, ''));
}
function resNudoHTML(n, r){
  if(r.error) return `<div class="note">${esc(r.error)}</div>`;
  const filas = r.cons.map(x => { const c = S.p.datos.con.find(k => k.nom === x.nom);
    return `<tr><td><b>${esc(x.nom)}</b></td><td>${esc(Conex.CARAS[x.cara])}</td><td>${esc(NOMBRES[x.tipo])}</td><td class="n">${x.max == null ? '—' : f2(x.max, 3)}</td>
      <td>${x.max == null ? '—' : `<span class="pill ${x.ok ? 'ok' : 'no'}">${x.ok ? 'Cumple' : 'No cumple'}</span>`}</td><td>${c ? `<button type="button" class="btn sm" data-sel="${c.id}">Abrir</button>` : ''}</td></tr>`; }).join('');
  return `<div class="ct">Resultado del nudo <span class="pill ${r.ok ? 'ok' : 'no'}" style="margin-left:8px">${r.ok ? 'Cumple' : 'No cumple'}${r.ch.length ? ` · relación máx. ${f2(r.max, 3)}` : ''}</span></div>
    <h4 class="nd-h">Cada conexión por sí sola</h4><div class="tw"><table class="t"><thead><tr><th>Conexión</th><th>Cara</th><th>Tipo</th><th>Relación</th><th></th><th></th></tr></thead><tbody>${filas}</tbody></table></div>
    ${r.av.length ? `<div class="note amber">${r.av.map(esc).join('<br/>')}</div>` : ''}
    <h4 class="nd-h">Lo que comparten en la columna</h4>${r.ch.length ? chequeosHTML(r) : '<p class="hint">Solo llegan vigas a cortante: la columna no recibe fuerzas en las alas; se revisa la coherencia de los datos.</p>'}
    <details style="margin-top:8px" ${r.req.some(x => !x[1]) ? 'open' : ''}><summary><b>Coherencia y detallado</b> (${r.req.filter(x => x[1]).length}/${r.req.length})</summary>${reqHTML(r)}</details>
    <details style="margin-top:6px"><summary><b>Ver cálculo detallado</b></summary><div class="calc">${r.pasos.map(esc).join('<br/>')}</div></details>`;
}
function renderNudo(){
  const n = nudoSel(); if(!n) return;
  const r = recalcNudo(n);
  $('#ed').innerHTML = `<div class="card"><div class="ct">${esc(n.nom)} · Nudo de columna
      ${esIng() ? `<span style="margin-left:auto;display:flex;gap:6px"><button class="btn sm" type="button" id="dup">⧉ Duplicar</button><button class="btn sm danger" type="button" id="del">Eliminar</button></span>` : ''}</div>
    <div class="fg g2">${campo(n, 'nom', 'Nombre', { num:false })}${campo(n, 'desc', 'Descripción / ubicación', { num:false })}</div>
    <div class="ed-grid"><div id="form">${nudoFormHTML(n)}</div><div><div class="dib" id="dib">${dibNudo(n, r)}</div></div></div></div>
    <div class="card" id="res">${resNudoHTML(n, r)}</div>`;
  const re = () => { const r2 = recalcNudo(n); $('#dib').innerHTML = dibNudo(n, r2); $('#res').innerHTML = resNudoHTML(n, r2); enlaza();
    const it = $(`[data-sel="N:${n.id}"] .pill`); if(it && n.res){ it.className = `pill ${n.res.ok ? 'ok' : 'no'}`; it.textContent = f2(n.res.max); } guardar(); };
  const enlaza = () => $$('#res [data-sel]').forEach(b => b.onclick = () => { S.sel = b.dataset.sel; history.replaceState(null, '', `#/p/${S.p.id}${hashSel()}`); renderProyecto(); });
  enlaza();
  $$('#ed [data-k]').forEach(el => { const k = el.dataset.k;
    el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', () => {
      if(el.type === 'checkbox') n[k] = el.checked; else if(el.dataset.num) n[k] = el.value === '' ? '' : Number(el.value.replace(',', '.')); else n[k] = el.value;
      if(k === 'nom'){ const b = $(`[data-sel="N:${n.id}"] b`); if(b) b.textContent = n.nom; guardar(); return; }
      if(k === 'desc'){ guardar(); return; }
      if(el.tagName === 'SELECT' || el.type === 'checkbox'){ renderNudo(); guardar(); renderLista2(); return; }
      re(); }); });
  $$('#ed [data-ncara]').forEach(el => el.onchange = () => { n.cons[+el.dataset.ncara].cara = el.value; renderNudo(); guardar(); });
  $$('#ed [data-ncon]').forEach(el => el.onchange = () => { n.cons[+el.dataset.ncon].cid = el.value; renderNudo(); guardar(); renderLista2(); });
  $$('#ed [data-nquita]').forEach(el => el.onclick = () => { n.cons.splice(+el.dataset.nquita, 1); renderNudo(); guardar(); renderLista2(); });
  if($('#nAdd')) $('#nAdd').onclick = () => { const L = S.p.datos.con.filter(c => TIPOS_NUDO.includes(c.tipo)), us = new Set(n.cons.map(x => x.cid));
    const c = L.find(k => !us.has(k.id)) || L[0], libre = Object.keys(Conex.CARAS).find(k => !n.cons.some(x => x.cara === k)) || 'ala1';
    n.cons.push({ cid:c ? c.id : '', cara:libre }); renderNudo(); guardar(); renderLista2(); };
  if($('#nAjus')) $('#nAjus').onclick = () => { const k = Conex.ajustarNudo(n, nudoCons(n)); nudoCons(n).forEach(x => recalcular(x.c)); renderNudo(); guardar(); renderLista2();
    toast(k ? `Listo: se ajustaron ${k} dato${k === 1 ? '' : 's'} de las conexiones.` : 'Las conexiones ya estaban de acuerdo con el nudo.'); };
  if($('#del')) $('#del').onclick = () => { if(!confirm(`¿Eliminar el nudo ${n.nom}? Las conexiones no se borran.`)) return; S.p.datos.nudos = S.p.datos.nudos.filter(x => x !== n); S.sel = S.p.datos.con[0]?.id || null; guardar(); renderProyecto(); };
  if($('#dup')) $('#dup').onclick = () => { const m = JSON.parse(JSON.stringify(n)); m.id = Math.random().toString(36).slice(2, 10); m.nom = `N-${S.p.datos.nudos.length + 1}`;
    S.p.datos.nudos.push(m); S.sel = 'N:' + m.id; guardar(); renderProyecto(); };
}
// Repinta solo la lista (pastillas y nombres) sin perder lo que se está escribiendo
function renderLista2(){
  const n = nudoSel(); if(!n) return; const b = $(`[data-sel="N:${n.id}"]`); if(!b) return;
  b.querySelector('small').textContent = nudoCons(n).map(x => x.c.nom).join(', ') || 'sin conexiones';
  const pl = b.querySelector('.pill'); if(pl && n.res){ pl.className = `pill ${n.res.ok ? 'ok' : 'no'}`; pl.textContent = f2(n.res.max); }
}
// Dibujo en planta: la columna en el centro y cada viga en su cara; placas de continuidad en azul
function dibNudo(n, r){
  const cl = Conex.perfil(n.columna); if(!cl) return '<p class="hint">Escoja el perfil de la columna.</p>';
  const W = 380, C = 190, s = 130 / Math.max(cl.d, cl.bf), d = cl.d * s, b = cl.bf * s, tf = Math.max(2, cl.tf * s), tw = Math.max(2, cl.tw * s), Lv = 105;
  const g = r && !r.error ? r.geo : null, V = g ? g.V : nudoCons(n).map(x => ({ ...Conex.vigaDe(x.c), c:x.c, cara:x.cara }));
  let h = '';
  // placas de continuidad
  if(g && g.usar){ const ext = k => V.some(v => v.cara === k && v.mom) ? 60 * s : 0;
    h += `<rect class="pl" x="${C - d / 2 + tf}" y="${C - b / 2 - ext('alma1')}" width="${d - 2 * tf}" height="${b / 2 - tw / 2 + ext('alma1')}"/>
      <rect class="pl" x="${C - d / 2 + tf}" y="${C + tw / 2}" width="${d - 2 * tf}" height="${b / 2 - tw / 2 + ext('alma2')}"/>`; }
  // columna (eje fuerte horizontal: alas a la izquierda y derecha)
  h += `<rect class="sop" x="${C - d / 2}" y="${C - b / 2}" width="${tf}" height="${b}"/><rect class="sop" x="${C + d / 2 - tf}" y="${C - b / 2}" width="${tf}" height="${b}"/>
    <rect class="sop" x="${C - d / 2 + tf}" y="${C - tw / 2}" width="${d - 2 * tf}" height="${tw}"/>`;
  const lbl = (x, y, t, a = 'middle', cls = 'lbl') => `<text class="${cls}" x="${x}" y="${y}" text-anchor="${a}">${t}</text>`;
  const porCara = {}; V.forEach(v => (porCara[v.cara] = porCara[v.cara] || []).push(v));
  Object.entries(porCara).forEach(([cara, L]) => L.forEach((v, i) => { if(!v.vg) return;
    const bv = Math.max(8, v.vg.bf * s), cls = v.mom ? 'vg nd-m' : 'vg', o = i * 6, tx = `${esc(v.c.nom)}`, carga = v.mom ? `M ${f2(v.M, 0)} kN·m` : `V ${f2(v.V, 0)} kN`;
    if(cara === 'ala1'){ const x2 = C - d / 2 - 3; h += `<rect class="${cls}" x="${x2 - Lv}" y="${C - bv / 2 + o}" width="${Lv}" height="${bv}"/><line class="vgl" x1="${x2 - Lv}" y1="${C + o}" x2="${x2}" y2="${C + o}"/>${lbl(x2 - Lv / 2, C - bv / 2 - 6 + o, tx)}${lbl(x2 - Lv / 2, C + bv / 2 + 13 + o, carga)}`; }
    if(cara === 'ala2'){ const x1 = C + d / 2 + 3; h += `<rect class="${cls}" x="${x1}" y="${C - bv / 2 + o}" width="${Lv}" height="${bv}"/><line class="vgl" x1="${x1}" y1="${C + o}" x2="${x1 + Lv}" y2="${C + o}"/>${lbl(x1 + Lv / 2, C - bv / 2 - 6 + o, tx)}${lbl(x1 + Lv / 2, C + bv / 2 + 13 + o, carga)}`; }
    if(cara === 'alma1'){ const y2 = C - tw / 2 - 3, y1 = C - b / 2 - Lv + 20; h += `<rect class="${cls}" x="${C - bv / 2 + o}" y="${y1}" width="${bv}" height="${y2 - y1}"/><line class="vgl" x1="${C + o}" y1="${y1}" x2="${C + o}" y2="${y2}"/>${lbl(C + bv / 2 + 5 + o, y1 + 12, tx, 'start')}${lbl(C + bv / 2 + 5 + o, y1 + 25, carga, 'start')}`; }
    if(cara === 'alma2'){ const y1 = C + tw / 2 + 3, y2 = C + b / 2 + Lv - 20; h += `<rect class="${cls}" x="${C - bv / 2 + o}" y="${y1}" width="${bv}" height="${y2 - y1}"/><line class="vgl" x1="${C + o}" y1="${y1}" x2="${C + o}" y2="${y2}"/>${lbl(C + bv / 2 + 5 + o, y2 - 18, tx, 'start')}${lbl(C + bv / 2 + 5 + o, y2 - 5, carga, 'start')}`; }
  }));
  // nombres de las caras
  h += lbl(C - d / 2 - 6, C - b / 2 + 10, 'Ala 1', 'end', 'lbl nd-c') + lbl(C + d / 2 + 6, C - b / 2 + 10, 'Ala 2', 'start', 'lbl nd-c')
    + lbl(C + d / 2 + 6, C - b / 2 - 22, 'Alma, lado 1', 'start', 'lbl nd-c') + lbl(C + d / 2 + 6, C + b / 2 + 28, 'Alma, lado 2', 'start', 'lbl nd-c')
    + lbl(C - d / 2 - 6, C + b / 2 + 16, esc(cl.nom), 'end', 'lbl nd-cn');
  const nota = g && g.usar ? `Placas de continuidad (azul): ts = ${g.ts} mm, filete ${g.ws} mm` : 'Sin placas de continuidad';
  return svgW(W, W, h, `Planta del nudo ${n.nom}`, `Planta a la altura de las alas superiores · vigas a momento en amarillo · ${nota}`);
}
function datosNudoPrint(n, r){
  const t = (l, v) => `<tr><th>${l}</th><td>${v}</td></tr>`;
  return `<table class="t kv">${t('Columna', `${esc(n.columna)} · ${esc(n.aceroCol)}${n.colTope ? ' · nudo en el extremo superior' : ''}${+n.Pc ? ` · Pu = ${n.Pc} kN` : ''}${+n.Vc ? ` · Vc = ${n.Vc} kN` : ''}`)}
    ${Object.keys(Conex.CARAS).map(k => { const L = nudoCons(n).filter(x => x.cara === k); return L.length ? t(Conex.CARAS[k], L.map(x => { const v = Conex.vigaDe(x.c); return `${esc(x.c.nom)} (${esc(NOMBRES[x.c.tipo].split(' (')[0].toLowerCase())}) · ${esc(v.vg ? v.vg.nom : '')} · ${v.mom ? `M = ${f2(v.M, 1)} kN·m · ` : ''}V = ${f2(v.V, 1)} kN`; }).join('<br/>')) : ''; }).join('')}
    ${t('Sentido de los momentos', `alas: ${n.sentido === 'mismo' ? 'mismo sentido (sismo o viento)' : 'opuestos (gravedad)'} · alma: ${n.sentidoW === 'mismo' ? 'mismo sentido' : 'opuestos'}`)}
    ${t('Placas de continuidad', r.geo.usar ? `${r.geo.ts} mm ${esc(n.aceroRigC)}, filetes ${r.geo.ws} mm ${esc(n.electrodo)}, ancho por lado ${f2(r.geo.bs, 1)} mm` : 'no lleva')}</table>`;
}

// ── Dibujos (SVG a escala, con cotas) ─────────────
function armarListaMovil(){
  $$('.d-lista').forEach(L => {
    if(L.querySelector(':scope > .d-sel')) return;
    const d = document.createElement('div'); d.className = 'd-drop'; while(L.firstChild) d.appendChild(L.firstChild);
    const t = document.createElement('button'); t.type = 'button'; t.className = 'd-sel'; L.append(t, d);
    const on = d.querySelector('.d-el.on'); t.innerHTML = (on ? on.innerHTML : '<span>Conexiones…</span>') + '<i class="d-car" aria-hidden="true">▾</i>';
    t.onclick = e => { e.stopPropagation(); L.classList.toggle('abierta'); };
    d.addEventListener('click', e => { if(e.target.closest('.d-el, .gal-it')) L.classList.remove('abierta'); });
  });
}

// ── Impresión: portada + una sección por conexión ─────────────
async function imprimir(){
  const p = S.p, F = p.ficha, cf = S.cfg, pf = S.perfiles.find(x => x.id === p.perfil_id) || S.perfiles[0] || {};
  const firma = cf.firma_path ? await urlDe(cf.firma_path) : '';
  const fila = (t, v) => `<tr><th>${t}</th><td>${esc(v || '—')}</td></tr>`;
  let h = `<section class="pg-port"><div class="memb"><b>${esc(pf.l1 || pf.nombre || '')}</b><br/>${esc(pf.l2 || '')}</div>
    <h1>MEMORIA DE CÁLCULO<br/>DISEÑO DE CONEXIONES METÁLICAS</h1><div class="cons">${esc(p.consecutivo)}</div>
    <table class="pt">${fila('Proyecto', F.proyecto)}${fila('Cliente', F.prop)}${fila('Identificación', F.doc)}${fila('Ubicación', [F.dir, F.mun, F.depto].filter(Boolean).join(', '))}${fila('Fecha', fmtFecha(F.fecha))}
      ${fila('Norma', 'NSR-10 Título F.2 (AISC 360-10), método de diseño por factores de carga y resistencia (DFCR)')}</table>
    <div class="firma">${firma ? `<img src="${esc(firma)}" alt="Firma"/>` : '<span class="sinf"></span>'}<div class="nm">${esc(cf.nombre_firma || '')}<br/>${esc(cf.matricula || '')}</div></div>
    <div class="pie">${esc([pf.dir, pf.ciudad, pf.correo, pf.tel].filter(Boolean).join(' · '))}</div></section>`;
  h += `<section><h2>1. Generalidades</h2><p>Se revisan las conexiones metálicas del proyecto con el Reglamento NSR-10, Título F.2, capítulo F.2.10 (conexiones), con el método de diseño por factores de carga y resistencia. Los grupos de pernos con excentricidad se revisan con el método del centro instantáneo de rotación. Las chapas de testa extendidas se diseñan como placa gruesa (sin efecto palanca en los pernos) con el método de líneas de fluencia de las Guías de diseño AISC 4 y 16. Unidades: kN, mm, MPa.</p>
    <table class="t"><thead><tr><th>Conexión</th><th>Tipo</th><th>Descripción</th><th>Relación máx.</th><th>Estado</th></tr></thead><tbody>
    ${p.datos.con.map(c => { const r = Conex.calc(c); return `<tr><td>${esc(c.nom)}</td><td>${esc(NOMBRES[c.tipo])}</td><td>${esc(c.desc || '')}</td><td class="n">${r.error ? '—' : f2(r.max, 3)}</td><td>${r.error ? '—' : r.ok ? 'Cumple' : 'No cumple'}</td></tr>`; }).join('')}${(p.datos.nudos || []).map(n => { const r = Conex.nudo(n, nudoCons(n)); return `<tr><td>${esc(n.nom)}</td><td>Nudo de columna ${esc(n.columna)}</td><td>${esc(nudoCons(n).map(x => x.c.nom).join(', '))}${n.desc ? ' · ' + esc(n.desc) : ''}</td><td class="n">${r.error || !r.ch.length ? '—' : f2(r.max, 3)}</td><td>${r.error ? '—' : r.ok ? 'Cumple' : 'No cumple'}</td></tr>`; }).join('')}</tbody></table></section>`;
  p.datos.con.forEach((c, i) => { const r = Conex.calc(c); if(r.error) return;
    h += `<section class="cx"><h2>${i + 2}. ${esc(c.nom)} — ${esc(NOMBRES[c.tipo])}</h2>${c.desc ? `<p>${esc(c.desc)}</p>` : ''}
      <div class="cx-row"><div class="dib">${dibujo(c, r)}</div><div>${datosPrint(c)}</div></div>
      ${r.rigid ? `<h3>Rigidez y clasificación</h3>${rigHTML(r, true)}` : ''}<h3>Chequeos</h3>${chequeosHTML(r)}${r.av.length ? `<p><b>Observaciones:</b> ${r.av.map(esc).join(' ')}</p>` : ''}<h3>Requisitos de geometría y detallado</h3>${reqHTML(r)}<h3>Cálculo</h3><div class="calc">${r.pasos.map(esc).join('<br/>')}</div>
      <p><b>Conclusión:</b> ${r.ok ? `la conexión cumple; relación demanda/capacidad máxima ${f2(r.max, 3)}.` : `la conexión NO cumple (relación máxima ${f2(r.max, 3)}${r.req.some(x => !x[1]) ? ' o hay requisitos de detallado sin cumplir' : ''}).`}</p></section>`; });
  // Nudos de columna (opción C de Amo, 19-nov)
  let sec = p.datos.con.filter(c => !Conex.calc(c).error).length + 2;
  (p.datos.nudos || []).forEach(n => { const r = Conex.nudo(n, nudoCons(n)); if(r.error) return;
    h += `<section class="cx"><h2>${sec++}. Nudo ${esc(n.nom)} — columna ${esc(n.columna)}</h2>${n.desc ? `<p>${esc(n.desc)}</p>` : ''}
      <p>Conexiones que llegan a la misma columna. Cada una se diseña en su sección; aquí se revisa lo que comparten: cargas concentradas de las alas de las vigas en la columna, zona de panel, pandeo del alma por las dos alas, placas de continuidad y coherencia de los datos.</p>
      <div class="cx-row"><div class="dib">${dibNudo(n, r)}</div><div>${datosNudoPrint(n, r)}</div></div>
      <h3>Cada conexión por sí sola</h3><table class="t"><thead><tr><th>Conexión</th><th>Cara</th><th>Relación</th><th>Estado</th></tr></thead><tbody>${r.cons.map(x => `<tr><td>${esc(x.nom)}</td><td>${esc(Conex.CARAS[x.cara])}</td><td class="n">${x.max == null ? '—' : f2(x.max, 3)}</td><td>${x.max == null ? '—' : x.ok ? 'Cumple' : 'No cumple'}</td></tr>`).join('')}</tbody></table>
      ${r.ch.length ? `<h3>Chequeos en la columna</h3>${chequeosHTML(r)}` : ''}${r.av.length ? `<p><b>Observaciones:</b> ${r.av.map(esc).join(' ')}</p>` : ''}
      <h3>Coherencia y detallado</h3>${reqHTML(r)}<h3>Cálculo</h3><div class="calc">${r.pasos.map(esc).join('<br/>')}</div>
      <p><b>Conclusión:</b> ${r.ok ? `el nudo cumple${r.ch.length ? `; relación máxima ${f2(r.max, 3)}` : ''}.` : 'el nudo NO cumple: revise los chequeos, las conexiones o los datos marcados.'}</p></section>`; });
  const css = `@page{size:letter;margin:.8in .7in .9in;@top-left{content:"${esc(p.consecutivo)}";font:9pt sans-serif;color:#555}@top-right{content:"${esc((F.proyecto || '').replace(/"/g, ''))}";font:9pt sans-serif;color:#555}@bottom-right{content:counter(page) " / " counter(pages);font:9pt sans-serif;color:#555}}
    @page portada{margin:.6in;@top-left{content:none}@top-right{content:none}@bottom-right{content:none}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  $('#print-area').innerHTML = `<div class="cx-print">${h}</div>`;
  await Promise.all([...$$('#print-area img')].map(im => im.complete ? 0 : new Promise(ok => { im.onload = im.onerror = ok; })));
  setTimeout(() => { window.print(); setTimeout(() => { st.remove(); $('#print-area').innerHTML = ''; }, 800); }, 100);
}
const ICOS = { con:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
  doc:'<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>' };
const icoL = k => `<svg class="ico" viewBox="0 0 24 24">${ICOS[k]}</svg>`;
function cerrarLateral(){ $('#sbar')?.classList.remove('open'); const s = $('#sbScrim'); if(s) s.hidden = true; }
function pintarLateral(){
  const sbar = $('#sbar'), slot = $('#sbSlot'), hd = $('#hdSlot'), app = $('#app'); if(!sbar || !slot) return;
  const con = !!S.user && !app.querySelector('.login');
  document.body.classList.toggle('con-sb', con); sbar.hidden = !con; $('#sbMenu').hidden = !con;
  if(!con){ slot.innerHTML = ''; if(hd) hd.innerHTML = ''; return; }
  const u = $('#uChip'); if(u){ const em = S.user.email || '', ini = em.replace(/@.*/, '').split(/[._-]/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase() || 'U';
    u.innerHTML = `<i>${esc(ini)}</i><span><b>${esc(em.replace(/@.*/, ''))}</b><small>${esIng() ? 'Ingeniero' : 'Consulta'}</small></span>`; u.title = em; }
  const p = S.p, bar = app.querySelector('.ws-bar');
  if(hd) hd.innerHTML = p && bar ? `<div class="crumb"><a class="btn sm" href="#/">← Proyectos</a><span class="hint"><b>${esc(p.consecutivo)}</b> · ${esc(p.titulo || '')}</span></div>` : '';
  if(p && bar){ bar.classList.add('fila-mem'); const g = bar.querySelector('#gEst'); if(g) hd.querySelector('.crumb').appendChild(g); }
  const it = (href, ic, t, s, on) => `<a class="sb-it ${on ? 'on' : ''}" href="${href}"><span class="tile">${icoL(ic)}</span><span class="lbl">${t}<small>${s}</small></span></a>`;
  if(p && bar){
    const L = p.datos.con;
    slot.innerHTML = `<button type="button" class="sb-mem" id="sbMem" title="Volver a la lista de proyectos"><span class="tile">${icoL('con')}</span><span><b>${esc(p.consecutivo)}</b><small>${esc((p.titulo || '').slice(0, 40))}</small></span></button>`;
    const lista = app.querySelector('.d-lista');
    if(lista && matchMedia('(min-width:901px)').matches){ const t = document.createElement('div'); t.className = 'ph'; t.textContent = 'Conexiones del proyecto'; slot.append(t, lista); app.querySelector('.d-grid')?.classList.add('sin-lista');
      // Arriba fijo (marca, proyecto y sus conexiones), abajo fijo (resumen); en medio se desliza la galería de tipos (pedido de Amo 21-nov)
      const gz = lista.querySelector('.gal-zona'); if(gz){ slot.appendChild(gz); sbar.classList.add('sb-fija'); } }
    else sbar.classList.remove('sb-fija');
    if(L.length){ const av = document.createElement('div'); av.className = 'sb-av';
      av.innerHTML = resumenHTML(L);
      slot.appendChild(av); }
    $('#sbMem').onclick = () => ir('#/');
  } else slot.innerHTML = `<div class="ph">Conexiones</div>${it('#/', 'con', 'Proyectos de conexiones', 'Lista y buscador', true)}<div class="ph">Otras apps</div>${it('../', 'doc', 'Memorias de cálculo', 'Generador de memorias', false)}`;
  slot.querySelectorAll('a, .d-el, .gal-it').forEach(a => a.addEventListener('click', cerrarLateral));
  cerrarLateral();
}
new MutationObserver(ms => { if(ms.some(m => m.addedNodes.length)) pintarLateral(); }).observe($('#app'), { childList:true });
$('#sbMenu').onclick = () => { $('#sbar').classList.add('open'); $('#sbScrim').hidden = false; };
$('#sbScrim').onclick = cerrarLateral;
$('#btnSalir').onclick = async () => { await sb.auth.signOut(); location.hash = ''; };
if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').catch(() => {}); let r = false; navigator.serviceWorker.addEventListener('controllerchange', () => { if(!r){ r = true; location.reload(); } }); }
arrancar();
