/* ═══ Anexo D — pestañas de concreto: zapatas y pedestales (usa calc/concreto.js y las reacciones del modelo) ═══ */
'use strict';
let selZap = null, selPed = null, _reac = null;

const nuevoZap = n => ({ id:'z' + Date.now().toString(36) + n, nom:`Z-${n}`, desc:'', nudos:[], ped:'', pos:'centrada', B:1.2, L:1.2, h:0.4, bx:0.4, by:0.4, Hp:1.18, Df:1.5,
  qa:'', gs:18, qsup:0, fc:21, fy:420, rec:0.075, barX:'1/2"', barY:'1/2"', MmX:'', MmY:'', imgs:[], res:null });
const nuevoPed = n => ({ id:'p' + Date.now().toString(36) + n, nom:`PD-${n}`, desc:'', nudos:[], b:400, h:400, Hp:1.18, rec:50, fc:21, fy:420, bar:'5/8"', nx:3, ny:3,
  est:'3/8"', ramasX:2, ramasY:2, sConf:100, sFuera:150, k:2, zap:'', res:null });

// Reacciones del modelo (descarga el .s2k una vez por sesión)
async function reacModelo(){
  const C = S.m.anexos?.C; if(!C?.modelo?.reac?.n || !C.archivo) return null;
  if(_reac?.clave === C.archivo.fecha) return _reac.R;
  const R = AnexoC.reacciones(await textoModelo(C)); _reac = { clave:C.archivo.fecha, R }; return R;
}
const combosD = (D, M) => ({ serv: D.cServ || M?.reac?.serv || [], res: D.cRes || M?.reac?.res || [] });
const filasReac = (R, nudos, casos) => !R ? [] : R.filas.filter(f => nudos.includes(f.j) && casos.includes(f.c));
const filaReacTxt = f => !f ? '' : `nudo ${esc(f.j)} · ${esc(f.c)}${f.step ? ' (' + esc(f.step) + ')' : ''}`;
const BAR_OPC = (cur, ro_) => Object.keys(Concreto.BARRAS).map(k => `<option value="${esc(k)}" ${cur === k ? 'selected' : ''}>${esc(k)}</option>`).join('');

// Barra superior común: combinaciones de servicio / resistencia para la cimentación
function combosCimHTML(D, M){
  const ro_ = esIng() ? '' : 'disabled', casos = M?.reac?.casos || [], c = combosD(D, M);
  if(!M?.reac?.n) return `<div class="note amber">El archivo del modelo no trae reacciones. Al exportar marca <b>Analysis Results → Joint Output → Reactions</b> con las combinaciones de servicio y de resistencia, y usa «Reemplazar» en el Anexo C.</div>`;
  const chips = (k, sel) => `<div class="chips-c">${casos.map(x => `<label class="chip-c ${sel.includes(x) ? 'on' : ''}"><input type="checkbox" data-cc="${k}" value="${esc(x)}" ${sel.includes(x) ? 'checked' : ''} ${ro_}/> ${esc(x)}</label>`).join('')}</div>`;
  return `<details class="d-opc" style="margin-bottom:10px"><summary>Combinaciones usadas (servicio ${c.serv.length} · resistencia ${c.res.length})</summary>
    <div class="f" style="margin-top:6px"><label>Servicio — presión sobre el suelo</label>${chips('serv', c.serv)}</div>
    <div class="f" style="margin-top:6px"><label>Resistencia — diseño del concreto</label>${chips('res', c.res)}</div></details>`;
}
function nudosHTML(el, M){
  const ro_ = esIng() ? '' : 'disabled', nudos = M?.reac?.nudos || [];
  if(!nudos.length) return '';
  return `<div class="f"><label>Nudos de apoyo que representa (se toma el que controla)</label><div class="chips-c">${nudos.map(j => `<label class="chip-c ${el.nudos.includes(j) ? 'on' : ''}"><input type="checkbox" data-nudo="${esc(j)}" ${el.nudos.includes(j) ? 'checked' : ''} ${ro_}/> ${esc(j)}</label>`).join('')}</div></div>`;
}
function listaCimHTML(lista, sel, tipo){
  return `${lista.map(e => `<button type="button" class="d-el ${e.id === sel ? 'on' : ''}" data-selc="${e.id}"><span><b>${esc(e.nom)}</b> ${tipo === 'zap' ? `${fx(+e.B,2)}×${fx(+e.L,2)}×${fx(+e.h,2)} m · ${esc(e.pos)}` : `${esc(e.b)}×${esc(e.h)} mm · ${esc(e.nx)}/${esc(e.ny)} Ø${esc(e.bar)}`}
      <small>${e.nudos.length ? 'nudos ' + esc(e.nudos.join(', ')) : 'sin nudos'}</small></span>${pillRes(e.res)}</button>`).join('')}
    ${!lista.length ? '<p class="hint">Aún no hay elementos.</p>' : ''}`;
}

