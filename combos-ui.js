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

function paneCombos(){
  const K = datosK(), sis = sismoK(), ro_ = esIng() ? '' : 'disabled', M = S.m.anexos?.C?.modelo;
  if(K.patAuto && M?.ok){ const p = Combos.patronesDeModelo(M, AnexoC.categoria); if(p){ for(const k in p) if(p[k]) K.pat[k] = p[k]; K.patAuto = false; guardarMemoria(); } }
  const R = Combos.coefR(K);
  const seg = (attr, val, si) => `<div class="seg sm" role="group"><button type="button" ${attr}="1" class="${val ? 'on' : ''}" ${ro_}>${si || 'Sí'}</button><button type="button" ${attr}="0" class="${!val ? 'on' : ''}" ${ro_}>No</button></div>`;
  const filaIrr = (i, lado) => { const v = !!K[lado][i.k];
    return [`<b>${i.k}</b>`, esc(i.n), fx(i.phi,1), seg(`data-irr="${lado}.${i.k}" data-v`, v),
      `<input class="nota-irr" data-nirr="${i.k}" value="${esc(K.notasIrr[i.k] || '')}" placeholder="${v ? 'Por qué aplica' : 'Justificación (opcional)'}" ${ro_}/>`]; };
  let h = '';
  // 1. Irregularidades
  h += `<div class="card"><div class="ct">Irregularidades y coeficiente de capacidad de disipación R (NSR-10 A.3.3)</div>`;
  if(!sis) h += `<div class="note green"><b>Sin análisis sísmico.</b> No se evalúan irregularidades ni se generan combinaciones con sismo.</div></div>`;
  else {
    h += `<div class="fg g4">${fSel(K,'sisR','Sistema estructural (Tabla A.3-3)',Combos.R0S.map(s => [s.k, s.n + (s.R0 ? ` — R0 = ${s.R0}` : '')]),{cls:'span4',re:1})}
        ${K.sisR === 'otro' ? fIn(K,'R0','R0',{ph:'escribe R0'}) : ''}</div>
      <h4 class="sub">En planta (Tabla A.3-6) → φp</h4>${tabla(['Tipo','Irregularidad','φp','¿Presenta?','Nota (sale en la memoria)'], Combos.IRR_P.map(i => filaIrr(i, 'irrP')), 'irr-tb')}
      <h4 class="sub">En altura (Tabla A.3-7) → φa</h4>${tabla(['Tipo','Irregularidad','φa','¿Presenta?','Nota (sale en la memoria)'], Combos.IRR_A.map(i => filaIrr(i, 'irrA')), 'irr-tb')}
      <div class="f" style="margin-top:10px"><label>¿La estructura tiene redundancia? (A.3.3.8)</label>${seg('data-red', K.redundante !== false)}<div class="hint">Sí → φr = 1.00 · No → φr = 0.75</div></div>
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
  if(!esIng()) return;
  const re = () => { sincronizarIrregular(); guardarMemoria(); paneCombos(); };
  $$('[data-irr]').forEach(b => b.onclick = () => { const [lado, k] = b.dataset.irr.split('.'); K[lado][k] = b.dataset.v === '1'; re(); });
  $$('[data-red]').forEach(b => b.onclick = () => { K.redundante = b.dataset.red === '1'; re(); });
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
