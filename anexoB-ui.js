/* ═══ Pantalla del Anexo B — FHE (usa calc/anexoB.js y los datos del Anexo A) ═══ */
'use strict';
const TXT_SIN_SISMO = 'El alcance del presente análisis no incluye la evaluación sísmica de la estructura. Por lo tanto, no se calcula la fuerza horizontal equivalente (FHE) y el diseño se realiza con las combinaciones de carga muerta, viva y de viento.';

function datosB(){
  const m = S.m; m.anexos = m.anexos || {};
  const B = m.anexos.B = m.anexos.B || {};
  const d = AnexoB.defaults(); for(const k in d) if(B[k] === undefined) B[k] = d[k];
  // textos guardados antes de quitar el nombre del programa
  if(/SAP2000/.test(B.estructura?.sapFuente || '')) B.estructura.sapFuente = B.estructura.sapFuente.replace(/SAP2000( v[\d.]+)?\s*—\s*/,'').replace(/SAP2000/g, 'modelo');
  return B;
}
function calcB(){ const B = datosB(), A = datosA(); return AnexoB.calcular(B, A, AnexoA.calcular(A)); }

function paneAnexoB(){
  if(typeof sincronizarIrregular === 'function') sincronizarIrregular();
  const B = datosB(), ro_ = esIng() ? '' : 'disabled';
  if(B.aplica && B.metodo !== 'manual' && !window.NSR_SISMO){ cargarSismo().then(() => { prellenarMunicipio(B); if(S.m && document.getElementById('pane')) paneAnexoB(); }); }
  let h = `<div class="card"><div class="ct">Alcance del análisis</div>
    <div class="f"><label>¿El proyecto lleva análisis sísmico?</label>
      <div class="seg" role="group" aria-label="Lleva análisis sísmico"><button type="button" data-sis="1" class="${B.aplica?'on':''}" ${ro_}>Sí</button><button type="button" data-sis="0" class="${!B.aplica?'on':''}" ${ro_}>No</button></div></div>
    ${!B.aplica ? `<div class="note green" style="margin-top:12px"><b>Sin análisis sísmico.</b> El Anexo B no se incluye en la memoria y el paso queda completo. En su lugar va esta nota, que puedes ajustar:</div>
      <div class="f"><label for="txtSis">Nota de alcance (sale en la memoria)</label><textarea id="txtSis" rows="4" ${ro_}>${esc(B.texto || TXT_SIN_SISMO)}</textarea><div class="hint">Vacío = texto predeterminado.</div></div>` : ''}</div>`;
  if(B.aplica){
    const R = calcB();
    const SM = window.NSR_SISMO, mun = SM && B.munCode ? SM.mun.find(x => x.c === B.munCode) : null;
    const deptos = SM ? [...new Set(SM.mun.map(x => x.d).filter(Boolean))].sort((a,b) => a.localeCompare(b,'es')) : [];
    const manual = B.metodo === 'manual';
    h += `<div class="card"><div class="ct">B-1.1 Parámetros sísmicos</div>
      <div class="f" style="margin-bottom:10px"><label>¿Cómo se obtienen Aa y Av?</label>
        <div class="seg" role="group" aria-label="Método para Aa y Av"><button type="button" data-met="tabla" class="${B.metodo==='tabla'?'on':''}" ${ro_}>Por municipio (Apéndice A-4)</button><button type="button" data-met="coord" class="${B.metodo==='coord'?'on':''}" ${ro_}>Por coordenadas</button><button type="button" data-met="manual" class="${manual?'on':''}" ${ro_}>Escribir a mano</button></div></div>
      ${!SM && !manual ? '<p class="muted">Cargando la tabla del Apéndice A-4…</p>' : ''}
      ${SM && !manual ? `<div class="sismo"><div>
        ${B.metodo === 'tabla' ? `<div class="fg g2">
            <div class="f"><label>Departamento</label><select data-a="depto" data-re="1" ${ro_}><option value="">— Escoge —</option>${deptos.map(d => `<option ${d===B.depto?'selected':''}>${esc(d)}</option>`).join('')}</select></div>
            <div class="f"><label>Municipio</label><select data-a="munCode" data-re="1" ${ro_}><option value="">— Escoge —</option>${SM.mun.filter(x => x.d === B.depto).sort((a,b) => a.n.localeCompare(b.n,'es')).map(x => `<option value="${x.c}" ${x.c===B.munCode?'selected':''}>${esc(x.n)}</option>`).join('')}</select></div></div>`
          : `<div class="fg g2">${fIn(B,'lat','Latitud (°)',{ph:'8.311705',h:'Grados decimales, norte positivo'})}${fIn(B,'lon','Longitud (°)',{ph:'-73.597054',h:'Oeste negativo'})}</div>
            <div class="nav-btns" style="margin-top:6px"><button class="btn sm pri" type="button" id="buscarCoord">📍 Buscar municipio</button>${S.m.ficha.coord ? '<button class="btn sm" type="button" id="coordFicha">Usar las de la ficha</button>' : ''}</div>`}
        <div id="munInfo" style="margin-top:10px">${mun ? munInfoHTML(mun, B) : `<div class="hint">${B.metodo === 'coord' ? 'Escribe las coordenadas y toca Buscar.' : 'Escoge el departamento y el municipio.'}</div>`}</div></div>
        <div><div class="seg seg-sm" role="group" aria-label="Mapa de"><button type="button" data-mapa="aa" class="${B.mapa!=='av'?'on':''}">Mapa Aa</button><button type="button" data-mapa="av" class="${B.mapa==='av'?'on':''}">Mapa Av</button></div>
          <div id="mapaSis">${svgMapaSismo(B)}</div></div></div>` : ''}
      <div class="fg g4" style="margin-top:10px">
        ${manual ? fIn(B,'Aa','Aa',{h:'Apéndice A-4 según municipio'}) + fIn(B,'Av','Av') : `<div class="f"><label>Aa</label><input value="${esc(B.Aa)}" readonly/></div><div class="f"><label>Av</label><input value="${esc(B.Av)}" readonly/></div>`}
        ${fSel(B,'suelo','Perfil de suelo',Object.entries(AnexoB.SUELOS),{cls:'span2',h:'Del estudio de suelos (A.2.4)'})}
        ${fIn(B,'FaManual','Fa',{ph:fx(R.FaT,2)+' (tabla)',h:'Vacío = Tabla A.2.4-3'})}${fIn(B,'FvManual','Fv',{ph:fx(R.FvT,2)+' (tabla)',h:'Vacío = Tabla A.2.4-4'})}
        ${fSel(B,'grupo','Grupo de uso',Object.entries(AnexoB.GRUPOS),{cls:'span2',h:'Coeficiente de importancia I (Tabla A.2.5-1)'})}</div></div>
      <div class="card"><div class="ct">B-1.2 Parámetros de la estructura</div><div class="fg g4">
        ${fSel(B,'sistema','Sistema estructural',AnexoB.SISTEMAS.map((s,i) => [i,`${s.nombre} (Ct ${s.Ct}, α ${s.a})`]),{cls:'span2',h:'Tabla A.4.2-1'})}
        ${fIn(B,'h','Altura h [m]',{ph:R.hA ? fx(R.hA,2)+' (Hr del Anexo A)' : 'Escribe la altura',h:'Vacío = cumbrera Hr del Anexo A'})}
        <div class="hint" style="align-self:center">Los periodos del análisis modal se escriben en B-2.4; si no los escribes, se usa Ta.</div></div></div>
      <div class="card"><div class="ct">B-1.3 Espectro de diseño</div><div id="espB"></div></div>
      <div class="card"><div class="ct">B-2.1 Peso sísmico W</div>
        <div class="fg g4">${fIn(B,'area','Área en planta [m²]',{ph:R.areaAuto ? fx(R.areaAuto,2)+' (L × W)' : '—',h:'Vacío = L × W del Anexo A'})}</div>
        <h4 class="sub">① Cargas por área del Anexo A <span class="hint" style="text-transform:none;letter-spacing:0;font-weight:500">— se llenan solas; puedes quitar una o cambiar su área</span></h4>
        <div class="tw"><table class="t wtab"><thead><tr><th></th><th>Ítem</th><th>kg/m²</th><th>Área aplicada [m²]</th><th>Peso [kN]</th></tr></thead><tbody>
        ${R.cargas.length ? R.cargas.map(c => `<tr class="${c.on?'':'off'}"><td><input type="checkbox" data-a="items.${c.key}.on" data-re="1" ${c.on?'checked':''} ${ro_} aria-label="Incluir ${esc(c.n)}"/></td><td>${esc(c.n)}</td><td class="n">${fx(c.w,2)}</td>
          <td><input data-a="items.${c.key}.area" inputmode="decimal" value="${esc(B.items[c.key]?.area ?? '')}" placeholder="${fx(R.area,2)}" ${ro_}/></td><td class="n" data-kn="${c.key}">${c.on ? fx(c.kN,2) : '—'}</td></tr>`).join('')
          : '<tr><td colspan="5" class="hint">El Anexo A todavía no tiene cargas por área.</td></tr>'}
        <tr class="sub"><td></td><td colspan="3">Subtotal ①</td><td class="n" id="w1">${fx(R.Wcargas,2)}</td></tr></tbody></table></div>
        <h4 class="sub">② Peso propio de la estructura</h4>
        <div class="seg" role="group" aria-label="Cómo se ingresa el peso propio" style="margin-bottom:8px"><button type="button" data-modo="lista" class="${B.estructura.modo!=='sap'?'on':''}" ${ro_}>Lista de perfiles</button><button type="button" data-modo="sap" class="${B.estructura.modo==='sap'?'on':''}" ${ro_}>Total del modelo</button></div>
        ${B.estructura.modo === 'sap' ? `<div class="fg g4">${fIn(B,'estructura.sapKN','Peso propio total [kN]')}${fIn(B,'estructura.sapFuente','Fuente',{cls:'span2',num:false})}
            <div class="f"><label>Imagen de la tabla (opcional)</label><div class="nav-btns">${B.estructura.sapImg ? '<button class="btn sm" type="button" id="verSap">🖼️ Ver</button>' : ''}${esIng() ? `<button class="btn sm pri" type="button" id="subSap">${B.estructura.sapImg ? 'Cambiar' : '📎 Subir'}</button>` : ''}</div></div></div>`
          : `<div class="tw"><table class="t wtab"><thead><tr><th>Perfil</th><th>kg/m</th><th>Longitud total [m]</th><th>Peso [kN]</th><th></th></tr></thead><tbody>
            ${R.perfiles.map((p,i) => `<tr><td><select data-a="estructura.perfiles.${i}.perfil" data-re="1" ${ro_}>${Object.keys(AnexoB.PERFILES).map(k => `<option ${k===p.perfil?'selected':''}>${k}</option>`).join('')}<option value="otro" ${p.perfil==='otro'?'selected':''}>Otro…</option></select>
                ${p.perfil === 'otro' ? `<input data-a="estructura.perfiles.${i}.nom" value="${esc(p.nom||'')}" placeholder="Nombre del perfil" style="margin-top:4px" ${ro_}/>` : ''}</td>
              <td><input data-a="estructura.perfiles.${i}.kgm" inputmode="decimal" value="${esc(p.kgm||'')}" placeholder="${p.kgmT ? fx(p.kgmT,2) : 'kg/m'}" ${ro_}/></td>
              <td><input data-a="estructura.perfiles.${i}.L" inputmode="decimal" value="${esc(p.L||'')}" ${ro_}/></td><td class="n" data-pkn="${i}">${fx(p.kN,2)}</td>
              <td>${esIng() ? `<button class="btn sm danger" type="button" data-delp="${i}" aria-label="Quitar perfil">✕</button>` : ''}</td></tr>`).join('')}
            <tr class="sub"><td colspan="3">Subtotal ②</td><td class="n" id="w2">${fx(R.Wprop,2)}</td><td></td></tr></tbody></table></div>
            ${esIng() ? '<button class="btn sm" type="button" id="addP" style="margin-top:6px">＋ Agregar perfil</button>' : ''}
            <div class="hint" style="margin-top:4px">kg/m de IPE, HEA y HEB según tablas de perfiles; los tubos se calculan con su espesor (valor aproximado). Escribe otro kg/m si tu proveedor da uno distinto.</div>`}
        <h4 class="sub">③ Otras cargas (anuncios, tanques, equipos…)</h4>
        <div class="tw"><table class="t wtab"><thead><tr><th>Descripción</th><th>Cantidad</th><th>Unidad</th><th>Peso unitario [kg/unidad]</th><th>Ubicación</th><th>Peso [kN]</th><th></th></tr></thead><tbody>
          ${R.otras.map((o,i) => `<tr><td><input data-a="otras.${i}.n" value="${esc(o.n||'')}" placeholder="Ej: anuncio publicitario" ${ro_}/></td><td><input data-a="otras.${i}.cant" inputmode="decimal" value="${esc(o.cant||'')}" ${ro_}/></td>
            <td><select data-a="otras.${i}.unidad" ${ro_}>${['m²','ml','und'].map(x => `<option ${x===(o.unidad||'m²')?'selected':''}>${x}</option>`).join('')}</select></td>
            <td><input data-a="otras.${i}.pu" inputmode="decimal" value="${esc(o.pu||'')}" ${ro_}/></td><td><input data-a="otras.${i}.ubic" value="${esc(o.ubic||'')}" placeholder="Ej: sobre el eje A" ${ro_}/></td>
            <td class="n" data-okn="${i}">${fx(o.kN,2)}</td><td>${esIng() ? `<button class="btn sm danger" type="button" data-delo="${i}" aria-label="Quitar carga">✕</button>` : ''}</td></tr>`).join('')}
          <tr class="sub"><td colspan="5">Subtotal ③</td><td class="n" id="w3">${fx(R.Wotras,2)}</td><td></td></tr></tbody></table></div>
        ${esIng() ? '<button class="btn sm" type="button" id="addO" style="margin-top:6px">＋ Agregar carga</button>' : ''}
        <div class="wtot"><span>W = ① + ② + ③</span><span id="wtot">${fx(R.W,2)} kN (${fx(R.W*1000/AnexoB.G,0)} kg)</span></div></div>
      <div class="card"><div class="ct">B-2.2 Fuerza horizontal equivalente y torsión accidental</div>
        <div class="fg g4">${fIn(B,'dimX','Dimensión en X [m]',{ph:R.dimX ? fx(R.dimX,2)+' (L)' : '—'})}${fIn(B,'dimY','Dimensión en Y [m]',{ph:R.dimY ? fx(R.dimY,2)+' (W)' : '—'})}${fIn(B,'excent','Excentricidad accidental',{ph:'0.05',h:'5 % (A.3.6.7.1)'})}</div>
        <div id="resA" style="margin-top:10px"></div></div>
      <div class="card"><div class="ct">B-2.4 Comparación con el análisis dinámico modal</div>
        <div class="fg g4">${fIn(B,'Tx','Periodo modal Tx [s]',{ph:'del modelo'})}${fIn(B,'Ty','Periodo modal Ty [s]',{ph:'del modelo'})}
          ${fIn(B,'Vtx','Cortante basal modal Vtx [kN]',{ph:'del modelo'})}${fIn(B,'Vty','Cortante basal modal Vty [kN]',{ph:'del modelo'})}
          <div class="f span2">${S.m.anexos?.K ? `<div class="hint" style="padding-top:6px">Estructura <b>${B.irregular ? 'irregular (se exige 90 %)' : 'regular (se exige 80 %)'}</b>, según el paso Combinaciones e irregularidades.</div>` : fChk(B,'irregular','Estructura irregular (exige 90 % en vez de 80 %)')}</div></div>
        <div id="modalB" style="margin-top:10px"></div>
        <div class="hint" style="margin-top:6px">A.4.2.1: el periodo del análisis no puede ser mayor que Cu·Ta. A.5.4.5: el cortante modal en la base no puede ser menor que el 80 % de Vs (90 % si es irregular); si es menor, los resultados modales se multiplican por el factor de ajuste.</div>
        <div class="iter-box"><div class="iter-t">Historial de iteraciones</div>
          ${esIng() ? `<div class="iter-row">${fIn(B,'notaIter','Nota de esta iteración (qué cambió)',{num:false, ph:'Ej.: IPE 240 → IPE 270; factor 1.265 aplicado al espectro en el modelo'})}
            <button class="btn sm" type="button" id="guardarIter">📌 Guardar iteración y empezar otra</button></div>
          <div class="hint">Cada vez que cambies la estructura o el factor de escala en el modelo, guarda la iteración antes de escribir los nuevos valores. La fila <b>Actual</b> es la que sale completa en la memoria.</div>` : ''}
          <div id="iterB" style="margin-top:8px"></div></div></div>
      <div class="card"><div class="ct">Páginas del Anexo B</div>
        <p class="lead" style="margin-bottom:10px">Imprime o guarda en PDF las páginas del Anexo B con el formato de la memoria (carta).</p>
        <button class="btn grn" type="button" id="printB">🖨 Imprimir / Guardar PDF del Anexo B</button></div>`;
  }
  pane(h);
  if(!esIng()) { if(B.aplica) pintarResB(); return; }
  $$('[data-sis]').forEach(b => b.onclick = () => { B.aplica = b.dataset.sis === '1'; guardarMemoria(); renderWS('B'); });
  $$('[data-met]').forEach(b => b.onclick = () => { B.metodo = b.dataset.met; if(B.metodo === 'coord' && !B.lat && S.m.ficha.coord) usarCoordFicha(B); guardarMemoria(); paneAnexoB(); });
  $$('[data-mapa]').forEach(b => b.onclick = () => { B.mapa = b.dataset.mapa; guardarMemoria(); paneAnexoB(); });
  if($('#coordFicha')) $('#coordFicha').onclick = () => { usarCoordFicha(B); buscarPorCoord(B); };
  if($('#buscarCoord')) $('#buscarCoord').onclick = () => buscarPorCoord(B);
  const t = $('#txtSis'); if(t) t.oninput = () => { B.texto = t.value.trim() === TXT_SIN_SISMO ? '' : t.value; guardarMemoria(); };
  $$('#pane [data-a]').forEach(inp => inp.addEventListener(inp.type === 'checkbox' || inp.tagName === 'SELECT' ? 'change' : 'input', () => {
    const path = inp.dataset.a;
    if(path.startsWith('items.')){ const [, k] = path.split('.'); B.items[k] = B.items[k] || {}; }
    setP(B, path, inp.type === 'checkbox' ? inp.checked : inp.value);
    if(path === 'depto') B.munCode = '';
    if(path === 'munCode') aplicarMunicipio(B);
    guardarMemoria();
    inp.dataset.re ? paneAnexoB() : pintarResB();
  }));
  $$('[data-modo]').forEach(b => b.onclick = () => { B.estructura.modo = b.dataset.modo; guardarMemoria(); paneAnexoB(); });
  if($('#addP')) $('#addP').onclick = () => { B.estructura.perfiles.push({ perfil:'IPE 200', kgm:'', L:'' }); guardarMemoria(); paneAnexoB(); };
  $$('[data-delp]').forEach(b => b.onclick = () => { B.estructura.perfiles.splice(+b.dataset.delp, 1); guardarMemoria(); paneAnexoB(); });
  if($('#addO')) $('#addO').onclick = () => { B.otras.push({ n:'', cant:'', unidad:'m²', pu:'', ubic:'' }); guardarMemoria(); paneAnexoB(); };
  $$('[data-delo]').forEach(b => b.onclick = () => { B.otras.splice(+b.dataset.delo, 1); guardarMemoria(); paneAnexoB(); });
  if($('#subSap')) $('#subSap').onclick = async () => {
    const f = await elegirArchivo('image/*'); if(!f) return;
    try{ toast('Subiendo imagen…', 15000); const blob = await comprimir(f, { max:1800, type:'image/jpeg', q:0.85 });
      const path = `${S.m.id}/sap-peso-propio.jpg`; await subir(path, blob, 'image/jpeg'); B.estructura.sapImg = path; guardarMemoria(); toast('Imagen guardada.'); paneAnexoB();
    }catch(e){ err(e, 'No se pudo subir la imagen'); }
  };
  if($('#verSap')) $('#verSap').onclick = async () => { const u = await urlDe(B.estructura.sapImg); u ? window.open(u, '_blank') : toast('No se encontró la imagen.'); };
  if($('#guardarIter')) $('#guardarIter').onclick = () => {
    const R = calcB(); if(!R.ok) return toast('Faltan datos: ' + R.faltan.join(', '));
    const F = AnexoB.foto(B, R);
    if(AnexoB.mismaFoto(B.iter[B.iter.length-1], F)) return toast('Esta iteración ya está guardada. Cambia los datos del modelo o la estructura primero.');
    B.iter.push({ n:B.iter.length + 1, fecha:new Date().toISOString().slice(0,10), nota:(B.notaIter||'').trim(), ...F });
    B.notaIter = ''; guardarMemoria(); toast(`Iteración ${B.iter.length} guardada. Ya puedes escribir los nuevos valores.`); paneAnexoB();
  };
  if($('#iterB')) $('#iterB').onclick = e => {
    const b = e.target.closest('[data-deli]'); if(!b) return;
    B.iter.splice(+b.dataset.deli, 1); B.iter.forEach((x,i) => x.n = i + 1); guardarMemoria(); pintarResB();
  };
  if($('#printB')) $('#printB').onclick = async () => {
    const R = calcB(); if(!R.ok) return toast('Faltan datos: ' + R.faltan.join(', '));
    B.estructura._url = B.estructura.modo === 'sap' && B.estructura.sapImg ? await urlDe(B.estructura.sapImg) : null;
    const pa = $('#print-area'); pa.innerHTML = anexoBPrintHTML(B, R); delete B.estructura._url;
    await Promise.all([...pa.querySelectorAll('img')].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
    await document.fonts.ready; imprimirConMargen(`${S.m.consecutivo}_ANEXO_B`);
  };
  if(B.aplica) pintarResB();
}

// Historial de iteraciones (pantalla e impresión). La fila "Actual" son los datos de hoy, que salen completos en la memoria.
const fechaCorta = d => d ? d.split('-').reverse().join('/') : '';
function iterTablaHTML(B, R, imp){
  const it = B.iter || [], F = R.ok ? AnexoB.foto(B, R) : null, ult = it[it.length-1];
  const actualGuardada = F && AnexoB.mismaFoto(ult, F);
  if(!it.length) return imp ? '' : '<div class="hint">Aún no hay iteraciones guardadas.</div>';
  const xy = (a, b, d) => `${a == null ? '—' : fx(a,d)} / ${b == null ? '—' : fx(b,d)}`;
  const est = x => !x.Vtx && !x.Vty ? '—' : imp ? (x.ok ? 'Cumple' : 'Ajustar') : pill(x.ok ? 'ok' : 'no', x.ok ? 'Cumple' : 'Ajustar');
  const fila = (x, nom, del) => [nom, fechaCorta(x.fecha), fx(x.W,2), xy(x.Tx,x.Ty,3), xy(x.VsX,x.VsY,2), xy(x.Vtx,x.Vty,2), xy(x.fX,x.fY,3), est(x), esc(x.nota||''),
    ...(imp || !esIng() ? [] : [del == null ? '' : `<button class="btn sm danger" type="button" data-deli="${del}" aria-label="Borrar iteración">✕</button>`])];
  const filas = it.map((x,i) => fila(x, i === it.length-1 && actualGuardada ? `<b>${x.n} (final)</b>` : String(x.n), i));
  if(F && !actualGuardada) filas.push(fila({ ...F, fecha:new Date().toISOString().slice(0,10), nota: imp ? (B.notaIter || 'Iteración final') : (B.notaIter ? B.notaIter + ' (sin guardar)' : 'Sin guardar') }, imp ? `<b>${it.length+1} (final)</b>` : '<b>Actual</b>', null));
  const cab = ['Iter.','Fecha','W [kN]','T x / y [s]','Vs x / y [kN]','Vt x / y [kN]','Factor x / y','Estado','Nota', ...(imp || !esIng() ? [] : [''])];
  if(imp) return `<table class="ax-tb"><tr>${cab.map(x => `<th>${x}</th>`).join('')}</tr>${filas.map(r => `<tr>${r.map((x,i) => `<td class="${i && i < 8 ? 'c' : ''}">${x}</td>`).join('')}</tr>`).join('')}</table>`;
  return tabla(cab, filas, 'iter-tb');
}

function pintarResB(){
  const B = datosB(), R = calcB();
  const fa = document.querySelector('[data-a="FaManual"]'), fv = document.querySelector('[data-a="FvManual"]');
  if(fa) fa.placeholder = R.p.Aa ? fx(R.FaT,2) + ' (tabla)' : 'escribe Aa'; if(fv) fv.placeholder = R.p.Av ? fx(R.FvT,2) + ' (tabla)' : 'escribe Av';
  if($('#espB')) $('#espB').innerHTML = svgEspectro(R) + (R.ok ? res([['Fa · Fv', `${fx(R.p.Fa,2)} · ${fx(R.p.Fv,2)}`],['Coeficiente de importancia I', fx(R.p.I,2)],
    ['To · Tc · TL', `${fx(R.p.To,3)} · ${fx(R.p.Tc,3)} · ${fx(R.p.TL,2)} s`],['Ta = Ct·h^α', `${fx(R.sis.Ct,3)} × ${fx(R.h,2)}^${R.sis.a} = ${fx(R.Ta,3)} s`],
    ['Cu = 1.75 − 1.2·Av·Fv (≥ 1.2)', fx(R.Cu,3)],['Cu·Ta', fx(R.CuTa,3)+' s']]) : `<div class="note amber">Faltan: ${R.faltan.join(', ')}.</div>`);
  for(const c of R.cargas){ const td = document.querySelector(`[data-kn="${c.key}"]`); if(td) td.textContent = c.on ? fx(c.kN,2) : '—';
    const inp = document.querySelector(`[data-a="items.${c.key}.area"]`); if(inp) inp.placeholder = fx(R.area,2); }
  R.perfiles.forEach((p,i) => { const td = document.querySelector(`[data-pkn="${i}"]`); if(td) td.textContent = fx(p.kN,2); });
  R.otras.forEach((o,i) => { const td = document.querySelector(`[data-okn="${i}"]`); if(td) td.textContent = fx(o.kN,2); });
  const set = (id, t) => { const e = $('#'+id); if(e) e.textContent = t; };
  if($('#modalB')) $('#modalB').innerHTML = !R.ok ? '' : tabla(['Dirección','T modal [s]','T / Ta','¿T ≤ Cu·Ta?','Vs FHE [kN]','Vt modal [kN]','Vt / Vs','Mínimo','Factor de ajuste'], R.modal.map(r => [r.dir,
      r.Tdin ? fx(r.Tdin,3) : '—', r.relTa ? fx(r.relTa,2) : '—', r.okT == null ? '—' : pill(r.okT ? 'ok' : 'pend', r.okT ? 'Cumple' : `Se usa ${fx(r.CuTa,3)} s`),
      fx(r.Vs,2), r.Vt ? fx(r.Vt,2) : '—', r.Vt ? fx(r.rel*100,1)+' %' : '—', `${fx(r.pct*100,0)} %`,
      r.Vt ? (r.okV ? pill('ok','1.00 — Cumple') : pill('no', fx(r.factor,3))) : '—']));
  if($('#iterB')) $('#iterB').innerHTML = iterTablaHTML(B, R, false);
  set('w1', fx(R.Wcargas,2)); set('w2', fx(R.Wprop,2)); set('w3', fx(R.Wotras,2)); set('wtot', `${fx(R.W,2)} kN (${fx(R.W*1000/AnexoB.G,0)} kg)`);
  if($('#resA')) $('#resA').innerHTML = !R.ok ? `<div class="note amber">Faltan: ${R.faltan.join(', ')}.</div>` :
    tabla(['Dirección','T usado [s]','Sa [g]','k','Vs [kN]','Momento torsor [kN·m]'], [
      ['X', fx(R.tx.T,3) + (R.tx.din ? (R.tx.limitado ? ' (Cu·Ta)' : ' (modal)') : ' (Ta)'), fx(R.tx.Sa,4), fx(R.tx.k,2), `<b>${fx(R.tx.Vs,2)}</b>`, `${fx(R.MtX,2)} <span class="hint">= Vs × ${R.e} × ${fx(R.dimY,2)} m</span>`],
      ['Y', fx(R.ty.T,3) + (R.ty.din ? (R.ty.limitado ? ' (Cu·Ta)' : ' (modal)') : ' (Ta)'), fx(R.ty.Sa,4), fx(R.ty.k,2), `<b>${fx(R.ty.Vs,2)}</b>`, `${fx(R.MtY,2)} <span class="hint">= Vs × ${R.e} × ${fx(R.dimX,2)} m</span>`]]) +
    `<div class="hint" style="margin-top:6px">Vs = Sa · W (Ec. A.4.3-1). W = ${fx(R.W,2)} kN. Estructura de un nivel: toda la fuerza va a la cubierta (Cvx = 1). La FHE se aplica en el modelo en cada dirección con su momento torsor.</div>`;
}

// Gráfica del espectro Sa vs T con To, Tc, TL y los periodos usados
function svgEspectro(R, imp){
  if(!R.pts.length) return '<div class="hint">El espectro aparece al escribir Aa y Av.</div>';
  const W = 560, H = 230, x0 = 46, y0 = 14, w = W - x0 - 14, h = H - y0 - 34;
  const smax = Math.max(...R.pts.map(p => p[1])) * 1.15, X = t => x0 + t / R.Tmax * w, Y = s => y0 + h - s / smax * h;
  const az = imp ? '#1f3a60' : '#1a56db', gr = '#94a3b8';
  const linea = R.pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ');
  const ticks = []; for(let t = 0; t <= R.Tmax; t += 1) ticks.push(t);
  const marca = (t, txt, col='#64748b') => `<line x1="${X(t)}" y1="${y0}" x2="${X(t)}" y2="${y0+h}" stroke="${col}" stroke-dasharray="3 3"/><text x="${X(t)+3}" y="${y0+10}" font-size="10" fill="${col}">${txt}</text>`;
  const pto = (t, s, txt, abajo) => `<circle cx="${X(t)}" cy="${Y(s)}" r="4.5" fill="#dc2626"/><text x="${X(t)+7}" y="${abajo ? Y(s)+18 : Y(s)-7}" font-size="10.5" fill="#dc2626" font-weight="700">${txt}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="esp-svg" role="img" aria-label="Espectro elástico de aceleraciones de diseño">
    <g font-family="Segoe UI,system-ui,sans-serif">
    <line x1="${x0}" y1="${y0+h}" x2="${x0+w}" y2="${y0+h}" stroke="${gr}"/><line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y0+h}" stroke="${gr}"/>
    ${ticks.map(t => `<text x="${X(t)}" y="${y0+h+14}" text-anchor="middle" font-size="10" fill="#64748b">${t}</text>`).join('')}
    ${[0, smax/2, smax/1.15].map(s => `<text x="${x0-5}" y="${Y(s)+3}" text-anchor="end" font-size="10" fill="#64748b">${fx(s,2)}</text>`).join('')}
    <text x="${x0+w/2}" y="${H-3}" text-anchor="middle" font-size="10.5" fill="#475569">Periodo T [s]</text>
    <text x="12" y="${y0+h/2}" text-anchor="middle" font-size="10.5" fill="#475569" transform="rotate(-90 12 ${y0+h/2})">Sa [g]</text>
    ${marca(R.p.Tc, 'Tc')}${marca(R.p.TL, 'TL')}${R.p.To > 0.05 ? marca(R.p.To, 'To') : ''}
    <path d="${linea}" fill="none" stroke="${az}" stroke-width="2.5"/>
    ${pto(R.tx.T, R.tx.Sa, `Tx = ${fx(R.tx.T,3)} s`)}${Math.abs(R.ty.T - R.tx.T) > 1e-6 ? pto(R.ty.T, R.ty.Sa, `Ty = ${fx(R.ty.T,3)} s`, true) : ''}
    <text x="${x0+w-6}" y="${y0+h*0.3}" text-anchor="end" font-size="10.5" fill="${az}" font-weight="700">Sa = 2.5·Aa·Fa·I = ${fx(2.5*R.p.Aa*R.p.Fa*R.p.I,4)} g</text>
    </g></svg>`;
}

// ═══ Páginas imprimibles del Anexo B ═══
function anexoBPrintHTML(B, R){
  const m = S.m, f = m.ficha, c = S.cfg, L = 'B';
  const fecha = f.fecha ? new Date(f.fecha + 'T12:00').toLocaleDateString('es-CO', { month:'long', year:'numeric' }) : '';
  const kv = filas => `<table class="ax-kv">${filas.map(([a,b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>`;
  const tb = (cab, filas, tot) => `<table class="ax-tb"><tr>${cab.map(x => `<th>${x}</th>`).join('')}</tr>${filas.map(r => `<tr>${r.map((x,i) => `<td class="${i?'c':''}">${x}</td>`).join('')}</tr>`).join('')}${tot ? `<tr class="tot"><td colspan="${cab.length-1}" style="text-align:right">${tot[0]}</td><td class="c">${tot[1]}</td></tr>` : ''}</table>`;
  const box = t => `<div class="ax-box">${t}</div>`;
  const usoT = t => t.din ? (t.limitado ? 'Cu·Ta (periodo del análisis dinámico limitado)' : 'periodo del análisis dinámico') : 'Ta';
  return `<div class="ax"><section>
    <div class="ax-hd"><div class="ax-t">ANEXO ${L} - ANÁLISIS DE FUERZA HORIZONTAL EQUIVALENTE "FHE"</div><div class="ax-n">NSR-10. A.4 Método de la fuerza horizontal equivalente</div><div class="ax-n2">Cálculo de fuerzas sísmicas</div>
      <table class="ax-id"><tr><td><b>Proyecto:</b></td><td>${esc(f.proyecto||m.titulo||'')}</td><td><b>Ingeniero:</b></td><td>${esc((c.nombre_firma||'').replace(/^ING\.\s*/,''))}</td></tr>
      <tr><td><b>Proyecto No.:</b></td><td>${esc(m.consecutivo)}</td><td><b>Fecha:</b></td><td>${esc(fecha)}</td></tr></table></div>
    <h3>${L}-1 Espectro de diseño</h3>
    <h4>${L}-1.1 Parámetros sísmicos</h4>
    ${(() => { const mm = window.NSR_SISMO && B.munCode ? NSR_SISMO.mun.find(x => x.c === B.munCode) : null;
      return kv([['Ubicación',esc([f.mun,f.depto].filter(Boolean).join(', '))],
        ...(mm ? [['Municipio en el Apéndice A-4', `${esc(mm.n)} (${esc(mm.d||'')}) — código ${mm.c}, zona de amenaza ${esc(mm.z||'')}`]] : []),
        ...(B.metodo === 'coord' ? [['Coordenadas del proyecto', `${esc(B.lat)}, ${esc(B.lon)}`]] : []),
        ['Aa · Av (Apéndice A-4)',`${fx(R.p.Aa,2)} · ${fx(R.p.Av,2)}`]]); })()}
    ${window.NSR_SISMO && B.munCode ? `<div class="ax-mapas"><figure>${svgMapaSismo({ ...B, mapa:'aa' }, true)}<figcaption>Aa por municipio</figcaption></figure><figure>${svgMapaSismo({ ...B, mapa:'av' }, true)}<figcaption>Av por municipio</figcaption></figure></div>` : ''}
    ${kv([['Perfil de suelo',esc(AnexoB.SUELOS[B.suelo]||B.suelo)],
      ['Fa (Tabla A.2.4-3) · Fv (Tabla A.2.4-4)',`${fx(R.p.Fa,2)} · ${fx(R.p.Fv,2)}`],['Grupo de uso',esc(AnexoB.GRUPOS[B.grupo]||B.grupo)],['Coeficiente de importancia I (Tabla A.2.5-1)',fx(R.p.I,2)]])}
    <h4>${L}-1.2 Parámetros de la estructura</h4>
    ${kv([['Sistema estructural',esc(R.sis.nombre)],['Ct · α (Tabla A.4.2-1)',`${R.sis.Ct} · ${R.sis.a}`],['Altura h [m]',fx(R.h,2)],
      ['To = 0.1·Av·Fv/(Aa·Fa)',fx(R.p.To,3)+' s'],['Tc = 0.48·Av·Fv/(Aa·Fa)',fx(R.p.Tc,3)+' s'],['TL = 2.4·Fv',fx(R.p.TL,2)+' s'],
      ['Ta = Ct·h^α',fx(R.Ta,3)+' s'],['Cu = 1.75 − 1.2·Av·Fv ≥ 1.2',fx(R.Cu,3)],['Cu·Ta',fx(R.CuTa,3)+' s']])}
    <figure class="ax-fig">${svgEspectro(R, true)}<figcaption>Espectro elástico de aceleraciones de diseño (Figura A.2.6-1) con los periodos usados.</figcaption></figure>
  </section><section>
    <h3>${L}-2 Fuerza horizontal equivalente</h3>
    <h4>${L}-2.1 Peso sísmico W</h4>
    <p>Cargas por área (Anexo A):</p>
    ${tb(['Ítem','kg/m²','Área [m²]','Peso [kN]'], R.cargas.filter(x => x.on).map(x => [esc(x.n), fx(x.w,2), fx(x.area,2), fx(x.kN,2)]), ['Subtotal', fx(R.Wcargas,2)])}
    <p>Peso propio de la estructura${B.estructura.modo === 'sap' ? ` (obtenido del modelo en ${esc(enSw())}): <b>${fx(R.Wprop,2)} kN</b>.` : ':'}</p>
    ${B.estructura.modo === 'sap' ? (B.estructura._url ? `<figure class="ax-fig"><img src="${esc(B.estructura._url)}" style="max-width:100%;max-height:3.2in;border:1px solid #888" alt=""/><figcaption>Tabla del modelo estructural con el peso propio.</figcaption></figure>` : '')
      : tb(['Perfil','kg/m','Longitud [m]','Peso [kg]','Peso [kN]'], R.perfiles.map(p => [esc(p.perfil === 'otro' ? (p.nom || 'Otro') : p.perfil), fx(p.kgmU,2), fx(p.Lm,2), fx(p.kg,1), fx(p.kN,2)]), ['Subtotal', fx(R.Wprop,2)])}
    ${R.otras.length ? `<p>Otras cargas:</p>${tb(['Descripción','Cantidad','Peso unitario','Ubicación','Peso [kN]'], R.otras.map(o => [esc(o.n||''), `${fx(AnexoB.num(o.cant),2)} ${esc(o.unidad||'')}`, `${fx(AnexoB.num(o.pu),2)} kg/${esc(o.unidad||'und')}`, esc(o.ubic||''), fx(o.kN,2)]), ['Subtotal', fx(R.Wotras,2)])}` : ''}
    ${box(`W = ${fx(R.W,2)} kN (${fx(R.W*1000/AnexoB.G,0)} kg)`)}
    <h4>${L}-2.2 Cortante sísmico en la base (Ec. A.4.3-1: Vs = Sa·g·M = Sa·W)</h4>
    ${tb(['Dirección','T usado [s]','Criterio','Sa [g]','k','Vs [kN]'], [['X',fx(R.tx.T,3),usoT(R.tx),fx(R.tx.Sa,4),fx(R.tx.k,2),fx(R.tx.Vs,2)],['Y',fx(R.ty.T,3),usoT(R.ty),fx(R.ty.Sa,4),fx(R.ty.k,2),fx(R.ty.Vs,2)]])}
    <p>Estructura de un nivel: Cvx = 1, por lo que la fuerza sísmica en la cubierta es igual al cortante en la base.</p>
    <h4>${L}-2.3 Torsión accidental (A.3.6.7.1)</h4>
    ${tb(['Fuerza','Vs [kN]','Dimensión perpendicular [m]','Excentricidad','Momento torsor [kN·m]'], [['En X',fx(R.tx.Vs,2),fx(R.dimY,2),fx(R.e,2),fx(R.MtX,2)],['En Y',fx(R.ty.Vs,2),fx(R.dimX,2),fx(R.e,2),fx(R.MtY,2)]])}
    ${box(`FHE x = ${fx(R.tx.Vs,2)} kN · FHE y = ${fx(R.ty.Vs,2)} kN`)}
    ${R.modal.some(r => r.Tdin || r.Vt) ? `<h4>${L}-2.4 Comparación con el análisis dinámico modal</h4>
      ${tb(['Dirección','T modal [s]','Ta [s]','Cu·Ta [s]','Chequeo periodo','Vs FHE [kN]','Vt modal [kN]','Vt/Vs','Factor de ajuste'], R.modal.map(r => [r.dir, r.Tdin ? fx(r.Tdin,3) : '—', fx(r.Ta,3), fx(r.CuTa,3),
        r.okT == null ? '—' : r.okT ? 'T ≤ Cu·Ta, cumple' : 'Se limita a Cu·Ta', fx(r.Vs,2), r.Vt ? fx(r.Vt,2) : '—', r.Vt ? fx(r.rel*100,1)+' %' : '—', r.Vt ? (r.okV ? '1.00' : fx(r.factor,3)) : '—']))}
      <p>Según A.5.4.5, el cortante dinámico en la base no puede ser menor que el ${fx(R.pct*100,0)} % del cortante de la FHE (${B.irregular ? 'estructura irregular' : 'estructura regular'}). ${R.modal.every(r => !r.Vt || r.okV) ? 'Se cumple en las direcciones evaluadas.' : 'Donde no se cumple, los resultados del análisis modal se multiplican por el factor de ajuste indicado.'}</p>` : ''}
    ${(B.iter||[]).length ? `<h4>${L}-2.5 Historial de iteraciones</h4>
      <p>Resumen de las iteraciones realizadas con el modelo estructural. Los cálculos completos de este anexo corresponden a la iteración final.</p>
      ${iterTablaHTML(B, R, true)}` : ''}
  </section></div>`;
}

// ═══ Aa y Av por municipio (Apéndice A-4) o por coordenadas (límites municipales DANE) ═══
let _sismoP = null;
function cargarSismo(){
  if(window.NSR_SISMO) return Promise.resolve();
  return _sismoP = _sismoP || new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'data/sismo.js'; s.onload = res; s.onerror = () => { _sismoP = null; toast('No se pudo cargar la tabla del Apéndice A-4.'); rej(); }; document.head.appendChild(s); });
}
const normN = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
function prellenarMunicipio(B){
  if(B.munCode || !window.NSR_SISMO) return;
  const f = S.m.ficha, m = NSR_SISMO.mun.find(x => normN(x.n) === normN(f.mun) && (!f.depto || normN(x.d) === normN(f.depto)));
  if(m && B.metodo === 'tabla'){ B.depto = m.d; B.munCode = m.c; aplicarMunicipio(B); guardarMemoria(); }
  else if(!B.depto && f.depto){ const d = NSR_SISMO.mun.find(x => normN(x.d) === normN(f.depto)); if(d) B.depto = d.d; }
}
function aplicarMunicipio(B){
  const m = NSR_SISMO?.mun.find(x => x.c === B.munCode);
  if(!m) return;
  if(m.aa == null){ toast(`${m.n} no aparece en el Apéndice A-4: escribe Aa y Av a mano.`, 5000); return; }
  B.Aa = m.aa; B.Av = m.av; B.depto = m.d || B.depto;
}
function usarCoordFicha(B){
  const p = String(S.m.ficha.coord || '').match(/-?\d+(?:[.,]\d+)?/g);
  if(p && p.length >= 2){ B.lat = p[0].replace(',', '.'); B.lon = p[1].replace(',', '.'); }
}
// Punto dentro de polígono (rayo) sobre los límites municipales simplificados
function dentro(lon, lat, r){
  let ins = false;
  for(let i = 0, j = r.length - 2; i < r.length; j = i, i += 2){
    const xi = r[i], yi = r[i+1], xj = r[j], yj = r[j+1];
    if(((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) ins = !ins;
  }
  return ins;
}
function buscarPorCoord(B){
  const lat = AnexoB.num(B.lat, NaN), lon = AnexoB.num(B.lon, NaN);
  if(!isFinite(lat) || !isFinite(lon)) return toast('Escribe la latitud y la longitud en grados decimales.');
  if(lat < -5 || lat > 14 || lon < -82 || lon > -66) return toast('Esas coordenadas no están en Colombia. Revisa el signo de la longitud (oeste = negativo).', 5000);
  let mejor = null, area = Infinity;
  for(const m of NSR_SISMO.mun) for(const r of m.r){
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for(let i = 0; i < r.length; i += 2){ x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); y0 = Math.min(y0, r[i+1]); y1 = Math.max(y1, r[i+1]); }
    if(lon < x0 || lon > x1 || lat < y0 || lat > y1) continue;
    if(dentro(lon, lat, r)){ const a = (x1 - x0) * (y1 - y0); if(a < area){ area = a; mejor = m; } }
  }
  if(!mejor){ // fuera de todos los polígonos (borde o costa): el más cercano por su centro
    let d = Infinity; for(const m of NSR_SISMO.mun) if(m.lat != null){ const dd = (m.lat - lat) ** 2 + (m.lon - lon) ** 2; if(dd < d){ d = dd; mejor = m; } }
    toast(`El punto quedó en un borde; se tomó el municipio más cercano (${mejor.n}). Verifícalo.`, 5000);
  }
  B.munCode = mejor.c; aplicarMunicipio(B); guardarMemoria(); paneAnexoB();
}
function munInfoHTML(m, B){
  return `<div class="note ${m.aa == null ? 'amber' : 'blue'}" style="margin:0"><b>${esc(m.n)}${m.d ? ' (' + esc(m.d) + ')' : ''}</b> · código DANE ${m.c}<br/>
    ${m.aa == null ? 'No aparece en el Apéndice A-4: escribe Aa y Av a mano.' : `Aa = <b>${fx(m.aa,2)}</b> · Av = <b>${fx(m.av,2)}</b> · Zona de amenaza sísmica <b>${esc(m.z)}</b>`}
    ${B.metodo === 'coord' ? `<br/><span class="hint">Punto: ${esc(B.lat)}, ${esc(B.lon)} — municipio encontrado con los límites del DANE.</span>` : ''}</div>`;
}
// Mapa de Colombia coloreado por Aa o Av de cada municipio (equivalente a las figuras A.2.3-2 y A.2.3-3)
const COL_SIS = { 0.05:'#fff7d1', 0.10:'#fee391', 0.15:'#fec44f', 0.20:'#fe9929', 0.25:'#ec7014', 0.30:'#cc4c02', 0.35:'#a63603', 0.40:'#7f2704', 0.45:'#5c1d03', 0.50:'#3d1302' };
function svgMapaSismo(B, imp){
  const SM = window.NSR_SISMO; if(!SM) return '';
  const k = 27, X = lon => ((lon + 79.1) * k).toFixed(1), Y = lat => ((12.6 - lat) * k).toFixed(1);
  const campo = B.mapa === 'av' ? 'av' : 'aa', sel = B.munCode;
  let paths = '', selPath = '';
  for(const m of SM.mun){
    if(!m.r.length || m.lon < -79.6) continue;   // sin San Andrés (fuera del recuadro)
    const d = m.r.map(r => { let s = ''; for(let i = 0; i < r.length; i += 2) s += (i ? 'L' : 'M') + X(r[i]) + ',' + Y(r[i+1]); return s + 'Z'; }).join('');
    const v = m[campo], col = v == null ? '#e5e7eb' : (COL_SIS[Math.round(v * 20) / 20] || '#ccc');
    paths += `<path d="${d}" fill="${col}"/>`;
    if(m.c === sel) selPath = `<path d="${d}" fill="none" stroke="#1a56db" stroke-width="2.5"/>`;
  }
  const lat = AnexoB.num(B.lat, NaN), lon = AnexoB.num(B.lon, NaN);
  const pto = B.metodo === 'coord' && isFinite(lat) && isFinite(lon) ? `<circle cx="${X(lon)}" cy="${Y(lat)}" r="5" fill="#dc2626" stroke="#fff" stroke-width="1.5"/>` : '';
  const vals = Object.keys(COL_SIS).map(Number);
  const ley = vals.map((v, i) => `<rect x="${8 + i*30}" y="470" width="30" height="10" fill="${COL_SIS[v]}" stroke="#999" stroke-width=".3"/><text x="${23 + i*30}" y="491" text-anchor="middle" font-size="8.5" fill="#444">${v.toFixed(2)}</text>`).join('');
  return `<svg viewBox="0 0 335 500" class="mapa-sis" role="img" aria-label="Mapa de ${campo === 'aa' ? 'Aa' : 'Av'} por municipio">
    <g stroke="#fff" stroke-width=".25">${paths}</g>${selPath}${pto}
    <text x="8" y="462" font-size="10" font-weight="700" fill="#333" font-family="sans-serif">${campo === 'aa' ? 'Aa' : 'Av'} por municipio (Apéndice A-4)</text>
    <g font-family="sans-serif">${ley}</g></svg>`;
}
