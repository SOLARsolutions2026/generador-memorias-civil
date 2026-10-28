/* ═══ Pantalla del Anexo C — Modelo SAP2000 (usa calc/anexoC.js) ═══ */
'use strict';
function datosC(){
  const m = S.m; m.anexos = m.anexos || {};
  const C = m.anexos.C = m.anexos.C || {};
  const d = { archivo:null, modelo:null, img:'', notaImg:'', descripcion:'', completas:false, sinPeso:null };
  for(const k in d) if(C[k] === undefined) C[k] = d[k];
  return C;
}
const sinPesoC = C => C.sinPeso || (C.modelo?.secciones || []).filter(s => s.riel).map(s => s.s);
const dirTxt = d => `${d.sis === 'Local' ? 'Local ' : d.sis && d.sis !== 'GLOBAL' ? d.sis + ' ' : ''}${d.dir === 'Gravity' ? 'Gravedad' : d.dir}`;
const descDefC = M => `La estructura se modeló en ${M.prog} v${M.ver} como un sistema tridimensional de ${M.nudos.n} nudos y ${M.frames} elementos tipo pórtico, con las propiedades de los materiales, las secciones y las cargas que se presentan en este anexo.`;
let _txtSap = null;   // texto del .$2k ya descargado (para las tablas completas)

async function textoModelo(C){
  if(_txtSap && _txtSap.path === C.archivo?.path && _txtSap.fecha === C.archivo?.fecha) return _txtSap.t;
  const { data, error } = await sb.storage.from(BUCKET).download(C.archivo.path);
  if(error) throw error;
  const t = await data.text(); _txtSap = { path:C.archivo.path, fecha:C.archivo.fecha, t }; return t;
}

async function cargarModeloC(f){
  const C = datosC();
  if(!f) return;
  if(!/\.(\$2k|s2k|txt)$/i.test(f.name)) return toast('Ese archivo no es un modelo de SAP2000 en texto (.$2k).', 4500);
  try{
    toast('Leyendo el modelo…', 15000);
    const t = await f.text(), M = AnexoC.analizar(t);
    // huella del contenido: avisa si se vuelve a subir el mismo archivo (pasa cuando SAP lo guardó en otra carpeta)
    let hh = 5381; for(let i = 0; i < t.length; i++) hh = ((hh << 5) + hh + t.charCodeAt(i)) | 0;
    const firma = (hh >>> 0).toString(36) + '-' + t.length;
    if(C.archivo?.firma === firma && !confirm('Este archivo es idéntico al que ya está cargado.\n\n¿Seguro que es el archivo nuevo? Si exportaste de nuevo desde SAP, revisa la carpeta donde se guardó.\n\nAceptar = subirlo igual · Cancelar = escoger otro')) return toast('No se cambió el modelo.');
    if(!M.ok) return toast(M.error, 6000);
    const path = `${S.m.id}/modelo-sap.s2k`;
    toast('Guardando el archivo…', 15000);
    await subir(path, new Blob([t], { type:'text/plain' }), 'text/plain');
    C.archivo = { nombre:f.name, path, fecha:new Date().toISOString(), kb:Math.round(f.size / 1024), firma };
    delete M.tablas; C.modelo = M; C.sinPeso = null; _txtSap = { path, fecha:C.archivo.fecha, t };
    guardarMemoria(); toast(`Modelo leído: ${M.nudos.n} nudos, ${M.frames} elementos.`); renderWS('C');
  }catch(e){ err(e, 'No se pudo cargar el modelo'); }
}

