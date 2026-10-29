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
// Diseño en acero del software (Anexo C), si el archivo lo trae
const disenoSw = () => { const Dz = S.m.anexos?.C?.modelo?.diseno; return Dz?.n ? Dz : null; };
// Longitudes [m], K y Cb que usó el software en un elemento del modelo, con los cambios a mano (✎) del ingeniero
function valoresSw(el, id, Dz){
  const d = Dz?.frames?.[id]; if(!d) return null;
  const L = d.L || 0, ov = el.ov?.[id] || {}, r = v => +(+v).toFixed(3);
  const v = { L, Lx:r(d.l33 != null ? d.l33*L : L), Ly:r(d.l22 != null ? d.l22*L : L), Lb:r(d.lltb != null ? d.lltb*L : d.l22 != null ? d.l22*L : L), Kx:d.k33 || 1, Ky:d.k22 || 1, Cb:d.cb || 1 };
  const ed = {}; for(const k of ['Lx','Ly','Lb','Cb']) if(ov[k] !== undefined && ov[k] !== '' && isFinite(parseFloat(ov[k]))){ v[k] = parseFloat(ov[k]); ed[k] = true; }
  return { ...v, ed, rp:d.ratio, combo:d.combo };
}
// Calcula y guarda el resumen en el elemento (para la lista, la barra de «terminado» y la impresión).
// Con las filas del modelo, cada elemento del grupo se revisa con sus propias fuerzas (y, si se escoge, con las longitudes y Cb del software).
function calcMet(el, G){
  const filas = filasDe(el, G);
  if(!filas.length){ el.res = { ok:false, error: el.fuerzas === 'manual' ? 'Escribe las fuerzas.' : 'Escoge el grupo de elementos del modelo.' }; return null; }
  const Dz = disenoSw(), sw = el.fuente === 'programa' && !!Dz;
  let R, porEl = null;
  if(el.fuerzas !== 'manual' && G?.[el.grupo]){
    const ids = [...new Set(filas.map(f => f.F))], lista = [];
    for(const id of ids){
      const fi = filas.filter(f => f.F === id), v = valoresSw(el, id, Dz);
      const usar = sw && v ? { ...el, Lx:v.Lx, Ly:v.Ly, Lb:v.Lb, Lz:v.Lb, Kx:v.Kx, Ky:v.Ky, Kz:1, Cb:v.Cb } : el;
      const Ri = AnexoD.revisar(usar, fi);
      lista.push({ id, Ri, v, usar, fi });
    }
    const okL = lista.filter(x => x.Ri.ok);
    if(!okL.length) R = lista[0].Ri;
    else {
      const g = okL.reduce((a, b) => b.Ri.ratio > a.Ri.ratio ? b : a);
      R = { ...g.Ri, filas:filas.length, Fc:g.id, avisos:[...g.Ri.avisos], _uso:{ el:g.usar, filas:g.fi } };
      const sin = lista.length - okL.length;
      if(sin) R.avisos.push(`${sin} elemento${sin > 1 ? 's' : ''} del grupo no se revisaron: falta Lx${sw ? ' (el software no trae sus longitudes)' : ''}.`);
    }
    porEl = lista.map(({ id, Ri, v }) => ({ F:id, L:v?.L ?? null, r:Ri.ok ? +Ri.ratio.toFixed(3) : null, rp:v?.rp ?? null,
      u:Ri.ok ? { Lx:+(Ri.Lx/1000).toFixed(3), Ly:+(Ri.Ly/1000).toFixed(3), Lb:+(Ri.Lb/1000).toFixed(3), Kx:Ri.Kx, Ky:Ri.Ky, Cb:Ri.Cb } : null,
      sw:v ? { Lx:v.Lx, Ly:v.Ly, Lb:v.Lb, Kx:v.Kx, Ky:v.Ky, Cb:v.Cb } : null, ed:v?.ed || {} }));
  } else { R = AnexoD.revisar(el, filas); R._uso = { el, filas }; }
  el.res = R.ok ? { ok:true, ratio:+R.ratio.toFixed(3), cumple:R.cumple, n:R.filas, fecha:new Date().toISOString(), Fc:R.Fc || null, fuente:sw ? 'programa' : 'manual',
    rp: porEl && porEl.some(x => x.rp != null) ? Math.max(...porEl.map(x => x.rp ?? 0)) : null, porEl,
    checks:Object.fromEntries(Object.entries(R.checks).map(([k, v]) => [k, { r:+v.r.toFixed(4), f:v.f }])), avisos:R.avisos } : { ok:false, error:R.error, porEl };
  return R;
}
// Diferencia plantilla frente al software, en %
const difSw = (r, rp) => r == null || !rp ? null : (r - rp)/rp*100;
const colDif = d => d == null ? '#64748b' : Math.abs(d) <= 5 ? '#057a55' : Math.abs(d) <= 15 ? '#b45309' : '#b91c1c';
const txtDif = d => d == null ? '—' : `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d).toFixed(0)} %`;

