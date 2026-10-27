/* ═══ Pantalla del Anexo B — FHE (usa calc/anexoB.js y los datos del Anexo A) ═══ */
'use strict';
const TXT_SIN_SISMO = 'El alcance del presente análisis no incluye la evaluación sísmica de la estructura. Por lo tanto, no se calcula la fuerza horizontal equivalente (FHE) y el diseño se realiza con las combinaciones de carga muerta, viva y de viento.';

function datosB(){
  const m = S.m; m.anexos = m.anexos || {};
  const B = m.anexos.B = m.anexos.B || {};
  const d = AnexoB.defaults(); for(const k in d) if(B[k] === undefined) B[k] = d[k];
  return B;
}
function calcB(){ const B = datosB(), A = datosA(); return AnexoB.calcular(B, A, AnexoA.calcular(A)); }

function paneAnexoB(){
  const B = datosB(), ro_ = esIng() ? '' : 'disabled';
  let h = `<div class="card"><div class="ct">Alcance del análisis</div>
    <div class="f"><label>¿El proyecto lleva análisis sísmico?</label>
      <div class="seg" role="group" aria-label="Lleva análisis sísmico"><button type="button" data-sis="1" class="${B.aplica?'on':''}" ${ro_}>Sí</button><button type="button" data-sis="0" class="${!B.aplica?'on':''}" ${ro_}>No</button></div></div>
    ${!B.aplica ? `<div class="note green" style="margin-top:12px"><b>Sin análisis sísmico.</b> El Anexo B no se incluye en la memoria y el paso queda completo. En su lugar va esta nota, que puedes ajustar:</div>
      <div class="f"><label for="txtSis">Nota de alcance (sale en la memoria)</label><textarea id="txtSis" rows="4" ${ro_}>${esc(B.texto || TXT_SIN_SISMO)}</textarea><div class="hint">Vacío = texto predeterminado.</div></div>` : ''}</div>`;
  if(B.aplica){
    const R = calcB();
    h += `<div class="card"><div class="ct">B-1.1 Parámetros sísmicos</div><div class="fg g4">
        ${fIn(B,'Aa','Aa',{h:'Apéndice A-4 según municipio'})}${fIn(B,'Av','Av')}
        ${fSel(B,'suelo','Perfil de suelo',Object.entries(AnexoB.SUELOS),{cls:'span2',h:'Del estudio de suelos (A.2.4)'})}
        ${fIn(B,'FaManual','Fa',{ph:fx(R.FaT,2)+' (tabla)',h:'Vacío = Tabla A.2.4-3'})}${fIn(B,'FvManual','Fv',{ph:fx(R.FvT,2)+' (tabla)',h:'Vacío = Tabla A.2.4-4'})}
        ${fSel(B,'grupo','Grupo de uso',Object.entries(AnexoB.GRUPOS),{cls:'span2',h:'Coeficiente de importancia I (Tabla A.2.5-1)'})}</div></div>
      <div class="card"><div class="ct">B-1.2 Parámetros de la estructura</div><div class="fg g4">
        ${fSel(B,'sistema','Sistema estructural',AnexoB.SISTEMAS.map((s,i) => [i,`${s.nombre} (Ct ${s.Ct}, α ${s.a})`]),{cls:'span2',h:'Tabla A.4.2-1'})}
        ${fIn(B,'h','Altura h [m]',{ph:R.hA ? fx(R.hA,2)+' (Hr del Anexo A)' : 'Escribe la altura',h:'Vacío = cumbrera Hr del Anexo A'})}
        <div></div>${fIn(B,'Tx','Periodo Tx de SAP2000 [s]',{ph:'opcional'})}${fIn(B,'Ty','Periodo Ty de SAP2000 [s]',{ph:'opcional'})}
        <div class="hint span2" style="align-self:center">Si los escribes, se usan con el límite Cu·Ta (A.4.2.1). Si no, se usa Ta.</div></div></div>
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
        <div class="seg" role="group" aria-label="Cómo se ingresa el peso propio" style="margin-bottom:8px"><button type="button" data-modo="lista" class="${B.estructura.modo!=='sap'?'on':''}" ${ro_}>Lista de perfiles</button><button type="button" data-modo="sap" class="${B.estructura.modo==='sap'?'on':''}" ${ro_}>Total de SAP2000</button></div>
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
      <div class="card"><div class="ct">Páginas del Anexo B</div>
        <p class="lead" style="margin-bottom:10px">Imprime o guarda en PDF las páginas del Anexo B con el formato de la memoria (carta).</p>
        <button class="btn grn" type="button" id="printB">🖨 Imprimir / Guardar PDF del Anexo B</button></div>`;
  }
  pane(h);
  if(!esIng()) { if(B.aplica) pintarResB(); return; }
  $$('[data-sis]').forEach(b => b.onclick = () => { B.aplica = b.dataset.sis === '1'; guardarMemoria(); renderWS('B'); });
  const t = $('#txtSis'); if(t) t.oninput = () => { B.texto = t.value.trim() === TXT_SIN_SISMO ? '' : t.value; guardarMemoria(); };
  $$('#pane [data-a]').forEach(inp => inp.addEventListener(inp.type === 'checkbox' || inp.tagName === 'SELECT' ? 'change' : 'input', () => {
    const path = inp.dataset.a;
    if(path.startsWith('items.')){ const [, k] = path.split('.'); B.items[k] = B.items[k] || {}; }
    setP(B, path, inp.type === 'checkbox' ? inp.checked : inp.value); guardarMemoria();
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
  if($('#printB')) $('#printB').onclick = async () => {
    const R = calcB(); if(!R.ok) return toast('Faltan datos: ' + R.faltan.join(', '));
    B.estructura._url = B.estructura.modo === 'sap' && B.estructura.sapImg ? await urlDe(B.estructura.sapImg) : null;
    const pa = $('#print-area'); pa.innerHTML = anexoBPrintHTML(B, R); delete B.estructura._url;
    await Promise.all([...pa.querySelectorAll('img')].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
    await document.fonts.ready; imprimirConMargen(`${S.m.consecutivo}_ANEXO_B`);
  };
  if(B.aplica) pintarResB();
}

function pintarResB(){
  const R = calcB();
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
  set('w1', fx(R.Wcargas,2)); set('w2', fx(R.Wprop,2)); set('w3', fx(R.Wotras,2)); set('wtot', `${fx(R.W,2)} kN (${fx(R.W*1000/AnexoB.G,0)} kg)`);
  if($('#resA')) $('#resA').innerHTML = !R.ok ? `<div class="note amber">Faltan: ${R.faltan.join(', ')}.</div>` :
    tabla(['Dirección','T usado [s]','Sa [g]','k','Vs [kN]','Momento torsor [kN·m]'], [
      ['X', fx(R.tx.T,3) + (R.tx.din ? (R.tx.limitado ? ' (Cu·Ta)' : ' (SAP)') : ' (Ta)'), fx(R.tx.Sa,4), fx(R.tx.k,2), `<b>${fx(R.tx.Vs,2)}</b>`, `${fx(R.MtX,2)} <span class="hint">= Vs × ${R.e} × ${fx(R.dimY,2)} m</span>`],
      ['Y', fx(R.ty.T,3) + (R.ty.din ? (R.ty.limitado ? ' (Cu·Ta)' : ' (SAP)') : ' (Ta)'), fx(R.ty.Sa,4), fx(R.ty.k,2), `<b>${fx(R.ty.Vs,2)}</b>`, `${fx(R.MtY,2)} <span class="hint">= Vs × ${R.e} × ${fx(R.dimX,2)} m</span>`]]) +
    `<div class="hint" style="margin-top:6px">Vs = Sa · W (Ec. A.4.3-1). W = ${fx(R.W,2)} kN. Estructura de un nivel: toda la fuerza va a la cubierta (Cvx = 1). La FHE se aplica en SAP2000 en cada dirección con su momento torsor.</div>`;
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
  const usoT = t => t.din ? (t.limitado ? 'Cu·Ta (periodo de SAP2000 limitado)' : 'periodo de SAP2000') : 'Ta';
  return `<div class="ax"><section>
    <div class="ax-hd"><div class="ax-t">ANEXO ${L} - ANÁLISIS DE FUERZA HORIZONTAL EQUIVALENTE "FHE"</div><div class="ax-n">NSR-10. A.4 Método de la fuerza horizontal equivalente</div><div class="ax-n2">Cálculo de fuerzas sísmicas</div>
      <table class="ax-id"><tr><td><b>Proyecto:</b></td><td>${esc(f.proyecto||m.titulo||'')}</td><td><b>Ingeniero:</b></td><td>${esc((c.nombre_firma||'').replace(/^ING\.\s*/,''))}</td></tr>
      <tr><td><b>Proyecto No.:</b></td><td>${esc(m.consecutivo)}</td><td><b>Fecha:</b></td><td>${esc(fecha)}</td></tr></table></div>
    <h3>${L}-1 Espectro de diseño</h3>
    <h4>${L}-1.1 Parámetros sísmicos</h4>
    ${kv([['Ubicación',esc([f.mun,f.depto].filter(Boolean).join(', '))],['Aa · Av (Apéndice A-4)',`${fx(R.p.Aa,2)} · ${fx(R.p.Av,2)}`],['Perfil de suelo',esc(AnexoB.SUELOS[B.suelo]||B.suelo)],
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
    <p>Peso propio de la estructura${B.estructura.modo === 'sap' ? ` (${esc(B.estructura.sapFuente||'SAP2000')}): <b>${fx(R.Wprop,2)} kN</b>.` : ':'}</p>
    ${B.estructura.modo === 'sap' ? (B.estructura._url ? `<figure class="ax-fig"><img src="${esc(B.estructura._url)}" style="max-width:100%;max-height:3.2in;border:1px solid #888" alt=""/><figcaption>Tabla de SAP2000 con el peso propio.</figcaption></figure>` : '')
      : tb(['Perfil','kg/m','Longitud [m]','Peso [kg]','Peso [kN]'], R.perfiles.map(p => [esc(p.perfil === 'otro' ? (p.nom || 'Otro') : p.perfil), fx(p.kgmU,2), fx(p.Lm,2), fx(p.kg,1), fx(p.kN,2)]), ['Subtotal', fx(R.Wprop,2)])}
    ${R.otras.length ? `<p>Otras cargas:</p>${tb(['Descripción','Cantidad','Peso unitario','Ubicación','Peso [kN]'], R.otras.map(o => [esc(o.n||''), `${fx(AnexoB.num(o.cant),2)} ${esc(o.unidad||'')}`, `${fx(AnexoB.num(o.pu),2)} kg/${esc(o.unidad||'und')}`, esc(o.ubic||''), fx(o.kN,2)]), ['Subtotal', fx(R.Wotras,2)])}` : ''}
    ${box(`W = ${fx(R.W,2)} kN (${fx(R.W*1000/AnexoB.G,0)} kg)`)}
    <h4>${L}-2.2 Cortante sísmico en la base (Ec. A.4.3-1: Vs = Sa·g·M = Sa·W)</h4>
    ${tb(['Dirección','T usado [s]','Criterio','Sa [g]','k','Vs [kN]'], [['X',fx(R.tx.T,3),usoT(R.tx),fx(R.tx.Sa,4),fx(R.tx.k,2),fx(R.tx.Vs,2)],['Y',fx(R.ty.T,3),usoT(R.ty),fx(R.ty.Sa,4),fx(R.ty.k,2),fx(R.ty.Vs,2)]])}
    <p>Estructura de un nivel: Cvx = 1, por lo que la fuerza sísmica en la cubierta es igual al cortante en la base.</p>
    <h4>${L}-2.3 Torsión accidental (A.3.6.7.1)</h4>
    ${tb(['Fuerza','Vs [kN]','Dimensión perpendicular [m]','Excentricidad','Momento torsor [kN·m]'], [['En X',fx(R.tx.Vs,2),fx(R.dimY,2),fx(R.e,2),fx(R.MtX,2)],['En Y',fx(R.ty.Vs,2),fx(R.dimX,2),fx(R.e,2),fx(R.MtY,2)]])}
    ${box(`FHE x = ${fx(R.tx.Vs,2)} kN · FHE y = ${fx(R.ty.Vs,2)} kN`)}
  </section></div>`;
}
