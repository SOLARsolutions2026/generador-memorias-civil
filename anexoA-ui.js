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
    h += `<div class="card"><div class="ct">A.1 Paneles solares — datos</div>
      <div class="fg g4"><div class="f span2"><label>Panel de la biblioteca</label><select id="selPanel" ${ro()}><option value="">— Escribir datos —</option>${pans.map((p,i) => `<option value="${i}" ${p.nombre===A.panel.nombre?'selected':''}>${esc(p.nombre)}</option>`).join('')}</select></div>
        ${fIn(A,'panel.nombre','Referencia del panel',{cls:'span2',num:false})}${fIn(A,'panel.L','Longitud L [m]')}${fIn(A,'panel.W','Ancho A [m]')}${fIn(A,'panel.H','Espesor H [m]')}${fIn(A,'panel.peso','Peso [kg/un]')}
        ${fIn(A,'panel.cargaF','Carga mecánica frontal [Pa]',{h:'De la ficha técnica'})}${fIn(A,'panel.cargaP','Carga mecánica posterior [Pa]')}
        <div class="f"><label>&nbsp;</label>${esIng()?'<button class="btn sm" type="button" id="bibPanel">＋ Guardar en biblioteca</button>':''}</div></div>
      <div class="fg g4" style="margin-top:10px"><div class="f span2"><label>Riel de la biblioteca</label><select id="selRiel" ${ro()}><option value="">— Escribir datos —</option>${rie.map((p,i) => `<option value="${i}" ${p.nombre===A.riel.nombre?'selected':''}>${esc(p.nombre)}</option>`).join('')}</select></div>
        ${fIn(A,'riel.nombre','Referencia del riel',{cls:'span2',num:false})}${fIn(A,'riel.alto','Alto [m]')}${fIn(A,'riel.ancho','Ancho [m]')}${fIn(A,'riel.peso','Peso [kg/ml]')}
        ${A.riel.material ? `<div class="hint span4">Ficha técnica: ${[A.riel.material && 'material ' + esc(A.riel.material), A.riel.vmax && 'viento hasta ' + esc(A.riel.vmax) + ' m/s'].filter(Boolean).join(' · ')}</div>` : ''}
        <div class="f"><label>&nbsp;</label>${esIng()?'<button class="btn sm" type="button" id="bibRiel">＋ Guardar en biblioteca</button>':''}</div></div>
      <div class="fg g4" style="margin-top:10px">${fIn(A,'dBorde','Riel al borde del panel [m]')}${fIn(A,'tribRiel','Ancho aferente por riel [m]',{ph:fx(R.paneles.tribAuto,3)+' (auto = L/2)',h:'Vacío = la mitad del largo del panel'})}</div></div>`;
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
    <div class="card"><div class="ct">Geometría de la cubierta (a un agua)</div><div class="fg g4">
      ${fIn(A,'viento.L','Longitud L [m]')}${fIn(A,'viento.W','Ancho W [m]',{h:'En el sentido de la pendiente'})}${fIn(A,'viento.He','Altura de cornisa He [m]')}${fIn(A,'viento.Hr','Altura de cumbrera Hr [m]')}</div></div>
    <div class="card"><div class="ct">Exposición (B.6.5.6)</div><div class="fg g4">
      ${fSel(A,'viento.rug','Rugosidad viento arriba',[['B','B — urbano, suburbano, boscoso'],['C','C — abierto, pocas obstrucciones'],['D','D — plano, superficies de agua']],{cls:'span2',re:1})}
      ${fIn(A,'viento.distRug','Distancia con esa rugosidad [m]')}
      ${fSel(A,'viento.expManual','Exposición usada',[['','Automática (la propuesta)'],['B','B'],['C','C'],['D','D']],{re:1})}
      <div class="f span2">${fChk(A,'viento.cercaD','Hay un terreno con rugosidad D cerca, viento arriba')}</div>
      ${v.cercaD ? fIn(A,'viento.distD','Distancia a ese terreno D [m]') : ''}</div>
      <div id="expo" style="margin-top:10px"></div></div>
    <div class="card"><div class="ct">Factor topográfico Kzt (B.6.5.7)</div>
      <div class="hint" style="margin-bottom:6px">Marca solo las condiciones que se cumplen. Si se cumplen las cinco, hay que calcular Kzt.</div>
      <div style="display:grid;gap:6px">${['(a) Colina o escarpe aislado y sin obstrucciones a barlovento','(b) Sobresale por encima del terreno viento arriba en un factor de 2 o más','(c) La estructura está en la mitad superior de la colina o cerca de la cresta','(d) H/Lh ≥ 0.2','(e) H ≥ 4.5 m (exposición C y D) o 18 m (exposición B)'].map((t,i) => fChk(A,`viento.kzt.${i}`,t)).join('')}</div>
      ${v.kzt.every(Boolean) ? `<div class="fg g4" style="margin-top:8px">${fIn(A,'viento.kztManual','Kzt calculado (B.6.5-1)')}</div>` : ''}</div>
    <div class="card"><div class="ct">Análisis</div><div class="fg g4">
      ${fSel(A,'viento.flujo','Flujo bajo la cubierta',[['libre','Libre (bloqueo ≤ 50 %)'],['obst','Obstruido (bloqueo > 50 %)']],{h:'Objetos debajo que frenan el viento'})}
      ${fSel(A,'viento.sistema','Sistema estructural (para Ta)',AnexoA.SISTEMAS.map((s,i) => [i,s.nombre]),{cls:'span2'})}
      ${fIn(A,'viento.Gmanual','Factor ráfaga G (si no es rígida)',{ph:'0.85'})}
      ${fIn(A,'viento.luz','Luz del riel / correa entre apoyos [m]',{h:'Para el área efectiva de viento'})}
      ${fSel(A,'viento.fuente','Presión que va a SAP2000',[['sprfv','Sistema principal (SPRFV)'],['cyr','Componentes y revestimiento']],{cls:'span2'})}</div></div>
    <div class="card"><div class="ct">Resultados</div><div id="resA">${RES_A.viento(A,R)}</div></div>`;
},
resumen(A, R){
  return `<div class="card"><div class="ct">Cargas para SAP2000 [kN/ml]${esIng()?'<button class="btn sm" type="button" id="copiarA">Copiar tabla</button>':''}</div><div id="resA">${RES_A.resumen(A,R)}</div>
    <div class="hint" style="margin-top:8px">Valores redondeados hacia arriba a 3 decimales. W↓ = presión hacia la cubierta, W↑ = succión. Presión mínima de diseño 0.40 kN/m².</div></div>
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
  if(R.paneles){ const p = R.paneles;
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
  const bib = S.cfg.biblioteca = S.cfg.biblioteca || {};
  const usar = (sel, lista, destino) => { const s = $(sel); if(!s) return; s.onchange = () => { const x = (bib[lista]||[])[s.value]; if(x){ if(destino === 'panel') Object.assign(A.panel, { H:'', cargaF:'', cargaP:'' }); if(destino === 'riel') Object.assign(A.riel, { material:'', vmax:'' }); delete A.riel.Ix; delete A.riel.Iy; Object.assign(A[destino], x); guardarMemoria(); pintarTabA(); } }; };
  usar('#selPanel', 'paneles', 'panel'); usar('#selRiel', 'rieles', 'riel');
  const guardarBib = async (lista, obj) => {
    if(!obj.nombre?.trim()) return toast('Escribe primero la referencia.');
    bib[lista] = (bib[lista] || []).filter(x => x.nombre !== obj.nombre); bib[lista].push({ ...obj });
    const { error } = await sb.from('mem_config').update({ biblioteca:bib }).eq('id', 1);
    error ? err(error) : (toast(`"${obj.nombre}" guardado en la biblioteca.`), pintarTabA());
  };
  if($('#bibPanel')) $('#bibPanel').onclick = () => guardarBib('paneles', A.panel);
  if($('#bibRiel')) $('#bibRiel').onclick = () => guardarBib('rieles', A.riel);
},
viento(A){ const W = AnexoA.calcular(A).viento; if(W.ok && $('#expo')) $('#expo').innerHTML = expoHTML(W); },
resumen(A){
  const R = AnexoA.calcular(A);
  if($('#copiarA')) $('#copiarA').onclick = () => {
    const t = [...document.querySelectorAll('table.sapres tr')].map(tr => [...tr.children].map(td => td.textContent).join('\t')).join('\n');
    navigator.clipboard.writeText(t).then(() => toast('Tabla copiada: pégala en Excel o en tus notas de SAP2000.'));
  };
  $('#printA').onclick = async () => {
    const pa = $('#print-area'); pa.innerHTML = anexoAPrintHTML(A, R);
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
      <h3>${letra}.${n}.1 Datos geométricos</h3>${kv([['Longitud L [m]',fx(AnexoA.num(v.L),2)],['Ancho W [m]',fx(AnexoA.num(v.W),2)],['Altura de cornisa He [m]',fx(AnexoA.num(v.He),2)],['Altura de cumbrera Hr [m]',fx(AnexoA.num(v.Hr),2)],['Ángulo de cubierta θ',fx(W.theta,2)+'°'],['Altura media h [m]',fx(W.hm,2)],['Tipo','Cubierta libre a un agua']])}
      <h3>${letra}.${n}.2 Presiones netas — sistema principal (Figura B.6.5-18A, ${v.flujo==='obst'?'flujo obstruido':'flujo libre'})</h3>
      ${tb(['Caso','γ','CNW','CNL','pW [kN/m²]','pL [kN/m²]'], W.sp.map(x => [x.caso, x.gam+'°', fx(x.CNW,2), fx(x.CNL,2), fx(x.pW,4), fx(x.pL,4)]))}
      <p>p = qh · G · CN. Para θ menor a 7.5° se usan los coeficientes de θ = 0°.</p>
      <h3>${letra}.${n}.3 Presiones — componentes y revestimiento (Figura B.6.5-19A)</h3>
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