// Bloque «Comparación con el diseño del software» dentro de cada elemento
function progHTML(e){
  if(e.fuerzas === 'manual' || !e.grupo) return '';
  const Dz = disenoSw(), P = e.res?.porEl;
  if(!Dz) return '<p class="hint" style="margin-top:8px">Si al exportar marcas también las tablas de diseño en acero (Design Data → Steel Design 1 – Summary Data y Steel Design 2 – PMM Details), aquí verás la comparación con el software y podrás usar sus longitudes y Cb.</p>';
  if(!P?.length) return '';
  const sw = e.fuente === 'programa';
  const filas = [...P].sort((a, b) => (b.r ?? -1) - (a.r ?? -1));
  const celda = (x, k) => {
    const val = sw ? (x.u?.[k] ?? x.sw?.[k]) : x.sw?.[k];
    if(val == null) return '—';
    if(sw && esIng() && x.sw) return `<input class="ov-in" data-ov="${esc(x.F)}|${k}" value="${esc(String(+(+val).toFixed(3)))}" inputmode="decimal" aria-label="${k} del elemento ${esc(x.F)}"/>${x.ed[k] ? ' ✎' : ''}`;
    return fx(val, 2) + (sw && x.ed[k] ? ' ✎' : '');
  };
  const fila = x => { const d = difSw(x.r, x.rp);
    return `<tr class="${x.F === e.res.Fc ? 'ctl' : ''}"><td><b>E${esc(x.F)}</b>${x.F === e.res.Fc ? ' <span class="hint">controla</span>' : ''}</td><td class="n">${fx(x.L,2)}</td>
      <td class="n">${celda(x,'Lx')}</td><td class="n">${celda(x,'Ly')}</td><td class="n">${celda(x,'Lb')}</td><td class="n">${x.sw ? `${fx(x.sw.Kx,2)} / ${fx(x.sw.Ky,2)}` : '—'}</td><td class="n">${celda(x,'Cb')}</td>
      <td class="n">${x.rp != null ? fx(x.rp,3) : '—'}</td><td class="n"><b>${x.r != null ? fx(x.r,3) : '—'}</b></td><td class="n" style="color:${colDif(d)};font-weight:800">${txtDif(d)}</td></tr>`; };
  const tb = rs => `<div class="tw"><table class="t sw-t"><thead><tr><th>Elemento</th><th>Long. [m]</th><th>Lx [m]</th><th>Ly [m]</th><th>Lb [m]</th><th>Kx / Ky</th><th>Cb</th><th>Software</th><th>Plantilla</th><th>Diferencia</th></tr></thead><tbody>${rs.map(fila).join('')}</tbody></table></div>`;
  return `<div class="sw-box"><h4 class="sub" style="margin-top:0">Comparación con el diseño del software</h4>
    <div class="note blue" style="margin-bottom:8px">${sw ? `El grupo tiene ${P.length} elemento${P.length > 1 ? 's' : ''} en el modelo. Cada uno se revisa con <b>sus fuerzas y con las longitudes, K y Cb del software</b>. Puedes cambiar Lx, Ly, Lb o Cb de un elemento (queda marcado ✎).`
      : `Longitudes y Cb de la tabla: los que usó el software (referencia). Relación de la plantilla: con <b>tus longitudes</b>, las mismas para todo el grupo.`}</div>
    ${tb(filas.slice(0, 8))}${filas.length > 8 ? `<details class="d-opc"><summary>Ver los otros ${filas.length - 8} elementos</summary>${tb(filas.slice(8))}</details>` : ''}
    <p class="hint">Diferencia hasta ±5 % en verde (la plantilla usa las propiedades de catálogo con radios; la sección del modelo suele no tenerlos) · 5–15 % ámbar · más de 15 % rojo: revisa longitud, Cb o combinaciones.</p>
    ${esIng() ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">${sw ? `<button class="btn sm" type="button" data-fuente="reset">Volver a los valores del software</button><button class="btn sm" type="button" data-fuente="manual">Usar mis longitudes (a mano)</button>`
      : Dz.conL ? '<button class="btn sm pri" type="button" data-fuente="programa">Usar longitudes y Cb del software</button>' : '<span class="hint">El archivo no trae los factores de longitud y Cb: exporta también «Steel Design 2 – PMM Details».</span>'}</div>` : ''}</div>`;
}
function activarProg(e){
  $$('[data-fuente]').forEach(b => b.onclick = () => { const k = b.dataset.fuente;
    if(k === 'reset') e.ov = {}; else e.fuente = k === 'programa' ? 'programa' : 'manual';
    guardarMemoria(); paneAnexoD(); });
  $$('[data-ov]').forEach(i => i.addEventListener('change', () => { const [id, k] = i.dataset.ov.split('|');
    e.ov = e.ov || {}; e.ov[id] = e.ov[id] || {}; const v = i.value.trim().replace(',', '.');
    if(v === '') delete e.ov[id][k]; else e.ov[id][k] = v;
    guardarMemoria(); pintarResMet(e); }));
}
// Tabla de elementos en el PDF (los 10 de mayor relación)
function swPrintHTML(e){
  // En el PDF solo van los datos de cálculo de cada elemento y su relación (sin mencionar el diseño del software; pedido de Amo 28-oct)
  const P = e.res?.porEl; if(!P || P.length < 2) return '';
  const rs = [...P].sort((a, b) => (b.r ?? -1) - (a.r ?? -1)).slice(0, 10);
  return `<table class="ax-tb"><thead><tr><th>Elemento</th><th>L [m]</th><th>Lx [m]</th><th>Ly [m]</th><th>Lb [m]</th><th>Cb</th><th>Relación D/C</th></tr></thead><tbody>${rs.map(x => { const u = x.u || {};
    return `<tr><td>${esc(x.F)}${x.F === e.res.Fc ? ' (controla)' : ''}</td><td class="c">${fx(x.L,2)}</td><td class="c">${fx(u.Lx,2)}</td><td class="c">${fx(u.Ly,2)}</td><td class="c">${fx(u.Lb,2)}</td><td class="c">${fx(u.Cb,2)}</td><td class="c">${x.r != null ? fx(x.r,3) : '—'}</td></tr>`; }).join('')}</tbody></table>
    ${P.length > 10 ? `<p class="ax-nota">Se muestran los 10 elementos de mayor relación de ${P.length}.</p>` : ''}`;
}
// Resumen de todos los perfiles: software frente a plantilla
async function pintarCompSw(D){
  const box = $('#dComp'); if(!box || !disenoSw() || !D.met.length) return;
  let G = null; try{ G = await filasModelo(); }catch(err){ console.warn(err); }
  for(const e of D.met) calcMet(e, G);
  const b = $('#dComp'); if(!b) return;
  const fil = D.met.map(e => { const r = e.res, d = r?.ok ? difSw(r.ratio, r.rp) : null, c = r?.checks?.int?.f?.c || '';
    const est = !r?.ok ? pill('gray', 'Sin datos') : pill(r.cumple ? 'ok' : 'no', r.cumple ? 'Cumple' : 'No cumple') + (d != null && Math.abs(d) > 15 ? ' ' + pill('pend', 'Revisar') : '');
    return `<tr data-selcomp="${e.id}" class="sw-row"><td><b>${esc(e.nom)}</b></td><td>${esc(nomSec(e))}</td><td>${esc(e.desc || '')}</td><td class="n">${r?.porEl?.length || '—'}</td><td>${r?.Fc ? 'E' + esc(r.Fc) : '—'}</td><td>${esc(c)}</td>
      <td class="n">${r?.rp != null ? fx(r.rp,2) : '—'}</td><td class="n"><b>${r?.ok ? fx(r.ratio,2) : '—'}</b></td><td class="n" style="color:${colDif(d)};font-weight:800">${txtDif(d)}</td><td>${est}</td><td class="hint">${r?.fuente === 'programa' ? 'del software' : 'a mano'}</td></tr>`; }).join('');
  b.innerHTML = `<div class="card"><div class="ct">Comparación con el diseño del software</div>
    <div class="tw"><table class="t sw-t"><thead><tr><th>Elemento</th><th>Sección</th><th>Descripción</th><th>Elem.</th><th>Controla</th><th>Combinación</th><th>Software</th><th>Plantilla</th><th>Diferencia</th><th></th><th>Longitudes</th></tr></thead><tbody>${fil}</tbody></table></div>
    <p class="hint">«Revisar» = diferencia mayor que 15 %: toca la fila para abrir el elemento y ver qué valor no coincide.</p></div>`;
  $$('[data-selcomp]').forEach(t => t.onclick = () => { selMet = t.dataset.selcomp; paneAnexoD(); window.scrollTo({ top:0, behavior:'smooth' }); });
  const lst = $$('.d-el[data-sel]'); lst.forEach(x => { const el = D.met.find(m => m.id === x.dataset.sel); const p = x.querySelector('.pill'); if(el && p) p.outerHTML = pillRes(el.res); });
}

// Ordena la lista por nombre con los números en orden natural (PF-2 antes que PF-10). El orden se guarda y es el mismo del PDF.
const ordenNombre = lista => lista.sort((a, b) => String(a.nom || '').localeCompare(String(b.nom || ''), 'es', { numeric:true, sensitivity:'base' }));
function activarOrdenar(D){
  $$('[data-ordenar]').forEach(b => b.onclick = () => { ordenNombre(D[b.dataset.ordenar]); guardarMemoria(); paneAnexoD(); toast('Lista ordenada por nombre.'); });
}

function paneAnexoD(){
  const D = datosD(), C = S.m.anexos?.C, Fz = C?.modelo?.fuerzas;
  const tabs = { met:`Elementos metálicos (${D.met.length})`, zap:`Concreto: zapatas (${D.zap.length})`, ped:`Concreto: pedestales (${D.ped.length})` };
  if(S.m.tipo === 'verificacion' && S.m.anexos?.her){   // verificación puntual: solo las pestañas de las herramientas escogidas
    const h = S.m.anexos.her; if(!h.some(k => ['metal','placa','vc'].includes(k))) delete tabs.met; if(!h.some(k => ['zapata','placa'].includes(k))){ delete tabs.zap; if(!h.includes('placa')) delete tabs.ped; }
    if(h.includes('placa') && !h.includes('zapata')) delete tabs.zap;
    if(!tabs[tabD]) tabD = Object.keys(tabs)[0] || 'met'; }
  let h = `<div class="tabs" role="tablist">${Object.entries(tabs).map(([k, v]) => `<button type="button" role="tab" data-tabd="${k}" class="${tabD === k ? 'on' : ''}">${v}</button>`).join('')}</div>`;
  // Aviso de derivas (se revisan en el Anexo C antes de diseñar; pedido de Amo 29-oct)
  const dr = C?.der?.res, bOn = S.m.anexos?.B?.aplica !== false && S.m.anexos?.B;
  if(bOn && C?.modelo) h += dr?.ok ? (dr.cumple ? '' : `<div class="note" style="background:#fef2f2;border-left:3px solid #b91c1c;color:#991b1b"><b>Las derivas no cumplen</b> (máx. ${fx(dr.max * 100, 2)} % &gt; 1 %): revisa el modelo antes de diseñar los elementos. <a href="#/m/${S.m.id}/C" data-irc>Ver C-8 Derivas</a></div>`)
    : `<div class="note amber">Aún no revisas las derivas: hazlo en el <a href="#/m/${S.m.id}/C" data-irc>Anexo C → Resultados → C-8 Derivas</a> antes de diseñar.</div>`;
  if(tabD !== 'met') return paneConcreto(tabD, h);
  const sel = D.met.find(e => e.id === selMet) || D.met[0]; selMet = sel?.id || null;
  h += `<div class="d-grid"><div class="d-lista">
      ${D.met.map(e => `<button type="button" class="d-el ${e.id === selMet ? 'on' : ''}" data-sel="${e.id}"><span><b>${esc(e.nom)}</b> ${esc(nomSec(e))}${e.desc ? ' · ' + esc(e.desc) : ''}
        <small>${e.fuerzas === 'manual' ? 'fuerzas escritas a mano' : esc(e.grupo ? e.grupo.replace('|', ' · ') : 'sin grupo')}</small></span>${pillRes(e.res)}</button>`).join('')}
      ${!D.met.length ? '<p class="hint">Aún no hay elementos.</p>' : ''}
      ${esIng() ? `${Fz?.grupos?.length ? '<button class="btn sm pri" type="button" id="dDesdeC" style="width:100%;margin-top:6px">⚡ Crear elementos desde el Anexo C</button>' : '<div class="note amber" style="margin-top:6px">Para traer las fuerzas, sube el modelo con resultados en el Anexo C (pestaña Resultados).</div>'}
        <button class="btn sm" type="button" id="dNuevo" style="width:100%;margin-top:6px">＋ Agregar elemento</button>
        ${D.met.length > 1 ? '<button class="btn sm" type="button" data-ordenar="met" style="width:100%;margin-top:6px">↓ Ordenar por nombre (menor a mayor)</button>' : ''}` : ''}
    </div><div id="dDet">${sel ? detMetHTML(sel) : '<div class="card"><p class="muted">Crea o escoge un elemento.</p></div>'}</div></div>
    <div id="dComp"></div>`;
  pane(h);
  activarTabsD();
  pintarCompSw(D);
  $$('[data-sel]').forEach(b => b.onclick = () => { selMet = b.dataset.sel; paneAnexoD(); });
  if(!esIng()){ if(sel) pintarResMet(sel); return; }
  activarOrdenar(D);
  if($('#dNuevo')) $('#dNuevo').onclick = () => { const e = nuevoMet(D.met.length + 1, S.m.anexos?.C?.modelo ? {} : { fuerzas:'manual' }); D.met.push(e); selMet = e.id; guardarMemoria(); paneAnexoD(); };
  if($('#dDesdeC')) $('#dDesdeC').onclick = async () => {
    const usados = new Set(D.met.map(e => e.grupo)), omit = [];
    let G = null; try{ toast('Leyendo el modelo…', 15000); G = await filasModelo(); }catch(e){ console.warn(e); }
    for(const g of Fz.grupos){
      const key = g.sec + '|' + g.fun; if(usados.has(key)) continue;
      const t = AnexoD.desdeNombre(g.sec); if(!t){ omit.push(g.sec); continue; }
      const e = nuevoMet(D.met.length + 1, { ...t, desc:g.fun, grupo:key, Lx:'', fuente: disenoSw()?.conL ? 'programa' : 'manual', acero: t.tipo === 'HSS' ? 'A500 Gr C' : t.tipo === 'BAR' ? 'A36' : 'A572 Gr 50' });
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
    <div id="dSec">${seccionHTML(e)}</div>
    ${e.fuente === 'programa' && e.fuerzas !== 'manual' && disenoSw() ? `<h4 class="sub">Longitudes y coeficientes</h4><div class="note blue">Se usan las longitudes, K y Cb del software para cada elemento del grupo (tabla «Comparación con el diseño del software», más abajo).</div>` : `
    <h4 class="sub">Longitudes y coeficientes</h4>
    <div class="fg g4">${fIn(e,'Lx','Lx [m] (pandeo eje fuerte)',{h:'Longitud entre apoyos; la escribes tú'})}${e.tipo !== 'BAR' ? fIn(e,'Ly','Ly [m] (eje débil)',{ph:'= Lx'}) + fIn(e,'Lb','Lb [m] (arriostramiento lateral)',{ph:'= Lx'}) + fIn(e,'Lz','Lz [m] (torsión)',{ph:'= Lx'}) : ''}</div>
    ${e.tipo !== 'BAR' ? `<div class="fg g4">${fIn(e,'Kx','Kx')}${fIn(e,'Ky','Ky')}${fIn(e,'Kz','Kz')}${e.tipo === 'I' ? fIn(e,'Cb','Cb',{h:'1.0 = conservador'}) : ''}</div>` : ''}
    `}
    <details class="d-opc"><summary>Tensión: área neta y pernos (opcional)</summary>
      <div class="fg g4">${e.tipo !== 'BAR' ? fIn(e,'tension.U','Factor U (Tabla F.2.4.3-1)') + fIn(e,'tension.nAg','Agujeros en la sección crítica') + fIn(e,'tension.dperno','Ø perno de los agujeros',{num:false,ph:'1/2"'}) + fIn(e,'tension.tAg','Espesor donde están [mm]',{ph:e.tipo === 'I' ? 'tf' : 't'}) : ''}</div>
      ${e.tipo !== 'BAR' ? `<div class="fg g4">${fIn(e,'pernos.n','Número de pernos')}<div class="f"><label>Ø perno</label><select data-a="pernos.d" ${ro_}>${Object.keys(AnexoD.PULG).map(k => opt(k, k, e.pernos.d)).join('')}</select></div>
        <div class="f"><label>Tipo de perno</label><select data-a="pernos.tipo" ${ro_}>${Object.keys(AnexoD.PERNOS).map(k => opt(k, k, e.pernos.tipo)).join('')}</select></div>${fIn(e,'pernos.tpl','Espesor menor conectado [mm]')}</div>` : ''}</details>
    <h4 class="sub">Fuerzas</h4>
    <div class="seg" role="group" style="margin-bottom:8px"><button type="button" data-fz="grupo" class="${e.fuerzas !== 'manual' ? 'on' : ''}" ${ro_}>Del modelo (Anexo C)</button><button type="button" data-fz="manual" class="${e.fuerzas === 'manual' ? 'on' : ''}" ${ro_}>Escribir a mano</button></div>
    ${e.fuerzas === 'manual' ? `<div class="fg g4">${['P','V2','V3','T','M2','M3'].map(k => fIn(e,'manual.' + k, `${k} [${k[0] === 'M' || k === 'T' ? 'kN·m' : 'kN'}]`, {ph: k === 'P' ? '− compresión' : ''})).join('')}</div><div class="ejes-box">${ejesMiembro()}</div>`
      : Fz?.grupos?.length ? `<div class="f"><label>Grupo de elementos del modelo</label><select data-a="grupo" ${ro_}>${opt('', '— escoge —', e.grupo)}${Fz.grupos.map(g => opt(g.sec + '|' + g.fun, `${g.sec} · ${g.fun} (${g.n} elem.)`, e.grupo)).join('')}</select>
          <div class="hint">Se revisan todas las filas del grupo en las combinaciones de resistencia del Anexo C y se toma la que controla en cada chequeo.</div></div>`
      : '<div class="note amber">No hay fuerzas del modelo: súbelo con resultados en el Anexo C o escríbelas a mano.</div>'}
    <div id="dProg"></div>
    <div id="dRes" style="margin-top:12px"><p class="muted">Calculando…</p></div></div>`;
}


