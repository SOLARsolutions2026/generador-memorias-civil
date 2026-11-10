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
const NOMBRES = { aleta:'Chapa de aleta (shear tab)', grupo:'Grupo de pernos excéntrico' };
const PREF = { aleta:'CA', grupo:'GE' };

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
        ${esIng() ? `<div class="gal">${Object.entries(NOMBRES).map(([t, n]) => `<button type="button" class="gal-it" data-nueva="${t}">${t === 'aleta' ? ICO_ALETA : ICO_GRUPO}<span>＋ ${n}</span></button>`).join('')}</div>` : ''}
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
  return [
    ['geo', 'Distribución de pernos', () => `${c.filas} filas × ${c.cols} columnas · s ${c.s} · g ${c.g} · bordes ${c.Lev}/${c.Leh}`,
      g3(campo(c, 'filas', 'Filas (vertical)'), campo(c, 'cols', 'Columnas (horizontal)'), '<div></div>', campo(c, 's', 'Separación vertical s [mm]'), campo(c, 'g', 'Separación horizontal g [mm]'), '<div></div>', campo(c, 'Lev', 'Borde vertical Lev [mm]'), campo(c, 'Leh', 'Borde horizontal Leh [mm]'))],
    ['pern', 'Pernos', () => `${dnom(c)} ${c.grado}-${c.rosca}`, g3(...pernosTipo)],
    ['chapa', 'Chapa y soporte', () => `PL ${c.tp} mm ${c.aceroPl} · soporte t ${c.tSop} mm ${c.aceroSop}`,
      g3(campo(c, 'tp', 'Espesor de la chapa tp [mm]'), campo(c, 'aceroPl', 'Acero de la chapa', { sel:SEL_ACERO }), '<div></div>', campo(c, 'tSop', 'Espesor del soporte [mm]', { h:'Ala de la columna u otra chapa' }), campo(c, 'aceroSop', 'Acero del soporte', { sel:SEL_ACERO }))] ];
}
const abiertas = () => { try{ return JSON.parse(localStorage.conSecc || 'null') || ['viga', 'geo']; }catch(e){ return ['viga', 'geo']; } };
function formHTML(c){
  const ab = abiertas();
  const carga = c.tipo === 'aleta'
    ? `<div class="carga-in">${campo(c, 'Vu', 'Cortante de diseño Vu [kN]')}<div class="hint">Reacción mayorada de la viga<br/>(combinación de resistencia)</div></div>`
    : `<div class="carga-in">${campo(c, 'Pu', 'Carga de diseño Pu [kN]')}${campo(c, 'e', 'Excentricidad e [mm]', { h:'De la carga al centro del grupo' })}${campo(c, 'ang', 'Ángulo [°]', { h:'0° = vertical' })}</div>`;
  return carga + `<div class="sec-tools"><button type="button" class="lnk" data-secall="1">Abrir todo</button> · <button type="button" class="lnk" data-secall="0">Cerrar todo</button></div>`
    + seccionesDe(c).map(([k, t, res, body], i) => `<section class="sec ${ab.includes(k) ? 'on' : ''}" data-sec="${k}">
      <button type="button" class="sec-hd" aria-expanded="${ab.includes(k)}"><i>${i + 1}</i><b>${t}</b><small data-res="${k}">${esc(res())}</small><span class="car" aria-hidden="true">▾</span></button>
      <div class="sec-bd">${body}</div></section>`).join('');
}
const GRUPOS = { pernos:'Pernos', chapa:'Chapa', soldadura:'Soldadura', soporte:'Soporte', viga:'Viga' };
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
      if(el.tagName === 'SELECT' && ['viga', 'soporte'].includes(k)){ if(k === 'viga'){ const v = Conex.perfil(c.viga); if(v && c.soporte === 'viga'){} } renderEditor(); guardar(); return; }
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
function dibujo(c, r){ return c.tipo === 'grupo' ? dibGrupo(c, r) : dibAleta(c, r); }
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
  h += `<section><h2>1. Generalidades</h2><p>Se revisan las conexiones metálicas del proyecto con el Reglamento NSR-10, Título F.2, capítulo F.2.10 (conexiones), con el método de diseño por factores de carga y resistencia. Los grupos de pernos con excentricidad se revisan con el método del centro instantáneo de rotación. Unidades: kN, mm, MPa.</p>
    <table class="t"><thead><tr><th>Conexión</th><th>Tipo</th><th>Descripción</th><th>Relación máx.</th><th>Estado</th></tr></thead><tbody>
    ${p.datos.con.map(c => { const r = Conex.calc(c); return `<tr><td>${esc(c.nom)}</td><td>${esc(NOMBRES[c.tipo])}</td><td>${esc(c.desc || '')}</td><td class="n">${r.error ? '—' : f2(r.max, 3)}</td><td>${r.error ? '—' : r.ok ? 'Cumple' : 'No cumple'}</td></tr>`; }).join('')}</tbody></table></section>`;
  p.datos.con.forEach((c, i) => { const r = Conex.calc(c); if(r.error) return;
    h += `<section class="cx"><h2>${i + 2}. ${esc(c.nom)} — ${esc(NOMBRES[c.tipo])}</h2>${c.desc ? `<p>${esc(c.desc)}</p>` : ''}
      <div class="cx-row"><div class="dib">${dibujo(c, r)}</div><div>${datosPrint(c)}</div></div>
      <h3>Chequeos</h3>${chequeosHTML(r)}<h3>Requisitos de geometría y detallado</h3>${reqHTML(r)}<h3>Cálculo</h3><div class="calc">${r.pasos.map(esc).join('<br/>')}</div>
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
  if(c.tipo === 'aleta') return `<table class="t kv">${t('Vu', `${f2(+c.Vu, 1)} kN`)}${t('Viga', `${esc(c.viga)} · ${esc(c.aceroViga)}`)}${t('Soporte', `${{ ala:'Ala de columna', alma:'Alma de columna', viga:'Alma de viga' }[c.soporte]} · t = ${c.tSop} mm · ${esc(c.aceroSop)}`)}
    ${t('Chapa', `${c.tp} mm · ${esc(c.aceroPl)} · a = ${c.a} mm`)}${t('Pernos', `${c.n} × ${dn} ${esc(c.grado)}-${esc(c.rosca)} · s = ${c.s} mm`)}${t('Bordes', `Lev = ${c.Lev} · Leh = ${c.Leh} mm`)}${t('Soldadura', `filete ${c.w} mm por ambas caras · ${esc(c.electrodo)}`)}</table>`;
  return `<table class="t kv">${t('Pu', `${f2(+c.Pu, 1)} kN a ${c.ang || 0}° · e = ${c.e} mm`)}${t('Pernos', `${c.filas} × ${c.cols} de ${dn} ${esc(c.grado)}-${esc(c.rosca)}`)}${t('Separaciones', `s = ${c.s} · g = ${c.g} mm`)}${t('Bordes', `Lev = ${c.Lev} · Leh = ${c.Leh} mm`)}
    ${t('Chapa', `${c.tp} mm · ${esc(c.aceroPl)}`)}${t('Soporte', `t = ${c.tSop} mm · ${esc(c.aceroSop)}`)}</table>`;
}

$('#btnSalir').onclick = async () => { await sb.auth.signOut(); location.hash = ''; };
if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').catch(() => {}); let r = false; navigator.serviceWorker.addEventListener('controllerchange', () => { if(!r){ r = true; location.reload(); } }); }
arrancar();
