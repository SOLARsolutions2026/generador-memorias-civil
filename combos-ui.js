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
  const R = Combos.coefR(K);
  const seg = (attr, val, si) => `<div class="seg sm" role="group"><button type="button" ${attr}="1" class="${val ? 'on' : ''}" ${ro_}>${si || 'Sí'}</button><button type="button" ${attr}="0" class="${!val ? 'on' : ''}" ${ro_}>No</button></div>`;
  const torAuto = !!K.tor?.res?.ok;
  const nota = (k, v) => `<label>Nota para la memoria</label><input class="nota-irr" data-nirr="${k}" value="${esc(K.notasIrr[k] || '')}" placeholder="${v ? 'Por qué aplica' : 'Justificación (opcional)'}" ${ro_}/>`;
  const redDet = `<div class="red-box"><div class="f"><label for="redCalc">Cálculo / justificación (sale en la memoria)</label><textarea id="redCalc" rows="4" placeholder="Escribe el cálculo de la redundancia…" ${ro_}>${esc(K.redCalc || '')}</textarea><div class="hint">Sí → φr = 1.00 · No → φr = 0.75</div></div>
        <div>${K.redImg ? `<div class="drop-img has" id="redImgV" style="max-width:none"><span class="muted">Cargando…</span></div>
            ${esIng() ? '<div style="display:flex;gap:6px;margin-top:6px"><button class="btn sm" type="button" id="redImgC">🔄 Cambiar</button><button class="btn sm danger" type="button" id="redImgQ">Quitar</button></div>' : ''}`
          : esIng() ? '<button class="drop-img" type="button" id="redImgC" style="max-width:none;min-height:110px;width:100%"><div class="ph-in"><div style="font-size:20px">📷</div><b>Foto del cálculo</b><br/>toca o arrastra aquí</div></button>' : ''}
          ${K.redImg ? `<input id="redNota" value="${esc(K.redNota || '')}" placeholder="Pie de la foto" style="margin-top:6px;width:100%" ${ro_}/>` : ''}</div></div>`;
  // Fila de la lista: ▸ tipo · nombre · φ · Sí/No; al tocarla se abren sus datos debajo (una a la vez)
  const fila = (k, nombre, phi, ctrl, det, marca) => { const ab = irrAbierta === k;
    return `<div class="irr-row ${ab ? 'ab' : ''}" data-abre="${k}"><span class="chev">${ab ? '▾' : '▸'}</span><b class="ik">${esc(k === 'red' ? 'φr' : k)}</b><span class="in">${esc(nombre)}${marca || ''}</span><span class="iphi">${phi}</span>${ctrl}</div>
      ${ab ? `<div class="irr-det">${det}</div>` : ''}`; };
  const filaIrr = (i, lado) => { const v = !!K[lado][i.k], auto = torAuto && (i.k === '1aP' || i.k === '1bP');
    const ctrl = auto ? `<span class="pill ${v ? 'no' : 'ok'}">${v ? 'Sí aplica' : 'No aplica'} · según cálculo</span>` : seg(`data-irr="${lado}.${i.k}" data-v`, v);
    const det = (i.k === '1aP' || i.k === '1bP') ? torsionHTML(K, M, ro_) + `<div style="margin-top:10px">${nota(i.k, v)}</div>` : nota(i.k, v);
    return fila(i.k, i.n, 'φ ' + fx(i.phi,1), ctrl, det, K.notasIrr[i.k] ? ' <span class="hint">· con nota</span>' : ''); };
  let h = '';
  // 1. Irregularidades
  h += `<div class="card"><div class="ct">Irregularidades y coeficiente de capacidad de disipación R (NSR-10 A.3.3)</div>`;
  if(!sis) h += `<div class="note green"><b>Sin análisis sísmico.</b> No se evalúan irregularidades ni se generan combinaciones con sismo.</div></div>`;
  else {
    h += `<div class="fg g4">${fSel(K,'sisR','Sistema estructural (Tabla A.3-3)',Combos.R0S.map(s => [s.k, s.n + (s.R0 ? ` — R0 = ${s.R0}` : '')]),{cls:'span4',re:1})}
        ${K.sisR === 'otro' ? fIn(K,'R0','R0',{ph:'escribe R0'}) : ''}</div>
      <div class="hint" style="margin:8px 0 2px">Toca una fila (▸) para abrir sus datos: la torsión se calcula en 1aP/1bP; las demás llevan una nota.</div>
      <h4 class="sub">En planta (Tabla A.3-6) → φp</h4>${Combos.IRR_P.map(i => filaIrr(i, 'irrP')).join('')}
      <h4 class="sub">En altura (Tabla A.3-7) → φa</h4>${Combos.IRR_A.map(i => filaIrr(i, 'irrA')).join('')}
      <h4 class="sub">Redundancia (A.3.3.8) → φr</h4>${fila('red', '¿La estructura tiene redundancia?', 'φ ' + fx(R.phiR,2), seg('data-red', K.redundante !== false), redDet,
        K.redCalc || K.redImg ? ' <span class="hint">· con cálculo</span>' : '')}
      <div class="wtot"><span>R = φa · φp · φr · R0 = ${fx(R.phiA,2)} × ${fx(R.phiP,2)} × ${fx(R.phiR,2)} × ${fx(R.R0,1)}</span><span>R = ${fx(R.R,2)}</span></div>
      <div class="hint" style="margin-top:6px">Estructura <b>${R.irregular ? 'irregular' : 'regular'}</b>: en la comparación modal del Anexo B se exige el ${R.irregular ? '90' : '80'} % de Vs (se actualiza solo). Las fuerzas sísmicas de diseño se dividen por R (E = Fs/R).</div></div>`;
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
  h += `<div class="card"><div class="ct">Resumen de cargas y patrones de SAP2000</div>
    ${tabla(['Símbolo','Carga','Valor','Viene de','Patrón(es) en SAP2000'], usados.map(k => [`<b>${k}</b>`, Combos.SIMB[k], val[k], fuente[k],
      `<input data-a="pat.${k}" value="${esc(K.pat[k] || '')}" placeholder="nombre en SAP" ${ro_} style="min-width:150px"/>`]))}
    <div class="hint" style="margin-top:6px">Si un símbolo usa varios patrones, sepáralos con coma (p. ej. «DEAD, DEAD SI»). La viva de cubierta se trata como Lr.</div>
    ${M?.ok && esIng() ? '<button class="btn sm" type="button" id="patModelo" style="margin-top:8px">↺ Tomar los nombres del modelo del Anexo C</button>' : ''}</div>`;
  // 3. Combinaciones
  const RK = calcK();
  h += `<div class="card"><div class="ct">Combinaciones de carga <span class="pill gray">${RK.activas.length} activas de ${RK.lista.length}</span></div>
    <div class="opc-k">
      ${sis ? `<label class="chk"><input type="checkbox" data-a="orto" data-re="1" ${K.orto ? 'checked' : ''} ${ro_}/> 30 % en la dirección ortogonal (A.3.6.3)</label>
      <label class="chk"><input type="checkbox" data-a="derivas" data-re="1" ${K.derivas ? 'checked' : ''} ${ro_}/> Combinaciones para derivas (A.6, sin dividir por R)</label>` : ''}
      <label class="chk"><input type="checkbox" data-a="servicio" data-re="1" ${K.servicio ? 'checked' : ''} ${ro_}/> Servicio (B.2.3)</label>
      ${sis && K.servicio ? `<label class="chk"><input type="checkbox" data-a="servicioSismo" data-re="1" ${K.servicioSismo ? 'checked' : ''} ${ro_}/> Servicio con sismo (0.7E)</label>` : ''}
      <label class="chk"><input type="checkbox" data-a="impacto" data-re="1" ${K.impacto ? 'checked' : ''} ${ro_}/> Impacto de vehículos (1.2D + 1.0IMP + 1.0L)</label></div>
    ${RK.faltaPat.length ? `<div class="note amber" style="margin-top:10px">Falta el nombre del patrón de SAP para: <b>${RK.faltaPat.join(', ')}</b>.</div>` : ''}
    ${['Resistencia','Servicio','Derivas','Impacto','Otras'].map(g => { const l = RK.lista.filter(c => c.grupo === g); if(!l.length) return '';
      return `<h4 class="sub">${g}${g === 'Resistencia' ? ' (B.2.4.2)' : g === 'Servicio' ? ' (B.2.3.1)' : ''}</h4>${tabla(['','Nombre','Combinación','Ref.','Factores en SAP2000'], l.map(c => [
        `<input type="checkbox" data-con="${esc(c.id)}" ${c.on ? 'checked' : ''} ${ro_} aria-label="Usar ${esc(c.id)}"/>`, `<b>${esc(c.id)}</b>`, esc(c.txt) + (c.nota ? ` <span class="hint">(${esc(c.nota)})</span>` : ''), esc(c.ref),
        `<span class="ids">${Object.entries(c.sap).map(([p, f]) => esc(p) + ' ' + f).join(' · ')}</span>`]), 'comb-tb')}`; }).join('')}
    <h4 class="sub">Otras combinaciones (escritas a mano)</h4>
    ${(K.otras || []).map((o, i) => `<div class="xrow" style="grid-template-columns:minmax(0,.6fr) minmax(0,2fr) auto"><div class="f"><input data-a="otras.${i}.nom" value="${esc(o.nom || '')}" placeholder="Nombre" ${ro_}/></div>
      <div class="f"><input data-a="otras.${i}.txt" value="${esc(o.txt || '')}" placeholder="Ej.: 1.2D + 1.0IMPx + 0.5Lr" ${ro_}/></div>${esIng() ? `<button class="btn sm danger" type="button" data-delk="${i}" aria-label="Quitar">✕</button>` : ''}</div>`).join('')}
    ${esIng() ? '<button class="btn sm" type="button" id="addK" style="margin-top:6px">＋ Agregar combinación</button>' : ''}
    <div class="hint" style="margin-top:4px">Símbolos: ${Object.keys(Combos.SIMB).join(', ')}.</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn grn" type="button" id="copiaK">📋 Copiar tabla para SAP2000 / Excel</button><button class="btn" type="button" id="bajaK">⬇ Descargar (.txt)</button></div>
    <div class="hint" style="margin-top:6px">La tabla trae una fila por patrón: ComboName, ComboType, CaseName, ScaleSF. Al subir el modelo en el Anexo C, la app revisa que estas combinaciones estén con los mismos factores.</div></div>`;
  h += `<div class="note blue">Estas tablas se explicarán en la <b>memoria general</b> (pendiente de construir); aquí se trabajan y se revisan.</div>`;
  pane(h);
  if(K.redImg) urlDe(K.redImg).then(u => { const b = $('#redImgV'); if(b) b.innerHTML = u ? `<img src="${esc(u)}" alt="Cálculo de la redundancia" style="max-width:100%;max-height:300px"/>` : '<span class="muted">No se encontró la foto.</span>'; });
  if(!esIng()) return;
  const re = () => { sincronizarIrregular(); guardarMemoria(); paneCombos(); };
  $$('[data-irr]').forEach(b => b.onclick = () => { const [lado, k] = b.dataset.irr.split('.'); K[lado][k] = b.dataset.v === '1'; re(); });
  $$('[data-red]').forEach(b => b.onclick = () => { K.redundante = b.dataset.red === '1'; re(); });
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
  $$('[data-con]').forEach(c => c.onchange = () => { const s = new Set(K.off); c.checked ? s.delete(c.dataset.con) : s.add(c.dataset.con); K.off = [...s]; guardarMemoria(); paneCombos(); });
  $$('#pane [data-a]').forEach(inp => inp.addEventListener(inp.type === 'checkbox' || inp.tagName === 'SELECT' ? 'change' : 'input', () => {
    setP(K, inp.dataset.a, inp.type === 'checkbox' ? inp.checked : inp.value); sincronizarIrregular(); guardarMemoria();
    if(inp.dataset.re) paneCombos();
  }));
  // al salir de un campo de texto se redibuja (para ver los factores nuevos sin perder el foco mientras se escribe)
  $$('#pane input[data-a^="pat."], #pane input[data-a^="otras."], #pane input[data-a="R0"]').forEach(i => i.addEventListener('change', () => paneCombos()));
  if($('#patModelo')) $('#patModelo').onclick = () => { const p = Combos.patronesDeModelo(M, AnexoC.categoria); for(const k in p) if(p[k]) K.pat[k] = p[k]; guardarMemoria(); paneCombos(); toast('Nombres tomados del modelo.'); };
  if($('#addK')) $('#addK').onclick = () => { K.otras.push({ nom:'', txt:'' }); guardarMemoria(); paneCombos(); };
  $$('[data-delk]').forEach(b => b.onclick = () => { K.otras.splice(+b.dataset.delk, 1); guardarMemoria(); paneCombos(); });
  const txt = () => Combos.tablaSAP(calcK().activas);
  $('#copiaK').onclick = async () => { try{ await navigator.clipboard.writeText(txt()); toast('Tabla copiada. Pégala en Excel o en SAP2000.'); }catch(e){ toast('No se pudo copiar; usa Descargar.'); } };
  $('#bajaK').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt()], { type:'text/plain' })); a.download = `${S.m.consecutivo}_combinaciones.txt`; a.click(); };
}