// ═══ Dibujo de la sección con sus medidas y propiedades principales (pantalla e impresión) ═══
function secDe(e){ return e.tipo === 'HSS' ? AnexoD.secHSS(e.H, e.B, e.t) : e.tipo === 'BAR' ? AnexoD.secBar(e.d) : AnexoD.secI(e.perfil); }
function svgSeccion(s){
  if(!s) return '';
  const W = 260, H = 250, cx = 135, cy = 128, f1 = n => String(+Number(n).toFixed(2));
  const ac = '#1d4ed8', st = '#334155', fill = '#cbd5e1';
  // cota con marcas en los extremos; (lx, ly) = punto del texto
  const cota = (x1, y1, x2, y2, txt, lx, ly, anc='middle') => `<g stroke="${ac}" stroke-width="1"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>
    ${x1 === x2 ? `<line x1="${x1-4}" y1="${y1}" x2="${x1+4}" y2="${y1}"/><line x1="${x2-4}" y1="${y2}" x2="${x2+4}" y2="${y2}"/>` : `<line x1="${x1}" y1="${y1-4}" x2="${x1}" y2="${y1+4}"/><line x1="${x2}" y1="${y2-4}" x2="${x2}" y2="${y2+4}"/>`}</g>
    <text x="${lx}" y="${ly}" fill="${ac}" text-anchor="${anc}" font-size="11" font-weight="600" stroke="#fff" stroke-width="3" paint-order="stroke">${txt}</text>`;
  const ejes = (hx, hy) => `<g stroke="#94a3b8" stroke-width=".8" stroke-dasharray="5 3"><line x1="${cx - hx}" y1="${cy}" x2="${cx + hx}" y2="${cy}"/><line x1="${cx}" y1="${cy - hy}" x2="${cx}" y2="${cy + hy}"/></g>
    <text x="${cx + hx + 3}" y="${cy + 4}" font-size="10" fill="#64748b">x</text><text x="${cx + 4}" y="${cy + hy + 2}" font-size="10" fill="#64748b">y</text>`;
  let g = '';
  if(s.tipo === 'I'){
    const k = Math.min(150/s.b, 170/s.h), b = s.b*k, h = s.h*k, tw = Math.max(1.5, s.tw*k), tf = Math.max(1.5, s.tf*k), r = Math.min(s.r*k, (b - tw)/2 - 1);
    const L = cx - b/2, R = cx + b/2, T = cy - h/2, B = cy + h/2, wl = cx - tw/2, wr = cx + tw/2;
    const d = `M${L},${T} H${R} V${T+tf} H${wr+r} A${r},${r} 0 0 0 ${wr},${T+tf+r} V${B-tf-r} A${r},${r} 0 0 0 ${wr+r},${B-tf} H${R} V${B} H${L} V${B-tf} H${wl-r} A${r},${r} 0 0 0 ${wl},${B-tf-r} V${T+tf+r} A${r},${r} 0 0 0 ${wl-r},${T+tf} H${L} Z`;
    g = `<path d="${d}" fill="${fill}" stroke="${st}" stroke-width="1.3"/>${ejes(b/2 + 14, h/2 + 6)}
      ${cota(L, T - 12, R, T - 12, `b = ${f1(s.b)}`, cx, T - 17)}
      ${cota(L - 14, T, L - 14, B, '', 0, 0)}<text x="${L - 18}" y="${cy}" fill="${ac}" font-size="11" font-weight="600" text-anchor="middle" transform="rotate(-90 ${L - 18} ${cy})">h = ${f1(s.h)}</text>
      ${cota(R + 10, T, R + 10, T + tf, '', 0, 0)}<text x="${R + 15}" y="${T + tf/2 + 4}" fill="${ac}" font-size="11" font-weight="600">tf = ${f1(s.tf)}</text>
      <line x1="${wr}" y1="${cy + h*0.22}" x2="${R + 6}" y2="${cy + h*0.22}" stroke="${ac}" stroke-width=".8"/><text x="${R + 9}" y="${cy + h*0.22 + 4}" fill="${ac}" font-size="11" font-weight="600">tw = ${f1(s.tw)}</text>
      ${s.r ? `<text x="${R + 9}" y="${B - 2}" fill="#475569" font-size="10">r = ${f1(s.r)}</text>` : ''}`;
  } else if(s.tipo === 'HSS'){
    const k = Math.min(150/s.B, 170/s.H), b = s.B*k, h = s.H*k, t = Math.max(1.8, s.tn*k), ro = Math.min(2*t, b/4), ri = Math.max(0, ro - t);
    const L = cx - b/2, T = cy - h/2;
    g = `<rect x="${L}" y="${T}" width="${b}" height="${h}" rx="${ro}" fill="${fill}" stroke="${st}" stroke-width="1.3"/>
      <rect x="${L + t}" y="${T + t}" width="${b - 2*t}" height="${h - 2*t}" rx="${ri}" fill="#fff" stroke="${st}" stroke-width="1"/>${ejes(b/2 + 14, h/2 + 6)}
      ${cota(L, T - 12, L + b, T - 12, `B = ${f1(s.B)}`, cx, T - 17)}
      ${cota(L - 14, T, L - 14, T + h, '', 0, 0)}<text x="${L - 18}" y="${cy}" fill="${ac}" font-size="11" font-weight="600" text-anchor="middle" transform="rotate(-90 ${L - 18} ${cy})">H = ${f1(s.H)}</text>
      <line x1="${L + b - t/2}" y1="${cy + h*0.25}" x2="${L + b + 6}" y2="${cy + h*0.25}" stroke="${ac}" stroke-width=".8"/><text x="${L + b + 9}" y="${cy + h*0.25 + 4}" fill="${ac}" font-size="11" font-weight="600">t = ${f1(s.tn)}</text>`;
  } else {
    const rr = 70;
    g = `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="${fill}" stroke="${st}" stroke-width="1.3"/>${ejes(rr + 14, rr + 6)}${cota(cx - rr, cy - rr - 12, cx + rr, cy - rr - 12, `Ø = ${f1(s.d)}`, cx, cy - rr - 17)}`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" class="sec-svg" role="img" aria-label="Sección ${esc(s.n)}" font-family="Segoe UI,system-ui,sans-serif">${g}
    <text x="${W/2}" y="${H - 4}" text-anchor="middle" font-size="10" fill="#64748b">medidas en mm${s.tipo === 'HSS' ? ' · se diseña con 0.93·t' : ''}</text></svg>`;
}
// Propiedades principales (valores en las unidades de los catálogos: 10⁶ mm⁴, 10³ mm³)
function propsSeccion(s){
  if(!s) return [];
  // unidad según el tamaño: 10⁶ / 10³ / sin potencia, para que nunca salga 0.00
  const pot = (v, u) => v >= 1e6 ? `${fx(v/1e6, 2)} ×10⁶ ${u}` : v >= 1e3 ? `${fx(v/1e3, 1)} ×10³ ${u}` : `${fx(v, 1)} ${u}`;
  const e6 = v => pot(v, 'mm⁴'), e3 = v => pot(v, 'mm³');
  const p = [['Área A', fx(s.A, 0) + ' mm²'], ['Peso', fx(s.kgm, 2) + ' kg/m'],
    ['Ix', e6(s.Ix)], ['Sx', e3(s.Sx)], ['Zx', e3(s.Zx)], ['rx', fx(s.rx, 1) + ' mm']];
  if(s.tipo !== 'BAR') p.push(['Iy', e6(s.Iy)], ['Sy', e3(s.Sy)], ['Zy', e3(s.Zy)], ['ry', fx(s.ry, 1) + ' mm'], ['J', e6(s.J)]);
  if(s.tipo === 'I') p.push(['Cw', fx(s.Cw/1e9, 1) + ' ×10⁹ mm⁶']);
  if(s.tipo === 'HSS') p.push(['t de diseño', fx(s.t, 2) + ' mm']);
  return p;
}
function seccionHTML(e){
  const s = secDe(e); if(!s) return '<p class="hint">Escoge o escribe la sección para ver su dibujo y sus propiedades.</p>';
  return `<div class="sec-box">${svgSeccion(s)}<div class="sec-props">${propsSeccion(s).map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('')}</div></div>`;
}

// ═══ Bombillo 💡 de sugerencias (chequeos que no cumplen) ═══
// El recuadro es un solo elemento flotante (position: fixed) para que no lo corten las tablas con desplazamiento.
function bulbHTML(sg){
  if(!sg) return '';
  const cap = t => t ? t[0].toUpperCase() + t.slice(1) : '';
  const ops = sg.ops.map(o => `<div class="bt-op ${o.mejor ? 'mejor' : ''}">${o.mejor ? '<b>Cambio mínimo:</b> ' : ''}${o.t}${o.r != null ? ` → relación ${fx(o.r, 2)}${o.r <= 1 ? ' ✓' : ''}` : ''}${o.r != null && o.todo === true ? '<span class="bt-ok">cumplen todos los chequeos</span>' : o.r != null && o.todo === false ? '<span class="bt-no">otros chequeos siguen sin cumplir</span>' : ''}</div>`).join('');
  const html = `<div class="bt-t">💡 ${esc(cap(sg.tit))}: cómo hacer que cumpla</div>${sg.por ? `<div class="bt-por">${sg.por}</div>` : ''}${ops}<div class="bt-nota">Calculado con las mismas fuerzas. Es solo una sugerencia: no cambia tus datos.</div>`;
  return `<span class="bulb" tabindex="0" role="button" aria-label="Ver sugerencias para que cumpla">💡<template>${html}</template></span>`;
}
(function(){
  let tip = null, cierre = null, desde = 0;
  const ocultar = () => { if(tip) tip.hidden = true; };
  const mostrar = b => {
    clearTimeout(cierre);
    if(!tip){ tip = document.createElement('div'); tip.className = 'bulb-tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip);
      tip.addEventListener('mouseenter', () => clearTimeout(cierre)); tip.addEventListener('mouseleave', () => { cierre = setTimeout(ocultar, 200); }); }
    tip.innerHTML = b.querySelector('template').innerHTML; tip.hidden = false; desde = Date.now();
    const r = b.getBoundingClientRect(), w = Math.min(400, window.innerWidth - 16);
    tip.style.width = w + 'px';
    tip.style.left = Math.max(8, Math.min(r.right - w + 14, window.innerWidth - w - 8)) + 'px';
    const h = tip.offsetHeight, vh = window.innerHeight;
    tip.style.top = (r.bottom + 8 + h <= vh ? r.bottom + 8 : r.top - h - 8 >= 8 ? r.top - h - 8 : Math.max(8, vh - h - 8)) + 'px';
  };
  document.addEventListener('mouseover', e => { const b = e.target.closest?.('.bulb'); if(b) mostrar(b); });
  document.addEventListener('mouseout', e => { const b = e.target.closest?.('.bulb'); if(b && !b.contains(e.relatedTarget)) cierre = setTimeout(ocultar, 250); });
  document.addEventListener('focusin', e => { const b = e.target.closest?.('.bulb'); if(b) mostrar(b); });
  document.addEventListener('click', e => { const b = e.target.closest?.('.bulb'); if(b){ mostrar(b); return; } if(tip && !tip.contains(e.target)) ocultar(); });
  window.addEventListener('scroll', () => { if(Date.now() - desde > 400) ocultar(); }, true);
})();

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
  if($('#dSec')) $('#dSec').innerHTML = seccionHTML(e);
  let G = null; try{ G = await filasModelo(); }catch(err){ console.warn(err); }
  const R = calcMet(e, G);
  const b = $('#dRes'); if(!b || selMet !== e.id) return;
  if($('#dProg')){ $('#dProg').innerHTML = progHTML(e); activarProg(e); }
  if(!R || !R.ok){ b.innerHTML = `<div class="note amber">${esc(e.res?.error || 'Faltan datos.')}</div>`; return; }
  const filas = Object.entries(CHK).filter(([k]) => R.checks[k]).map(([k, [n, ref, u, cap, dem]]) => {
    const c = R.checks[k], f = c.f, col = c.r > 1 ? '#dc2626' : c.r > 0.9 ? '#d97706' : '#10b981';
    return [`<b>${n}</b> <span class="hint">${k === 'int' ? (f.ec || ref) : ref}</span>`, k === 'int' ? `P/φPn = ${fx(f.pr,3)} · ΣM/φMn = ${fx(f.mm,3)}` : `${fx(dem(f),2)} ${u}`, k === 'int' ? '1.00' : `${fx(cap(R),2)} ${u}`,
      `<span class="bar-d"><i style="width:${Math.min(100, c.r*100)}%;background:${col}"></i></span> <b>${fx(c.r,3)}</b>`, pill(c.r <= 1 ? 'ok' : 'no', c.r <= 1 ? 'Cumple' : 'No cumple') + (c.r > 1 && esIng() && R._uso && typeof Sugerir !== 'undefined' ? bulbHTML(Sugerir.metal(R._uso.el, R._uso.filas, k)) : ''), `<span class="ids">${filaTxt(f)}</span>`]; });
  b.innerHTML = `${tabla(['Chequeo','Demanda','Capacidad (φRn)','Relación','','Fila que controla'], filas)}
    <div class="wtot" style="background:${R.cumple ? '' : '#b91c1c'}"><span>Relación demanda / capacidad máxima (${R.filas} filas revisadas${R.Fc ? ` · controla el elemento E${esc(R.Fc)}` : ''})</span><span>${fx(R.ratio,3)} — ${R.cumple ? 'CUMPLE' : 'NO CUMPLE'}</span></div>
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
    <div class="ax-mapas" style="grid-template-columns:1fr 1.5fr;align-items:center"><figure>${svgSeccion(R.s)}</figure>
      <table class="ax-kv">${(ps => ps.filter((_, i) => i % 2 === 0).map((q, i) => `<tr><td>${q[0]}</td><td>${q[1]}</td>${ps[2*i+1] ? `<td>${ps[2*i+1][0]}</td><td>${ps[2*i+1][1]}</td>` : '<td></td><td></td>'}</tr>`).join(''))(propsSeccion(R.s))}</table></div>
    <table class="ax-kv"><tr><td>Longitudes Lx · Ly · Lb · Lz [m]${R.Fc ? ` (elemento ${esc(R.Fc)}, el que controla)` : ''}</td><td>${[R.Lx, R.Ly, R.Lb, R.Lz].map(v => fx(v/1000,2)).join(' · ')}</td></tr>
      ${R.s.tipo !== 'BAR' ? `<tr><td>Kx · Ky · Kz · Cb</td><td>${R.Kx} · ${R.Ky} · ${R.Kz} · ${R.Cb}</td></tr>` : ''}
      <tr><td>Fuerzas</td><td>${e.fuerzas === 'manual' ? 'escritas por el diseñador' : `grupo ${esc(e.grupo.replace('|', ' · '))} — ${R.filas} filas de resultados${e.res?.porEl?.length > 1 ? `, ${e.res.porEl.length} elementos revisados uno por uno` : ''}`}</td></tr>
      ${e.res?.porEl ? `<tr><td>Longitudes arriostradas y Cb</td><td>datos de cálculo${e.res.porEl.length > 1 ? ' de cada elemento' : ''}</td></tr>` : ''}</table>
    ${swPrintHTML(e)}
    ${tb(['Chequeo','Demanda','Capacidad φRn','Relación','Fila que controla'], Object.entries(CHK).filter(([k]) => R.checks[k]).map(([k, [n, ref, u, cap, dem]]) => { const ch = R.checks[k], fl = ch.f;
      return [`${n} (${k === 'int' ? fl.ec : ref})`, k === 'int' ? `${fx(fl.pr,3)} / ${fx(fl.mm,3)}` : `${fx(dem(fl),2)} ${u}`, k === 'int' ? '≤ 1.00' : `${fx(cap(R),2)} ${u}`, fx(ch.r,3), filaTxt(fl)]; }))}
    <div class="ax-box">Relación máxima = ${fx(R.ratio,3)} — ${R.cumple ? 'CUMPLE' : 'NO CUMPLE'}</div>
    ${R.avisos.map(a => `<p class="ax-nota">${esc(a)}</p>`).join('')}
    ${detalleMetHTML(R, true)}</section>`).join('')}${conc}</div>`;
}
