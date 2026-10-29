/* ═══ Anexo D — pestañas de concreto: zapatas y pedestales (usa calc/concreto.js y las reacciones del modelo) ═══ */
'use strict';
let selZap = null, selPed = null, _reac = null;

const nuevoZap = n => ({ id:'z' + Date.now().toString(36) + n, nom:`Z-${n}`, desc:'', nudos:[], ped:'', pos:'centrada', B:1.2, L:1.2, h:0.4, bx:0.4, by:0.4, Hp:1.18, Df:1.5,
  qa:'', gs:18, qsup:0, fc:21, fy:420, rec:0.075, barX:'1/2"', barY:'1/2"', MmX:'', MmY:'', imgs:[], res:null });
// Texto del armado longitudinal: «4 Ø3/4" + 4 Ø5/8"» o «8 Ø5/8"»
function armadoTxt(p){ const nx = Math.max(2, Math.round(+p.nx || 3)), ny = Math.max(2, Math.round(+p.ny || 3)), nI = 2*(nx - 2) + 2*(ny - 2), e = p.barEsq || p.bar;
  return e === p.bar || !nI ? `${4 + nI} Ø${e}` : `4 Ø${e} + ${nI} Ø${p.bar}`; }
const armadoCorto = p => armadoTxt(p);
const nuevoPed = n => ({ id:'p' + Date.now().toString(36) + n, nom:`PD-${n}`, desc:'', nudos:[], b:400, h:400, Hp:1.18, rec:50, fc:21, fy:420, bar:'5/8"', nx:3, ny:3,
  est:'3/8"', ramasX:2, ramasY:2, sConf:100, sFuera:150, k:2, zap:'', res:null });

// Reacciones del modelo (descarga el .s2k una vez por sesión)
async function reacModelo(){
  const C = S.m.anexos?.C; if(!C?.modelo?.reac?.n || !C.archivo) return null;
  if(_reac?.clave === C.archivo.fecha) return _reac.R;
  const R = AnexoC.reacciones(await textoModelo(C)); _reac = { clave:C.archivo.fecha, R }; return R;
}
// Cargas escritas a mano en zapatas y pedestales (verificación puntual o sin reacciones del modelo; pedido de Amo 29-oct)
const usaManCim = el => !(S.m.anexos?.C?.modelo?.reac?.n) || el.cargas === 'manual';
const filasManCim = el => (el.man || []).map((r, i) => ({ j:'—', c:(r.n || '').trim() || `${r.tipo === 'res' ? 'Resistencia' : 'Servicio'} ${i + 1}`, tipo:r.tipo || 'serv',
  F1:num0(r.Vx), F2:num0(r.Vy), F3:num0(r.P), M1:num0(r.Mx), M2:num0(r.My), M3:0 }));
