/* ═══ Revisión de cubierta (tipo de memoria 'revision', pedido de Amo 29-oct) ═══
   Una sola página que se llena de arriba a abajo en campo, como sus calculadoras: datos del proyecto, cubierta y cargas,
   viento B.6.5, correas (pestañas CR-1, CR-2…; metálicas o de madera) con botón «Calcular», registro fotográfico.
   Cálculo en calc/correas.js. Datos en anexos.R. Impresión: portada de la app + memoria con rótulo y «X / Y» (márgenes de @page). */

function datosR(){
  const a = S.m.anexos = S.m.anexos || {}, d = Correas.defaults();
  const R = a.R = a.R || d;
  for(const k of Object.keys(d)) if(R[k] === undefined) R[k] = d[k];
  R.viento = { ...d.viento, ...R.viento }; R.cub = { ...d.cub, ...R.cub }; R.cielo = { ...d.cielo, ...R.cielo };
  const bib = S.cfg.biblioteca || {};
  if(!R.panel && bib.paneles?.length) R.panel = { ...bib.paneles[0] };
  if(!R.riel && bib.rieles?.length) R.riel = { ...bib.rieles[0] };
  if(!R.correas.length) R.correas.push(Correas.nuevaCorrea('met', 1));
  if(!R.correas.some(c => c.id === R.activa)) R.activa = R.correas[0].id;
  return R;
}
const ctxR = R => ({ AnexoA, area:Correas.cargasArea(R, AnexoA, S.cfg.biblioteca), g:Correas.geomViento(R.viento) });
const huellaCor = (R, c) => JSON.stringify([{ ...R, correas:0, fotos:0, obs:0, activa:0 }, { ...c, res:0, huella:0, nom:0, desc:0 }]);
const fR = (x, d = 2) => Correas.fmt(x, d);
const nomSecCor = c => c.mat === 'mad' ? `Madera ${c.grupo} ${Correas.num(c.b)} × ${Correas.num(c.d)} mm`
  : c.sec === 'HSS' ? `Tubo ${Correas.num(c.H)} × ${Correas.num(c.B)} × ${Correas.num(c.tH)} mm` : `Ángulo L ${Correas.num(c.b)} × ${Correas.num(c.t)} mm`;

