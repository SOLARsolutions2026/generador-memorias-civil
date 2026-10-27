/* ═══ Pantalla del Anexo A — Cargas (usa calc/anexoA.js) ═══
   Se carga antes de app.js; usa sus utilidades ($, esc, pill, S, pane, guardarMemoria) cuando se abre. */
'use strict';
let tabA = 'cubierta';
const fx = (x, d=3) => (x == null || !isFinite(x)) ? '—' : Number(x).toFixed(d);

function datosA(){
  const m = S.m; m.anexos = m.anexos || {};
  if(!m.anexos.A){
    const d = AnexoA.defaults(), f = m.ficha || {};
    m.anexos.A = d;
  }
  // completa claves nuevas si la memoria se creó con una versión anterior
  const d = AnexoA.defaults(), A = m.anexos.A;
  if(!A._v2){ if(!A.tipo.lamina) A.lamina.perfil = 'ninguna'; A._v2 = true; }
  A.tipo.lamina = A.lamina.perfil !== 'ninguna';
  if(A.lamina && A.lamina.cielo && !A.extras){ const l = A.lamina; A.extras = { cielo:l.cielo, ductoE:l.ductoE, ductoM:l.ductoM, lum:l.lum, otras:[] }; delete l.cielo; delete l.ductoE; delete l.ductoM; delete l.lum; }
  (function fill(t, s){ for(const k in s){ if(t[k] === undefined) t[k] = JSON.parse(JSON.stringify(s[k])); else if(s[k] && typeof s[k] === 'object' && !Array.isArray(s[k])) fill(t[k], s[k]); } })(A, d);
  return A;
}
const getP = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
function setP(o, p, v){ const ks = p.split('.'); const last = ks.pop(); const t = ks.reduce((a, k) => a[k], o); t[last] = v; }