let tabC = 'modelo';   // pestaña del Anexo C: información del modelo | resultados
function paneAnexoC(){
  const C = datosC(), M = C.modelo, ro_ = esIng() ? '' : 'disabled';
  const pasos = `<ol class="pasos-sap"><li>En SAP2000: <b>File → Export → SAP2000 .s2k Text File…</b></li><li>Deja marcadas todas las tablas y unidades <b>KN, m, C</b>.</li><li>Guarda el archivo y súbelo aquí.</li></ol>`;
  let h = `<div class="card"><div class="ct">Archivo del modelo SAP2000</div>`;
  if(!M) h += `<p class="lead" style="margin-bottom:10px">La app lee el archivo de texto del modelo y arma sola las tablas del Anexo C.</p>${pasos}
      ${esIng() ? `<button class="drop-img" type="button" id="subeS2k" style="max-width:none;min-height:110px;margin-top:10px"><div class="ph-in"><div style="font-size:22px">📂</div><b>Subir archivo .$2k</b><br/>toca o arrastra aquí</div></button>` : '<p class="muted">Aún no se ha cargado el modelo.</p>'}</div>`;
  else {
    const fecha = new Date(C.archivo.fecha).toLocaleString('es-CO', { dateStyle:'medium', timeStyle:'short' });
    h += `<div class="sap-file"><div class="sap-ico">📄</div><div><b>${esc(C.archivo.nombre)}</b> <span class="hint">(${C.archivo.kb} KB · cargado ${esc(fecha)})</span>
        <div class="hint">${esc(M.prog)} v${esc(M.ver)} · unidades ${esc(M.unidades || '—')} · ${M.nudos.n} nudos · ${M.frames} elementos · ${M.patrones.length} patrones de carga</div></div>
        <div class="sap-acc">${esIng() ? '<button class="btn sm" type="button" id="subeS2k">🔄 Reemplazar</button>' : ''}<button class="btn sm" type="button" id="bajaS2k">⬇ Descargar</button></div></div>
      <details class="hint" style="margin-top:8px"><summary>¿Cómo exportar el archivo desde SAP2000?</summary>${pasos}<p>Si cambias el modelo (otra iteración), exporta de nuevo y usa <b>Reemplazar</b>.</p></details></div>`;
    const nRes = M.fuerzas?.n ? `<span class="tab-n">${M.fuerzas.grupos.length}</span>` : '<span class="tab-n vacio">sin datos</span>';
    h += `<div class="tabs" role="tablist" style="margin-top:4px"><button type="button" role="tab" data-tabc="modelo" class="${tabC === 'modelo' ? 'on' : ''}">Información del modelo</button><button type="button" role="tab" data-tabc="res" class="${tabC === 'res' ? 'on' : ''}">Resultados ${nRes}</button></div>
      <div data-tc="modelo" ${tabC === 'modelo' ? '' : 'hidden'}>`;
    h += `<div class="card"><div class="ct">Revisión con los Anexos A y B <span class="pill gray">solo en pantalla</span></div><div id="revC"></div></div>`;
    const mat = M.materiales;
    h += `<div class="card"><div class="ct">C-1 Propiedades de materiales</div>${tabla(['Material','Tipo','γ [kN/m³]','E [MPa]','ν','Fy [MPa]','Fu [MPa]'],
        mat.map(m => [esc(m.n), esc(m.tipo), fx(m.gamma,2), fx(m.E,0), m.nu == null ? '—' : fx(m.nu,2), m.Fy ? fx(m.Fy,0) : '—', m.Fu ? fx(m.Fu,0) : '—']))}</div>`;
    h += `<div class="card"><div class="ct">C-2 Modelación estructural ${esc(M.prog)} v${esc(M.ver)}</div>
        <div class="f"><label for="descC">Descripción (sale en la memoria)</label><textarea id="descC" rows="3" ${ro_}>${esc(C.descripcion || descDefC(M))}</textarea><div class="hint">Vacío = texto predeterminado.</div></div>
        <div class="img-c">${C.img ? `<div class="drop-img has" id="imgC" style="max-width:none"><span class="muted">Cargando imagen…</span></div>` :
          esIng() ? `<button class="drop-img" type="button" id="imgC" style="max-width:none;min-height:110px"><div class="ph-in"><div style="font-size:20px">🖼️</div><b>Agregar imagen del modelo</b><br/>toca o arrastra aquí</div></button>` : '<p class="muted">Sin imagen.</p>'}
          ${C.img && esIng() ? '<div style="display:flex;gap:6px;margin-top:6px"><button class="btn sm" type="button" id="camImgC">🔄 Cambiar imagen</button><button class="btn sm danger" type="button" id="delImgC">Quitar</button></div>' : ''}</div>
        <div class="f" style="margin-top:8px"><label for="notaImgC">Pie de la imagen</label><input id="notaImgC" value="${esc(C.notaImg)}" placeholder="Vista 3D del modelo en SAP2000" ${ro_}/></div></div>`;
    h += `<div class="card"><div class="ct">C-3 Patrones de carga</div>${tabla(['Patrón','Tipo en SAP2000','Se interpreta como','Multiplicador peso propio','Carga automática'],
        M.patrones.map(p => [esc(p.n), esc(p.tipo), 'Carga ' + AnexoC.NOM_CAT[p.cat], fx(p.swm,0), esc(p.auto || '—')]))}</div>`;
    h += `<div class="card"><div class="ct">C-4 Nudos del sistema aporticado</div>
        ${tabla(['Nudos','X [m]','Y [m]','Z [m]','Apoyos'], [[String(M.nudos.n), `${fx(M.nudos.x[0],2)} a ${fx(M.nudos.x[1],2)}`, `${fx(M.nudos.y[0],2)} a ${fx(M.nudos.y[1],2)}`, `${fx(M.nudos.z[0],2)} a ${fx(M.nudos.z[1],2)}`, String(M.nudos.apoyos.length)]])}
        ${M.nudos.apoyos.length ? `<h4 class="sub">Apoyos</h4>${tabla(['Nudo','X [m]','Y [m]','Z [m]','Restricción'], M.nudos.apoyos.map(a => [esc(a.j), fx(a.x,3), fx(a.y,3), fx(a.z,3), esc(a.tipo)]))}` : ''}</div>`;
    const ex = new Set(sinPesoC(C)), pp = AnexoC.pesoPropio(M, [...ex]), bOn = S.m.anexos?.B?.aplica !== false;
    h += `<div class="card"><div class="ct">C-5 Secciones asignadas al modelo</div>
        ${tabla(['Sección','Tipo','Material','Elementos','Longitud total [m]','Peso [kN]','¿Suma al peso propio?'], M.secciones.map(s => [esc(s.s), esc(s.tipo), esc(s.mat), String(s.n), fx(s.L,2), s.area ? fx(s.kN,2) : '—',
          `<label class="chk"><input type="checkbox" data-sp="${esc(s.s)}" ${ex.has(s.s) ? '' : 'checked'} ${ro_}/> ${ex.has(s.s) ? 'No' : 'Sí'}</label>`]))}
        <div class="wtot"><span>Peso propio del modelo</span><span>${fx(pp,2)} kN (${fx(pp*1000/AnexoA.G,0)} kg)</span></div>
        <div class="hint" style="margin-top:6px">Peso = área de la sección × longitud × peso unitario del material. Los rieles se quitan por defecto porque su peso ya está en las cargas del Anexo A.${M.secciones.some(s => s.sinLong) ? ' <b>El archivo no trae la tabla de conectividad: no se pudo calcular la longitud.</b>' : ''}</div>
        ${esIng() && bOn ? `<button class="btn sm grn" type="button" id="aB" style="margin-top:8px">➜ Usar este peso en el Anexo B (bloque ②)</button>` : ''}</div>`;
    const cg = (rows) => tabla(['Patrón','Dirección','Carga','Elementos','Cuáles'], rows);
    h += `<div class="card"><div class="ct">C-6 Cargas asignadas a los elementos</div>
        <h4 class="sub">Distribuidas</h4>${M.dist.length ? cg(M.dist.map(d => [esc(d.pat), esc(dirTxt(d)), `${fx(d.a,3)}${d.b !== d.a ? ' → ' + fx(d.b,3) : ''} kN/m`, String(d.n), `<span class="ids">${esc(d.ids)}</span>`])) : '<p class="muted">No hay.</p>'}
        ${M.punt.length ? `<h4 class="sub">Puntuales en elementos</h4>${cg(M.punt.map(d => [esc(d.pat), esc(dirTxt(d)), `${fx(d.P,3)} kN a ${fx(d.rel,2)} L`, String(d.n), `<span class="ids">${esc(d.ids)}</span>`]))}` : ''}
        ${M.nudosF.length ? `<h4 class="sub">En nudos (sumas por patrón)</h4>${tabla(['Patrón','ΣF1 [kN]','ΣF2 [kN]','ΣF3 [kN]','ΣM3 [kN·m]','Nudos'], M.nudosF.map(o => [esc(o.pat), fx(o.F1,2), fx(o.F2,2), fx(o.F3,2), fx(o.M3,2), `<span class="ids">${esc(o.ids)}</span>`]))}` : ''}</div>`;
    h += `</div><div data-tc="res" ${tabC === 'res' ? '' : 'hidden'}>` + fuerzasCardHTML(C, M) + '</div>';
    h += `<div class="card"><div class="ct">Páginas del Anexo C</div>
        <p class="lead" style="margin-bottom:10px">En la memoria salen los resúmenes. Las tablas completas (cada nudo, cada elemento y cada carga) son opcionales y ocupan varias páginas.</p>
        <label class="chk" style="margin-bottom:10px"><input type="checkbox" id="compC" ${C.completas ? 'checked' : ''} ${ro_}/> Incluir también las tablas completas</label><br/>
        <button class="btn grn" type="button" id="printC">🖨 Imprimir / Guardar PDF del Anexo C</button></div>`;
  }
  pane(h);
  if(M) pintarRevC();
  $$('[data-tabc]').forEach(b => b.onclick = () => { tabC = b.dataset.tabc;
    $$('[data-tabc]').forEach(x => x.classList.toggle('on', x === b)); $$('[data-tc]').forEach(d => d.hidden = d.dataset.tc !== tabC); });
  if(C.img) urlDe(C.img).then(u => { const b = $('#imgC'); if(b) b.innerHTML = u ? `<img src="${esc(u)}" alt="Imagen del modelo" style="max-width:100%;max-height:340px"/>` : '<span class="muted">No se encontró la imagen.</span>'; });
  if($('#bajaS2k')) $('#bajaS2k').onclick = async () => { const u = await urlDe(C.archivo.path); if(!u) return toast('No se encontró el archivo.');
    const a = document.createElement('a'); a.href = u; a.download = C.archivo.nombre; a.click(); };
  if($('#printC')) $('#printC').onclick = () => imprimirC(C);
  if(!esIng()) return;
  const zona = (el, accept, fn) => { if(!el) return;
    el.onclick = async () => { const f = await elegirArchivo(accept); if(f) fn(f); };
    el.ondragover = e => { e.preventDefault(); el.classList.add('over'); }; el.ondragleave = () => el.classList.remove('over');
    el.ondrop = e => { e.preventDefault(); el.classList.remove('over'); const f = e.dataTransfer.files[0]; if(f) fn(f); }; };
  zona($('#subeS2k'), '.$2k,.s2k,.txt', cargarModeloC);
  if(!M) return;
  const subeImg = async f => { if(!f.type.startsWith('image/')) return toast('Ese archivo no es una imagen.');
    try{ toast('Subiendo imagen…', 15000); const blob = await comprimir(f, { max:2000, type:'image/jpeg', q:0.85 }), path = `${S.m.id}/modelo-sap.jpg`;
      await subir(path, blob, 'image/jpeg'); C.img = path; guardarMemoria(); toast('Imagen guardada.'); renderWS('C'); }catch(e){ err(e, 'No se pudo subir la imagen'); } };
  if(!C.img) zona($('#imgC'), 'image/*', subeImg);
  if($('#camImgC')) $('#camImgC').onclick = async () => { const f = await elegirArchivo('image/*'); if(f) subeImg(f); };
  if($('#delImgC')) $('#delImgC').onclick = async () => { await sb.storage.from(BUCKET).remove([C.img]); C.img = ''; guardarMemoria(); renderWS('C'); };
  $('#descC').oninput = e => { C.descripcion = e.target.value.trim() === descDefC(M) ? '' : e.target.value; guardarMemoria(); };
  $('#notaImgC').oninput = e => { C.notaImg = e.target.value; guardarMemoria(); };
  $('#compC').onchange = e => { C.completas = e.target.checked; guardarMemoria(); };
  activarFuerzas(C, M);
  $$('[data-sp]').forEach(i => i.onchange = () => { const ex = new Set(sinPesoC(C)); i.checked ? ex.delete(i.dataset.sp) : ex.add(i.dataset.sp); C.sinPeso = [...ex]; guardarMemoria(); paneAnexoC(); });
  if($('#aB')) $('#aB').onclick = () => {
    const B = datosB(), pp = AnexoC.pesoPropio(M, sinPesoC(C));
    B.estructura.modo = 'sap'; B.estructura.sapKN = String(pp); B.estructura.sapFuente = `${M.prog} v${M.ver} — modelo ${C.archivo.nombre} (Anexo C)`;
    guardarMemoria(); toast(`Listo: ${fx(pp,2)} kN quedó como peso propio en el Anexo B.`, 3500);
  };
}