// ═══ Irregularidad torsional con los desplazamientos de SAP2000 ═══
function torsionHTML(K, M, ro_){
  const T = K.tor, casos = M?.desp?.casos || [], hay = casos.length > 0;
  const selC = (k, def) => hay ? `<select data-tor="${k}" ${ro_}>${['', ...casos].map(c => `<option value="${esc(c)}" ${T[k] === c ? 'selected' : ''}>${c ? esc(c) : '— escoge —'}</option>`).join('')}</select>`
    : `<input data-tor="${k}" value="${esc(T[k] || '')}" placeholder="${def}" ${ro_}/>`;
  const res = T.res, filaDir = (dir) => { const r = res?.[dir]; if(!r) return '';
    return `<div class="tor-dir"><b>Sismo sentido ${dir}</b> <span class="hint">(caso ${esc(r.caso)})</span>
      ${tabla(['Nudo','U1 [m]','U2 [m]','Δ = √(U1²+U2²)'], r.n.map(x => [esc(x.j), fx(x.U1,6), fx(x.U2,6), fx(x.D,4)]))}
      ${tabla(['Δmáx','1.2·(Δ1+Δ2)/2','1.4·(Δ1+Δ2)/2','Resultado'], [[fx(r.t.max,4), fx(r.t.l12,4), fx(r.t.l14,4),
        r.t.tipo ? pill('no', r.t.tipo === '1bP' ? '1bP torsional extrema' : '1aP torsional') : pill('ok', 'Sin irregularidad torsional')]])}</div>`; };
  return `<div class="tor-box"><h4 class="sub" style="margin-top:0">Irregularidad torsional 1aP / 1bP — cálculo con los desplazamientos de SAP2000</h4>
    <div class="fg g4">
      <div class="f"><label>Nudos extremos (sentido X)</label><input data-tor="nudos" value="${esc(T.nudos || '')}" placeholder="Ej.: 23, 18" ${ro_}/></div>
      <div class="f"><label>Caso para X</label>${selC('casoX', 'DERX')}</div>
      <div class="f"><label>Nudos extremos (sentido Y)</label><input data-tor="nudosY" value="${esc(T.nudosY || '')}" placeholder="vacío = los mismos" ${ro_}/></div>
      <div class="f"><label>Caso para Y</label>${selC('casoY', 'DERY')}</div></div>
    ${!M?.ok ? '<div class="note amber">Primero sube el modelo en el Anexo C.</div>'
      : !hay ? `<div class="note amber"><b>El archivo del modelo no trae desplazamientos.</b> En SAP2000, después de correr el análisis: <b>File → Export → SAP2000 .s2k Text File</b> y en la ventana de tablas marca también <b>Analysis Results → Joint Output → Displacements</b> (con el botón de casos escoge DERX y DERY). Luego usa «Reemplazar» en el Anexo C.
          <details open style="margin-top:6px"><summary><b>O pega aquí la tabla «Joint Displacements» copiada desde SAP</b> (en la ventana de la tabla: Edit → Copy Entire Table)</summary><textarea id="torPega" rows="4" style="width:100%;margin-top:6px" placeholder="Joint	OutputCase	CaseType	U1	U2	U3 …" ${ro_}></textarea></details></div>` : ''}
    ${hay ? `<details style="margin-top:8px"><summary class="hint">Usar otra tabla de desplazamientos (pegarla desde SAP)</summary><textarea id="torPega" rows="4" style="width:100%;margin-top:6px" placeholder="Joint	OutputCase	CaseType	StepType	U1	U2 …" ${ro_}></textarea></details>` : ''}
    ${esIng() && M?.ok ? '<button class="btn sm pri" type="button" id="torCalc" style="margin-top:8px">⚙ Revisar irregularidad torsional</button>' : ''}
    ${res?.ok ? `<div class="tor-res">${filaDir('X')}${filaDir('Y')}</div><div class="hint">Calculado el ${esc(new Date(res.fecha).toLocaleString('es-CO', { dateStyle:'medium', timeStyle:'short' }))}. Si cambias el modelo, vuelve a revisar.</div>` : ''}
    ${res?.error ? `<div class="note amber" style="margin-top:8px">${esc(res.error)}</div>` : ''}</div>`;
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