// Campos de formulario enlazados a A (data-a="ruta")
const ro = () => esIng() ? '' : 'disabled';
const fIn = (A, p, l, o={}) => `<div class="f ${o.cls||''}"><label>${l}</label><input data-a="${p}" ${o.num!==false?'inputmode="decimal"':''} value="${esc(getP(A,p))}" placeholder="${esc(o.ph||'')}" ${ro()}/>${o.h?`<div class="hint">${o.h}</div>`:''}</div>`;
const fSel = (A, p, l, opts, o={}) => `<div class="f ${o.cls||''}"><label>${l}</label><select data-a="${p}" ${o.re?'data-re="1"':''} ${ro()}>${opts.map(([v,t]) => `<option value="${esc(v)}" ${String(getP(A,p))===String(v)?'selected':''}>${esc(t)}</option>`).join('')}</select>${o.h?`<div class="hint">${o.h}</div>`:''}</div>`;
const fChk = (A, p, l) => `<label class="chk"><input type="checkbox" data-a="${p}" data-re="1" ${getP(A,p)?'checked':''} ${ro()}/> ${l}</label>`;
const tabla = (cab, filas, cls='') => `<div class="tw"><table class="t ${cls}"><thead><tr>${cab.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${filas.map(f => `<tr>${f.map((c,i) => `<td class="${i&&typeof c==='number'?'n':''}">${typeof c==='number'?fx(c):c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const res = (filas) => `<div class="sap">${filas.map(([t,v,hi]) => `<div class="row ${hi?'hi':''}"><span>${t}</span><b>${v}</b></div>`).join('')}</div>`;

const fichaHTML = (obj, quien) => `<div class="f span2"><label>Ficha técnica (PDF)</label><div class="nav-btns">${obj.ficha ? `<button class="btn sm" type="button" data-verficha="${quien}">📄 Ver ficha técnica</button>` : '<span class="hint">Sin ficha técnica</span>'}${esIng() && !String(obj.ficha||'').startsWith('fichas/') ? `<button class="btn sm pri" type="button" data-subficha="${quien}">📎 ${obj.ficha?'Cambiar':'Adjuntar'} PDF</button>` : ''}</div><div class="hint">${obj.ficha ? 'Se adjunta al Anexo A de la memoria.' : 'Adjunta el PDF para que vaya en el Anexo A.'}</div></div>`;

function paneAnexoA(){
  const A = datosA();
  const T = { cubierta:'Cubierta', muerta:'Carga muerta', viva:'Carga viva', viento:'Viento (B.6.5)', resumen:'Resumen SAP2000' };
  pane(`<div class="tabs" role="tablist">${Object.entries(T).map(([k,v]) => `<button type="button" role="tab" data-tab="${k}" class="${k===tabA?'on':''}">${v}</button>`).join('')}</div><div id="tabA"></div>`);
  $$('[data-tab]').forEach(b => b.onclick = () => { tabA = b.dataset.tab; paneAnexoA(); });
  pintarTabA();
}
function pintarTabA(){
  const A = datosA(), R = AnexoA.calcular(A), el = $('#tabA');
  el.innerHTML = TABS_A[tabA](A, R);
  el.querySelectorAll('[data-a]').forEach(inp => {
    const ev = inp.type === 'checkbox' || inp.tagName === 'SELECT' ? 'change' : 'input';
    inp.addEventListener(ev, () => {
      let v = inp.type === 'checkbox' ? inp.checked : inp.value;
      setP(A, inp.dataset.a, v);
      for(const q of ['panel','riel']) if(inp.dataset.a === q + '.nombre' && String(A[q].ficha||'').startsWith('fichas/')) A[q].ficha = '';
      if(inp.dataset.a === 'extras.cielo.tipo') A.extras.cielo.w = AnexoA.CIELOS[v] ?? A.extras.cielo.w; // peso típico del tipo elegido
      if(inp.dataset.a === 'lamina.perfil') A.tipo.lamina = v !== 'ninguna';
      if(inp.dataset.a === 'lamina.perfil' && v !== 'ninguna'){ const mat = AnexoA.LAMINAS[v]; A.lamina.wManual = ''; if(mat.calibres && !mat.calibres[A.lamina.calibre]) A.lamina.calibre = Object.keys(mat.calibres).pop(); }
      guardarMemoria();
      if(inp.dataset.re) pintarTabA(); else { const out = $('#resA'); if(out) out.innerHTML = RES_A[tabA](A, AnexoA.calcular(A)); }
    });
  });
  const extra = EXTRA_A[tabA]; if(extra) extra(A);
}

// ─── Contenido de cada pestaña ───
const TABS_A = {
cubierta(A, R){
  const l = A.lamina, mat = AnexoA.LAMINAS[l.perfil] || AnexoA.LAMINAS.master1000, e = A.extras, L = R.lamina;
  const fila = (k, nombre, def) => `<div class="xrow"><div class="f">${fChk(A,`extras.${k}.aplica`,nombre)}</div>${e[k].aplica ? fIn(A,`extras.${k}.w`,'Peso [kg/m²]',{ph:String(def)}) : '<div></div>'}</div>`;
  return `<div class="card"><div class="ct">Paneles solares</div>
    <div class="f"><label>¿El proyecto lleva paneles solares?</label>
      <div class="seg" role="group" aria-label="Lleva paneles solares"><button type="button" data-seg="1" class="${A.tipo.paneles?'on':''}" ${ro()}>Sí</button><button type="button" data-seg="0" class="${!A.tipo.paneles?'on':''}" ${ro()}>No</button></div>
      <div class="hint">${A.tipo.paneles ? 'El panel y el riel se escogen en la pestaña Carga muerta.' : 'Sin paneles: no se calculan cargas de paneles ni de rieles.'}</div></div></div>
  <div class="card"><div class="ct">Tipo de cubierta</div>
    <div class="fg g4">${fSel(A,'lamina.perfil','Material de la cubierta',[['ninguna','Ninguna (no lleva cubierta)'],...Object.entries(AnexoA.LAMINAS).map(([k,v]) => [k,v.nombre])],{cls:'span2',re:1})}
      ${A.tipo.lamina ? `${mat.calibres ? fSel(A,'lamina.calibre','Calibre',Object.keys(mat.calibres).map(c => [c,`Calibre ${c}`]),{re:1}) : '<div></div>'}
      ${fIn(A,'lamina.sep','Separación de correas [m]')}
      ${fIn(A,'lamina.wManual','Peso de la cubierta [kg/m²]',{cls:'span2',ph:L&&L.wAuto?fx(L.wAuto,2)+' (de la tabla)':'Escribe el peso',h:'Vacío = valor de la tabla. Escribe otro si tu material pesa distinto.'})}` : ''}</div>
    ${A.tipo.lamina ? `<div class="hint" id="fuenteCub" style="margin-top:6px">${L ? 'Fuente: ' + esc(L.fuente) + (L.metal && !L.manual ? ` — ${fx(L.pesoLin,3)} kg/m ÷ ${fx(L.ancho,2)} m de ancho útil` : '') : ''}</div>` : ''}
    ${!A.tipo.lamina && !A.tipo.paneles ? '<div class="note amber" style="margin-top:10px">Sin paneles y sin cubierta no hay cargas que calcular. Escoge al menos una.</div>' : ''}</div>
  <div class="card"><div class="ct">Cargas adicionales (solo si existen en el proyecto)</div>
    <div class="xrow"><div class="f">${fChk(A,'extras.cielo.aplica','Cielo raso')}</div>${e.cielo.aplica ? fSel(A,'extras.cielo.tipo','Tipo',Object.keys(AnexoA.CIELOS).map(k => [k,k]),{re:1}) + fIn(A,'extras.cielo.w','Peso [kg/m²]') : '<div></div>'}</div>
    ${fila('ductoE','Ductería eléctrica',5)}${fila('ductoM','Ductería mecánica',20)}${fila('lum','Iluminaria suspendida',5)}
    <h4 class="sub">Otras cargas por metro cuadrado</h4>
    ${(e.otras||[]).map((o,i) => `<div class="xrow">${fIn(A,`extras.otras.${i}.n`,'Descripción',{num:false,ph:'Ej: aviso, equipo, aislamiento'})}${fIn(A,`extras.otras.${i}.w`,'Peso [kg/m²]')}${esIng()?`<div class="f"><label>&nbsp;</label><button class="btn sm danger" type="button" data-delx="${i}" aria-label="Quitar">✕</button></div>`:''}</div>`).join('')}
    ${esIng()?'<button class="btn sm" type="button" id="addX">＋ Agregar otra carga</button>':''}
    <div class="hint" style="margin-top:8px">${A.tipo.lamina ? 'Se suman a la cubierta y van sobre las correas.' : 'Como no hay cubierta, se suman sobre los rieles de los paneles.'} Ductería mecánica 20 kg/m² según NSR-10 Tabla B.3.4.1-1; los demás son valores típicos que puedes cambiar.</div></div>
  <div class="card"><div class="ct">Resumen de cargas por área</div><div id="resA">${RES_A.cubierta(A,R)}</div></div>`;
},
muerta(A, R){
  let h = '';
  if(A.tipo.paneles){
    const bib = S.cfg.biblioteca || {}, pans = bib.paneles || [], rie = bib.rieles || [];
    const enBib = (lista, nom) => lista.some(x => x.nombre === nom);
    const iconos = (obj, q, idBib) => `<span class="icos">${obj.ficha ? `<button class="ib" type="button" data-verficha="${q}" title="Ver ficha técnica" aria-label="Ver ficha técnica">📄</button>` : ''}${esIng() && !String(obj.ficha||'').startsWith('fichas/') ? `<button class="ib" type="button" data-subficha="${q}" title="${obj.ficha?'Cambiar':'Adjuntar'} PDF de ficha técnica" aria-label="Adjuntar ficha técnica">📎</button>` : ''}${esIng() ? `<button class="ib" type="button" id="${idBib}" title="Guardar en biblioteca" aria-label="Guardar en biblioteca">💾</button>` : ''}</span>`;
    const apoyo = A.tipo.lamina ? `<div class="f"><label>Apoyos [m]</label><input value="${esc(A.lamina.sep)}" readonly title="Separación de correas (pestaña Cubierta)"/></div>` : fIn(A,'viento.luz','Apoyos [m]');
    h += `<div class="card"><div class="ct">A.1 Paneles solares y rieles</div>
      <div class="two">
        <div class="col"><h5>☀️ Panel ${iconos(A.panel,'panel','bibPanel')}</h5>
          <div class="f" style="margin-bottom:6px"><select id="selPanel" aria-label="Panel de la biblioteca" ${ro()}><option value="">— Escribir datos —</option>${pans.map((p,i) => `<option value="${i}" ${p.nombre===A.panel.nombre?'selected':''}>${esc(p.nombre)}</option>`).join('')}</select></div>
          ${enBib(pans, A.panel.nombre) ? '' : `<div style="margin-bottom:6px">${fIn(A,'panel.nombre','Referencia del panel',{num:false,ph:'Marca y modelo'})}</div>`}
          <div class="mini">${fIn(A,'panel.L','L [m]')}${fIn(A,'panel.W','A [m]')}${fIn(A,'panel.H','H [m]')}${fIn(A,'panel.peso','Peso [kg]')}${fIn(A,'panel.cargaF','Frontal [Pa]')}${fIn(A,'panel.cargaP','Posterior [Pa]')}</div>
          <div class="hint" style="margin-top:4px">${A.panel.ficha ? '📄 Ficha técnica adjunta' : '📎 Sin ficha técnica'}</div></div>
        <div class="col"><h5>▬ Riel ${iconos(A.riel,'riel','bibRiel')}</h5>
          <div class="f" style="margin-bottom:6px"><select id="selRiel" aria-label="Riel de la biblioteca" ${ro()}><option value="">— Escribir datos —</option>${rie.map((p,i) => `<option value="${i}" ${p.nombre===A.riel.nombre?'selected':''}>${esc(p.nombre)}</option>`).join('')}</select></div>
          ${enBib(rie, A.riel.nombre) ? '' : `<div style="margin-bottom:6px">${fIn(A,'riel.nombre','Referencia del riel',{num:false,ph:'Marca y modelo'})}</div>`}
          <div class="mini">${fIn(A,'riel.alto','Alto [m]')}${fIn(A,'riel.ancho','Ancho [m]')}${fIn(A,'riel.peso','Peso [kg/m]')}${apoyo}${fIn(A,'riel.luzMax','Máx. fab. [m]',{ph:'—'})}<div class="f"><label>&nbsp;</label><div id="chkApoyo" class="estado"></div></div></div>
          <div class="hint" style="margin-top:4px">${[A.riel.material, A.tipo.lamina ? 'apoyos = separación de correas' : '', A.riel.ficha ? '📄 Ficha técnica adjunta' : '📎 Sin ficha técnica'].filter(Boolean).map(esc).join(' · ')}</div></div>
      </div>
      <div class="fg g4" style="margin-top:10px">${fIn(A,'dBorde','Riel al borde del panel [m]')}${fIn(A,'tribRiel','Ancho aferente [m]',{ph:fx(R.paneles.tribAuto,3)+' (L/2)'})}</div></div>`;
  }
  if(A.tipo.lamina && !A.tipo.paneles) h += '<div class="note blue">El material de la cubierta, las correas y las cargas adicionales se escogen en la pestaña <b>Cubierta</b>.</div>';
  return (h || '<div class="note amber">Primero escoge el tipo de cubierta.</div>') + `<div class="card"><div class="ct">Resultado — carga muerta (D)</div><div id="resA">${RES_A.muerta(A,R)}</div></div>`;
},
viva(A, R){
  let h = '<div class="card"><div class="ct">Datos — carga viva</div><div class="fg g4">';
  if(A.tipo.paneles) h += fIn(A,'qMant','Mantenimiento sobre paneles [kg/m²]',{cls:'span2',h:'Equipo de mantenimiento; no se camina sobre los paneles'});
  if(A.tipo.lamina) h += fIn(A,'Lr','Carga viva de cubierta Lr [kg/m²]',{cls:'span2',h:'NSR-10 Tabla B.4.2.1-2'});
  return h + `</div></div><div class="card"><div class="ct">Resultado — carga viva</div><div id="resA">${RES_A.viva(A,R)}</div></div>`;
},
viento(A, R){
  const v = A.viento, W = R.viento;
  return `<div class="card"><div class="ct">Sitio y uso</div><div class="fg g4">
      ${fSel(A,'viento.grupo','Grupo de uso',Object.entries(AnexoA.GRUPOS).map(([k,g]) => [k,g.nombre]),{cls:'span2'})}
      ${fSel(A,'viento.V','Velocidad básica V',AnexoA.VELOCIDADES.map(x => [x,`${x} m/s (${Math.round(x*3.6/10)*10} km/h)`]),{h:'Figura B.6.4-1 según municipio'})}
      <div class="f"><label>&nbsp;</label>${fChk(A,'viento.huracan','Región con riesgo de huracán')}</div></div></div>
    <div class="card"><div class="ct">Geometría de la cubierta (a un agua)</div>
      <div class="geo"><div id="geoSvg">${svgGeo(A)}</div>
      <div class="fg g2">${fIn(A,'viento.L','Longitud L [m]',{h:'Lado largo, perpendicular a la pendiente'})}${fIn(A,'viento.W','Ancho W [m]',{h:'En el sentido de la pendiente'})}${fIn(A,'viento.He','Altura de cornisa He [m]',{h:'Borde más bajo, desde el piso'})}${fIn(A,'viento.Hr','Altura de cumbrera Hr [m]',{h:'Borde más alto, desde el piso'})}</div></div></div>
    <div class="card"><div class="ct">Exposición (B.6.5.6)<button class="btn sm" type="button" id="verCond">📘 Ver condiciones de cada exposición</button></div><div class="fg g4">
      ${fSel(A,'viento.rug','Rugosidad viento arriba',[['B','B — urbano, suburbano, boscoso'],['C','C — abierto, pocas obstrucciones'],['D','D — plano, superficies de agua']],{cls:'span2',re:1})}
      ${fIn(A,'viento.distRug','Distancia con esa rugosidad [m]')}
      ${fSel(A,'viento.expManual','Exposición usada',[['','Automática (la propuesta)'],['B','B'],['C','C'],['D','D']],{re:1})}
      <div class="f span2">${fChk(A,'viento.cercaD','Hay un terreno con rugosidad D cerca, viento arriba')}</div>
      ${v.cercaD ? fIn(A,'viento.distD','Distancia a ese terreno D [m]') : ''}</div>
      <div id="expo" style="margin-top:10px"></div>
      <h4 class="sub">Imágenes de comprobación de distancias</h4>
      <div class="hint" style="margin-bottom:8px">Captura del mapa (Google Maps o Earth) con la distancia medida hasta el cambio de terreno. Se imprimen en el Anexo A.</div>
      <div class="expo-imgs">${(v.imgsExpo||[]).map((im,i) => `<div class="expo-img"><div class="th" data-imgexpo="${i}">Cargando…</div>
        ${fIn(A,`viento.imgsExpo.${i}.nota`,'Descripción',{num:false,ph:'Ej: distancia en rugosidad B = 135 m'})}
        ${esIng()?`<button class="btn sm danger" type="button" data-delexpo="${i}">Quitar</button>`:''}</div>`).join('')}
        ${esIng() && (v.imgsExpo||[]).length < 4 ? '<button class="drop-img" type="button" id="addExpo" style="max-width:none;min-height:120px"><div class="ph-in"><div style="font-size:20px">🗺️</div><b>Agregar imagen</b><br/>toca o arrastra aquí</div></button>' : ''}</div></div>
    <div class="card"><div class="ct">Factor topográfico Kzt (B.6.5.7)</div>
      <div class="hint" style="margin-bottom:6px">Marca solo las condiciones que se cumplen. Si se cumplen las cinco, hay que calcular Kzt.</div>
      <div style="display:grid;gap:6px">${['(a) Colina o escarpe aislado y sin obstrucciones a barlovento','(b) Sobresale por encima del terreno viento arriba en un factor de 2 o más','(c) La estructura está en la mitad superior de la colina o cerca de la cresta','(d) H/Lh ≥ 0.2','(e) H ≥ 4.5 m (exposición C y D) o 18 m (exposición B)'].map((t,i) => fChk(A,`viento.kzt.${i}`,t)).join('')}</div>
      ${v.kzt.every(Boolean) ? `<div class="fg g4" style="margin-top:8px">${fIn(A,'viento.kztManual','Kzt calculado (B.6.5-1)')}</div>` : ''}</div>
    <div class="card"><div class="ct">Análisis</div><div class="fg g4">
      ${fSel(A,'viento.flujo','Flujo bajo la cubierta',[['libre','Libre (bloqueo ≤ 50 %)'],['obst','Obstruido (bloqueo > 50 %)']],{h:'Objetos debajo que frenan el viento'})}
      ${fSel(A,'viento.sistema','Sistema estructural (para Ta)',AnexoA.SISTEMAS.map((s,i) => [i,s.nombre]),{cls:'span2'})}
      ${fIn(A,'viento.Gmanual','Factor ráfaga G (si no es rígida)',{ph:'0.85'})}
      ${A.tipo.paneles ? (A.tipo.lamina ? `<div class="f"><label>Luz del riel entre apoyos [m]</label><input value="${esc(A.lamina.sep)}" readonly/><div class="hint">Separación de correas (Cubierta)</div></div>` : fIn(A,'viento.luz','Luz del riel entre apoyos [m]',{h:'Para el área efectiva de viento'})) : ''}
      ${A.tipo.lamina ? fIn(A,'viento.luzCorrea','Luz de la correa entre vigas [m]',{ph:'4.0',h:'Para el área efectiva de viento'}) : ''}
      ${fSel(A,'viento.fuente','Presión que va a SAP2000',[['sprfv','Sistema principal (SPRFV)'],['cyr','Componentes y revestimiento']],{cls:'span2'})}</div></div>
    <div class="card"><div class="ct">Resultados</div><div id="resA">${RES_A.viento(A,R)}</div></div>`;
},
resumen(A, R){
  return `<div class="card"><div class="ct">Cargas para SAP2000 [kN/ml]${esIng()?'<button class="btn sm" type="button" id="copiarA">Copiar tabla</button>':''}</div><div id="resA">${RES_A.resumen(A,R)}</div>
    <div class="hint" style="margin-top:8px">Valores redondeados hacia arriba a 3 decimales. W↓ = presión hacia la cubierta, W↑ = succión. Presión mínima de diseño 0.40 kN/m².</div></div>
    <div class="card"><div class="ct">Fichas técnicas del Anexo A</div>${(() => { const f = [A.tipo.paneles && ['Panel', A.panel], A.tipo.paneles && ['Riel', A.riel]].filter(Boolean);
      return f.length ? f.map(([t,o]) => `<div class="file"><div class="ic p">PDF</div><div class="nm">${t}: ${esc(o.nombre||'—')}<small>${o.ficha ? 'Adjunta' : 'Falta adjuntar en Carga muerta'}</small></div>${o.ficha ? `<button class="btn sm" type="button" data-verficha2="${t==='Panel'?'panel':'riel'}">Ver</button>` : pill('pend','Falta')}</div>`).join('') + '<div class="hint" style="margin-top:6px">Se unirán al PDF final de la memoria, después de las páginas del Anexo A.</div>' : '<div class="hint">Sin fichas técnicas.</div>'; })()}</div>
    <div class="card"><div class="ct">Páginas del Anexo A</div>
      <p class="lead" style="margin-bottom:10px">Imprime o guarda en PDF las páginas del Anexo A con el formato de la memoria (carta).</p>
      <button class="btn grn" type="button" id="printA">🖨 Imprimir / Guardar PDF del Anexo A</button></div>`;
},
};

// Resultados (se recalculan al escribir, sin redibujar los campos)
const RES_A = {
cubierta(A, R){
  const f = $('#fuenteCub'); if(f && R.lamina){ const L = R.lamina; f.textContent = 'Fuente: ' + L.fuente + (L.metal && !L.manual ? ` — ${fx(L.pesoLin,3)} kg/m ÷ ${fx(L.ancho,2)} m de ancho útil` : ''); }
  const items = R.lamina ? R.lamina.items : (R.paneles ? R.paneles.ext : []);
  if(!items.length) return '<div class="hint">Sin cargas por área todavía.</div>';
  const tot = items.reduce((a, x) => a + x.w, 0);
  return res([...items.map(x => [esc(x.n), fx(x.w,2)+' kg/m²']), ['Total por área', fx(tot,2)+' kg/m²', 1]]) +
    `<div class="hint">El resultado en kN/ml está en la pestaña Carga muerta.</div>`;
},
muerta(A, R){
  let h = '';
  const ca = $('#chkApoyo');
  if(ca && R.paneles){ const p = R.paneles; ca.className = 'estado ' + (!p.luzMax || !p.luz ? '' : p.luzExcede ? 'no' : 'ok'); ca.textContent = !p.luzMax || !p.luz ? '' : p.luzExcede ? '✗ Excede' : '✓ Cumple'; }
  if(R.paneles){ const p = R.paneles;
    if(p.luzExcede) h += `<div class="note amber"><b>Separación de apoyos muy grande:</b> ${fx(p.luz,2)} m supera los ${fx(p.luzMax,2)} m que permite el fabricante para el riel ${esc(A.riel.nombre)}.</div>`;
    h += `<h4 class="sub">Paneles solares → riel</h4>` + res([['Peso del panel por área', fx(p.wPanel)+' kg/m²'],['Ancho aferente por riel', fx(p.trib)+' m'],['Separación entre rieles', fx(p.sepRieles,2)+' m'],
      ['Panel sobre el riel', `${fx(p.kgmPanel,2)} kg/m → ${fx(p.Dpanel,4)} kN/m`],['Riel '+esc(A.riel.nombre), fx(p.Driel,4)+' kN/m'],...(p.ext.length?[['Cargas adicionales', `${fx(p.wExt,2)} kg/m² × ${fx(p.trib,3)} m → ${fx(p.Dext,4)} kN/m`]]:[]),['D total sobre riel', fx(p.Dr)+' kN/ml', 1]]); }
  if(R.lamina){ const l = R.lamina;
    h += `<h4 class="sub">Cubierta → correa</h4>` + (l.calOk ? '' : '<div class="note amber">Ese calibre no existe para este tipo de lámina.</div>') +
      res([...l.items.map(x => [esc(x.n), fx(x.w,2)+' kg/m²']),['Total por área', fx(l.wTot,2)+' kg/m²'],['× separación de correas', fx(l.s,2)+' m'],['D total sobre correa', fx(l.Dr)+' kN/ml', 1]]) +
      `<div class="hint">Fuente del peso de la cubierta: ${esc(l.fuente)}.</div>`; }
  return h || '—';
},
viva(A, R){
  let h = '';
  if(R.paneles) h += `<h4 class="sub">Paneles solares → riel</h4>` + res([['Mantenimiento', fx(R.paneles.qM,1)+' kg/m²'],['× ancho aferente', fx(R.paneles.trib)+' m'],['L sobre riel', fx(R.paneles.Lr3)+' kN/ml', 1]]);
  if(R.lamina) h += `<h4 class="sub">Cubierta → correa</h4>` + res([['Lr cubierta', fx(R.lamina.Lr,1)+' kg/m²'],['× separación de correas', fx(R.lamina.s,2)+' m'],['Lr sobre correa', fx(R.lamina.Lr3)+' kN/ml', 1]]);
  return h || '—';
},
viento(A, R){
  const W = R.viento;
  const gs = $('#geoSvg'); if(gs) gs.innerHTML = svgGeo(A);
  if(!W.ok) return `<div class="note amber">Faltan datos de geometría: ${W.faltan.join(', ')}.</div>`;
  const expo = $('#expo'); if(expo) expo.innerHTML = expoHTML(W);
  let h = (W.aviso18 ? '<div class="note amber"><b>Altura media mayor a 18 m:</b> este procedimiento no aplica.</div>' : '') +
    (!W.rigida ? '<div class="note amber"><b>Estructura flexible (f ≤ 1 Hz):</b> calcula Gf con B.6.5.8.2 y escríbelo en "Factor ráfaga G".</div>' : '') +
    res([['Ángulo de cubierta θ', fx(W.theta,2)+'°'],['Altura media h', fx(W.hm,2)+' m'],['Factor de importancia I', fx(W.I,2)],['Exposición', W.ex.usada + (W.ex.manual?' (elegida a mano)':'')],
      ['Kzt · Kd', `${fx(W.Kzt,2)} · ${fx(W.Kd,2)}`],['Kz (sistema principal · componentes)', `${fx(W.Kz2,3)} · ${fx(W.Kz1,3)}`],
      ['qh (sistema principal)', fx(W.qh2,1)+' N/m²', 1],['qh (componentes)', fx(W.qh1,1)+' N/m²'],['Ta · f', `${fx(W.Ta,3)} s · ${fx(W.f,2)} Hz → ${W.rigida?'rígida':'flexible'}`],['Factor ráfaga G', fx(W.G,2)]]) +
    `<h4 class="sub">Sistema principal — Figura B.6.5-18A (${A.viento.flujo==='obst'?'flujo obstruido':'flujo libre'})</h4>` +
    tabla(['Caso','γ','CNW','CNL','pW [kN/m²]','pL [kN/m²]'], W.sp.map(s => [s.caso, s.gam+'°', fx(s.CNW,2), fx(s.CNL,2), s.pW, s.pL])) +
    `<h4 class="sub">Componentes — Figura B.6.5-19A · a = ${fx(W.a,3)} m</h4>`;
  for(const e of W.porElem) h += `<div class="hint" style="margin:6px 0 4px"><b>${esc(e.nombre)}</b>: área efectiva ${fx(e.Ae,2)} m² (${{a1:'≤ a²',a2:'entre a² y 4a²',a3:'> 4a²'}[e.clase]})</div>` +
    tabla(['Zona','CN +','CN −','p+ [kN/m²]','p− [kN/m²]'], e.cyr.map(z => ['Zona '+z.zona, fx(z.CNp,2), fx(z.CNs,2), z.pp, z.ps]));
  if(W.panelChk){ const c = W.panelChk;
    h += `<h4 class="sub">Verificación del panel contra su carga mecánica (ficha técnica)</h4>` +
      tabla(['Cara','Viento de diseño [kN/m²]','Carga del fabricante [kN/m²]',''], [
        ['Frontal (presión)', fx(c.dP,3), c.capF ? fx(c.capF,2) : '—', c.capF ? pill(c.okF?'ok':'no', c.okF?'Cumple':'No cumple') : ''],
        ['Posterior (succión)', fx(c.dS,3), c.capP ? fx(c.capP,2) : '—', c.capP ? pill(c.okP?'ok':'no', c.okP?'Cumple':'No cumple') : '']]) +
      `<div class="hint">Presiones de componentes (zona más desfavorable) con el área del panel, ${fx(c.Ap,2)} m². La carga del fabricante es la de ensayo según la ficha técnica.</div>`; }
  h += `<h4 class="sub">Carga de viento por elemento</h4>` + tabla(['Elemento','Ancho aferente [m]','p↓ diseño','p↑ diseño','W↓ [kN/ml]','W↑ [kN/ml]'],
    W.porElem.map(e => [esc(e.nombre), e.trib, fx(e.dPres,3)+(e.pPres<W.pMin?' (mín.)':''), fx(e.dSucc,3)+(e.pSucc<W.pMin?' (mín.)':''), `<b>${fx(e.Wp)}</b>`, `<b>${fx(e.Ws)}</b>`]));
  return h;
},
resumen(A, R){
  const filas = [];
  if(R.paneles){ const w = R.viento.ok ? R.viento.porElem.find(e => e.id==='riel') : null; filas.push(['Riel de paneles ('+esc(A.riel.nombre)+')', R.paneles.Dr, R.paneles.Lr3, w?w.Wp:null, w?w.Ws:null]); }
  if(R.lamina){ const w = R.viento.ok ? R.viento.porElem.find(e => e.id==='correa') : null; filas.push(['Correa de cubierta', R.lamina.Dr, R.lamina.Lr3, w?w.Wp:null, w?w.Ws:null]); }
  if(!filas.length) return '<div class="note amber">Escoge el tipo de cubierta.</div>';
  return (R.viento.ok ? '' : '<div class="note amber">Faltan datos de viento.</div>') + tabla(['Elemento','D muerta','L / Lr viva','W↓ viento','W↑ viento'], filas, 'sapres');
},
};
function expoHTML(W){
  return `<div class="note ${W.ex.manual?'amber':'blue'}"><b>Propuesta: exposición ${W.ex.prop}.</b> ${esc(W.ex.razon)}${W.ex.manual?` <b>Estás usando ${W.ex.usada}.</b>`:''}</div>`;
}

// Acciones extra por pestaña (botones)
const EXTRA_A = {
cubierta(A){
  $$('[data-seg]').forEach(b => b.onclick = () => { A.tipo.paneles = b.dataset.seg === '1'; guardarMemoria(); pintarTabA(); });
  if($('#addX')) $('#addX').onclick = () => { A.extras.otras.push({ n:'', w:'' }); guardarMemoria(); pintarTabA(); const ins = $$('[data-a$=".n"]'); ins[ins.length-1]?.focus(); };
  $$('[data-delx]').forEach(b => b.onclick = () => { A.extras.otras.splice(+b.dataset.delx, 1); guardarMemoria(); pintarTabA(); });
},
muerta(A){
  const out = $('#resA'); if(out) out.innerHTML = RES_A.muerta(A, AnexoA.calcular(A)); // pinta también el ✓ Cumple
  const bib = S.cfg.biblioteca = S.cfg.biblioteca || {};
  const usar = (sel, lista, destino) => { const s = $(sel); if(!s) return; s.onchange = () => { const x = (bib[lista]||[])[s.value];
    if(!x){ A[destino].ficha = ''; A[destino].nombre = ''; guardarMemoria(); pintarTabA(); return; } // escribir datos propios
    if(destino === 'panel') Object.assign(A.panel, { H:'', cargaF:'', cargaP:'', ficha:'' });
    if(destino === 'riel') Object.assign(A.riel, { material:'', vmax:'', luzMax:'', ficha:'' });
    delete A.riel.Ix; delete A.riel.Iy; Object.assign(A[destino], x); guardarMemoria(); pintarTabA(); }; };
  usar('#selPanel', 'paneles', 'panel'); usar('#selRiel', 'rieles', 'riel');
  const guardarBib = async (lista, obj) => {
    if(!obj.nombre?.trim()) return toast('Escribe primero la referencia.');
    const nuevo = { ...obj };
    if(nuevo.ficha && !nuevo.ficha.startsWith('fichas/') && !nuevo.ficha.startsWith('biblioteca/')){
      const dest = `biblioteca/${lista}-${nuevo.nombre.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}.pdf`;
      await sb.storage.from(BUCKET).remove([dest]);
      const { error:ec } = await sb.storage.from(BUCKET).copy(nuevo.ficha, dest);
      if(ec) return err(ec, 'No se pudo copiar la ficha'); nuevo.ficha = dest;
    }
    bib[lista] = (bib[lista] || []).filter(x => x.nombre !== nuevo.nombre); bib[lista].push(nuevo);
    const { error } = await sb.from('mem_config').update({ biblioteca:bib }).eq('id', 1);
    error ? err(error) : (toast(`"${obj.nombre}" guardado en la biblioteca.`), pintarTabA());
  };
  $$('[data-verficha]').forEach(b => b.onclick = async () => { const u = await urlFicha(A[b.dataset.verficha].ficha); u ? window.open(u, '_blank') : toast('No se encontró el PDF.'); });
  $$('[data-subficha]').forEach(b => b.onclick = async () => {
    const q = b.dataset.subficha, file = await elegirArchivo('application/pdf'); if(!file) return;
    if(file.type !== 'application/pdf') return toast('El archivo debe ser PDF.');
    try{ toast('Subiendo ficha técnica…', 15000);
      const path = `${S.m.id}/fichas/${q}.pdf`; await subir(path, file, 'application/pdf');
      A[q].ficha = path; guardarMemoria(); toast(`Ficha técnica adjunta (${(file.size/1048576).toFixed(1)} MB).`); pintarTabA();
    }catch(e){ err(e, 'No se pudo subir el PDF'); }
  });
  if($('#bibPanel')) $('#bibPanel').onclick = () => guardarBib('paneles', A.panel);
  if($('#bibRiel')) $('#bibRiel').onclick = () => guardarBib('rieles', A.riel);
},
viento(A){
  const W = AnexoA.calcular(A).viento; if(W.ok && $('#expo')) $('#expo').innerHTML = expoHTML(W);
  $('#verCond').onclick = () => modalCondiciones(A);
  const v = A.viento; v.imgsExpo = v.imgsExpo || [];
  v.imgsExpo.forEach((im, i) => urlDe(im.path).then(u => { const t = document.querySelector(`[data-imgexpo="${i}"]`); if(t) t.innerHTML = u ? `<img src="${esc(u)}" alt="Comprobación de distancia ${i+1}"/>` : 'No se encontró'; }));
  const agregar = async file => {
    if(!file || !file.type.startsWith('image/')) return toast('El archivo debe ser una imagen.');
    try{ toast('Subiendo imagen…', 15000);
      const blob = await comprimir(file, { max:1800, type:'image/jpeg', q:0.82 });
      const path = `${S.m.id}/exposicion-${Date.now()}.jpg`; await subir(path, blob, 'image/jpeg');
      v.imgsExpo.push({ path, nota:'' }); guardarMemoria(); toast(`Imagen guardada (${(blob.size/1024).toFixed(0)} KB).`); pintarTabA();
    }catch(e){ err(e, 'No se pudo subir la imagen'); }
  };
  const add = $('#addExpo');
  if(add){ add.onclick = async () => agregar(await elegirArchivo('image/*'));
    add.ondragover = e => { e.preventDefault(); add.classList.add('over'); }; add.ondragleave = () => add.classList.remove('over');
    add.ondrop = e => { e.preventDefault(); add.classList.remove('over'); agregar(e.dataTransfer.files[0]); }; }
  $$('[data-delexpo]').forEach(b => b.onclick = async () => {
    if(!confirm('¿Quitar esta imagen?')) return;
    const [im] = v.imgsExpo.splice(+b.dataset.delexpo, 1); guardarMemoria();
    if(im?.path) sb.storage.from(BUCKET).remove([im.path]); pintarTabA();
  });
},
resumen(A){
  const R = AnexoA.calcular(A);
  $$('[data-verficha2]').forEach(b => b.onclick = async () => { const u = await urlFicha(A[b.dataset.verficha2].ficha); u ? window.open(u, '_blank') : toast('No se encontró el PDF.'); });
  if($('#copiarA')) $('#copiarA').onclick = () => {
    const t = [...document.querySelectorAll('table.sapres tr')].map(tr => [...tr.children].map(td => td.textContent).join('\t')).join('\n');
    navigator.clipboard.writeText(t).then(() => toast('Tabla copiada: pégala en Excel o en tus notas de SAP2000.'));
  };
  $('#printA').onclick = async () => {
    for(const im of (A.viento.imgsExpo||[])) im._url = await urlDe(im.path);
    const pa = $('#print-area'); pa.innerHTML = anexoAPrintHTML(A, R);
    for(const im of (A.viento.imgsExpo||[])) delete im._url;
    await Promise.all([...pa.querySelectorAll('img')].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
    await document.fonts.ready;
    imprimirConMargen(`${S.m.consecutivo}_ANEXO_A`);
  };
},
};

// ═══ Páginas imprimibles del Anexo A ═══
function anexoAPrintHTML(A, R){
  const m = S.m, f = m.ficha, c = S.cfg, letra = 'A';
  const fecha = f.fecha ? new Date(f.fecha + 'T12:00').toLocaleDateString('es-CO', { month:'long', year:'numeric' }) : '';
  const cab = (titulo, norma, sub) => `<div class="ax-hd"><div class="ax-t">ANEXO ${letra} - ${titulo}</div><div class="ax-n">${norma}</div><div class="ax-n2">${sub}</div>
    <table class="ax-id"><tr><td><b>Proyecto:</b></td><td>${esc(f.proyecto||m.titulo||'')}</td><td><b>Ingeniero:</b></td><td>${esc((c.nombre_firma||'').replace(/^ING\.\s*/,''))}</td></tr>
    <tr><td><b>Proyecto No.:</b></td><td>${esc(m.consecutivo)}</td><td><b>Fecha:</b></td><td>${esc(fecha)}</td></tr></table></div>`;
  const tb = (cab, filas, tot) => `<table class="ax-tb"><tr>${cab.map(x => `<th>${x}</th>`).join('')}</tr>${filas.map(r => `<tr>${r.map((x,i) => `<td class="${i?'c':''}">${x}</td>`).join('')}</tr>`).join('')}${tot?`<tr class="tot"><td colspan="${cab.length-1}" style="text-align:right">TOTAL</td><td class="c">${tot}</td></tr>`:''}</table>`;
  const kv = filas => `<table class="ax-kv">${filas.map(([a,b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>`;
  const box = (v, u) => `<div class="ax-box">${v} ${u}</div>`;
  let h = `<div class="ax">`, n = 0;
  const sec = () => `${letra}.${++n}`;
  if(R.paneles){ const p = R.paneles, s = sec();
    h += `<section>${cab('ANÁLISIS DE CARGA MUERTA','NSR-10. B.3.3. Cargas muertas requeridas','Cargas muertas y vivas en estructura')}
      <h3>${s} Cálculo de cargas MUERTAS de paneles solares</h3>
      <h4>${s}-1 Medidas del panel solar — ${esc(A.panel.nombre)}</h4>${kv([['Longitud [m]',fx(AnexoA.num(A.panel.L),3)],['Ancho [m]',fx(AnexoA.num(A.panel.W),3)],...(AnexoA.num(A.panel.H)?[['Espesor [m]',fx(AnexoA.num(A.panel.H),3)]]:[]),['Peso [kg/un]',fx(AnexoA.num(A.panel.peso),1)],['Peso [kg/m²]',fx(p.wPanel,3)],...(AnexoA.num(A.panel.cargaF)?[['Carga mecánica frontal / posterior [Pa]',`${AnexoA.num(A.panel.cargaF)} / ${AnexoA.num(A.panel.cargaP)}`]]:[])])}
      <h4>${s}-2 Perfil de soporte — ${esc(A.riel.nombre)}</h4>${kv([['Alto [m]',fx(AnexoA.num(A.riel.alto),4)],['Ancho [m]',fx(AnexoA.num(A.riel.ancho),4)],['Peso [kg/ml]',fx(AnexoA.num(A.riel.peso),3)],...(A.riel.material?[['Material',esc(A.riel.material)]]:[])])}
      <h4>${s}-3 Cargas lineales sobre el perfil</h4>${svgPanel(A, p)}
      ${kv([['Ubicación del perfil respecto al borde del panel',fx(AnexoA.num(A.dBorde),2)+' m'],['Separación entre perfiles',fx(p.sepRieles,2)+' m'],['Ancho aferente para cada perfil',fx(p.trib,3)+' m'],['Área aferente para cada perfil (por panel)',fx(p.areaTrib,3)+' m²']])}
      ${p.luzMax ? `<p class="ax-nota"><b>Nota:</b> la separación de los perfiles metálicos donde se apoyan los rieles ${esc(A.riel.nombre)} no puede ser mayor a ${fx(p.luzMax,2)} m, según la ficha técnica del fabricante.${p.luz ? ` En este proyecto la separación es de ${fx(p.luz,2)} m${p.luzExcede ? ', <b>que supera el máximo</b>' : ''}.` : ''}</p>` : ''}
      ${[A.panel.ficha && 'panel solar', A.riel.ficha && 'riel'].filter(Boolean).length ? `<p>Se anexan las fichas técnicas del ${[A.panel.ficha && 'panel solar ' + esc(A.panel.nombre), A.riel.ficha && 'riel ' + esc(A.riel.nombre)].filter(Boolean).join(' y del ')}.</p>` : ''}
      <p>Carga del panel sobre el perfil: w = ${fx(p.wPanel,3)} kg/m² × ${fx(p.trib,3)} m = ${fx(p.kgmPanel,2)} kg/m → ${fx(p.Dpanel,4)} kN/m (g = 9.81 m/s²).</p>
      ${p.ext.length ? `<p>Cargas adicionales sobre la estructura de paneles: ${p.ext.map(x => `${esc(x.n)} ${fx(x.w,1)} kg/m²`).join(', ')} = ${fx(p.wExt,2)} kg/m² × ${fx(p.trib,3)} m → ${fx(p.Dext,4)} kN/m.</p>` : ''}
      ${tb(['Ítem','Unidad','Cantidad','Peso/unidad [kN/m]','Peso total [kN/m]'],[['Panel solar','ml','1',fx(p.Dpanel,4),fx(p.Dpanel,4)],[esc(A.riel.nombre),'ml','1',fx(p.Driel,4),fx(p.Driel,4)],...(p.ext.length?[['Cargas adicionales','ml','1',fx(p.Dext,4),fx(p.Dext,4)]]:[])],fx(p.D,4))}
      ${box(fx(p.Dr),'kN/ml')}</section>`;
    const s2 = sec();
    h += `<section>${cab('ANÁLISIS DE CARGA VIVA','NSR-10. Título B.4. Cargas vivas','Cargas vivas en estructura')}
      <h3>${s2} Cálculo de cargas VIVAS de paneles solares</h3>
      <p>La estructura se comporta como una cubierta, donde el elemento equivalente al techo son los paneles. Estos paneles no están diseñados para soportar tránsito peatonal, por lo que no se debe caminar ni ejercer presión sobre ellos. Tampoco acumulan agua, ya que las ranuras entre ellos permiten el drenaje. Por lo tanto, la única carga viva sobre los paneles corresponde al equipo de mantenimiento, de aproximadamente ${fx(p.qM,0)} kg/m².</p>
      ${kv([['Peso del equipo de mantenimiento [kg/m²]',fx(p.qM,1)],['Ancho aferente para cada perfil',fx(p.trib,3)+' m']])}
      ${tb(['Ítem','Unidad','Cantidad','Peso/unidad [kN/m]','Peso total [kN/m]'],[['Mantenimiento','ml','1',fx(p.L,4),fx(p.L,4)]],fx(p.L,4))}
      ${box(fx(p.Lr3),'kN/ml')}</section>`;
  }
  if(R.lamina){ const l = R.lamina, s = sec();
    h += `<section>${cab('ANÁLISIS DE CARGA MUERTA','NSR-10. B.3.3. Cargas muertas requeridas','Cargas muertas mínimas en cubierta')}
      <h3>${s} Cálculo de cargas MUERTAS de cubierta</h3>
      <h4>${s}-1 Datos iniciales</h4>${kv([['Tipo de cubierta',esc(l.nomMat)],...(l.metal&&!l.manual?[['Ancho útil [m]',fx(l.ancho,2)],['Peso [kg/m]',fx(l.pesoLin,3)]]:[]),['Peso [kg/m²]',fx(l.wLam,3)],['Fuente',esc(l.fuente)],['Separación de apoyos (correas) [m]',fx(l.s,2)]])}
      ${svgCorreas(l.s)}
      ${tb(['Ítem','Unidad','Peso [kg/m²]'], l.items.map(x => [esc(x.n),'m²',fx(x.w,2)]), fx(l.wTot,2))}
      <p>Carga sobre la correa: ${fx(l.wTot,2)} kg/m² × ${fx(l.s,2)} m = ${fx(l.kgm,2)} kg/m → ${fx(l.D,4)} kN/m.</p>
      ${box(fx(l.Dr),'kN/ml')}</section>`;
    const s2 = sec();
    h += `<section>${cab('ANÁLISIS DE CARGA VIVA','NSR-10. B.4.2.1 Cargas vivas requeridas','Cargas vivas mínimas en cubierta')}
      <h3>${s2} Cálculo de cargas VIVAS de cubierta</h3>
      ${kv([['Carga viva de cubierta (Tabla B.4.2.1-2) [kg/m²]',fx(l.Lr,1)],['Separación de apoyos [m]',fx(l.s,2)]])}
      ${tb(['Ítem','Unidad','Cantidad','Peso/unidad [kN/m]','Peso total [kN/m]'],[['Carga viva NSR-10','ml','1',fx(l.L,4),fx(l.L,4)]],fx(l.L,4))}
      ${box(fx(l.Lr3),'kN/ml')}</section>`;
  }
  const W = R.viento;
  if(W.ok){ const s = sec(), v = A.viento;
    h += `<section>${cab('ANÁLISIS DE CARGA DE VIENTO','NSR-10. Título B - Cap. 6. Fuerzas de viento','Método 2: Procedimiento analítico (B.6.5) — Cubiertas libres (B.6.5.13)')}
      <h3>${s} Datos de entrada y factores</h3>
      ${kv([['Ubicación',esc([f.mun,f.depto].filter(Boolean).join(', '))],['Grupo de uso',esc(W.grupo)],['Factor de importancia I (Tabla B.6.5-1)',fx(W.I,2)],['Velocidad básica V (Figura B.6.4-1)',`${W.V} m/s`],
        ['Rugosidad del terreno',`Rugosidad ${esc(v.rug)}`],['Exposición (B.6.5.6.3)',`Exposición ${W.ex.usada} — ${esc(W.ex.razon)}`],['Factor topográfico Kzt (B.6.5.7)',fx(W.Kzt,2)],['Factor de dirección Kd (Tabla B.6.5-4)',fx(W.Kd,2)],
        ['Coef. de exposición Kz (SPRFV · componentes)',`${fx(W.Kz2,4)} · ${fx(W.Kz1,4)}`],['Presión por velocidad qh = 0.613·Kz·Kzt·Kd·V²·I',`${fx(W.qh2,2)} N/m² (SPRFV) · ${fx(W.qh1,2)} N/m² (componentes)`],
        ['Periodo Ta = Ct·h^α',`${fx(W.Ta,3)} s → f = ${fx(W.f,2)} Hz (${W.rigida?'estructura rígida':'estructura flexible'})`],['Factor de efecto ráfaga G (B.6.5.8)',fx(W.G,2)]])}
      ${(v.imgsExpo||[]).length ? `<h4>Comprobación de distancias para la exposición</h4><div class="ax-imgs">${(v.imgsExpo||[]).map((im,i) => `<figure>${im._url ? `<img src="${esc(im._url)}" alt=""/>` : ''}<figcaption>Imagen ${i+1}. ${esc(im.nota||'Comprobación de distancia')}</figcaption></figure>`).join('')}</div>` : ''}
      <h3>${letra}.${n}.1 Datos geométricos</h3>${svgGeo(A, true)}${kv([['Longitud L [m]',fx(AnexoA.num(v.L),2)],['Ancho W [m]',fx(AnexoA.num(v.W),2)],['Altura de cornisa He [m]',fx(AnexoA.num(v.He),2)],['Altura de cumbrera Hr [m]',fx(AnexoA.num(v.Hr),2)],['Ángulo de cubierta θ',fx(W.theta,2)+'°'],['Altura media h [m]',fx(W.hm,2)],['Tipo','Cubierta libre a un agua']])}
      <h3>${letra}.${n}.2 Presiones netas — sistema principal (Figura B.6.5-18A, ${v.flujo==='obst'?'flujo obstruido':'flujo libre'})</h3>
      ${tb(['Caso','γ','CNW','CNL','pW [kN/m²]','pL [kN/m²]'], W.sp.map(x => [x.caso, x.gam+'°', fx(x.CNW,2), fx(x.CNL,2), fx(x.pW,4), fx(x.pL,4)]))}
      ${svgSPRFV(W)}
      <p>p = qh · G · CN. Para θ menor a 7.5° se usan los coeficientes de θ = 0°. Valores positivos: presión hacia la cubierta; negativos: succión.</p>
      <h3>${letra}.${n}.3 Presiones — componentes y revestimiento (Figura B.6.5-19A)</h3>
      ${svgZonas(A, W)}
      ${kv([['a = 10 % de la menor dimensión o 0.4h (mín. 4 % o 1.0 m)',fx(W.a,3)+' m'],['Área zona 3 (franja exterior de ancho a)',fx(W.zonas.z3,2)+' m²'],['Área zona 2',fx(W.zonas.z2,2)+' m²'],['Área zona 1 (interior)',fx(W.zonas.z1,2)+' m²']])}
      ${W.porElem.map(e => `<div style="break-inside:avoid"><p><b>${esc(e.nombre)}</b> — área efectiva ${fx(e.Ae,2)} m²</p>` + tb(['Zona','CN +','CN −','p+ [kN/m²]','p− [kN/m²]'], e.cyr.map(z => [z.zona, fx(z.CNp,2), fx(z.CNs,2), fx(z.pp,4), fx(z.ps,4)])) + '</div>').join('')}
      ${W.panelChk ? `<h3>${letra}.${n}.4 Verificación del panel solar</h3>${tb(['Cara','Viento de diseño [kN/m²]','Carga del fabricante [kN/m²]','Estado'],[['Frontal (presión)',fx(W.panelChk.dP,3),fx(W.panelChk.capF,2),W.panelChk.okF?'Cumple':'No cumple'],['Posterior (succión)',fx(W.panelChk.dS,3),fx(W.panelChk.capP,2),W.panelChk.okP?'Cumple':'No cumple']])}` : ''}
      <h3>${letra}.${n}.${W.panelChk?5:4} Carga de viento sobre los elementos</h3>
      <p>Se toma la presión de ${v.fuente==='cyr'?'componentes y revestimiento':'sistema principal'} más desfavorable, con mínimo de ${fx(W.pMin,2)} kN/m², multiplicada por el ancho aferente.</p>
      ${tb(['Elemento','Ancho aferente [m]','p↓ [kN/m²]','p↑ [kN/m²]','W↓ [kN/ml]','W↑ [kN/ml]'], W.porElem.map(e => [esc(e.nombre), fx(e.trib,3), fx(e.dPres,3), fx(e.dSucc,3), fx(e.Wp), fx(e.Ws)]))}
      ${W.porElem.map(e => box(`${esc(e.nombre)}: W = ${fx(Math.max(e.Wp,e.Ws))}`,'kN/ml')).join('')}</section>`;
  }
  return h + `</div>`; // el pie y la numeración se ponen al armar el PDF final
}
function svgPanel(A, p){
  const L = AnexoA.num(A.panel.L), W = AnexoA.num(A.panel.W), dB = AnexoA.num(A.dBorde), s = 300 / L, x0 = 60, y0 = 20, w = W*s*0.9;
  const xr1 = x0 + dB*s, xr2 = x0 + (L-dB)*s;
  return `<svg class="ax-svg" viewBox="0 0 420 ${w+90}" width="420" height="${w+90}"><rect x="${x0}" y="${y0}" width="${L*s}" height="${w}" fill="#dbe6f5" stroke="#1f3a60"/>
    <rect x="${xr1-3}" y="${y0-8}" width="6" height="${w+16}" fill="#555"/><rect x="${xr2-3}" y="${y0-8}" width="6" height="${w+16}" fill="#555"/>
    <rect x="${x0}" y="${y0}" width="${L/2*s}" height="${w}" fill="rgba(26,86,219,.12)" stroke="#1a56db" stroke-dasharray="4 3"/>
    <g font-size="11" font-family="serif" text-anchor="middle"><text x="${x0+L*s/2}" y="${y0+w+28}">${fx(L,2)} m</text>
    <text x="${(xr1+xr2)/2}" y="${y0+w+46}">separación ${fx(p.sepRieles,2)} m</text><text x="${x0+L/4*s}" y="${y0+w/2}">aferente ${fx(p.trib,3)} m</text>
    <text x="${x0-22}" y="${y0+w/2}">${fx(W,2)} m</text><text x="${xr1}" y="${y0+w+62}">perfil a ${fx(dB,2)} m del borde</text></g></svg>`;
}
function svgCorreas(sep){
  return `<svg class="ax-svg" viewBox="0 0 420 110" width="420" height="110"><g stroke="#1f3a60">${[60,180,300].map(x => `<rect x="${x-4}" y="30" width="8" height="40" fill="#555"/>`).join('')}<line x1="30" y1="30" x2="390" y2="30" stroke-width="3"/></g>
    <rect x="120" y="22" width="120" height="8" fill="rgba(26,86,219,.25)"/><g font-size="11" font-family="serif" text-anchor="middle"><text x="120" y="90">${fx(sep,2)} m</text><text x="240" y="90">${fx(sep,2)} m</text><text x="180" y="16">ancho aferente ${fx(sep,2)} m</text></g></svg>`;
}

// Imprime #print-area con márgenes de hoja (la portada usa margen 0)
function imprimirConMargen(titulo){
  const st = document.createElement('style'); st.textContent = '@page{size:letter;margin:.6in .75in .7in}';
  document.head.appendChild(st);
  const t = document.title; document.title = titulo;
  window.print();
  document.title = t; setTimeout(() => st.remove(), 500);
}

// URL de una ficha técnica: las de la biblioteca base viven en el sitio (fichas/), las subidas en Supabase
async function urlFicha(path){ if(!path) return null; return path.startsWith('fichas/') ? path : urlDe(path); }

// Dibujo de la geometría de la cubierta (planta + alzado), con los valores escritos
function svgGeo(A, imp){
  const v = A.viento, n = x => AnexoA.num(x, 0);
  const L = n(v.L), W = n(v.W), He = n(v.He), Hr = n(v.Hr);
  const t = (x, d=2) => x > 0 ? fx(x, d) + ' m' : '?';
  const th = Hr > He && W > 0 ? Math.atan((Hr - He) / W) * 180 / Math.PI : null, hm = He > 0 && Hr > 0 ? (He + Hr) / 2 : 0;
  const az = imp ? '#1f3a60' : '#1a56db', gr = '#64748b', fill = imp ? '#e8eef7' : '#dbeafe';
  // pendiente dibujada exagerada si es muy pequeña, para que se vea
  const dy = Math.max(18, Math.min(60, th ? th * 4 : 30));
  const M = `url(#ar${imp?'p':''})`, top = 110 - dy;
  return `<svg viewBox="0 0 600 255" class="geo-svg" role="img" aria-label="Geometría de la cubierta: planta y alzado">
  <defs><marker id="ar${imp?'p':''}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${gr}"/></marker></defs>
  <g font-family="Segoe UI,system-ui,sans-serif" font-size="12">
    <text x="16" y="20" font-weight="800" fill="${gr}" font-size="11">PLANTA</text>
    <rect x="20" y="40" width="180" height="110" fill="${fill}" stroke="${az}" stroke-width="2"/>
    ${[0,1,2,3].map(i => `<line x1="${50+i*40}" y1="48" x2="${50+i*40}" y2="142" stroke="${az}" stroke-opacity=".25"/>`).join('')}
    <text x="110" y="92" text-anchor="middle" fill="${gr}" font-size="11">pendiente</text><text x="110" y="108" text-anchor="middle" fill="${gr}" font-size="13">↓</text>
    <line x1="20" y1="166" x2="200" y2="166" stroke="${gr}" marker-start="${M}" marker-end="${M}"/>
    <text x="110" y="183" text-anchor="middle" font-weight="800" fill="${az}">L = ${t(L)}</text>
    <line x1="214" y1="40" x2="214" y2="150" stroke="${gr}" marker-start="${M}" marker-end="${M}"/>
    <text x="232" y="95" text-anchor="middle" font-weight="800" fill="${az}" transform="rotate(-90 232 95)">W = ${t(W)}</text>
    <text x="290" y="20" font-weight="800" fill="${gr}" font-size="11">ALZADO (corte en el sentido de W)</text>
    <line x1="290" y1="215" x2="590" y2="215" stroke="${gr}" stroke-width="2"/>
    ${[0,1,2,3,4,5,6,7,8,9,10].map(i => `<line x1="${296+i*27}" y1="215" x2="${288+i*27}" y2="224" stroke="${gr}"/>`).join('')}
    <line x1="350" y1="215" x2="350" y2="${top}" stroke="${az}" stroke-width="3"/>
    <line x1="500" y1="215" x2="500" y2="110" stroke="${az}" stroke-width="3"/>
    <line x1="340" y1="${top - 1}" x2="512" y2="111" stroke="${az}" stroke-width="5" stroke-linecap="round"/>
    <line x1="325" y1="215" x2="325" y2="${top}" stroke="${gr}" marker-start="${M}" marker-end="${M}"/>
    <text x="319" y="${(215+top)/2}" text-anchor="end" font-weight="800" fill="${az}">Hr</text><text x="319" y="${(215+top)/2+15}" text-anchor="end" fill="${az}" font-size="11">${t(Hr)}</text>
    <line x1="528" y1="215" x2="528" y2="110" stroke="${gr}" marker-start="${M}" marker-end="${M}"/>
    <text x="535" y="160" font-weight="800" fill="${az}">He</text><text x="535" y="175" fill="${az}" font-size="11">${t(He)}</text>
    <line x1="425" y1="215" x2="425" y2="${110 - dy/2}" stroke="${gr}" stroke-dasharray="4 3"/>
    <text x="425" y="200" text-anchor="middle" fill="${gr}" font-size="11">h media = ${hm ? fx(hm,2)+' m' : '?'}</text>
    <line x1="455" y1="110" x2="512" y2="110" stroke="${gr}" stroke-dasharray="3 3"/>
    <text x="470" y="128" text-anchor="middle" fill="${gr}" font-size="11">θ = ${th != null ? fx(th,2)+'°' : '?'}</text>
    <line x1="350" y1="240" x2="500" y2="240" stroke="${gr}" marker-start="${M}" marker-end="${M}"/>
    <text x="425" y="253" text-anchor="middle" font-weight="800" fill="${az}" font-size="11">W</text>
  </g></svg>`;
}


// Ilustraciones pequeñas para la ventana de condiciones (viento de izquierda a derecha)
const ILU = (() => {
  const g = '#94a3b8', az = '#1a56db', ve = '#16a34a', ag = '#38bdf8';
  const suelo = (y=52) => `<line x1="0" y1="${y}" x2="200" y2="${y}" stroke="${g}" stroke-width="1.5"/>`;
  const casa = (x, s=1) => `<g transform="translate(${x},52) scale(${s})"><rect x="-7" y="-12" width="14" height="12" fill="#e2e8f0" stroke="#64748b"/><path d="M-9,-12 L0,-20 L9,-12 z" fill="#cbd5e1" stroke="#64748b"/></g>`;
  const arbol = (x, s=1) => `<g transform="translate(${x},52) scale(${s})"><rect x="-1.5" y="-8" width="3" height="8" fill="#92400e"/><circle cx="0" cy="-13" r="7" fill="${ve}" opacity=".8"/></g>`;
  const est = x => `<g transform="translate(${x},52)"><rect x="-1" y="-22" width="2" height="22" fill="${az}"/><rect x="17" y="-18" width="2" height="18" fill="${az}"/><line x1="-3" y1="-23" x2="21" y2="-19" stroke="${az}" stroke-width="3"/></g>`;
  const viento = `<g stroke="${az}" stroke-width="1.6" fill="none"><path d="M6,10 h18"/><path d="M6,17 h12"/><path d="M20,6 l5,4 -5,4"/></g>`;
  const cota = (x1, x2, txt, y=62) => `<g stroke="${g}"><line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/><line x1="${x1}" y1="${y-3}" x2="${x1}" y2="${y+3}"/><line x1="${x2}" y1="${y-3}" x2="${x2}" y2="${y+3}"/></g><text x="${(x1+x2)/2}" y="${y+10}" text-anchor="middle" font-size="8.5" fill="#475569">${txt}</text>`;
  const agua = (x1, x2) => `<path d="M${x1},52 ${Array.from({length:Math.floor((x2-x1)/12)},(_,i)=>`q3,-3 6,0 q3,3 6,0`).join(' ')}" fill="none" stroke="${ag}" stroke-width="2"/><rect x="${x1}" y="52" width="${x2-x1}" height="4" fill="${ag}" opacity=".25"/>`;
  const svg = (c, h=58) => `<svg viewBox="0 0 200 ${h}" class="ilu" aria-hidden="true">${c}</svg>`;
  return {
    rB: svg(suelo() + [20,40,62,84,104,128,150,172].map((x,i) => i%3===2 ? arbol(x) : casa(x)).join('') + viento),
    rC: svg(suelo() + arbol(40,.8) + casa(110,.8) + arbol(165,.7) + `<path d="M0,52 q50,-3 100,0 t100,0" fill="none" stroke="${ve}" stroke-opacity=".5"/>` + viento),
    rD: svg(suelo() + agua(10, 190) + viento),
    eB: svg(suelo() + [10,28,46,64,82,100,118].map(x => casa(x,.75)).join('') + est(150) + cota(4, 140, '≥ 800 m o 20h (460 m si h ≤ 9 m)') + viento, 75),
    eC: svg(suelo() + arbol(30,.7) + casa(80,.7) + est(150) + cota(4, 140, 'no cumple B ni D') + viento, 75),
    eD: svg(suelo() + agua(4, 100) + casa(118,.7) + est(150) + cota(4, 100, '> 1500 m o 20h') + cota(100, 148, '< 200 m', 70) + viento, 82),
  };
})();

// Ventana con las condiciones de rugosidad y exposición (NSR-10 B.6.5.6.2 y B.6.5.6.3)
function modalCondiciones(A){
  const R = AnexoA.calcular(A).viento, hm = R.ok ? R.hm : null;
  const lim = hm ? AnexoA.exposicion(A.viento, hm) : null;
  const md = document.createElement('div'); md.className = 'modal';
  md.innerHTML = `<div class="box2 cond" role="dialog" aria-modal="true" aria-labelledby="condT">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h3 id="condT">Condiciones de exposición — NSR-10</h3><button class="btn sm" type="button" data-cerrar aria-label="Cerrar">✕</button></div>
    <h4 class="sub">1. Rugosidad del terreno (B.6.5.6.2)</h4>
    <p class="lead">Se mira el terreno viento arriba, en un sector de 45° a cada lado de la dirección del viento.</p>
    <div class="cgrid">
      <div class="cbox">${ILU.rB}<b>Rugosidad B</b><span>Zonas urbanas y suburbanas, áreas boscosas u otros terrenos con muchas obstrucciones del tamaño de una vivienda unifamiliar o mayores, y poco espacio entre ellas.</span></div>
      <div class="cbox">${ILU.rC}<b>Rugosidad C</b><span>Terreno abierto con pocas obstrucciones de menos de 9 m de altura: campos planos abiertos, praderas, y superficies de agua en zonas con huracanes.</span></div>
      <div class="cbox">${ILU.rD}<b>Rugosidad D</b><span>Áreas planas sin obstrucciones y superficies de agua fuera de zonas de huracanes: pantanos, salinas y superficies de hielo.</span></div>
    </div>
    <h4 class="sub">2. Categoría de exposición (B.6.5.6.3)</h4>
    <div class="cgrid">
      <div class="cbox">${ILU.eB}<b>Exposición B</b><span>Cuando la rugosidad B se mantiene viento arriba en una distancia de al menos <b>800 m</b> o <b>20 veces la altura</b> de la estructura, la que sea mayor. Si la altura media es de 9 m o menos, basta con <b>460 m</b>.</span>${lim ? `<em>Para este proyecto: ${fx(lim.limB,0)} m</em>` : ''}</div>
      <div class="cbox">${ILU.eC}<b>Exposición C</b><span>Se usa en todos los casos donde no aplican la B ni la D.</span></div>
      <div class="cbox">${ILU.eD}<b>Exposición D</b><span>Cuando la rugosidad D se mantiene viento arriba en más de <b>1500 m</b> o <b>20 veces la altura</b>, la que sea mayor. También aplica si la estructura está a menos de <b>200 m</b> o <b>20 veces la altura</b> (la mayor) de un terreno D, en terreno B o C.</span>${lim ? `<em>Para este proyecto: ${fx(lim.limD,0)} m / ${fx(lim.limDvecina,0)} m</em>` : ''}</div>
    </div>
    <div class="note blue" style="margin-top:10px"><b>Zonas de transición:</b> si la estructura está entre dos categorías, se usa la que dé mayores fuerzas de viento. Se permite una categoría intermedia solo si se justifica con un procedimiento analítico reconocido.</div>
    <div class="hint">Cómo decide la app: compara la distancia que escribes con estos límites y propone la exposición. Siempre puedes escoger otra en "Exposición usada".</div>
  </div>`;
  document.body.appendChild(md);
  const cerrar = () => { md.remove(); document.removeEventListener('keydown', esc_); };
  const esc_ = e => { if(e.key === 'Escape') cerrar(); };
  md.onclick = e => { if(e.target === md || e.target.closest('[data-cerrar]')) cerrar(); };
  document.addEventListener('keydown', esc_);
  md.querySelector('[data-cerrar]').focus();
}

// ═══ Figuras de presiones netas (solo para el PDF) ═══
// Sistema principal: 4 esquemas (casos A y B, γ = 0° y 180°) con flechas proporcionales a CN
function svgSPRFV(W){
  const fig = (s, i) => {
    const ox = (i % 2) * 260, oy = Math.floor(i / 2) * 150;
    const x1 = ox + 45, y1 = oy + 52, x2 = ox + 215, y2 = oy + 82;           // cubierta: alta a la izquierda
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), nx = dy / len, ny = -dx / len; // normal hacia arriba
    const mitad = (t0, t1, cn) => { let a = '';
      for(let k = 0; k < 4; k++){ const t = t0 + (t1 - t0) * (k + .5) / 4, px = x1 + dx*t, py = y1 + dy*t, L = 8 + 16*Math.min(Math.abs(cn), 2.5);
        const ax = px + nx*L, ay = py + ny*L;                                 // punta lejos de la cubierta
        a += cn >= 0 ? `<line x1="${ax}" y1="${ay}" x2="${px+nx*2}" y2="${py+ny*2}" stroke="#1f3a60" stroke-width="1.3" marker-end="url(#fp)"/>`
                     : `<line x1="${px+nx*2}" y1="${py+ny*2}" x2="${ax}" y2="${ay}" stroke="#b91c1c" stroke-width="1.3" marker-end="url(#fs)"/>`; }
      return a; };
    const izq = s.gam === 0 ? s.CNW : s.CNL, der = s.gam === 0 ? s.CNL : s.CNW;
    const pIzq = s.gam === 0 ? s.pW : s.pL, pDer = s.gam === 0 ? s.pL : s.pW;
    const viento = s.gam === 0 ? `<path d="M${ox+8},${oy+70} h24" stroke="#1a56db" stroke-width="2" marker-end="url(#fv)"/>` : `<path d="M${ox+252},${oy+70} h-24" stroke="#1a56db" stroke-width="2" marker-end="url(#fv)"/>`;
    return `<g><text x="${ox+130}" y="${oy+14}" text-anchor="middle" font-weight="700" font-size="11">Caso ${s.caso} · γ = ${s.gam}°</text>
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#111" stroke-width="3"/>
      <line x1="${x1}" y1="${y1}" x2="${x1}" y2="${oy+122}" stroke="#666"/><line x1="${x2}" y1="${y2}" x2="${x2}" y2="${oy+122}" stroke="#666"/>
      <line x1="${ox+30}" y1="${oy+122}" x2="${ox+230}" y2="${oy+122}" stroke="#666"/>
      <line x1="${(x1+x2)/2}" y1="${(y1+y2)/2-30}" x2="${(x1+x2)/2}" y2="${(y1+y2)/2+8}" stroke="#999" stroke-dasharray="3 2"/>
      ${mitad(0, .5, izq)}${mitad(.5, 1, der)}${viento}
      <text x="${ox+88}" y="${oy+112}" text-anchor="middle" font-size="9.5">${s.gam===0?'CNW':'CNL'} = ${fx(izq,2)}</text>
      <text x="${ox+88}" y="${oy+123}" text-anchor="middle" font-size="8.5" fill="#555">${fx(pIzq,3)} kN/m²</text>
      <text x="${ox+175}" y="${oy+112}" text-anchor="middle" font-size="9.5">${s.gam===0?'CNL':'CNW'} = ${fx(der,2)}</text>
      <text x="${ox+175}" y="${oy+123}" text-anchor="middle" font-size="8.5" fill="#555">${fx(pDer,3)} kN/m²</text></g>`;
  };
  return `<figure class="ax-fig"><svg viewBox="0 0 520 300" width="520" height="300" font-family="serif">
    <defs><marker id="fp" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#1f3a60"/></marker>
    <marker id="fs" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#b91c1c"/></marker>
    <marker id="fv" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#1a56db"/></marker></defs>
    ${W.sp.map(fig).join('')}</svg>
    <figcaption>Presiones netas sobre la cubierta, sistema principal (esquema según Figura B.6.5-18A). Azul: presión hacia la cubierta; rojo: succión. La flecha horizontal indica la dirección del viento.</figcaption></figure>`;
}
// Componentes y revestimiento: zonas 1, 2 y 3 en planta con el valor de a
function svgZonas(A, W){
  const L = AnexoA.num(A.viento.L), B = AnexoA.num(A.viento.W);
  const ew = 380, eh = Math.max(110, Math.min(200, ew * B / L)), x0 = 70, y0 = 20, b = 16;   // franjas dibujadas de ancho fijo (esquema)
  const e = W.porElem[0], cn = e ? e.cyr : [];
  const z = k => cn.find(c => c.zona === k);
  const et = (k, x, y) => { const c = z(k); return `<text x="${x}" y="${y}" text-anchor="middle" font-size="10" font-weight="700">Zona ${k}</text>${c ? `<text x="${x}" y="${y+12}" text-anchor="middle" font-size="8.5" fill="#444">CN ${fx(c.CNp,2)} / ${fx(c.CNs,2)}</text>` : ''}`; };
  return `<figure class="ax-fig"><svg viewBox="0 0 520 ${eh+92}" width="520" height="${eh+92}" font-family="serif">
    <rect x="${x0}" y="${y0}" width="${ew}" height="${eh}" fill="#c7d4e8" stroke="#1f3a60" stroke-width="1.5"/>
    <rect x="${x0+b}" y="${y0+b}" width="${ew-2*b}" height="${eh-2*b}" fill="#dfe7f3" stroke="#1f3a60"/>
    <rect x="${x0+2*b}" y="${y0+2*b}" width="${ew-4*b}" height="${eh-4*b}" fill="#f4f7fb" stroke="#1f3a60"/>
    ${et(1, x0+ew/2, y0+eh/2-4)}
    <text x="${x0+ew-b*1.5}" y="${y0+eh/2+3}" text-anchor="middle" font-size="9" font-weight="700" transform="rotate(-90 ${x0+ew-b*1.5} ${y0+eh/2+3})">Zona 2</text>
    <text x="${x0+ew-b*.5}" y="${y0+eh/2+3}" text-anchor="middle" font-size="9" font-weight="700" transform="rotate(-90 ${x0+ew-b*.5} ${y0+eh/2+3})">Zona 3</text>
    <g stroke="#555"><line x1="${x0}" y1="${y0+eh+12}" x2="${x0+b}" y2="${y0+eh+12}"/><line x1="${x0+b}" y1="${y0+eh+12}" x2="${x0+2*b}" y2="${y0+eh+12}"/>
      <line x1="${x0}" y1="${y0+eh+8}" x2="${x0}" y2="${y0+eh+16}"/><line x1="${x0+b}" y1="${y0+eh+8}" x2="${x0+b}" y2="${y0+eh+16}"/><line x1="${x0+2*b}" y1="${y0+eh+8}" x2="${x0+2*b}" y2="${y0+eh+16}"/>
      <line x1="${x0}" y1="${y0+eh+36}" x2="${x0+ew}" y2="${y0+eh+36}"/><line x1="${x0-14}" y1="${y0}" x2="${x0-14}" y2="${y0+eh}"/></g>
    <text x="${x0+2*b+6}" y="${y0+eh+15}" font-size="9">a = ${fx(W.a,3)} m (cada franja)</text>
    <text x="${x0+ew/2}" y="${y0+eh+50}" text-anchor="middle" font-size="10">L = ${fx(L,2)} m</text>
    <text x="${x0-20}" y="${y0+eh/2}" text-anchor="middle" font-size="10" transform="rotate(-90 ${x0-20} ${y0+eh/2})">W = ${fx(B,2)} m</text>
    ${cn.length ? `<text x="260" y="${y0+eh+66}" text-anchor="middle" font-size="9" fill="#333">CN (presión / succión): zona 1 = ${fx(z(1).CNp,2)} / ${fx(z(1).CNs,2)} · zona 2 = ${fx(z(2).CNp,2)} / ${fx(z(2).CNs,2)} · zona 3 = ${fx(z(3).CNp,2)} / ${fx(z(3).CNs,2)}</text>` : ''}
  </svg><figcaption>Zonas de presión para componentes y revestimiento en planta (esquema según Figura B.6.5-19A; ancho de franjas no a escala).${e ? ` CN para ${esc(e.nombre.toLowerCase())}.` : ''}</figcaption></figure>`;
}
