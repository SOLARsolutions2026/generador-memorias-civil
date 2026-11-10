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
  $('#userbox').hidden = false;
}
window.addEventListener('hashchange', ruta);
function ruta(){
  if(!S.user) return;
  const m = location.hash.match(/^#\/p\/([^/]+)(?:\/c\/([^/]+))?/);
  if(m) return abrirProyecto(m[1], m[2]);
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
      <div class="nav-btns"><a class="btn" href="../">← Memorias de cálculo</a>${esIng() ? '<button class="btn pri" type="button" id="nuevo">+ Nuevo proyecto</button>' : ''}</div></div>
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
  S.sel = cid && S.p.datos.con.some(c => c.id === cid) ? cid : (S.p.datos.con[0]?.id || null);
  renderProyecto();
}
let tGuardar = null;
function guardar(){ clearTimeout(tGuardar); $('#gEst') && ($('#gEst').textContent = 'Guardando…');
  tGuardar = setTimeout(async () => { const p = S.p; if(!p) return;
    const { error } = await sb.from('con_proyectos').update({ ficha:p.ficha, datos:p.datos, titulo:(p.ficha.proyecto || '').trim() || 'Sin nombre', estado:p.estado, perfil_id:p.perfil_id }).eq('id', p.id);
    if($('#gEst')) $('#gEst').textContent = error ? '⚠ Sin guardar' : '✓ Guardado'; if(error) err(error, 'No se pudo guardar'); }, 700); }
const conSel = () => S.p.datos.con.find(c => c.id === S.sel);
const NOMBRES = { aleta:'Chapa de aleta (shear tab)', angular:'Doble angular de alma', testaV:'Chapa de testa a cortante', asiento:'Asiento con angular',
  testa:'Chapa de testa extendida (4 pernos)', ras:'Chapa de testa a ras', empalme:'Empalme de viga con cubrejuntas',
  cartela:'Diagonal a cartela', grupo:'Grupo de pernos excéntrico', base:'Placa base a momento' };
// Galería por tipo de trabajo (pedido de Amo 10-nov)
const CATS = [['A cortante (articuladas)', ['aleta', 'angular', 'testaV', 'asiento']], ['A momento (rígidas)', ['testa', 'ras', 'empalme']], ['Axiales y otras', ['cartela', 'grupo', 'base']]];
const PREF = { aleta:'CA', angular:'DA', testaV:'TV', asiento:'AS', testa:'CT', ras:'CR', empalme:'EV', cartela:'DC', grupo:'GE', base:'PB' };

function renderProyecto(){
  const p = S.p, F = p.ficha, ro = esIng() ? '' : 'disabled';
  const inp = (k, l, ph = '') => `<div class="f"><label>${l}</label><input data-fk="${k}" value="${esc(F[k] || '')}" placeholder="${esc(ph)}" ${ro}/></div>`;
  $('#app').innerHTML = `<div class="ws-bar"><a class="btn sm" href="#/">← Proyectos</a><span class="code">${esc(p.consecutivo)}</span><span class="muted" id="gEst"></span>
      <span class="sp"></span>${esIng() ? `<select id="pEst" class="est-sel est-${p.estado === 'apr' ? 'apr' : 'wip'}"><option value="wip" ${p.estado !== 'apr' ? 'selected' : ''}>En proceso</option><option value="apr" ${p.estado === 'apr' ? 'selected' : ''}>Terminado</option></select>` : ''}
      <button class="btn sm pri" type="button" id="imp">🖨 Imprimir memoria</button></div>
    <details class="card" ${F.proyecto ? '' : 'open'}><summary class="ct" style="cursor:pointer">Datos del proyecto <span class="hint" style="font-weight:400">· van a la portada</span></summary>
      <div class="fg g3">${inp('proyecto', 'Nombre del proyecto', 'Ej.: Conexiones bodega Pérez')}${inp('prop', 'Cliente / propietario')}${inp('doc', 'Identificación (NIT / C.C.)')}
        ${inp('dir', 'Dirección del predio')}${inp('mun', 'Municipio')}${inp('depto', 'Departamento')}
        <div class="f"><label>Fecha</label><input type="date" data-fk="fecha" value="${esc(F.fecha || '')}" ${ro}/></div>
        <div class="f"><label>Membrete y pie de página</label><select id="pPerfil" ${ro}>${S.perfiles.map(x => `<option value="${x.id}" ${x.id === p.perfil_id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></div></div></details>
    <div class="d-grid"><div class="d-lista">
        ${p.datos.con.map(c => { const r = c.res; return `<button type="button" class="d-el ${c.id === S.sel ? 'on' : ''}" data-sel="${c.id}"><span><b>${esc(c.nom)}</b> ${esc(NOMBRES[c.tipo].split(' (')[0])}<small>${esc(c.desc || '')}</small></span>${r ? `<span class="pill ${r.ok ? 'ok' : 'no'}">${f2(r.max)}</span>` : ''}</button>`; }).join('')}
        ${esIng() ? CATS.map(([ct, L]) => `<div class="gal-cat">${ct}</div><div class="gal">${L.map(t => `<button type="button" class="gal-it" data-nueva="${t}">${ICO[t] || ''}<span>＋ ${NOMBRES[t]}</span></button>`).join('')}</div>`).join('') : ''}
      </div><div id="ed">${S.sel ? '' : '<div class="card empty">Agregue una conexión con los botones de la izquierda.</div>'}</div></div>`;
  $$('[data-fk]').forEach(el => el.oninput = () => { F[el.dataset.fk] = el.value; guardar(); });
  if($('#pPerfil')) $('#pPerfil').onchange = e => { p.perfil_id = e.target.value; guardar(); };
  if($('#pEst')) $('#pEst').onchange = e => { p.estado = e.target.value; e.target.className = `est-sel est-${p.estado}`; guardar(); toast(p.estado === 'apr' ? 'Terminado: lo puede ver el personal de consulta.' : 'En proceso.'); };
  $$('[data-sel]').forEach(b => b.onclick = () => { S.sel = b.dataset.sel; history.replaceState(null, '', `#/p/${p.id}/c/${S.sel}`); renderProyecto(); });
  $$('[data-nueva]').forEach(b => b.onclick = () => { const t = b.dataset.nueva, c = Conex.defaults(t);
    c.id = Math.random().toString(36).slice(2, 10); c.nom = `${PREF[t]}-${p.datos.con.filter(x => x.tipo === t).length + 1}`;
    p.datos.con.push(c); S.sel = c.id; recalcular(c); guardar(); history.replaceState(null, '', `#/p/${p.id}/c/${c.id}`); renderProyecto(); });
  $('#imp').onclick = imprimir;
  armarListaMovil();
  if(S.sel) renderEditor();
}
function recalcular(c){ const r = Conex.calc(c); c.res = r.error ? null : { ok:r.ok, max:r.max }; return r; }

// ── Editor de una conexión ─────────────
function campo(c, k, l, opt = {}){
  const ro = esIng() ? '' : 'disabled';
  if(opt.sel) return `<div class="f"><label>${l}</label><select data-k="${k}" ${ro}>${opt.sel.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(c[k]) === String(v) ? 'selected' : ''}>${esc(t)}</option>`; }).join('')}</select>${opt.h ? `<div class="hint">${opt.h}</div>` : ''}</div>`;
  return `<div class="f"><label>${l}</label><input data-k="${k}" ${opt.num === false ? '' : 'inputmode="decimal" data-num="1"'} value="${esc(c[k] ?? '')}" ${ro}/>${opt.h ? `<div class="hint">${opt.h}</div>` : ''}</div>`;
}
const SEL_DIAM = Conex.DIAM.map(([t, v]) => [v, `${t} (${v} mm)`]);
const SEL_ACERO = Object.keys(Conex.ACEROS).map(k => [k, `${k} (Fy ${Conex.ACEROS[k].Fy} MPa)`]);
// Datos de la conexión por secciones (pedido de Amo 10-nov: mezcla de A y B = franja azul con número y título,
// resumen de lo escrito a la derecha, se abre y se cierra tocando la franja; varias pueden quedar abiertas).
const dnom = c => (Conex.DIAM.find(x => x[1] === +c.d) || [`${c.d} mm`])[0];
const SOPN = { ala:'Ala de columna', alma:'Alma de columna', viga:'Alma de viga principal' };
function seccionesDe(c){
  const g3 = (...x) => `<div class="fg g3">${x.join('')}</div>`;
  const pernosTipo = [campo(c, 'd', 'Diámetro', { sel:SEL_DIAM }), campo(c, 'grado', 'Grado', { sel:Object.keys(Conex.PERNOS) }), campo(c, 'rosca', 'Rosca en el plano de corte', { sel:[['N', 'Incluida (N)'], ['X', 'Excluida (X)']] })];
  if(c.tipo === 'aleta') return [
    ['viga', 'Viga apoyada', () => `${c.viga} · ${c.aceroViga} · holgura ${c.holgura} mm`,
      g3(campo(c, 'viga', 'Perfil', { sel:(window.PERFILES_LAM || []).map(x => x[0]) }), campo(c, 'aceroViga', 'Acero', { sel:SEL_ACERO }), campo(c, 'holgura', 'Holgura viga–soporte [mm]', { h:'Del extremo de la viga a la cara del soporte' }))],
    ['sop', 'Soporte', () => `${SOPN[c.soporte]} · t ${c.tSop} mm · ${c.aceroSop}`,
      g3(campo(c, 'soporte', 'Se suelda a', { sel:Object.entries(SOPN) }), campo(c, 'tSop', 'Espesor del soporte [mm]'), campo(c, 'aceroSop', 'Acero', { sel:SEL_ACERO }))
      + (c.soporte !== 'ala' ? `<div class="f"><label class="ck"><input type="checkbox" data-k="dosLados" ${c.dosLados ? 'checked' : ''} ${esIng() ? '' : 'disabled'}/> Hay otra conexión al otro lado del alma</label></div>` : '')],
    ['chapa', 'Chapa', () => `PL ${c.tp} mm · ${c.aceroPl} · a = ${c.a} mm`,
      g3(campo(c, 'tp', 'Espesor tp [mm]'), campo(c, 'aceroPl', 'Acero', { sel:SEL_ACERO }), campo(c, 'a', 'a: soporte a la línea de pernos [mm]', { h:'Convencional: a ≤ 89 mm (3½")' }))],
    ['pern', 'Pernos', () => `${c.n} × ${dnom(c)} ${c.grado}-${c.rosca} · s ${c.s} · bordes ${c.Lev}/${c.Leh}`,
      g3(...pernosTipo) + g3(campo(c, 'n', 'Número de pernos n'), campo(c, 's', 'Separación s [mm]'), '<div></div>', campo(c, 'Lev', 'Borde vertical Lev [mm]'), campo(c, 'Leh', 'Borde horizontal Leh [mm]'))],
    ['sold', 'Soldadura chapa–soporte', () => `filete ${c.w} mm ${c.electrodo} por ambas caras`,
      g3(campo(c, 'w', 'Pierna del filete w [mm]', { h:'Recomendado ≥ 5/8·tp' }), campo(c, 'electrodo', 'Electrodo', { sel:Object.keys(Conex.ELECTRODOS) }))] ];
  const SELP = (k, l, vacio) => campo(c, k, l, { sel:[...(vacio ? [['', vacio]] : []), ...(window.PERFILES_LAM || []).map(x => [x[0], x[0]])] });
  const ck = (k, t) => `<div class="f"><label class="ck"><input type="checkbox" data-k="${k}" ${c[k] ? 'checked' : ''} ${esIng() ? '' : 'disabled'}/> ${t}</label></div>`;
  const solds = () => ['sold', 'Soldaduras viga–placa', () => `alas ${c.soldAla === 'cjp' ? 'penetración completa' : `filete ${c.wAla} mm`} · alma filete ${c.wAlma} mm · ${c.electrodo}`,
      g3(campo(c, 'soldAla', 'Alas', { sel:[['filete', 'Filete por ambas caras'], ['cjp', 'Penetración completa']] }), c.soldAla === 'cjp' ? '' : campo(c, 'wAla', 'Filete de las alas w [mm]'), campo(c, 'wAlma', 'Filete del alma w [mm]', { h:'Por ambas caras' }), campo(c, 'electrodo', 'Electrodo', { sel:Object.keys(Conex.ELECTRODOS) }))];
  const colSec = () => ['col', 'Columna', () => c.columna ? `${c.columna} · ${c.aceroCol}${c.colTope ? ' · en el extremo superior' : ''}` : 'sin revisar',
      g3(SELP('columna', 'Perfil', '— No revisar la columna —'), campo(c, 'aceroCol', 'Acero', { sel:SEL_ACERO })) + ck('colTope', 'La unión está en el extremo superior de la columna (menos de d de la punta)')];
  if(c.tipo === 'ras') return [
    ['viga', 'Viga', () => `${c.viga} · ${c.aceroViga}`, g3(SELP('viga', 'Perfil'), campo(c, 'aceroViga', 'Acero', { sel:SEL_ACERO }))], colSec(),
    ['placa', 'Placa de testa', () => `PL ${c.tp} × ${c.bp} mm ${c.aceroPl}`, g3(campo(c, 'tp', 'Espesor tp [mm]'), campo(c, 'bp', 'Ancho bp [mm]', { h:'Entre bf y bf + 25 mm' }), campo(c, 'aceroPl', 'Acero', { sel:SEL_ACERO }))
      + ck('ambos', 'El momento cambia de sentido (pernos también bajo el ala inferior)')],
    ['pern', 'Pernos', () => `${c.filas} fila(s) × 2 · ${dnom(c)} ${c.grado}-${c.rosca} · g ${c.g} · pfi ${c.pfi}${+c.filas === 2 ? ` · pb ${c.pb}` : ''}`,
      g3(...pernosTipo) + g3(campo(c, 'filas', 'Filas bajo el ala en tensión', { sel:[['1', '1 fila (2 pernos)'], ['2', '2 filas (4 pernos)']] }), campo(c, 'g', 'Gramil g [mm]'), campo(c, 'pfi', 'pfi: ala a 1.ª fila [mm]'),
        +c.filas === 2 ? campo(c, 'pb', 'pb: entre filas [mm]') : '', c.ambos ? '' : campo(c, 'nbc', 'Pernos de cortante abajo'))], solds() ];
  if(c.tipo === 'testaV') return [
    ['viga', 'Viga apoyada', () => `${c.viga} · ${c.aceroViga}`, g3(SELP('viga', 'Perfil'), campo(c, 'aceroViga', 'Acero', { sel:SEL_ACERO }))],
    ['sop', 'Soporte', () => `t ${c.tSop} mm · ${c.aceroSop}`, g3(campo(c, 'tSop', 'Espesor del soporte [mm]', { h:'Ala o alma de la columna, alma de la viga' }), campo(c, 'aceroSop', 'Acero', { sel:SEL_ACERO })) + ck('dosLados', 'Hay otra conexión al otro lado (comparte los pernos)')],
    ['placa', 'Placa', () => `PL ${c.bp} × ${c.tp} mm ${c.aceroPl}`, g3(campo(c, 'tp', 'Espesor tp [mm]', { h:'Delgada para que gire: ≤ 10 mm' }), campo(c, 'bp', 'Ancho bp [mm]'), campo(c, 'aceroPl', 'Acero', { sel:SEL_ACERO }))],
    ['pern', 'Pernos', () => `2 × ${c.n} de ${dnom(c)} ${c.grado}-${c.rosca} · s ${c.s} · g ${c.g}`,
      g3(...pernosTipo) + g3(campo(c, 'n', 'Pernos por columna n'), campo(c, 's', 'Separación s [mm]'), campo(c, 'Lev', 'Borde vertical Lev [mm]'), campo(c, 'g', 'Gramil g [mm]'))],
    ['sold', 'Soldadura alma–placa', () => `filete ${c.w} mm ${c.electrodo} por ambas caras`, g3(campo(c, 'w', 'Pierna del filete w [mm]'), campo(c, 'electrodo', 'Electrodo', { sel:Object.keys(Conex.ELECTRODOS) }))] ];
  if(c.tipo === 'asiento') return [
    ['viga', 'Viga apoyada', () => `${c.viga} · ${c.aceroViga} · holgura ${c.holgura} mm`, g3(SELP('viga', 'Perfil'), campo(c, 'aceroViga', 'Acero', { sel:SEL_ACERO }), campo(c, 'holgura', 'Holgura viga–soporte [mm]'))],
    ['sop', 'Soporte', () => `t ${c.tSop} mm · ${c.aceroSop}`, g3(campo(c, 'tSop', 'Espesor del soporte [mm]'), campo(c, 'aceroSop', 'Acero', { sel:SEL_ACERO }))],
    ['ang', 'Angular de asiento', () => `L ${c.bv}×${c.bh}×${c.t} mm · largo ${c.La} mm · ${c.aceroAng}`,
      g3(campo(c, 'bv', 'Ala vertical bv [mm]'), campo(c, 'bh', 'Ala horizontal bh [mm]', { h:'Donde se apoya la viga' }), campo(c, 't', 'Espesor t [mm]'), campo(c, 'La', 'Largo del angular La [mm]', { h:'≥ ancho del ala de la viga' }), campo(c, 'aceroAng', 'Acero', { sel:SEL_ACERO }))],
    ['pern', 'Pernos al soporte', () => `${2 * c.filas} × ${dnom(c)} ${c.grado}-${c.rosca} · g ${c.g}`,
      g3(...pernosTipo) + g3(campo(c, 'filas', 'Filas (2 pernos por fila)'), campo(c, 'g', 'Gramil g [mm]'), campo(c, 'ev', 'Del talón a la fila superior [mm]'))] ];
  if(c.tipo === 'empalme') return [
    ['viga', 'Viga', () => `${c.viga} · ${c.aceroViga} · separación ${c.gap} mm`, g3(SELP('viga', 'Perfil'), campo(c, 'aceroViga', 'Acero', { sel:SEL_ACERO }), campo(c, 'gap', 'Separación entre tramos [mm]'))],
    ['alas', 'Cubrejuntas de las alas', () => `PL ${c.bpf} × ${c.tpf} mm · ${2 * c.nf} pernos por lado · s ${c.sf} · g ${c.gf}`,
      g3(campo(c, 'bpf', 'Ancho bpf [mm]'), campo(c, 'tpf', 'Espesor tpf [mm]'), campo(c, 'aceroPl', 'Acero de las platinas', { sel:SEL_ACERO }), campo(c, 'nf', 'Filas por lado (2 pernos c/u)'), campo(c, 'sf', 'Separación sf [mm]'), campo(c, 'gf', 'Gramil gf [mm]'), campo(c, 'Lef', 'Borde Lef [mm]'))],
    ['alma', 'Cubrejuntas del alma (2)', () => `PL ${c.hpw} × ${c.tpw} mm · ${c.nw} pernos por lado · s ${c.sw}`,
      g3(campo(c, 'hpw', 'Alto hpw [mm]'), campo(c, 'tpw', 'Espesor tpw [mm]'), campo(c, 'nw', 'Pernos por lado nw'), campo(c, 'sw', 'Separación sw [mm]'), campo(c, 'Lew', 'Borde vertical Lew [mm]'), campo(c, 'Lehw', 'Junta a los pernos Lehw [mm]'))],
    ['pern', 'Pernos', () => `${dnom(c)} ${c.grado}-${c.rosca}`, g3(...pernosTipo)] ];
  if(c.tipo === 'cartela') return [
    ['diag', 'Diagonal', () => `${+c.nL === 1 ? 'L' : '2L'} ${c.bL}×${c.bL}×${c.tL} mm · ${c.aceroL}`,
      g3(campo(c, 'nL', 'Angulares', { sel:[['1', '1 angular'], ['2', '2 angulares (espalda con espalda)']] }), campo(c, 'bL', 'Ala b [mm]'), campo(c, 'tL', 'Espesor t [mm]'), campo(c, 'aceroL', 'Acero', { sel:SEL_ACERO }))],
    ['pern', 'Pernos', () => `${c.n} × ${dnom(c)} ${c.grado}-${c.rosca} · s ${c.s} · Le ${c.Le} · ga ${c.ga}`,
      g3(...pernosTipo) + g3(campo(c, 'n', 'Número de pernos n'), campo(c, 's', 'Separación s [mm]'), campo(c, 'Le', 'Borde al extremo Le [mm]'), campo(c, 'ga', 'Gramil en el angular ga [mm]', { h:'Del talón a la línea de pernos' }))],
    ['cart', 'Cartela', () => `t ${c.tg} mm · ${c.aceroG} · Lcr ${c.Lcr} mm · K ${c.K}`,
      g3(campo(c, 'tg', 'Espesor tg [mm]'), campo(c, 'aceroG', 'Acero', { sel:SEL_ACERO }), '<div></div>', campo(c, 'Lcr', 'Longitud libre de pandeo [mm]', { h:'Del último perno al borde soldado' }), campo(c, 'K', 'Factor K', { h:'0.65 esquina; 1.2 si se puede desplazar' }))],
    ['sold', 'Soldadura cartela–soporte', () => `filete ${c.w} mm · L ${c.Lwg} mm · θ ${c.theta}°`,
      g3(campo(c, 'Lwg', 'Largo del cordón L [mm]'), campo(c, 'w', 'Filete w [mm]', { h:'Por ambas caras' }), campo(c, 'theta', 'θ: fuerza–cordón [°]', { h:'90° = fuerza perpendicular al cordón' }), campo(c, 'electrodo', 'Electrodo', { sel:Object.keys(Conex.ELECTRODOS) }))] ];
  if(c.tipo === 'base') return [
    ['col', 'Columna', () => c.columna, g3(SELP('columna', 'Perfil'))],
    ['placa', 'Placa base', () => `${c.N} × ${c.B} × ${c.tp} mm · ${c.aceroPlaca} · filete ${c.w} mm`,
      g3(campo(c, 'N', 'N [mm] (en el sentido del peralte)'), campo(c, 'B', 'B [mm]'), campo(c, 'tp', 'Espesor tp [mm]'), campo(c, 'aceroPlaca', 'Acero', { sel:SEL_ACERO }), campo(c, 'w', 'Soldadura columna–placa w [mm]', { h:'0 = no revisar' }), campo(c, 'electrodo', 'Electrodo', { sel:Object.keys(Conex.ELECTRODOS) }))],
    ['ped', 'Pedestal', () => `${c.Lp} × ${c.Wp} mm · alto ${c.ha} mm · f'c ${c.fc} MPa${c.fisurado ? ' · fisurado' : ''}`,
      g3(campo(c, 'Lp', 'Lado en el sentido N [mm]'), campo(c, 'Wp', 'Lado en el sentido B [mm]'), campo(c, 'ha', 'Altura [mm]'), campo(c, 'fc', "f'c [MPa]")) + ck('fisurado', 'Concreto fisurado (del lado seguro)') + ck('mortero', 'Hay mortero de nivelación bajo la placa')],
    ['anc', 'Pernos de anclaje', () => `${2 * c.nB} × ${c.perno} ${c.anclaje} · S1 ${c.S1} · S2 ${c.S2} · hef ${c.hef}`,
      g3(campo(c, 'perno', 'Diámetro', { sel:['1/2"', '5/8"', '3/4"', '7/8"', '1"', '1-1/8"', '1-1/4"'] }), campo(c, 'anclaje', 'Acero', { sel:['A36', 'F1554 Gr 36', 'F1554 Gr 55', 'F1554 Gr 105'] }), campo(c, 'nB', 'Pernos por fila', { sel:['2', '3', '4'] }),
        campo(c, 'S1', 'S1: entre filas (sentido N) [mm]'), campo(c, 'S2', 'S2: extremos de la fila (sentido B) [mm]'), campo(c, 'hef', 'Empotramiento hef [mm]'),
        campo(c, 'cabeza', 'Anclaje', { sel:[['tuerca', 'Tuerca y arandela'], ['gancho', 'Gancho']] }), campo(c, 'arandela', 'Lado de la arandela [mm]'))] ];
  if(c.tipo === 'angular') return [
    ['viga', 'Viga apoyada', () => `${c.viga} · ${c.aceroViga} · holgura ${c.holgura} mm`,
      g3(campo(c, 'viga', 'Perfil', { sel:(window.PERFILES_LAM || []).map(x => x[0]) }), campo(c, 'aceroViga', 'Acero', { sel:SEL_ACERO }), campo(c, 'holgura', 'Holgura viga–soporte [mm]', { h:'Del extremo de la viga a la cara del soporte' }))],
    ['sop', 'Soporte', () => `${SOPN[c.soporte]} · t ${c.tSop} mm · ${c.aceroSop}`,
      g3(campo(c, 'soporte', 'Se atornilla a', { sel:Object.entries(SOPN) }), campo(c, 'tSop', 'Espesor del soporte [mm]'), campo(c, 'aceroSop', 'Acero', { sel:SEL_ACERO }))
      + (c.soporte !== 'ala' ? `<div class="f"><label class="ck"><input type="checkbox" data-k="dosLados" ${c.dosLados ? 'checked' : ''} ${esIng() ? '' : 'disabled'}/> Hay otra conexión al otro lado del alma (comparte los pernos)</label></div>` : '')],
    ['ang', 'Angulares', () => `2L ${c.bAng}×${c.bAng}×${c.tAng} mm · ${c.aceroAng}`,
      g3(campo(c, 'bAng', 'Ancho de las alas b [mm]', { h:'Angular de alas iguales' }), campo(c, 'tAng', 'Espesor t [mm]'), campo(c, 'aceroAng', 'Acero', { sel:SEL_ACERO }))],
    ['pern', 'Pernos', () => `${c.n} × ${dnom(c)} ${c.grado}-${c.rosca} en el alma + ${2 * c.n} en el soporte · s ${c.s} · Lev ${c.Lev}`,
      g3(...pernosTipo) + g3(campo(c, 'n', 'Pernos por línea n'), campo(c, 's', 'Separación s [mm]'), campo(c, 'Lev', 'Borde vertical Lev [mm]'),
        campo(c, 'g1', 'g₁: talón a pernos de la viga [mm]'), campo(c, 'g2', 'g₂: talón a pernos del soporte [mm]'))] ];
  if(c.tipo === 'testa') return [
    ['viga', 'Viga', () => `${c.viga} · ${c.aceroViga}`, g3(campo(c, 'viga', 'Perfil', { sel:(window.PERFILES_LAM || []).map(x => x[0]) }), campo(c, 'aceroViga', 'Acero', { sel:SEL_ACERO }))],
    ['col', 'Columna', () => c.columna ? `${c.columna} · ${c.aceroCol}${c.colTope ? ' · en el extremo superior' : ''}` : 'sin revisar',
      g3(campo(c, 'columna', 'Perfil', { sel:[['', '— No revisar la columna —'], ...(window.PERFILES_LAM || []).map(x => [x[0], x[0]])] }), campo(c, 'aceroCol', 'Acero', { sel:SEL_ACERO }))
      + `<div class="f"><label class="ck"><input type="checkbox" data-k="colTope" ${c.colTope ? 'checked' : ''} ${esIng() ? '' : 'disabled'}/> La unión está en el extremo superior de la columna (menos de d de la punta)</label></div>`],
    ['placa', 'Placa de testa', () => `PL ${c.tp} × ${c.bp} mm ${c.aceroPl} · extensión ${c.ambos ? 'arriba y abajo' : 'solo arriba'}`,
      g3(campo(c, 'tp', 'Espesor tp [mm]'), campo(c, 'bp', 'Ancho bp [mm]', { h:'Entre bf y bf + 25 mm' }), campo(c, 'aceroPl', 'Acero', { sel:SEL_ACERO }))
      + `<div class="f"><label class="ck"><input type="checkbox" data-k="ambos" ${c.ambos ? 'checked' : ''} ${esIng() ? '' : 'disabled'}/> El momento cambia de sentido (extensión arriba y abajo, 8 pernos)</label></div>`],
    ['pern', 'Pernos', () => `${c.ambos ? 8 : 4 + (+c.nbc || 0)} × ${dnom(c)} ${c.grado}-${c.rosca} · g ${c.g} · pfo ${c.pfo} · pfi ${c.pfi} · de ${c.de}`,
      g3(...pernosTipo) + g3(campo(c, 'g', 'Gramil g [mm]', { h:'Distancia horizontal entre pernos' }), campo(c, 'pfo', 'pfo: ala a fila exterior [mm]'), campo(c, 'pfi', 'pfi: ala a fila interior [mm]'),
        campo(c, 'de', 'de: fila exterior al borde [mm]'), c.ambos ? '' : campo(c, 'nbc', 'Pernos de cortante abajo', { h:'Junto al ala en compresión' }))],
    ['sold', 'Soldaduras viga–placa', () => `alas ${c.soldAla === 'cjp' ? 'penetración completa' : `filete ${c.wAla} mm`} · alma filete ${c.wAlma} mm · ${c.electrodo}`,
      g3(campo(c, 'soldAla', 'Alas', { sel:[['filete', 'Filete por ambas caras'], ['cjp', 'Penetración completa']] }), c.soldAla === 'cjp' ? '' : campo(c, 'wAla', 'Filete de las alas w [mm]'), campo(c, 'wAlma', 'Filete del alma w [mm]', { h:'Por ambas caras' }), campo(c, 'electrodo', 'Electrodo', { sel:Object.keys(Conex.ELECTRODOS) }))] ];
  return [
    ['geo', 'Distribución de pernos', () => `${c.filas} filas × ${c.cols} columnas · s ${c.s} · g ${c.g} · bordes ${c.Lev}/${c.Leh}`,
      g3(campo(c, 'filas', 'Filas (vertical)'), campo(c, 'cols', 'Columnas (horizontal)'), '<div></div>', campo(c, 's', 'Separación vertical s [mm]'), campo(c, 'g', 'Separación horizontal g [mm]'), '<div></div>', campo(c, 'Lev', 'Borde vertical Lev [mm]'), campo(c, 'Leh', 'Borde horizontal Leh [mm]'))],
    ['pern', 'Pernos', () => `${dnom(c)} ${c.grado}-${c.rosca}`, g3(...pernosTipo)],
    ['chapa', 'Chapa y soporte', () => `PL ${c.tp} mm ${c.aceroPl} · soporte t ${c.tSop} mm ${c.aceroSop}`,
      g3(campo(c, 'tp', 'Espesor de la chapa tp [mm]'), campo(c, 'aceroPl', 'Acero de la chapa', { sel:SEL_ACERO }), '<div></div>', campo(c, 'tSop', 'Espesor del soporte [mm]', { h:'Ala de la columna u otra chapa' }), campo(c, 'aceroSop', 'Acero del soporte', { sel:SEL_ACERO }))] ];
}
const abiertas = () => { try{ return JSON.parse(localStorage.conSecc || 'null') || ['viga', 'geo', 'diag', 'col']; }catch(e){ return ['viga', 'geo', 'diag', 'col']; } };
function formHTML(c){
  const ab = abiertas();
  const carga = c.tipo === 'base'
    ? `<div class="carga-in">${campo(c, 'P', 'P [kN] (+ compresión)')}${campo(c, 'Mx', 'Mx [kN·m] (sentido N)')}${campo(c, 'My', 'My [kN·m] (sentido B)')}${campo(c, 'Vx', 'Vx [kN]')}${campo(c, 'Vy', 'Vy [kN]')}</div>`
    : c.tipo === 'cartela'
    ? `<div class="carga-in">${campo(c, 'Pu', 'Fuerza en la diagonal Pu [kN]', { h:'+ tensión, − compresión' })}</div>`
    : c.tipo === 'testa' || c.tipo === 'ras' || c.tipo === 'empalme'
    ? `<div class="carga-in">${campo(c, 'Mu', 'Momento de diseño Mu [kN·m]')}${campo(c, 'Vu', 'Cortante de diseño Vu [kN]')}<div class="hint">Fuerzas mayoradas en la cara<br/>de la columna</div></div>`
    : ['aleta', 'angular', 'testaV', 'asiento'].includes(c.tipo)
    ? `<div class="carga-in">${campo(c, 'Vu', 'Cortante de diseño Vu [kN]')}<div class="hint">Reacción mayorada de la viga<br/>(combinación de resistencia)</div></div>`
    : `<div class="carga-in">${campo(c, 'Pu', 'Carga de diseño Pu [kN]')}${campo(c, 'e', 'Excentricidad e [mm]', { h:'De la carga al centro del grupo' })}${campo(c, 'ang', 'Ángulo [°]', { h:'0° = vertical' })}</div>`;
  return carga + `<div class="sec-tools"><button type="button" class="lnk" data-secall="1">Abrir todo</button> · <button type="button" class="lnk" data-secall="0">Cerrar todo</button></div>`
    + seccionesDe(c).map(([k, t, res, body], i) => `<section class="sec ${ab.includes(k) ? 'on' : ''}" data-sec="${k}">
      <button type="button" class="sec-hd" aria-expanded="${ab.includes(k)}"><i>${i + 1}</i><b>${t}</b><small data-res="${k}">${esc(res())}</small><span class="car" aria-hidden="true">▾</span></button>
      <div class="sec-bd">${body}</div></section>`).join('');
}
const GRUPOS = { pernos:'Pernos', chapa:'Chapa', angulares:'Angulares', angular:'Angular de asiento', alas:'Empalme de las alas', almaPl:'Empalme del alma', diagonal:'Diagonal', cartela:'Cartela', concreto:'Concreto', anclajes:'Anclajes', placa:'Placa', soldadura:'Soldadura', soporte:'Soporte', viga:'Viga', columna:'Columna' };
function chequeosHTML(r){
  let h = '';
  Object.entries(GRUPOS).forEach(([g, t]) => { const L = r.ch.filter(x => x.grupo === g); if(!L.length) return;
    h += `<tr class="grp"><td colspan="5">${t}</td></tr>` + L.map(x => { const ok = x.ratio <= 1, w = Math.min(100, x.ratio * 100);
      return `<tr><td>${esc(x.nombre)}<div class="hint">${esc(x.ref)}${x.extra ? ' · ' + esc(x.extra) : ''}</div></td><td class="n">${f2(x.dem, x.ud === 'kN/mm' ? 3 : 2)} ${x.ud}</td><td class="n">${f2(x.cap, x.ud === 'kN/mm' ? 3 : 2)} ${x.ud}</td>
        <td class="n"><span class="bar-d"><i style="width:${w}%;background:${ok ? 'var(--green)' : 'var(--red)'}"></i></span> <b>${f2(x.ratio, 3)}</b></td><td><span class="pill ${ok ? 'ok' : 'no'}">${ok ? 'Cumple' : 'No cumple'}</span></td></tr>`; }).join(''); });
  return `<div class="tw"><table class="t chq"><thead><tr><th>Chequeo</th><th>Demanda</th><th>Capacidad φRn</th><th>Relación</th><th></th></tr></thead><tbody>${h}</tbody></table></div>`;
}
function reqHTML(r){
  return `<ul class="req">${r.req.map(([t, ok, v]) => `<li class="${ok ? 'ok' : 'no'}">${ok ? '✓' : '✗'} ${esc(t)} <span class="hint">${esc(v)}</span></li>`).join('')}</ul>`;
}
function renderEditor(){
  const c = conSel(); if(!c) return;
  const r = recalcular(c), ro = esIng() ? '' : 'disabled';
  $('#ed').innerHTML = `<div class="card"><div class="ct">${esc(c.nom)} · ${esc(NOMBRES[c.tipo])}
      ${esIng() ? `<span style="margin-left:auto;display:flex;gap:6px"><button class="btn sm" type="button" id="dup">⧉ Duplicar</button><button class="btn sm danger" type="button" id="del">Eliminar</button></span>` : ''}</div>
    <div class="fg g2">${campo(c, 'nom', 'Nombre', { num:false })}${campo(c, 'desc', 'Descripción / ubicación', { num:false })}</div>
    <div class="ed-grid"><div id="form">${formHTML(c)}</div><div><div class="dib" id="dib">${r.error ? '' : dibujo(c, r)}</div></div></div></div>
    <div class="card" id="res">${resHTML(c, r)}</div>`;
  const re = () => { pintaRes(); const r2 = recalcular(c); $('#dib').innerHTML = r2.error ? '' : dibujo(c, r2); $('#res').innerHTML = resHTML(c, r2);
    const it = $(`[data-sel="${c.id}"] .pill`); if(it && c.res){ it.className = `pill ${c.res.ok ? 'ok' : 'no'}`; it.textContent = f2(c.res.max); } guardar(); };
  const pintaRes = () => seccionesDe(c).forEach(([k, , res]) => { const e = $(`[data-res="${k}"]`); if(e) e.textContent = res(); });
  const guardaAb = () => { try{ localStorage.conSecc = JSON.stringify($$('#ed .sec.on').map(x => x.dataset.sec)); }catch(e){} };
  $$('#ed .sec-hd').forEach(b => b.onclick = () => { const s = b.parentElement; s.classList.toggle('on'); b.setAttribute('aria-expanded', s.classList.contains('on')); guardaAb(); });
  $$('#ed [data-secall]').forEach(b => b.onclick = () => { $$('#ed .sec').forEach(s => { s.classList.toggle('on', b.dataset.secall === '1'); $('.sec-hd', s).setAttribute('aria-expanded', b.dataset.secall === '1'); }); guardaAb(); });
  $$('#ed [data-k]').forEach(el => { const k = el.dataset.k;
    const fn = () => { if(el.type === 'checkbox') c[k] = el.checked; else if(el.dataset.num) c[k] = el.value === '' ? '' : Number(el.value.replace(',', '.')); else c[k] = el.value;
      if(['viga', 'soporte', 'soldAla', 'ambos', 'filas', 'nL'].includes(k) && c.tipo !== 'grupo'){ if(k === 'viga'){ const v = Conex.perfil(c.viga); if(v && c.soporte === 'viga'){} } renderEditor(); guardar(); return; }
      if(k === 'nom' || k === 'desc'){ const b = $(`[data-sel="${c.id}"] b`); if(b && k === 'nom') b.textContent = c.nom; guardar(); return; }
      re(); };
    el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', fn); });
  if($('#del')) $('#del').onclick = () => { if(!confirm(`¿Eliminar la conexión ${c.nom}?`)) return; S.p.datos.con = S.p.datos.con.filter(x => x.id !== c.id); S.sel = S.p.datos.con[0]?.id || null; guardar(); renderProyecto(); };
  if($('#dup')) $('#dup').onclick = () => { const n = JSON.parse(JSON.stringify(c)); n.id = Math.random().toString(36).slice(2, 10); n.nom = `${PREF[c.tipo]}-${S.p.datos.con.filter(x => x.tipo === c.tipo).length + 1}`;
    S.p.datos.con.splice(S.p.datos.con.indexOf(c) + 1, 0, n); S.sel = n.id; guardar(); renderProyecto(); };
}
function resHTML(c, r){
  if(r.error) return `<div class="note">${esc(r.error)}</div>`;
  return `<div class="ct">Resultado <span class="pill ${r.ok ? 'ok' : 'no'}" style="margin-left:8px">${r.ok ? 'Cumple' : 'No cumple'} · relación máx. ${f2(r.max, 3)}</span></div>
    ${r.av.length ? `<div class="note amber">${r.av.map(esc).join('<br/>')}</div>` : ''}
    ${chequeosHTML(r)}
    <details style="margin-top:8px"><summary><b>Requisitos de geometría y detallado</b> (${r.req.filter(x => x[1]).length}/${r.req.length})</summary>${reqHTML(r)}</details>
    <details style="margin-top:6px"><summary><b>Ver cálculo detallado</b></summary><div class="calc">${r.pasos.map(esc).join('<br/>')}</div></details>`;
}

// ── Dibujos (SVG a escala, con cotas) ─────────────
const ICO_ALETA = '<svg viewBox="0 0 60 40" aria-hidden="true"><rect x="4" y="2" width="8" height="36" fill="#cbd5e1"/><rect x="12" y="10" width="20" height="20" fill="#93c5fd" stroke="#1e3a8a"/><rect x="18" y="6" width="40" height="28" fill="none" stroke="#475569"/><circle cx="25" cy="14" r="2.2" fill="#1e3a8a"/><circle cx="25" cy="20" r="2.2" fill="#1e3a8a"/><circle cx="25" cy="26" r="2.2" fill="#1e3a8a"/></svg>';
const ICO_GRUPO = '<svg viewBox="0 0 60 40" aria-hidden="true"><rect x="4" y="4" width="26" height="32" fill="#93c5fd" stroke="#1e3a8a"/>' + [10, 20, 30].map(y => `<circle cx="12" cy="${y}" r="2.2" fill="#1e3a8a"/><circle cx="22" cy="${y}" r="2.2" fill="#1e3a8a"/>`).join('') + '<line x1="50" y1="6" x2="50" y2="32" stroke="#ea580c" stroke-width="2.5"/><path d="M46 28 L50 35 L54 28" fill="#ea580c"/></svg>';
function cotaV(x, y1, y2, t, lado = -1){ const xx = x + lado * 0; return `<g class="cota"><line x1="${xx}" y1="${y1}" x2="${xx}" y2="${y2}"/><line x1="${xx - 4}" y1="${y1}" x2="${xx + 4}" y2="${y1}"/><line x1="${xx - 4}" y1="${y2}" x2="${xx + 4}" y2="${y2}"/><text x="${xx + lado * 6}" y="${(y1 + y2) / 2}" text-anchor="${lado < 0 ? 'end' : 'start'}" dominant-baseline="middle">${t}</text></g>`; }
function cotaH(y, x1, x2, t, lado = 1){ return `<g class="cota"><line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/><line x1="${x1}" y1="${y - 4}" x2="${x1}" y2="${y + 4}"/><line x1="${x2}" y1="${y - 4}" x2="${x2}" y2="${y + 4}"/><text x="${(x1 + x2) / 2}" y="${y + lado * 11}" text-anchor="middle">${t}</text></g>`; }
function dibujo(c, r){ return ({ grupo:dibGrupo, testa:dibTesta, ras:dibTesta, angular:dibAngular, testaV:dibTestaV, asiento:dibAsiento, empalme:dibEmpalme, cartela:dibCartela, base:dibBase }[c.tipo] || dibAleta)(c, r); }
const ICO_ANG = '<svg viewBox="0 0 60 40" aria-hidden="true"><rect x="4" y="1" width="8" height="38" fill="#cbd5e1"/><rect x="18" y="6" width="40" height="28" fill="#f1f5f9" stroke="#94a3b8"/><rect x="12" y="9" width="18" height="22" fill="#93c5fd" stroke="#1e3a8a"/><rect x="12" y="9" width="3" height="22" fill="#1e3a8a"/><circle cx="23" cy="14" r="2" fill="#fff" stroke="#1e3a8a"/><circle cx="23" cy="20" r="2" fill="#fff" stroke="#1e3a8a"/><circle cx="23" cy="26" r="2" fill="#fff" stroke="#1e3a8a"/></svg>';
function dibAngular(c, r){
  const g = r.geo, vg = g.vg, n = +c.n, s = +c.s, Lev = +c.Lev, b = +c.bAng, t = +c.tAng, g1 = +c.g1, g2 = +c.g2, hol = +c.holgura || 0, ts = +c.tSop || 10;
  const k = Math.min(230 / (b + 170), 300 / (vg.d + 40)), X = v => 92 + v * k, Y = v => 50 + v * k, yb = (vg.d - g.L) / 2;
  let h = `<rect x="${X(-ts)}" y="${Y(-12)}" width="${ts * k}" height="${(vg.d + 24) * k}" class="sop"/>
    <rect x="${X(hol)}" y="${Y(0)}" width="${(b + 150 - hol) * k}" height="${vg.d * k}" class="vg"/>
    <line x1="${X(hol)}" y1="${Y(vg.tf)}" x2="${X(b + 150)}" y2="${Y(vg.tf)}" class="vgl"/><line x1="${X(hol)}" y1="${Y(vg.d - vg.tf)}" x2="${X(b + 150)}" y2="${Y(vg.d - vg.tf)}" class="vgl"/>
    <rect x="${X(0)}" y="${Y(yb)}" width="${b * k}" height="${g.L * k}" class="pl"/><rect x="${X(0)}" y="${Y(yb)}" width="${t * k}" height="${g.L * k}" fill="#1e3a8a"/>`;
  for(let i = 0; i < n; i++){ const y = Y(yb + Lev + i * s);
    h += `<circle cx="${X(g1)}" cy="${y}" r="${Math.max(3, g.dh / 2 * k)}" class="bolt"/><line x1="${X(-ts - 6)}" y1="${y}" x2="${X(t + 6)}" y2="${y}" class="bl"/>`; }
  h += cotaV(X(-ts - 16), Y(yb), Y(yb + g.L), `L ${f2(g.L, 0)}`) + (n > 1 ? cotaV(X(b + 12), Y(yb + Lev), Y(yb + Lev + s), `s = ${s}`, 1) : '')
    + cotaV(X(b + 12), Y(yb + g.L - Lev), Y(yb + g.L), `Lev = ${Lev}`, 1) + cotaH(Y(vg.d) + 16, X(0), X(g1), `g₁ = ${g1}`)
    + `<text x="${X(b + 100)}" y="${Y(vg.d / 2)}" class="lbl" text-anchor="middle">${esc(vg.nom)}</text><text x="${X(b / 2)}" y="${Y(yb) - 5}" class="lbl" text-anchor="middle">2L ${b}×${t}</text>`;
  // planta (vista superior), a la derecha
  const k2 = Math.min(1.1, 175 / (b * 2 + vg.tw)), ox = X(b + 170), cy = Y(vg.d / 2), P = (x, y) => `${ox + x * k2},${cy + y * k2}`;
  const tw = vg.tw, L1 = (sg) => `M${P(0, sg * tw / 2)} L${P(b, sg * tw / 2)} L${P(b, sg * (tw / 2 + t))} L${P(t, sg * (tw / 2 + t))} L${P(t, sg * (tw / 2 + b))} L${P(0, sg * (tw / 2 + b))} Z`;
  h += `<rect x="${ox - ts * k2}" y="${cy - (b + tw / 2 + 25) * k2}" width="${ts * k2}" height="${(2 * b + tw + 50) * k2}" class="sop"/>
    <rect x="${ox + hol * k2}" y="${cy - tw / 2 * k2}" width="${(b + 60 - hol) * k2}" height="${tw * k2}" fill="#94a3b8"/>
    <path d="${L1(1)}" class="pl"/><path d="${L1(-1)}" class="pl"/>
    <line x1="${ox + g1 * k2}" y1="${cy - (tw / 2 + t + 6) * k2}" x2="${ox + g1 * k2}" y2="${cy + (tw / 2 + t + 6) * k2}" class="bl"/>
    ${[-1, 1].map(sg => `<line x1="${ox - (ts + 6) * k2}" y1="${cy + sg * (tw / 2 + g2) * k2}" x2="${ox + (t + 6) * k2}" y2="${cy + sg * (tw / 2 + g2) * k2}" class="bl"/>`).join('')}
    <text x="${ox + b * k2 / 2}" y="${cy - (b + tw / 2 + 30) * k2}" class="lbl" text-anchor="middle">planta</text>`;
  return `<svg viewBox="0 0 ${ox + (b + 70) * k2} ${Y(vg.d) + 40}" class="dsvg" role="img" aria-label="Doble angular: elevación y planta">${h}</svg>
    <div class="hint" style="text-align:center">Izquierda: elevación · Derecha: planta · gramil en el soporte = 2g₂ + tw = ${f2(g.gage, 1)} mm</div>`;
}
const ICO_TESTA = '<svg viewBox="0 0 60 40" aria-hidden="true"><rect x="4" y="1" width="7" height="38" fill="#cbd5e1"/><rect x="11" y="3" width="5" height="34" fill="#93c5fd" stroke="#1e3a8a"/><rect x="16" y="9" width="42" height="3" fill="#475569"/><rect x="16" y="28" width="42" height="3" fill="#475569"/><rect x="16" y="12" width="42" height="16" fill="#f1f5f9" stroke="#94a3b8"/><line x1="2" y1="6" x2="20" y2="6" stroke="#1e3a8a" stroke-width="2"/><line x1="2" y1="15" x2="20" y2="15" stroke="#1e3a8a" stroke-width="2"/><line x1="2" y1="25" x2="20" y2="25" stroke="#1e3a8a" stroke-width="2"/><line x1="2" y1="34" x2="20" y2="34" stroke="#1e3a8a" stroke-width="2"/></svg>';

// ── Íconos de la galería ──
const ICO_TV = '<svg viewBox="0 0 60 40" aria-hidden="true"><rect x="4" y="1" width="7" height="38" fill="#cbd5e1"/><rect x="11" y="8" width="4" height="24" fill="#93c5fd" stroke="#1e3a8a"/><rect x="15" y="4" width="43" height="32" fill="#f1f5f9" stroke="#94a3b8"/>' + [12, 20, 28].map(y => `<line x1="2" y1="${y}" x2="18" y2="${y}" stroke="#1e3a8a" stroke-width="2"/>`).join('') + '</svg>';
const ICO_AS = '<svg viewBox="0 0 60 40" aria-hidden="true"><rect x="4" y="1" width="7" height="38" fill="#cbd5e1"/><path d="M11 22 h20 v4 h-16 v12 h-4z" fill="#93c5fd" stroke="#1e3a8a"/><rect x="14" y="4" width="44" height="18" fill="#f1f5f9" stroke="#94a3b8"/><line x1="2" y1="31" x2="17" y2="31" stroke="#1e3a8a" stroke-width="2"/></svg>';
const ICO_EMP = '<svg viewBox="0 0 60 40" aria-hidden="true"><rect x="2" y="8" width="27" height="24" fill="#f1f5f9" stroke="#94a3b8"/><rect x="31" y="8" width="27" height="24" fill="#f1f5f9" stroke="#94a3b8"/><rect x="14" y="5" width="32" height="3" fill="#93c5fd" stroke="#1e3a8a"/><rect x="14" y="32" width="32" height="3" fill="#93c5fd" stroke="#1e3a8a"/><rect x="20" y="13" width="20" height="14" fill="#93c5fd" stroke="#1e3a8a"/></svg>';
const ICO_CAR = '<svg viewBox="0 0 60 40" aria-hidden="true"><rect x="2" y="34" width="56" height="5" fill="#cbd5e1"/><path d="M10 34 L10 20 L30 6 L46 20 L46 34 Z" fill="#93c5fd" stroke="#1e3a8a"/><line x1="18" y1="28" x2="56" y2="2" stroke="#475569" stroke-width="5"/><circle cx="26" cy="22.5" r="1.8" fill="#fff"/><circle cx="33" cy="17.7" r="1.8" fill="#fff"/></svg>';
const ICO_BASE = '<svg viewBox="0 0 60 40" aria-hidden="true"><rect x="8" y="28" width="44" height="11" fill="#e5e7eb" stroke="#94a3b8"/><rect x="12" y="24" width="36" height="4" fill="#93c5fd" stroke="#1e3a8a"/><rect x="22" y="2" width="16" height="22" fill="#f1f5f9" stroke="#475569"/><line x1="16" y1="20" x2="16" y2="38" stroke="#1e3a8a" stroke-width="2"/><line x1="44" y1="20" x2="44" y2="38" stroke="#1e3a8a" stroke-width="2"/></svg>';
const ICO = { aleta:ICO_ALETA, angular:ICO_ANG, testaV:ICO_TV, asiento:ICO_AS, testa:ICO_TESTA, ras:ICO_TESTA, empalme:ICO_EMP, cartela:ICO_CAR, grupo:ICO_GRUPO, base:ICO_BASE };
const svgW = (w, h, body, label, nota) => `<svg viewBox="0 0 ${w} ${h}" class="dsvg" role="img" aria-label="${label}">${body}</svg><div class="hint" style="text-align:center">${nota}</div>`;
function dibTestaV(c, r){
  const vg = r.geo.vg, n = +c.n, s = +c.s, Lev = +c.Lev, tp = +c.tp, bp = +c.bp, gg = +c.g, Lp = r.geo.Lp, ts = +c.tSop || 10;
  const k = 300 / (vg.d + 60), X = v => 60 + v * k, Y = v => 30 + v * k, yb = (vg.d - Lp) / 2, rows = Array.from({ length:n }, (_, i) => yb + Lev + i * s);
  let h = `<rect x="${X(-ts)}" y="${Y(-15)}" width="${ts * k}" height="${(vg.d + 30) * k}" class="sop"/><rect x="${X(0)}" y="${Y(yb)}" width="${tp * k}" height="${Lp * k}" class="pl"/>
    <rect x="${X(tp)}" y="${Y(0)}" width="${200 * k}" height="${vg.d * k}" class="vg"/><line x1="${X(tp)}" y1="${Y(vg.tf)}" x2="${X(tp + 200)}" y2="${Y(vg.tf)}" class="vgl"/><line x1="${X(tp)}" y1="${Y(vg.d - vg.tf)}" x2="${X(tp + 200)}" y2="${Y(vg.d - vg.tf)}" class="vgl"/>`;
  rows.forEach(y => h += `<line x1="${X(-ts - 6)}" y1="${Y(y)}" x2="${X(tp + 6)}" y2="${Y(y)}" class="bl"/>`);
  h += cotaV(X(-ts) - 10, Y(yb), Y(yb + Lp), `Lp ${f2(Lp, 0)}`) + `<text x="${X(tp + 100)}" y="${Y(vg.d / 2)}" class="lbl" text-anchor="middle">${esc(vg.nom)}</text>`;
  const ox = X(tp + 240), P = v => ox + (v + bp / 2) * k;
  h += `<rect x="${P(-bp / 2)}" y="${Y(yb)}" width="${bp * k}" height="${Lp * k}" class="pl"/><rect x="${P(-vg.tw / 2)}" y="${Y(-15)}" width="${vg.tw * k}" height="${(vg.d + 30) * k}" fill="none" stroke="#475569" stroke-dasharray="3 2"/>`;
  rows.forEach(y => [-1, 1].forEach(sg => h += `<circle cx="${P(sg * gg / 2)}" cy="${Y(y)}" r="${Math.max(3, r.geo.dh / 2 * k)}" class="bolt"/>`));
  h += cotaH(Y(yb + Lp) + 14, P(-gg / 2), P(gg / 2), `g = ${gg}`) + (n > 1 ? cotaV(P(bp / 2) + 10, Y(rows[0]), Y(rows[1]), `s ${s}`, 1) : '');
  return svgW(P(bp / 2) + 50, Y(vg.d + 15) + 30, h, 'Chapa de testa a cortante', 'Izquierda: vista lateral · Derecha: frente de la placa (alma en punteado)');
}
function dibAsiento(c, r){
  const vg = r.geo.vg, bv = +c.bv, bh = +c.bh, t = +c.t, hol = +c.holgura || 0, ts = +c.tSop || 10;
  const k = 420 / (vg.d + bv + 40), X = v => 70 + v * k, Y = v => 34 + v * k;
  let h = `<rect x="${X(-ts)}" y="${Y(-20)}" width="${ts * k}" height="${(vg.d + bv + 40) * k}" class="sop"/>
    <path d="M${X(0)} ${Y(vg.d)} h${bh * k} v${t * k} h${-(bh - t) * k} v${(bv - t) * k} h${-t * k} z" class="pl"/>
    <rect x="${X(hol)}" y="${Y(0)}" width="${380 * k}" height="${vg.d * k}" class="vg"/><line x1="${X(hol)}" y1="${Y(vg.tf)}" x2="${X(hol + 380)}" y2="${Y(vg.tf)}" class="vgl"/><line x1="${X(hol)}" y1="${Y(vg.d - vg.tf)}" x2="${X(hol + 380)}" y2="${Y(vg.d - vg.tf)}" class="vgl"/>`;
  for(let i = 0; i < +c.filas; i++){ const y = vg.d + +c.ev + i * 70; h += `<line x1="${X(-ts - 6)}" y1="${Y(y)}" x2="${X(t + 6)}" y2="${Y(y)}" class="bl"/>`; }
  const xN = hol + r.geo.N / 2;
  h += `<g class="carga"><line x1="${X(xN)}" y1="${Y(-45)}" x2="${X(xN)}" y2="${Y(-8)}"/><path d="M${X(xN) - 5} ${Y(-14)} L${X(xN)} ${Y(-4)} L${X(xN) + 5} ${Y(-14)} Z"/></g>
    ${cotaH(Y(vg.d + bv) + 14, X(0), X(bh), `bh = ${bh}`)}${cotaV(X(-ts) - 10, Y(vg.d), Y(vg.d + bv), `bv ${bv}`)}${cotaH(Y(vg.d) - 10, X(hol), X(bh), `N = ${f2(r.geo.N, 0)}`, -1)}
    <text x="${X(hol + 190)}" y="${Y(vg.d / 2)}" class="lbl" text-anchor="middle">${esc(vg.nom)}</text>`;
  return svgW(X(hol + 380) + 20, Y(vg.d + bv) + 34, h, 'Asiento con angular', `Elevación · la flecha marca Vu = ${f2(+c.Vu, 1)} kN`);
}
function dibEmpalme(c, r){
  const vg = r.geo.vg, gap = +c.gap || 0, nf = +c.nf, sf = +c.sf, Lef = +c.Lef, tpf = +c.tpf, nw = +c.nw, sw = +c.sw, hpw = +c.hpw, Lew = +c.Lew, Lehw = +c.Lehw;
  const Lpf = 2 * (Lef + (nf - 1) * sf) + gap, Lpw = 2 * (Lehw + Lew) + gap, Wt = Math.max(Lpf, Lpw) + 160, k = Math.min(400 / Wt, 280 / (vg.d + 40));
  const X = v => 20 + (v + Wt / 2) * k, Y = v => 30 + v * k;
  let h = `<rect x="${X(-Wt / 2 + 10)}" y="${Y(0)}" width="${(Wt / 2 - 10 - gap / 2) * k}" height="${vg.d * k}" class="vg"/><rect x="${X(gap / 2)}" y="${Y(0)}" width="${(Wt / 2 - 10 - gap / 2) * k}" height="${vg.d * k}" class="vg"/>
    <rect x="${X(-Lpf / 2)}" y="${Y(-tpf)}" width="${Lpf * k}" height="${tpf * k}" class="pl"/><rect x="${X(-Lpf / 2)}" y="${Y(vg.d)}" width="${Lpf * k}" height="${tpf * k}" class="pl"/>
    <rect x="${X(-Lpw / 2)}" y="${Y((vg.d - hpw) / 2)}" width="${Lpw * k}" height="${hpw * k}" class="pl"/>`;
  for(const sg of [-1, 1]) for(let i = 0; i < nf; i++){ const x = sg * (gap / 2 + Lef + i * sf);
    h += `<line x1="${X(x)}" y1="${Y(-tpf - 6)}" x2="${X(x)}" y2="${Y(vg.tf + 6)}" class="bl"/><line x1="${X(x)}" y1="${Y(vg.d - vg.tf - 6)}" x2="${X(x)}" y2="${Y(vg.d + tpf + 6)}" class="bl"/>`; }
  for(const sg of [-1, 1]) for(let i = 0; i < nw; i++) h += `<circle cx="${X(sg * (gap / 2 + Lehw))}" cy="${Y((vg.d - hpw) / 2 + Lew + i * sw)}" r="${Math.max(3, r.geo.dh / 2 * k)}" class="bolt"/>`;
  h += cotaH(Y(vg.d + tpf) + 16, X(-Lpf / 2), X(Lpf / 2), `cubrejunta del ala ${f2(Lpf, 0)}`) + `<text x="${X(-Wt / 4)}" y="${Y(vg.d / 2) + 3}" class="lbl" text-anchor="middle">${esc(vg.nom)}</text>`;
  return svgW(X(Wt / 2) + 10, Y(vg.d + tpf) + 34, h, 'Empalme de viga', 'Elevación · las líneas azules de las alas son pernos vistos de lado');
}
function dibCartela(c, r){
  const n = +c.n, s = +c.s, Le = +c.Le, th = (+c.theta || 45) * Math.PI / 180, Lwg = +c.Lwg, l = (n - 1) * s;
  const ux = Math.cos(th), uy = Math.sin(th), x0 = Lwg / 2 - (l + Le + 40) * ux * 0.35, y0 = 40, pts = Array.from({ length:n }, (_, i) => [x0 + (40 + i * s) * ux, y0 + (40 + i * s) * uy]);
  const yMax = y0 + (40 + l + Le + 120) * uy + 10, k = 380 / Math.max(Lwg + 80, yMax + 40), X = v => 30 + v * k, Y = v => 20 + (yMax - v) * k;
  const end = pts[n - 1], top = [end[0] + Le * ux, end[1] + Le * uy];
  const wx = Math.tan(Math.PI / 6) * l, nx = -uy, ny = ux;
  let h = `<rect x="${X(-20)}" y="${Y(0)}" width="${(Lwg + 60) * k}" height="${14}" class="sop"/>
    <path d="M${X(0)} ${Y(0)} L${X(0)} ${Y(30)} L${X(top[0] - 50)} ${Y(top[1] + 20)} L${X(top[0] + 30)} ${Y(top[1] + 20)} L${X(Lwg)} ${Y(40)} L${X(Lwg)} ${Y(0)} Z" class="pl"/>
    <line x1="${X(pts[0][0] - 60 * ux)}" y1="${Y(pts[0][1] - 60 * uy)}" x2="${X(top[0] + 120 * ux)}" y2="${Y(top[1] + 120 * uy)}" stroke="#475569" stroke-width="${Math.max(6, +c.bL * k * 0.5)}" opacity=".55"/>
    <path d="M${X(pts[0][0])} ${Y(pts[0][1])} L${X(end[0] + wx * nx)} ${Y(end[1] + wx * ny)} M${X(pts[0][0])} ${Y(pts[0][1])} L${X(end[0] - wx * nx)} ${Y(end[1] - wx * ny)} M${X(end[0] + wx * nx)} ${Y(end[1] + wx * ny)} L${X(end[0] - wx * nx)} ${Y(end[1] - wx * ny)}" fill="none" stroke="#7c3aed" stroke-dasharray="4 3"/>`;
  pts.forEach(([x, y]) => h += `<circle cx="${X(x)}" cy="${Y(y)}" r="${Math.max(3, r.geo.dh / 2 * k)}" class="bolt"/>`);
  h += `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(Lwg)}" y2="${Y(0)}" class="wl"/>${cotaH(Y(0) + 26, X(0), X(Lwg), `soldadura L = ${Lwg}`)}
    <text x="${X(end[0] + wx * nx) + 4}" y="${Y(end[1] + wx * ny)}" class="lbl" style="fill:#7c3aed">Whitmore ${f2(r.geo.Lw, 0)}</text>`;
  return svgW(X(Lwg + 60) + 30, Y(0) + 44, h, 'Diagonal a cartela', `θ = ${c.theta}° · Pu = ${f2(+c.Pu, 1)} kN · línea morada = ancho de Whitmore a 30°`);
}
function dibBase(c, r){
  const cl = r.geo.cl, N = +c.N, B = +c.B, Lp = +c.Lp, Wp = +c.Wp, S1 = +c.S1, S2 = +c.S2, nB = +c.nB;
  const k = 300 / Math.max(Lp, Wp), X = v => 30 + (v + Lp / 2) * k, Y = v => 30 + (v + Wp / 2) * k;
  let h = `<rect x="${X(-Lp / 2)}" y="${Y(-Wp / 2)}" width="${Lp * k}" height="${Wp * k}" fill="#e5e7eb" stroke="#94a3b8"/><rect x="${X(-N / 2)}" y="${Y(-B / 2)}" width="${N * k}" height="${B * k}" class="pl"/>
    <path d="M${X(-cl.d / 2)} ${Y(-cl.bf / 2)} h${cl.tf * k} v${(cl.bf - cl.tw) / 2 * k} h${(cl.d - 2 * cl.tf) * k} v${-(cl.bf - cl.tw) / 2 * k} h${cl.tf * k} v${cl.bf * k} h${-cl.tf * k} v${-(cl.bf - cl.tw) / 2 * k} h${-(cl.d - 2 * cl.tf) * k} v${(cl.bf - cl.tw) / 2 * k} h${-cl.tf * k} z" fill="#f1f5f9" stroke="#475569"/>`;
  for(const sx of [-1, 1]) for(let j = 0; j < nB; j++){ const y = nB > 1 ? -S2 / 2 + j * S2 / (nB - 1) : 0; h += `<circle cx="${X(sx * S1 / 2)}" cy="${Y(y)}" r="${Math.max(3, 12 * k)}" class="bolt"/>`; }
  h += cotaH(Y(Wp / 2) + 14, X(-N / 2), X(N / 2), `N = ${N}`) + cotaV(X(Lp / 2) + 12, Y(-B / 2), Y(B / 2), `B = ${B}`, 1) + cotaH(Y(-Wp / 2) - 10, X(-S1 / 2), X(S1 / 2), `S1 = ${S1}`, -1)
    + `<text x="${X(-Lp / 2) + 4}" y="${Y(-Wp / 2) + 12}" class="lbl">pedestal ${Lp} × ${Wp}</text>`;
  return svgW(X(Lp / 2) + 70, Y(Wp / 2) + 36, h, 'Placa base: planta', `Planta · columna ${esc(cl.nom)} · el sentido N es el del peralte`);
}
function dibTesta(c, r){
  const g = r.geo, vg = g.vg, cl = g.cl, db = vg.d, tf = vg.tf, pfo = +c.pfo, pfi = +c.pfi, de = +c.de, tp = +c.tp, bp = +c.bp, gg = +c.g;
  const ras = c.tipo === 'ras', pb = +c.pb || 0, f2r = +c.filas === 2;
  const top = ras ? -25 : -(pfo + de), bot = ras ? db + 25 : c.ambos ? db + pfo + de : db + 25, Hp = bot - top, k = 300 / (Hp + 60);
  const tcf = cl ? cl.tf : 12, dc = cl ? cl.d : 200, bfc = cl ? cl.bf : bp + 20;
  // vista lateral
  const X = v => 70 + (v + dc) * k, Y = v => 40 + (v - top) * k;
  const filas = ras ? [tf + pfi].concat(f2r ? [tf + pfi + pb] : []).concat(c.ambos ? [db - tf - pfi].concat(f2r ? [db - tf - pfi - pb] : []) : [])
    : [-pfo, tf + pfi].concat(c.ambos ? [db - tf - pfi, db + pfo] : []);
  let h = `<rect x="${X(-dc)}" y="${Y(top - 25)}" width="${(dc - tcf) * k}" height="${(Hp + 50) * k}" class="vg"/><rect x="${X(-tcf)}" y="${Y(top - 25)}" width="${tcf * k}" height="${(Hp + 50) * k}" class="sop"/>
    <rect x="${X(-dc)}" y="${Y(top - 25)}" width="${tcf * k}" height="${(Hp + 50) * k}" class="sop"/>
    <rect x="${X(0)}" y="${Y(top)}" width="${tp * k}" height="${Hp * k}" class="pl"/>
    <rect x="${X(tp)}" y="${Y(0)}" width="${260 * k}" height="${db * k}" class="vg"/>
    <rect x="${X(tp)}" y="${Y(0)}" width="${260 * k}" height="${tf * k}" fill="#475569"/><rect x="${X(tp)}" y="${Y(db - tf)}" width="${260 * k}" height="${tf * k}" fill="#475569"/>`;
  filas.forEach(y => h += `<line x1="${X(-tcf - 6)}" y1="${Y(y)}" x2="${X(tp + 6)}" y2="${Y(y)}" class="bl"/>`);
  h += (ras ? (f2r ? cotaV(X(-dc) - 8, Y(tf + pfi), Y(tf + pfi + pb), `pb ${pb}`) : '') : cotaV(X(-dc) - 8, Y(top), Y(-pfo), `de ${de}`) + cotaV(X(-dc) - 8, Y(-pfo), Y(0), `pfo ${pfo}`)) + cotaV(X(-dc) - 8, Y(tf), Y(tf + pfi), `pfi ${pfi}`)
    + `<text x="${X(tp + 110)}" y="${Y(db / 2) + 3}" class="lbl" text-anchor="middle">${esc(vg.nom)}</text><text x="${X(-dc / 2)}" y="${Y(bot + 25) + 12}" class="lbl" text-anchor="middle">${cl ? esc(cl.nom) : 'columna'}</text>
    <text x="${X(tp / 2)}" y="${Y(top) - 5}" class="lbl" text-anchor="middle">PL ${tp}</text>
    <g class="mom"><path d="M${X(tp + 215)} ${Y(-10)} A ${(db + 30) * k * 0.62} ${(db + 30) * k * 0.62} 0 0 1 ${X(tp + 215)} ${Y(db + 10)}"/><path class="pt" d="M${X(tp + 215) + 7} ${Y(db + 10) - 7} L${X(tp + 215)} ${Y(db + 10)} L${X(tp + 215) + 9} ${Y(db + 10) + 3} Z"/></g>
    <text x="${X(tp + 215)}" y="${Y(-10) - 4}" class="lbl" text-anchor="middle" style="fill:#7c3aed">Mu = ${f2(+c.Mu, 1)}</text>`;
  // vista de la placa (frente)
  const ox = X(tp + 290), k2 = k, PX = v => ox + 20 + (v + bp / 2) * k2;
  h += `<rect x="${PX(-bp / 2)}" y="${Y(top)}" width="${bp * k2}" height="${Hp * k2}" class="pl"/>
    <path d="M${PX(-vg.bf / 2)} ${Y(0)} h${vg.bf * k2} v${tf * k2} h${-(vg.bf - vg.tw) / 2 * k2} v${(db - 2 * tf) * k2} h${(vg.bf - vg.tw) / 2 * k2} v${tf * k2} h${-vg.bf * k2} v${-tf * k2} h${(vg.bf - vg.tw) / 2 * k2} v${-(db - 2 * tf) * k2} h${-(vg.bf - vg.tw) / 2 * k2} z" fill="none" stroke="#475569" stroke-dasharray="3 2"/>`;
  filas.forEach(y => [-1, 1].forEach(sg => h += `<circle cx="${PX(sg * gg / 2)}" cy="${Y(y)}" r="${Math.max(3, g.dh / 2 * k2)}" class="bolt"/>`));
  h += cotaH(Y(bot) + 14, PX(-gg / 2), PX(gg / 2), `g = ${gg}`) + cotaH(Y(top) - 10, PX(-bp / 2), PX(bp / 2), `bp = ${bp}`, -1);
  return `<svg viewBox="0 0 ${PX(bp / 2) + 20} ${Y(bot + 25) + 26}" class="dsvg" role="img" aria-label="Chapa de testa: vista lateral y frente de la placa">${h}</svg>
    <div class="hint" style="text-align:center">Izquierda: vista lateral · Derecha: frente de la placa (la viga en líneas punteadas)</div>`;
}
function dibAleta(c, r){
  const g = r.geo, vg = g.vg, n = +c.n, s = +c.s, Lev = +c.Lev, Leh = +c.Leh, a = +c.a, hol = +c.holgura || 0, tp = +c.tp;
  const W = a + Leh + 160, H = vg.d + 40, k = Math.min(300 / W, 330 / H);
  const X = v => 92 + v * k, Y = v => 50 + v * k;
  const yb = (vg.d - g.Lp) / 2;                                   // chapa centrada en el alma
  const sup = `<rect x="${X(-24)}" y="${Y(-12)}" width="${24 * k}" height="${(vg.d + 24) * k}" class="sop"/>`;
  const viga = `<rect x="${X(hol)}" y="${Y(0)}" width="${(a + Leh + 140 - hol) * k}" height="${vg.d * k}" class="vg"/>
    <line x1="${X(hol)}" y1="${Y(vg.tf)}" x2="${X(a + Leh + 140)}" y2="${Y(vg.tf)}" class="vgl"/><line x1="${X(hol)}" y1="${Y(vg.d - vg.tf)}" x2="${X(a + Leh + 140)}" y2="${Y(vg.d - vg.tf)}" class="vgl"/>`;
  const ch = `<rect x="${X(0)}" y="${Y(yb)}" width="${(a + Leh) * k}" height="${g.Lp * k}" class="pl"/>`;
  const sold = `<path d="M${X(0)} ${Y(yb)} l${6} ${0} l${-6} ${6} z M${X(0)} ${Y(yb + g.Lp)} l6 0 l-6 -6 z" class="wld"/><line x1="${X(0)}" y1="${Y(yb)}" x2="${X(0)}" y2="${Y(yb + g.Lp)}" class="wl"/>`;
  const per = Array.from({ length:n }, (_, i) => `<circle cx="${X(a)}" cy="${Y(yb + Lev + i * s)}" r="${Math.max(3, g.dh / 2 * k)}" class="bolt"/>`).join('');
  const cot = cotaV(X(-34), Y(yb), Y(yb + g.Lp), `Lp ${f2(g.Lp, 0)}`) + (n > 1 ? cotaV(X(a + Leh + 14), Y(yb + Lev), Y(yb + Lev + s), `s = ${s}`, 1) : '')
    + cotaV(X(a + Leh + 14), Y(yb + g.Lp - Lev), Y(yb + g.Lp), `Lev = ${Lev}`, 1)
    + cotaH(Y(vg.d) + 16, X(0), X(a), `a = ${a}`) + cotaH(Y(vg.d) + 16, X(a), X(a + Leh), `Leh = ${Leh}`) + (hol ? cotaH(Y(-12) - 8, X(0), X(hol), `holgura ${hol}`, -1) : '');
  const txt = `<text x="${X(a + Leh + 100)}" y="${Y(vg.d / 2)}" class="lbl" text-anchor="middle">${esc(vg.nom)}</text><text x="${X(-12)}" y="${Y(vg.d + 10)}" class="lbl" text-anchor="middle">soporte</text>
    <text x="${X((a + Leh) / 2)}" y="${Y(yb) + 12}" class="lbl" text-anchor="middle">PL ${tp} · w ${c.w}</text>`;
  const V = `<g class="carga"><line x1="${X(a)}" y1="${Y(yb + g.Lp) + 10}" x2="${X(a)}" y2="${Y(yb + g.Lp) + 34}"/><path d="M${X(a) - 5} ${Y(yb + g.Lp) + 28} L${X(a)} ${Y(yb + g.Lp) + 36} L${X(a) + 5} ${Y(yb + g.Lp) + 28} Z"/></g>`;
  return `<svg viewBox="0 0 ${X(a + Leh + 140) + 10} ${Y(vg.d) + 44}" class="dsvg" role="img" aria-label="Elevación de la chapa de aleta">${sup}${viga}${ch}${sold}${per}${cot}${txt}${V}</svg>
    <div class="hint" style="text-align:center">Elevación · la flecha marca Vu = ${f2(+c.Vu, 1)} kN</div>`;
}
function dibGrupo(c, r){
  const g = r.geo, nf = +c.filas, nc = +c.cols, s = +c.s, gg = +c.g, Lev = +c.Lev, Leh = +c.Leh, e = +c.e, ang = +c.ang || 0;
  const Bw = (nc - 1) * gg + 2 * Leh, Hp = g.Hp, xc = Leh + (nc - 1) * gg / 2, yc = Lev + (nf - 1) * s / 2;
  const xmin = Math.min(-60, xc + e - 30), xmax = Math.max(Bw + 20, xc + e + 40) + 110, W = xmax - xmin, k = Math.min(330 / W, 300 / (Hp + 60));
  const X = v => 20 + (v - xmin) * k, Y = v => 30 + v * k;
  let h = `<rect x="${X(-12)}" y="${Y(-20)}" width="${12 * k}" height="${(Hp + 40) * k}" class="sop"/><rect x="${X(0)}" y="${Y(0)}" width="${Bw * k}" height="${Hp * k}" class="pl"/>`;
  for(let j = 0; j < nc; j++) for(let i = 0; i < nf; i++) h += `<circle cx="${X(Leh + j * gg)}" cy="${Y(Lev + i * s)}" r="${Math.max(3, (+c.d + 1.6) / 2 * k)}" class="bolt"/>`;
  h += `<circle cx="${X(xc)}" cy="${Y(yc)}" r="3" class="cg"/><text x="${X(xc) + 5}" y="${Y(yc) - 5}" class="lbl">CG</text>`;
  const t = ang * Math.PI / 180, lx = X(xc + e), ly = Y(yc), L = 46;
  h += `<g class="carga"><line x1="${lx - Math.sin(t) * L}" y1="${ly - Math.cos(t) * L}" x2="${lx}" y2="${ly}"/><circle cx="${lx}" cy="${ly}" r="3"/>
    <path d="M${lx} ${ly} l${-5 * Math.cos(t) - 8 * Math.sin(t)} ${5 * Math.sin(t) - 8 * Math.cos(t)} l${10 * Math.cos(t)} ${-10 * Math.sin(t)} z"/></g>
    <text x="${lx + 6}" y="${ly - L / 2}" class="lbl">Pu = ${f2(+c.Pu, 1)} kN</text>`;
  if(isFinite(g.ic?.ro) && !ang && Math.abs(xc - Math.sign(e) * g.ic.ro - xmin) < W) h += `<g class="icr"><circle cx="${X(xc - Math.sign(e) * g.ic.ro)}" cy="${Y(yc)}" r="4"/><text x="${X(xc - Math.sign(e) * g.ic.ro)}" y="${Y(yc) + 15}" text-anchor="middle">CI</text></g>`;
  h += cotaH(Y(Hp) + 16, X(xc), X(xc + e), `e = ${e}`) + (nf > 1 ? cotaV(X(-22), Y(Lev), Y(Lev + s), `s = ${s}`) : '') + (nc > 1 ? cotaH(Y(0) - 10, X(Leh), X(Leh + gg), `g = ${gg}`, -1) : '');
  return `<svg viewBox="0 0 ${X(xmax) + 20} ${Y(Hp) + 40}" class="dsvg" role="img" aria-label="Grupo de pernos con la carga excéntrica">${h}</svg>
    <div class="hint" style="text-align:center">CG = centro del grupo · CI = centro instantáneo de rotación</div>`;
}

// ── Lista en el celular (igual que el generador: una línea fija con el elemento abierto) ─────────────
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
    ${p.datos.con.map(c => { const r = Conex.calc(c); return `<tr><td>${esc(c.nom)}</td><td>${esc(NOMBRES[c.tipo])}</td><td>${esc(c.desc || '')}</td><td class="n">${r.error ? '—' : f2(r.max, 3)}</td><td>${r.error ? '—' : r.ok ? 'Cumple' : 'No cumple'}</td></tr>`; }).join('')}</tbody></table></section>`;
  p.datos.con.forEach((c, i) => { const r = Conex.calc(c); if(r.error) return;
    h += `<section class="cx"><h2>${i + 2}. ${esc(c.nom)} — ${esc(NOMBRES[c.tipo])}</h2>${c.desc ? `<p>${esc(c.desc)}</p>` : ''}
      <div class="cx-row"><div class="dib">${dibujo(c, r)}</div><div>${datosPrint(c)}</div></div>
      <h3>Chequeos</h3>${chequeosHTML(r)}${r.av.length ? `<p><b>Observaciones:</b> ${r.av.map(esc).join(' ')}</p>` : ''}<h3>Requisitos de geometría y detallado</h3>${reqHTML(r)}<h3>Cálculo</h3><div class="calc">${r.pasos.map(esc).join('<br/>')}</div>
      <p><b>Conclusión:</b> ${r.ok ? `la conexión cumple; relación demanda/capacidad máxima ${f2(r.max, 3)}.` : `la conexión NO cumple (relación máxima ${f2(r.max, 3)}${r.req.some(x => !x[1]) ? ' o hay requisitos de detallado sin cumplir' : ''}).`}</p></section>`; });
  const css = `@page{size:letter;margin:.8in .7in .9in;@top-left{content:"${esc(p.consecutivo)}";font:9pt sans-serif;color:#555}@top-right{content:"${esc((F.proyecto || '').replace(/"/g, ''))}";font:9pt sans-serif;color:#555}@bottom-right{content:counter(page) " / " counter(pages);font:9pt sans-serif;color:#555}}
    @page portada{margin:.6in;@top-left{content:none}@top-right{content:none}@bottom-right{content:none}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  $('#print-area').innerHTML = `<div class="cx-print">${h}</div>`;
  await Promise.all([...$$('#print-area img')].map(im => im.complete ? 0 : new Promise(ok => { im.onload = im.onerror = ok; })));
  setTimeout(() => { window.print(); setTimeout(() => { st.remove(); $('#print-area').innerHTML = ''; }, 800); }, 100);
}
function datosPrint(c){
  const t = (l, v) => `<tr><th>${l}</th><td>${v}</td></tr>`, dn = (Conex.DIAM.find(x => x[1] === +c.d) || [c.d])[0];
  if(['ras', 'testaV', 'asiento', 'empalme', 'cartela', 'base'].includes(c.tipo)){
    const carga = c.tipo === 'base' ? `P ${c.P} kN · Mx ${c.Mx} · My ${c.My} kN·m · Vx ${c.Vx} · Vy ${c.Vy} kN` : c.tipo === 'cartela' ? `Pu = ${c.Pu} kN` : c.Mu != null ? `Mu ${c.Mu} kN·m · Vu ${c.Vu} kN` : `Vu = ${c.Vu} kN`;
    return `<table class="t kv">${t('Cargas', carga)}${seccionesDe(c).map(([, tt, res]) => t(esc(tt), esc(res()))).join('')}</table>`; }
  if(c.tipo === 'angular') return `<table class="t kv">${t('Vu', `${f2(+c.Vu, 1)} kN`)}${t('Viga', `${esc(c.viga)} · ${esc(c.aceroViga)} · holgura ${c.holgura} mm`)}${t('Soporte', `${SOPN[c.soporte]} · t = ${c.tSop} mm · ${esc(c.aceroSop)}`)}
    ${t('Angulares', `2L ${c.bAng}×${c.bAng}×${c.tAng} mm · ${esc(c.aceroAng)}`)}${t('Pernos', `${c.n} en el alma + ${2 * c.n} en el soporte, ${dn} ${esc(c.grado)}-${esc(c.rosca)}`)}${t('Distancias', `s = ${c.s} · Lev = ${c.Lev} · g₁ = ${c.g1} · g₂ = ${c.g2} mm`)}</table>`;
  if(c.tipo === 'testa') return `<table class="t kv">${t('Mu · Vu', `${f2(+c.Mu, 1)} kN·m · ${f2(+c.Vu, 1)} kN`)}${t('Viga', `${esc(c.viga)} · ${esc(c.aceroViga)}`)}${t('Columna', c.columna ? `${esc(c.columna)} · ${esc(c.aceroCol)}` : 'no revisada')}
    ${t('Placa', `${c.tp} × ${c.bp} mm · ${esc(c.aceroPl)} · extensión ${c.ambos ? 'arriba y abajo' : 'arriba'}`)}${t('Pernos', `${c.ambos ? 8 : 4 + (+c.nbc || 0)} × ${dn} ${esc(c.grado)}-${esc(c.rosca)} pretensionados · g = ${c.g} mm`)}
    ${t('Distancias', `pfo = ${c.pfo} · pfi = ${c.pfi} · de = ${c.de} mm`)}${t('Soldaduras', `alas: ${c.soldAla === 'cjp' ? 'penetración completa' : `filete ${c.wAla} mm`} · alma: filete ${c.wAlma} mm · ${esc(c.electrodo)}`)}</table>`;
  if(c.tipo === 'aleta') return `<table class="t kv">${t('Vu', `${f2(+c.Vu, 1)} kN`)}${t('Viga', `${esc(c.viga)} · ${esc(c.aceroViga)}`)}${t('Soporte', `${{ ala:'Ala de columna', alma:'Alma de columna', viga:'Alma de viga' }[c.soporte]} · t = ${c.tSop} mm · ${esc(c.aceroSop)}`)}
    ${t('Chapa', `${c.tp} mm · ${esc(c.aceroPl)} · a = ${c.a} mm`)}${t('Pernos', `${c.n} × ${dn} ${esc(c.grado)}-${esc(c.rosca)} · s = ${c.s} mm`)}${t('Bordes', `Lev = ${c.Lev} · Leh = ${c.Leh} mm`)}${t('Soldadura', `filete ${c.w} mm por ambas caras · ${esc(c.electrodo)}`)}</table>`;
  return `<table class="t kv">${t('Pu', `${f2(+c.Pu, 1)} kN a ${c.ang || 0}° · e = ${c.e} mm`)}${t('Pernos', `${c.filas} × ${c.cols} de ${dn} ${esc(c.grado)}-${esc(c.rosca)}`)}${t('Separaciones', `s = ${c.s} · g = ${c.g} mm`)}${t('Bordes', `Lev = ${c.Lev} · Leh = ${c.Leh} mm`)}
    ${t('Chapa', `${c.tp} mm · ${esc(c.aceroPl)}`)}${t('Soporte', `t = ${c.tSop} mm · ${esc(c.aceroSop)}`)}</table>`;
}

$('#btnSalir').onclick = async () => { await sb.auth.signOut(); location.hash = ''; };
if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').catch(() => {}); let r = false; navigator.serviceWorker.addEventListener('controllerchange', () => { if(!r){ r = true; location.reload(); } }); }
arrancar();