// ═══ Pestañas ═══
function paneConcreto(tipo, h){
  const D = datosD(), M = S.m.anexos?.C?.modelo, lista = tipo === 'zap' ? D.zap : D.ped;
  let sel = lista.find(e => e.id === (tipo === 'zap' ? selZap : selPed)) || lista[0];
  if(tipo === 'zap') selZap = sel?.id || null; else selPed = sel?.id || null;
  h += combosCimHTML(D, M) + `<div class="d-grid"><div class="d-lista">${listaCimHTML(lista, sel?.id, tipo)}
    ${esIng() ? `<button class="btn sm" type="button" id="cNuevo" style="width:100%;margin-top:6px">＋ Agregar ${tipo === 'zap' ? 'zapata' : 'pedestal'}</button>` : ''}</div>
    <div id="cDet">${sel ? (tipo === 'zap' ? detZapHTML(sel, D, M) : detPedHTML(sel, D, M)) : '<div class="card"><p class="muted">Agrega un elemento.</p></div>'}</div></div>
    <div class="card"><div class="ct">Páginas del Anexo D</div><button class="btn grn" type="button" id="printD">🖨 Imprimir / Guardar PDF del Anexo D</button></div>`;
  pane(h); activarTabsD();
  $('#printD').onclick = () => imprimirD();
  $$('[data-selc]').forEach(b => b.onclick = () => { if(tipo === 'zap') selZap = b.dataset.selc; else selPed = b.dataset.selc; paneAnexoD(); });
  if(esIng()){
    $$('[data-cc]').forEach(i => i.onchange = () => { const c = combosD(D, M), k = i.dataset.cc, s = new Set(c[k]); i.checked ? s.add(i.value) : s.delete(i.value);
      if(k === 'serv') D.cServ = [...s]; else D.cRes = [...s]; guardarMemoria(); paneAnexoD(); });
    $('#cNuevo').onclick = () => { const e = tipo === 'zap' ? nuevoZap(D.zap.length + 1) : nuevoPed(D.ped.length + 1);
      if(M?.reac?.nudos?.length && !lista.length) e.nudos = [...M.reac.nudos];
      if(tipo === 'zap' && D.ped[0]) e.ped = D.ped[0].id; if(tipo === 'ped' && D.zap[0]) e.zap = D.zap[0].id;
      lista.push(e); if(tipo === 'zap') selZap = e.id; else selPed = e.id; guardarMemoria(); paneAnexoD(); };
  }
  if(sel) activarCim(sel, tipo, D, M);
}