function cargasManCimHTML(el, M){
  const ro_ = esIng() ? '' : 'disabled';
  let h = M?.reac?.n ? `<label class="chk" style="margin:6px 0"><input type="checkbox" data-cman ${el.cargas === 'manual' ? 'checked' : ''} ${ro_}/> Escribir las cargas a mano (en vez de las reacciones del modelo)</label>` : '';
  if(!usaManCim(el)) return h;
  const rows = el.man || [], c = (i, k, w) => `<td><input data-mc="${i}|${k}" value="${esc(rows[i][k] ?? '')}" inputmode="decimal" style="width:${w || 70}px" ${ro_}/></td>`;
  return h + `<h4 class="sub">Cargas sobre ${esc(el.nom)} (escritas a mano)</h4><div class="ejes-box">${ejesCim()}</div>
    <div class="tw"><table class="t man-cim"><thead><tr><th>Tipo</th><th>Nombre</th><th>P (kN)</th><th>Vx (kN)</th><th>Vy (kN)</th><th>Mx (kN·m)</th><th>My (kN·m)</th><th></th></tr></thead><tbody>
    ${rows.map((r, i) => `<tr><td><select data-mc="${i}|tipo" ${ro_}><option value="serv" ${r.tipo !== 'res' ? 'selected' : ''}>Servicio</option><option value="res" ${r.tipo === 'res' ? 'selected' : ''}>Resistencia</option></select></td>
      <td><input data-mc="${i}|n" value="${esc(r.n || '')}" placeholder="Ej.: D + L" style="width:110px" ${ro_}/></td>${c(i, 'P')}${c(i, 'Vx')}${c(i, 'Vy')}${c(i, 'Mx')}${c(i, 'My')}
      <td>${esIng() ? `<button class="btn sm danger" type="button" data-mdel="${i}" aria-label="Quitar">✕</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="8" class="hint">Agrega al menos una carga de servicio y una de resistencia.</td></tr>'}</tbody></table></div>
    ${esIng() ? '<div class="nav-btns" style="margin-top:6px"><button class="btn sm" type="button" data-madd="serv">+ Carga de servicio</button><button class="btn sm" type="button" data-madd="res">+ Carga de resistencia (mayorada)</button></div>' : ''}
    <p class="hint">P = compresión sobre el apoyo (positiva). Vx y My actúan en la dirección x; Vy y Mx en la dirección y. Servicio = sin mayorar (presión sobre el suelo); resistencia = mayoradas (diseño del concreto).</p>`;
}
const combosD = (D, M) => ({ serv: D.cServ || M?.reac?.serv || [], res: D.cRes || M?.reac?.res || [] });
const filasReac = (R, nudos, casos) => !R ? [] : R.filas.filter(f => nudos.includes(f.j) && casos.includes(f.c));
const filaReacTxt = f => !f ? '' : `nudo ${esc(f.j)} · ${esc(f.c)}${f.step ? ' (' + esc(f.step) + ')' : ''}`;
const BAR_OPC = (cur, ro_) => Object.keys(Concreto.BARRAS).map(k => `<option value="${esc(k)}" ${cur === k ? 'selected' : ''}>${esc(k)}</option>`).join('');

// Barra superior común: combinaciones de servicio / resistencia para la cimentación
function combosCimHTML(D, M){
  const ro_ = esIng() ? '' : 'disabled', casos = M?.reac?.casos || [], c = combosD(D, M);
  if(!S.m.anexos?.C?.modelo) return '<div class="note blue">Sin modelo del software: escribe las cargas de servicio y de resistencia de cada elemento a mano.</div>';
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
  return `${lista.map(e => `<button type="button" class="d-el ${e.id === sel ? 'on' : ''}" data-selc="${e.id}"><span><b>${esc(e.nom)}</b> ${tipo === 'zap' ? `${fx(+e.B,2)}×${fx(+e.L,2)}×${fx(+e.h,2)} m · ${esc(e.pos)}` : `${esc(e.b)}×${esc(e.h)} mm · ${esc(armadoCorto(e))}`}
      <small>${e.nudos.length ? 'nudos ' + esc(e.nudos.join(', ')) : 'sin nudos'}</small></span>${pillRes(e.res)}</button>`).join('')}
    ${!lista.length ? '<p class="hint">Aún no hay elementos.</p>' : ''}`;
}

// ═══ Pestañas ═══
function paneConcreto(tipo, h){
  const D = datosD(), M = S.m.anexos?.C?.modelo, lista = tipo === 'zap' ? D.zap : D.ped;
  let sel = lista.find(e => e.id === (tipo === 'zap' ? selZap : selPed)) || lista[0];
  if(tipo === 'zap') selZap = sel?.id || null; else selPed = sel?.id || null;
  h += combosCimHTML(D, M) + `<div class="d-grid"><div class="d-lista">${listaCimHTML(lista, sel?.id, tipo)}
    ${esIng() ? `<button class="btn sm" type="button" id="cNuevo" style="width:100%;margin-top:6px">＋ Agregar ${tipo === 'zap' ? 'zapata' : 'pedestal'}</button>
      ${lista.length > 1 ? `<button class="btn sm" type="button" data-ordenar="${tipo}" style="width:100%;margin-top:6px">↓ Ordenar por nombre (menor a mayor)</button>` : ''}` : ''}</div>
    <div id="cDet">${sel ? (tipo === 'zap' ? detZapHTML(sel, D, M) : detPedHTML(sel, D, M)) : '<div class="card"><p class="muted">Agrega un elemento.</p></div>'}</div></div>`;
  pane(h); activarTabsD();
  $$('[data-selc]').forEach(b => b.onclick = () => { if(tipo === 'zap') selZap = b.dataset.selc; else selPed = b.dataset.selc; paneAnexoD(); });
  if(esIng()){
    $$('[data-cc]').forEach(i => i.onchange = () => { const c = combosD(D, M), k = i.dataset.cc, s = new Set(c[k]); i.checked ? s.add(i.value) : s.delete(i.value);
      if(k === 'serv') D.cServ = [...s]; else D.cRes = [...s]; guardarMemoria(); paneAnexoD(); });
    activarOrdenar(D);
    if(sel){
      $$('[data-mc]').forEach(i => i.onchange = () => { const [k, c] = i.dataset.mc.split('|'); sel.man[+k][c] = i.value; guardarMemoria(); paneAnexoD(); });
      $$('[data-madd]').forEach(b => b.onclick = () => { sel.man = sel.man || []; sel.man.push({ tipo:b.dataset.madd, n:'', P:'', Vx:'', Vy:'', Mx:'', My:'' }); guardarMemoria(); paneAnexoD(); });
      $$('[data-mdel]').forEach(b => b.onclick = () => { sel.man.splice(+b.dataset.mdel, 1); guardarMemoria(); paneAnexoD(); });
      if($('[data-cman]')) $('[data-cman]').onchange = e => { sel.cargas = e.target.checked ? 'manual' : ''; guardarMemoria(); paneAnexoD(); };
    }
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
    ${usaManCim(z) ? '' : nudosHTML(z, M)}${cargasManCimHTML(z, M)}
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
    ${usaManCim(p) ? '' : nudosHTML(p, M)}${cargasManCimHTML(p, M)}
    <h4 class="sub">Sección y materiales</h4>
    <div class="fg g4">${fIn(p,'b','b (dirección x) [mm]')}${fIn(p,'h','h (dirección y) [mm]')}${fIn(p,'Hp','Altura Hp [m]')}${fIn(p,'rec','Recubrimiento [mm]')}</div>
    <div class="fg g4">${fIn(p,'fc',"f'c [MPa]")}${fIn(p,'fy','fy [MPa]')}${fIn(p,'k','k (esbeltez)',{h:'2.0 = voladizo'})}</div>
    <h4 class="sub">Refuerzo</h4>
    <div class="fg g4"><div class="f"><label>Barra de esquina (4)</label><select data-a="barEsq" ${ro_}>${BAR_OPC(p.barEsq || p.bar)}</select></div><div class="f"><label>Barra intermedia</label><select data-a="bar" ${ro_}>${BAR_OPC(p.bar)}</select></div>${fIn(p,'nx','Barras por cara en x (con esquinas)')}${fIn(p,'ny','Barras por cara en y (con esquinas)')}</div>
    <div class="hint" style="margin-top:4px" id="pArmado">${esc(armadoTxt(p))}. Si escoges el mismo diámetro en las dos casillas, todas las barras quedan iguales.</div>
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
  const man = usaManCim(el), fm = man ? filasManCim(el) : null;
  const fr = man ? fm.filter(f => f.tipo === 'res') : filasReac(R, el.nudos, c.res), fs = man ? fm.filter(f => f.tipo === 'serv') : filasReac(R, el.nudos, c.serv);
  const obj = tipo === 'zap' ? zapEf(el, D) : pedEf(el, D);
  const X = tipo === 'zap' ? Concreto.zapata(obj, fs, fr) : Concreto.pedestal(obj, fr);
  if(X.ok) X._in = { obj, fs, fr };
  el.res = X.ok ? { ok:true, ratio:+X.ratio.toFixed(3), cumple:X.cumple, fecha:new Date().toISOString() } : { ok:false, error:X.error };
  return X;
}
async function pintarResCim(el, tipo, D){
  let R = null; try{ R = await reacModelo(); }catch(e){ console.warn(e); }
  const box = $('#cRes'); if(!box) return;
  const man = usaManCim(el);
  if(!man && !R){ box.innerHTML = '<div class="note amber">Sin reacciones del modelo.</div>'; return; }
  if(!man && !el.nudos.length){ box.innerHTML = '<div class="note amber">Escoge los nudos de apoyo.</div>'; el.res = { ok:false, error:'sin nudos' }; return; }
  const X = calcCim(el, tipo, D, R);
  if(!X.ok){ box.innerHTML = `<div class="note amber">${esc(X.error)}</div>`; return; }
  const sg = esIng() && typeof Sugerir !== 'undefined' ? (k => bulbHTML(tipo === 'zap' ? Sugerir.zapata(X._in.obj, X._in.fs, X._in.fr, k) : Sugerir.pedestal(X._in.obj, X._in.fr, k))) : null;
  box.innerHTML = tipo === 'zap' ? resZapHTML(X, false, sg) : resPedHTML(X, false, sg);
  if(tipo === 'ped' && $('#pVista')) $('#pVista').innerHTML = svgPedestal(X) + svgDiagrama(X);
  if(tipo === 'ped' && $('#pArmado')) $('#pArmado').textContent = armadoTxt(el) + '. Si escoges el mismo diámetro en las dos casillas, todas las barras quedan iguales.';
  const lista = document.querySelector(`[data-selc="${el.id}"] .pill`); if(lista) lista.outerHTML = pillRes(el.res);
  pintarListo();
}
const barra3 = (r, col) => `<span class="bar-d"><i style="width:${Math.min(100, r*100)}%;background:${r > 1 ? '#dc2626' : r > 0.9 ? '#d97706' : '#10b981'}"></i></span> <b>${fx(r,3)}</b>`;
const okP = r => pill(r <= 1 ? 'ok' : 'no', r <= 1 ? 'Cumple' : 'No cumple');

function resZapHTML(X, imp, sg){
  const bb = (k, falla) => !imp && sg && falla ? sg(k) : '';
  const k3 = v => fx(v/1e3, 2), m6 = v => fx(v/1e6, 2), s = X.serv, u = X.ult;
  const T = imp ? (cab, filas) => `<table class="ax-tb"><thead><tr>${cab.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${filas.map(r => `<tr>${r.map((c,i) => `<td class="${i?'c':''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>` : tabla;
  const rel = r => imp ? fx(r,3) : barra3(r), ok = r => imp ? (r <= 1 ? 'Cumple' : '<b>No cumple</b>') : okP(r);
  const filas = [
    ['Presión del suelo (servicio)', `q máx = ${fx(s.qmax,1)} kN/m²`, `qa = ${fx(X.qa,1)} kN/m²`, rel(s.rel), ok(s.rel) + bb('suelo', s.rel > 1), filaReacTxt(s.f)],
    ['Excentricidad dentro del núcleo', `6ex/B + 6ey/L = ${fx(6*s.ex/(X.B/1000) + 6*s.ey/(X.L/1000),3)}`, '≤ 1.00', '', s.nucleo ? (imp ? 'Cumple' : okP(0)) : (imp ? '<b>No cumple</b>' : okP(9) + bb('nucleo', true)), ''],
    ['Cortante en una dirección, x (C.11.2)', `${k3(X.cx.Vu)} kN`, `${k3(X.cx.phiVc)} kN`, rel(X.cx.rel), ok(X.cx.rel) + bb('corteX', X.cx.rel > 1), filaReacTxt(u.f)],
    ['Cortante en una dirección, y', `${k3(X.cy.Vu)} kN`, `${k3(X.cy.phiVc)} kN`, rel(X.cy.rel), ok(X.cy.rel) + bb('corteY', X.cy.rel > 1), ''],
    [`Punzonamiento (C.11.11.2.1, αs = ${X.punz.alfa})`, `${k3(X.punz.Vu)} kN`, `${k3(X.punz.phiVc)} kN`, rel(X.punz.rel), ok(X.punz.rel) + bb('punz', X.punz.rel > 1), ''],
    ['Flexión barras en x (C.15.4)', `${m6(X.fx.Mu)} kN·m`, `${m6(X.fx.phiMn)} kN·m`, rel(X.fx.rel), ok(X.fx.rel) + bb('flexX', X.fx.rel > 1), `rige ${X.fx.rigeM}`],
    ['Flexión barras en y', `${m6(X.fy.Mu)} kN·m`, `${m6(X.fy.phiMn)} kN·m`, rel(X.fy.rel), ok(X.fy.rel) + bb('flexY', X.fy.rel > 1), `rige ${X.fy.rigeM}`],
    ['Aplastamiento (C.10.14)', `${k3(X.apl.Pu)} kN`, `${k3(X.apl.phiBn)} kN`, rel(X.apl.rel), ok(X.apl.rel) + bb('apl', X.apl.rel > 1), ''],
  ];
  const ref = f => `${f.n} barras Ø ${fx(f.db,1)} mm c/ ${fx(f.s,0)} mm (As = ${fx(f.As,0)} mm², rige ${f.rige}) · anclaje: ${f.anclaje} (Ld ${fx(f.ld,0)}, gancho ${fx(f.ldh,0)}, disponible ${fx(f.disp,0)} mm)`;
  return `${T(['Chequeo','Demanda','Capacidad','Relación','','Combinación que controla'], filas)}
    ${imp ? `<div class="ax-box">Relación máxima = ${fx(X.ratio,3)} — ${X.cumple ? 'CUMPLE' : 'NO CUMPLE'}</div>` : `<div class="wtot" style="background:${X.cumple ? '' : '#b91c1c'}"><span>Relación máxima</span><span>${fx(X.ratio,3)} — ${X.cumple ? 'CUMPLE' : 'NO CUMPLE'}</span></div>`}
    <h4 class="sub">Refuerzo</h4><p style="margin:4px 0">Barras en x: ${ref(X.fx)}<br/>Barras en y: ${ref(X.fy)}</p>
    ${!X.fx.anclOk || !X.fy.anclOk ? `<div class="${imp ? 'ax-nota' : 'note amber'}">El gancho no cabe en el voladizo disponible: aumenta la zapata o usa una barra menor. ${bb(X.fx.anclOk ? 'anclY' : 'anclX', true)}</div>` : ''}
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

function resPedHTML(X, imp, sg){
  const bb = (k, falla) => !imp && sg && falla ? sg(k) : '';
  const g = X.gob, v = X.gobV;
  const T = imp ? (cab, filas) => `<table class="ax-tb"><thead><tr>${cab.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${filas.map(r => `<tr>${r.map((c,i) => `<td class="${i?'c':''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>` : tabla;
  const rel = r => imp ? fx(r,3) : barra3(r), ok = b => imp ? (b ? 'Cumple' : '<b>No cumple</b>') : pill(b ? 'ok' : 'no', b ? 'Cumple' : 'No cumple');
  const filas = [
    [`Flexo-compresión (${g.met})`, `Pu ${fx(g.Pu/1e3,1)} kN · Mux ${fx(g.Mux/1e6,2)} · Muy ${fx(g.Muy/1e6,2)} kN·m`, `φMnx ${fx(g.mx/1e6,1)} · φMny ${fx(g.my/1e6,1)} kN·m`, rel(g.rel), ok(g.rel <= 1) + bb('pm', g.rel > 1), filaReacTxt(g.f)],
    ['Cortante (C.11)', `Vx ${fx(v.Vx/1e3,2)} · Vy ${fx(v.Vy/1e3,2)} kN`, `φVc x ${fx(v.cx.phiVc/1e3,1)} · y ${fx(v.cy.phiVc/1e3,1)} kN`, rel(X.relV), ok(X.relV <= 1) + bb('corte', X.relV > 1), filaReacTxt(v.f)],
    ['Cuantía mínima (C.10.9.1)', `ρ = ${fx(X.rho*100, X.rhoOk && X.rho < 0.01 ? 3 : 2)} % · Ast = ${fx(X.Ast,0)} mm²`, `≥ 1.00 % · ${fx(X.AstMin,0)} mm² (tolerancia 0.5 %)`, '', ok(X.rhoOk) + bb('rho', !X.rhoOk), `${X.bars.length} barras`],
    ['Esbeltez k·lu/r (C.10.10.1)', `x ${fx(X.esbX,1)} · y ${fx(X.esbY,1)}`, '≤ 22', '', ok(X.esbOk) + bb('esb', !X.esbOk), ''],
    ['Separación en Lo (C.21.3.5)', `${fx(X.sConf,0)} mm`, `≤ ${fx(X.sConfMax,0)} mm`, '', X.sOk === null ? '—' : ok(X.sOk) + bb('sConf', X.sOk === false), `Lo = ${fx(X.Lo,0)} mm`],
    ['Separación fuera de Lo', `${fx(X.sFuera,0)} mm`, `≤ ${fx(X.sFueraMax,0)} mm`, '', X.sfOk === null ? '—' : ok(X.sfOk) + bb('sFuera', X.sfOk === false), ''],
    ['Anclaje en la zapata (C.15.8)', X.anc.disp > 0 ? `disponible ${fx(X.anc.disp,0)} mm` : 'sin zapata enlazada', `gancho ${fx(X.anc.ldh,0)} · compresión ${fx(X.anc.ldc,0)} mm`, '', X.anc.disp > 0 ? ok(X.anc.ok) + bb('anc', !X.anc.ok) : '—', ''],
  ];
  return `${T(['Chequeo','Demanda','Capacidad','Relación','','Combinación que controla'], filas)}
    ${imp ? `<div class="ax-box">Relación máxima = ${fx(X.ratio,3)} — ${X.cumple ? 'CUMPLE' : 'NO CUMPLE'}</div>` : `<div class="wtot" style="background:${X.cumple ? '' : '#b91c1c'}"><span>Relación máxima (${X.filas.length} combinaciones revisadas)</span><span>${fx(X.ratio,3)} — ${X.cumple ? 'CUMPLE' : 'NO CUMPLE'}</span></div>`}
    ${X.rho > 0.04 ? `<p class="${imp ? 'ax-nota' : 'note amber'}" style="margin-top:6px">La cuantía ρ = ${fx(X.rho*100,2)} % pasa del máximo de 4 % (C.10.9.1).</p>` : ''}
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
  // Sección con barras, estribo perimetral y flejes en S (ramas adicionales a las 2 del estribo; pedido de Amo 29-oct)
  const W = 200, s = 140/Math.max(X.b, X.h), w = X.b*s, h = X.h*s, x0 = (W - w)/2, y0 = 18, az = '#1d4ed8';
  const px = x => x0 + x*s, py = y => y0 + (X.h - y)*s, rb = r => Math.max(2.5, r.db*s/2);
  const tol = 1, xs = X.bars.map(r => r.x), ys = X.bars.map(r => r.y), xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
  // filas intermedias disponibles: y de las barras de la cara izquierda (sin esquinas) y x de las barras de la cara inferior (sin esquinas)
  const yInt = [...new Set(X.bars.filter(r => Math.abs(r.x - xmin) < tol && r.y > ymin + tol && r.y < ymax - tol).map(r => +r.y.toFixed(1)))].sort((a, b) => a - b);
  const xInt = [...new Set(X.bars.filter(r => Math.abs(r.y - ymin) < tol && r.x > xmin + tol && r.x < xmax - tol).map(r => +r.x.toFixed(1)))].sort((a, b) => a - b);
  // Posiciones simétricas respecto al centro (pedido de Amo 29-oct: configuración equilibrada)
  const escoger = (lst, n) => { if(n <= 0 || !lst.length) return []; if(n >= lst.length) return lst; const o = []; for(let k = 1; k <= n; k++) o.push(lst[Math.round(k*(lst.length + 1)/(n + 1)) - 1] ?? lst[lst.length - 1]); return [...new Set(o)]; };
  const simetrico = (sel, lst, c) => sel.every(v => lst.some(u => Math.abs((2*c - v) - u) < tol) && sel.some(u => Math.abs((2*c - v) - u) < tol));
  // Ramas adicionales en cada dirección (pedido de Amo 29-oct): cada par = un estribo cerrado interior (rectangular) que abraza barras
  // simétricas de las caras opuestas; si sobra una rama, un fleje en S en el centro. Todo simétrico para no correr el centro.
  const exX = Math.max(0, Math.round(X.rx || 2) - 2), exY = Math.max(0, Math.round(X.ry || 2) - 2);
  const plan = (ext, lst) => { const nh = Math.floor(ext/2), pos = escoger(lst, 2*nh), pares = [];
    for(let i = 0; i < Math.floor(pos.length/2); i++) pares.push([pos[i], pos[pos.length - 1 - i]]);
    const lib = lst.filter(v => !pos.includes(v)), sS = ext % 2 ? escoger(lib, 1) : [];
    return { pares, sS, faltan: ext - 2*pares.length - sS.length }; };
  const PX = plan(exX, yInt), PY = plan(exY, xInt);   // ramas paralelas a x → piezas horizontales sobre las filas yInt
  const yH = PX.sS, xV = PY.sS, faltan = PX.faltan + PY.faltan, nRect = PX.pares.length + PY.pares.length;
  const cx = (xmin + xmax)/2, cy = (ymin + ymax)/2;
  const desbal = !simetrico([...PX.pares.flat(), ...yH], [...PX.pares.flat(), ...yH], cy) || !simetrico([...PY.pares.flat(), ...xV], [...PY.pares.flat(), ...xV], cx);
  const e = Math.max(4, X.bars[0] ? rb(X.bars[0]) + 2 : 4);
  // fleje en S: gancho hacia arriba en un extremo y hacia abajo en el otro
  const sH = y => { const a = px(xmin) - e, b = px(xmax) + e, yy = py(y); return `<path d="M${a + 6},${yy - 5} Q${a - 2},${yy - 6} ${a},${yy} L${b},${yy} Q${b + 2},${yy + 6} ${b - 6},${yy + 5}" fill="none" stroke="${az}" stroke-width="1.6"/>`; };
  const sV = x => { const a = py(ymin) + e, b = py(ymax) - e, xx = px(x); return `<path d="M${xx - 5},${a - 6} Q${xx - 6},${a + 2} ${xx},${a} L${xx},${b} Q${xx + 6},${b - 2} ${xx + 5},${b + 6}" fill="none" stroke="${az}" stroke-width="1.6"/>`; };
  // estribo interior: rectángulo por fuera de las barras que abraza
  const rectXY = (xa, xb, ya, yb, k) => { const g = e - 1 + k*1.8, X1 = px(xa) - g, X2 = px(xb) + g, Y1 = py(yb) - g, Y2 = py(ya) + g;
    return `<rect x="${X1}" y="${Y1}" width="${X2 - X1}" height="${Y2 - Y1}" rx="2" fill="none" stroke="${az}" stroke-width="1.5"/><path d="M${X1 + 2},${Y1 + 8} L${X1 + 8},${Y1 + 2}" stroke="${az}" stroke-width="1.2"/>`; };
  const rect = PX.pares.map(([a, b], k) => rectXY(xmin, xmax, Math.min(a, b), Math.max(a, b), k + 1)).join('')     // horizontales: de cara izquierda a derecha
    + PY.pares.map(([a, b], k) => rectXY(Math.min(a, b), Math.max(a, b), ymin, ymax, k + 1)).join('');                // verticales: de cara inferior a superior
  const re = X.rec*s, ex = x0 + re, ey = y0 + re, ew = w - 2*re, eh = h - 2*re;
  const nIs = yH.length + xV.length, pz = [nRect ? `${nRect} estribo${nRect > 1 ? 's' : ''} interior${nRect > 1 ? 'es' : ''}` : '', nIs ? `${nIs} fleje${nIs > 1 ? 's' : ''} en S` : ''].filter(Boolean).join(' + ');
  return `<svg viewBox="0 0 ${W} ${h + 72}" class="ped-svg" role="img" aria-label="Sección del pedestal con refuerzo"><rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#e5e7eb" stroke="#475569"/>${ejesMini(Math.max(4, x0 - 30), y0 + h, 'x', 'y', 18)}
    <rect x="${ex}" y="${ey}" width="${ew}" height="${eh}" rx="3" fill="none" stroke="${az}" stroke-width="1.6"/>
    <path d="M${ex + 3},${ey + 12} L${ex + 12},${ey + 3} M${ex + 7},${ey + 14} L${ex + 14},${ey + 7}" stroke="${az}" stroke-width="1.4"/>
    ${rect}${yH.map(sH).join('')}${xV.map(sV).join('')}
    ${X.bars.map(r => `<circle cx="${px(r.x)}" cy="${py(r.y)}" r="${rb(r)}" fill="${X.dos && !r.esq ? '#c2410c' : '#111'}"/>`).join('')}
    <text x="${W/2}" y="12" text-anchor="middle" font-size="10">${X.b} × ${X.h} mm</text>
    <text x="${W/2}" y="${y0 + h + 15}" text-anchor="middle" font-size="9">${X.dos ? `4 Ø${X.nomE} + ${X.nI} Ø${X.nomI}` : `${X.bars.length} Ø${X.nomI}`} · ρ ${fx(X.rho*100,2)} %</text>
    <text x="${W/2}" y="${y0 + h + 27}" text-anchor="middle" font-size="8.5" fill="${az}">E Ø${X.est || ''} · ramas: ${Math.round(X.rx || 2)} en x, ${Math.round(X.ry || 2)} en y</text>
    ${pz ? `<text x="${W/2}" y="${y0 + h + 38}" text-anchor="middle" font-size="8" fill="${az}">perimetral + ${pz}</text>` : ''}
    ${faltan > 0 ? `<text x="${W/2}" y="${y0 + h + 49}" text-anchor="middle" font-size="7.5" fill="#b91c1c">Faltan barras intermedias para ${faltan} rama${faltan > 1 ? 's' : ''}</text>`
      : desbal ? `<text x="${W/2}" y="${y0 + h + 49}" text-anchor="middle" font-size="7.5" fill="#b45309">No queda centrado: usa barras impares por cara</text>` : ''}</svg>`;
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
    if(['pos','ped','zap','nom','bar','barEsq'].includes(inp.dataset.a)) { guardarMemoria(); paneAnexoD(); } else re();
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
    ${ps.map(({ p, X }, i) => `<div class="ax-cont"><h4>${L}-${n + (zs.length ? 1 : 0)}.${i+1} ${esc(p.nom)} — ${X.b} × ${X.h} mm, ${esc(armadoTxt(p))}, estribo ${esc(p.est)} (nudos ${esc(p.nudos.join(', '))})</h4>
      <div class="ax-mapas" style="grid-template-columns:1fr 2fr"><figure>${svgPedestal(X)}<figcaption>Sección</figcaption></figure><figure>${svgDiagrama(X)}<figcaption>Diagrama de interacción φPn–φMn</figcaption></figure></div>
      ${resPedHTML(X, true)}</div>`).join('')}</section>` : ''}`;
}
