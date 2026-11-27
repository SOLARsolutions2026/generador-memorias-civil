/* ═══ Pantalla: Combinaciones de carga e irregularidades (usa calc/combos.js) ═══ */
'use strict';
function datosK(){
  const m = S.m; m.anexos = m.anexos || {};
  const K = m.anexos.K = m.anexos.K || {};
  const d = Combos.defaults(); for(const k in d) if(K[k] === undefined) K[k] = d[k];
  for(const k in d.pat) if(K.pat[k] === undefined) K.pat[k] = d.pat[k];
  return K;
}
const sismoK = () => S.m.anexos?.B?.aplica !== false;
function calcK(){ const K = datosK(); return Combos.calcular(K, sismoK()); }
// La casilla «estructura irregular» del Anexo B sale de aquí
function sincronizarIrregular(){
  const K = S.m.anexos?.K, B = S.m.anexos?.B; if(!K || !B) return;
  B.irregular = Combos.coefR(K).irregular;
}

let irrAbierta = null;   // fila de irregularidad abierta (solo una)
function paneCombos(){
  const K = datosK(), sis = sismoK(), ro_ = esIng() ? '' : 'disabled', M = S.m.anexos?.C?.modelo;
  if(K.patAuto && M?.ok){ const p = Combos.patronesDeModelo(M, AnexoC.categoria); if(p){ for(const k in p) if(p[k]) K.pat[k] = p[k]; K.patAuto = false; guardarMemoria(); } }
  const seg = (attr, val, si) => `<div class="seg sm" role="group"><button type="button" ${attr}="1" class="${val ? 'on' : ''}" ${ro_}>${si || 'Sí'}</button><button type="button" ${attr}="0" class="${!val ? 'on' : ''}" ${ro_}>No</button></div>`;
  const torAuto = !!K.tor?.res?.ok;
  // Revisión numérica de las demás irregularidades (24-nov): con datos completos fija el Sí/No
  K.irrD = K.irrD || {};
  const IR = Combos.irregularidades(K), autoK = new Set(); let cambio = false;
  for(const g in IR) for(const [k, v] of Object.entries(IR[g].claves)){ const lado = Combos.IRR_P.some(i => i.k === k) ? 'irrP' : 'irrA'; autoK.add(k); if(!!K[lado][k] !== v){ K[lado][k] = v; cambio = true; } }
  if(cambio){ sincronizarIrregular(); guardarMemoria(); }
  const R = Combos.coefR(K);
  const nota = (k, v) => `<label>Nota para la memoria</label><input class="nota-irr" data-nirr="${k}" value="${esc(K.notasIrr[k] || '')}" placeholder="${v ? 'Por qué aplica' : 'Justificación (opcional)'}" ${ro_}/>`;
  const redDet = `<div class="red-box"><div class="f"><label for="redCalc">Cálculo / justificación (sale en la memoria)</label><textarea id="redCalc" rows="4" placeholder="Escribe el cálculo de la redundancia…" ${ro_}>${esc(K.redCalc || '')}</textarea><div class="hint">Sí (no tiene redundancia) → φr = 0.75 · No (sí tiene) → φr = 1.00</div></div>
        <div>${K.redImg ? `<div class="drop-img has" id="redImgV" style="max-width:none"><span class="muted">Cargando…</span></div>
            ${esIng() ? '<div style="display:flex;gap:6px;margin-top:6px"><button class="btn sm" type="button" id="redImgC">🔄 Cambiar</button><button class="btn sm danger" type="button" id="redImgQ">Quitar</button></div>' : ''}`
          : esIng() ? '<button class="drop-img" type="button" id="redImgC" style="max-width:none;min-height:110px;width:100%"><div class="ph-in"><div style="font-size:20px">📷</div><b>Foto del cálculo</b><br/>toca o arrastra aquí</div></button>' : ''}
          ${K.redImg ? `<input id="redNota" value="${esc(K.redNota || '')}" placeholder="Pie de la foto" style="margin-top:6px;width:100%" ${ro_}/>` : ''}</div></div>`;
  // Fila de la lista: ▸ tipo · nombre · φ · Sí/No; al tocarla se abren sus datos debajo (una a la vez)
  const fila = (k, nombre, phi, ctrl, det, marca) => { const ab = irrAbierta === k;
    return `<div class="irr-row ${ab ? 'ab' : ''}" data-abre="${k}"><span class="chev">${ab ? '▾' : '▸'}</span><b class="ik">${esc(k === 'red' ? 'φr' : k)}</b><span class="in">${esc(nombre)}${marca || ''}</span><span class="iphi">${phi}</span>${ctrl}</div>
      ${ab ? `<div class="irr-det">${det}</div>` : ''}`; };
  const filaIrr = (i, lado) => { const v = !!K[lado][i.k], auto = (torAuto && (i.k === '1aP' || i.k === '1bP')) || autoK.has(i.k);
    const ctrl = auto ? `<span class="pill ${v ? 'no' : 'ok'}">${v ? 'Sí aplica' : 'No aplica'} · según cálculo</span>` : seg(`data-irr="${lado}.${i.k}" data-v`, v);
    const g = Combos.GRUPO_IRR[i.k], fig = `<figure class="irr-fig"><a href="img/irr-${g}.jpg" target="_blank" rel="noopener" title="Ver en grande"><img src="img/irr-${g}.jpg" alt="Figura ${lado === 'irrP' ? 'A.3-1' : 'A.3-2'} · ${esc(i.k)}" loading="lazy"/></a><figcaption>Toque para ver en grande · NSR-10 Figura ${lado === 'irrP' ? 'A.3-1 — Irregularidades en planta' : 'A.3-2 — Irregularidades en altura'}</figcaption></figure>`;
    const det = (i.k === '1aP' || i.k === '1bP')
      ? `<div class="irr-grid tor">${fig}<div>${torsionHTML(K, M, ro_, 'datos')}</div></div>${torsionHTML(K, M, ro_, 'res', i.k)}<div style="margin-top:10px">${nota(i.k, v)}</div>`
      : `<div class="irr-grid">${fig}<div>${irrDatosHTML(K, g, IR[g], ro_)}<div style="margin-top:10px">${nota(i.k, v)}</div></div></div>`;
    return fila(i.k, i.n, 'φ ' + fx(i.phi,1), ctrl, det, K.notasIrr[i.k] ? ' <span class="hint">· con nota</span>' : ''); };
  let h = '';
  // 1. Irregularidades
  h += `<div class="card"><div class="ct">Irregularidades y coeficiente de capacidad de disipación R (NSR-10 A.3.3)</div>`;
  if(!sis) h += `<div class="note green"><b>Sin análisis sísmico.</b> No se evalúan irregularidades ni se generan combinaciones con sismo.</div></div>`;
  else {
    // Escoger el sistema (opción A de Amo, 27-nov): lista agrupada con nombres cortos y pastillas con los datos
    const GRP_S = [['mom', 'Pórticos de acero resistentes a momento · Tabla A.3-3'], ['comb', 'Sistema combinado con diagonales concéntricas · Tabla A.3-2'], ['otro', 'Otro']];
    const selSis = (campo, val) => `<div class="f"><select class="sis-sel" data-a="${campo}" data-re="1" ${ro_}>${GRP_S.map(([g, t]) => `<optgroup label="${esc(t)}">${Combos.R0S.filter(x => x.g === g).map(x => `<option value="${x.k}" ${x.k === val ? 'selected' : ''}>${esc(x.c + (x.R0 ? ` · R0 ${fx(x.R0,1)}` : ''))}</option>`).join('')}</optgroup>`).join('')}</select></div>`;
    const pills = (sx, R0, om, Rv, nR) => `<div class="sis-pills">${sx.tab ? `<span>Tabla <b>${sx.tab}</b></span>` : ''}<span>R0 <b>${fx(R0,1)}</b></span><span>Ω0 <b>${fx(om,1)}</b></span>${sx.niv ? `<span>Disipación <b>${sx.niv.toUpperCase()}</b></span>` : ''}<span>${nR} <b>${fx(Rv,2)}</b></span></div>`;
    const caja = (tit, campo, val, sx, R0, om, Rv, nR, otro) => `<div class="sis-box"><h5>${tit}</h5>${selSis(campo, val)}
      ${val === 'otro' ? `<div class="fg g2" style="margin-top:8px">${fIn(K, otro[0], 'R0', { ph:'escribe R0' })}${fIn(K, otro[1], 'Ω0', { ph:'escribe Ω0' })}</div>` : ''}${pills(sx, R0, om, Rv, nR)}</div>`;
    h += `<label class="chk" style="margin-bottom:8px"><input type="checkbox" data-a="dosSis" data-re="1" ${K.dosSis ? 'checked' : ''} ${ro_}/> Un sistema distinto en cada sentido (NSR-10 A.3.2)</label>
      <div class="sis-grid ${K.dosSis ? 'dos' : ''}">${caja(K.dosSis ? 'Sentido X' : 'Sistema estructural', 'sisR', K.sisR, R.sis, R.R0, R.Om0x, R.Rx, K.dosSis ? 'Rx' : 'R', ['R0', 'Om0'])}
        ${K.dosSis ? caja('Sentido Y', 'sisY', K.sisY, R.sisY, R.R0y, R.Om0y, R.Ry, 'Ry', ['R0y', 'Om0y']) : ''}</div>
      ${K.dosSis ? '<div class="hint" style="margin-top:6px">Cada sentido se diseña con el R de su sistema. Los elementos comunes a los dos sistemas (columnas) cumplen el requisito de disipación más exigente.</div>' : ''}
      <div class="hint" style="margin:8px 0 2px">Toca una fila (▸) para abrir su figura y sus datos. Con los datos completos la revisión fija el Sí/No; 4P y 5P se deciden mirando la figura.</div>
      <h4 class="sub">En planta (Tabla A.3-6) → φp</h4>${Combos.IRR_P.map(i => filaIrr(i, 'irrP')).join('')}
      <h4 class="sub">En altura (Tabla A.3-7) → φa</h4>${Combos.IRR_A.map(i => filaIrr(i, 'irrA')).join('')}
      <h4 class="sub">Redundancia (A.3.3.8) → φr</h4>${fila('red', '¿Ausencia de redundancia?', 'φ ' + fx(R.phiR,2), seg('data-red', K.redundante === false), redDet,
        K.redCalc || K.redImg ? ' <span class="hint">· con cálculo</span>' : '')}
      ${R.dos ? `<div class="wtot"><span>Rx = φa · φp · φr · R0x = ${fx(R.phiA,2)} × ${fx(R.phiP,2)} × ${fx(R.phiR,2)} × ${fx(R.R0,1)}</span><span>Rx = ${fx(R.Rx,2)}</span></div>
      <div class="wtot" style="margin-top:6px"><span>Ry = φa · φp · φr · R0y = ${fx(R.phiA,2)} × ${fx(R.phiP,2)} × ${fx(R.phiR,2)} × ${fx(R.R0y,1)}</span><span>Ry = ${fx(R.Ry,2)}</span></div>`
      : `<div class="wtot"><span>R = φa · φp · φr · R0 = ${fx(R.phiA,2)} × ${fx(R.phiP,2)} × ${fx(R.phiR,2)} × ${fx(R.R0,1)}</span><span>R = ${fx(R.R,2)}</span></div>`}
      <div class="hint" style="margin-top:6px">Estructura <b>${R.irregular ? 'irregular' : 'regular'}</b>: en la comparación modal del Anexo B se exige el ${R.irregular ? '90' : '80'} % de Vs (se actualiza solo). Las fuerzas sísmicas de diseño se dividen por ${R.dos ? 'el R de su sentido (Ex/Rx, Ey/Ry)' : 'R (E = Fs/R)'}.</div></div>`;
  }
  // 2. Resumen de cargas y patrones
  const A = datosA(), RA = AnexoA.calcular(A), RB = sis && S.m.anexos?.B ? calcB() : null;
  const el = RA.paneles ? { n:'riel de paneles', D:RA.paneles.Dr, L:RA.paneles.Lr3, w:RA.viento.ok ? RA.viento.porElem.find(e => e.id === 'riel') : null } : null;
  const co = RA.lamina ? { n:'correa', D:RA.lamina.Dr, L:RA.lamina.Lr3, w:RA.viento.ok ? RA.viento.porElem.find(e => e.id === 'correa') : null } : null;
  const vals = x => [el, co].filter(Boolean).map(e => x(e)).filter(Boolean).join('<br/>') || '—';
  const val = {
    D: vals(e => `${fx(e.D,3)} kN/m (${e.n})`), Lr: vals(e => `${fx(e.L,3)} kN/m (${e.n})`),
    W: vals(e => e.w ? `+${fx(e.w.Wp,3)} / −${fx(e.w.Ws,3)} kN/m (${e.n})` : ''),
    Ex: RB?.ok ? `Vs = ${fx(RB.tx.Vs,2)} kN` : '—', Ey: RB?.ok ? `Vs = ${fx(RB.ty.Vs,2)} kN` : '—',
    Tx: RB?.ok ? `Mt = ${fx(RB.MtX,2)} kN·m` : '—', Ty: RB?.ok ? `Mt = ${fx(RB.MtY,2)} kN·m` : '—', IMPx:'según criterio del diseñador', IMPy:'según criterio del diseñador' };
  const fuente = { D:'Anexo A', Lr:'Anexo A', W:'Anexo A', Ex:'Anexo B', Ey:'Anexo B', Tx:'Anexo B', Ty:'Anexo B', IMPx:'—', IMPy:'—' };
  const usados = Object.keys(Combos.SIMB).filter(k => sis || !['Ex','Ey','Tx','Ty'].includes(k)).filter(k => K.impacto || !k.startsWith('IMP'));
  h += `<div class="card"><div class="ct">Resumen de cargas y patrones del modelo</div>
    ${tabla(['Símbolo','Carga','Valor','Viene de','Patrón(es) en el modelo'], usados.map(k => [`<b>${k}</b>`, Combos.SIMB[k], val[k], fuente[k],
      `<input data-a="pat.${k}" value="${esc(K.pat[k] || '')}" placeholder="nombre en el modelo" ${ro_} style="min-width:150px"/>`]))}
    <div class="hint" style="margin-top:6px">Si un símbolo usa varios patrones, sepáralos con coma (p. ej. «DEAD, DEAD SI»). La viva de cubierta se trata como Lr.</div>
    ${M?.ok && esIng() ? '<button class="btn sm" type="button" id="patModelo" style="margin-top:8px">↺ Tomar los nombres del modelo del Anexo C</button>' : ''}</div>`;
  // 3. Combinaciones
  const RK = calcK();
  h += `<div class="card"><div class="ct">Combinaciones de carga <span class="pill gray">${RK.activas.length} activas de ${RK.lista.length}</span></div>
    <div class="opc-k">
      ${sis ? `<label class="chk"><input type="checkbox" data-a="orto" data-re="1" ${K.orto ? 'checked' : ''} ${ro_}/> 30 % en la dirección ortogonal (A.3.6.3)</label>
      ${K.metodoE === 'lineal' ? `<label class="chk"><input type="checkbox" data-a="derivas" data-re="1" ${K.derivas ? 'checked' : ''} ${ro_}/> Combinaciones para derivas (A.6, sin dividir por R)</label>` : ''}` : ''}
      <label class="chk"><input type="checkbox" data-a="servicio" data-re="1" ${K.servicio ? 'checked' : ''} ${ro_}/> Servicio (B.2.3)</label>
      ${sis && K.servicio ? `<label class="chk"><input type="checkbox" data-a="servicioSismo" data-re="1" ${K.servicioSismo ? 'checked' : ''} ${ro_}/> Servicio con sismo (0.7E)</label>` : ''}
      <label class="chk"><input type="checkbox" data-a="impacto" data-re="1" ${K.impacto ? 'checked' : ''} ${ro_}/> Impacto de vehículos (1.2D + 1.0IMP + 1.0L)</label></div>
    ${sis ? `<div class="fg g4" style="margin-top:10px;align-items:end"><div class="f span2"><label>Método para el sismo</label><div class="seg" role="group"><button type="button" data-met="env" class="${K.metodoE !== 'lineal' ? 'on' : ''}" ${ro_}>Envolventes (100 % X / 100 % Y)</button><button type="button" data-met="lineal" class="${K.metodoE === 'lineal' ? 'on' : ''}" ${ro_}>Combinación por combinación</button></div></div>
      ${K.metodoE !== 'lineal' ? fIn(K,'nomEX','Nombre envolvente X',{num:false,ph:'100% X 30% Y'}) + fIn(K,'nomEY','Nombre envolvente Y',{num:false,ph:'30% X 100% Y'}) : ''}</div>
      <div class="hint">${K.metodoE !== 'lineal' ? `Componentes sin reducir (SX, SY) → envolvente por dirección (sirve para derivas y torsión) → 1.2D y 0.9D + envolvente × 1/${R.dos ? 'R de su sentido' : 'R'}.` : `Cada combinación con ±Ex ±Tx ±0.3Ey ±0.3Ty dividida por ${R.dos ? 'el R de su sentido (Ex, Tx / Rx; Ey, Ty / Ry)' : 'R'}.`}</div>` : ''}
    ${sis && R.dif && K.metodoE !== 'lineal' ? (() => { const P = R.Rx > R.Ry ? 'X' : 'Y', Q = P === 'X' ? 'Y' : 'X', Rp = Math.max(R.Rx, R.Ry), Rq = Math.min(R.Rx, R.Ry);
      return `<label class="chk" style="margin-top:10px"><input type="checkbox" data-a="ortoR" data-re="1" ${K.ortoR ? 'checked' : ''} ${ro_}/> Ajustar el 30 % ortogonal de las componentes a cada R (0.3 × ${fx(R.Rx,2)}/${fx(R.Ry,2)} = ${fx(0.3 * R.Rx / R.Ry,3)} en las de X · 0.3 × ${fx(R.Ry,2)}/${fx(R.Rx,2)} = ${fx(0.3 * R.Ry / R.Rx,3)} en las de Y)</label>
      ${K.ortoR ? `<div class="hint">Así, al multiplicar cada envolvente por 1/R de su sentido, cada parte queda dividida por su propio R.</div>`
        : `<div class="note amber" style="margin-top:8px">Las componentes van con 1.0 y 0.3, y cada envolvente se multiplica por 1/R de su sentido (U7X: 1/${fx(R.Rx,2)} · U7Y: 1/${fx(R.Ry,2)}). En U7${P}/U8${P} el 30 % de ${Q} queda dividido por R${P.toLowerCase()} = ${fx(Rp,2)} en vez de R${Q.toLowerCase()} = ${fx(Rq,2)}: esa parte queda ${fx((1 - Rq / Rp) * 100,0)} % por debajo de lo que pide la norma. Marque la casilla de arriba para corregirlo.</div>`}`; })() : ''}
    ${RK.faltaPat.length ? `<div class="note amber" style="margin-top:10px">Falta el nombre del patrón en el modelo para: <b>${RK.faltaPat.join(', ')}</b>.</div>` : ''}
    ${['Resistencia','Sismo: componentes','Sismo: envolventes','Servicio','Derivas','Impacto','Otras'].map(g => { const l = RK.lista.filter(c => c.grupo === g); if(!l.length) return '';
      return `<h4 class="sub">${g}${g === 'Resistencia' ? ' (B.2.4.2)' : g === 'Servicio' ? ' (B.2.3.1)' : ''}</h4>${tabla(['','Nombre','Combinación','Ref.','Factores en el modelo'], l.map(c => [
        `<input type="checkbox" data-con="${esc(c.id)}" ${c.on ? 'checked' : ''} ${ro_} aria-label="Usar ${esc(c.id)}"/>`, `<b>${esc(c.id)}</b>`, esc(c.txt) + (c.nota ? ` <span class="hint">(${esc(c.nota)})</span>` : ''), esc(c.ref),
        `<span class="ids">${Object.entries(c.sap).map(([p, f]) => esc(p) + ' ' + f).join(' · ')}</span>`]), 'comb-tb')}`; }).join('')}
    <h4 class="sub">Otras combinaciones (escritas a mano)</h4>
    ${(K.otras || []).map((o, i) => `<div class="xrow" style="grid-template-columns:minmax(0,.6fr) minmax(0,2fr) auto"><div class="f"><input data-a="otras.${i}.nom" value="${esc(o.nom || '')}" placeholder="Nombre" ${ro_}/></div>
      <div class="f"><input data-a="otras.${i}.txt" value="${esc(o.txt || '')}" placeholder="Ej.: 1.2D + 1.0IMPx + 0.5Lr" ${ro_}/></div>${esIng() ? `<button class="btn sm danger" type="button" data-delk="${i}" aria-label="Quitar">✕</button>` : ''}</div>`).join('')}
    ${esIng() ? '<button class="btn sm" type="button" id="addK" style="margin-top:6px">＋ Agregar combinación</button>' : ''}
    <div class="hint" style="margin-top:4px">Símbolos: ${Object.keys(Combos.SIMB).join(', ')}.</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn grn" type="button" id="copiaK">📋 Copiar tabla para el software / Excel</button><button class="btn" type="button" id="bajaK">⬇ Descargar (.txt)</button></div>
    <div class="hint" style="margin-top:6px">La tabla trae una fila por caso: ComboName, ComboType, CaseType, CaseName, ScaleSF (las componentes van antes de las envolventes que las usan). Al subir el modelo en el Anexo C, la app revisa que estas combinaciones estén con los mismos factores.</div></div>`;
  h += `<div class="note blue">Estas tablas se explicarán en la <b>memoria general</b> (pendiente de construir); aquí se trabajan y se revisan.</div>`;
  pane(h);
  if(K.redImg) urlDe(K.redImg).then(u => { const b = $('#redImgV'); if(b) b.innerHTML = u ? `<img src="${esc(u)}" alt="Cálculo de la redundancia" style="max-width:100%;max-height:300px"/>` : '<span class="muted">No se encontró la foto.</span>'; });
  if(!esIng()) return;
  const re = () => { sincronizarIrregular(); guardarMemoria(); paneCombos(); };
  $$('[data-irr]').forEach(b => b.onclick = () => { const [lado, k] = b.dataset.irr.split('.'); K[lado][k] = b.dataset.v === '1'; re(); });
  $$('[data-met]').forEach(b => b.onclick = () => { K.metodoE = b.dataset.met; guardarMemoria(); paneCombos(); });
  $$('[data-red]').forEach(b => b.onclick = () => { K.redundante = b.dataset.red !== '1'; /* pregunta «¿ausencia de redundancia?»: Sí → φr 0.75, No → φr 1.00 */ re(); });
  if($('#redCalc')) $('#redCalc').oninput = e => { K.redCalc = e.target.value; guardarMemoria(); };
  if($('#redNota')) $('#redNota').oninput = e => { K.redNota = e.target.value; guardarMemoria(); };
  const subeRed = async f => { if(!f?.type.startsWith('image/')) return toast('Ese archivo no es una imagen.');
    try{ toast('Subiendo foto…', 15000); const blob = await comprimir(f, { max:1800, type:'image/jpeg', q:0.85 }), path = `${S.m.id}/redundancia.jpg`;
      await subir(path, blob, 'image/jpeg'); K.redImg = path; guardarMemoria(); toast('Foto guardada.'); paneCombos(); }catch(e){ err(e, 'No se pudo subir la foto'); } };
  const zr = $('#redImgC'); if(zr){ zr.onclick = async () => { const f = await elegirArchivo('image/*'); if(f) subeRed(f); };
    zr.ondragover = e => { e.preventDefault(); zr.classList.add('over'); }; zr.ondragleave = () => zr.classList.remove('over');
    zr.ondrop = e => { e.preventDefault(); zr.classList.remove('over'); subeRed(e.dataTransfer.files[0]); }; }
  if($('#redImgQ')) $('#redImgQ').onclick = async () => { await sb.storage.from(BUCKET).remove([K.redImg]); K.redImg = ''; guardarMemoria(); paneCombos(); };
  activarTorsion(K, M);
  $$('[data-abre]').forEach(r => r.onclick = e => { if(e.target.closest('.seg, button, input')) return; irrAbierta = irrAbierta === r.dataset.abre ? null : r.dataset.abre; paneCombos(); });
  $$('[data-nirr]').forEach(i => i.oninput = () => { K.notasIrr[i.dataset.nirr] = i.value; guardarMemoria(); });
  // Datos de las irregularidades (24-nov)
  $$('[data-ird]').forEach(i => { const [g, c] = i.dataset.ird.split('.'); const set = () => { K.irrD[g] = K.irrD[g] || {}; K.irrD[g][c] = i.value; guardarMemoria(); };
    i.oninput = set; i.onchange = () => { set(); paneCombos(); }; });
  $$('[data-pis]').forEach(i => { const [n, c] = i.dataset.pis.split('.'); const set = () => { K.irrD.pisos[+n][c] = i.value; guardarMemoria(); };
    i.oninput = set; i.onchange = () => { set(); paneCombos(); }; });
  if($('#pisoAdd')) $('#pisoAdd').onclick = () => { const L = K.irrD.pisos = K.irrD.pisos || []; L.push({ n:`Piso ${L.length + 1}` }); guardarMemoria(); paneCombos(); };
  $$('[data-pisodel]').forEach(b => b.onclick = () => { K.irrD.pisos.splice(+b.dataset.pisodel, 1); guardarMemoria(); paneCombos(); });
  $$('[data-con]').forEach(c => c.onchange = () => { const s = new Set(K.off); c.checked ? s.delete(c.dataset.con) : s.add(c.dataset.con); K.off = [...s]; guardarMemoria(); paneCombos(); });
  $$('#pane [data-a]').forEach(inp => inp.addEventListener(inp.type === 'checkbox' || inp.tagName === 'SELECT' ? 'change' : 'input', () => {
    setP(K, inp.dataset.a, inp.type === 'checkbox' ? inp.checked : inp.value); sincronizarIrregular(); guardarMemoria();
    if(inp.dataset.re) paneCombos();
  }));
  // al salir de un campo de texto se redibuja (para ver los factores nuevos sin perder el foco mientras se escribe)
  $$('#pane input[data-a^="pat."], #pane input[data-a^="otras."], #pane input[data-a="R0"], #pane input[data-a="R0y"], #pane input[data-a="Om0"], #pane input[data-a="Om0y"], #pane input[data-a^="nomE"]').forEach(i => i.addEventListener('change', () => paneCombos()));
  if($('#patModelo')) $('#patModelo').onclick = () => { const p = Combos.patronesDeModelo(M, AnexoC.categoria); for(const k in p) if(p[k]) K.pat[k] = p[k]; guardarMemoria(); paneCombos(); toast('Nombres tomados del modelo.'); };
  if($('#addK')) $('#addK').onclick = () => { K.otras.push({ nom:'', txt:'' }); guardarMemoria(); paneCombos(); };
  $$('[data-delk]').forEach(b => b.onclick = () => { K.otras.splice(+b.dataset.delk, 1); guardarMemoria(); paneCombos(); });
  const txt = () => Combos.tablaSAP(calcK().activas);
  $('#copiaK').onclick = async () => { try{ await navigator.clipboard.writeText(txt()); toast('Tabla copiada. Pégala en Excel o en el software.'); }catch(e){ toast('No se pudo copiar; usa Descargar.'); } };
  $('#bajaK').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt()], { type:'text/plain' })); a.download = `${S.m.consecutivo}_combinaciones.txt`; a.click(); };
}

