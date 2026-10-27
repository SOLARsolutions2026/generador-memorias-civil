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
        <div id="pesoB"></div>
        <div class="note amber" style="margin-top:10px"><b>Peso propio de la estructura: por definir.</b> Falta escoger cómo se ingresa (lista de perfiles o total de SAP2000). Mientras tanto W solo incluye las cargas del Anexo A.</div></div>
      <div class="card"><div class="ct">B-2.2 Fuerza horizontal equivalente y torsión accidental</div>
        <div class="fg g4">${fIn(B,'dimX','Dimensión en X [m]',{ph:R.dimX ? fx(R.dimX,2)+' (L)' : '—'})}${fIn(B,'dimY','Dimensión en Y [m]',{ph:R.dimY ? fx(R.dimY,2)+' (W)' : '—'})}${fIn(B,'excent','Excentricidad accidental',{ph:'0.05',h:'5 % (A.3.6.7.1)'})}</div>
        <div id="resA" style="margin-top:10px"></div></div>`;
  }
  pane(h);
  if(!esIng()) { if(B.aplica) pintarResB(); return; }
  $$('[data-sis]').forEach(b => b.onclick = () => { B.aplica = b.dataset.sis === '1'; guardarMemoria(); renderWS('B'); });
  const t = $('#txtSis'); if(t) t.oninput = () => { B.texto = t.value.trim() === TXT_SIN_SISMO ? '' : t.value; guardarMemoria(); };
  $$('#pane [data-a]').forEach(inp => inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => {
    setP(B, inp.dataset.a, inp.value); guardarMemoria(); pintarResB();
  }));
  if(B.aplica) pintarResB();
}

function pintarResB(){
  const R = calcB();
  const fa = document.querySelector('[data-a="FaManual"]'), fv = document.querySelector('[data-a="FvManual"]');
  if(fa) fa.placeholder = R.p.Aa ? fx(R.FaT,2) + ' (tabla)' : 'escribe Aa'; if(fv) fv.placeholder = R.p.Av ? fx(R.FvT,2) + ' (tabla)' : 'escribe Av';
  if($('#espB')) $('#espB').innerHTML = svgEspectro(R) + (R.ok ? res([['Fa · Fv', `${fx(R.p.Fa,2)} · ${fx(R.p.Fv,2)}`],['Coeficiente de importancia I', fx(R.p.I,2)],
    ['To · Tc · TL', `${fx(R.p.To,3)} · ${fx(R.p.Tc,3)} · ${fx(R.p.TL,2)} s`],['Ta = Ct·h^α', `${fx(R.sis.Ct,3)} × ${fx(R.h,2)}^${R.sis.a} = ${fx(R.Ta,3)} s`],
    ['Cu = 1.75 − 1.2·Av·Fv (≥ 1.2)', fx(R.Cu,3)],['Cu·Ta', fx(R.CuTa,3)+' s']]) : `<div class="note amber">Faltan: ${R.faltan.join(', ')}.</div>`);
  if($('#pesoB')) $('#pesoB').innerHTML = res([...R.cargas.map(x => [esc(x.n), fx(x.w,2)+' kg/m²']),['Total cargas por área (Anexo A)', fx(R.wArea,2)+' kg/m²'],
    ['× área en planta', fx(R.area,2)+' m²'],['W de cargas', fx(R.Wcargas,2)+' kN'],['Peso propio de la estructura', 'por definir'],['W total', fx(R.W,2)+' kN', 1]]);
  if($('#resA')) $('#resA').innerHTML = !R.ok ? `<div class="note amber">Faltan: ${R.faltan.join(', ')}.</div>` :
    tabla(['Dirección','T usado [s]','Sa [g]','k','Vs [kN]','Momento torsor [kN·m]'], [
      ['X', fx(R.tx.T,3) + (R.tx.din ? (R.tx.limitado ? ' (Cu·Ta)' : ' (SAP)') : ' (Ta)'), fx(R.tx.Sa,4), fx(R.tx.k,2), `<b>${fx(R.tx.Vs,2)}</b>`, `${fx(R.MtX,2)} <span class="hint">= Vs × ${R.e} × ${fx(R.dimY,2)} m</span>`],
      ['Y', fx(R.ty.T,3) + (R.ty.din ? (R.ty.limitado ? ' (Cu·Ta)' : ' (SAP)') : ' (Ta)'), fx(R.ty.Sa,4), fx(R.ty.k,2), `<b>${fx(R.ty.Vs,2)}</b>`, `${fx(R.MtY,2)} <span class="hint">= Vs × ${R.e} × ${fx(R.dimX,2)} m</span>`]]) +
    `<div class="hint" style="margin-top:6px">Vs = Sa · W (Ec. A.4.3-1). Estructura de un nivel: toda la fuerza va a la cubierta (Cvx = 1). La FHE se aplica en SAP2000 en cada dirección con su momento torsor.</div>`;
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