function detZapHTML(z, D, M){
  const ro_ = esIng() ? '' : 'disabled', opt = (v, t, cur) => `<option value="${esc(v)}" ${String(cur) === String(v) ? 'selected' : ''}>${esc(t)}</option>`;
  return `<div class="card"><div class="ct">${esc(z.nom)} · zapata ${esc(z.pos)}${esIng() ? '<button class="btn sm danger" type="button" id="cBorrar">Borrar</button>' : ''}</div>
    <div class="fg g4">${fIn(z,'nom','Nombre',{num:false})}${fIn(z,'desc','Descripción',{num:false,cls:'span2'})}
      <div class="f"><label>Posición del pedestal</label><select data-a="pos" ${ro_}>${opt('centrada','Centrada (αs = 40)',z.pos)}${opt('medianera','Medianera: en un borde (αs = 30)',z.pos)}${opt('esquinera','Esquinera: en una esquina (αs = 20)',z.pos)}</select></div></div>
    ${nudosHTML(z, M)}
    <h4 class="sub">Geometría [m]</h4>
    <div class="fg g4">${fIn(z,'B','B (dirección x)')}${fIn(z,'L','L (dirección y)')}${fIn(z,'h','Espesor h')}${fIn(z,'Df','Profundidad de la base Df')}</div>
    <div class="fg g4"><div class="f"><label>Pedestal</label><select data-a="ped" ${ro_}>${opt('','— medidas a mano —',z.ped)}${D.ped.map(p => opt(p.id, `${p.nom} (${p.b}×${p.h} mm)`, z.ped)).join('')}</select></div>
      ${z.ped ? '<div class="hint" style="align-self:center">bx, by y la altura se toman del pedestal.</div>' : fIn(z,'bx','Pedestal bx') + fIn(z,'by','Pedestal by') + fIn(z,'Hp','Altura del pedestal Hp')}</div>
    <h4 class="sub">Suelo y materiales</h4>
    <div class="fg g4">${fIn(z,'qa','qa admisible [kN/m²]',{h:'Estudio de suelos'})}${fIn(z,'gs','γ suelo [kN/m³]')}${fIn(z,'qsup','Carga sobre el terreno [kN/m²]',{h:'Placa, acabados, sobrecarga'})}${fIn(z,'rec','Recubrimiento [m]')}</div>
    <div class="fg g4">${fIn(z,'fc',"f'c [MPa]")}${fIn(z,'fy','fy [MPa]')}<div class="f"><label>Barra en x</label><select data-a="barX" ${ro_}>${BAR_OPC(z.barX)}</select></div><div class="f"><label>Barra en y</label><select data-a="barY" ${ro_}>${BAR_OPC(z.barY)}</select></div></div>
    <details class="d-opc"><summary>Comparación con el modelo sobre resortes (opcional)</summary>
      <div class="fg g4">${fIn(z,'MmX','Momento del modelo para las barras en x [kN·m/m]')}${fIn(z,'MmY','Momento del modelo para las barras en y [kN·m/m]')}</div>
      <div class="hint">El momento del modelo viene por metro: la app lo multiplica por el ancho, lo compara con el método clásico y usa el mayor.</div>
      <div class="expo-imgs" id="zImgs" style="margin-top:8px"></div>
      ${esIng() && (z.imgs || []).length < 4 ? '<button class="btn sm" type="button" id="zAddImg" style="margin-top:6px">📎 Agregar imagen del modelo (momentos, deformaciones)</button>' : ''}</details>
    <div id="cRes" style="margin-top:12px"><p class="muted">Calculando…</p></div></div>`;
}
function detPedHTML(p, D, M){
  const ro_ = esIng() ? '' : 'disabled', opt = (v, t, cur) => `<option value="${esc(v)}" ${String(cur) === String(v) ? 'selected' : ''}>${esc(t)}</option>`;
  return `<div class="card"><div class="ct">${esc(p.nom)} · pedestal${esIng() ? '<button class="btn sm danger" type="button" id="cBorrar">Borrar</button>' : ''}</div>
    <div class="fg g4">${fIn(p,'nom','Nombre',{num:false})}${fIn(p,'desc','Descripción',{num:false,cls:'span2'})}<div class="f"><label>Zapata (para el anclaje)</label><select data-a="zap" ${ro_}>${opt('','—',p.zap)}${D.zap.map(z => opt(z.id, z.nom, p.zap)).join('')}</select></div></div>
    ${nudosHTML(p, M)}
    <h4 class="sub">Sección y materiales</h4>
    <div class="fg g4">${fIn(p,'b','b (dirección x) [mm]')}${fIn(p,'h','h (dirección y) [mm]')}${fIn(p,'Hp','Altura Hp [m]')}${fIn(p,'rec','Recubrimiento [mm]')}</div>
    <div class="fg g4">${fIn(p,'fc',"f'c [MPa]")}${fIn(p,'fy','fy [MPa]')}${fIn(p,'k','k (esbeltez)',{h:'2.0 = voladizo'})}</div>
    <h4 class="sub">Refuerzo</h4>
    <div class="fg g4"><div class="f"><label>Barra longitudinal</label><select data-a="bar" ${ro_}>${BAR_OPC(p.bar)}</select></div>${fIn(p,'nx','Barras por cara en x (con esquinas)')}${fIn(p,'ny','Barras por cara en y (con esquinas)')}</div>
    <div class="fg g4"><div class="f"><label>Estribo</label><select data-a="est" ${ro_}>${BAR_OPC(p.est)}</select></div>${fIn(p,'ramasX','Ramas paralelas a x')}${fIn(p,'ramasY','Ramas paralelas a y')}</div>
    <div class="fg g4">${fIn(p,'sConf','Separación en Lo [mm]')}${fIn(p,'sFuera','Separación fuera de Lo [mm]')}</div>
    <div class="ped-vista" id="pVista"></div>
    <div id="cRes" style="margin-top:12px"><p class="muted">Calculando…</p></div></div>`;
}

// Datos efectivos de la zapata (con el pedestal enlazado)
function zapEf(z, D){ const p = D.ped.find(x => x.id === z.ped); return p ? { ...z, bx:num0(p.b)/1000, by:num0(p.h)/1000, Hp:p.Hp } : z; }
function pedEf(p, D){ const z = D.zap.find(x => x.id === p.zap); return z ? { ...p, hz:num0(z.h)*1000, recZ:num0(z.rec)*1000, barZ:z.barX } : p; }
const num0 = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };

function calcCim(el, tipo, D, R){
  const M = S.m.anexos?.C?.modelo, c = combosD(D, M);
  const fr = filasReac(R, el.nudos, c.res), fs = filasReac(R, el.nudos, c.serv);
  const X = tipo === 'zap' ? Concreto.zapata(zapEf(el, D), fs, fr) : Concreto.pedestal(pedEf(el, D), fr);
  el.res = X.ok ? { ok:true, ratio:+X.ratio.toFixed(3), cumple:X.cumple, fecha:new Date().toISOString() } : { ok:false, error:X.error };
  return X;
}
async function pintarResCim(el, tipo, D){
  let R = null; try{ R = await reacModelo(); }catch(e){ console.warn(e); }
  const box = $('#cRes'); if(!box) return;
  if(!R){ box.innerHTML = '<div class="note amber">Sin reacciones del modelo.</div>'; return; }
  if(!el.nudos.length){ box.innerHTML = '<div class="note amber">Escoge los nudos de apoyo.</div>'; el.res = { ok:false, error:'sin nudos' }; return; }
  const X = calcCim(el, tipo, D, R);
  if(!X.ok){ box.innerHTML = `<div class="note amber">${esc(X.error)}</div>`; return; }
  box.innerHTML = tipo === 'zap' ? resZapHTML(X) : resPedHTML(X);
  if(tipo === 'ped' && $('#pVista')) $('#pVista').innerHTML = svgPedestal(X) + svgDiagrama(X);
  const lista = document.querySelector(`[data-selc="${el.id}"] .pill`); if(lista) lista.outerHTML = pillRes(el.res);
  pintarListo();
}
const barra3 = (r, col) => `<span class="bar-d"><i style="width:${Math.min(100, r*100)}%;background:${r > 1 ? '#dc2626' : r > 0.9 ? '#d97706' : '#10b981'}"></i></span> <b>${fx(r,3)}</b>`;
const okP = r => pill(r <= 1 ? 'ok' : 'no', r <= 1 ? 'Cumple' : 'No cumple');