function pintarRevC(){
  const C = datosC(), el = $('#revC'); if(!el) return;
  const A = datosA(), RA = AnexoA.calcular(A), bOn = S.m.anexos?.B && S.m.anexos.B.aplica !== false;
  const RB = bOn ? calcB() : null;
  const K = S.m.anexos?.K, CB = K && typeof Combos !== 'undefined' ? Combos.calcular(K, bOn).activas : null;
  const filas = AnexoC.revisar(C.modelo, RA, RB, CB);
  const n = k => filas.filter(f => f.estado === k).length;
  const ic = { ok:'✓', no:'✗', info:'!' };
  const grupos = [...new Set(filas.map(f => f.grupo))];
  el.innerHTML = `<div class="rev-res">${pill('ok', n('ok') + ' coinciden')} ${n('no') ? pill('no', n('no') + ' no coinciden') : ''} ${n('info') ? pill('pend', n('info') + ' para revisar') : ''}</div>
    ${grupos.map(g => `<h4 class="sub">${esc(g)}</h4><ul class="rev">${filas.filter(f => f.grupo === g).map(f => `<li class="${f.estado}"><span class="ri">${ic[f.estado]}</span><span>${esc(f.txt)}</span></li>`).join('')}</ul>`).join('')}
    <div class="hint" style="margin-top:6px">Compara las cargas del modelo con las del Anexo A (tolerancia 3 %) y las fuerzas sísmicas con la FHE del Anexo B. ${bOn ? '' : 'El Anexo B no aplica o no tiene datos: no se revisa el sismo.'}</div>`;
}