// ═══ Datos y revisión de cada irregularidad (pedido de Amo 24-nov) ═══
const COLS_PISO = { '1A':[['V', 'Cortante del piso V [kN]'], ['d', 'Deriva del piso Δ [mm]']], '2A':[['m', 'Masa del piso [kN o t]']], '3A':[['a', 'Dimensión horizontal a [m]']], '5A':[['R', 'Resistencia del piso [kN]']] };
function irrDatosHTML(K, g, r, ro_){
  const D = K.irrD, inp = (k, l, h) => `<div class="f"><label>${l}</label><input inputmode="decimal" data-ird="${g}.${k}" value="${esc(D[g]?.[k] ?? '')}" ${ro_}/>${h ? `<div class="hint">${h}</div>` : ''}</div>`;
  const res = r ? `<div class="note ${Object.values(r.claves).some(x => x) ? 'amber' : 'green'}" style="margin-top:8px">${esc(r.txt)}</div>` : '';
  const tablaR = r?.filas ? `<table class="t" style="margin-top:8px"><thead><tr>${r.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${r.filas.map(f => `<tr>${f.map((x, j) => `<td class="${j ? 'n' : ''}">${j === f.length - 1 && x !== 'No' ? `<b style="color:#b91c1c">${esc(x)}</b>` : esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '';
  if(g === '2P') return `<div class="fg g4">${inp('A', 'A [m]', 'Retroceso en el sentido de B')}${inp('B', 'B [m]', 'Lado total')}${inp('C', 'C [m]', 'Retroceso en el sentido de D')}${inp('D', 'D [m]', 'Lado total')}</div>
    <div class="hint">Hay irregularidad si A > 0.15·B y además C > 0.15·D.</div>${res}`;
  if(g === '3P'){ const c2 = D['3P']?.caso === '2';
    return `<div class="fg g4"><div class="f"><label>Caso de la figura</label><select data-ird="3P.caso" ${ro_}><option value="1" ${!c2 ? 'selected' : ''}>1) Abertura interior C × D</option><option value="2" ${c2 ? 'selected' : ''}>2) Aberturas C × D + C × E</option></select></div>
      ${inp('A', 'A [m]', 'Largo del diafragma')}${inp('B', 'B [m]', 'Ancho del diafragma')}${inp('C', 'C [m]')}${inp('D', 'D [m]')}${c2 ? inp('E', 'E [m]') : ''}</div>
      <div class="hint">Hay irregularidad si el área de las aberturas es mayor que la mitad del área del diafragma (0.5·A·B).</div>${res}`; }
  if(g === '4A') return `<div class="fg g4">${inp('a', 'a [m]', 'Largo del elemento vertical')}${inp('b', 'b [m]', 'Desplazamiento de su plano de acción')}</div><div class="hint">Hay irregularidad si b > a.</div>${res}`;
  if(g === '4P' || g === '5P') return `<div class="hint">${g === '4P' ? 'Se presenta cuando la trayectoria de las fuerzas sísmicas se interrumpe porque un elemento vertical (muro, pórtico o arriostramiento) cambia de plano entre pisos. Compare la estructura con la figura y marque Sí o No.' : 'Se presenta cuando los elementos verticales que resisten el sismo no son paralelos ni simétricos respecto a los ejes principales. Compare la planta con la figura y marque Sí o No.'}</div>`;
  if(COLS_PISO[g]){
    const L = D.pisos || [], cols = COLS_PISO[g];
    const filas = L.map((p, i) => `<tr><td><input data-pis="${i}.n" value="${esc(p.n || '')}" ${ro_} style="width:90px"/></td>${cols.map(([k]) => `<td><input inputmode="decimal" data-pis="${i}.${k}" value="${esc(p[k] ?? '')}" ${ro_} style="width:100px"/></td>`).join('')}<td>${esIng() ? `<button class="btn sm" type="button" data-pisodel="${i}" title="Quitar">✕</button>` : ''}</td></tr>`).join('');
    const ayuda = { '1A':'Rigidez del piso K = V/Δ: cortante del piso y deriva del piso (desplazamiento relativo) en la misma dirección, del modelo.', '2A':'Masa (o peso) de cada piso, del avalúo de cargas.', '3A':'Dimensión horizontal del sistema de resistencia sísmica en cada piso, en la dirección revisada.', '5A':'Resistencia del piso = suma de las resistencias a cortante de los elementos que toman el cortante del piso en esa dirección.' }[g];
    return `<div class="hint" style="margin-bottom:6px">${ayuda} Los pisos van de abajo (Piso 1) hacia arriba; los mismos pisos sirven para 1A, 2A, 3A y 5A.</div>
      <table class="t"><thead><tr><th>Piso</th>${cols.map(([, l]) => `<th>${esc(l)}</th>`).join('')}<th></th></tr></thead><tbody>${filas || `<tr><td colspan="${cols.length + 2}" class="muted">Sin pisos</td></tr>`}</tbody></table>
      ${esIng() ? '<button class="btn sm" type="button" id="pisoAdd" style="margin-top:6px">＋ Agregar piso</button>' : ''}
      ${L.length < 2 ? '<div class="note" style="margin-top:6px">Con un solo piso esta irregularidad no aplica: márquela «No» o agregue los pisos.</div>' : ''}${tablaR}${res}`; }
  return '';
}

// ═══ Irregularidad torsional con los desplazamientos de SAP2000 ═══
function torsionHTML(K, M, ro_, parte, nivel){
  const T = K.tor, casos = M?.desp?.casos || [], hay = casos.length > 0;
  const selC = (k, def) => hay ? `<select data-tor="${k}" ${ro_}>${['', ...casos].map(c => `<option value="${esc(c)}" ${T[k] === c ? 'selected' : ''}>${c ? esc(c) : '— escoge —'}</option>`).join('')}</select>`
    : `<input data-tor="${k}" value="${esc(T[k] || '')}" placeholder="${def}" ${ro_}/>`;
  // Opción A de Amo (24-nov): datos arriba en una tarjeta por sentido; abajo un resultado por sentido con barra de límites
  const res = T.res;
  const datos = (dir, kN, kC, ph, def) => `<div class="tor-card"><b>Sentido ${dir}</b><div class="tor-in">
      <div class="f"><label>Nudos extremos</label><input data-tor="${kN}" value="${esc(T[kN] || '')}" placeholder="${ph}" ${ro_}/></div>
      <div class="f"><label>Caso</label>${selC(kC, def)}</div></div></div>`;
  // Opción B de Amo (24-nov): cada fila se pinta contra su propio límite (1aP → 1.2·prom, 1bP → 1.4·prom)
  const ext = nivel === '1bP';
  const resDir = dir => { const r = res?.[dir]; if(!r) return '';
    const t = r.t, top = Math.max(t.l14 * 1.25, t.max * 1.1), pc = v => Math.min(98, Math.max(2, 100 * v / top));
    const mal = ext ? t.tipo === '1bP' : !!t.tipo;
    const txt = ext ? (t.tipo === '1bP' ? '1bP torsional extrema · φp 0.8' : t.tipo === '1aP' ? 'No llega a 1bP (sí tiene 1aP)' : 'Sin irregularidad')
                    : (t.tipo === '1aP' ? '1aP torsional · φp 0.9' : t.tipo === '1bP' ? 'Pasa a 1bP (extrema)' : 'Sin irregularidad');
    const lim = ext ? t.l14 : t.l12, nl = ext ? '1.4·prom' : '1.2·prom';
    return `<div class="tor-card"><div class="tor-cab"><b>Sentido ${dir}</b>${pill(mal ? 'no' : 'ok', txt)}</div>
      <div class="hint">Caso ${esc(r.caso)} · Δ1 nudo ${esc(r.n[0].j)} = ${fx(r.n[0].D, 4)} m · Δ2 nudo ${esc(r.n[1].j)} = ${fx(r.n[1].D, 4)} m</div>
      <div class="tor-bar"><i class="tlim ${ext ? 'off' : 'on'}" style="left:${pc(t.l12)}%"><span>1.2·prom ${fx(t.l12, 4)}</span></i><i class="tlim up ${ext ? 'on' : 'off'}" style="left:${pc(t.l14)}%"><span>1.4·prom ${fx(t.l14, 4)}</span></i><i class="dot ${mal ? 'no' : 'ok'}" style="left:${pc(t.max)}%"></i></div>
      <div><span class="tor-big">${fx(t.max, 4)}</span> <span class="hint">Δmáx [m] — ${t.max > lim ? 'pasa' : 'no pasa'} ${nl} = ${fx(lim, 4)} (límite de ${ext ? '1bP' : '1aP'})</span></div></div>`; };
  const detalle = dir => { const r = res?.[dir]; return r ? `<div><b>Sentido ${dir}</b> <span class="hint">(${esc(r.caso)})</span>${tabla(['Nudo','U1 [m]','U2 [m]','Δ = √(U1²+U2²)'], r.n.map(x => [esc(x.j), fx(x.U1,6), fx(x.U2,6), fx(x.D,4)]))}</div>` : ''; };
  if(parte === 'res') return `${res?.ok ? `<div class="tor-dos" style="margin-top:12px">${resDir('X')}${resDir('Y')}</div>
      <details class="tor-det"><summary class="hint">Ver desplazamientos U1, U2 de cada nudo · calculado el ${esc(new Date(res.fecha).toLocaleString('es-CO', { dateStyle:'medium', timeStyle:'short' }))} (si cambia el modelo, vuelva a revisar)</summary><div class="tor-dos">${detalle('X')}${detalle('Y')}</div></details>` : ''}
    ${res?.error ? `<div class="note amber" style="margin-top:8px">${esc(res.error)}</div>` : ''}`;
  return `<div class="tor-box"><h4 class="sub" style="margin-top:0">Irregularidad torsional 1aP / 1bP — con los desplazamientos del modelo</h4>
    <div class="tor-dos">${datos('X', 'nudos', 'casoX', 'Ej.: 23, 18', 'DERX')}${datos('Y', 'nudosY', 'casoY', 'vacío = los mismos', 'DERY')}</div>
    ${!M?.ok ? '<div class="note amber">Primero sube el modelo en el Anexo C.</div>'
      : !hay ? `<div class="note amber"><b>El archivo del modelo no trae desplazamientos.</b> En el software, después de correr el análisis: <b>File → Export → .s2k Text File</b> y en la ventana de tablas marca también <b>Analysis Results → Joint Output → Displacements</b> (con el botón de casos escoge los de derivas). Luego usa «Reemplazar» en el Anexo C.
          <details open style="margin-top:6px"><summary><b>O pega aquí la tabla «Joint Displacements» copiada desde el software</b> (en la ventana de la tabla: Edit → Copy Entire Table)</summary><textarea id="torPega" rows="4" style="width:100%;margin-top:6px" placeholder="Joint	OutputCase	CaseType	U1	U2	U3 …" ${ro_}></textarea></details></div>` : ''}
    <div class="tor-acc">${esIng() && M?.ok ? '<button class="btn sm pri" type="button" id="torCalc">⚙ Revisar irregularidad torsional</button>' : ''}
      ${hay ? `<details><summary class="hint">Usar otra tabla de desplazamientos</summary><textarea id="torPega" rows="4" style="width:100%;margin-top:6px" placeholder="Joint	OutputCase	CaseType	StepType	U1	U2 …" ${ro_}></textarea></details>` : ''}</div>
    ${parte ? '' : torsionHTML(K, M, ro_, 'res')}</div>`;
}
function activarTorsion(K, M){
  $$('[data-tor]').forEach(i => i.addEventListener(i.tagName === 'SELECT' ? 'change' : 'input', () => { K.tor[i.dataset.tor] = i.value; guardarMemoria(); }));
  const b = $('#torCalc'); if(!b) return;
  b.onclick = async () => {
    const T = K.tor, nx = String(T.nudos || '').split(/[,;\s]+/).filter(Boolean), ny = String(T.nudosY || '').split(/[,;\s]+/).filter(Boolean);
    const nyy = ny.length ? ny : nx;
    if(nx.length !== 2 || nyy.length !== 2) return toast('Escribe dos nudos por sentido (los dos extremos), separados por coma.', 4000);
    if(!T.casoX || !T.casoY) return toast('Escoge el caso de cada sentido.', 3500);
    try{
      toast('Leyendo desplazamientos…', 15000);
      const pega = $('#torPega')?.value.trim();
      const D = AnexoC.desplazamientos(pega || await textoModelo(datosC()));
      if(!D.n){ T.res = { error: D.tablas.length
          ? `El archivo trae ${D.tablas.length} tablas, pero ninguna de desplazamientos de nudos${D.conResultados.length ? ' (tablas de resultados: ' + D.conResultados.join(', ') + ')' : ' ni de ningún otro resultado del análisis'}. Revisa que al exportar estuviera marcada ANALYSIS RESULTS → Joint Output → Displacements y que el modelo estuviera corrido (candado cerrado).`
          : 'No se encontraron desplazamientos en el archivo ni en la tabla pegada.' }; guardarMemoria(); return paneCombos(); }
      // el nombre del caso se compara sin importar mayúsculas ni espacios de más
      const nor = t => String(t).toLowerCase().replace(/\s+/g, ' ').trim();
      const dir = (nudos, caso0) => { const caso = D.casos.find(c => nor(c) === nor(caso0));
        if(!caso) throw new Error(`No encuentro el caso «${caso0}». Casos en los datos: ${D.casos.join(' · ')}.`);
        const n = nudos.map(j => ({ j, ...(D.mapa[`${j}|${caso}`] || {}) }));
        const falt = n.filter(x => x.U1 === undefined).map(x => x.j); if(falt.length) throw new Error(`No hay desplazamientos del nudo ${falt.join(', ')} en el caso ${caso}.`);
        n.forEach(x => x.D = Math.hypot(x.U1, x.U2)); return { caso, n, t:Combos.torsion(n[0], n[1]) }; };
      const X = dir(nx, T.casoX), Y = dir(nyy, T.casoY);
      T.casoX = X.caso; T.casoY = Y.caso;
      T.res = { ok:true, X, Y, fecha:new Date().toISOString() };
      const tipos = [X.t.tipo, Y.t.tipo];
      K.irrP['1bP'] = tipos.includes('1bP'); K.irrP['1aP'] = !K.irrP['1bP'] && tipos.includes('1aP');
      sincronizarIrregular(); guardarMemoria(); toast('Irregularidad torsional revisada.'); paneCombos();
    }catch(e){ K.tor.res = { error:e.message }; guardarMemoria(); paneCombos(); }
  };
}