function resZapHTML(X, imp){
  const k3 = v => fx(v/1e3, 2), m6 = v => fx(v/1e6, 2), s = X.serv, u = X.ult;
  const T = imp ? (cab, filas) => `<table class="ax-tb"><thead><tr>${cab.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${filas.map(r => `<tr>${r.map((c,i) => `<td class="${i?'c':''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>` : tabla;
  const rel = r => imp ? fx(r,3) : barra3(r), ok = r => imp ? (r <= 1 ? 'Cumple' : '<b>No cumple</b>') : okP(r);
  const filas = [
    ['Presión del suelo (servicio)', `q máx = ${fx(s.qmax,1)} kN/m²`, `qa = ${fx(X.qa,1)} kN/m²`, rel(s.rel), ok(s.rel), filaReacTxt(s.f)],
    ['Excentricidad dentro del núcleo', `6ex/B + 6ey/L = ${fx(6*s.ex/(X.B/1000) + 6*s.ey/(X.L/1000),3)}`, '≤ 1.00', '', s.nucleo ? (imp ? 'Cumple' : okP(0)) : (imp ? '<b>No cumple</b>' : okP(9)), ''],
    ['Cortante en una dirección, x (C.11.2)', `${k3(X.cx.Vu)} kN`, `${k3(X.cx.phiVc)} kN`, rel(X.cx.rel), ok(X.cx.rel), filaReacTxt(u.f)],
    ['Cortante en una dirección, y', `${k3(X.cy.Vu)} kN`, `${k3(X.cy.phiVc)} kN`, rel(X.cy.rel), ok(X.cy.rel), ''],
    [`Punzonamiento (C.11.11.2.1, αs = ${X.punz.alfa})`, `${k3(X.punz.Vu)} kN`, `${k3(X.punz.phiVc)} kN`, rel(X.punz.rel), ok(X.punz.rel), ''],
    ['Flexión barras en x (C.15.4)', `${m6(X.fx.Mu)} kN·m`, `${m6(X.fx.phiMn)} kN·m`, rel(X.fx.rel), ok(X.fx.rel), `rige ${X.fx.rigeM}`],
    ['Flexión barras en y', `${m6(X.fy.Mu)} kN·m`, `${m6(X.fy.phiMn)} kN·m`, rel(X.fy.rel), ok(X.fy.rel), `rige ${X.fy.rigeM}`],
    ['Aplastamiento (C.10.14)', `${k3(X.apl.Pu)} kN`, `${k3(X.apl.phiBn)} kN`, rel(X.apl.rel), ok(X.apl.rel), ''],
  ];
  const ref = f => `${f.n} barras Ø ${fx(f.db,1)} mm c/ ${fx(f.s,0)} mm (As = ${fx(f.As,0)} mm², rige ${f.rige}) · anclaje: ${f.anclaje} (Ld ${fx(f.ld,0)}, gancho ${fx(f.ldh,0)}, disponible ${fx(f.disp,0)} mm)`;
  return `${T(['Chequeo','Demanda','Capacidad','Relación','','Combinación que controla'], filas)}
    ${imp ? `<div class="ax-box">Relación máxima = ${fx(X.ratio,3)} — ${X.cumple ? 'CUMPLE' : 'NO CUMPLE'}</div>` : `<div class="wtot" style="background:${X.cumple ? '' : '#b91c1c'}"><span>Relación máxima</span><span>${fx(X.ratio,3)} — ${X.cumple ? 'CUMPLE' : 'NO CUMPLE'}</span></div>`}
    <h4 class="sub">Refuerzo</h4><p style="margin:4px 0">Barras en x: ${ref(X.fx)}<br/>Barras en y: ${ref(X.fy)}</p>
    ${!X.fx.anclOk || !X.fy.anclOk ? `<div class="${imp ? 'ax-nota' : 'note amber'}">El gancho no cabe en el voladizo disponible: aumenta la zapata o usa una barra menor.</div>` : ''}
    ${imp ? '' : '<details class="d-opc" style="margin-top:10px"><summary>Ver cálculo detallado</summary>'}${detZapCalc(X, imp)}${imp ? '' : '</details>'}`;
}
function detZapCalc(X, imp){
  const kv = filas => imp ? `<table class="ax-kv">${filas.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>` : tabla(['', ''], filas);
  const s = X.serv, u = X.ult, p = X.pesos;
  return `<h4 class="sub">Cargas y presiones</h4>${kv([
    ['Área A = B·L', fx(X.A,3) + ' m²'], ['Pesos: zapata · pedestal · relleno · sobre el terreno', `${fx(p.Wz,2)} · ${fx(p.Wp,2)} · ${fx(p.Ws,2)} · ${fx(p.Wq,2)} kN`],
    ['Servicio: P total · Mx · My (incluye V·(Hp + h) y la excentricidad del pedestal)', `${fx(s.P,2)} kN · ${fx(s.Mx,2)} · ${fx(s.My,2)} kN·m`],
    ['q = P/A·(1 ± 6ex/B ± 6ey/L)', `máx ${fx(s.qmax,1)} · mín ${fx(s.qmin,1)} kN/m²`],
    ['Resistencia: Pu · Mux · Muy', `${fx(u.P,2)} kN · ${fx(u.Mx,2)} · ${fx(u.My,2)} kN·m`], ['Presión última neta máxima qu', fx(u.qu,1) + ' kN/m²']])}
    <h4 class="sub">Cortante y punzonamiento</h4>${kv([
    ['d en x · d en y (capa inferior / superior)', `${fx(X.dx,1)} · ${fx(X.dy,1)} mm`], ['Voladizos desde la cara del pedestal x · y', `${fx(X.vx,0)} · ${fx(X.vy,0)} mm`],
    ['φVc = 0.75·0.17·√f\'c·b·d', `x: ${fx(X.cx.phiVc/1e3,2)} · y: ${fx(X.cy.phiVc/1e3,2)} kN`],
    ['Perímetro crítico bo · β', `${fx(X.punz.bo,0)} mm · ${fx(X.punz.beta,2)}`],
    ['vc = mín(0.17(1+2/β)√f\'c ; 0.083(αs·d/bo+2)√f\'c ; 0.33√f\'c)', `${fx(X.punz.vc1,3)} · ${fx(X.punz.vc2,3)} · ${fx(X.punz.vc3,3)} → ${fx(X.punz.vc,3)} MPa`],
    ['φVc = 0.75·vc·bo·d', fx(X.punz.phiVc/1e3,2) + ' kN']])}
    <h4 class="sub">Flexión y anclaje</h4>${kv([
    ['Mu método clásico x · y = qu·b·v²/2', `${fx(X.fx.Mcl/1e6,2)} · ${fx(X.fy.Mcl/1e6,2)} kN·m`], ['Mu del modelo × ancho x · y', `${fx(X.fx.Mmo/1e6,2)} · ${fx(X.fy.Mmo/1e6,2)} kN·m`],
    ['As requerido · As mín = 0.0018·b·h (x)', `${fx(X.fx.Asreq,0)} · ${fx(X.fx.Asmin,0)} mm²`], ['As requerido · As mín (y)', `${fx(X.fy.Asreq,0)} · ${fx(X.fy.Asmin,0)} mm²`],
    ['s máx = mín(3h ; 450)', fx(X.fx.smax,0) + ' mm'], ['εt (x · y)', `${fx(X.fx.et,4)} · ${fx(X.fy.et,4)} (≥ 0.005 controla tensión)`],
    ['Ld = fy·ψt·ψe/(2.1·λ·√f\'c)·db (C.12.2.2)', fx(X.fx.ld,0) + ' mm'], ['ldh = 0.24·ψe·fy/(λ·√f\'c)·db ≥ 8db, 150 (C.12.5)', fx(X.fx.ldh,0) + ' mm'],
    ['Aplastamiento: A1 · √(A2/A1) ≤ 2 · φBn = 0.65·0.85·f\'c·A1·√(A2/A1)', `${fx(X.apl.A1,0)} mm² · ${fx(X.apl.fac,2)} · ${fx(X.apl.phiBn/1e3,1)} kN`]])}`;
}

function resPedHTML(X, imp){
  const g = X.gob, v = X.gobV;
  const T = imp ? (cab, filas) => `<table class="ax-tb"><thead><tr>${cab.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${filas.map(r => `<tr>${r.map((c,i) => `<td class="${i?'c':''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>` : tabla;
  const rel = r => imp ? fx(r,3) : barra3(r), ok = b => imp ? (b ? 'Cumple' : '<b>No cumple</b>') : pill(b ? 'ok' : 'no', b ? 'Cumple' : 'No cumple');
  const filas = [
    [`Flexo-compresión (${g.met})`, `Pu ${fx(g.Pu/1e3,1)} kN · Mux ${fx(g.Mux/1e6,2)} · Muy ${fx(g.Muy/1e6,2)} kN·m`, `φMnx ${fx(g.mx/1e6,1)} · φMny ${fx(g.my/1e6,1)} kN·m`, rel(g.rel), ok(g.rel <= 1), filaReacTxt(g.f)],
    ['Cortante (C.11)', `Vx ${fx(v.Vx/1e3,2)} · Vy ${fx(v.Vy/1e3,2)} kN`, `φVc x ${fx(v.cx.phiVc/1e3,1)} · y ${fx(v.cy.phiVc/1e3,1)} kN`, rel(X.relV), ok(X.relV <= 1), filaReacTxt(v.f)],
    ['Esbeltez k·lu/r (C.10.10.1)', `x ${fx(X.esbX,1)} · y ${fx(X.esbY,1)}`, '≤ 22', '', ok(X.esbOk), ''],
    ['Separación en Lo (C.21.3.5)', `${fx(X.sConf,0)} mm`, `≤ ${fx(X.sConfMax,0)} mm`, '', X.sOk === null ? '—' : ok(X.sOk), `Lo = ${fx(X.Lo,0)} mm`],
    ['Separación fuera de Lo', `${fx(X.sFuera,0)} mm`, `≤ ${fx(X.sFueraMax,0)} mm`, '', X.sfOk === null ? '—' : ok(X.sfOk), ''],
    ['Anclaje en la zapata (C.15.8)', X.anc.disp > 0 ? `disponible ${fx(X.anc.disp,0)} mm` : 'sin zapata enlazada', `gancho ${fx(X.anc.ldh,0)} · compresión ${fx(X.anc.ldc,0)} mm`, '', X.anc.disp > 0 ? ok(X.anc.ok) : '—', ''],
  ];
  return `${T(['Chequeo','Demanda','Capacidad','Relación','','Combinación que controla'], filas)}
    ${imp ? `<div class="ax-box">Relación máxima = ${fx(X.ratio,3)} — ${X.cumple ? 'CUMPLE' : 'NO CUMPLE'}</div>` : `<div class="wtot" style="background:${X.cumple ? '' : '#b91c1c'}"><span>Relación máxima (${X.filas.length} combinaciones revisadas)</span><span>${fx(X.ratio,3)} — ${X.cumple ? 'CUMPLE' : 'NO CUMPLE'}</span></div>`}
    <p class="hint" style="margin-top:6px">Cuantía ρ = ${fx(X.rho*100,2)} % (informativa). Ast = ${fx(X.Ast,0)} mm² con ${X.bars.length} barras.</p>
    ${imp ? '' : '<details class="d-opc" style="margin-top:10px"><summary>Ver cálculo detallado</summary>'}${detPedCalc(X, imp)}${imp ? '' : '</details>'}`;
}
function detPedCalc(X, imp){
  const kv = filas => imp ? `<table class="ax-kv">${filas.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>` : tabla(['', ''], filas);
  return `<h4 class="sub">Flexo-compresión</h4>${kv([
    ['Po = 0.85·f\'c·(Ag − Ast) + fy·Ast', fx(X.dgx.Po/1e3,1) + ' kN'], ['φPn,máx = 0.80·φ·Po (φ = 0.65, estribos)', fx(X.dgx.phiPnMax/1e3,1) + ' kN'],
    ['β1 · φ variable 0.65–0.90 según εt (C.9.3.2)', `${fx(X.dgx.b1,3)}`], ['Momentos en la base = M + V·Hp', `Hp = ${fx(X.Hp,0)} mm`],
    ['Biaxial: si Pu ≥ 0.1·f\'c·Ag, Bresler 1/Pni = 1/Pnx + 1/Pny − 1/Po; si no, Mux/φMnx + Muy/φMny ≤ 1', `0.1·f'c·Ag = ${fx(0.1*X.fc*X.Ag/1e3,1)} kN`]])}
    <h4 class="sub">Cortante</h4>${kv([
    ['d en x · d en y = dim − rec − estribo − db/2', `${fx(X.dX,1)} · ${fx(X.dY,1)} mm`], ['Vc = 0.17·(1 + Nu/14Ag)·λ·√f\'c·bw·d', `x ${fx(X.gobV.cx.Vc/1e3,1)} · y ${fx(X.gobV.cy.Vc/1e3,1)} kN`],
    ['Vs requerido (x · y)', `${fx(X.gobV.cx.Vs/1e3,2)} · ${fx(X.gobV.cy.Vs/1e3,2)} kN`], ['s máx por cortante (d/2 o d/4)', `${fx(X.gobV.cx.sMax,0)} · ${fx(X.gobV.cy.sMax,0)} mm`],
    ['Av,mín/s = máx(0.062√f\'c·bw/fy ; 0.35·bw/fy)', `${fx(X.gobV.cx.Avmin,3)} mm²/mm`]])}
    <h4 class="sub">Confinamiento (C.21.3.5)</h4>${kv([
    ['so = mín(8·db ; 16·d estribo ; dim/3 ; 150)', fx(X.so,1) + ' mm'], ['Lo = máx(Hp/6 ; dim mayor ; 500)', fx(X.Lo,0) + ' mm'],
    ['bc x · bc y · Ach = (b−2rec)(h−2rec)', `${fx(X.bcX,0)} · ${fx(X.bcY,0)} mm · ${fx(X.Ach,0)} mm²`],
    ['Ash/s = máx(0.2·bc·f\'c/fyt·(Ag/Ach − 1) ; 0.06·bc·f\'c/fyt)', `${fx(X.ashX,3)} · ${fx(X.ashY,3)} mm²/mm`],
    ['s por Ash (x · y) · s máx en Lo', `${fx(X.sAshX,1)} · ${fx(X.sAshY,1)} · ${fx(X.sConfMax,1)} mm`], ['s máx fuera de Lo = mín(d/2 ; 16db ; 48 d estribo ; dim)', fx(X.sFueraMax,1) + ' mm']])}`;
}
// Sección del pedestal y diagrama P–M (SVG, sirve en pantalla y en el PDF)
function svgPedestal(X){
  const W = 170, s = 130/Math.max(X.b, X.h), w = X.b*s, h = X.h*s, x0 = (W - w)/2, y0 = 18;
  return `<svg viewBox="0 0 ${W} ${h + 40}" class="ped-svg" role="img" aria-label="Sección del pedestal"><rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#e5e7eb" stroke="#475569"/>
    <rect x="${x0 + X.rec*s}" y="${y0 + X.rec*s}" width="${w - 2*X.rec*s}" height="${h - 2*X.rec*s}" fill="none" stroke="#1d4ed8" stroke-dasharray="3 2"/>
    ${X.bars.map(r => `<circle cx="${x0 + r.x*s}" cy="${y0 + (X.h - r.y)*s}" r="${Math.max(2.5, X.db*s/2)}" fill="#111"/>`).join('')}
    <text x="${W/2}" y="12" text-anchor="middle" font-size="10">${X.b} × ${X.h} mm</text><text x="${W/2}" y="${y0 + h + 16}" text-anchor="middle" font-size="9">${X.bars.length} barras · ρ ${fx(X.rho*100,2)} %</text></svg>`;
}
function svgDiagrama(X){
  const W = 360, H = 230, x0 = 46, y0 = 12, w = W - x0 - 12, h = H - y0 - 30;
  const all = [...X.dgx.pts, ...X.dgy.pts], Mmax = Math.max(...all.map(p => p.phiMn), ...X.filas.map(f => Math.max(f.Mux, f.Muy)))*1.1 || 1;
  const Pmin = Math.min(...all.map(p => p.phiPn)), Pmax = Math.max(...all.map(p => p.phiPn))*1.05;
  const XM = m => x0 + m/Mmax*w, YP = p => y0 + h - (p - Pmin)/(Pmax - Pmin)*h;
  const linea = (dg, col) => `<path d="${dg.pts.map((p, i) => `${i ? 'L' : 'M'}${XM(p.phiMn).toFixed(1)},${YP(p.phiPn).toFixed(1)}`).join(' ')}" fill="none" stroke="${col}" stroke-width="2"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="ped-svg" role="img" aria-label="Diagrama de interacción"><g font-family="Segoe UI,system-ui,sans-serif" font-size="9">
    <line x1="${x0}" y1="${YP(0)}" x2="${x0 + w}" y2="${YP(0)}" stroke="#94a3b8"/><line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y0 + h}" stroke="#94a3b8"/>
    ${linea(X.dgx, '#1d4ed8')}${linea(X.dgy, '#059669')}
    ${X.filas.map(f => `<circle cx="${XM(f.Mux)}" cy="${YP(f.Pu)}" r="2.6" fill="#1d4ed8" opacity=".8"/><circle cx="${XM(f.Muy)}" cy="${YP(f.Pu)}" r="2.6" fill="#059669" opacity=".8"/>`).join('')}
    <text x="${x0 + w/2}" y="${H - 6}" text-anchor="middle">φMn [kN·m] — azul: alrededor de x · verde: alrededor de y · puntos: cargas</text>
    <text x="10" y="${y0 + h/2}" text-anchor="middle" transform="rotate(-90 10 ${y0 + h/2})">φPn [kN]</text>
    ${[0, 0.5, 1].map(t => `<text x="${XM(Mmax/1.1*t)}" y="${YP(0) + 11}" text-anchor="middle">${fx(Mmax/1.1*t/1e6,0)}</text>`).join('')}
    ${[Pmin, 0, Pmax/1.05].map(p => `<text x="${x0 - 4}" y="${YP(p) + 3}" text-anchor="end">${fx(p/1e3,0)}</text>`).join('')}</g></svg>`;
}

function activarCim(el, tipo, D, M){
  const re = () => { guardarMemoria(); pintarResCim(el, tipo, D); };
  $$('#cDet [data-a]').forEach(inp => inp.addEventListener(inp.type === 'checkbox' || inp.tagName === 'SELECT' ? 'change' : 'input', debounce(() => {
    setP(el, inp.dataset.a, inp.type === 'checkbox' ? inp.checked : inp.value);
    if(['pos','ped','zap','nom'].includes(inp.dataset.a)) { guardarMemoria(); paneAnexoD(); } else re();
  }, 350)));
  $$('#cDet [data-nudo]').forEach(i => i.onchange = () => { const s = new Set(el.nudos); i.checked ? s.add(i.dataset.nudo) : s.delete(i.dataset.nudo); el.nudos = [...s]; guardarMemoria(); paneAnexoD(); });
  if($('#cBorrar')) $('#cBorrar').onclick = () => { if(!confirm(`¿Borrar ${el.nom}?`)) return; const k = tipo === 'zap' ? 'zap' : 'ped'; D[k] = D[k].filter(x => x.id !== el.id); guardarMemoria(); paneAnexoD(); };
  if(tipo === 'zap'){
    const pintaImgs = async () => { const b = $('#zImgs'); if(!b) return; const us = await Promise.all((el.imgs || []).map(i => urlDe(i.path)));
      b.innerHTML = (el.imgs || []).map((im, i) => `<div class="expo-img"><img src="${esc(us[i] || '')}" alt=""/><input data-zin="${i}" value="${esc(im.nota || '')}" placeholder="Nota (p. ej. Momentos M11)" ${esIng() ? '' : 'disabled'}/>${esIng() ? `<button class="btn sm danger" type="button" data-zdel="${i}">✕</button>` : ''}</div>`).join('');
      $$('[data-zin]').forEach(x => x.oninput = () => { el.imgs[+x.dataset.zin].nota = x.value; guardarMemoria(); });
      $$('[data-zdel]').forEach(x => x.onclick = async () => { const im = el.imgs[+x.dataset.zdel]; await sb.storage.from(BUCKET).remove([im.path]); el.imgs.splice(+x.dataset.zdel, 1); guardarMemoria(); paneAnexoD(); }); };
    pintaImgs();
    if($('#zAddImg')) $('#zAddImg').onclick = async () => { const f = await elegirArchivo('image/*'); if(!f) return;
      try{ toast('Subiendo imagen…', 15000); const blob = await comprimir(f, { max:1600, type:'image/jpeg', q:0.85 }), path = `${S.m.id}/zapata-${el.id}-${Date.now().toString(36)}.jpg`;
        await subir(path, blob, 'image/jpeg'); el.imgs = el.imgs || []; el.imgs.push({ path, nota:'' }); guardarMemoria(); toast('Imagen guardada.'); paneAnexoD(); }catch(e){ err(e, 'No se pudo subir la imagen'); } };
  }
  pintarResCim(el, tipo, D);
}

// ═══ Impresión: secciones de concreto ═══
async function conPrintHTML(D, L){
  let R = null; try{ R = await reacModelo(); }catch(e){ console.warn(e); }
  if(!R || (!D.zap.length && !D.ped.length)) return '';
  const zs = D.zap.map(z => ({ z, X:calcCim(z, 'zap', D, R) })).filter(x => x.X.ok);
  const ps = D.ped.map(p => ({ p, X:calcCim(p, 'ped', D, R) })).filter(x => x.X.ok);
  const urls = {}; for(const { z } of zs) for(const im of z.imgs || []) urls[im.path] = await urlDe(im.path);
  const n = D.met.length ? 2 : 1;
  return `${zs.length ? `<section class="ax-cont"><h3>${L}-${n} Zapatas — NSR-10 Título C</h3>
    <p>Las zapatas se revisan con el método clásico: presión de contacto con las cargas de servicio frente a la capacidad admisible del suelo (incluye los pesos de la zapata, el pedestal y el relleno), y diseño del concreto con las reacciones mayoradas: cortante en una dirección, punzonamiento, flexión en la cara del pedestal, anclaje del refuerzo y aplastamiento.</p>
    ${zs.map(({ z, X }, i) => `<div class="ax-cont"><h4>${L}-${n}.${i+1} ${esc(z.nom)} — ${fx(X.B/1000,2)} × ${fx(X.L/1000,2)} × ${fx(X.h/1000,2)} m, pedestal ${z.pos} (nudos ${esc(z.nudos.join(', '))})</h4>
      <table class="ax-kv"><tr><td>f'c · fy · recubrimiento</td><td>${X.fc} MPa · ${esc(z.fy)} MPa · ${fx(X.rec,0)} mm</td></tr><tr><td>qa · γ suelo · Df</td><td>${fx(X.qa,1)} kN/m² · ${esc(z.gs)} kN/m³ · ${fx(X.Df/1000,2)} m</td></tr></table>
      ${resZapHTML(X, true)}
      ${(z.imgs || []).length ? `<div class="ax-mapas">${z.imgs.map(im => `<figure><img src="${esc(urls[im.path] || '')}" style="max-width:100%;max-height:2.6in" alt=""/><figcaption>${esc(im.nota || 'Modelo de la zapata')}</figcaption></figure>`).join('')}</div>` : ''}</div>`).join('')}</section>` : ''}
  ${ps.length ? `<section class="ax-cont"><h3>${L}-${n + (zs.length ? 1 : 0)} Pedestales — NSR-10 Título C</h3>
    <p>Los pedestales se revisan con las reacciones de cada combinación de resistencia (carga axial, momentos y cortantes que actúan al mismo tiempo), trasladando los momentos a la base. La flexo-compresión se verifica con el diagrama de interacción calculado por compatibilidad de deformaciones.</p>
    ${ps.map(({ p, X }, i) => `<div class="ax-cont"><h4>${L}-${n + (zs.length ? 1 : 0)}.${i+1} ${esc(p.nom)} — ${X.b} × ${X.h} mm, ${X.bars.length} barras de ${esc(p.bar)}, estribo ${esc(p.est)} (nudos ${esc(p.nudos.join(', '))})</h4>
      <div class="ax-mapas" style="grid-template-columns:1fr 2fr"><figure>${svgPedestal(X)}<figcaption>Sección</figcaption></figure><figure>${svgDiagrama(X)}<figcaption>Diagrama de interacción φPn–φMn</figcaption></figure></div>
      ${resPedHTML(X, true)}</div>`).join('')}</section>` : ''}`;
}