// ═══ Páginas imprimibles del Anexo C ═══
async function imprimirC(C){
  const M = C.modelo; if(!M) return;
  try{
    let K = null;
    if(C.completas){ toast('Preparando las tablas completas…', 15000); K = AnexoC.completas(await textoModelo(C)); }
    const url = C.img ? await urlDe(C.img) : null;
    const pa = $('#print-area'); pa.innerHTML = anexoCPrintHTML(C, M, K, url);
    await Promise.all([...pa.querySelectorAll('img')].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
    await document.fonts.ready; toast('Listo.', 800); imprimirConMargen(`${S.m.consecutivo}_ANEXO_C`);
  }catch(e){ err(e, 'No se pudo preparar el Anexo C'); }
}

function anexoCPrintHTML(C, M, K, url){
  const m = S.m, f = m.ficha, c = S.cfg, L = 'C';
  const fecha = f.fecha ? new Date(f.fecha + 'T12:00').toLocaleDateString('es-CO', { month:'long', year:'numeric' }) : '';
  const tb = (cab, filas, tot, cls='') => `<table class="ax-tb ${cls}"><thead><tr>${cab.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${filas.map(r => `<tr>${r.map((x,i) => `<td class="${i?'c':''}">${x}</td>`).join('')}</tr>`).join('')}${tot ? `<tr class="tot"><td colspan="${cab.length-1}" style="text-align:right">${tot[0]}</td><td class="c">${tot[1]}</td></tr>` : ''}</tbody></table>`;
  // Tabla larga en varias columnas para ahorrar papel: [a,b,c] [a,b,c] ...
  const multi = (cab, filas, k) => { const n = Math.ceil(filas.length / k), out = [];
    for(let i = 0; i < n; i++){ const r = []; for(let j = 0; j < k; j++){ const x = filas[i + j*n]; r.push(...(x || cab.map(() => ''))); } out.push(r); }
    return `<table class="ax-tb larga multi"><thead><tr>${Array.from({ length:k }, () => cab.map(x => `<th>${x}</th>`).join('')).join('')}</tr></thead><tbody>${out.map(r => `<tr>${r.map((x,i) => `<td class="${i % cab.length ? 'c' : 'g'}">${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`; };
  const ex = new Set(sinPesoC(C)), pp = AnexoC.pesoPropio(M, [...ex]);
  const secs = M.secciones;
  return `<div class="ax"><section>
    <div class="ax-hd"><div class="ax-t">ANEXO ${L} - MODELO SOFTWARE ${esc(M.prog)}</div><div class="ax-n">Datos ingresados al software</div><div class="ax-n2">Diseño de elementos metálicos</div>
      <table class="ax-id"><tr><td><b>Proyecto:</b></td><td>${esc(f.proyecto||m.titulo||'')}</td><td><b>Ingeniero:</b></td><td>${esc((c.nombre_firma||'').replace(/^ING\.\s*/,''))}</td></tr>
      <tr><td><b>Proyecto No.:</b></td><td>${esc(m.consecutivo)}</td><td><b>Fecha:</b></td><td>${esc(fecha)}</td></tr></table></div>
    <h3>${L}-1 Propiedades de materiales</h3>
    ${tb(['Material','Tipo','γ [kN/m³]','E [MPa]','ν','Fy [MPa]','Fu [MPa]'], M.materiales.map(x => [esc(x.n), esc(x.tipo), fx(x.gamma,2), fx(x.E,0), x.nu == null ? '—' : fx(x.nu,2), x.Fy ? fx(x.Fy,0) : '—', x.Fu ? fx(x.Fu,0) : '—']))}
    <h3>${L}-2 Modelación estructural ${esc(M.prog)} v${esc(M.ver)}</h3>
    <p>${esc(C.descripcion || descDefC(M))}</p>
    ${url ? `<figure class="ax-fig"><img src="${esc(url)}" style="max-width:100%;max-height:4in" alt=""/><figcaption>${esc(C.notaImg || `Modelo estructural en ${M.prog}.`)}</figcaption></figure>` : ''}
    <h3>${L}-3 Consideraciones de cargas utilizadas</h3>
    ${tb(['Patrón de carga','Tipo','Multiplicador de peso propio','Carga automática'], M.patrones.map(p => [esc(p.n), esc(p.tipo), fx(p.swm,0), esc(p.auto || '—')]))}
    <p>El peso propio de los elementos lo calcula el programa en el patrón con multiplicador 1. Las demás cargas corresponden a los Anexos A${S.m.anexos?.B?.aplica !== false ? ' y B' : ''}.</p>
  </section><section>
    <h3>${L}-4 Coordenadas de los nudos del sistema aporticado</h3>
    ${tb(['Total de nudos','X [m]','Y [m]','Z [m]'], [[M.nudos.n, `${fx(M.nudos.x[0],2)} a ${fx(M.nudos.x[1],2)}`, `${fx(M.nudos.y[0],2)} a ${fx(M.nudos.y[1],2)}`, `${fx(M.nudos.z[0],2)} a ${fx(M.nudos.z[1],2)}`]])}
    ${M.nudos.apoyos.length ? `<h4>Apoyos</h4>${tb(['Nudo','X [m]','Y [m]','Z [m]','Restricción'], M.nudos.apoyos.map(a => [esc(a.j), fx(a.x,3), fx(a.y,3), fx(a.z,3), esc(a.tipo)]))}` : ''}
    <h3>${L}-5 Secciones asignadas al modelo</h3>
    ${tb(['Sección','Tipo','Material','Elementos','Longitud total [m]','Peso [kN]'], secs.map(s => [esc(s.s), esc(s.tipo), esc(s.mat), s.n, fx(s.L,2), s.area ? fx(s.kN,2) + (ex.has(s.s) ? '*' : '') : '—']),
      ['Peso propio de la estructura', fx(pp,2)])}
    ${ex.size ? `<p style="font-size:9pt">* No se suma al peso propio: su peso ya está incluido en las cargas del Anexo A.</p>` : ''}
    <h3>${L}-6 Cargas asignadas a los elementos</h3>
    ${M.dist.length ? `<h4>Cargas distribuidas</h4>${tb(['Patrón','Dirección','Carga [kN/m]','Elementos','Cuáles'], M.dist.map(d => [esc(d.pat), esc(dirTxt(d)), `${fx(d.a,3)}${d.b !== d.a ? ' → ' + fx(d.b,3) : ''}`, d.n, esc(d.ids)]), null, 'ids')}` : ''}
    ${M.punt.length ? `<h4>Cargas puntuales en elementos</h4>${tb(['Patrón','Dirección','Carga [kN]','Posición','Elementos','Cuáles'], M.punt.map(d => [esc(d.pat), esc(dirTxt(d)), fx(d.P,3), fx(d.rel,2) + ' L', d.n, esc(d.ids)]), null, 'ids')}` : ''}
    ${M.nudosF.length ? `<h4>Cargas en nudos (sumas por patrón)</h4>${tb(['Patrón','ΣF1 [kN]','ΣF2 [kN]','ΣF3 [kN]','ΣM3 [kN·m]','Nudos'], M.nudosF.map(o => [esc(o.pat), fx(o.F1,2), fx(o.F2,2), fx(o.F3,2), fx(o.M3,2), esc(o.ids)]), null, 'ids')}` : ''}
  </section>
  ${M.fuerzas?.grupos?.length ? `<section><h3>${L}-7 Resultados del análisis: fuerzas en los elementos</h3>${fuerzasPrintHTML(M.fuerzas, tb)}</section>` : ''}
  ${K ? `<section><h3>${L}-8 Tablas completas del modelo</h3>
    <h4>Coordenadas de los nudos</h4>${multi(['Nudo','X [m]','Y [m]','Z [m]'], K.nudos.map(r => [esc(r[0]), fx(r[1],3), fx(r[2],3), fx(r[3],3)]), 3)}
    <h4>Secciones asignadas a cada elemento</h4>${multi(['Elem.','Sección','L [m]'], K.secciones.map(r => [esc(r[0]), esc(r[5]), r[3] == null ? '—' : fx(r[3],2)]), 3)}
    ${K.dist.length ? `<h4>Cargas distribuidas por elemento</h4>${multi(['Elem.','Patrón','Dir.','kN/m'], K.dist.map(r => [esc(r[0]), esc(r[1]), esc(dirTxt({ sis:r[2], dir:r[4] })), fx(r[5],3) + (r[6] !== r[5] ? '→' + fx(r[6],3) : '')]), 2)}` : ''}
    ${K.punt.length ? `<h4>Cargas puntuales por elemento</h4>${multi(['Elem.','Patrón','Dir.','Pos.','kN'], K.punt.map(r => [esc(r[0]), esc(r[1]), esc(dirTxt({ sis:r[2], dir:r[4] })), fx(r[5],2), fx(r[6],3)]), 2)}` : ''}
    ${K.jl.length ? `<h4>Cargas en nudos</h4>${tb(['Nudo','Patrón','F1 [kN]','F2 [kN]','F3 [kN]','M1','M2','M3 [kN·m]'], K.jl.map(r => [esc(r[0]), esc(r[1]), ...r.slice(2).map(v => fx(v,3))]), null, 'larga')}` : ''}
  </section>` : ''}</div>`;
}

// ═══ C-7 Fuerzas en los elementos (resultados de SAP2000) ═══
const FZ_U = { P:'kN', V2:'kN', V3:'kN', T:'kN·m', M2:'kN·m', M3:'kN·m' };
const CRIT_N = { comp:'Máx. compresión', tens:'Máx. tensión', M3:'Máx. |M3|', M2:'Máx. |M2|', V2:'Máx. |V2|', V3:'Máx. |V3|', T:'Máx. |T|' };
const CRIT_K = { comp:'P', tens:'P', M3:'M3', M2:'M2', V2:'V2', V3:'V3', T:'T' };
const filaCrit = f => `E${esc(f.F)} · ${esc(f.c)}${f.step ? ' (' + esc(f.step) + ')' : ''}`;
function critUnicos(g){ // quita filas repetidas (la misma fila puede ser crítica en varias fuerzas)
  const vistos = new Map();
  for(const [k, f] of Object.entries(g.crit)){ if(!f) continue; if(k === 'tens' && !(f.P > 0)) continue; if(k === 'comp' && !(f.P < 0)) continue;
    if(!['comp','tens'].includes(k) && !Math.abs(f[CRIT_K[k]])) continue;
    const id = [f.F, f.c, f.st, f.step].join('|'); if(vistos.has(id)) vistos.get(id).k.push(k); else vistos.set(id, { f, k:[k] }); }
  return [...vistos.values()];
}
function fuerzasCardHTML(C, M){
  const Fz = M.fuerzas;
  if(!Fz?.n) return `<div class="card"><div class="ct">C-7 Fuerzas en los elementos (resultados SAP2000)</div>
    <div class="note blue">Para traer las fuerzas, al exportar el .s2k marca también <b>Analysis Results → Element Output → Frame Output → Element Forces – Frames</b> y, en <b>Select Load Cases</b>, las combinaciones de diseño. Luego usa «Reemplazar». La app condensa las miles de filas por grupo de elementos.</div></div>`;
  const ro_ = esIng() ? '' : 'disabled', res = new Set(Fz.res);
  return `<div class="card"><div class="ct">C-7 Fuerzas en los elementos (resultados SAP2000) <span class="pill gray">${Fz.n.toLocaleString('es-CO')} filas → ${Fz.grupos.length} grupos</span></div>
    <div class="f"><label>Combinaciones que se usan para diseñar (resistencia)</label>
      <div class="chips-c">${Fz.casos.map(c => `<label class="chip-c ${res.has(c) ? 'on' : ''}"><input type="checkbox" data-fres="${esc(c)}" ${res.has(c) ? 'checked' : ''} ${ro_}/> ${esc(c)}</label>`).join('')}</div>
      <div class="hint">La app deja fuera, por defecto, las de servicio (p. ej. 1.0D + 1.0Lr) y las envolventes sin carga muerta (derivas). Puedes cambiarlo.</div></div>
    ${Fz.envMaxMin ? '<div class="note amber" style="margin-top:8px">Algunas combinaciones vienen como envolvente (filas Max/Min). En esas filas las fuerzas no son estrictamente simultáneas: es el resultado normal del método de envolventes y queda del lado de la seguridad.</div>' : ''}
    <div class="hint" style="margin:8px 0">Por grupo (sección + función según la geometría): ① envolvente con el elemento y la combinación de cada valor (referencia) y ② filas críticas con las fuerzas que ocurren al tiempo, que son las que se usarán en el Anexo D.</div>
    ${Fz.grupos.map((g, i) => `<details class="fz-g" ${i === 0 ? 'open' : ''}><summary><b>${esc(g.sec)}</b> · ${esc(g.fun)} <span class="hint">· ${g.n} elemento${g.n > 1 ? 's' : ''} · Pmín ${fx(g.env.P.min?.P,2)} kN · |M3|máx ${fx(Math.max(Math.abs(g.env.M3.max?.M3 || 0), Math.abs(g.env.M3.min?.M3 || 0)),2)} kN·m</span></summary>
      <div class="hint">Elementos: ${esc(g.ids)}</div>
      <h4 class="sub">① Envolvente</h4>${tabla(['', ...Object.keys(FZ_U).map(k => `${k} [${FZ_U[k]}]`)], ['max','min'].map(m => [`<b>${m === 'max' ? 'Máx' : 'Mín'}</b>`,
        ...Object.keys(FZ_U).map(k => { const f = g.env[k][m]; return f ? `${fx(f[k],2)}<div class="ids">E${esc(f.F)} · ${esc(f.c)}</div>` : '—'; })]), 'fz-tb')}
      <h4 class="sub">② Filas críticas (fuerzas que actúan al mismo tiempo)</h4>${tabla(['Caso','Elemento · combinación', ...Object.keys(FZ_U)], critUnicos(g).map(({ f, k }) => [
        `<b>${k.map(x => CRIT_N[x]).join('<br/>')}</b>`, `${filaCrit(f)}<div class="ids">estación ${fx(f.st,2)} m</div>`,
        ...Object.keys(FZ_U).map(q => `<span class="${k.some(x => CRIT_K[x] === q) ? 'fz-hl' : ''}">${fx(f[q],2)}</span>`)]), 'fz-tb')}</details>`).join('')}</div>`;
}
function activarFuerzas(C, M){
  $$('[data-fres]').forEach(i => i.onchange = async () => {
    const res = new Set(M.fuerzas.res); i.checked ? res.add(i.dataset.fres) : res.delete(i.dataset.fres);
    if(!res.size){ i.checked = true; return toast('Deja al menos una combinación.'); }
    try{ toast('Recalculando las fuerzas…', 15000); M.fuerzas = AnexoC.fuerzas(await textoModelo(C), [...res]); guardarMemoria(); toast('Listo.'); paneAnexoC(); }
    catch(e){ err(e, 'No se pudo recalcular'); }
  });
}
function fuerzasPrintHTML(Fz, tb){
  return `<p>Fuerzas obtenidas del análisis en ${esc(String(Fz.n))} filas de resultados, condensadas por grupo de elementos (sección y función). Combinaciones de resistencia usadas: ${Fz.res.map(esc).join('; ')}.
    Para cada grupo se presenta la envolvente (valor máximo y mínimo de cada fuerza, con el elemento y la combinación donde ocurre) y las filas críticas con las fuerzas que actúan simultáneamente, que son las que se emplean en el diseño de los elementos.</p>
    ${Fz.grupos.map(g => `<h4>${esc(g.sec)} — ${esc(g.fun)} (${g.n} elemento${g.n > 1 ? 's' : ''})</h4>
      ${tb(['', ...Object.keys(FZ_U).map(k => `${k} [${FZ_U[k]}]`)], ['max','min'].map(m => [m === 'max' ? 'Máx' : 'Mín',
        ...Object.keys(FZ_U).map(k => { const f = g.env[k][m]; return f ? `${fx(f[k],2)}<br/><span style="font-size:7pt">E${esc(f.F)} · ${esc(f.c)}</span>` : '—'; })]), null, 'fz-p')}
      ${tb(['Caso','Elemento · combinación', ...Object.keys(FZ_U)], critUnicos(g).map(({ f, k }) => [k.map(x => CRIT_N[x]).join(' / '), filaCrit(f) + ` · x = ${fx(f.st,2)} m`, ...Object.keys(FZ_U).map(q => fx(f[q],2))]), null, 'fz-p')}`).join('')}`;
}