// ─── Dibujo de la sección ───
function svgSecCorrea(c, imp){
  const az = imp ? '#1f3a60' : '#1a56db', fill = imp ? '#e8eef7' : '#dbeafe', W = 170, H = 150;
  const cota = (x1, y1, x2, y2, t, vert) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#64748b" stroke-width="1"/><text x="${vert ? x1 - 6 : (x1 + x2) / 2}" y="${vert ? (y1 + y2) / 2 : y1 + 12}" font-size="10" fill="#334155" text-anchor="middle" ${vert ? `transform="rotate(-90 ${x1 - 6} ${(y1 + y2) / 2})"` : ''}>${t}</text>`;
  let g = '';
  if(c.mat === 'mad'){
    const b = Correas.num(c.b), d = Correas.num(c.d), s = 110 / Math.max(b, d, 1), w = b * s, h = d * s, x = (W - w) / 2, y = 15;
    g = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f5e6d0" stroke="#7c4a12" stroke-width="1.5"/>${[0.25, 0.5, 0.75].map(k => `<line x1="${x + 3}" y1="${y + h * k}" x2="${x + w - 3}" y2="${y + h * k + 4}" stroke="#c49a6c" stroke-width=".7"/>`).join('')}
      ${cota(x, y + h + 8, x + w, y + h + 8, `b = ${b}`)}${cota(x - 8, y, x - 8, y + h, `d = ${d}`, true)}`;
  } else if(c.sec === 'HSS'){
    const Hh = Correas.num(c.H), B = Correas.num(c.B), t = Correas.num(c.tH), s = 110 / Math.max(Hh, B, 1), w = B * s, h = Hh * s, x = (W - w) / 2, y = 15, tt = Math.max(1.5, t * s);
    g = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${fill}" stroke="${az}" stroke-width="1.5"/><rect x="${x + tt}" y="${y + tt}" width="${Math.max(0, w - 2 * tt)}" height="${Math.max(0, h - 2 * tt)}" rx="2" fill="#fff" stroke="${az}" stroke-width="1"/>
      ${cota(x, y + h + 8, x + w, y + h + 8, `B = ${B}`)}${cota(x - 8, y, x - 8, y + h, `H = ${Hh}`, true)}<text x="${x + w + 4}" y="${y + 10}" font-size="10" fill="#334155">t = ${t}</text>`;
  } else {
    const b = Correas.num(c.b), t = Correas.num(c.t), s = 110 / Math.max(b, 1), L = b * s, tt = Math.max(2, t * s), x = (W - L) / 2, y = 20;
    g = `<path d="M${x},${y} H${x + L} V${y + tt} H${x + tt} V${y + L} H${x} Z" fill="${fill}" stroke="${az}" stroke-width="1.5"/>
      ${cota(x, y - 8, x + L, y - 8, `b = ${b}`).replace(`y="${y - 8 + 12}"`, `y="${y - 11}"`)}${cota(x - 8, y, x - 8, y + L, `b = ${b}`, true)}<text x="${x + tt + 4}" y="${y + tt + 12}" font-size="10" fill="#334155">t = ${t}</text>
      <text x="${x + L - 2}" y="${y + tt + 24}" font-size="9" fill="#64748b" text-anchor="end">ala sobre la cubierta</text>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" class="rv-sec" role="img" aria-label="Sección de la correa">${g}</svg>`;
}

// ─── Página ───
function renderRevision(){
  const m = S.m, R = datosR(), F = m.ficha, ro = esIng() ? '' : 'disabled', ctx = ctxR(R);
  const cor = R.correas.find(c => c.id === R.activa);
  const inpF = (k, l, ph = '') => `<div class="f"><label>${l}</label><input data-fk="${k}" value="${esc(F[k] || '')}" placeholder="${esc(ph)}" ${ro}/></div>`;
  const inpR = (p, l, o = {}) => `<div class="f ${o.cls || ''}"><label>${l}</label><input data-rv="${p}" ${o.n ? 'inputmode="decimal"' : ''} value="${esc(rvGet(R, p) ?? '')}" placeholder="${esc(o.ph || '')}" ${ro}/>${o.h ? `<div class="hint">${o.h}</div>` : ''}</div>`;
  const selR = (p, l, ops, o = {}) => `<div class="f"><label>${l}</label><select data-rv="${p}" ${ro}>${ops.map(([v, t]) => `<option value="${esc(v)}" ${String(rvGet(R, p)) === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>${o.h ? `<div class="hint">${o.h}</div>` : ''}</div>`;
  const chkR = (p, l) => `<label class="chk"><input type="checkbox" data-rv="${p}" ${rvGet(R, p) ? 'checked' : ''} ${ro}/> ${l}</label>`;
  const bib = S.cfg.biblioteca || {}, L = AnexoA.LAMINAS[R.cub.perfil];
  const th = ctx.g.ok ? ctx.g.theta : null;
  $('#app').innerHTML = `
  <div style="margin-bottom:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn sm" type="button" id="back">← Memorias</button>
    <span class="hint"><b>${esc(m.consecutivo)}</b> · ${esc(m.titulo || '')}</span>${m.variante_de || m.variante_nom ? `<span class="vchip">⧉ ${esc(m.variante_nom || 'Variante')}${m.definitiva !== false ? ' ★' : ''}</span>` : ''}
    <span class="sp" style="flex:1"></span><span class="saved" id="saved"></span>
    ${esIng() ? '<button class="btn sm" type="button" id="btnHist">🕘 Historial</button>' : ''}<button class="btn sm" type="button" id="rvFicha" title="Datos completos de la portada y control de revisiones">📋 Portada y revisiones</button><button class="btn sm pri" type="button" id="rvImp">🖨 Imprimir memoria</button></div>
  <div class="main-hd"><div><div class="hint" style="font-weight:700;text-transform:uppercase;letter-spacing:1px">Revisión de cubierta · ${pill(...(ESTADOS[m.estado] || ESTADOS.wip))}</div><h2>Verificación de correas — NSR-10</h2></div></div>

  <div class="card"><div class="ct">Datos del proyecto</div>
    <div class="fg g3">${inpF('proyecto', 'Proyecto', 'Ej.: Revisión cubierta Casa López')}${inpF('prop', 'Propietario / cliente')}${inpF('doc', 'Identificación (NIT / C.C.)')}
      ${inpF('dir', 'Dirección / predio')}${inpF('mun', 'Municipio')}${inpF('depto', 'Departamento')}</div>
    <div class="hint">La portada (sin imagen), el consecutivo, el ingeniero y la firma se llenan solos. Los demás datos de la portada (contacto, matrícula, predial) y el control de revisiones están en «📋 Portada y revisiones».</div></div>

  <div class="card"><div class="ct"><span>① Cubierta y cargas — NSR-10 Título B</span></div>
    <div class="fg g4">${selR('cub.perfil', 'Material de la cubierta', Object.entries(AnexoA.LAMINAS).map(([k, v]) => [k, v.nombre]))}
      ${L?.calibres ? selR('cub.calibre', 'Calibre', Object.keys(L.calibres).map(k => [k, `Cal. ${k}`])) : ''}
      ${inpR('cub.wManual', 'Peso manual (kg/m²)', { n:1, ph:'vacío = de tabla' })}
      ${inpR('otras', 'Otras cargas permanentes (kg/m²)', { n:1, ph:'0' })}</div>
    <div style="margin:4px 0 8px">${chkR('cielo.aplica', 'Tiene cielo raso colgado de las correas')}</div>
    ${R.cielo.aplica ? `<div class="fg g4">${selR('cielo.tipo', 'Tipo de cielo raso', Object.keys(AnexoA.CIELOS).map(k => [k, `${k} — ${AnexoA.CIELOS[k]} kg/m²`]))}${inpR('cielo.w', 'Peso (kg/m²)', { n:1 })}</div>` : ''}
    <div style="margin:4px 0 8px">${chkR('paneles', 'La cubierta lleva paneles solares')}</div>
    ${R.paneles ? `<div class="fg g4"><div class="f"><label>Panel solar</label><select id="rvPanel" ${ro}>${(bib.paneles || []).map((p, i) => `<option value="${i}" ${p.nombre === R.panel?.nombre ? 'selected' : ''}>${esc(p.nombre)} — ${p.peso} kg</option>`).join('')}</select></div>
      <div class="f"><label>Riel de montaje</label><select id="rvRiel" ${ro}>${(bib.rieles || []).map((r, i) => `<option value="${i}" ${r.nombre === R.riel?.nombre ? 'selected' : ''}>${esc(r.nombre)} — ${r.peso} kg/m</option>`).join('')}</select></div>
      ${inpR('nRieles', 'Rieles por fila de paneles', { n:1 })}</div>` : ''}
    <div class="fg g4">${inpR('Lr', 'Carga viva de cubierta Lr (kN/m²)', { n:1, ph:th != null ? `mínimo ${Correas.LrMin(th)} (θ = ${fR(th, 1)}°)` : '0.50', h:'Tabla B.4.2.1-2: 0.50 kN/m² si θ ≤ 15°; 0.35 si θ > 15° (proyección horizontal).' })}</div>
    <div class="rv-strip" id="rvCargas">${cargasStrip(R, ctx)}</div></div>

  <div class="card"><div class="ct">② Viento — NSR-10 B.6.5 (componentes y revestimiento)</div>
    <div class="fg g4">${selR('viento.tipoEd', 'Tipo de edificación', [['cerrada', 'Edificación cerrada (GCpi ±0.18)'], ['parcial', 'Parcialmente cerrada (GCpi ±0.55)'], ['libre', 'Cubierta libre, sin muros']])}
      ${selR('viento.grupo', 'Grupo de uso', Object.entries(AnexoA.GRUPOS).map(([k, v]) => [k, v.nombre]))}
      ${selR('viento.V', 'Velocidad básica V (m/s)', AnexoA.VELOCIDADES.map(v => [v, `${v} m/s`]), { h:'Figura B.6.4-1' })}
      ${selR('viento.zona', 'Zona de cubierta (por defecto)', [['1', 'Zona 1 — interior'], ['2', 'Zona 2 — borde'], ['3', 'Zona 3 — esquina (la más desfavorable)']])}</div>
    <div class="fg g4">${inpR('viento.L', 'Largo de la edificación (m)', { n:1 })}${inpR('viento.W', 'Ancho en el sentido de la pendiente (m)', { n:1 })}${inpR('viento.He', 'Altura de cornisa (m)', { n:1 })}${inpR('viento.Hr', 'Altura de cumbrera (m)', { n:1 })}</div>
    <div class="fg g4">${selR('viento.rug', 'Rugosidad del terreno', [['B', 'B — urbana / suburbana'], ['C', 'C — abierta'], ['D', 'D — plana sin obstrucciones']])}
      ${inpR('viento.distRug', 'Distancia con esa rugosidad (m)', { n:1 })}
      ${selR('viento.expManual', 'Exposición', [['', 'Automática (B.6.5.6.3)'], ['B', 'B'], ['C', 'C'], ['D', 'D']])}</div>
    <div class="rv-strip" id="rvViento">${vientoStrip(R, ctx, cor)}</div></div>

  <div class="card"><div class="ct">③ Correas a verificar</div>
    <div class="rv-tabs" role="tablist">${R.correas.map(c => `<button type="button" role="tab" class="${c.id === R.activa ? 'on' : ''}" data-ctab="${c.id}">${esc(c.nom)} · ${esc(c.mat === 'mad' ? 'Madera' : c.sec === 'HSS' ? 'Tubo' : 'Ángulo')}${c.res && c.huella === huellaCor(R, c) ? ` <i class="${c.res.cumple ? 'ok' : 'no'}">${c.res.cumple ? '✓' : '✗'}</i>` : ''}</button>`).join('')}
      ${esIng() ? '<button type="button" class="add" data-cadd="met">+ Metálica</button><button type="button" class="add" data-cadd="mad">+ Madera</button>' : ''}</div>
    ${correaHTML(R, cor, ctx, ro)}</div>

  <div class="card"><div class="ct">④ Registro fotográfico</div>
    <div class="rv-fotos">${R.fotos.map((f, i) => `<figure><img data-foto="${esc(f.path)}" alt="Foto ${i + 1}"/><figcaption>Foto ${i + 1}. <input data-fnota="${i}" value="${esc(f.nota || '')}" placeholder="Descripción" ${ro}/></figcaption>${esIng() ? `<button class="btn sm danger" type="button" data-fdel="${i}" aria-label="Quitar foto ${i + 1}">Quitar</button>` : ''}</figure>`).join('')}</div>
    ${esIng() ? '<button class="btn" type="button" id="rvFotoAdd">📷 Tomar o subir fotos</button><div class="hint">Se reducen a 1600 px antes de subirlas.</div>' : ''}</div>

  <div class="card"><div class="ct">⑤ Conclusión (opcional)</div>
    <div class="f"><textarea data-rv="obs" rows="3" placeholder="Vacío = la app escribe la conclusión según los resultados de cada correa." ${ro}>${esc(R.obs || '')}</textarea></div></div>`;
  activarRevision(R);
}
const rvGet = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
const rvSet = (o, p, v) => { const ks = p.split('.'), last = ks.pop(); ks.reduce((a, k) => a[k] = a[k] || {}, o)[last] = v; };

function cargasStrip(R, ctx){
  const a = ctx.area;
  return `<b>Carga muerta por área:</b> ${a.items.map(i => `${esc(i.n)} ${fR(i.kg, 1)}`).join(' + ')} = <b>${fR(a.kg, 1)} kg/m² (${fR(a.qD, 3)} kN/m²)</b> · el peso propio de la correa se suma en cada una.`;
}
function vientoStrip(R, ctx, cor){
  if(!ctx.g.ok) return `<span class="no">Faltan datos para el viento: ${ctx.g.faltan.join(', ')}.</span>`;
  const w = cor ? Correas.vientoCorrea(R, AnexoA, Correas.num(cor.L), Correas.num(cor.s), cor.zona) : null;
  if(!w?.ok) return `θ = ${fR(ctx.g.theta, 1)}°, h media = ${fR(ctx.g.hm, 2)} m.`;
  return `θ = ${fR(ctx.g.theta, 1)}° · h = ${fR(w.g.hm, 2)} m · exposición ${w.ex.usada} · Kz = ${fR(w.Kz, 3)} · qh = ${fR(w.qh, 3)} kN/m²${w.tipo === 'libre' ? ` · CN ${fR(w.CNp, 2)} / ${fR(w.CNs, 2)}` : ` · GCp ${fR(w.GCpP, 2)} / ${fR(w.GCpN, 2)}, GCpi ±${w.GCpi}`}
    · para ${esc(cor.nom)} (zona ${w.zona}, área ${fR(w.Ae, 1)} m²): <b>presión ${fR(w.dPres, 3)} kN/m² · succión ${fR(w.dSucc, 3)} kN/m²</b>${w.dPres === w.pMin || w.dSucc === w.pMin ? ' (mínimo 0.40)' : ''}`;
}

function correaHTML(R, c, ctx, ro){
  const i = (k, l, o = {}) => `<div class="f ${o.cls || ''}"><label>${l}</label><input data-rc="${k}" inputmode="decimal" value="${esc(c[k] ?? '')}" placeholder="${esc(o.ph || '')}" ${ro}/>${o.h ? `<div class="hint">${o.h}</div>` : ''}</div>`;
  const s = (k, l, ops, o = {}) => `<div class="f"><label>${l}</label><select data-rc="${k}" ${ro}>${ops.map(([v, t]) => `<option value="${esc(v)}" ${String(c[k]) === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>${o.h ? `<div class="hint">${o.h}</div>` : ''}</div>`;
  const ch = (k, l, h) => `<label class="chk"><input type="checkbox" data-rc="${k}" ${c[k] ? 'checked' : ''} ${ro}/> <span>${l}${h ? `<br/><small class="hint">${h}</small>` : ''}</span></label>`;
  const th = ctx.g.ok ? ctx.g.theta : null, ac = Correas.ACEROS;
  const mat = c.mat === 'mad', m = Correas.MADERAS[c.grupo];
  const sec = mat ? `
      <div class="fg g4">${s('grupo', 'Grupo estructural', Object.keys(Correas.MADERAS).map(k => [k, `${k} — Fb ${Correas.MADERAS[k].Fb} MPa`]), { h:'Tablas G.2.2-1 / G.2.2-2' })}${i('b', 'b — base (mm)')}${i('d', 'd — altura (mm)')}${i('dens', 'Densidad (kg/m³)', { h:'Peso propio de la correa' })}</div>
      <div class="hint">Valores del grupo ${c.grupo}: Fb ${m.Fb} · Fv ${m.Fv} · E0.5 ${m.E05} · E0.05 ${m.E005} · Emin ${m.Emin} MPa</div>`
    : `
      <div class="seg" role="group" aria-label="Tipo de sección" style="margin-bottom:8px"><button type="button" data-rsec="L" class="${c.sec !== 'HSS' ? 'on' : ''}" ${ro}>Ángulo (L)</button><button type="button" data-rsec="HSS" class="${c.sec === 'HSS' ? 'on' : ''}" ${ro}>Tubo rectangular</button></div>
      <div class="fg g4">${s('acero', 'Acero', (c.sec === 'HSS' ? Correas.ACEROS_HSS : Correas.ACEROS_L).map(k => [k, `${ac[k].n} — Fy ${ac[k].Fy} MPa`]))}
        ${c.sec === 'HSS' ? `${i('H', 'H — altura, normal a la cubierta (mm)')}${i('B', 'B — ancho (mm)')}${i('tH', 't — espesor (mm)', { h:'Se diseña con 0.93t' })}` : `${i('b', 'b — ala (mm)')}${i('t', 't — espesor (mm)')}`}</div>
      ${c.sec !== 'HSS' ? `<div style="margin-top:4px">${ch('arriostre', 'La lámina va fijada al ala y la arriostra', 'Sí: flexión en ejes geométricos. No: ejes principales y pandeo lateral-torsional del ángulo (F.2.6.10).')}</div>` : ''}`;
  return `<div class="rv-cor">
    <div class="fg g4">${i('nom', 'Nombre')}<div class="f" style="grid-column:span 3"><label>Ubicación / descripción</label><input data-rc="desc" value="${esc(c.desc || '')}" placeholder="Ej.: Correas del eje B a C, zona de paneles" ${ro}/></div></div>
    <div class="rv-row"><div style="flex:1">
      <h4 class="sub">Sección — ${mat ? 'madera (Título G, esfuerzos admisibles)' : 'acero (Título F, LRFD)'}</h4>${sec}
      <h4 class="sub">Geometría</h4>
      <div class="fg g4">${i('s', 'Separación entre correas s (m)', { h:'Ancho aferente' })}${i('L', 'Luz entre apoyos L (m)')}${i('alfa', 'Inclinación (°)', { ph:th != null ? `${fR(th, 1)} (del viento)` : '' })}
        ${s('apoyo', 'Condición de apoyo', Object.entries(Correas.APOYOS).map(([k, v]) => [k, `${v.n} — M = ${v.txtM}`]))}</div>
      <div class="fg g4">${s('zona', 'Zona de viento de esta correa', [['', `La general (zona ${R.viento.zona})`], ['1', 'Zona 1'], ['2', 'Zona 2'], ['3', 'Zona 3']])}${i('limV', 'Deflexión viva / viento: L /', { ph:R.cielo.aplica ? '360' : '240' })}${i('limT', 'Deflexión total: L /', { ph:R.cielo.aplica ? '240' : '180' })}</div>
      ${mat ? `<h4 class="sub">Condiciones de servicio — coeficientes G.2.2.3</h4>
      <div class="fg g4">${i('CHc', 'Humedad en la construcción (%)')}${i('CHs', 'Humedad en servicio (%)')}${i('temp', 'Temperatura (°C)')}${i('Kcr', 'Factor de deflexión diferida', { ph:Correas.num(c.CHs, 12) <= 19 ? '1.8 (seca)' : '2.0 (húmeda)', h:'Tabla G.3.2-5 (por confirmar con la norma)' })}</div>
      <div class="fg g4">${i('lu', 'Longitud no arriostrada lu (m)', { ph:'= L' })}${i('BA', 'Desviación del grano BA (mm)')}${i('AC', 'Longitud medida AC (mm)', { h:'Pendiente BA/AC ≤ 1/8 (Tabla G.2.2-9)' })}</div>
      <div class="rv-chks">${ch('diafragma', 'La cubierta (entablado o lámina fijada) toma la carga a lo largo de la pendiente', 'Sí: la correa solo trabaja en el eje fuerte.')}${ch('restr', 'Borde a compresión soportado lateralmente (CL = 1)')}${ch('incision', 'El elemento tiene incisiones (G.2.2.3.4)')}${ch('conjunta', 'Acción de conjunto: 3 o más elementos a ≤ 0.61 m (G.2.2.3.5)')}</div>` : ''}
    </div><div class="rv-dib">${svgSecCorrea(c)}<div class="hint" style="text-align:center">${esc(nomSecCor(c))}</div></div></div>
    <div class="nav-btns" style="margin-top:12px"><button class="btn pri" type="button" id="rvCalc">⚡ Calcular verificación NSR-10</button>
      ${esIng() ? `<button class="btn" type="button" id="rvDup">⧉ Duplicar correa</button>${R.correas.length > 1 ? '<button class="btn danger" type="button" id="rvDel">Eliminar correa</button>' : ''}` : ''}</div>
    <div id="rvRes">${resultadoHTML(R, c, ctx)}</div></div>`;
}

function resultadoHTML(R, c, ctx){
  if(!c.huella) return '<p class="hint" style="margin-top:10px">Llena los datos y toca «Calcular».</p>';
  if(c.huella !== huellaCor(R, c)) return `<div class="note" style="margin-top:10px">Cambiaron los datos desde el último cálculo${c.res ? ` (antes: D/C máx. ${fR(c.res.max, 2)}, ${c.res.cumple ? 'cumplía' : 'no cumplía'})` : ''}. Toca «Calcular» de nuevo.</div>`;
  const r = Correas.revisar(R, c, ctx);
  if(!r.ok) return `<div class="note red" style="margin-top:10px">Faltan datos: ${esc(r.faltan.join(', '))}.</div>`;
  const sug = r.cumple ? [] : Correas.sugerir(R, c, ctx);
  return `<div class="rv-band ${r.cumple ? 'ok' : 'no'}">${r.cumple ? '✓ LA CORREA CUMPLE' : '✗ LA CORREA NO CUMPLE — revisar la sección'}<small>${esc(nomSecCor(c))} · L = ${fR(Correas.num(c.L), 2)} m · s = ${fR(Correas.num(c.s), 2)} m · D/C máx. ${fR(r.max, 2)}</small></div>
    <div class="rv-tiles"><div><span>Verificaciones</span><b>${r.chk.length}</b></div><div><span>Cumplen</span><b class="ok">${r.nOk}</b></div><div><span>No cumplen</span><b class="no">${r.nNo}</b></div><div><span>D/C máxima</span><b>${fR(r.max, 2)}</b></div></div>
    ${tablaChk(r, false)}
    ${r.avisos.map(a => `<div class="note">${esc(a)}</div>`).join('')}
    ${sug.length ? `<div class="rv-sug"><b>💡 Opciones para que cumpla</b> (recalculadas con las mismas cargas):<ul>${sug.map((x, k) => `<li>${esc(x.txt)}${x.dc != null ? ` → D/C ${fR(x.dc, 2)}` : ''} ${esIng() ? `<button class="btn sm" type="button" data-sug="${k}">Aplicar</button>` : ''}</li>`).join('')}</ul></div>` : ''}
    ${r.tipo === 'mad' ? `<div class="note blue"><b>Recomendación de arriostramiento (d/b = ${fR(Correas.num(c.d) / Correas.num(c.b), 1)}):</b> ${esc(r.txtArr)}</div>` : ''}
    <details class="rv-paso"><summary>🔍 Ver paso a paso del cálculo</summary>${pasoHTML(R, c, r)}</details>`;
}
function tablaChk(r, imp){
  return `<table class="${imp ? 'ax-tb' : 't rv-tb'}"><thead><tr><th>Verificación</th><th>Ref. NSR-10</th><th>Actuante</th><th>Admisible</th><th>D/C</th><th>Resultado</th></tr></thead><tbody>
    ${r.chk.map(x => `<tr><td>${esc(x.nom)}</td><td class="c">${esc(x.ref)}</td><td class="c">${fR(x.dem, x.u === 'mm' ? 1 : 3)} ${x.u}</td><td class="c">${fR(x.cap, x.u === 'mm' ? 1 : 3)} ${x.u}</td><td class="c"><b>${fR(x.dc, 2)}</b></td><td class="c">${x.ok ? (imp ? 'Cumple' : pill('ok', 'Cumple')) : (imp ? '<b>No cumple</b>' : pill('no', 'No cumple'))}</td></tr>`).join('')}</tbody></table>`;
}
function pasoHTML(R, c, r){
  const q = r.q, w = q.w, cls = 'ax-tb';
  const cargas = `<h4>Cargas sobre la correa</h4><table class="${cls}"><tr><th>Concepto</th><th>Expresión</th><th>Valor</th></tr>
    <tr><td>Carga muerta por área</td><td>Σ cubierta, cielo raso, paneles, rieles…</td><td class="c">${fR(q.qD, 3)} kN/m²</td></tr>
    <tr><td>Peso propio de la correa</td><td>${c.mat === 'mad' ? 'densidad · b · d · g' : 'A · 7 850 kg/m³ · g'}</td><td class="c">${fR(q.pp, 3)} kN/m</td></tr>
    <tr><td>D (vertical)</td><td>qD · s + pp = ${fR(q.qD, 3)} · ${fR(q.s, 2)} + ${fR(q.pp, 3)}</td><td class="c">${fR(q.Dv, 3)} kN/m</td></tr>
    <tr><td>D normal / tangencial</td><td>D·cos θ / D·sen θ (θ = ${fR(q.th, 1)}°)</td><td class="c">${fR(q.Dn, 3)} / ${fR(q.Dt, 3)} kN/m</td></tr>
    <tr><td>Lr (proyección horizontal)</td><td>Lr · s · cos θ = ${fR(q.LrA, 2)} · ${fR(q.s, 2)} · ${fR(q.c, 3)}</td><td class="c">${fR(q.Lv, 3)} kN/m</td></tr>
    <tr><td>Lr normal / tangencial</td><td>·cos θ / ·sen θ</td><td class="c">${fR(q.Ln, 3)} / ${fR(q.Lt, 3)} kN/m</td></tr>
    <tr><td>Viento presión / succión</td><td>p · s (normal a la cubierta)</td><td class="c">${fR(q.Wp, 3)} / ${fR(q.Ws, 3)} kN/m</td></tr></table>
    <p class="hint">Viento: ${w.ref}. qh = ${fR(w.qh, 3)} kN/m², área efectiva ${fR(w.Ae, 2)} m², zona ${w.zona}${w.tipo === 'libre' ? `, CN ${fR(w.CNp, 2)} / ${fR(w.CNs, 2)}` : `, ${w.fig}, GCp ${fR(w.GCpP, 2)} / ${fR(w.GCpN, 2)}, GCpi ±${w.GCpi}`}.</p>`;
  const combos = `<h4>Combinaciones ${r.tipo === 'mad' ? 'de servicio (B.2.3) con Cd' : 'de resistencia (B.2.4)'}</h4><table class="${cls}"><tr><th>Combinación</th><th>Ref.</th>${r.tipo === 'mad' ? '<th>Cd</th>' : ''}<th>w normal (kN/m)</th><th>w tangencial (kN/m)</th></tr>
    ${r.combos.map(x => `<tr><td>${esc(x.nom)}</td><td class="c">${x.ref}</td>${r.tipo === 'mad' ? `<td class="c">${x.Cd}</td>` : ''}<td class="c">${fR(x.n, 3)}</td><td class="c">${fR(x.t, 3)}</td></tr>`).join('')}</table>
    <p class="hint">Momento máximo ${Correas.APOYOS[c.apoyo]?.txtM || 'wL²/8'}, cortante ${Correas.APOYOS[c.apoyo]?.txtV || 'wL/2'}, deflexión ${Correas.APOYOS[c.apoyo]?.txtD || '5wL⁴/384EI'}.</p>`;
  let props = '';
  if(r.tipo === 'met' && r.esL){ const P = r.r.P; props = `<h4>Propiedades del ángulo (${esc(r.ac.n)}, Fy ${r.ac.Fy} MPa)</h4><table class="${cls}"><tr><td>A</td><td class="c">${fR(P.A, 1)} mm²</td><td>Centroide desde el talón</td><td class="c">${fR(P.c, 2)} mm</td></tr>
      <tr><td>Ix = Iy (geométricos)</td><td class="c">${fR(P.Ix, 0)} mm⁴</td><td>Iw / Iz (principales)</td><td class="c">${fR(P.Iw, 0)} / ${fR(P.Iz, 0)} mm⁴</td></tr>
      <tr><td>rz (mínimo)</td><td class="c">${fR(P.rz, 2)} mm</td><td>Peso</td><td class="c">${fR(P.kgm, 2)} kg/m</td></tr></table>`; }
  else if(r.tipo === 'met'){ const P = r.r.P; props = `<h4>Propiedades del tubo (${esc(r.ac.n)}, Fy ${r.ac.Fy} MPa; t de diseño = 0.93t = ${fR(P.t, 2)} mm)</h4><table class="${cls}"><tr><td>A</td><td class="c">${fR(P.A, 1)} mm²</td><td>Peso</td><td class="c">${fR(P.kgm, 2)} kg/m</td></tr>
      <tr><td>Ix / Sx / Zx</td><td class="c">${fR(P.Ix, 0)} / ${fR(P.Sx, 0)} / ${fR(P.Zx, 0)}</td><td>Iy / Sy / Zy</td><td class="c">${fR(P.Iy, 0)} / ${fR(P.Sy, 0)} / ${fR(P.Zy, 0)}</td></tr>
      <tr><td>Esbeltez ala / alma (eje x)</td><td class="c">${fR(r.r.mx.lf, 1)} / ${fR(r.r.mx.lw, 1)}</td><td>Clase</td><td class="c">ala ${r.r.mx.claseF}, alma ${r.r.mx.claseW}</td></tr></table>`; }
  else { const k = r.k, P = r.props; props = `<h4>Propiedades y coeficientes de modificación</h4><table class="${cls}"><tr><td>A / Ix / Sx</td><td class="c">${fR(P.A, 0)} mm² / ${fR(P.Ix, 0)} mm⁴ / ${fR(P.Sx, 0)} mm³</td><td>Iy / Sy</td><td class="c">${fR(P.Iy, 0)} / ${fR(P.Sy, 0)}</td></tr>
      <tr><td>Cm (Fb / Fv / E)</td><td class="c">${fR(k.Cm.Fb, 2)} / ${fR(k.Cm.Fv, 2)} / ${fR(k.Cm.E, 2)}</td><td>Ct (Fb / E)</td><td class="c">${fR(k.Ct.Fb, 2)} / ${fR(k.Ct.E, 2)}</td></tr>
      <tr><td>Cin / Cr (solo Fb)</td><td class="c">${fR(k.Cin.Fb, 2)} / ${fR(k.Cr, 2)}</td><td>CDG (pendiente ${fR(k.pend, 3)})</td><td class="c">${fR(k.cdgB, 2)}</td></tr>
      <tr><td>CF (eje fuerte / débil)</td><td class="c">${fR(k.CFx, 2)} / ${fR(k.CFy, 2)}</td><td>Cl / Cfu</td><td class="c">${fR(k.Cl, 3)} / ${fR(k.Cfu, 2)}</td></tr>
      <tr><td>le / RB</td><td class="c">${fR(r.le, 0)} mm / ${fR(r.RB, 1)}</td><td>E'min / FbE</td><td class="c">${fR(r.EminP, 0)} / ${fR(r.FbE, 2)} MPa</td></tr>
      <tr><td>E' para deflexión</td><td class="c">${fR(r.Ep, 0)} MPa (${r.k.crOk ? 'E0.5' : 'E0.05'})</td><td>Deflexión diferida</td><td class="c">× ${r.Kcr}</td></tr></table>`; }
  const det = `<h4>Desarrollo de cada verificación</h4><ol class="rv-det">${r.chk.map(x => `<li><b>${esc(x.nom)}</b> (${esc(x.ref)}): ${esc(x.det)} → D/C = ${fR(x.dc, 3)}, ${x.ok ? 'cumple' : 'no cumple'}.</li>`).join('')}</ol>`;
  return cargas + combos + props + det;
}

function activarRevision(R){
  const m = S.m, re = () => renderRevision();
  $('#back').onclick = () => ir('#/');
  if($('#btnHist')) $('#btnHist').onclick = abrirHistorial;
  $('#rvFicha').onclick = () => ir(`#/m/${m.id}/ficha`);
  $('#rvImp').onclick = imprimirRevision;
  const cor = () => R.correas.find(c => c.id === R.activa);
  const refresca = () => { const ctx = ctxR(R); $('#rvCargas').innerHTML = cargasStrip(R, ctx); $('#rvViento').innerHTML = vientoStrip(R, ctx, cor()); const c = cor(); if(c.huella) $('#rvRes').innerHTML = resultadoHTML(R, c, ctx); };
  const valor = el => el.type === 'checkbox' ? el.checked : el.value;
  $$('[data-fk]').forEach(el => el.oninput = () => { m.ficha[el.dataset.fk] = el.value; guardarMemoria(); });
  $$('[data-rv]').forEach(el => {
    const set = () => { let v = valor(el); if(el.dataset.rv === 'viento.V') v = Number(v); rvSet(R, el.dataset.rv, v); guardarMemoria(); };
    if(el.tagName === 'SELECT' || el.type === 'checkbox') el.onchange = () => { set(); re(); }; else el.oninput = () => { set(); refresca(); };
  });
  $$('[data-rc]').forEach(el => {
    const set = () => { cor()[el.dataset.rc] = valor(el); guardarMemoria(); };
    if(el.tagName === 'SELECT' || el.type === 'checkbox') el.onchange = () => { set(); re(); }; else el.oninput = () => { set(); refresca(); if(el.dataset.rc === 'nom'){ /* nombre de la pestaña al salir */ } };
    if(el.dataset.rc === 'nom') el.onchange = re;
  });
  if($('#rvPanel')) $('#rvPanel').onchange = e => { R.panel = { ...(S.cfg.biblioteca.paneles[e.target.value]) }; guardarMemoria(); re(); };
  if($('#rvRiel')) $('#rvRiel').onchange = e => { R.riel = { ...(S.cfg.biblioteca.rieles[e.target.value]) }; guardarMemoria(); re(); };
  $$('[data-rsec]').forEach(b => b.onclick = () => { const c = cor(); c.sec = b.dataset.rsec; c.acero = c.sec === 'HSS' ? 'A500B' : 'A36'; guardarMemoria(); re(); });
  $$('[data-ctab]').forEach(b => b.onclick = () => { R.activa = b.dataset.ctab; guardarMemoria(); re(); });
  $$('[data-cadd]').forEach(b => b.onclick = () => {
    const n = R.correas.reduce((a, c) => Math.max(a, parseInt(String(c.nom).replace(/\D/g, '')) || 0), 0) + 1, prev = cor();
    const c = Correas.nuevaCorrea(b.dataset.cadd, n); c.s = prev.s; c.L = prev.L; c.alfa = prev.alfa; c.apoyo = prev.apoyo;
    R.correas.push(c); R.activa = c.id; guardarMemoria(); re(); });
  if($('#rvDup')) $('#rvDup').onclick = () => { const p = cor(), n = R.correas.length + 1, c = { ...JSON.parse(JSON.stringify(p)), id:'c' + Math.random().toString(36).slice(2, 9), nom:`CR-${n}`, huella:'', res:null }; R.correas.push(c); R.activa = c.id; guardarMemoria(); re(); };
  if($('#rvDel')) $('#rvDel').onclick = () => { const c = cor(); if(!confirm(`¿Eliminar ${c.nom}?`)) return; R.correas = R.correas.filter(x => x !== c); R.activa = R.correas[0].id; guardarMemoria(); re(); };
  $('#rvCalc').onclick = () => {
    const c = cor(), ctx = ctxR(R), r = Correas.revisar(R, c, ctx);
    c.huella = huellaCor(R, c); c.res = r.ok ? { max:r.max, cumple:r.cumple, fecha:new Date().toISOString() } : null;
    guardarMemoria(); re();
    setTimeout(() => $('#rvRes')?.scrollIntoView({ behavior:'smooth', block:'start' }), 50);
  };
  $$('[data-sug]').forEach(b => b.onclick = () => {
    const c = cor(), ctx = ctxR(R), s = Correas.sugerir(R, c, ctx)[+b.dataset.sug]; if(!s) return;
    Object.assign(c, s.cambio); const r = Correas.revisar(R, c, ctx); c.huella = huellaCor(R, c); c.res = r.ok ? { max:r.max, cumple:r.cumple, fecha:new Date().toISOString() } : null;
    guardarMemoria(); re(); toast('Cambio aplicado y recalculado.');
  });
  // fotos
  $$('[data-foto]').forEach(async im => { const u = await urlDe(im.dataset.foto); if(u) im.src = u; });
  $$('[data-fnota]').forEach(el => el.oninput = () => { R.fotos[+el.dataset.fnota].nota = el.value; guardarMemoria(); });
  $$('[data-fdel]').forEach(b => b.onclick = async () => { const f = R.fotos[+b.dataset.fdel]; if(!confirm('¿Quitar esta foto?')) return;
    R.fotos.splice(+b.dataset.fdel, 1); guardarMemoria(); try{ await sb.storage.from(BUCKET).remove([f.path]); }catch(e){} re(); });
  if($('#rvFotoAdd')) $('#rvFotoAdd').onclick = () => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = true;
    i.onchange = async () => { const fs = [...i.files]; if(!fs.length) return;
      try{ let k = 0; for(const f of fs){ k++; toast(`Subiendo foto ${k} de ${fs.length}…`, 20000);
          const blob = await comprimir(f, { max:1600, type:'image/jpeg', q:0.8 }), path = `${m.id}/revision-foto-${Date.now()}-${k}.jpg`;
          await subir(path, blob, 'image/jpeg'); R.fotos.push({ path, nota:'' }); guardarMemoria(); }
        toast('Fotos guardadas.'); re(); }catch(e){ err(e, 'No se pudo subir la foto'); } };
    i.click();
  };
}

// ─── Impresión: portada de la app + memoria con rótulo y numeración «X / Y» ───
function conclusionAuto(R, rs){
  const malos = rs.filter(x => x.r.ok && !x.r.cumple), ok = rs.filter(x => x.r.ok && x.r.cumple);
  if(!rs.length) return '';
  if(!malos.length) return `Las ${ok.length === 1 ? 'correa revisada cumple' : `${ok.length} correas revisadas cumplen`} los requisitos de resistencia y de deflexión de la NSR-10 para las cargas evaluadas${R.paneles ? ', incluido el sistema de paneles solares' : ''}. La cubierta es apta para la instalación prevista, siempre que se conserven las condiciones de apoyo, fijación y estado de los elementos verificados.`;
  return `${malos.map(x => x.c.nom).join(', ')} no ${malos.length > 1 ? 'cumplen' : 'cumple'} los requisitos de la NSR-10 para las cargas evaluadas (D/C máxima ${malos.map(x => fR(x.r.max, 2)).join(', ')}). Antes de instalar se debe reforzar o reemplazar la correa, reducir la separación entre correas o colocar apoyos intermedios, según las opciones indicadas en cada verificación.${ok.length ? ` ${ok.map(x => x.c.nom).join(', ')} ${ok.length > 1 ? 'cumplen' : 'cumple'}.` : ''}`;
}
async function revisionPrintHTML(){
  const m = S.m, R = datosR(), F = m.ficha, c = S.cfg, ctx = ctxR(R), sw = '';
  const rs = R.correas.map(cr => ({ c:cr, r:Correas.revisar(R, cr, ctx) }));
  const fotos = await Promise.all(R.fotos.map(async f => ({ ...f, url:await urlDe(f.path) })));
  const lugar = [F.dir, F.mun, F.depto].filter(Boolean).join(', ');
  const fecha = F.fecha ? new Date(F.fecha + 'T12:00').toLocaleDateString('es-CO', { day:'numeric', month:'long', year:'numeric' }) : '';
  const w0 = ctx.g.ok ? Correas.vientoCorrea(R, AnexoA, Correas.num(R.correas[0].L), Correas.num(R.correas[0].s), R.correas[0].zona) : null;
  const mats = [...new Set(R.correas.map(x => x.mat))];
  let h = `<div class="ax rv-print">
  <section><div class="ax-hd"><div class="ax-t">MEMORIA DE CÁLCULO — REVISIÓN DE CUBIERTA</div><div class="ax-n">Verificación de correas ${mats.includes('met') ? 'metálicas (NSR-10 Título F)' : ''}${mats.length > 1 ? ' y ' : ''}${mats.includes('mad') ? 'de madera (NSR-10 Título G)' : ''}</div>
    <table class="ax-id"><tr><td><b>Proyecto:</b></td><td>${esc(F.proyecto || m.titulo || '')}</td><td><b>Ingeniero:</b></td><td>${esc((c.nombre_firma || '').replace(/^ING\.\s*/, ''))}</td></tr>
    <tr><td><b>Documento:</b></td><td>${esc(m.consecutivo)}</td><td><b>Fecha:</b></td><td>${esc(fecha)}</td></tr></table></div>
  <h3>1. Generalidades</h3>
  <table class="ax-kv"><tr><td>Propietario / cliente</td><td>${esc(F.prop || '—')}</td></tr><tr><td>Ubicación</td><td>${esc(lugar || '—')}</td></tr><tr><td>Elementos revisados</td><td>${R.correas.map(x => `${esc(x.nom)}: ${esc(nomSecCor(x))}`).join('<br/>')}</td></tr></table>
  <p><b>Objetivo.</b> Verificar si las correas de la cubierta existente soportan las cargas de la cubierta${R.paneles ? ` y de la instalación de paneles solares ${esc(R.panel?.nombre || '')} sobre rieles ${esc(R.riel?.nombre || '')}` : ''}, de acuerdo con el Reglamento Colombiano de Construcción Sismo Resistente NSR-10.</p>
  <p><b>Alcance.</b> Se revisan las correas indicadas por resistencia (flexión, cortante y estabilidad) y por deflexión. No hacen parte de esta revisión los apoyos de las correas (cerchas, vigas o muros), las conexiones, la cimentación ni el análisis sísmico de la edificación.</p>
  <table class="ax-tb"><thead><tr><th>Norma</th><th>Título / numeral</th><th>Aplicación</th></tr></thead><tbody>
    <tr><td>NSR-10</td><td>Título B — B.2, B.3, B.4, B.6</td><td>Combinaciones, cargas muertas, carga viva de cubierta y viento</td></tr>
    ${mats.includes('met') ? '<tr><td>NSR-10</td><td>Título F — F.2 (LRFD)</td><td>Diseño de miembros de acero</td></tr>' : ''}
    ${mats.includes('mad') ? '<tr><td>NSR-10</td><td>Título G (esfuerzos admisibles)</td><td>Diseño de elementos de madera</td></tr>' : ''}</tbody></table>
  <h3>2. Cargas</h3>
  <table class="ax-tb"><thead><tr><th>Carga muerta por área</th><th>Fuente</th><th>kg/m²</th></tr></thead><tbody>${ctx.area.items.map(i => `<tr><td>${esc(i.n)}</td><td>${esc(i.fuente || '')}</td><td class="c">${fR(i.kg, 2)}</td></tr>`).join('')}
    <tr class="tot"><td colspan="2">Total (sin peso propio de la correa)</td><td class="c">${fR(ctx.area.kg, 2)} kg/m² = ${fR(ctx.area.qD, 3)} kN/m²</td></tr></tbody></table>
  <p>Carga viva de cubierta Lr = ${fR(R.Lr !== '' && R.Lr != null ? Correas.num(R.Lr) : Correas.LrMin(ctx.g.ok ? ctx.g.theta : 0), 2)} kN/m² sobre la proyección horizontal (Tabla B.4.2.1-2).</p>
  ${w0?.ok ? `<h4>Viento (B.6.5, componentes y revestimiento)</h4><table class="ax-kv">
    <tr><td>Tipo de edificación</td><td>${{ cerrada:'Cerrada', parcial:'Parcialmente cerrada', libre:'Cubierta libre' }[w0.tipo]}</td></tr>
    <tr><td>Velocidad básica V / grupo / I</td><td>${w0.V} m/s · ${esc((AnexoA.GRUPOS[R.viento.grupo] || {}).nombre || '')} · I = ${w0.I}</td></tr>
    <tr><td>Geometría</td><td>${fR(w0.g.L, 2)} × ${fR(w0.g.W, 2)} m, cornisa ${fR(w0.g.He, 2)} m, cumbrera ${fR(w0.g.Hr, 2)} m, θ = ${fR(w0.g.theta, 1)}°, h = ${fR(w0.g.hm, 2)} m</td></tr>
    <tr><td>Exposición / Kz / Kd</td><td>${w0.ex.usada} · ${fR(w0.Kz, 3)} · ${w0.Kd}</td></tr>
    <tr><td>qh = 0.613·Kz·Kzt·Kd·V²·I</td><td>${fR(w0.qh, 3)} kN/m²</td></tr>
    <tr><td>Coeficientes</td><td>${w0.tipo === 'libre' ? 'CN de la Figura B.6.5-19A según zona y área' : `GCp de la ${w0.fig}, GCpi = ±${w0.GCpi}`}</td></tr>
    <tr><td>Presión de diseño</td><td>p = ${w0.tipo === 'libre' ? 'qh·G·CN' : 'qh·[(GCp) − (GCpi)]'}, mínimo 0.40 kN/m²; se calcula para cada correa con su zona y área efectiva</td></tr></table>` : ''}
  </section>`;
  rs.forEach((x, k) => {
    const cr = x.c, r = x.r, n = `3.${k + 1}`;
    h += `<section><h3>${k === 0 ? '3. Verificación de las correas<br/>' : ''}${n} ${esc(cr.nom)} — ${esc(nomSecCor(cr))}</h3>${cr.desc ? `<p>${esc(cr.desc)}</p>` : ''}`;
    if(!r.ok){ h += `<p class="ax-nota">Faltan datos para verificar esta correa: ${esc(r.faltan.join(', '))}.</p></section>`; return; }
    h += `<div class="rv-pr-row"><table class="ax-kv"><tr><td>Material</td><td>${r.tipo === 'mad' ? `Madera grupo ${cr.grupo}` : esc(r.ac.n + ` — Fy ${r.ac.Fy} MPa`)}</td></tr>
      <tr><td>Separación s / luz L</td><td>${fR(r.q.s, 2)} m / ${fR(r.q.L, 2)} m</td></tr><tr><td>Inclinación θ</td><td>${fR(r.q.th, 1)}°</td></tr>
      <tr><td>Apoyo</td><td>${esc(Correas.APOYOS[cr.apoyo]?.n || '')}</td></tr>
      ${r.tipo === 'met' && r.esL ? `<tr><td>Arriostramiento</td><td>${cr.arriostre !== false ? 'La lámina arriostra el ala (ejes geométricos)' : 'Sin arriostramiento (ejes principales, pandeo lateral-torsional)'}</td></tr>` : ''}
      ${r.tipo === 'mad' ? `<tr><td>Diafragma</td><td>${cr.diafragma !== false ? 'La cubierta toma la carga a lo largo de la pendiente' : 'La correa trabaja en los dos ejes'}</td></tr>` : ''}
      <tr><td>Límites de deflexión</td><td>L/${r.lim.V} (viva o viento) · L/${r.lim.T} (total)</td></tr></table>
      <figure class="ax-fig">${svgSecCorrea(cr, true)}</figure></div>
      ${pasoHTML(R, cr, r)}
      <h4>Resumen de verificaciones</h4>${tablaChk(r, true)}
      ${r.avisos.map(a => `<p class="ax-nota">${esc(a)}</p>`).join('')}
      ${r.tipo === 'mad' ? `<p><b>Arriostramiento:</b> ${esc(r.txtArr)}</p>` : ''}
      <p><span class="ax-box">${r.cumple ? 'CUMPLE' : 'NO CUMPLE'}</span> D/C máxima = ${fR(r.max, 2)}</p></section>`;
  });
  h += `<section><h3>4. Conclusión</h3><table class="ax-tb"><thead><tr><th>Correa</th><th>Sección</th><th>D/C máx.</th><th>Resultado</th></tr></thead><tbody>
    ${rs.map(x => `<tr><td>${esc(x.c.nom)}</td><td>${esc(nomSecCor(x.c))}</td><td class="c">${x.r.ok ? fR(x.r.max, 2) : '—'}</td><td class="c">${x.r.ok ? (x.r.cumple ? 'Cumple' : '<b>No cumple</b>') : 'Sin datos'}</td></tr>`).join('')}</tbody></table>
    <p>${esc((R.obs || '').trim() || conclusionAuto(R, rs))}</p>
    <div class="rv-firma">${c.firma_path ? `<img src="${esc(await urlDe(c.firma_path) || '')}" alt="Firma"/>` : '<div style="height:60px"></div>'}<div>${esc(c.nombre_firma || '')}<br/>${esc(c.matricula || '')}</div></div></section>`;
  if(fotos.length) h += `<section><h3>5. Registro fotográfico</h3><div class="ax-imgs">${fotos.map((f, i) => `<figure>${f.url ? `<img src="${esc(f.url)}" alt="Foto ${i + 1}"/>` : ''}<figcaption>Foto ${i + 1}. ${esc(f.nota || '')}</figcaption></figure>`).join('')}</div></section>`;
  return h + '</div>';
}
async function imprimirRevision(){
  const m = S.m;
  try{
    toast('Preparando la memoria…', 30000); await guardarPendientes();
    const [uImg, uFirma] = await Promise.all([urlDe(m.imagen_path), urlDe(S.cfg.firma_path)]);
    const pa = $('#print-area'); pa.innerHTML = portadaHTML(true, uImg, uFirma) + `<div class="doc-cuerpo">${await revisionPrintHTML()}</div>`;
    await Promise.all([...pa.querySelectorAll('img')].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
    try{ await Promise.all(['400', 'italic 400', '600', '700'].map(v => document.fonts.load(`${v} 12px EBG`))); }catch(e){}
    const per = perfilDe(m), pie = [per.l1, per.l2, per.correo && 'CORREO: ' + per.correo, per.dir && 'DIR: ' + per.dir, per.tel && 'TEL: ' + per.tel, per.ciudad].filter(x => (x || '').trim());
    const q = s => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\A ') + '"';   // salto de línea en CSS = \A
    const st = document.createElement('style');
    // rótulo con las cajas de margen de @page: consecutivo y nombre arriba, pie del perfil y «X / Y» abajo (la portada sin rótulo)
    st.textContent = `@page{size:letter;margin:.85in 0 1.05in;
      @top-left{content:${q(m.consecutivo)};font:8pt 'EBG',serif;color:#777;padding-left:.75in;vertical-align:bottom;padding-bottom:6px;border-bottom:.6pt solid #999}
      @top-right{content:${q(tituloArchivo(m.ficha))};font:8pt 'EBG',serif;color:#777;padding-right:.75in;vertical-align:bottom;padding-bottom:6px;border-bottom:.6pt solid #999}
      @bottom-center{content:${q(pie.join('\n'))};white-space:pre;font:6.5pt 'EBG',serif;color:#777;vertical-align:top;padding-top:8px}
      @bottom-right{content:counter(page) " / " counter(pages);font:600 9pt 'EBG',serif;color:#fff;background:#bbb;padding:2px 8px;margin:12px .75in 0 0;vertical-align:top;height:16px}}
      @page portada{margin:0;@top-left{content:none;border:none}@top-right{content:none;border:none}@bottom-center{content:none}@bottom-right{content:none;background:none}}
      #print-area .pg{page:portada}#print-area .doc-cuerpo{padding:0 .75in}`;
    document.head.appendChild(st); const t = document.title; document.title = `${m.consecutivo}_${tituloArchivo(m.ficha)}`;
    toast('Listo.', 800); window.print(); document.title = t; setTimeout(() => st.remove(), 500);
  }catch(e){ err(e, 'No se pudo preparar la memoria'); }
}
