/* Piezas de pantalla de las conexiones (secciones de datos, cargas, dibujos, chequeos e impresión).
   Las comparten la app de conexiones (conexiones/app.js) y el Anexo E del generador (anexoE-ui.js).
   Usa los globales esc, esIng (de cada app), Conex (conexiones/calc.js), PERFILES_LAM y las ayudas de ejes-ui.js. */
(function(G){
const f2 = (x, d = 2) => x == null || !isFinite(x) ? '—' : (+x).toLocaleString('es-CO', { minimumFractionDigits:d, maximumFractionDigits:d });
const NOMBRES = { aleta:'Chapa de aleta (shear tab)', angular:'Doble angular de alma', testaV:'Chapa de testa a cortante', asiento:'Asiento con angular',
  testa:'Chapa de testa extendida (4 pernos)', ras:'Chapa de testa a ras', empalme:'Empalme de viga con cubrejuntas', empZ:'Empalme en Z soldado', soldada:'Soldada en todo el perímetro',
  cartela:'Diagonal a cartela', esquina:'Cartela de esquina (viga–columna)', cruce:'Cruce de diagonales en X', grupo:'Grupo de pernos excéntrico', base:'Placa base a momento', empCol:'Empalme de columna' };
// Galería por tipo de trabajo (pedido de Amo 10-nov)
const CATS = [['A cortante (articuladas)', ['aleta', 'angular', 'testaV', 'asiento']], ['A momento (rígidas)', ['testa', 'ras', 'soldada', 'empalme', 'empZ']], ['Arriostramientos', ['cartela', 'esquina', 'cruce']], ['Axiales y otras', ['grupo', 'base', 'empCol']]];
const PREF = { aleta:'CA', angular:'DA', testaV:'TV', asiento:'AS', testa:'CT', ras:'CR', empalme:'EV', empZ:'EZ', soldada:'SP', cartela:'DC', esquina:'CE', cruce:'CX', grupo:'GE', base:'PB', empCol:'EC' };

// Resumen de los datos de portada para la franja cerrada (pedido de Amo 19-nov: que se vea que se puede abrir)
function recalcular(c){ const r = Conex.calc(c); c.res = r.error ? null : { ok:r.ok, max:r.max }; return r; }

// ── Editor de una conexión ─────────────
function campo(c, k, l, opt = {}){
  const ro = esIng() ? '' : 'disabled';
  // En la app de conexiones el sismo se escoge una vez para todo el proyecto (Amo 21-nov)
  if(k === 'sismo' && G.ConSisProy) return `<div class="f"><label>${l}</label><div class="sis-proy">${esc(({ DMO:'DMO (pórtico intermedio)', DES:'DES (pórtico especial)' })[c.sismo] || 'Sin requisitos sísmicos (DMI o gravedad)')}</div><div class="hint">${c.vigaGrav ? 'Viga de gravedad (marcada abajo)' : typeof G.ConSisProy === 'string' ? G.ConSisProy : 'Se escoge arriba, en «Disipación de energía» del proyecto'}</div></div>`;
  if(opt.sel) return `<div class="f"><label>${l}</label><select data-k="${k}" ${ro}>${opt.sel.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(c[k]) === String(v) ? 'selected' : ''}>${esc(t)}</option>`; }).join('')}</select>${opt.h ? `<div class="hint">${opt.h}</div>` : ''}</div>`;
  return `<div class="f"><label>${l}</label><input data-k="${k}" ${opt.num === false ? '' : 'inputmode="decimal" data-num="1"'} value="${esc(c[k] ?? '')}" ${ro}/>${opt.h ? `<div class="hint">${opt.h}</div>` : ''}</div>`;
}
// Cartela de esquina y cruce en X (24-nov): las mismas secciones de la diagonal a cartela; cambia la unión al soporte
function seccionesArr(c){
  const base = seccionesDe0({ ...c, tipo:'cartela' }).filter(([k]) => k !== 'sold');
  const SELP2 = (k, l) => campo(c, k, l, { sel:(G.PERFILES_LAM || []).map(x => x[0]) }), g3 = (...x) => `<div class="fg g3">${x.join('')}</div>`;
  if(c.tipo === 'esquina'){
    const i = base.findIndex(([k]) => k === 'cart');
    base.splice(i + 1, 0, ['ufm', 'Viga, columna y soldaduras de la cartela', () => `${c.viga} · ${c.columna} por el ${c.cara === 'alma' ? 'alma (eje débil)' : 'ala'} · diagonal a ${c.ang}° · cartela ${c.Lh} × ${c.Lv} mm · filetes ${c.wB}/${c.wC} mm${c.duct === false ? '' : ' · ×1.25'}`,
      g3(SELP2('viga', 'Viga'), campo(c, 'aceroViga', 'Acero de la viga', { sel:SEL_ACERO }), campo(c, 'ang', 'Ángulo de la diagonal con la horizontal [°]'),
        SELP2('columna', 'Columna'), campo(c, 'aceroCol', 'Acero de la columna', { sel:SEL_ACERO }), campo(c, 'cara', 'La cartela se suelda a la columna por', { sel:[['ala', 'el ala (eje fuerte)'], ['alma', 'el alma (eje débil)']] }),
        campo(c, 'Lh', 'Largo de la cartela sobre la viga Lh [mm]', { h:'Soldadura a la viga, desde la cara de la columna' }), campo(c, 'Lv', 'Alto de la cartela contra la columna Lv [mm]', { h:'Soldadura a la columna, desde el ala de la viga' }), campo(c, 'electrodo', 'Electrodo', { sel:Object.keys(Conex.ELECTRODOS) }),
        campo(c, 'wB', 'Filete cartela–viga [mm]', { h:'Por ambas caras' }), campo(c, 'wC', 'Filete cartela–columna [mm]', { h:'Por ambas caras' }), '<div></div>',
        campo(c, 'Rv', 'Reacción de la viga R [kN]', { h:'Cortante de gravedad en el extremo; se suma para la unión viga–columna' }), campo(c, 'Ab', 'Fuerza de transferencia Ab [kN]', { h:'La que el piso le pasa a la viga; vacío = 0' }))
      + `<div class="f"><label class="ck"><input type="checkbox" data-k="duct" ${c.duct !== false ? 'checked' : ''} ${esIng() ? '' : 'disabled'}/> Diseñar las soldaduras para 1.25 veces la fuerza (ductilidad, Manual AISC parte 13)</label></div>`
      + '<p class="hint">La fuerza de la diagonal se reparte con el método de la fuerza uniforme. La unión viga–columna se diseña aparte (chapa de aleta o doble angular) con las fuerzas que da esta conexión.</p>']);
  } else {
    const i = base.findIndex(([k]) => k === 'cart');
    base.splice(i + 1, 0, ['pl', 'Platina en el cruce', () => `ancho ${c.bPl} mm · libre ${c.LcX} mm · K ${c.KX}${nz(c.nH) ? ` · ${c.nH} agujeros` : ''}`,
      g3(campo(c, 'bPl', 'Ancho de la platina en el cruce [mm]', { h:'Perpendicular a la diagonal interrumpida, donde pasa sobre la continua' }), campo(c, 'LcX', 'Espacio libre entre los extremos de la diagonal interrumpida [mm]', { h:'Para el pandeo de la platina' }), campo(c, 'KX', 'Factor K', { h:'1.0 si la diagonal continua no la sujeta; 0.65 si la sujeta bien' }),
        campo(c, 'nH', 'Agujeros en la sección del cruce', { h:'Pernos de la unión a la diagonal continua; 0 si va soldada' }))
      + '<p class="hint">La platina pasa por encima de la diagonal continua y lleva la fuerza de la diagonal interrumpida de una mitad a la otra. Los pernos y la sección de Whitmore de cada mitad se revisan como en la diagonal a cartela.</p>']);
  }
  return base.map(x => x[0] === 'cart' ? [x[0], c.tipo === 'cruce' ? 'Platina (cada mitad de la diagonal)' : 'Cartela', x[2], x[3]] : x);
}
const SEL_DIAM = Conex.DIAM.map(([t, v]) => [v, `${t} (${v} mm)`]);
const SEL_ACERO = Object.keys(Conex.ACEROS).map(k => [k, `${k} (Fy ${Conex.ACEROS[k].Fy} MPa)`]);
// Datos de la conexión por secciones (pedido de Amo 10-nov: mezcla de A y B = franja azul con número y título,
// resumen de lo escrito a la derecha, se abre y se cierra tocando la franja; varias pueden quedar abiertas).
const dnom = c => (Conex.DIAM.find(x => x[1] === +c.d) || [`${c.d} mm`])[0];
const SOPN = { ala:'Ala de columna', alma:'Alma de columna', viga:'Alma de viga principal' };
// Figuras de ayuda junto a los datos (pedido de Amo 20-nov): placas de continuidad de la columna y placa de apoyo
const conFig = (campos, fig, cls = '') => `<div class="con-fig ${cls}"><div>${campos}</div>${fig}</div>`;
// Planta de la columna con las placas y el corte de sus esquinas junto al radio alma–ala (pedido de Amo 20-nov)
function svgCorteEsq(cl, sis){
  const col = '#cbd5e1', ln = '#475569', azul = '#93c5fd', azulB = '#1d4ed8', nar = '#ea580c';
  const r = cl ? Math.max(+cl.r || 0, 15) : 0, txt = cl ? (sis ? `${r} × ${Math.ceil(r + 38)} mm` : `${r} × ${r} mm`) : '= radio r';
  const c = 11, cw = sis ? 20 : 11, R = 6;                // catetos dibujados (a lo largo del ala / del alma)
  const pl = (y0, y1, arriba) => { const yw = arriba ? y1 : y0, s = arriba ? -1 : 1;    // placa entre las alas, esquinas junto al alma recortadas
    return `<path d="M48 ${arriba ? y0 : y1} H152 V${yw + s * c} L${152 - cw} ${yw} H${48 + cw} L48 ${yw + s * c} Z" fill="${azul}" stroke="${azulB}"/>`; };
  const rad = (x, y, sx, sy) => `<path d="M${x} ${y} L${x} ${y + sy * R} A${R} ${R} 0 0 ${sx * sy > 0 ? 1 : 0} ${x + sx * R} ${y} Z" fill="${col}" stroke="${ln}" stroke-width=".6"/>`;   // radio alma–ala del perfil
  return `<svg viewBox="0 0 250 128" role="img" aria-label="Corte de las esquinas de las placas de continuidad">
    <rect x="40" y="8" width="8" height="104" fill="${col}" stroke="${ln}"/><rect x="152" y="8" width="8" height="104" fill="${col}" stroke="${ln}"/><rect x="48" y="57" width="104" height="6" fill="${col}" stroke="${ln}"/>
    ${pl(8, 57, true)}${pl(63, 112, false)}
    ${rad(48, 57, 1, -1)}${rad(152, 57, -1, -1)}${rad(48, 63, 1, 1)}${rad(152, 63, -1, 1)}
    <line x1="${152 - cw / 2}" y1="${57 - c / 2}" x2="186" y2="34" stroke="${nar}"/><text x="188" y="30" font-size="9" fill="${nar}">corte</text><text x="188" y="41" font-size="9" fill="${nar}">${txt}</text>
    <text x="100" y="32" text-anchor="middle" font-size="9" fill="${azulB}">Placa</text><text x="100" y="94" text-anchor="middle" font-size="9" fill="${azulB}">Placa</text>
    <text x="34" y="64" text-anchor="end" font-size="9" fill="${ln}">Ala</text><text x="100" y="124" text-anchor="middle" font-size="9" fill="${ln}">Columna en planta · alma horizontal</text>
  </svg>`;
}
// Longitud de pandeo de la cartela por el método de Thornton (pedido de Amo 20-nov)
function figLcr(tub){
  const ln = '#475569', az = '#93c5fd', azB = '#1d4ed8', mo = '#7c3aed', nar = '#ea580c', t = (x, y, s, c = ln, a = 'start') => `<text x="${x}" y="${y}" font-size="9" fill="${c}" text-anchor="${a}">${s}</text>`;
  const ux = 0.707, uy = -0.707, nx = 0.707, ny = 0.707, A = [175, 50], W0 = [A[0] - 46 * ux, A[1] - 46 * uy], hw = 38;   // A = punto lejano; W0 = centro de la sección de Whitmore
  const e1 = [W0[0] + hw * nx, W0[1] + hw * ny], e2 = [W0[0] - hw * nx, W0[1] - hw * ny], yS = 150;
  const down = p => [p[0] - (yS - p[1]), yS];                   // sigue la dirección de la diagonal hasta el soporte (a 45°)
  const d0 = down(W0), d1 = down(e1), d2 = down(e2);
  return `<figure class="fig-ayuda"><svg viewBox="0 0 230 175" role="img" aria-label="Longitud de pandeo de la cartela">
    <rect x="10" y="${yS}" width="210" height="10" fill="#cbd5e1" stroke="${ln}"/>
    <path d="M15 ${yS} L15 115 L150 15 L215 50 L220 ${yS} Z" fill="${az}" stroke="${azB}"/>
    <line x1="${A[0] + 60 * ux}" y1="${A[1] + 60 * uy}" x2="${W0[0] - 8 * ux}" y2="${W0[1] - 8 * uy}" stroke="${ln}" stroke-width="${tub ? 16 : 9}" opacity=".45"/>
    <path d="M${A[0]} ${A[1]} L${e1[0]} ${e1[1]} M${A[0]} ${A[1]} L${e2[0]} ${e2[1]} M${e1[0]} ${e1[1]} L${e2[0]} ${e2[1]}" stroke="${mo}" stroke-dasharray="3 2" fill="none"/>
    ${[[W0, d0, 'L1'], [e1, d1, 'L2'], [e2, d2, 'L3']].map(([p, q, l]) => `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="${nar}" stroke-width="1.6"/>${t((p[0] + q[0]) / 2 + 4, (p[1] + q[1]) / 2, l, nar)}`).join('')}
    ${t(e1[0] + 4, e1[1] + 2, 'Whitmore', mo)}${t(115, 172, 'soporte (borde soldado)', ln, 'middle')}
  </svg><figcaption>Lcr = (L1 + L2 + L3)/3: se miden desde la sección de Whitmore (centro y extremos) hasta el borde soldado, en la dirección de la diagonal; si una línea sale por un borde libre, se mide hasta ese borde. K = 0.65 si la cartela está sujeta en un borde (Thornton); 0.5 si está bien sujeta en sus dos bordes (cartela de esquina compacta); 1.2 si el borde libre es largo y puede desplazarse lateralmente.</figcaption></figure>`;
}
// Placa de refuerzo del alma de la columna (doubler) — campos y figura (pedido de Amo 25-nov)
function figDoubler(){
  return `<figure class="fig-ayuda"><svg viewBox="0 0 290 150" role="img" aria-label="Placa de refuerzo del alma de la columna">
    <text x="60" y="12" font-size="9" text-anchor="middle" fill="#475569">planta</text>
    <rect x="20" y="22" width="80" height="8" fill="#cbd5e1" stroke="#334155"/><rect x="20" y="112" width="80" height="8" fill="#cbd5e1" stroke="#334155"/>
    <rect x="56" y="30" width="8" height="82" fill="#cbd5e1" stroke="#334155"/><rect x="64" y="34" width="9" height="74" fill="#fde68a" stroke="#b45309"/>
    <path d="M73 34 l4 -4 M73 108 l4 4" stroke="#ea580c" stroke-width="2"/><text x="78" y="74" font-size="9" fill="#92400e">td</text>
    <text x="185" y="12" font-size="9" text-anchor="middle" fill="#475569">alzado (alma)</text>
    <rect x="140" y="18" width="90" height="128" fill="#e5e7eb" stroke="#334155"/>
    <rect x="140" y="46" width="90" height="6" fill="#93c5fd" stroke="#1d4ed8"/><rect x="140" y="108" width="90" height="6" fill="#93c5fd" stroke="#1d4ed8"/>
    <rect x="152" y="52" width="66" height="56" fill="#fde68a" stroke="#b45309"/><text x="185" y="84" font-size="9" text-anchor="middle" fill="#92400e">placa de refuerzo</text>
    <line x1="152" y1="52" x2="152" y2="108" stroke="#ea580c" stroke-width="3"/><line x1="218" y1="52" x2="218" y2="108" stroke="#ea580c" stroke-width="3"/>
    <text x="235" y="50" font-size="8" fill="#1d4ed8">placas de</text><text x="235" y="60" font-size="8" fill="#1d4ed8">continuidad</text></svg>
    <figcaption>Placa pegada al alma, entre las placas de continuidad (o 150 mm por encima y por debajo de las alas de la viga), soldada a las dos alas de la columna (naranja). Su espesor se suma al del alma en la zona de panel.</figcaption></figure>`;
}
function doublerHTML(c, campo, ck){
  const un = c.unDp || '';
  return `<h4 class="sub">Placa de refuerzo del alma (zona de panel)</h4>` + conFig(`<div class="fg g2">${[campo(c, 'dp', '¿Lleva placa de refuerzo?', { sel:[['no', 'No'], ['si', 'Sí']], h:'Si la zona de panel no alcanza' }),
    ...(c.dp === 'si' ? [campo(c, 'tdp', 'Espesor td [mm]', { h:'Vacío = automático' }), campo(c, 'aceroDp', 'Acero', { sel:[['', '— el de la columna —'], ...SEL_ACERO] }),
      campo(c, 'unDp', 'Soldadura a las alas', { sel:[['', 'Automática (con sismo, penetración completa)'], ['filete', 'Filete'], ['cjp', 'Penetración completa']] }),
      ...(un === 'filete' ? [campo(c, 'wdp', 'Filete [mm]', { h:'Vacío = automático' })] : [])] : [])].join('')}</div>`, c.dp === 'si' ? figDoubler() : '');
}
function figContinuidad(dos, cl, sis){
  const col = '#cbd5e1', ln = '#475569', azul = '#93c5fd', azulB = '#1d4ed8', nar = '#ea580c';
  const viga = (x1, x2) => `<rect x="${x1}" y="46" width="${x2 - x1}" height="7" fill="${col}" stroke="${ln}"/><rect x="${x1}" y="117" width="${x2 - x1}" height="7" fill="${col}" stroke="${ln}"/><rect x="${x1}" y="53" width="${x2 - x1}" height="64" fill="#f1f5f9" stroke="none"/>`;
  return `<figure class="fig-ayuda"><svg viewBox="0 0 230 175" role="img" aria-label="Placas de continuidad de la columna">
    ${viga(8, 84)}${dos ? viga(160, 222).replace(/fill="#cbd5e1"/g, 'fill="#e2e8f0"').replace(/stroke="#475569"/g, 'stroke="#94a3b8" stroke-dasharray="3 2"') : ''}
    <rect x="84" y="8" width="8" height="160" fill="${col}" stroke="${ln}"/><rect x="152" y="8" width="8" height="160" fill="${col}" stroke="${ln}"/>
    <rect x="92" y="8" width="60" height="160" fill="#f8fafc" stroke="none"/><line x1="122" y1="8" x2="122" y2="168" stroke="${ln}" stroke-dasharray="4 3"/>
    <rect x="92" y="46" width="60" height="7" fill="${azul}" stroke="${azulB}"/><rect x="92" y="117" width="60" height="7" fill="${azul}" stroke="${azulB}"/>
    <path d="M92 46 l4 -4 v4 z M152 46 l-4 -4 v4 z M92 124 l4 4 v-4 z M152 124 l-4 4 v-4 z" fill="${nar}"/>
    <text x="46" y="88" text-anchor="middle" font-size="10" fill="${ln}">Viga</text>
    ${dos ? `<text x="191" y="88" text-anchor="middle" font-size="9" fill="#94a3b8">Otra viga</text>` : ''}
    <text x="122" y="20" text-anchor="middle" font-size="9" fill="${ln}">Columna</text>
    <line x1="104" y1="44" x2="64" y2="26" stroke="${azulB}"/><text x="60" y="24" text-anchor="end" font-size="9" fill="${azulB}">Placa ts</text>
    <line x1="104" y1="126" x2="64" y2="146" stroke="${azulB}"/><text x="60" y="150" text-anchor="end" font-size="9" fill="${azulB}">Placa ts</text>
  </svg>${svgCorteEsq(cl, sis)}<figcaption>Las placas de continuidad van dentro de la columna, entre sus dos alas, a la altura de las alas de la viga. Rigidizan el ala y el alma de la columna donde llega la fuerza de cada ala. En planta, sus esquinas junto al alma se cortan para no montarse sobre la curva (radio) entre el alma y las alas del perfil${sis ? '; con sismo el corte sube por el alma (AWS D1.8)' : ': a 45° con cateto igual al radio'}.</figcaption></figure>`;
}
const opDebil = c => c.miembro !== 'tubo' && c.uDebil === 'tope' ? 'tope' : 'trasl';   // con tubo siempre traslapada (Amo 20-nov)
function svgPlantaDebil(dos, op = 'trasl', tub){
  // Planta (corregida 20-nov, observación de Amo): la placa llena el espacio entre las alas de la columna, del alma hasta las puntas
  // de las alas, del lado de la viga (y del otro lado solo si llega otra viga). Traslapada: sale una lengüeta sobre el ala (o sobre
  // la parte plana del tubo) con filetes por sus bordes. A tope: sale 50–75 mm y el ala se suelda a tope (CJP) contra su borde.
  const ln = '#475569', azul = '#93c5fd', azulB = '#1d4ed8', nar = '#ea580c', gris = '#f1f5f9';
  const yW = 94, tW = 6, yT = 58, yB = 136, xA = 64, xB = 164, cx = 114;
  const bw = tub ? 52 : 60, bl = tub ? 36 : 50, tope = op === 'tope' && !tub;
  const viga = (y0, y1, dash) => tub
    ? `<rect x="${cx - bw / 2}" y="${y0}" width="${bw}" height="${y1 - y0}" rx="5" fill="${gris}" stroke="${dash ? '#94a3b8' : ln}" stroke-width="3"${dash ? ' stroke-dasharray="4 3"' : ''}/>`
    : `<rect x="${cx - bw / 2}" y="${y0}" width="${bw}" height="${y1 - y0}" fill="${dash ? '#f8fafc' : gris}" stroke="${dash ? '#94a3b8' : ln}"${dash ? ' stroke-dasharray="4 3"' : ''}/><line x1="${cx}" y1="${y0}" x2="${cx}" y2="${y1}" stroke="${dash ? '#94a3b8' : ln}" stroke-width="3"${dash ? ' stroke-dasharray="4 3"' : ''}/>`;
  let h = `<rect x="${xA}" y="${yW}" width="${xB - xA}" height="${tW}" fill="#cbd5e1" stroke="${ln}"/>`;
  if(!tope) h += viga(4, yW - 2);                         // traslapada: la viga entra hasta el alma y la placa queda ENCIMA del ala
  // placa en T: parte ancha entre las alas (esquinas junto al alma cortadas a 45° por el radio del perfil) + lengüeta más angosta
  // con radio en las esquinas entrantes (pedido de Amo 20-nov)
  const cE = 7, R = 4, lg = tope ? { x0:cx - bw / 2, x1:cx + bw / 2, y:yT - 14 } : { x0:cx - bl / 2, x1:cx + bl / 2, y:24 };
  h += `<path d="M${xA} ${yT} H${lg.x0 - R} A${R} ${R} 0 0 0 ${lg.x0} ${yT - R} V${lg.y} H${lg.x1} V${yT - R} A${R} ${R} 0 0 0 ${lg.x1 + R} ${yT} H${xB} V${yW - cE} L${xB - cE} ${yW} H${xA + cE} L${xA} ${yW - cE} Z" fill="${azul}" stroke="${azulB}" opacity="${tope ? .8 : .85}"/>`;
  if(dos) h += `<path d="M${xA} ${yB} H${xB} V${yW + tW + cE} L${xB - cE} ${yW + tW} H${xA + cE} L${xA} ${yW + tW + cE} Z" fill="${azul}" stroke="${azulB}" opacity=".8"/>`;
  h += `<rect x="56" y="${yT}" width="8" height="${yB - yT}" fill="#cbd5e1" stroke="${ln}"/><rect x="164" y="${yT}" width="8" height="${yB - yT}" fill="#cbd5e1" stroke="${ln}"/>`;
  let sold;
  if(tope){
    const yP = yT - 14;                                   // la placa sale 50–75 mm de las alas de la columna
    h += viga(4, yP - 2) + `<rect x="${cx - bw / 2}" y="${yP - 3}" width="${bw}" height="3" fill="${nar}"/><line x1="${cx}" y1="${yP}" x2="${cx}" y2="${yW}" stroke="${ln}" stroke-width="3"/>`;
    sold = [cx + bw / 2, yP - 2];
  } else {
    const yL = 24;                                        // lengüeta de largo Lt sobre el ala o la cara del tubo
    h += `<path d="M${cx - bl / 2} ${yT - R} V${yL} H${cx + bl / 2} V${yT - R}" stroke="${nar}" stroke-width="2.5" fill="none"/>`;
    sold = [cx + bl / 2, 34];
  }
  if(dos) h += viga(yW + tW + 2, 186, true);
  h += `<text x="${cx}" y="16" text-anchor="middle" font-size="10" fill="${ln}" stroke="#f1f5f9" stroke-width="3" paint-order="stroke">${tub ? 'Tubo' : 'Viga'}</text>
    <text x="${cx}" y="${dos ? 176 : 152}" text-anchor="middle" font-size="9" fill="${dos ? '#94a3b8' : ln}">${dos ? 'Otra viga' : 'Columna (planta)'}</text>
    <line x1="150" y1="78" x2="196" y2="72" stroke="${azulB}"/><text x="198" y="68" font-size="9" fill="${azulB}">Placa</text><text x="198" y="79" font-size="9" fill="${azulB}">ts</text>
    <line x1="${sold[0]}" y1="${sold[1]}" x2="196" y2="40" stroke="${nar}"/><text x="198" y="38" font-size="9" fill="${nar}">Sold.</text>
    <text x="24" y="100" font-size="9" fill="${ln}">Alma</text><line x1="44" y1="97" x2="66" y2="97" stroke="${ln}"/>`;
  return `<svg viewBox="0 0 230 190" class="dsvg" role="img" aria-label="Viga soldada al alma de la columna, en planta">${h}</svg>`;
}
// Figura de ayuda de la cartela (pedido de Amo 25-nov): tipo escogido con Lh, hh y θ
function figCartela(k){
  if(!k || k === 'no') return `<figure class="fig-ayuda"><svg viewBox="0 0 230 150" role="img" aria-label="Tipos de cartela">
    <g font-size="9" text-anchor="middle" fill="#334155">${[['A', 'T', 8], ['B', 'arm', 83], ['D', 'pl', 158]].map(([l, t, x]) => `<g transform="translate(${x},20)">
      <rect x="0" y="0" width="8" height="100" fill="#cbd5e1" stroke="#334155"/><rect x="8" y="24" width="56" height="18" fill="#e5e7eb" stroke="#334155"/>
      <polygon points="8,42 8,72 56,42" fill="${t === 'pl' ? '#fef3c7' : '#dbeafe'}" stroke="${t === 'pl' ? '#b45309' : '#1d4ed8'}"/>${t === 'pl' ? '' : `<line x1="8" y1="74" x2="58" y2="42" stroke="${t === 'T' ? '#1d4ed8' : '#4338ca'}" stroke-width="3"/>`}
      <text x="34" y="96">${l}</text></g>`).join('')}</g></svg><figcaption>A: de perfil (T cortada) · B: de platinas · D: platina sola.</figcaption></figure>`;
  const pl = k === 'pl', col = pl ? '#b45309' : '#1d4ed8';
  return `<figure class="fig-ayuda"><svg viewBox="0 0 230 165" role="img" aria-label="Cartela bajo la viga">
    <rect x="16" y="6" width="16" height="150" fill="#cbd5e1" stroke="#334155"/><rect x="32" y="30" width="190" height="34" fill="#e5e7eb" stroke="#334155"/>
    <rect x="32" y="30" width="190" height="5" fill="#475569"/><rect x="32" y="59" width="190" height="5" fill="#475569"/>
    <polygon points="32,64 32,118 140,64" fill="${pl ? '#fef3c7' : '#dbeafe'}" stroke="${col}"/>${pl ? '<line x1="32" y1="118" x2="140" y2="64" stroke="#dc2626" stroke-width="1.6"/>' : `<line x1="32" y1="121" x2="144" y2="64" stroke="${col}" stroke-width="4"/>`}
    <line x1="32" y1="138" x2="140" y2="138" stroke="#64748b"/><text x="86" y="150" font-size="9" text-anchor="middle">Lh</text>
    <line x1="150" y1="64" x2="150" y2="118" stroke="#64748b" stroke-dasharray="3 2"/><line x1="140" y1="118" x2="156" y2="118" stroke="#64748b" stroke-dasharray="3 2"/><text x="156" y="95" font-size="9">hh</text>
    <path d="M118 64 A22 22 0 0 1 120 75" fill="none" stroke="#b45309"/><text x="100" y="80" font-size="9" fill="#b45309">θ</text>
    <text x="120" y="50" font-size="9" text-anchor="middle">viga</text></svg>
    <figcaption>${k === 'T' ? 'Trozo del perfil cortado en diagonal: el patín inclinado trabaja a compresión y el alma toma la componente vertical.' : k === 'arm' ? 'Alma de platina triangular + patín de platina soldado en el borde inclinado.' : 'Platina triangular en el plano del alma; el borde libre (rojo) se revisa a pandeo.'} Se suelda al ala inferior de la viga (a lo largo de Lh) y a la columna.</figcaption></figure>`;
}
function figDebil(dos){ return `<figure class="fig-ayuda">${svgPlantaDebil(dos)}<figcaption>Vista en planta. El alma de la columna es delgada y se doblaría con la fuerza de las alas de la viga; por eso se ponen placas de continuidad (azul) a la altura de las alas, soldadas al alma y a las dos alas de la columna. Las alas de la viga se sueldan a las placas.</figcaption></figure>`; }
function svgCorteDebil(op, o = {}){
  const ln = '#475569', az = '#93c5fd', azB = '#1d4ed8', nar = '#ea580c', t = (x, y, s, a = 'start', col = ln, fs = 11) => `<text x="${x}" y="${y}" font-size="${fs}" fill="${col}" text-anchor="${a}">${s}</text>`;
  let h = `<defs><pattern id="hc${op}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#64748b" stroke-width="1.2"/></pattern></defs>
    <rect x="80" y="20" width="12" height="260" fill="url(#hc${op})" stroke="${ln}"/>
    <line x1="210" y1="20" x2="210" y2="280" stroke="#94a3b8" stroke-dasharray="5 4"/>${t(214, 290, 'borde del ala de la columna', 'start', '#64748b', 10)}
    ${t(20, 150, 'Alma de')}${t(20, 163, 'la columna')}<line x1="72" y1="152" x2="82" y2="152" stroke="${ln}"/>
    <rect x="92" y="90" width="5" height="112" fill="${nar}" opacity=".75"/>${t(104, 255, `${o.tub ? 'Filete paredes del tubo–alma' : 'Filete alma–alma'}${o.w ? ` ${o.w} mm` : ''}`, 'start', nar)}<line x1="110" y1="245" x2="96" y2="200" stroke="${nar}"/>`;
  if(op === 'tope'){
    h += `<rect x="92" y="72" width="168" height="12" fill="${az}" stroke="${azB}"/><rect x="92" y="208" width="168" height="12" fill="${az}" stroke="${azB}"/>
      <rect x="266" y="72" width="214" height="11" fill="#cbd5e1" stroke="${ln}"/><rect x="266" y="209" width="214" height="11" fill="#cbd5e1" stroke="${ln}"/>
      <rect x="97" y="84" width="383" height="124" fill="#f1f5f9"/><line x1="97" y1="146" x2="480" y2="146" stroke="#94a3b8" stroke-dasharray="6 4"/>
      <rect x="260" y="72" width="6" height="12" fill="${nar}"/><rect x="260" y="208" width="6" height="12" fill="${nar}"/>
      ${t(100, 64, `Placa de continuidad${o.ts ? ` ts = ${o.ts} mm` : ' (ts ≥ tf)'}`, 'start', azB)}${t(470, 64, 'Ala de la viga', 'end')}
      ${t(270, 250, 'Ala a tope con la placa (CJP)', 'start', nar)}<line x1="268" y1="240" x2="264" y2="222" stroke="${nar}"/>`;
  } else {
    h += `<rect x="92" y="60" width="268" height="12" fill="${az}" stroke="${azB}"/><rect x="92" y="220" width="268" height="12" fill="${az}" stroke="${azB}"/>
      <rect x="98" y="72" width="382" height="11" fill="#cbd5e1" stroke="${ln}"/><rect x="98" y="209" width="382" height="11" fill="#cbd5e1" stroke="${ln}"/>
      <rect x="98" y="83" width="382" height="126" fill="#f1f5f9"/><line x1="98" y1="146" x2="480" y2="146" stroke="#94a3b8" stroke-dasharray="6 4"/>
      <path d="M360 72 L360 62 L370 72 Z M360 220 L360 230 L370 220 Z" fill="${nar}"/>
      <line x1="210" y1="48" x2="360" y2="48" stroke="${ln}"/><path d="M210 45 v6 M360 45 v6" stroke="${ln}"/>${t(285, 44, `traslapo Lt${o.Lt ? ` = ${o.Lt} mm` : ''}`, 'middle')}
      ${t(100, 30, `Placa sobre ${o.tub ? 'la cara del tubo' : 'el ala'}${o.ts ? ` ts = ${o.ts} mm` : ''}`, 'start', azB)}${t(470, 100, o.tub ? 'Cara superior del tubo' : 'Ala de la viga', 'end')}
      ${t(300, 262, `Filetes de la placa sobre ${o.tub ? 'el tubo' : 'el ala'}${o.wT ? ` ${o.wT} mm` : ''}`, 'start', nar)}<line x1="330" y1="252" x2="364" y2="230" stroke="${nar}"/>`;
  }
  h += t(330, 140, o.viga ? `${o.tub ? '' : 'Viga '}${o.viga}` : o.tub ? 'Tubo (pared lateral)' : 'Viga (alma)', 'start', ln, 12);
  return `<svg viewBox="0 0 500 300" class="dsvg" role="img" aria-label="Corte de la unión al alma de la columna">${h}</svg>`;
}
function figCorteDebil(op, dos, tub){
  return `<figure class="fig-ayuda"><div class="fig-par"><div><div class="fig-tit">Planta</div>${svgPlantaDebil(dos, op, tub)}</div><div><div class="fig-tit">Corte por el eje de la viga</div>${svgCorteDebil(op, { tub })}</div></div><figcaption>En planta, las placas de continuidad (azul) van a la altura de ${tub ? 'las caras superior e inferior del tubo' : 'las alas de la viga'}, soldadas al alma y a las dos alas de la columna. ${tub
    ? 'En el corte: el tubo entra completo entre las alas de la columna; una placa va encima de la cara superior y otra debajo de la inferior, soldadas con filete por sus bordes sobre la cara plana del tubo (largo Lt) y al alma y a las alas de la columna. Las paredes laterales del tubo se sueldan con filete al alma de la columna. Con tubo no se puede soldar a tope: la placa queda traslapada.'
    : op === 'tope'
    ? 'En el corte: las alas de la viga se cortan y se sueldan a tope (penetración completa) con el borde de la placa, en el mismo plano; la placa sale 50–75 mm fuera de las alas de la columna. El alma de la viga se suelda con filete al alma de la columna.'
    : 'En el corte: la viga entra completa entre las alas de la columna; una placa va encima del ala superior y otra debajo de la inferior, soldadas con filete por sus bordes sobre el ala (largo Lt) y al alma y a las alas de la columna. El alma de la viga se suelda con filete al alma de la columna.'}</figcaption></figure>`;
}
function figPlacaApoyo(){
  const col = '#cbd5e1', ln = '#475569', nar = '#ea580c';
  return `<figure class="fig-ayuda"><svg viewBox="0 0 230 175" role="img" aria-label="Viga soldada a una placa de apoyo">
    <rect x="132" y="12" width="12" height="150" fill="#93c5fd" stroke="#1d4ed8"/>
    <rect x="20" y="40" width="112" height="8" fill="${col}" stroke="${ln}"/><rect x="20" y="126" width="112" height="8" fill="${col}" stroke="${ln}"/><rect x="20" y="48" width="112" height="78" fill="#f1f5f9" stroke="none"/>
    <path d="M132 40 l-5 -5 v5 z M132 48 l-5 5 v-5 z M132 126 l-5 -5 v5 z M132 134 l-5 5 v-5 z" fill="${nar}"/><rect x="128" y="52" width="4" height="70" fill="${nar}" opacity=".55"/>
    <text x="76" y="92" text-anchor="middle" font-size="10" fill="${ln}">Viga</text>
    <line x1="144" y1="30" x2="170" y2="22" stroke="#1d4ed8"/><text x="172" y="20" font-size="9" fill="#1d4ed8">Placa de</text><text x="172" y="31" font-size="9" fill="#1d4ed8">apoyo · t</text>
    <line x1="129" y1="100" x2="170" y2="120" stroke="${nar}"/><text x="172" y="124" font-size="9" fill="${nar}">Soldadura</text>
  </svg><figcaption>La viga se suelda a una placa (por ejemplo, una placa de base o una placa embebida). Se revisa la flexión de la placa bajo el ala en tensión; lo que sostiene la placa se revisa aparte.</figcaption></figure>`;
}
function seccionesDe0(c){
  const g3 = (...x) => `<div class="fg g3">${x.join('')}</div>`;
  const pernosTipo = [campo(c, 'd', 'Diámetro', { sel:SEL_DIAM }), campo(c, 'grado', 'Grado', { sel:Object.keys(Conex.PERNOS) }), campo(c, 'rosca', 'Rosca en el plano de corte', { sel:[['N', 'Incluida (N)'], ['X', 'Excluida (X)']] }),
    `<div class="f"><label class="ck"><input type="checkbox" data-k="cizalla" ${c.cizalla ? 'checked' : ''} ${esIng() ? '' : 'disabled'}/> Bordes cortados con cizalla</label><div class="hint">Borde mínimo ${Conex.BORDE_CIZ[+c.d] ?? '—'} mm (con soplete o laminado ${Conex.BORDE_MIN[+c.d] ?? '—'} mm), Tabla F.2.10.3-4</div></div>`];
  if(c.tipo === 'aleta'){ const des = c.destaje || 'no'; return [
    ['viga', 'Viga apoyada', () => `${c.viga} · ${c.aceroViga} · holgura ${c.holgura} mm`,
      g3(campo(c, 'viga', 'Perfil', { sel:(window.PERFILES_LAM || []).map(x => x[0]) }), campo(c, 'aceroViga', 'Acero', { sel:SEL_ACERO }), campo(c, 'holgura', 'Holgura viga–soporte [mm]', { h:'Del extremo de la viga a la cara del soporte' }))],
    ['des', 'Destaje de la viga', () => des === 'no' ? 'sin destaje' : `${des === 'sup' ? 'ala superior' : 'las dos alas'} · dc ${c.dct}${des === 'ambos' ? ` / ${c.dcb}` : ''} mm · c ${c.cDes} mm`,
      g3(campo(c, 'destaje', 'Destaje', { sel:[['no', 'Sin destaje'], ['sup', 'Ala superior'], ['ambos', 'Las dos alas']], h:'Recorte de las alas para que la viga entre en el soporte (p. ej. al alma de una viga principal)' }),
        ...(des === 'no' ? [] : [campo(c, 'dct', 'Profundidad arriba dc [mm]', { h:'Desde el borde superior de la viga' }), ...(des === 'ambos' ? [campo(c, 'dcb', 'Profundidad abajo [mm]')] : []),
          campo(c, 'cDes', 'Largo del destaje c [mm]', { h:'Desde el extremo de la viga' }), campo(c, 'LevB', 'Perno superior al corte LevB [mm]', { h:'Borde en el alma de la viga, hacia el destaje' })]))],
    ['sop', 'Soporte', () => `${SOPN[c.soporte]} · t ${c.tSop} mm · ${c.aceroSop}`,
      g3(campo(c, 'soporte', 'Se suelda a', { sel:Object.entries(SOPN) }), campo(c, 'tSop', 'Espesor del soporte [mm]'), campo(c, 'aceroSop', 'Acero', { sel:SEL_ACERO }))
      + (c.soporte !== 'ala' ? `<div class="f"><label class="ck"><input type="checkbox" data-k="dosLados" ${c.dosLados ? 'checked' : ''} ${esIng() ? '' : 'disabled'}/> Hay otra conexión al otro lado del alma</label></div>` : '')],
    ['chapa', 'Chapa', () => `PL ${c.tp} mm · ${c.aceroPl} · a = ${c.a} mm`,
      g3(campo(c, 'tp', 'Espesor tp [mm]'), campo(c, 'aceroPl', 'Acero', { sel:SEL_ACERO }), campo(c, 'a', 'a: soporte a la línea de pernos [mm]', { h:'Convencional: a ≤ 89 mm (3½")' }))],
    ['pern', 'Pernos', () => `${c.n} × ${dnom(c)} ${c.grado}-${c.rosca} · s ${c.s} · bordes ${c.Lev}/${c.Leh}${c.agujeros === 'SSLT' ? ' · ranura corta' : ''}`,
      g3(...pernosTipo) + g3(campo(c, 'n', 'Número de pernos n', { h:'De 2 a 12, en una columna' }), campo(c, 's', 'Separación s [mm]'), campo(c, 'agujeros', 'Agujeros', { sel:[['STD', 'Estándar'], ['SSLT', 'Ranura corta horizontal']], h:'Ranura perpendicular a la carga' }), campo(c, 'Lev', 'Borde vertical Lev [mm]'), campo(c, 'Leh', 'Borde horizontal Leh [mm]', { h:'≥ 2d' }))],
    ['sold', 'Soldadura chapa–soporte', () => `filete ${c.w} mm ${c.electrodo} por ambas caras`,
      g3(campo(c, 'w', 'Pierna del filete w [mm]', { h:'Mínimo 5/8·tp (Manual AISC parte 10)' }), campo(c, 'electrodo', 'Electrodo', { sel:Object.keys(Conex.ELECTRODOS) }))] ]; }
  const SELP = (k, l, vacio) => campo(c, k, l, { sel:[...(vacio ? [['', vacio]] : []), ...(window.PERFILES_LAM || []).map(x => [x[0], x[0]])] });
  const ck = (k, t) => `<div class="f"><label class="ck"><input type="checkbox" data-k="${k}" ${c[k] ? 'checked' : ''} ${esIng() ? '' : 'disabled'}/> ${t}</label></div>`;
  const solds = () => ['sold', 'Soldaduras viga–placa', () => `alas ${c.soldAla === 'cjp' ? 'penetración completa' : `filete ${c.wAla} mm`} · alma filete ${c.wAlma} mm · ${c.electrodo}`,
      g3(campo(c, 'soldAla', 'Alas', { sel:[['filete', 'Filete por ambas caras'], ['cjp', 'Penetración completa']] }), c.soldAla === 'cjp' ? '' : campo(c, 'wAla', 'Filete de las alas w [mm]'), campo(c, 'wAlma', 'Filete del alma w [mm]', { h:'Por ambas caras' }), campo(c, 'electrodo', 'Electrodo', { sel:Object.keys(Conex.ELECTRODOS) }))];
  const colSec = () => ['col', 'Columna', () => c.columna ? `${c.columna} · ${c.aceroCol}${c.colTope ? ' · en el extremo superior' : ''}` : 'sin revisar',
      g3(SELP('columna', 'Perfil', '— No revisar la columna —'), campo(c, 'aceroCol', 'Acero', { sel:SEL_ACERO })) + ck('colTope', 'La unión está en el extremo superior de la columna (menos de d de la punta)')];
  if(c.tipo === 'empZ') return [
    ['viga', 'Viga', () => `${c.viga} · ${c.aceroViga}`, g3(SELP('viga', 'Perfil'), campo(c, 'aceroViga', 'Acero', { sel:SEL_ACERO }), campo(c, 'a', 'Desfase del corte a [mm]', { h:'Tramo horizontal del corte en Z, en el eje del alma' }))],
    ['sold', 'Soldadura', () => c.union === 'pjp' ? `penetración parcial · E alas ${c.Ef || '—'} · alma ${c.Ew || '—'} mm · ${c.electrodo}` : 'penetración completa en alas y alma',
      g3(campo(c, 'union', 'Tipo', { sel:[['cjp', 'Penetración completa'], ['pjp', 'Penetración parcial']] }),
        ...(c.union === 'pjp' ? [campo(c, 'Ef', 'Garganta efectiva en alas E [mm]', { h:'Vacío = tf/2' }), campo(c, 'Ew', 'Garganta efectiva en el alma E [mm]', { h:'Vacío = tw/2' }), campo(c, 'electrodo', 'Electrodo', { sel:Object.keys(Conex.ELECTRODOS) })] : []))],
    ['rat', 'Ratonera y cortante en el alma', () => `ratonera ${c.hRat || 'mín.'} × ${c.Lrat || 'mín.'} mm · ${c.vMedia === 'mitad' ? 'V2/2 en la media alma' : 'V2 completo en la media alma'}`,
      g3(campo(c, 'hRat', 'Alto de la ratonera [mm]', { h:'Vacío = máx(tw; 19 mm)' }), campo(c, 'Lrat', 'Largo de la ratonera [mm]', { h:'Vacío = máx(1.5tw; 38 mm)' }),
        campo(c, 'vMedia', 'Cortante que pasa por la media alma cortada', { sel:[['todo', 'V2 completo (conservador)'], ['mitad', 'V2/2 (la otra mitad sigue entera)']] }))],
    ['sis', 'Sismo', () => ['DMO', 'DES'].includes(c.sismo) ? `${c.sismo} · empalme a ${c.xEmp || '—'} mm de la cara de la columna` : 'sin requisitos sísmicos',
      g3(campo(c, 'sismo', 'Pórtico', { sel:[['no', 'Sin requisitos sísmicos (DMI o gravedad)'], ['DMO', 'DMO (pórtico intermedio)'], ['DES', 'DES (pórtico especial)']] }),
        ...(['DMO', 'DES'].includes(c.sismo) ? [campo(c, 'xEmp', 'Distancia del empalme a la cara de la columna [mm]', { h:'Debe quedar fuera de la zona de rótula (≥ d)' })] : []))
      + `<div class="f"><label class="ck"><input type="checkbox" data-k="vigaGrav" ${c.vigaGrav ? 'checked' : ''} ${esIng() ? '' : 'disabled'}/> Esta viga NO hace parte del pórtico sísmico (viga de gravedad): el empalme va sin requisitos sísmicos</label></div>`] ];
  const RIGS = { auto:'Automático (las diseña si hacen falta)', si:'Sí, siempre', no:'No poner' }, tub = c.miembro === 'tubo';
  if(c.tipo === 'soldada') return [
    ['miem', 'Miembro soldado', () => c.miembro === 'tubo' ? `Tubo ${c.H}×${c.B}×${c.tt} mm · ${c.aceroViga}` : `${c.viga} · ${c.aceroViga}`,
      g3(campo(c, 'miembro', 'Tipo', { sel:[['I', 'Perfil I'], ['tubo', 'Tubo rectangular']] }), c.miembro === 'tubo' ? '' : SELP('viga', 'Perfil'), campo(c, 'aceroViga', 'Acero', { sel:SEL_ACERO }))
      + (c.miembro === 'tubo' ? g3(campo(c, 'H', 'Alto H [mm]', { h:'En la dirección 2' }), campo(c, 'B', 'Ancho B [mm]'), campo(c, 'tt', 'Espesor t [mm]')) : '')],
    ...(c.soporte === 'alma' ? [['sold', 'Soldadura del alma de la viga', () => c.union === 'cjp' ? 'penetración completa' : `filete ${c.w} mm por ambas caras · ${c.electrodo}`,
      g3(campo(c, 'union', 'Tipo', { sel:[['filete', 'Filete por ambas caras'], ['cjp', 'Penetración completa']] }), c.union === 'cjp' ? '' : campo(c, 'w', 'Filete del alma [mm]', { h:'Al alma de la columna; toma el cortante V2' }), campo(c, 'electrodo', 'Electrodo', { sel:Object.keys(Conex.ELECTRODOS) }))]] : []),
    ...(c.soporte === 'alma' ? [] : [['sold', 'Soldadura en todo el perímetro', () => c.union === 'cjp' ? 'penetración completa' : `filete ${tub ? 'b' : 'alas'} ${c.w} mm · ${tub ? 'd' : 'alma'} ${nz(c.wAlma) > 0 ? c.wAlma : c.w} mm · ${c.electrodo}${c.kds ? ' · con aumento por dirección' : ''}`,
      g3(campo(c, 'union', 'Tipo de soldadura', { sel:[['filete', 'Filete en todo el contorno'], ['cjp', 'Penetración completa']] }),
        ...(c.union === 'cjp' ? [] : [campo(c, 'w', tub ? 'Filete caras horizontales (b) [mm]' : 'Filete de las alas w [mm]'), campo(c, 'wAlma', tub ? 'Filete caras verticales (d) [mm]' : 'Filete del alma [mm]', { h:'Vacío = igual al anterior' }), campo(c, 'electrodo', 'Electrodo', { sel:Object.keys(Conex.ELECTRODOS) })]))
      + (c.union === 'cjp' ? '' : ck('kds', 'Aplicar el aumento por dirección del filete (1 + 0.5·sen^1.5θ, J2-5): más resistencia donde la fuerza va de frente al cordón'))]]),
    ...(c.soporte === 'alma' || tub ? [] : [['cart', 'Cartela bajo la viga', () => ({ no:'sin cartela', T:'A · de perfil (T cortada)', arm:'B · de platinas', pl:'D · platina sola' }[c.cart || 'no']) + (c.cart && c.cart !== 'no' ? ` · Lh ${c.LhC} × hh ${c.hhC} mm` : ''),
      conFig(g3(campo(c, 'cart', 'Tipo de cartela', { sel:[['no', 'Sin cartela'], ['T', 'A · De perfil (T cortada)'], ['arm', 'B · De platinas (alma + patín)'], ['pl', 'D · Platina sola (sin patín)']] }),
        ...(c.cart && c.cart !== 'no' ? [campo(c, 'LhC', 'Largo Lh [mm]', { h:'A lo largo de la viga, desde la cara' }), campo(c, 'hhC', 'Alto hh [mm]', { h:'En la cara de la columna; θ ≈ 30° es lo usual' }),
          ...(c.cart === 'T' ? [SELP('perfilCart', 'Perfil del que se corta', '— el mismo de la viga —')] : []),
          ...(c.cart === 'arm' || c.cart === 'pl' ? [campo(c, 'tcw', c.cart === 'pl' ? 'Espesor de la platina [mm]' : 'Espesor del alma [mm]')] : []),
          ...(c.cart === 'arm' ? [campo(c, 'bph', 'Ancho del patín [mm]', { h:'≤ ancho del ala de la viga' }), campo(c, 'tph', 'Espesor del patín [mm]'), campo(c, 'wPA', 'Filete patín–alma [mm]')] : []),
          campo(c, 'aceroCart', 'Acero de la cartela', { sel:[['', '— el de la viga —'], ...SEL_ACERO.map(x => Array.isArray(x) ? x : [x, x])] }),
          campo(c, 'wC', 'Filete cartela–viga [mm]', { h:'2 cordones a lo largo de Lh' }), ...(c.union === 'cjp' ? [] : [campo(c, 'wCc', 'Filete cartela–columna [mm]', { h:'Con penetración completa no aplica' })])] : []))
        + (c.cart && c.cart !== 'no' ? ck('rigPunta', 'Rigidizadores en la viga en la punta de la cartela (si el alma no aguanta la fuerza del patín)') : '')
        + (c.cart === 'pl' ? '<div class="note amber">Platina sola: solo para estructuras livianas; se revisa el largo del borde libre. Con sismo DMO o DES no sirve.</div>' : '')
        + (c.cart && c.cart !== 'no' && (c.sismo === 'DMO' || c.sismo === 'DES') ? '<div class="note red">La viga con cartela soldada no es una conexión precalificada (AISC 358): con DMO o DES la conexión sale «No cumple».</div>' : ''),
        figCartela(c.cart))]]),
    ['sop', 'Soporte', () => c.soporte === 'placa' ? `Placa t ${c.tSop} mm · ${c.aceroSop}` : c.columna ? `${c.soporte === 'alma' ? 'Alma' : 'Ala'} de ${c.columna} · ${c.aceroCol}${c.dosLados ? ` · viga al otro lado M₂ ${c.Mu2}` : ''} · placas: ${(RIGS[c.rigCol || 'auto'] || '').split(' (')[0].toLowerCase()}` : 'columna sin revisar',
      g3(campo(c, 'soporte', 'Se suelda a', { sel:[['col', 'Ala de una columna (eje fuerte)'], ['alma', 'Alma de una columna (eje débil)'], ['placa', 'Una placa']] }),
        ...(c.soporte === 'placa' ? [campo(c, 'tSop', 'Espesor de la placa [mm]'), campo(c, 'aceroSop', 'Acero', { sel:SEL_ACERO })]
          : [SELP('columna', 'Perfil de la columna', '— No revisar la columna —'), campo(c, 'aceroCol', 'Acero', { sel:SEL_ACERO })]))
      + (c.soporte === 'placa' ? figPlacaApoyo() : '')
      + (c.soporte === 'placa' || !c.columna ? '' : (c.soporte === 'alma' ? '' : ck('colTope', 'La unión está en el extremo superior de la columna'))
        + ck('dosLados', c.soporte === 'alma' ? 'Llega otra viga a momento al otro lado del alma' : 'Llega otra viga a momento al otro lado de la columna')
        + (c.dosLados ? g3(campo(c, 'Mu2', 'Momento de la otra viga M₂ [kN·m]', { h:'Misma altura de viga' }), campo(c, 'sentido2', 'Los dos momentos', { sel:[['opuesto', 'Opuestos (cargas de gravedad)'], ['mismo', 'Mismo sentido (sismo o viento)']], h:'Opuestos: el alma se aprieta por los dos lados (J10-8). Mismo sentido: el panel recibe la suma' })) : '')
        + `<h4 class="sub">Placas de continuidad de la columna${c.soporte === 'alma' ? ' (obligatorias si hay momento)' : ''}</h4>`
        + (c.soporte === 'alma'
          ? conFig(`<div class="fg g3">${[c.miembro === 'tubo' ? `<div class="fld"><label>Unión del tubo a las placas</label><div class="hint">Placa traslapada sobre la cara superior e inferior del tubo, con filete (con tubo no se puede a tope)</div></div>` : campo(c, 'uDebil', 'Unión de las alas a las placas', { sel:[['trasl', 'B · Placa traslapada con filete'], ['tope', 'A · Alas a tope (CJP)']] }), campo(c, 'rigCol', 'Placas', { sel:Object.entries(RIGS) }),
              ...(c.rigCol === 'no' ? [] : [campo(c, 'tsC', 'Espesor ts [mm]', { h:'Vacío = automático' }), campo(c, 'wsC', 'Filete placa–columna [mm]', { h:'Vacío = automático' }), campo(c, 'aceroRigC', 'Acero', { sel:SEL_ACERO })]),
              ...(opDebil(c) === 'tope' ? [] : [campo(c, 'Lt', 'Traslapo Lt [mm]', { h:c.miembro === 'tubo' ? 'Largo de la placa sobre la cara del tubo' : 'Largo de la placa sobre el ala' }), campo(c, 'wT', c.miembro === 'tubo' ? 'Filete placa–tubo [mm]' : 'Filete placa–ala [mm]')])].join('')}</div>`, figCorteDebil(opDebil(c), c.dosLados, c.miembro === 'tubo'), 'ancho')
          : conFig(`<div class="fg g2">${[campo(c, 'rigCol', 'Placas', { sel:Object.entries(RIGS) }), ...(c.rigCol === 'no' ? [] : [campo(c, 'tsC', 'Espesor ts [mm]', { h:'Vacío = automático' }), campo(c, 'wsC', 'Filete [mm]', { h:['DMO', 'DES'].includes(c.sismo) ? 'Al alma (a las alas va con penetración completa); vacío = automático' : 'Vacío = automático' }), campo(c, 'unPlW', 'Placas al alma', { sel:[['filete', 'Filete'], ['cjp', 'Penetración completa']], h:'El filete no puede pasar el espesor del alma' }), campo(c, 'aceroRigC', 'Acero', { sel:SEL_ACERO })])].join('')}</div>`, figContinuidad(c.dosLados, Conex.perfil(c.columna), ['DMO', 'DES'].includes(c.sismo))) + doublerHTML(c, campo, ck)))],
    ['sis', 'Sismo', () => c.sismo === 'DMO' || c.sismo === 'DES' ? `${c.sismo} · WUF-W · L ${c.Lh} m · Vg ${c.Vg} kN` : 'sin requisitos sísmicos',
      g3(campo(c, 'sismo', 'Pórtico', { sel:[['no', 'Sin requisitos sísmicos (DMI o gravedad)'], ['DMO', 'DMO (pórtico intermedio)'], ['DES', 'DES (pórtico especial)']] }),
        ...(c.sismo === 'DMO' || c.sismo === 'DES' ? [campo(c, 'Lh', 'Luz libre de la viga L [m]', { h:'Entre caras de columnas (la rótula queda en la cara); en el Anexo E sale del modelo' }), campo(c, 'Vg', 'Vg: cortante de gravedad [kN]', { h:'1.2D + 0.5L (o la del modelo)' })] : []))
      + (c.sismo === 'DMO' || c.sismo === 'DES' ? (c.soporte === 'alma' ? '<div class="note red">Al alma de la columna (eje débil) no hay conexión precalificada para DMO ni DES: la conexión sale «No cumple».</div>'
        : `<div class="note${c.union === 'cjp' && !tub ? '' : ' red'}">Conexión precalificada WUF-W (AISC 358 cap. 8): alas y alma de penetración completa, diseño con el momento probable de la viga Mpr. ${c.union === 'cjp' && !tub ? '' : 'Con filete o con tubo NO está precalificada: la conexión sale «No cumple».'}</div>`) : '')] ];
  if(c.tipo === 'ras') return [
    ['viga', 'Viga', () => `${c.viga} · ${c.aceroViga}`, g3(SELP('viga', 'Perfil'), campo(c, 'aceroViga', 'Acero', { sel:SEL_ACERO }))], colSec(),
    ['placa', 'Placa de testa', () => `PL ${c.tp} × ${c.bp} mm ${c.aceroPl} · ${c.placaTipo === 'delgada' ? 'delgada con palanca' : 'gruesa sin palanca'}`,
      g3(campo(c, 'placaTipo', 'Método de la placa', { sel:[['gruesa', 'Placa gruesa (sin palanca)'], ['delgada', 'Placa delgada (con palanca)']], h:c.placaTipo === 'delgada' ? 'Placa más liviana; los pernos se revisan con la fuerza de palanca' : 'Placa más gruesa; los pernos solo con tensión directa' }),
        campo(c, 'tp', 'Espesor tp [mm]'), campo(c, 'bp', 'Ancho bp [mm]', { h:'Entre bf y bf + 25 mm' }), campo(c, 'aceroPl', 'Acero', { sel:SEL_ACERO }))
      + ck('ambos', 'El momento cambia de sentido (pernos también bajo el ala inferior)')],
    ['pern', 'Pernos', () => `${c.filas} fila(s) × 2 · ${dnom(c)} ${c.grado}-${c.rosca} · g ${c.g} · pfi ${c.pfi}${+c.filas === 2 ? ` · pb ${c.pb}` : ''}`,
      g3(...pernosTipo) + g3(campo(c, 'filas', 'Filas bajo el ala en tensión', { sel:[['1', '1 fila (2 pernos)'], ['2', '2 filas (4 pernos)']] }), campo(c, 'g', 'Gramil g [mm]'), campo(c, 'pfi', 'pfi: ala a 1.ª fila [mm]'),
        +c.filas === 2 ? campo(c, 'pb', 'pb: entre filas [mm]') : '', c.ambos ? '' : campo(c, 'nbc', 'Pernos de cortante abajo'))
      + ck('cortTodos', 'El cortante lo toman todos los pernos (los de arriba se revisan con tensión y cortante, J3-7)')], solds(),
    ['sis', 'Sismo', () => c.sismo === 'DMO' || c.sismo === 'DES' ? `pórtico ${c.sismo} — no precalificada` : 'sin requisitos sísmicos',
      g3(campo(c, 'sismo', 'Pórtico', { sel:[['no', 'Sin requisitos sísmicos (DMI o gravedad)'], ['DMO', 'DMO (pórtico intermedio)'], ['DES', 'DES (pórtico especial)']] }))
      + (c.sismo === 'DMO' || c.sismo === 'DES' ? '<div class="note red">La chapa de testa a ras NO está precalificada para pórticos DMO ni DES (AISC 358): la conexión sale «No cumple». Use la chapa de testa extendida (4E u 8ES) o la soldada.</div>' : '')] ];
  if(c.tipo === 'testaV') return [
    ['viga', 'Viga apoyada', () => `${c.viga} · ${c.aceroViga}`, g3(SELP('viga', 'Perfil'), campo(c, 'aceroViga', 'Acero', { sel:SEL_ACERO }))],
    ['sop', 'Soporte', () => `t ${c.tSop} mm · ${c.aceroSop}`, g3(campo(c, 'tSop', 'Espesor del soporte [mm]', { h:'Ala o alma de la columna, alma de la viga' }), campo(c, 'aceroSop', 'Acero', { sel:SEL_ACERO })) + ck('dosLados', 'Hay otra conexión al otro lado (comparte los pernos)')],
    ['placa', 'Placa', () => `PL ${c.bp} × ${c.tp} mm ${c.aceroPl}`, g3(campo(c, 'tp', 'Espesor tp [mm]', { h:'Delgada para que gire: ≤ 10 mm' }), campo(c, 'bp', 'Ancho bp [mm]'), campo(c, 'aceroPl', 'Acero', { sel:SEL_ACERO }))],
    ['pern', 'Pernos', () => `2 × ${c.n} de ${dnom(c)} ${c.grado}-${c.rosca} · s ${c.s} · g ${c.g}`,
      g3(...pernosTipo) + g3(campo(c, 'n', 'Pernos por columna n'), campo(c, 's', 'Separación s [mm]'), campo(c, 'Lev', 'Borde vertical Lev [mm]'), campo(c, 'g', 'Gramil g [mm]'))],
    ['sold', 'Soldadura alma–placa', () => `filete ${c.w} mm ${c.electrodo} por ambas caras`, g3(campo(c, 'w', 'Pierna del filete w [mm]'), campo(c, 'electrodo', 'Electrodo', { sel:Object.keys(Conex.ELECTRODOS) }))] ];
  if(c.tipo === 'asiento'){ const sold = c.unSop === 'sold', rig = !!c.rig;
    return [
    ['viga', 'Viga apoyada', () => `${c.viga} · ${c.aceroViga} · holgura ${c.holgura} mm`, g3(SELP('viga', 'Perfil'), campo(c, 'aceroViga', 'Acero', { sel:SEL_ACERO }), campo(c, 'holgura', 'Holgura viga–soporte [mm]'))],
    ['sop', 'Soporte', () => `t ${c.tSop} mm · ${c.aceroSop} · ${sold ? `soldado, filete ${c.wS} mm` : 'atornillado'}`,
      g3(campo(c, 'unSop', 'Asiento al soporte', { sel:[['pernos', 'Atornillado'], ['sold', 'Soldado']] }), campo(c, 'tSop', 'Espesor del soporte [mm]'), campo(c, 'aceroSop', 'Acero', { sel:SEL_ACERO }),
        ...(sold ? [...(rig ? [] : [campo(c, 'wS', 'Filete w [mm]', { h:'En los dos bordes verticales del angular, con retorno de 2w arriba' })]), campo(c, 'electrodo', 'Electrodo', { sel:Object.keys(Conex.ELECTRODOS) })] : []))],
    ['ang', 'Angular de asiento', () => `L ${c.bv}×${c.bh}×${c.t} mm · largo ${c.La} mm · ${c.aceroAng}`,
      g3(campo(c, 'bv', 'Ala vertical bv [mm]'), campo(c, 'bh', 'Ala horizontal bh [mm]', { h:'Donde se apoya la viga' }), campo(c, 't', 'Espesor t [mm]'), campo(c, 'La', 'Largo del angular La [mm]', { h:'Recomendado ≥ ancho del ala de la viga' }), campo(c, 'aceroAng', 'Acero', { sel:SEL_ACERO }))],
    ['rig', 'Platina de rigidez (pie de amigo)', () => rig ? `PL triangular ${c.ts} mm · W ${c.W} × alto ${c.hs} mm · filete ${c.wR} mm` : 'sin platina',
      `<div class="f"><label class="ck"><input type="checkbox" data-k="rig" ${rig ? 'checked' : ''} ${esIng() ? '' : 'disabled'}/> Asiento rigidizado con una platina triangular bajo el ala horizontal</label><div class="hint">Cuando el angular solo no resiste la flexión. La carga se toma a 0.8W de la cara del soporte (Manual AISC parte 10).</div></div>`
      + (rig ? g3(campo(c, 'ts', 'Espesor ts [mm]'), campo(c, 'W', 'Ancho W [mm]', { h:'Horizontal, bajo el ala del asiento' }), campo(c, 'hs', 'Alto [mm]', { h:sold ? 'Vertical, soldado al soporte' : 'Vertical, dentro del ala del angular' }), campo(c, 'aceroRig', 'Acero', { sel:SEL_ACERO }), campo(c, 'wR', 'Filetes de la platina w [mm]'),
        ...(sold ? [] : [campo(c, 'electrodo', 'Electrodo', { sel:Object.keys(Conex.ELECTRODOS) })])) : '')],
    ...(sold ? [] : [['pern', 'Pernos al soporte', () => `${2 * c.filas} × ${dnom(c)} ${c.grado}-${c.rosca} · g ${c.g}${c.cizalla ? ' · cizalla' : ''}`,
      g3(...pernosTipo) + g3(campo(c, 'filas', 'Filas (2 pernos por fila)'), campo(c, 'g', 'Gramil g [mm]'), campo(c, 'ev', 'Del talón a la fila superior [mm]'))]]) ]; }
  if(c.tipo === 'empCol'){ const un = c.union || 'pernos', TIP = { pernos:'Atornillado con cubrejuntas', cjp:'Soldado de penetración completa', placa:'Con placa de tope soldada' };
    return [
    ['col', 'Columnas', () => `${c.colI}${c.colS && c.colS !== c.colI ? ` abajo · ${c.colS} arriba` : ''} · ${c.acero}`,
      g3(SELP('colI', 'Columna de abajo'), SELP('colS', 'Columna de arriba', '— Igual a la de abajo —'), campo(c, 'acero', 'Acero', { sel:SEL_ACERO }))],
    ['tipo', 'Tipo de empalme', () => `${TIP[un]} · sin contacto`,
      g3(campo(c, 'union', 'Tipo', { sel:Object.entries(TIP) }), ...(un === 'pernos' ? [campo(c, 'gap', 'Separación entre columnas [mm]')] : []))
      + '<div class="hint">Sin contacto entre los extremos de las columnas: el empalme toma toda la carga, también la compresión.</div>'],
    ...(un === 'pernos' ? [
      ['alas', 'Cubrejuntas de las alas', () => `PL ${c.bpf} × ${c.tpf} mm · ${2 * c.nf} pernos por lado · s ${c.sf} · g ${c.gf}`,
        g3(campo(c, 'bpf', 'Ancho bpf [mm]', { h:'≤ bf de la columna menor' }), campo(c, 'tpf', 'Espesor tpf [mm]'), campo(c, 'aceroPl', 'Acero de las platinas', { sel:SEL_ACERO }), campo(c, 'nf', 'Filas por lado (2 pernos c/u)'), campo(c, 'sf', 'Separación sf [mm]'), campo(c, 'gf', 'Gramil gf [mm]'), campo(c, 'Lef', 'Borde Lef [mm]', { h:'Del extremo de la columna y de la platina a la primera fila' }))],
      ['alma', 'Cubrejuntas del alma (2)', () => `PL ${c.hpw} × ${c.tpw} mm · ${c.nw} pernos por lado · s ${c.sw}`,
        g3(campo(c, 'hpw', 'Ancho hpw [mm]', { h:'Cabe entre las alas (≤ T)' }), campo(c, 'tpw', 'Espesor tpw [mm]'), campo(c, 'nw', 'Pernos por lado nw', { h:'Mínimo 2' }), campo(c, 'sw', 'Separación sw [mm]'), campo(c, 'Lew', 'Borde Lew [mm]'), campo(c, 'Lehw', 'Junta a los pernos Lehw [mm]'))],
      ['pern', 'Pernos', () => `${dnom(c)} ${c.grado}-${c.rosca}${c.desliz ? ` · deslizamiento crítico clase ${c.claseSup || 'A'}` : ''}`, g3(...pernosTipo)
        + ck('desliz', 'Pernos de deslizamiento crítico (J3-8): necesarios con rellenos gruesos o cargas que cambian de sentido')
        + (c.desliz ? g3(campo(c, 'claseSup', 'Superficie de contacto', { sel:[['A', 'Clase A (μ = 0.30)'], ['B', 'Clase B (μ = 0.50)']] })) : '')]] : []),
    ...(un === 'placa' ? [
      ['placa', 'Placa de tope', () => `PL ${c.Bpl || 'auto'} × ${c.Npl || 'auto'} × ${c.tpb} mm · ${c.aceroPl}`,
        g3(campo(c, 'tpb', 'Espesor [mm]'), campo(c, 'Bpl', 'Ancho B [mm]', { h:'Vacío = bf mayor + 40' }), campo(c, 'Npl', 'Largo N [mm]', { h:'Vacío = d mayor + 40' }), campo(c, 'aceroPl', 'Acero', { sel:SEL_ACERO }))],
      ['sold', 'Soldaduras a la placa', () => `filetes ${c.wS} mm (arriba) · ${c.wI} mm (abajo) · ${c.electrodo}`,
        g3(campo(c, 'wS', 'Filete columna de arriba [mm]', { h:'En todo el contorno' }), campo(c, 'wI', 'Filete columna de abajo [mm]', { h:'En todo el contorno' }), campo(c, 'electrodo', 'Electrodo', { sel:Object.keys(Conex.ELECTRODOS) }))]] : []),
    ['sis', 'Sismo', () => ['DMO', 'DES'].includes(c.sismo) ? `${c.sismo} · a ${c.hEmp || '—'} m de la viga · H ${c.Hcol || '—'} m` : 'sin requisitos sísmicos',
      g3(campo(c, 'sismo', 'Pórtico', { sel:[['no', 'Sin requisitos sísmicos (DMI o gravedad)'], ['DMO', 'DMO (pórtico intermedio)'], ['DES', 'DES (pórtico especial)']] }),
        ...(['DMO', 'DES'].includes(c.sismo) ? [campo(c, 'hEmp', 'Distancia del empalme a la viga [m]', { h:'Al ala de la viga más cercana; ≥ 1.2 m' }), campo(c, 'Hcol', 'Altura libre de la columna H [m]', { h:'Para el cortante ΣMpc/H' })] : []))
      + (['DMO', 'DES'].includes(c.sismo) ? `<div class="note${un === 'placa' ? ' red' : ''}">AISC 341: el empalme se diseña para Ry·Fy·Zx de la columna menor y el cortante ΣMpc/H; las fuerzas axiales del modelo deben incluir Ω0.${un === 'placa' ? ' Con filetes a una placa de tope NO se acepta: use atornillado o penetración completa.' : ''}</div>` : '')] ]; }
  if(c.tipo === 'empalme') return [
    ['viga', 'Viga', () => `${c.viga} · ${c.aceroViga} · separación ${c.gap} mm${c.resComp ? ' · a resistencia completa' : ''}`, g3(SELP('viga', 'Perfil'), campo(c, 'aceroViga', 'Acero', { sel:SEL_ACERO }), campo(c, 'gap', 'Separación entre tramos [mm]'))
      + ck('resComp', 'Diseñar a resistencia completa: con lo máximo que la viga resiste en el empalme (φMn y φVn), no con las cargas del modelo')],
    ['alas', 'Cubrejuntas de las alas', () => `PL ${c.bpf} × ${c.tpf} mm · ${2 * c.nf} pernos por lado · s ${c.sf} · g ${c.gf}`,
      g3(campo(c, 'bpf', 'Ancho bpf [mm]'), campo(c, 'tpf', 'Espesor tpf [mm]'), campo(c, 'aceroPl', 'Acero de las platinas', { sel:SEL_ACERO }), campo(c, 'nf', 'Filas por lado (2 pernos c/u)'), campo(c, 'sf', 'Separación sf [mm]'), campo(c, 'gf', 'Gramil gf [mm]'), campo(c, 'Lef', 'Borde Lef [mm]'))
      + ck('interior', 'Agregar cubrejuntas interiores (una a cada lado del alma, por dentro del ala): los pernos del ala trabajan en doble cortante')
      + (c.interior ? g3(campo(c, 'tpi', 'Espesor interiores tpi [mm]'), campo(c, 'bpi', 'Ancho de cada interior bpi [mm]', { h:'Vacío = el que cabe entre el radio y el borde del ala' })) : '')],
    ['alma', 'Cubrejuntas del alma (2)', () => `PL ${c.hpw} × ${c.tpw} mm · ${+c.ncw === 2 ? `2 columnas de ${c.nw}` : c.nw} pernos por lado · s ${c.sw}${+c.ncw === 2 ? ` · gw ${c.gw}` : ''}`,
      g3(campo(c, 'hpw', 'Alto hpw [mm]'), campo(c, 'tpw', 'Espesor tpw [mm]'), campo(c, 'ncw', 'Columnas de pernos por lado', { sel:[['1', '1 columna'], ['2', '2 columnas']] }),
        campo(c, 'nw', +c.ncw === 2 ? 'Pernos por columna nw' : 'Pernos por lado nw'), campo(c, 'sw', 'Separación vertical sw [mm]'), ...(+c.ncw === 2 ? [campo(c, 'gw', 'Separación entre columnas gw [mm]', { h:'≥ 2.67d' })] : []),
        campo(c, 'Lew', 'Borde Lew [mm]', { h:'Vertical y horizontal' }), campo(c, 'Lehw', 'Junta a los pernos Lehw [mm]', { h:'Del extremo de la viga a la primera columna' }))],
    ['pern', 'Pernos', () => `${dnom(c)} ${c.grado}-${c.rosca}${c.desliz ? ` · deslizamiento crítico clase ${c.claseSup || 'A'}` : ''}`, g3(...pernosTipo)
      + ck('desliz', 'Pernos de deslizamiento crítico (J3-8): para cuando el momento cambia de sentido o la junta no se puede mover')
      + (c.desliz ? g3(campo(c, 'claseSup', 'Superficie de contacto', { sel:[['A', 'Clase A (μ = 0.30): limpia de laminado o con granallado y pintura clase A'], ['B', 'Clase B (μ = 0.50): granallada sin pintar o con pintura clase B']] })) : '')],
    ['sis', 'Sismo', () => ['DMO', 'DES'].includes(c.sismo) ? `${c.sismo} · empalme a ${c.xEmp || '—'} mm de la cara de la columna` : 'sin requisitos sísmicos',
      g3(campo(c, 'sismo', 'Pórtico', { sel:[['no', 'Sin requisitos sísmicos (DMI o gravedad)'], ['DMO', 'DMO (pórtico intermedio)'], ['DES', 'DES (pórtico especial)']] }),
        ...(['DMO', 'DES'].includes(c.sismo) ? [campo(c, 'xEmp', 'Distancia del empalme a la cara de la columna [mm]', { h:'Debe quedar fuera de la zona de rótula (≥ d)' })] : []))
      + `<div class="f"><label class="ck"><input type="checkbox" data-k="vigaGrav" ${c.vigaGrav ? 'checked' : ''} ${esIng() ? '' : 'disabled'}/> Esta viga NO hace parte del pórtico sísmico (viga de gravedad): el empalme va sin requisitos sísmicos</label></div>`] ];
  if(c.tipo === 'cartela'){ const red = c.diag === 'redondo', tbo = c.diag === 'tubo' || red; return [
    ['diag', 'Diagonal', () => tbo ? `Tubo ${red ? `redondo ⌀${c.Dt}` : `${c.Bt}×${c.Bt}`}×${c.tt} mm · ${c.aceroT} · ranurado y soldado` : `${+c.nL === 1 ? 'L' : '2L'} ${c.bL}×${c.bL}×${c.tL} mm · ${c.aceroL}`,
      g3(campo(c, 'diag', 'Tipo de diagonal', { sel:[['L', 'Angulares atornillados'], ['tubo', 'Tubo cuadrado ranurado y soldado'], ['redondo', 'Tubo redondo ranurado y soldado']] }),
        ...(tbo ? [red ? campo(c, 'Dt', 'Diámetro exterior D [mm]') : campo(c, 'Bt', 'Lado del tubo B [mm]'), campo(c, 'tt', 'Espesor nominal t [mm]', { h:'Se diseña con 0.93t' }), campo(c, 'aceroT', 'Acero', { sel:SEL_ACERO })]
          : [campo(c, 'nL', 'Angulares', { sel:[['1', '1 angular'], ['2', '2 angulares (espalda con espalda)']] }), campo(c, 'bL', 'Ala b [mm]'), campo(c, 'tL', 'Espesor t [mm]'), campo(c, 'aceroL', 'Acero', { sel:SEL_ACERO })]))],
    ...(tbo ? [['stub', 'Soldadura tubo–cartela', () => `4 filetes de ${c.wt} mm × ${c.Lws} mm · ${c.electrodo}`,
      g3(campo(c, 'Lws', 'Largo de cada cordón Lws [mm]', { h:red ? 'Traslapo sobre la cartela; ≥ D (con ≥ 1.3D, U = 1)' : 'Traslapo del tubo sobre la cartela; ≥ B' }), campo(c, 'wt', 'Filete w [mm]', { h:'4 cordones: 2 por cada cara ranurada' }), campo(c, 'electrodo', 'Electrodo', { sel:Object.keys(Conex.ELECTRODOS) }))]] : [
    ['pern', 'Pernos', () => `${c.n} × ${dnom(c)} ${c.grado}-${c.rosca} · s ${c.s} · Le ${c.Le} · ga ${c.ga}`,
      g3(...pernosTipo) + g3(campo(c, 'n', 'Número de pernos n'), campo(c, 's', 'Separación s [mm]'), campo(c, 'Le', 'Borde al extremo Le [mm]'), campo(c, 'ga', 'Gramil en el angular ga [mm]', { h:'Del talón a la línea de pernos' }), campo(c, 'Leg', 'Borde de la cartela Leg [mm]', { h:'Del perno más lejano al borde de la cartela' }))]]),
    ['cart', 'Cartela', () => `t ${c.tg} mm · ${c.aceroG} · Lcr ${c.Lcr} mm · K ${c.K}${nz(c.bWg) ? ` · ancho ${c.bWg} mm` : ''}`,
      conFig(`<div class="fg g2">${[campo(c, 'tg', 'Espesor tg [mm]'), campo(c, 'aceroG', 'Acero', { sel:SEL_ACERO }),
        campo(c, 'bWg', 'Ancho de la cartela en la sección de Whitmore [mm]', { h:'Vacío = la cartela es más ancha (no limita)' }), '<div></div>',
        campo(c, 'Lcr', 'Longitud de pandeo Lcr [mm]', { h:'Promedio L1, L2, L3 de la figura (Thornton)' }), campo(c, 'K', 'Factor K', { h:'0.5 bien sujeta · 0.65 un borde · 1.2 si se desplaza' })].join('')}</div>`, figLcr(tbo))],
    ['sold', 'Soldadura cartela–soporte', () => `filete ${c.w} mm · L ${c.Lwg} mm · θ ${c.theta}°${c.duct === false ? '' : ' · ×1.25'}${nz(c.eW) ? ` · e ${c.eW} mm` : ''}`,
      g3(campo(c, 'Lwg', 'Largo del cordón L [mm]'), campo(c, 'w', 'Filete w [mm]', { h:'Por ambas caras' }), campo(c, 'theta', 'θ: fuerza–cordón [°]', { h:'90° = fuerza perpendicular al cordón' }),
        campo(c, 'eW', 'Excentricidad e [mm]', { h:'Del eje de la diagonal al centro del cordón; 0 = pasa por el centro' }), ...(tbo ? [] : [campo(c, 'electrodo', 'Electrodo', { sel:Object.keys(Conex.ELECTRODOS) })]))
      + `<div class="f"><label class="ck"><input type="checkbox" data-k="duct" ${c.duct !== false ? 'checked' : ''} ${esIng() ? '' : 'disabled'}/> Diseñar la soldadura para 1.25 veces la fuerza (ductilidad, Manual AISC parte 13)</label></div>`],   // vacío en conexiones viejas = sí
    ['sis', 'Sismo', () => ['DMO', 'DES'].includes(c.sismo) ? `${c.sismo} · tensión Ry·Fy·Ag${nz(c.Pnd) ? ` · compresión 1.1·Ry·Pn (Pn ${c.Pnd} kN)` : ''}` : 'sin requisitos sísmicos',
      g3(campo(c, 'sismo', 'Pórtico arriostrado concéntrico', { sel:[['no', 'Sin requisitos sísmicos (DMI o gravedad)'], ['DMO', 'DMO (ordinario/moderado)'], ['DES', 'DES (especial)']] }),
        ...(['DMO', 'DES'].includes(c.sismo) ? [campo(c, 'Pnd', 'Pn de la diagonal a compresión [kN]', { h:'Resistencia nominal (sin φ), del Anexo D' })] : []))] ]; }
  if(c.tipo === 'base'){ const tb = c.colTipo === 'tubo', sisB = ['DMO', 'DES'].includes(c.sismo), cv = c.cortante || 'anclajes'; return [
    ['col', 'Columna', () => tb ? `Tubo ${c.Ht}×${c.Bt}×${c.tt} mm` : c.columna,
      g3(campo(c, 'colTipo', 'Tipo', { sel:[['I', 'Perfil I'], ['tubo', 'Tubo cuadrado o rectangular']] }),
        ...(tb ? [campo(c, 'Ht', 'Lado H [mm]', { h:'En el sentido N' }), campo(c, 'Bt', 'Lado B [mm]'), campo(c, 'tt', 'Espesor t [mm]', { h:'Se usa 0.93t' })] : [SELP('columna', 'Perfil')]))],
    ['placa', 'Placa base', () => `${c.N} × ${c.B} × ${c.tp} mm · ${c.aceroPlaca} · filete ${c.w} mm`,
      g3(campo(c, 'N', 'N [mm] (en el sentido del peralte)'), campo(c, 'B', 'B [mm]'), campo(c, 'tp', 'Espesor tp [mm]'), campo(c, 'aceroPlaca', 'Acero', { sel:SEL_ACERO }), campo(c, 'w', 'Soldadura columna–placa w [mm]', { h:'0 = no revisar' }), campo(c, 'electrodo', 'Electrodo', { sel:Object.keys(Conex.ELECTRODOS) }))],
    ['ped', 'Pedestal', () => `${c.Lp} × ${c.Wp} mm · alto ${c.ha} mm · f'c ${c.fc} MPa${c.fisurado ? ' · fisurado' : ''}`,
      g3(campo(c, 'Lp', 'Lado en el sentido N [mm]'), campo(c, 'Wp', 'Lado en el sentido B [mm]'), campo(c, 'ha', 'Altura [mm]'), campo(c, 'fc', "f'c [MPa]")) + ck('fisurado', 'Concreto fisurado (del lado seguro)') + ck('mortero', 'Hay mortero de nivelación bajo la placa') + (c.mortero ? g3(campo(c, 'grout', 'Espesor del mortero [mm]')) : '')],
    ['anc', 'Pernos de anclaje', () => `${2 * c.nB} × ${c.perno} ${c.anclaje} · S1 ${c.S1} · S2 ${c.S2} · hef ${c.hef}`,
      g3(campo(c, 'perno', 'Diámetro', { sel:['1/2"', '5/8"', '3/4"', '7/8"', '1"', '1-1/8"', '1-1/4"'] }), campo(c, 'anclaje', 'Acero', { sel:['A36', 'F1554 Gr 36', 'F1554 Gr 55', 'F1554 Gr 105'] }), campo(c, 'nB', 'Pernos por fila', { sel:['2', '3', '4'] }),
        campo(c, 'S1', 'S1: entre filas (sentido N) [mm]'), campo(c, 'S2', 'S2: extremos de la fila (sentido B) [mm]'), campo(c, 'hef', 'Empotramiento hef [mm]'),
        campo(c, 'cabeza', 'Anclaje', { sel:[['tuerca', 'Tuerca y arandela'], ['gancho', 'Gancho']] }), campo(c, 'arandela', 'Lado de la arandela [mm]'))
      + `<div class="f"><label class="ck"><input type="checkbox" data-k="arandSold" ${c.arandSold !== false ? 'checked' : ''} ${esIng() ? '' : 'disabled'}/> Arandelas de placa soldadas a la placa base (agujeros agrandados: si no se sueldan, el cortante lo toma la mitad de los pernos)</label></div>`],
    ['cort', 'Transmisión del cortante', () => cv === 'friccion' ? 'fricción (μ = 0.55)' : cv === 'llave' ? `llave ${c.lugB} × ${c.lugH} × ${c.lugT} mm · filete ${c.lugW} mm` : 'por los anclajes',
      g3(campo(c, 'cortante', 'El cortante lo toma', { sel:[['anclajes', 'Los pernos de anclaje'], ['friccion', 'Fricción placa–mortero (solo con compresión)'], ['llave', 'Llave de cortante bajo la placa']] }),
        ...(cv === 'llave' ? [campo(c, 'lugB', 'Ancho de la llave [mm]', { h:'Perpendicular al cortante' }), campo(c, 'lugH', 'Alto de la llave [mm]', { h:'Desde la placa; incluye el mortero' }), campo(c, 'lugT', 'Espesor de la llave [mm]'),
          campo(c, 'lugW', 'Filete llave–placa [mm]', { h:'Por ambas caras' }), campo(c, 'aceroLug', 'Acero', { sel:SEL_ACERO })] : []))],
    ['ref', 'Refuerzo de anclaje', () => !c.refT && !c.refV ? 'sin refuerzo (toma el concreto)' : [c.refT ? `tensión ${c.refNT} barras Ø${c.refDT}` : '', c.refV ? `cortante ${c.refNV} barras Ø${c.refDV}` : ''].filter(Boolean).join(' · '),
      ck('refT', 'Barras alrededor de los pernos que toman la tensión en vez del cono de concreto (C-D.5.2.9)')
      + (c.refT ? g3(campo(c, 'refNT', 'Ramas efectivas', { h:'Dentro de 0.5·hef del perno' }), campo(c, 'refDT', 'Diámetro de la barra [mm]'), campo(c, 'fyR', 'fy [MPa]')) : '')
      + ck('refV', 'Barras (estribos) que toman el cortante en vez del borde del concreto (C-D.6.2.9)')
      + (c.refV ? g3(campo(c, 'refNV', 'Ramas efectivas', { h:'Que cruzan la grieta del borde' }), campo(c, 'refDV', 'Diámetro de la barra [mm]'), c.refT ? '' : campo(c, 'fyR', 'fy [MPa]')) : '')],
    ['sis', 'Sismo', () => sisB ? `${c.sismo} · concreto ×0.75 · anclaje dúctil` : 'sin requisitos sísmicos',
      g3(campo(c, 'sismo', 'Pórtico', { sel:[['no', 'Sin requisitos sísmicos (DMI o gravedad)'], ['DMO', 'DMO'], ['DES', 'DES']] }))] ]; }
  if(c.tipo === 'angular'){ const sold = c.unSop === 'sold', des = c.destaje || 'no';
    return [
    ['viga', 'Viga apoyada', () => `${c.viga} · ${c.aceroViga} · holgura ${c.holgura} mm`,
      g3(campo(c, 'viga', 'Perfil', { sel:(window.PERFILES_LAM || []).map(x => x[0]) }), campo(c, 'aceroViga', 'Acero', { sel:SEL_ACERO }), campo(c, 'holgura', 'Holgura viga–soporte [mm]', { h:'Del extremo de la viga a la cara del soporte' }))],
    ['des', 'Destaje de la viga', () => des === 'no' ? 'sin destaje' : `${des === 'sup' ? 'ala superior' : 'las dos alas'} · dc ${c.dct}${des === 'ambos' ? ` / ${c.dcb}` : ''} mm · c ${c.cDes} mm`,
      g3(campo(c, 'destaje', 'Destaje', { sel:[['no', 'Sin destaje'], ['sup', 'Ala superior'], ['ambos', 'Las dos alas']], h:'Recorte de las alas para que la viga entre en el soporte' }),
        ...(des === 'no' ? [] : [campo(c, 'dct', 'Profundidad arriba dc [mm]', { h:'Desde el borde superior de la viga' }), ...(des === 'ambos' ? [campo(c, 'dcb', 'Profundidad abajo [mm]')] : []),
          campo(c, 'cDes', 'Largo del destaje c [mm]', { h:'Desde el extremo de la viga' }), campo(c, 'LevB', 'Perno superior al corte LevB [mm]', { h:'Borde en el alma de la viga, hacia el destaje' })]))],
    ['sop', 'Soporte', () => `${SOPN[c.soporte]} · t ${c.tSop} mm · ${c.aceroSop} · ${sold ? `soldados, filete ${c.wS} mm` : 'atornillados'}`,
      g3(campo(c, 'unSop', 'Angulares al soporte', { sel:[['pernos', 'Atornillados'], ['sold', 'Soldados']] }), campo(c, 'soporte', 'Soporte', { sel:Object.entries(SOPN) }), campo(c, 'tSop', 'Espesor del soporte [mm]'), campo(c, 'aceroSop', 'Acero', { sel:SEL_ACERO }),
        ...(sold ? [campo(c, 'wS', 'Filete w [mm]', { h:'En el borde de cada angular, con retorno de 2w arriba' }), campo(c, 'electrodo', 'Electrodo', { sel:Object.keys(Conex.ELECTRODOS) })] : []))
      + (c.soporte !== 'ala' ? `<div class="f"><label class="ck"><input type="checkbox" data-k="dosLados" ${c.dosLados ? 'checked' : ''} ${esIng() ? '' : 'disabled'}/> Hay otra conexión al otro lado del alma (${sold ? 'suelda sobre el mismo espesor' : 'comparte los pernos'})</label></div>` : '')],
    ['ang', 'Angulares', () => `2L ${c.bAng}×${c.bAng}×${c.tAng} mm · ${c.aceroAng}`,
      g3(campo(c, 'bAng', 'Ancho de las alas b [mm]', { h:'Angular de alas iguales' }), campo(c, 'tAng', 'Espesor t [mm]'), campo(c, 'aceroAng', 'Acero', { sel:SEL_ACERO }))],
    ['pern', 'Pernos', () => `${c.n} × ${dnom(c)} ${c.grado}-${c.rosca} en el alma${sold ? '' : ` + ${2 * c.n} en el soporte`} · s ${c.s} · Lev ${c.Lev}${c.cizalla ? ' · cizalla' : ''}`,
      g3(...pernosTipo) + g3(campo(c, 'n', 'Pernos por línea n'), campo(c, 's', 'Separación s [mm]'), campo(c, 'Lev', 'Borde vertical Lev [mm]'),
        campo(c, 'g1', 'g₁: talón a pernos de la viga [mm]'), ...(sold ? [] : [campo(c, 'g2', 'g₂: talón a pernos del soporte [mm]')]))] ]; }
  if(c.tipo === 'testa'){ const e8 = c.config === '8ES', ck = (k, t) => `<div class="f"><label class="ck"><input type="checkbox" data-k="${k}" ${c[k] ? 'checked' : ''} ${esIng() ? '' : 'disabled'}/> ${t}</label></div>`;
    const RIG = { auto:'Automático (los diseña si hacen falta)', si:'Sí, siempre', no:'No poner' }, SIS = { no:'Sin requisitos sísmicos', DMO:'DMO · pórtico intermedio (F.3)', DES:'DES · pórtico especial (F.3)' };
    return [
    ['viga', 'Viga', () => `${c.viga} · ${c.aceroViga}`, g3(campo(c, 'viga', 'Perfil', { sel:(window.PERFILES_LAM || []).map(x => x[0]) }), campo(c, 'aceroViga', 'Acero', { sel:SEL_ACERO }))],
    ['col', 'Columna', () => c.columna ? `${c.columna} · ${c.aceroCol}${c.colTope ? ' · extremo superior' : ''}${c.dosLados ? ` · viga al otro lado M₂ ${c.Mu2}` : ''} · rigidizadores: ${(RIG[c.rigCol || 'auto'] || '').split(' (')[0].toLowerCase()}` : 'sin revisar',
      g3(campo(c, 'columna', 'Perfil', { sel:[['', '— No revisar la columna —'], ...(window.PERFILES_LAM || []).map(x => [x[0], x[0]])] }), campo(c, 'aceroCol', 'Acero', { sel:SEL_ACERO }))
      + ck('colTope', 'La unión está en el extremo superior de la columna (menos de d de la punta)')
      + ck('dosLados', 'Llega otra viga a momento al otro lado de la columna')
      + (c.dosLados ? g3(campo(c, 'Mu2', 'Momento de la otra viga M₂ [kN·m]', { h:'Misma altura de viga' }), campo(c, 'sentido2', 'Los dos momentos', { sel:[['opuesto', 'Opuestos (cargas de gravedad)'], ['mismo', 'Mismo sentido (sismo o viento)']], h:'Opuestos: el alma se aprieta por los dos lados (J10-8). Mismo sentido: el panel recibe la suma' })) : '')
      + `<h4 class="sub">Rigidizadores de la columna (placas de continuidad)</h4>`
      + conFig(`<div class="fg g2">${[campo(c, 'rigCol', 'Rigidizadores', { sel:Object.entries(RIG) }), ...(c.rigCol === 'no' ? [] : [campo(c, 'bsC', 'Ancho bs [mm]', { h:'Vacío = automático' }), campo(c, 'tsC', 'Espesor ts [mm]', { h:'Vacío = automático' }), campo(c, 'wsC', 'Filete [mm]', { h:'Vacío = automático' }), campo(c, 'unPlW', 'Placas al alma', { sel:[['filete', 'Filete'], ['cjp', 'Penetración completa']], h:'El filete no puede pasar el espesor del alma' }), campo(c, 'aceroRigC', 'Acero', { sel:SEL_ACERO })])].join('')}</div>`, figContinuidad(c.dosLados, Conex.perfil(c.columna), ['DMO', 'DES'].includes(c.sismo))) + (c.columna ? doublerHTML(c, campo, ck) : '')],
    ['placa', 'Placa de testa', () => `${e8 ? '8 pernos rigidizada (8ES)' : '4 pernos (4E)'} · PL ${c.tp} × ${c.bp} mm ${c.aceroPl} · extensión ${c.ambos ? 'arriba y abajo' : 'solo arriba'}`,
      g3(campo(c, 'config', 'Configuración', { sel:[['4E', '4 pernos sin rigidizar (4E)'], ['8ES', '8 pernos con rigidizador (8ES)']] }), campo(c, 'tp', 'Espesor tp [mm]'), campo(c, 'bp', 'Ancho bp [mm]', { h:'Entre bf y bf + 25 mm' }), campo(c, 'aceroPl', 'Acero', { sel:SEL_ACERO }),
        ...(e8 ? [campo(c, 'tsE', 'Rigidizador de la extensión ts [mm]', { h:'Triangular, en el eje del alma' }), campo(c, 'wsE', 'Filete del rigidizador [mm]')] : []))
      + ck('ambos', `El momento cambia de sentido (extensión arriba y abajo, ${e8 ? 16 : 8} pernos)`)],
    ['pern', 'Pernos', () => `${e8 ? (c.ambos ? 16 : 8 + (+c.nbc || 0)) : c.ambos ? 8 : 4 + (+c.nbc || 0)} × ${dnom(c)} ${c.grado}-${c.rosca} · g ${c.g} · pfo ${c.pfo} · pfi ${c.pfi} · de ${c.de}${e8 ? ` · pb ${c.pb}` : ''}`,
      g3(...pernosTipo) + g3(campo(c, 'g', 'Gramil g [mm]', { h:'Distancia horizontal entre pernos' }), campo(c, 'pfo', 'pfo: ala a fila exterior [mm]'), campo(c, 'pfi', 'pfi: ala a fila interior [mm]'),
        campo(c, 'de', 'de: fila exterior al borde [mm]'), ...(e8 ? [campo(c, 'pb', 'pb: entre filas [mm]', { h:'≥ 2.67d; AISC 358 pide 89 a 95 mm' })] : []), c.ambos ? '' : campo(c, 'nbc', 'Pernos de cortante abajo', { h:'Junto al ala en compresión' }))],
    ['sis', 'Requisitos sísmicos', () => (SIS[c.sismo || 'no'] || '') + (c.sismo && c.sismo !== 'no' ? ` · L'h ${c.Lh} m · Vg ${c.Vg} kN` : ''),
      g3(campo(c, 'sismo', 'Pórtico', { sel:Object.entries(SIS) }), ...(c.sismo && c.sismo !== 'no' ? [campo(c, 'Lh', "L'h: distancia entre rótulas [m]", { h:'Luz libre de la viga menos 2·Sh' }), campo(c, 'Vg', 'Vg: cortante de gravedad en la rótula [kN]', { h:'1.2D + 0.5L (o la del modelo)' })] : []))
      + (c.sismo && c.sismo !== 'no' ? '<div class="hint">Con sismo la conexión se diseña para el momento probable de la viga Mf (AISC 358) y se revisan los límites de precalificación.</div>' : '')],
    ['sold', 'Soldaduras viga–placa', () => `alas ${c.soldAla === 'cjp' ? 'penetración completa' : `filete ${c.wAla} mm`} · alma filete ${c.wAlma} mm · ${c.electrodo}`,
      g3(campo(c, 'soldAla', 'Alas', { sel:[['filete', 'Filete por ambas caras'], ['cjp', 'Penetración completa']] }), c.soldAla === 'cjp' ? '' : campo(c, 'wAla', 'Filete de las alas w [mm]'), campo(c, 'wAlma', 'Filete del alma w [mm]', { h:'Por ambas caras' }), campo(c, 'electrodo', 'Electrodo', { sel:Object.keys(Conex.ELECTRODOS) }))] ]; }
  return [
    ['geo', 'Distribución de pernos', () => `${c.filas} filas × ${c.cols} columnas · s ${c.s} · g ${c.g} · bordes ${c.Lev}/${c.Leh}`,
      g3(campo(c, 'filas', 'Filas (vertical)'), campo(c, 'cols', 'Columnas (horizontal)'), '<div></div>', campo(c, 's', 'Separación vertical s [mm]'), campo(c, 'g', 'Separación horizontal g [mm]'), '<div></div>', campo(c, 'Lev', 'Borde vertical Lev [mm]'), campo(c, 'Leh', 'Borde horizontal Leh [mm]'))],
    ['pern', 'Pernos', () => `${dnom(c)} ${c.grado}-${c.rosca}${c.desliz ? ` · deslizamiento crítico clase ${c.claseSup || 'A'}` : ''}`, g3(...pernosTipo)
      + ck('desliz', 'Pernos de deslizamiento crítico (J3-8): cuando la unión no puede deslizar (vibración, cargas que cambian de sentido)')
      + (c.desliz ? g3(campo(c, 'claseSup', 'Superficie de contacto', { sel:[['A', 'Clase A (μ = 0.30): limpia de laminado o con granallado y pintura clase A'], ['B', 'Clase B (μ = 0.50): granallada sin pintar o con pintura clase B']] })) : '')],
    ['chapa', 'Chapa y soporte', () => `PL ${c.tp} mm ${c.aceroPl} · soporte t ${c.tSop} mm ${c.aceroSop}`,
      g3(campo(c, 'tp', 'Espesor de la chapa tp [mm]'), campo(c, 'aceroPl', 'Acero de la chapa', { sel:SEL_ACERO }), '<div></div>', campo(c, 'tSop', 'Espesor del soporte [mm]', { h:'Ala de la columna u otra chapa' }), campo(c, 'aceroSop', 'Acero del soporte', { sel:SEL_ACERO }))] ];
}
const abiertas = () => { try{ return JSON.parse(localStorage.conSecc || 'null') || ['viga', 'geo', 'diag', 'col']; }catch(e){ return ['viga', 'geo', 'diag', 'col']; } };

// Cargas mayoradas resultantes (pedido de Amo 10-nov: eje fuerte, eje débil y torsión). Vacío = 0.
// Ejes del miembro con la convención del modelo (regla de la mano derecha): cada eje lleva su fuerza (flecha simple, naranja)
// y el momento ALREDEDOR de ese eje (doble flecha, morada). Corrección pedida por Amo 11-nov: antes M2 se veía junto al eje 3.
function ejesCon(){
  const id = ejId(), P = iso(72, 118, 50), b = 0.32, h = 0.6, t = 0.07, Lm = 1.2, d = 0.2;
  const ala = zz => caja(P, 0, -b, zz, Lm, 2 * b, t, '#c7d2e3', '#dbe3ee', '#e8eef7');
  const alma = caja(P, 0, -t / 2, -h / 2 + t, Lm, t, h - 2 * t, '#c7d2e3', '#dbe3ee', '#e8eef7');
  const A = (x, y, z) => P(Lm + x, y, z), O = A(0, 0, 0), L = 1.75;
  const par = (eje, ax) => {           // fuerza y momento sobre cada eje, separados a lado y lado del eje
    const v = (k, off) => eje === 1 ? A(k, 0, off) : eje === 2 ? A(off, 0, k) : A(0, k, off);
    return lin(id, 'f', ...v(0.45, d), ...v(1.05, d), 2.2) + lin(id, 'm', ...v(0.45, -d), ...v(1.4, -d), 2.2); };
  const lb = (eje, k, off, t, c, a = 'start', dx = 4, dy = 4) => { const q = eje === 1 ? A(k, 0, off) : eje === 2 ? A(off, 0, k) : A(0, k, off); return txt(q[0] + dx, q[1] + dy, t, c, a); };
  return `<svg viewBox="0 18 300 197" class="ejes" role="img" aria-label="Ejes 1, 2 y 3 con sus fuerzas y momentos">${ejDefs(id)}${ala(-h / 2)}${alma}${ala(h / 2 - t)}
    ${lin(id, 'a', ...O, ...A(L, 0, 0))}${lin(id, 'a', ...O, ...A(0, 0, L))}${lin(id, 'a', ...O, ...A(0, L, 0))}
    ${par(1)}${par(2)}${par(3)}
    ${txt(...A(L + 0.05, 0, 0).map((v, i) => v + (i ? 4 : 2)), 'eje 1')}${txt(A(0, 0, L)[0] + 5, A(0, 0, L)[1] + 2, 'eje 2')}${txt(A(0, L, 0)[0] - 4, A(0, L, 0)[1] + 4, 'eje 3', EJ.az, 'end')}
    ${lb(1, 1.05, d, 'P', EJ.f, 'start', 2, -6)}${lb(1, 1.4, -d, 'T', EJ.m, 'start', 2, 14)}
    ${lb(2, 1.05, d, 'V2', EJ.f, 'start', 6, 6)}${lb(2, 1.4, -d, 'M2', EJ.m, 'end', -6, 6)}
    ${lb(3, 1.05, d, 'V3', EJ.f, 'end', -4, -6)}${lb(3, 1.4, -d, 'M3', EJ.m, 'end', -4, 14)}</svg>
    <div class="ej-ley"><span class="f">→ fuerza en la dirección del eje</span><span class="m">⇉ momento alrededor del eje</span></div>`;
}
function cargasHTML(c){
  const f = (k, l, h) => campo(c, k, l, h ? { h } : {});
  const caja = (titulo, campos, nota, ejes = true) => `<div class="carga-in carga6"><div class="cg-hd"><b>${titulo}</b><span class="hint">${nota}</span></div>
    <div class="cg-bd"><div class="cg-f">${campos.join('')}</div>${ejes ? `<div class="cg-ej">${ejesCon()}</div>` : ''}</div></div>`;
  const nota = 'Resultantes mayoradas · vacío = 0 · P: + tensión';
  if(c.tipo === 'base') return caja('Cargas en la base de la columna', [f('P', 'P [kN]', '+ compresión'), f('Vx', 'Vx [kN]', 'sentido N'), f('Vy', 'Vy [kN]', 'sentido B'), f('T', 'T [kN·m]', 'torsión'), f('Mx', 'Mx [kN·m]', 'flexión en el sentido N'), f('My', 'My [kN·m]', 'flexión en el sentido B')], 'Resultantes mayoradas · vacío = 0', false);
  if(c.tipo === 'grupo') return caja('Cargas sobre el grupo de pernos', [f('Pu', 'Pu en el plano [kN]'), f('e', 'Excentricidad e [mm]', 'al centro del grupo'), f('ang', 'Ángulo [°]', '0° = vertical'),
    f('Nt', 'N normal a la chapa [kN]', '+ tensión en los pernos'), f('Mx', 'Mx fuera del plano [kN·m]', 'eje horizontal'), f('My', 'My fuera del plano [kN·m]', 'eje vertical')], 'Resultantes mayoradas · vacío = 0', false);
  if(c.tipo === 'esquina' || c.tipo === 'cruce') return caja(c.tipo === 'cruce' ? 'Carga en la diagonal interrumpida' : 'Carga en la diagonal', [f('Pu', 'Pu axial [kN]', '+ tensión · − compresión')], 'Fuerza mayorada de la diagonal', false);
  const k2 = c.tipo === 'cartela' ? 'V2' : 'Vu', kP = c.tipo === 'cartela' ? 'Pu' : 'P', k3 = ['testa', 'ras', 'empalme', 'soldada', 'empZ', 'empCol'].includes(c.tipo) ? 'Mu' : 'M3';
  return caja(c.tipo === 'cartela' ? 'Cargas en el extremo de la diagonal' : c.tipo === 'empCol' ? 'Cargas en la columna en el empalme' : 'Cargas en el extremo de la viga', [f(kP, 'P axial [kN]', 'a lo largo del eje 1'), f(k2, 'V2 [kN]', 'dirección 2 (alma)'), f('V3', 'V3 [kN]', 'dirección 3 (alas)'),
    f('T', 'T torsión [kN·m]', 'alrededor del eje 1'), f('M2', 'M2 [kN·m]', 'alrededor de 2 · eje débil'), f(k3, 'M3 [kN·m]', 'alrededor de 3 · eje fuerte')], nota);
}
const cargasTxt = c => ['esquina', 'cruce'].includes(c.tipo) ? `Pu ${nz(c.Pu)} kN (${nz(c.Pu) >= 0 ? 'tensión' : 'compresión'})` : c.tipo === 'base' ? `P ${nz(c.P)} · Vx ${nz(c.Vx)} · Vy ${nz(c.Vy)} kN · T ${nz(c.T)} · Mx ${nz(c.Mx)} · My ${nz(c.My)} kN·m`
  : c.tipo === 'grupo' ? `Pu ${nz(c.Pu)} kN a ${nz(c.ang)}° con e = ${nz(c.e)} mm · N ${nz(c.Nt)} kN · Mx ${nz(c.Mx)} · My ${nz(c.My)} kN·m`
  : `P ${nz(c.tipo === 'cartela' ? c.Pu : c.P)} · V2 ${nz(c.tipo === 'cartela' ? c.V2 : c.Vu)} · V3 ${nz(c.V3)} kN · T ${nz(c.T)} · M2 ${nz(c.M2)} · M3 ${nz(['testa', 'ras', 'empalme', 'soldada', 'empZ', 'empCol'].includes(c.tipo) ? c.Mu : c.M3)} kN·m`;
const nz = v => { const x = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(x) ? x : 0; };
function formHTML(c){
  const ab = abiertas();
  const carga = cargasHTML(c);
  return carga + `<div class="sec-tools"><button type="button" class="lnk" data-secall="1">Abrir todo</button> · <button type="button" class="lnk" data-secall="0">Cerrar todo</button></div>`
    + seccionesDe(c).map(([k, t, res, body], i) => `<section class="sec ${ab.includes(k) ? 'on' : ''}" data-sec="${k}">
      <button type="button" class="sec-hd" aria-expanded="${ab.includes(k)}"><i>${i + 1}</i><b>${t}</b><small data-res="${k}">${esc(res())}</small><span class="car" aria-hidden="true">▾</span></button>
      <div class="sec-bd">${body}</div></section>`).join('');
}
const GRUPOS = { pernos:'Pernos', chapa:'Chapa', angulares:'Angulares', angular:'Angular de asiento', rigidizador:'Platina de rigidez', alas:'Empalme de las alas', almaPl:'Empalme del alma', alma:'Alma', diagonal:'Diagonal', cartela:'Cartela', concreto:'Concreto', anclajes:'Anclajes', placa:'Placa', soldadura:'Soldadura', soporte:'Soporte', viga:'Viga', columna:'Columna', panel:'Zona de panel', placas:'Placas de continuidad', cortante:'Transmisión del cortante', scwb:'Columna fuerte – viga débil' };
function chequeosHTML(r){
  let h = '';
  const extra = [...new Set(r.ch.map(x => x.grupo))].filter(g => !GRUPOS[g]).map(g => [g, g]);   // grupos sin nombre: no se pierden
  [...Object.entries(GRUPOS), ...extra].forEach(([g, t]) => { const L = r.ch.filter(x => x.grupo === g); if(!L.length) return;
    h += `<tr class="grp"><td colspan="5">${t}</td></tr>` + L.map(x => { const ok = x.ratio <= 1, w = Math.min(100, x.ratio * 100);
      return `<tr><td>${esc(x.nombre)}<div class="hint">${esc(x.ref)}${x.extra ? ' · ' + esc(x.extra) : ''}</div></td><td class="n">${f2(x.dem, x.ud === 'kN/mm' ? 3 : 2)} ${x.ud}</td><td class="n">${f2(x.cap, x.ud === 'kN/mm' ? 3 : 2)} ${x.ud}</td>
        <td class="n"><span class="bar-d"><i style="width:${w}%;background:${ok ? 'var(--green)' : 'var(--red)'}"></i></span> <b>${f2(x.ratio, 3)}</b></td><td><span class="pill ${ok ? 'ok' : 'no'}">${ok ? 'Cumple' : 'No cumple'}</span></td></tr>`; }).join(''); });
  return `<div class="tw"><table class="t chq"><thead><tr><th>Chequeo</th><th>Demanda</th><th>Capacidad φRn</th><th>Relación</th><th></th></tr></thead><tbody>${h}</tbody></table></div>`;
}
function reqHTML(r){
  return `<ul class="req">${r.req.map(([t, ok, v]) => `<li class="${ok ? 'ok' : 'no'}">${ok ? '✓' : '✗'} ${esc(t)} <span class="hint">${esc(v)}</span></li>`).join('')}</ul>`;
}

// Sección «Rigidez y clasificación» (pedido de Amo 20-nov): luz de la viga (o altura de la columna) para K = Sj·L/(E·I)
function seccionesDe(c){
  if(c.tipo === 'esquina' || c.tipo === 'cruce') return seccionesArr(c);
  const L = seccionesDe0(c);
  if(['testa', 'ras', 'soldada'].includes(c.tipo))
    L.push(['rigid', 'Rigidez y clasificación', () => c.Lviga ? `luz de la viga ${c.Lviga} m` : 'escriba la luz de la viga',
      `<div class="fg g3">${campo(c, 'Lviga', 'Luz de la viga L [m]', { h:'Para clasificar con K = Sj·L/(E·I) (AISC 360-10 B3.6). En el Anexo E sale del modelo.' })}</div>`]);
  if(c.tipo === 'base')
    L.push(['rigid', 'Rigidez y clasificación', () => c.Lcol ? `altura de la columna ${c.Lcol} m` : 'escriba la altura de la columna',
      `<div class="fg g3">${campo(c, 'Lcol', 'Altura de la columna L [m]', { h:'Para clasificar la base con K = Sj·L/(E·I). En el Anexo E sale del modelo.' })}</div>`]);
  return L;
}
const CLASE_RIG = { rigida:['Rígida', 'ok'], semi:['Semirrígida', 'pend'], art:['Articulada', 'gray'] };
const fmtN = v => !isFinite(v) ? '∞' : Math.round(v).toLocaleString('es-CO');
// Bloque de rigidez para la pantalla y la impresión
function rigHTML(r, imp){
  const g = r && r.rigid; if(!g) return '';
  const cl = g.clase ? CLASE_RIG[g.clase] : null;
  const pill = cl ? `<span class="pill ${cl[1]}">${g.debil ? 'fuerte: ' : ''}${cl[0]}</span>` : '<span class="pill gray">sin clasificar</span>';
  if(g.tipo === 'cortante') return `<div class="rig-box"><div class="rig-hd"><b>Rigidez y clasificación</b> ${pill}</div><p class="hint" style="margin:4px 0 0">${g.notas.map(esc).join(' ')}</p></div>`;
  if(g.tipo === 'base' && g.debil){
    const ax = (h, nom, sent, rot) => { const c2 = h.clase ? CLASE_RIG[h.clase] : null, rs = isFinite(h.Sj) && h.Sj > 0 ? h.Sj / g.eta : null;
      return `<b>${nom}</b> (${sent}): Sj,ini = <b>${fmtN(h.Sj)} kN·m/rad</b>${h.K != null ? `, K = ${isFinite(h.K) ? f2(h.K, 1) : '∞'} → ${c2 ? c2[0].toLowerCase() : ''}` : ''}${h.clase === 'rigida' ? ' → en el modelo: rotación restringida' : h.clase === 'art' ? ' → en el modelo: rotación libre' : rs ? ` → resorte <b>${fmtN(rs)} kN·m/rad</b> (${rot})` : ''}`; };
    const lin = [ax(g, 'Eje fuerte de la columna', 'momento Mx, sentido N', '«Rotation about 1» si el peralte es paralelo a Y; «Rotation about 2» si es paralelo a X'),
      ax(g.debil, 'Eje débil de la columna', 'momento My, sentido B', 'la otra casilla: «Rotation about 2» si el peralte es paralelo a Y; «Rotation about 1» si es paralelo a X'),
      g.K != null ? `K = Sj·L/(E·I) con L = ${f2(g.L / 1000, 2)} m (altura de la columna) e I del eje que corresponde; rígida si K ≥ 20, articulada si K ≤ 2. Resorte = Sj,ini/η (η = 3, EN 1993-1-8 §5.1.2). En Joint Springs deje en 0 las traslaciones y «Rotation about 3»; en Restraints libere las rotaciones que lleven resorte.` : 'Para clasificar escriba la altura de la columna.'];
    const cd = g.debil.clase ? CLASE_RIG[g.debil.clase] : null;
    return `<div class="rig-box"><div class="rig-hd"><b>Rigidez y clasificación</b> ${pill}${cd ? ` <span class="pill ${cd[1]}" title="eje débil">débil: ${cd[0]}</span>` : ''}<span class="hint">${esc(g.ref)}</span></div>
    <ul class="rig-l">${lin.map(x => `<li>${x}</li>`).join('')}</ul>${g.notas.length ? `<p class="hint" style="margin:4px 0">${g.notas.map(esc).join(' ')}</p>` : ''}
    ${imp ? `<div class="calc">${g.pasos.map(esc).join('<br/>')}</div>` : `<details><summary class="hint">Ver componentes y cálculo</summary><div class="calc">${g.pasos.map(esc).join('<br/>')}</div></details>`}</div>`;
  }
  const resorte = isFinite(g.Sj) && g.Sj > 0 ? g.Sj / g.eta : null;
  const lin = [`Rigidez inicial <b>Sj,ini = ${fmtN(g.Sj)} kN·m/rad</b>`,
    g.K != null ? `K = Sj·L/(E·I) = ${isFinite(g.K) ? f2(g.K, 1) : '∞'} con L = ${f2(g.L / 1000, 2)} m (${g.tipo === 'base' ? 'altura de la columna' : 'luz de la viga'}) → ${cl ? cl[0].toLowerCase() : ''} (rígida si K ≥ 20, articulada si K ≤ 2)` : `Para clasificar escriba ${g.tipo === 'base' ? 'la altura de la columna' : 'la luz de la viga'}.`,
    g.clase === 'rigida' ? `Para el modelo: ${g.tipo === 'base' ? 'apoyo empotrado' : 'extremo de la viga empotrado (sin liberación)'}` : g.clase === 'art' ? `Para el modelo: ${g.tipo === 'base' ? 'apoyo articulado' : 'extremo de la viga con M3 liberado'}` : resorte ? `Para el modelo: ${g.tipo === 'base' ? 'resorte a rotación en el apoyo (Joint Springs: «Rotation about 1» si el peralte de la columna es paralelo a Y, «Rotation about 2» si es paralelo a X; deje libre esa rotación en Restraints)' : 'resorte a rotación en el extremo de la viga (Partial Fixity, M3)'} = Sj,ini/η = ${fmtN(resorte)} kN·m/rad (η = ${g.eta}, EN 1993-1-8 §5.1.2)` : ''].filter(Boolean);
  return `<div class="rig-box"><div class="rig-hd"><b>Rigidez y clasificación</b> ${pill}<span class="hint">${esc(g.ref)}</span></div>
    <ul class="rig-l">${lin.map(x => `<li>${x}</li>`).join('')}</ul>${g.notas.length ? `<p class="hint" style="margin:4px 0">${g.notas.map(esc).join(' ')}</p>` : ''}
    ${imp ? `<div class="calc">${g.pasos.map(esc).join('<br/>')}</div>` : `<details><summary class="hint">Ver componentes y cálculo</summary><div class="calc">${g.pasos.map(esc).join('<br/>')}</div></details>`}</div>`;
}
function resHTML(c, r){
  if(r.error) return `<div class="note">${esc(r.error)}</div>`;
  return `<div class="ct">Resultado <span class="pill ${r.ok ? 'ok' : 'no'}" style="margin-left:8px">${r.ok ? 'Cumple' : 'No cumple'} · relación máx. ${f2(r.max, 3)}</span></div>
    ${r.av.length ? `<div class="note amber">${r.av.map(esc).join('<br/>')}</div>` : ''}
    ${r.sug && r.sug.ok && esIng() ? `<div style="margin:-4px 0 10px"><button type="button" class="btn sm pri" data-apsug="1">${esc(r.sug.txt || '💡 Aplicar platina de rigidez')}</button></div>` : ''}
    ${rigHTML(r)}${chequeosHTML(r)}
    <details style="margin-top:8px"><summary><b>Requisitos de geometría y detallado</b> (${r.req.filter(x => x[1]).length}/${r.req.length})</summary>${reqHTML(r)}</details>
    <details style="margin-top:6px"><summary><b>Ver cálculo detallado</b></summary><div class="calc">${r.pasos.map(esc).join('<br/>')}</div></details>`;
}

// ── Nudos: varias vigas que llegan a una columna (opción C de Amo, 19-nov) ─────────────
// Las conexiones se diseñan una por una; el nudo las junta por cara de la columna y revisa lo que comparten.
const ICO_ALETA = '<svg viewBox="0 0 60 40" aria-hidden="true"><rect x="4" y="2" width="8" height="36" fill="#cbd5e1"/><rect x="12" y="10" width="20" height="20" fill="#93c5fd" stroke="#1e3a8a"/><rect x="18" y="6" width="40" height="28" fill="none" stroke="#475569"/><circle cx="25" cy="14" r="2.2" fill="#1e3a8a"/><circle cx="25" cy="20" r="2.2" fill="#1e3a8a"/><circle cx="25" cy="26" r="2.2" fill="#1e3a8a"/></svg>';
const ICO_GRUPO = '<svg viewBox="0 0 60 40" aria-hidden="true"><rect x="4" y="4" width="26" height="32" fill="#93c5fd" stroke="#1e3a8a"/>' + [10, 20, 30].map(y => `<circle cx="12" cy="${y}" r="2.2" fill="#1e3a8a"/><circle cx="22" cy="${y}" r="2.2" fill="#1e3a8a"/>`).join('') + '<line x1="50" y1="6" x2="50" y2="32" stroke="#ea580c" stroke-width="2.5"/><path d="M46 28 L50 35 L54 28" fill="#ea580c"/></svg>';
function cotaV(x, y1, y2, t, lado = -1){ const xx = x + lado * 0; return `<g class="cota"><line x1="${xx}" y1="${y1}" x2="${xx}" y2="${y2}"/><line x1="${xx - 4}" y1="${y1}" x2="${xx + 4}" y2="${y1}"/><line x1="${xx - 4}" y1="${y2}" x2="${xx + 4}" y2="${y2}"/><text x="${xx + lado * 6}" y="${(y1 + y2) / 2}" text-anchor="${lado < 0 ? 'end' : 'start'}" dominant-baseline="middle">${t}</text></g>`; }
function cotaH(y, x1, x2, t, lado = 1){ return `<g class="cota"><line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/><line x1="${x1}" y1="${y - 4}" x2="${x1}" y2="${y + 4}"/><line x1="${x2}" y1="${y - 4}" x2="${x2}" y2="${y + 4}"/><text x="${(x1 + x2) / 2}" y="${y + lado * 11}" text-anchor="middle">${t}</text></g>`; }
function dibujo(c, r){ return ({ grupo:dibGrupo, testa:dibTesta, ras:dibTesta, angular:dibAngular, testaV:dibTestaV, asiento:dibAsiento, empalme:dibEmpalme, cartela:dibCartela, esquina:dibEsquina, cruce:dibCruce, base:dibBase, soldada:dibSoldada, empZ:dibEmpZ, empCol:dibEmpCol }[c.tipo] || dibAleta)(c, r); }
const ICO_ANG = '<svg viewBox="0 0 60 40" aria-hidden="true"><rect x="4" y="1" width="8" height="38" fill="#cbd5e1"/><rect x="18" y="6" width="40" height="28" fill="#f1f5f9" stroke="#94a3b8"/><rect x="12" y="9" width="18" height="22" fill="#93c5fd" stroke="#1e3a8a"/><rect x="12" y="9" width="3" height="22" fill="#1e3a8a"/><circle cx="23" cy="14" r="2" fill="#fff" stroke="#1e3a8a"/><circle cx="23" cy="20" r="2" fill="#fff" stroke="#1e3a8a"/><circle cx="23" cy="26" r="2" fill="#fff" stroke="#1e3a8a"/></svg>';
function dibAngular(c, r){
  const g = r.geo, vg = g.vg, n = +c.n, s = +c.s, Lev = +c.Lev, b = +c.bAng, t = +c.tAng, g1 = +c.g1, g2 = +c.g2, hol = +c.holgura || 0, ts = +c.tSop || 10;
  const xe = Math.max(b + 150, (g.cD || 0) + 60), k = Math.min(230 / (xe + 20), 300 / (vg.d + 40)), X = v => 92 + v * k, Y = v => 50 + v * k, yb = g.yb ?? (vg.d - g.L) / 2;
  const dct = g.dct || 0, dcb = g.dcb || 0, cD = g.cD || 0, xc = hol + cD;
  // contorno de la viga con el destaje (ala superior y, si aplica, inferior)
  const contorno = (dct || dcb) ? `M${X(hol)},${Y(dct)} L${X(xc)},${Y(dct)} L${X(xc)},${Y(0)} L${X(xe)},${Y(0)} L${X(xe)},${Y(vg.d)} L${X(xc)},${Y(vg.d)} L${X(xc)},${Y(vg.d - dcb)} L${X(hol)},${Y(vg.d - dcb)} Z`
    : `M${X(hol)},${Y(0)} L${X(xe)},${Y(0)} L${X(xe)},${Y(vg.d)} L${X(hol)},${Y(vg.d)} Z`;
  let h = `<rect x="${X(-ts)}" y="${Y(-12)}" width="${ts * k}" height="${(vg.d + 24) * k}" class="sop"/>
    <path d="${contorno}" class="vg"/>
    <line x1="${X(dct ? xc : hol)}" y1="${Y(vg.tf)}" x2="${X(xe)}" y2="${Y(vg.tf)}" class="vgl"/><line x1="${X(dcb ? xc : hol)}" y1="${Y(vg.d - vg.tf)}" x2="${X(xe)}" y2="${Y(vg.d - vg.tf)}" class="vgl"/>
    <rect x="${X(0)}" y="${Y(yb)}" width="${b * k}" height="${g.L * k}" class="pl"/><rect x="${X(0)}" y="${Y(yb)}" width="${t * k}" height="${g.L * k}" fill="#1e3a8a"/>`;
  if(dct) h += cotaV(X(xc) + 10, Y(0), Y(dct), `dc ${dct}`, 1) + cotaH(Y(-4) - 10, X(hol), X(xc), `c = ${cD}`);
  if(dcb) h += cotaV(X(xc) + 10, Y(vg.d - dcb), Y(vg.d), `${dcb}`, 1);
  if(g.sold) h += `<line x1="${X(0) - 2}" y1="${Y(yb)}" x2="${X(0) - 2}" y2="${Y(yb + g.L)}" stroke="#ea580c" stroke-width="4"/>
    <text x="${X(-ts) - 6}" y="${Y(yb + g.L) + 14}" class="lbl" text-anchor="start" fill="#c2410c">filete ${esc(String(c.wS))} mm</text>`;
  for(let i = 0; i < n; i++){ const y = Y(yb + Lev + i * s);
    h += `<circle cx="${X(g1)}" cy="${y}" r="${Math.max(3, g.dh / 2 * k)}" class="bolt"/>${g.sold ? '' : `<line x1="${X(-ts - 6)}" y1="${y}" x2="${X(t + 6)}" y2="${y}" class="bl"/>`}`; }
  h += cotaV(X(-ts - 16), Y(yb), Y(yb + g.L), `L ${f2(g.L, 0)}`) + (n > 1 ? cotaV(X(b + 12), Y(yb + Lev), Y(yb + Lev + s), `s = ${s}`, 1) : '')
    + cotaV(X(b + 12), Y(yb + g.L - Lev), Y(yb + g.L), `Lev = ${Lev}`, 1) + cotaH(Y(vg.d) + 16, X(0), X(g1), `g₁ = ${g1}`)
    + `<text x="${X((xe + b) / 2 + 20)}" y="${Y(vg.d / 2)}" class="lbl" text-anchor="middle">${esc(vg.nom)}</text><text x="${X(b / 2)}" y="${Y(yb) - 5}" class="lbl" text-anchor="middle">2L ${b}×${t}</text>`;
  // planta (vista superior), a la derecha
  const k2 = Math.min(1.1, 175 / (b * 2 + vg.tw)), ox = X(xe + 20), cy = Y(vg.d / 2), P = (x, y) => `${ox + x * k2},${cy + y * k2}`;
  const tw = vg.tw, L1 = (sg) => `M${P(0, sg * tw / 2)} L${P(b, sg * tw / 2)} L${P(b, sg * (tw / 2 + t))} L${P(t, sg * (tw / 2 + t))} L${P(t, sg * (tw / 2 + b))} L${P(0, sg * (tw / 2 + b))} Z`;
  h += `<rect x="${ox - ts * k2}" y="${cy - (b + tw / 2 + 25) * k2}" width="${ts * k2}" height="${(2 * b + tw + 50) * k2}" class="sop"/>
    <rect x="${ox + hol * k2}" y="${cy - tw / 2 * k2}" width="${(b + 60 - hol) * k2}" height="${tw * k2}" fill="#94a3b8"/>
    <path d="${L1(1)}" class="pl"/><path d="${L1(-1)}" class="pl"/>
    <line x1="${ox + g1 * k2}" y1="${cy - (tw / 2 + t + 6) * k2}" x2="${ox + g1 * k2}" y2="${cy + (tw / 2 + t + 6) * k2}" class="bl"/>
    ${g.sold ? [-1, 1].map(sg => `<path d="M${ox},${cy + sg * (tw / 2 + b) * k2} l${-6},0 l6,${sg * 6} z" fill="#ea580c"/>`).join('')
      : [-1, 1].map(sg => `<line x1="${ox - (ts + 6) * k2}" y1="${cy + sg * (tw / 2 + g2) * k2}" x2="${ox + (t + 6) * k2}" y2="${cy + sg * (tw / 2 + g2) * k2}" class="bl"/>`).join('')}
    <text x="${ox + b * k2 / 2}" y="${cy - (b + tw / 2 + 30) * k2}" class="lbl" text-anchor="middle">planta</text>`;
  return `<svg viewBox="0 0 ${ox + (b + 70) * k2} ${Y(vg.d) + 40}" class="dsvg" role="img" aria-label="Doble angular: elevación y planta">${h}</svg>
    <div class="hint" style="text-align:center">Izquierda: elevación · Derecha: planta · ${g.sold ? 'soldados al soporte en el borde de cada angular (naranja)' : `gramil en el soporte = 2g₂ + tw = ${f2(g.gage, 1)} mm`}${g.des && g.des !== 'no' ? ` · destaje ho = ${f2(g.ho, 0)} mm` : ''}</div>`;
}
const ICO_TESTA = '<svg viewBox="0 0 60 40" aria-hidden="true"><rect x="4" y="1" width="7" height="38" fill="#cbd5e1"/><rect x="11" y="3" width="5" height="34" fill="#93c5fd" stroke="#1e3a8a"/><rect x="16" y="9" width="42" height="3" fill="#475569"/><rect x="16" y="28" width="42" height="3" fill="#475569"/><rect x="16" y="12" width="42" height="16" fill="#f1f5f9" stroke="#94a3b8"/><line x1="2" y1="6" x2="20" y2="6" stroke="#1e3a8a" stroke-width="2"/><line x1="2" y1="15" x2="20" y2="15" stroke="#1e3a8a" stroke-width="2"/><line x1="2" y1="25" x2="20" y2="25" stroke="#1e3a8a" stroke-width="2"/><line x1="2" y1="34" x2="20" y2="34" stroke="#1e3a8a" stroke-width="2"/></svg>';

// ── Íconos de la galería ──
const ICO_TV = '<svg viewBox="0 0 60 40" aria-hidden="true"><rect x="4" y="1" width="7" height="38" fill="#cbd5e1"/><rect x="11" y="8" width="4" height="24" fill="#93c5fd" stroke="#1e3a8a"/><rect x="15" y="4" width="43" height="32" fill="#f1f5f9" stroke="#94a3b8"/>' + [12, 20, 28].map(y => `<line x1="2" y1="${y}" x2="18" y2="${y}" stroke="#1e3a8a" stroke-width="2"/>`).join('') + '</svg>';
const ICO_AS = '<svg viewBox="0 0 60 40" aria-hidden="true"><rect x="4" y="1" width="7" height="38" fill="#cbd5e1"/><path d="M11 22 h20 v4 h-16 v12 h-4z" fill="#93c5fd" stroke="#1e3a8a"/><rect x="14" y="4" width="44" height="18" fill="#f1f5f9" stroke="#94a3b8"/><line x1="2" y1="31" x2="17" y2="31" stroke="#1e3a8a" stroke-width="2"/></svg>';
const ICO_EMP = '<svg viewBox="0 0 60 40" aria-hidden="true"><rect x="2" y="8" width="27" height="24" fill="#f1f5f9" stroke="#94a3b8"/><rect x="31" y="8" width="27" height="24" fill="#f1f5f9" stroke="#94a3b8"/><rect x="14" y="5" width="32" height="3" fill="#93c5fd" stroke="#1e3a8a"/><rect x="14" y="32" width="32" height="3" fill="#93c5fd" stroke="#1e3a8a"/><rect x="20" y="13" width="20" height="14" fill="#93c5fd" stroke="#1e3a8a"/></svg>';
const ICO_CAR = '<svg viewBox="0 0 60 40" aria-hidden="true"><rect x="2" y="34" width="56" height="5" fill="#cbd5e1"/><path d="M10 34 L10 20 L30 6 L46 20 L46 34 Z" fill="#93c5fd" stroke="#1e3a8a"/><line x1="18" y1="28" x2="56" y2="2" stroke="#475569" stroke-width="5"/><circle cx="26" cy="22.5" r="1.8" fill="#fff"/><circle cx="33" cy="17.7" r="1.8" fill="#fff"/></svg>';
const ICO_BASE = '<svg viewBox="0 0 60 40" aria-hidden="true"><rect x="8" y="28" width="44" height="11" fill="#e5e7eb" stroke="#94a3b8"/><rect x="12" y="24" width="36" height="4" fill="#93c5fd" stroke="#1e3a8a"/><rect x="22" y="2" width="16" height="22" fill="#f1f5f9" stroke="#475569"/><line x1="16" y1="20" x2="16" y2="38" stroke="#1e3a8a" stroke-width="2"/><line x1="44" y1="20" x2="44" y2="38" stroke="#1e3a8a" stroke-width="2"/></svg>';
const ICO_SP = '<svg viewBox="0 0 60 40" aria-hidden="true"><rect x="4" y="1" width="9" height="38" fill="#cbd5e1"/><rect x="13" y="8" width="45" height="24" fill="#f1f5f9" stroke="#94a3b8"/><rect x="13" y="8" width="45" height="3" fill="#475569"/><rect x="13" y="29" width="45" height="3" fill="#475569"/><path d="M13 5 l4 3 h-4z M13 35 l4 -3 h-4z" fill="#b45309"/><line x1="13.5" y1="8" x2="13.5" y2="32" stroke="#b45309" stroke-width="2.5"/></svg>';
const ICO_EZ = '<svg viewBox="0 0 60 40" aria-hidden="true"><rect x="2" y="6" width="56" height="28" fill="#f1f5f9" stroke="#94a3b8"/><rect x="2" y="6" width="56" height="3" fill="#475569"/><rect x="2" y="31" width="56" height="3" fill="#475569"/><path d="M22 4 V20 H38 V36" fill="none" stroke="#b45309" stroke-width="2.6"/></svg>';
const ICO_EC = '<svg viewBox="0 0 60 40" aria-hidden="true"><rect x="22" y="1" width="16" height="18" fill="#f1f5f9" stroke="#94a3b8"/><rect x="22" y="21" width="16" height="18" fill="#f1f5f9" stroke="#94a3b8"/><rect x="18" y="10" width="4" height="20" fill="#93c5fd" stroke="#1e3a8a"/><rect x="38" y="10" width="4" height="20" fill="#93c5fd" stroke="#1e3a8a"/><rect x="26" y="13" width="8" height="14" fill="#93c5fd" stroke="#1e3a8a"/></svg>';
const ICO_ESQ = '<svg viewBox="0 0 60 40" aria-hidden="true"><rect x="2" y="2" width="8" height="37" fill="#cbd5e1" stroke="#475569"/><rect x="10" y="30" width="48" height="8" fill="#cbd5e1" stroke="#475569"/><path d="M10 30 L10 8 L22 8 L34 18 L34 30 Z" fill="#93c5fd" stroke="#1e3a8a"/><line x1="16" y1="25" x2="56" y2="2" stroke="#475569" stroke-width="5"/></svg>';
const ICO_CRZ = '<svg viewBox="0 0 60 40" aria-hidden="true"><line x1="4" y1="38" x2="56" y2="2" stroke="#94a3b8" stroke-width="6"/><rect x="20" y="10" width="20" height="20" fill="#93c5fd" stroke="#1e3a8a" transform="rotate(35 30 20)"/><line x1="2" y1="4" x2="21" y2="16" stroke="#475569" stroke-width="5"/><line x1="39" y1="24" x2="58" y2="36" stroke="#475569" stroke-width="5"/></svg>';
const ICO = { empCol:ICO_EC, empZ:ICO_EZ, soldada:ICO_SP, aleta:ICO_ALETA, angular:ICO_ANG, testaV:ICO_TV, asiento:ICO_AS, testa:ICO_TESTA, ras:ICO_TESTA, empalme:ICO_EMP, cartela:ICO_CAR, esquina:ICO_ESQ, cruce:ICO_CRZ, grupo:ICO_GRUPO, base:ICO_BASE };
const svgW = (w, h, body, label, nota) => `<svg viewBox="0 0 ${w} ${h}" class="dsvg" role="img" aria-label="${label}">${body}</svg><div class="hint" style="text-align:center">${nota}</div>`;
function dibTestaV(c, r){
  const vg = r.geo.vg, n = +c.n, s = +c.s, Lev = +c.Lev, tp = +c.tp, bp = +c.bp, gg = +c.g, Lp = r.geo.Lp, ts = +c.tSop || 10;
  const k = 300 / (vg.d + 60), X = v => 60 + v * k, Y = v => 30 + v * k, yb = (vg.d - Lp) / 2, rows = Array.from({ length:n }, (_, i) => yb + Lev + i * s);
  let h = `<rect x="${X(-ts)}" y="${Y(-15)}" width="${ts * k}" height="${(vg.d + 30) * k}" class="sop"/><rect x="${X(0)}" y="${Y(yb)}" width="${tp * k}" height="${Lp * k}" class="pl"/>
    <rect x="${X(tp)}" y="${Y(0)}" width="${200 * k}" height="${vg.d * k}" class="vg"/><line x1="${X(tp)}" y1="${Y(vg.tf)}" x2="${X(tp + 200)}" y2="${Y(vg.tf)}" class="vgl"/><line x1="${X(tp)}" y1="${Y(vg.d - vg.tf)}" x2="${X(tp + 200)}" y2="${Y(vg.d - vg.tf)}" class="vgl"/>`;
  rows.forEach(y => h += `<line x1="${X(-ts - 6)}" y1="${Y(y)}" x2="${X(tp + 6)}" y2="${Y(y)}" class="bl"/>`);
  h += cotaV(X(-ts) - 10, Y(yb), Y(yb + Lp), `Lp ${f2(Lp, 0)}`) + `<text x="${X(tp + 100)}" y="${Y(vg.d / 2)}" class="lbl" text-anchor="middle">${esc(vg.nom)}</text>`;
  const ox = X(tp + 240), P = v => ox + (v + bp / 2) * k;
  h += `<rect x="${P(-bp / 2)}" y="${Y(yb)}" width="${bp * k}" height="${Lp * k}" class="pl"/><rect x="${P(-vg.tw / 2)}" y="${Y(-15)}" width="${vg.tw * k}" height="${(vg.d + 30) * k}" fill="none" stroke="#475569" stroke-dasharray="3 2"/>`;
  rows.forEach(y => [-1, 1].forEach(sg => h += `<circle cx="${P(sg * gg / 2)}" cy="${Y(y)}" r="${Math.max(3, r.geo.dh / 2 * k)}" class="bolt"/>`));
  h += cotaH(Y(yb + Lp) + 14, P(-gg / 2), P(gg / 2), `g = ${gg}`) + (n > 1 ? cotaV(P(bp / 2) + 10, Y(rows[0]), Y(rows[1]), `s ${s}`, 1) : '');
  return svgW(P(bp / 2) + 50, Y(vg.d + 15) + 30, h, 'Chapa de testa a cortante', 'Izquierda: vista lateral · Derecha: frente de la placa (alma en punteado)');
}
function dibAsiento(c, r){
  const vg = r.geo.vg, bv = +c.bv, bh = +c.bh, t = +c.t, hol = +c.holgura || 0, ts = +c.tSop || 10;
  const k = 420 / (vg.d + Math.max(bv, r.geo.rig ? r.geo.hs : 0) + 40), X = v => 70 + v * k, Y = v => 34 + v * k;
  let h = `<rect x="${X(-ts)}" y="${Y(-20)}" width="${ts * k}" height="${(vg.d + bv + 40) * k}" class="sop"/>
    <path d="M${X(0)} ${Y(vg.d)} h${bh * k} v${t * k} h${-(bh - t) * k} v${(bv - t) * k} h${-t * k} z" class="pl"/>
    <rect x="${X(hol)}" y="${Y(0)}" width="${380 * k}" height="${vg.d * k}" class="vg"/><line x1="${X(hol)}" y1="${Y(vg.tf)}" x2="${X(hol + 380)}" y2="${Y(vg.tf)}" class="vgl"/><line x1="${X(hol)}" y1="${Y(vg.d - vg.tf)}" x2="${X(hol + 380)}" y2="${Y(vg.d - vg.tf)}" class="vgl"/>`;
  const g = r.geo;
  if(g.rig){ const W = g.W, hs = g.hs; h += `<path d="M${X(t)} ${Y(vg.d + t)} L${X(W)} ${Y(vg.d + t)} L${X(W)} ${Y(vg.d + t + 12)} L${X(t)} ${Y(vg.d + hs)} Z" fill="#bfdbfe" stroke="#1e3a8a"/>`
    + cotaV(X(W) + 12, Y(vg.d + t), Y(vg.d + hs), `alto ${hs}`, 1) + `<text x="${X(W / 2)}" y="${Y(vg.d + t + 30)}" class="lbl" text-anchor="middle">PL ${esc(String(c.ts))}</text>`; }
  if(g.sold) h += `<line x1="${X(0) - 2}" y1="${Y(vg.d)}" x2="${X(0) - 2}" y2="${Y(vg.d + (g.rig ? Math.max(bv, g.hs) : bv))}" stroke="#ea580c" stroke-width="4"/>`;
  else for(let i = 0; i < +c.filas; i++){ const y = vg.d + +c.ev + i * 70; h += `<line x1="${X(-ts - 6)}" y1="${Y(y)}" x2="${X(t + 6)}" y2="${Y(y)}" class="bl"/>`; }
  const xN = hol + r.geo.N / 2;
  h += `<g class="carga"><line x1="${X(xN)}" y1="${Y(-45)}" x2="${X(xN)}" y2="${Y(-8)}"/><path d="M${X(xN) - 5} ${Y(-14)} L${X(xN)} ${Y(-4)} L${X(xN) + 5} ${Y(-14)} Z"/></g>
    ${cotaH(Y(vg.d + bv) + 14, X(0), X(bh), `bh = ${bh}`)}${cotaV(X(-ts) - 10, Y(vg.d), Y(vg.d + bv), `bv ${bv}`)}${cotaH(Y(vg.d) - 10, X(hol), X(bh), `N = ${f2(r.geo.N, 0)}`, -1)}
    <text x="${X(hol + 190)}" y="${Y(vg.d / 2)}" class="lbl" text-anchor="middle">${esc(vg.nom)}</text>`;
  return svgW(X(hol + 380) + 20, Y(vg.d + Math.max(bv, g.rig ? g.hs : 0)) + 34, h, 'Asiento con angular', `Elevación · la flecha marca Vu = ${f2(+c.Vu, 1)} kN${g.sold ? ' · soldadura en naranja' : ''}${g.rig ? ' · platina de rigidez en azul' : ''}`);
}
function dibEmpalme(c, r){
  const vg = r.geo.vg, gap = +c.gap || 0, nf = +c.nf, sf = +c.sf, Lef = +c.Lef, tpf = +c.tpf, nw = +c.nw, sw = +c.sw, hpw = +c.hpw, Lew = +c.Lew, Lehw = +c.Lehw;
  const ncw = +c.ncw === 2 ? 2 : 1, gw = ncw === 2 ? +c.gw || 0 : 0;
  const Lpf = 2 * (Lef + (nf - 1) * sf) + gap, Lpw = 2 * (Lehw + gw + Lew) + gap, Wt = Math.max(Lpf, Lpw) + 160, k = Math.min(400 / Wt, 280 / (vg.d + 40));
  const X = v => 20 + (v + Wt / 2) * k, Y = v => 44 + v * k;
  let h = `<rect x="${X(-Wt / 2 + 10)}" y="${Y(0)}" width="${(Wt / 2 - 10 - gap / 2) * k}" height="${vg.d * k}" class="vg"/><rect x="${X(gap / 2)}" y="${Y(0)}" width="${(Wt / 2 - 10 - gap / 2) * k}" height="${vg.d * k}" class="vg"/>
    <rect x="${X(-Lpf / 2)}" y="${Y(-tpf)}" width="${Lpf * k}" height="${tpf * k}" class="pl"/><rect x="${X(-Lpf / 2)}" y="${Y(vg.d)}" width="${Lpf * k}" height="${tpf * k}" class="pl"/>
    <rect x="${X(-Lpw / 2)}" y="${Y((vg.d - hpw) / 2)}" width="${Lpw * k}" height="${hpw * k}" class="pl"/>`;
  if(c.interior){ const ti = +c.tpi || 10;      // cubrejuntas interiores, debajo del ala superior y encima del ala inferior
    h += `<rect x="${X(-Lpf / 2)}" y="${Y(vg.tf)}" width="${Lpf * k}" height="${ti * k}" class="pl"/><rect x="${X(-Lpf / 2)}" y="${Y(vg.d - vg.tf - ti)}" width="${Lpf * k}" height="${ti * k}" class="pl"/>`; }
  for(const sg of [-1, 1]) for(let i = 0; i < nf; i++){ const x = sg * (gap / 2 + Lef + i * sf);
    h += `<line x1="${X(x)}" y1="${Y(-tpf - 6)}" x2="${X(x)}" y2="${Y(vg.tf + 6)}" class="bl"/><line x1="${X(x)}" y1="${Y(vg.d - vg.tf - 6)}" x2="${X(x)}" y2="${Y(vg.d + tpf + 6)}" class="bl"/>`; }
  for(const sg of [-1, 1]) for(let j = 0; j < ncw; j++) for(let i = 0; i < nw; i++) h += `<circle cx="${X(sg * (gap / 2 + Lehw + j * gw))}" cy="${Y((vg.d - hpw) / 2 + Lew + i * sw)}" r="${Math.max(3, r.geo.dh / 2 * k)}" class="bolt"/>`;
  h += cotaH(Y(vg.d + tpf) + 16, X(-Lpf / 2), X(Lpf / 2), `cubrejunta del ala ${f2(Lpf, 0)}`) + `<text x="${X(-Wt / 2 + 10)}" y="${Y(-tpf) - 14}" class="lbl">${esc(vg.nom)}</text>`;
  return svgW(X(Wt / 2) + 10, Y(vg.d + tpf) + 34, h, 'Empalme de viga', 'Elevación · las líneas azules de las alas son pernos vistos de lado');
}
function dibCartela(c, r){
  // Elevación (corregida 20-nov): el extremo de la diagonal queda hacia el soporte (a Le del primer perno); la fuerza entra por el
  // perno más lejano y se abre a 30° hasta el perno más cercano al soporte (sección de Whitmore). Con tubo: ranurado y soldado.
  const red = c.diag === 'redondo', tub = c.diag === 'tubo' || red, th = (+c.theta || 45) * Math.PI / 180, Lwg = +c.Lwg, Lcr = Math.max(+c.Lcr || 0, 40);
  const n = tub ? 0 : +c.n, s = +c.s, Le = tub ? 0 : +c.Le, l = tub ? +c.Lws || 0 : (n - 1) * s, Bt = +(red ? c.Dt : c.Bt) || 0;
  const ux = Math.cos(th), uy = Math.sin(th), nx = -uy, ny = ux;
  const L0 = Lcr / Math.max(uy, 0.3);                                   // del soporte a la sección de Whitmore, sobre el eje
  const P = t => [Lwg / 2 - (L0 + l / 2) * ux * 0.5 + t * ux, t * uy];  // punto sobre el eje de la diagonal (t desde el soporte)
  const p0 = P(L0), pf = P(L0 + l), tip = P(L0 + l + (tub ? 0 : Math.max(Le, 35)));
  const yMax = P(L0 + l + 160)[1] + 10, xMin = Math.min(-20, P(L0 + l + 160)[0] - 40), xMax = Math.max(Lwg + 60, P(L0 + l + 160)[0] + 60);
  const k = 380 / Math.max(xMax - xMin, yMax + 40), X = v => 30 + (v - xMin) * k, Y = v => 20 + (yMax - v) * k;
  const wx = tub ? Bt / 2 + Math.tan(Math.PI / 6) * l : Math.tan(Math.PI / 6) * l, w0 = tub ? Bt / 2 : 0;
  const hb = tub ? Bt / 2 + 20 : 35;                                    // con tubo la cartela atraviesa las dos paredes ranuradas: es más ancha que B
  let h = `<rect x="${X(-20)}" y="${Y(0)}" width="${(Lwg + 60) * k}" height="${14}" class="sop"/>
    <path d="M${X(0)} ${Y(0)} L${X(0)} ${Y(30)} L${X(tip[0] - 45 * ux + hb * nx)} ${Y(tip[1] - 45 * uy + hb * ny)} L${X(tip[0] + hb * nx)} ${Y(tip[1] + hb * ny)} L${X(tip[0] - hb * nx)} ${Y(tip[1] - hb * ny)} L${X(Lwg)} ${Y(40)} L${X(Lwg)} ${Y(0)} Z" class="pl"/>`;
  if(tub){ const a = P(L0), b = P(L0 + l + 170), bw = Bt / 2, sl = P(L0 + l + 25);
    h += `<path d="M${X(a[0] + bw * nx)} ${Y(a[1] + bw * ny)} L${X(b[0] + bw * nx)} ${Y(b[1] + bw * ny)} L${X(b[0] - bw * nx)} ${Y(b[1] - bw * ny)} L${X(a[0] - bw * nx)} ${Y(a[1] - bw * ny)} Z" fill="#cbd5e1" stroke="#475569" opacity=".75"/>
      ${[1, -1].map(sg => `<line x1="${X(pf[0] + sg * bw * nx)}" y1="${Y(pf[1] + sg * bw * ny)}" x2="${X(sl[0] + sg * bw * nx)}" y2="${Y(sl[1] + sg * bw * ny)}" stroke="#1e293b" stroke-width="3" stroke-dasharray="3 2"/>`).join('')}
      ${[1, -1].map(sg => `<line x1="${X(a[0] + sg * bw * nx)}" y1="${Y(a[1] + sg * bw * ny)}" x2="${X(pf[0] + sg * bw * nx)}" y2="${Y(pf[1] + sg * bw * ny)}" stroke="#ea580c" stroke-width="3.5"/>`).join('')}
      <text x="${X(b[0] + bw * nx) + 4}" y="${Y(b[1] + bw * ny)}" class="lbl">tubo ${red ? `⌀${c.Dt}` : `${c.Bt}×${c.Bt}`}×${c.tt}</text>`; }
  else { const a = P(L0 - Le), b = P(L0 + l + 170);
    h += `<line x1="${X(a[0])}" y1="${Y(a[1])}" x2="${X(b[0])}" y2="${Y(b[1])}" stroke="#475569" stroke-width="${Math.max(6, +c.bL * k * 0.5)}" opacity=".55"/>`; }
  h += `<path d="M${X(pf[0] + w0 * nx)} ${Y(pf[1] + w0 * ny)} L${X(p0[0] + wx * nx)} ${Y(p0[1] + wx * ny)} M${X(pf[0] - w0 * nx)} ${Y(pf[1] - w0 * ny)} L${X(p0[0] - wx * nx)} ${Y(p0[1] - wx * ny)} M${X(p0[0] + wx * nx)} ${Y(p0[1] + wx * ny)} L${X(p0[0] - wx * nx)} ${Y(p0[1] - wx * ny)}" fill="none" stroke="#7c3aed" stroke-dasharray="4 3" stroke-width="1.5"/>`;
  for(let i = 0; i < n; i++){ const q = P(L0 + i * s); h += `<circle cx="${X(q[0])}" cy="${Y(q[1])}" r="${Math.max(3, r.geo.dh / 2 * k)}" class="bolt"/>`; }
  h += `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(Lwg)}" y2="${Y(0)}" class="wl"/>${cotaH(Y(0) + 26, X(0), X(Lwg), `soldadura L = ${Lwg}`)}
    <text x="${X(p0[0] - wx * nx) + 4}" y="${Y(p0[1] - wx * ny) + 12}" class="lbl" style="fill:#7c3aed">Whitmore ${f2(r.geo.Lw, 0)}</text>`;
  return svgW(X(xMax) + 10, Y(0) + 44, h, 'Diagonal a cartela', `θ = ${c.theta}° · Pu = ${f2(+c.Pu, 1)} kN · línea morada = sección de Whitmore (30° desde ${tub ? 'el final de la soldadura' : 'el perno más lejano'})${tub ? ' · en naranja los cordones tubo–cartela; punteado la ranura' : ''}`);
}
// Cartela de esquina (24-nov): elevación con la columna a la izquierda, la viga abajo y la cartela en la esquina
function dibEsquina(c, r){
  const g = r.geo || {}, vg = g.vg || { d:300, nom:c.viga }, cl = g.cl || { d:300, bf:300, nom:c.columna }, u = g.ufm || {};
  const alma = c.cara === 'alma', wc = alma ? cl.bf : cl.d, Lh = +c.Lh, Lv = +c.Lv, ang = (+c.ang || 45) * Math.PI / 180;
  const W = wc + Lh + 260, H = vg.d + Lv + 220, k = 380 / Math.max(W, H);
  const X = v => 80 + (v + wc) * k, Y = v => 20 + (Lv + 200 - v) * k;      // x = 0 cara de la columna, y = 0 cara superior de la viga
  const wp = [-(alma ? 0 : wc / 2), -vg.d / 2], far = [wp[0] + (W) * Math.cos(ang), wp[1] + W * Math.sin(ang)];
  let h = `<rect x="${X(-wc)}" y="${Y(Lv + 200)}" width="${wc * k}" height="${(Lv + 200 + vg.d + 20) * k}" class="sop"/>
    <rect x="${X(0)}" y="${Y(0)}" width="${(Lh + 260) * k}" height="${vg.d * k}" class="vg"/>
    <path d="M${X(0)} ${Y(0)} L${X(Lh)} ${Y(0)} L${X(Lh)} ${Y(Lv * 0.25)} L${X(Lh * 0.35)} ${Y(Lv)} L${X(0)} ${Y(Lv)} Z" class="pl"/>
    <line x1="${X(wp[0])}" y1="${Y(wp[1])}" x2="${X(far[0])}" y2="${Y(far[1])}" stroke="#475569" stroke-width="2" stroke-dasharray="6 4"/>
    <line x1="${X(Lh * 0.45)}" y1="${Y(Lh * 0.45 * Math.tan(ang) + wp[1] - wp[0] * Math.tan(ang))}" x2="${X(far[0])}" y2="${Y(far[1])}" stroke="#475569" stroke-width="${Math.max(6, 14)}" opacity=".5"/>
    <line x1="${X(0)}" y1="${Y(0)}" x2="${X(Lh)}" y2="${Y(0)}" class="wl"/><line x1="${X(0)}" y1="${Y(0)}" x2="${X(0)}" y2="${Y(Lv)}" class="wl"/>
    <circle cx="${X(wp[0])}" cy="${Y(wp[1])}" r="3.5" fill="#dc2626"/><text x="${X(wp[0]) + 5}" y="${Y(wp[1]) + 12}" class="lbl" style="fill:#dc2626">punto de trabajo</text>
    <text x="${X(-wc / 2)}" y="${Y(Lv + 160)}" class="lbl" text-anchor="middle">${esc(cl.nom || c.columna)}${alma ? ' (alma)' : ''}</text><text x="${X(Lh + 130)}" y="${Y(-vg.d / 2) + 4}" class="lbl" text-anchor="middle">${esc(vg.nom || c.viga)}</text>`;
  h += cotaH(Y(-vg.d) + 16, X(0), X(Lh), `Lh = ${Lh}`) + cotaV(X(-wc) - 8, Y(0), Y(Lv), `Lv = ${Lv}`);
  if(u.Hb != null) h += `<text x="${X(Lh * 0.5)}" y="${Y(0) - 6}" class="lbl" text-anchor="middle" style="fill:#ea580c">Hb ${f2(u.Hb, 0)} · Vb ${f2(u.Vb, 0)} kN</text>
    <text x="${X(0) + 6}" y="${Y(Lv * 0.55)}" class="lbl" style="fill:#ea580c">Vc ${f2(u.Vc, 0)} · Hc ${f2(u.Hc, 0)} kN</text>`;
  return svgW(X(Lh + 260) + 10, Y(-vg.d) + 40, h, 'Cartela de esquina', `Diagonal a ${c.ang}° · el eje pasa por el punto de trabajo (cruce de los ejes de viga y columna) · en naranja las soldaduras y las fuerzas de cada interfaz (fuerza uniforme)`);
}
// Cruce en X (24-nov): la diagonal continua en gris, la interrumpida llega por los dos lados a la platina
function dibCruce(c, r){
  const red = c.diag === 'redondo', tub = c.diag === 'tubo' || red, B = tub ? +(red ? c.Dt : c.Bt) : +c.bL, bPl = +c.bPl, LcX = +c.LcX;
  const n = tub ? 0 : +c.n, s = +c.s, Le = +c.Le, l = tub ? +c.Lws : (n - 1) * s, Lp = LcX + 2 * (l + (tub ? 0 : Le + 30)), k = 380 / (Lp + 260);
  const X = v => 200 + v * k, Y = v => 130 - v * k;
  let h = `<line x1="${X(-180)}" y1="${Y(-150)}" x2="${X(180)}" y2="${Y(150)}" stroke="#94a3b8" stroke-width="${Math.max(8, B * k)}"/>
    <rect x="${X(-Lp / 2)}" y="${Y(bPl / 2)}" width="${Lp * k}" height="${bPl * k}" class="pl"/>
    <line x1="${X(-180)}" y1="${Y(-150)}" x2="${X(180)}" y2="${Y(150)}" stroke="#94a3b8" stroke-width="${Math.max(8, B * k)}" opacity=".55"/>`;
  for(const sg of [-1, 1]){ const x0 = sg * LcX / 2, x1 = sg * (Lp / 2 + 120);
    h += `<line x1="${X(x0 + sg * (tub ? 0 : -0))}" y1="${Y(0)}" x2="${X(x1)}" y2="${Y(0)}" stroke="#475569" stroke-width="${Math.max(7, B * k * (tub ? 1 : 0.5))}" opacity=".75"/>`;
    for(let i = 0; i < n; i++){ const x = sg * (LcX / 2 + Le + i * s); h += `<circle cx="${X(x)}" cy="${Y(0)}" r="${Math.max(3, (r.geo?.dh || 21) / 2 * k)}" class="bolt"/>`; }
    if(tub) h += `<line x1="${X(sg * LcX / 2)}" y1="${Y(B / 2)}" x2="${X(sg * (LcX / 2 + l))}" y2="${Y(B / 2)}" stroke="#ea580c" stroke-width="3"/>`; }
  h += cotaH(Y(-bPl / 2) + 16, X(-LcX / 2), X(LcX / 2), `libre ${LcX}`) + cotaV(X(-Lp / 2) - 8, Y(bPl / 2), Y(-bPl / 2), `${bPl}`)
    + `<text x="${X(150)}" y="${Y(150) - 6}" class="lbl">diagonal continua</text><text x="${X(-Lp / 2 - 120)}" y="${Y(0) - 12}" class="lbl">diagonal interrumpida</text>`;
  return svgW(X(Lp / 2 + 130) + 10, Y(-bPl / 2) + 40, h, 'Cruce de diagonales en X', `Platina ${bPl} × ${c.tg} mm sobre la diagonal continua · la fuerza (${f2(+c.Pu, 1)} kN) pasa de una mitad a la otra por la platina`);
}
function dibBase(c, r){
  const cl = r.geo.cl, N = +c.N, B = +c.B, Lp = +c.Lp, Wp = +c.Wp, S1 = +c.S1, S2 = +c.S2, nB = +c.nB, R = r.geo.R || {};
  const k = 300 / Math.max(Lp, Wp), X = v => 30 + (v + Lp / 2) * k, Y = v => 44 + (v + Wp / 2) * k;
  // Planta: pedestal, placa, columna (I o tubo), pernos y llave de cortante
  let h = `<rect x="${X(-Lp / 2)}" y="${Y(-Wp / 2)}" width="${Lp * k}" height="${Wp * k}" fill="#e5e7eb" stroke="#94a3b8"/><rect x="${X(-N / 2)}" y="${Y(-B / 2)}" width="${N * k}" height="${B * k}" class="pl"/>`;
  h += cl.tub ? `<rect x="${X(-cl.d / 2)}" y="${Y(-cl.bf / 2)}" width="${cl.d * k}" height="${cl.bf * k}" rx="${Math.min(6, 2 * cl.tf * k)}" fill="#f1f5f9" stroke="#475569" stroke-width="${Math.max(2, cl.tf * k)}"/>`
    : `<path d="M${X(-cl.d / 2)} ${Y(-cl.bf / 2)} h${cl.tf * k} v${(cl.bf - cl.tw) / 2 * k} h${(cl.d - 2 * cl.tf) * k} v${-(cl.bf - cl.tw) / 2 * k} h${cl.tf * k} v${cl.bf * k} h${-cl.tf * k} v${-(cl.bf - cl.tw) / 2 * k} h${-(cl.d - 2 * cl.tf) * k} v${(cl.bf - cl.tw) / 2 * k} h${-cl.tf * k} z" fill="#f1f5f9" stroke="#475569"/>`;
  if(c.cortante === 'llave'){ const lb = +c.lugB, lt = +c.lugT; h += `<rect x="${X(-lt / 2)}" y="${Y(-lb / 2)}" width="${Math.max(3, lt * k)}" height="${lb * k}" fill="#fcd34d" fill-opacity=".55" stroke="#b45309" stroke-dasharray="3 2"/>`; }
  for(const sx of [-1, 1]) for(let j = 0; j < nB; j++){ const y = nB > 1 ? -S2 / 2 + j * S2 / (nB - 1) : 0; h += `<circle cx="${X(sx * S1 / 2)}" cy="${Y(y)}" r="${Math.max(3, 12 * k)}" class="bolt"/>`; }
  h += cotaH(Y(Wp / 2) + 14, X(-N / 2), X(N / 2), `N = ${N}`) + cotaV(X(Lp / 2) + 12, Y(-B / 2), Y(B / 2), `B = ${B}`, 1) + cotaH(Y(-Wp / 2) - 10, X(-S1 / 2), X(S1 / 2), `S1 = ${S1}`, -1)
    + `<text x="${X(-Lp / 2) + 4}" y="${Y(-Wp / 2) + 12}" class="lbl">pedestal ${Lp} × ${Wp}</text>`;
  const planta = svgW(X(Lp / 2) + 70, Y(Wp / 2) + 36, h, 'Placa base: planta', `Planta · columna ${esc(cl.nom)} · el sentido N es el del peralte${c.cortante === 'llave' ? ' · llave de cortante en punteado' : ''}`);
  // Corte en elevación (pedido de Amo 20-nov): pedestal, mortero, placa, pernos con hef y arandela, llave de cortante
  const ha = +c.ha, hef = +c.hef, G = c.mortero ? +c.grout || 25 : 0, tp = +c.tp, Hc = 160, lug = c.cortante === 'llave', lH = lug ? +c.lugH : 0;
  const vis = Math.min(ha, hef + 120), kz = 300 / Math.max(Lp, 1), kv = Math.min(kz, 260 / (vis + G + tp + Hc));
  const XE = v => 40 + (v + Lp / 2) * kz, YE = z => 30 + (Hc + tp + G - z) * kv;            // z = 0 en la cara del pedestal, positivo hacia arriba
  let e = `<rect x="${XE(-Lp / 2)}" y="${YE(0)}" width="${Lp * kz}" height="${vis * kv}" fill="#e5e7eb" stroke="#94a3b8"/>
    ${G ? `<rect x="${XE(-N / 2 - 10)}" y="${YE(G)}" width="${(N + 20) * kz}" height="${G * kv}" fill="#d6d3d1" stroke="#a8a29e"/>` : ''}
    <rect x="${XE(-N / 2)}" y="${YE(G + tp)}" width="${N * kz}" height="${tp * kv}" class="pl"/>
    <rect x="${XE(-cl.d / 2)}" y="${YE(G + tp + Hc)}" width="${cl.d * kz}" height="${Hc * kv}" fill="#f1f5f9" stroke="#475569"/>
    ${cl.tub ? `<line x1="${XE(-cl.d / 2 + cl.tf)}" y1="${YE(G + tp + Hc)}" x2="${XE(-cl.d / 2 + cl.tf)}" y2="${YE(G + tp)}" stroke="#94a3b8" stroke-dasharray="3 2"/><line x1="${XE(cl.d / 2 - cl.tf)}" y1="${YE(G + tp + Hc)}" x2="${XE(cl.d / 2 - cl.tf)}" y2="${YE(G + tp)}" stroke="#94a3b8" stroke-dasharray="3 2"/>`
      : `<rect x="${XE(-cl.d / 2)}" y="${YE(G + tp + Hc)}" width="${cl.tf * kz}" height="${Hc * kv}" fill="#cbd5e1"/><rect x="${XE(cl.d / 2 - cl.tf)}" y="${YE(G + tp + Hc)}" width="${cl.tf * kz}" height="${Hc * kv}" fill="#cbd5e1"/>`}`;
  if(lug) e += `<rect x="${XE(-(+c.lugT) / 2)}" y="${YE(G)}" width="${Math.max(2, +c.lugT * kz)}" height="${lH * kv}" fill="#fcd34d" stroke="#b45309"/><text x="${XE(+c.lugT / 2) + 4}" y="${YE(G - lH / 2)}" class="lbl" style="fill:#b45309">llave ${c.lugH}</text>`;
  const da = { '1/2"':12.7, '5/8"':15.9, '3/4"':19.1, '7/8"':22.2, '1"':25.4, '1-1/8"':28.6, '1-1/4"':31.8 }[c.perno] || 19.1, ar = +c.arandela || 50;
  for(const sx of [-1, 1]){ const x = sx * S1 / 2;
    e += `<line x1="${XE(x)}" y1="${YE(G + tp + 30)}" x2="${XE(x)}" y2="${YE(-hef)}" stroke="#334155" stroke-width="${Math.max(2, da * kz)}"/>
      <rect x="${XE(x) - 7}" y="${YE(G + tp + 12)}" width="14" height="${Math.max(4, 12 * kv)}" fill="#475569"/>
      ${c.cabeza === 'gancho' ? `<path d="M${XE(x)} ${YE(-hef)} q0 8 ${-sx * 14} 8" fill="none" stroke="#334155" stroke-width="${Math.max(2, da * kz)}"/>` : `<rect x="${XE(x) - ar * kz / 2}" y="${YE(-hef) - 3}" width="${ar * kz}" height="6" fill="#475569"/>`}`; }
  e += cotaV(XE(S1 / 2) + 16, YE(0), YE(-hef), `hef ${hef}`, 1) + (G ? `<text x="${XE(N / 2) + 6}" y="${YE(G / 2) + 4}" class="lbl">mortero ${G}</text>` : '')
    + `<text x="${XE(N / 2) + 6}" y="${YE(G + tp / 2) + 4}" class="lbl">placa ${tp}</text><text x="${XE(-Lp / 2) + 4}" y="${YE(-vis) - 6}" class="lbl">pedestal (f'c ${c.fc} MPa)</text>`;
  if(c.refT || c.refV) e += `<path d="M${XE(-Lp / 2 + 40)} ${YE(-30)} V${YE(-Math.min(vis - 20, hef + 60))} H${XE(Lp / 2 - 40)} V${YE(-30)}" fill="none" stroke="#16a34a" stroke-width="2" stroke-dasharray="6 3"/><text x="${XE(-Lp / 2 + 44)}" y="${YE(-Math.min(vis - 20, hef + 60)) - 4}" class="lbl" style="fill:#16a34a">refuerzo de anclaje</text>`;
  const corte = svgW(XE(Lp / 2) + 80, YE(-vis) + 14, e, 'Placa base: corte', `Corte en el sentido N · pernos con ${c.cabeza === 'gancho' ? 'gancho' : `arandela de ${ar} mm`} · ${R.sis ? 'sismo: concreto ×0.75' : ''}`);
  return `<div class="fig-par"><div><div class="fig-tit">Planta</div>${planta}</div><div><div class="fig-tit">Corte</div>${corte}</div></div>`;
}
function dibSoldada(c, r){
  if(c.soporte === 'alma'){ const g = r.geo; return `<div class="fig-par"><div><div class="fig-tit">Planta</div>${svgPlantaDebil(c.dosLados, opDebil(c), c.miembro === 'tubo')}</div><div><div class="fig-tit">Corte por el eje de la viga</div>${svgCorteDebil(opDebil(c), { ts:g.rig?.ts, Lt:c.Lt, wT:c.wT, w:c.union === 'cjp' ? '' : c.w, viga:g.m.nom, tub:c.miembro === 'tubo' })}</div></div>`
    + `<div class="hint" style="text-align:center">Corte por el eje de la viga · viga al alma de ${esc(c.columna)} · ${opDebil(c) === 'tope' ? 'alas a tope (CJP) con la placa' : c.miembro === 'tubo' ? 'placas traslapadas sobre las caras del tubo' : 'placas traslapadas sobre las alas'}</div>`; }
  const al = c.soporte === 'alma', m = r.geo.m, cl0 = c.soporte !== 'placa' ? Conex.perfil(c.columna) : null, cl = al ? null : cl0, ts = al && cl0 ? cl0.tw : cl ? cl.tf : +c.tSop || 20, dc = cl ? cl.d : al && r.geo.rig ? ts + r.geo.rig.bs + 30 : al ? 60 : ts;
  const ca = r.geo.cart, Dt = m.d + (ca ? ca.hh : 0), k = 240 / (Dt + 80), X = v => 30 + (v + dc) * k, Y = v => 40 + v * k, Ls = ca ? Math.max(260, ca.Lh + 160) : 260, cjp = c.union === 'cjp', w = cjp ? 6 : +c.w;
  let h = cl ? `<rect x="${X(-dc)}" y="${Y(-40)}" width="${(dc - ts) * k}" height="${(Dt + 80) * k}" class="vg"/><rect x="${X(-dc)}" y="${Y(-40)}" width="${cl.tf * k}" height="${(Dt + 80) * k}" class="sop"/>` : '';
  h += `<rect x="${X(-ts)}" y="${Y(-40)}" width="${ts * k}" height="${(Dt + 80) * k}" class="sop"/>
    <rect x="${X(0)}" y="${Y(0)}" width="${Ls * k}" height="${m.d * k}" class="vg"/><rect x="${X(0)}" y="${Y(0)}" width="${Ls * k}" height="${m.tf * k}" fill="#475569"/><rect x="${X(0)}" y="${Y(m.d - m.tf)}" width="${Ls * k}" height="${m.tf * k}" fill="#475569"/>`;
  if(al && r.geo.rig){ const tp = r.geo.rig.ts, Lp = r.geo.rig.bs; h += `<rect x="${X(-ts - Lp)}" y="${Y(0)}" width="${Lp * k}" height="${tp * k}" fill="#93c5fd" stroke="#1d4ed8"/><rect x="${X(-ts - Lp)}" y="${Y(m.d - tp)}" width="${Lp * k}" height="${tp * k}" fill="#93c5fd" stroke="#1d4ed8"/>
    <text x="${X(-ts - Lp / 2)}" y="${Y(0) - 4}" class="lbl" text-anchor="middle" fill="#1d4ed8">placas ${tp} mm (a ambos lados del alma)</text>`; }
  const tri = (y, sg) => `<path d="M${X(0)} ${Y(y)} l${w * k * 1.6} 0 l${-w * k * 1.6} ${sg * w * k * 1.6} z" class="wld"/>`;
  h += cjp ? `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(0)}" y2="${Y(m.d)}" class="wl"/>` : tri(0, -1) + tri(m.tf, 1) + tri(m.d - m.tf, -1) + tri(m.d, 1) + `<line x1="${X(0)}" y1="${Y(m.tf)}" x2="${X(0)}" y2="${Y(m.d - m.tf)}" class="wl"/>`;
  h += `<text x="${X(Ls / 2)}" y="${Y(m.d / 2) + 3}" class="lbl" text-anchor="middle">${esc(m.nom)}</text><text x="${al ? X(-ts / 2) : X(-dc / 2)}" y="${Y(Dt + 40) + 12}" class="lbl" text-anchor="middle">${cl ? esc(cl.nom) : al && cl0 ? `alma de ${esc(cl0.nom)}` : `placa ${ts} mm`}</text>`;
  if(ca){   // cartela bajo el ala inferior (pedido de Amo 25-nov)
    const y0 = m.d, pl = ca.k === 'pl', col = pl ? '#b45309' : '#1d4ed8', tf2 = pl ? 0 : ca.tfh / Math.cos(ca.th * Math.PI / 180);
    h += `<polygon points="${X(0)},${Y(y0)} ${X(0)},${Y(y0 + ca.hh)} ${X(ca.Lh)},${Y(y0)}" fill="${pl ? '#fef3c7' : '#dbeafe'}" stroke="${col}"/>`;
    h += pl ? `<line x1="${X(0)}" y1="${Y(y0 + ca.hh)}" x2="${X(ca.Lh)}" y2="${Y(y0)}" stroke="#dc2626" stroke-width="1.6"/>`
      : `<polygon points="${X(0)},${Y(y0 + ca.hh - tf2)} ${X(0)},${Y(y0 + ca.hh)} ${X(ca.Lh + tf2 / Math.tan(ca.th * Math.PI / 180))},${Y(y0)} ${X(ca.Lh)},${Y(y0)}" fill="${ca.k === 'T' ? '#60a5fa' : '#a5b4fc'}" stroke="${col}"/>`;
    h += `<line x1="${X(0) + 2}" y1="${Y(y0) + 2}" x2="${X(ca.Lh)}" y2="${Y(y0) + 2}" stroke="#ea580c" stroke-width="3" stroke-dasharray="4 2"/>`;
    if(!cjp) h += `<line x1="${X(0) + 1.5}" y1="${Y(y0)}" x2="${X(0) + 1.5}" y2="${Y(y0 + ca.hh)}" stroke="#ea580c" stroke-width="3"/>`;
    if(ca.rigPunta) h += `<rect x="${X(ca.Lh) - 2}" y="${Y(m.tf)}" width="4" height="${(m.d - 2 * m.tf) * k}" fill="#93c5fd" stroke="#1d4ed8"/>`;
    h += `<line x1="${X(0)}" y1="${Y(y0 + ca.hh + 18)}" x2="${X(ca.Lh)}" y2="${Y(y0 + ca.hh + 18)}" stroke="#64748b"/><text x="${X(ca.Lh / 2)}" y="${Y(y0 + ca.hh + 18) + 12}" class="lbl" text-anchor="middle">Lh = ${ca.Lh} mm</text>
      <line x1="${X(ca.Lh + 24)}" y1="${Y(y0)}" x2="${X(ca.Lh + 24)}" y2="${Y(y0 + ca.hh)}" stroke="#64748b"/><text x="${X(ca.Lh + 30)}" y="${Y(y0 + ca.hh / 2) + 4}" class="lbl">hh = ${ca.hh} · θ ${ca.th.toFixed(1)}°</text>`; }
  // sección vista desde el soporte: contorno soldado
  const ox = X(Ls + 50), k2 = Math.min(k, 150 / Math.max(m.bf, 1)), S = (u, v) => `${ox + u * k2},${Y(0) + v * k2}`;
  const perfilPath = m.tub ? `M${S(0, 0)} L${S(m.bf, 0)} L${S(m.bf, m.d)} L${S(0, m.d)} Z M${S(m.tw, m.tf)} L${S(m.tw, m.d - m.tf)} L${S(m.bf - m.tw, m.d - m.tf)} L${S(m.bf - m.tw, m.tf)} Z`
    : `M${S(0, 0)} L${S(m.bf, 0)} L${S(m.bf, m.tf)} L${S((m.bf + m.tw) / 2, m.tf)} L${S((m.bf + m.tw) / 2, m.d - m.tf)} L${S(m.bf, m.d - m.tf)} L${S(m.bf, m.d)} L${S(0, m.d)} L${S(0, m.d - m.tf)} L${S((m.bf - m.tw) / 2, m.d - m.tf)} L${S((m.bf - m.tw) / 2, m.tf)} L${S(0, m.tf)} Z`;
  h += `<path d="${perfilPath}" fill="#f1f5f9" stroke="#b45309" stroke-width="${cjp ? 2 : 3.2}" fill-rule="evenodd"/>
    <text x="${ox + m.bf * k2 / 2}" y="${Y(m.d) + 16}" class="lbl" text-anchor="middle">${cjp ? 'penetración completa' : `filete ${c.w} mm en todo el contorno`}</text>`;
  return `<svg viewBox="0 0 ${ox + m.bf * k2 + 30} ${Y(Dt + 40) + 22}" class="dsvg" role="img" aria-label="Unión soldada en todo el perímetro">${h}</svg>
    <div class="hint" style="text-align:center">Izquierda: elevación · Derecha: sección en la cara del soporte (en naranja la soldadura)</div>`;
}
function dibEmpCol(c, r){
  // Elevación de frente al alma: la columna de abajo y la de arriba, con las cubrejuntas, la soldadura o la placa de tope
  const g = r.geo, I = g.I, Su = g.Su, un = g.un, dM = Math.max(I.d, Su.d), tp = un === 'pernos' ? g.tpf : un === 'placa' ? g.tp : 0;
  const Lpf = un === 'pernos' ? 2 * (g.Lef + (g.nf - 1) * g.sf) + g.gap : 0, Lpw = un === 'pernos' ? 2 * (g.Lehw + (g.nw - 1) * 0 + g.Lew) + g.gap : 0;
  const H = Math.max(Lpf, 300) + 160, W = (un === 'placa' ? Math.max(g.Np, dM) : dM + 2 * tp) + 140, k = Math.min(300 / W, 330 / H);
  const cx = 80 + W / 2 * k, cy = 20 + H / 2 * k, X = v => cx + v * k, Y = v => cy - v * k, gap = un === 'pernos' ? g.gap / 2 : un === 'placa' ? g.tp / 2 : 0;
  const col = (s, y1, y2, rel) => `<rect x="${X(-s.d / 2)}" y="${Y(Math.max(y1, y2))}" width="${s.d * k}" height="${Math.abs(y2 - y1) * k}" class="vg"/>
    <line x1="${X(-s.d / 2 + s.tf)}" y1="${Y(y1)}" x2="${X(-s.d / 2 + s.tf)}" y2="${Y(y2)}" class="vgl"/><line x1="${X(s.d / 2 - s.tf)}" y1="${Y(y1)}" x2="${X(s.d / 2 - s.tf)}" y2="${Y(y2)}" class="vgl"/>
    <text x="${X(0)}" y="${Y((y1 + y2) / 2)}" class="lbl" text-anchor="middle">${esc(s.nom)}</text><text x="${X(0)}" y="${Y((y1 + y2) / 2) + 12}" class="lbl" text-anchor="middle" style="font-size:9px">${rel}</text>`;
  const top = H / 2 - 20;
  let h = col(I, -top, -gap, 'abajo') + col(Su, gap, top, 'arriba');
  if(un === 'pernos'){
    const xo = dM / 2;
    for(const sg of [-1, 1]){ h += `<rect x="${sg < 0 ? X(-xo - tp) : X(xo)}" y="${Y(Lpf / 2)}" width="${tp * k}" height="${Lpf * k}" class="pl"/>`;
      for(const s of [I, Su]) if(s.d < dM - 1){ const yA = s === Su ? gap : -Lpf / 2, yB = s === Su ? Lpf / 2 : -gap;
        h += `<rect x="${sg < 0 ? X(-xo) : X(s.d / 2)}" y="${Y(yB)}" width="${(xo - s.d / 2) * k}" height="${(yB - yA) * k}" fill="#fde68a" stroke="#b45309"/>`; }
      for(const sv of [-1, 1]) for(let i = 0; i < g.nf; i++){ const y = sv * (gap + g.Lef + i * g.sf), sd = sv > 0 ? Su : I;
        h += `<line x1="${sg < 0 ? X(-xo - tp - 6) : X(sd.d / 2 - sd.tf - 6)}" y1="${Y(y)}" x2="${sg < 0 ? X(-sd.d / 2 + sd.tf + 6) : X(xo + tp + 6)}" y2="${Y(y)}" class="bl"/>`; } }
    const Lw = 2 * (g.Lehw + (g.nw > 0 ? 0 : 0)) + g.gap + 2 * g.Lew;   // alto de la cubrejunta del alma (vertical)
    h += `<rect x="${X(-g.hpw / 2)}" y="${Y(Lw / 2)}" width="${g.hpw * k}" height="${Lw * k}" class="pl" opacity=".85"/>`;
    for(const sv of [-1, 1]) for(let i = 0; i < g.nw; i++) h += `<circle cx="${X(-g.hpw / 2 + g.Lew + i * g.sw)}" cy="${Y(sv * (gap + g.Lehw))}" r="${Math.max(3, g.dh / 2 * k)}" class="bolt"/>`;
    h += cotaV(X(-xo - tp) - 12, Y(Lpf / 2), Y(-Lpf / 2), `cubrejunta ${Math.round(Lpf)}`);
  } else if(un === 'cjp'){
    h += `<line x1="${X(-dM / 2 - 8)}" y1="${Y(0)}" x2="${X(dM / 2 + 8)}" y2="${Y(0)}" stroke="#ea580c" stroke-width="4"/><text x="${X(dM / 2 + 12)}" y="${Y(0) + 4}" class="lbl" fill="#ea580c">CJP</text>`;
  } else {
    h += `<rect x="${X(-g.Np / 2)}" y="${Y(g.tp / 2)}" width="${g.Np * k}" height="${g.tp * k}" class="pl"/>`;
    for(const [s, y] of [[Su, g.tp / 2], [I, -g.tp / 2]]) for(const sg of [-1, 1]) h += `<path d="M${X(sg * s.d / 2)} ${Y(y)} l${sg * 6} 0 l${-sg * 6} ${y > 0 ? -6 : 6} z" fill="#ea580c"/>`;
    h += cotaH(Y(-g.tp / 2) + 16, X(-g.Np / 2), X(g.Np / 2), `placa ${g.Np} × ${g.tp}`);
  }
  return svgW(X(W / 2) + 20, Y(-H / 2) + 20, h, 'Empalme de columna', un === 'pernos' ? 'Elevación (alas a los lados): cubrejuntas en azul, rellenos en amarillo, pernos de las alas como líneas' : un === 'cjp' ? 'Elevación: soldadura de penetración completa en naranja' : 'Elevación: placa de tope en azul y filetes en naranja');
}
function dibEmpZ(c, r){
  const p = r.geo.pf, a = +c.a || 0, Lt = a + 360, k = Math.min(560 / Lt, 200 / (p.d + 60)), X = v => 48 + (v + Lt / 2) * k, Y = v => 34 + v * k;
  const x1 = -a / 2, x2 = a / 2;
  let h = `<rect x="${X(-Lt / 2)}" y="${Y(0)}" width="${Lt * k}" height="${p.d * k}" class="vg"/><rect x="${X(-Lt / 2)}" y="${Y(0)}" width="${Lt * k}" height="${p.tf * k}" fill="#475569"/><rect x="${X(-Lt / 2)}" y="${Y(p.d - p.tf)}" width="${Lt * k}" height="${p.tf * k}" fill="#475569"/>
    <path d="M${X(x1)} ${Y(-6)} V${Y(p.d / 2)} H${X(x2)} V${Y(p.d + 6)}" fill="none" stroke="#b45309" stroke-width="3.2"/>
    ${(() => { const g = r.geo, hR = g.hRat || 19, LR = g.Lrat || 38, rr = Math.min(hR, LR) * k / 2, bv = Math.max(9, p.tf * k * 1.4);
      // ratoneras: en el alma junto al ala cortada, del lado de la pieza que lleva el alma (pedido de Amo 20-nov) · bisel de las alas (CJP)
      const rat = (x0, y0) => `<rect x="${X(x0)}" y="${Y(y0)}" width="${LR * k}" height="${hR * k}" rx="${rr}" fill="#fff" stroke="#1e3a8a" stroke-width="1.2"/>`;
      const bis = (x, y, sg) => g.cjp ? `<path d="M${X(x) - bv * 0.6} ${y} L${X(x)} ${y + sg * bv} L${X(x) + bv * 0.6} ${y} Z" fill="#fde68a" stroke="#b45309"/>` : '';
      return rat(x1, p.tf) + rat(x2 - LR, p.d - p.tf - hR) + bis(x1, Y(0), 1) + bis(x2, Y(p.d), -1)
        + `<line x1="${X(x1 + LR)}" y1="${Y(p.tf + hR / 2)}" x2="${X(x1 + LR) + 40}" y2="${Y(p.tf + hR / 2) - 22}" stroke="#1e3a8a"/><text x="${X(x1 + LR) + 42}" y="${Y(p.tf + hR / 2) - 24}" class="lbl" fill="#1e3a8a">ratonera ${hR} × ${LR}</text>`
        + (g.cjp ? `<text x="${X(x2) + 10}" y="${Y(p.d) + 16}" class="lbl" fill="#b45309">bisel de las alas (CJP)</text>` : ''); })()}
    <text x="${X(-Lt / 4 - 30)}" y="${Y(p.d / 2) + 3}" class="lbl" text-anchor="middle">tramo 1</text><text x="${X(Lt / 4 + 30)}" y="${Y(p.d / 2) + 3}" class="lbl" text-anchor="middle">tramo 2</text>
    ${cotaH(Y(p.d) + 18, X(x1), X(x2), `a = ${a}`)}${cotaV(X(-Lt / 2) - 4, Y(0), Y(p.d), `d ${p.d}`)}
    <text x="${X(-Lt / 2)}" y="${Y(-14)}" class="lbl">${esc(p.nom)} · ${c.union === 'pjp' ? 'penetración parcial' : 'penetración completa'}</text>`;
  return `<svg viewBox="0 0 ${X(Lt / 2) + 20} ${Y(p.d) + 40}" class="dsvg" role="img" aria-label="Empalme en Z">${h}</svg>
    <div class="hint" style="text-align:center">Elevación · en naranja la línea de corte y soldadura en Z (ala superior, eje del alma en la longitud a, ala inferior) · ratoneras junto a las alas cortadas${r.geo.cjp ? ' · bisel de las alas para penetración completa' : ''}</div>`;
}
function dibTesta(c, r){
  const g = r.geo, vg = g.vg, cl = g.cl, db = vg.d, tf = vg.tf, pfo = +c.pfo, pfi = +c.pfi, de = +c.de, tp = +c.tp, bp = +c.bp, gg = +c.g;
  const ras = c.tipo === 'ras', pb = +c.pb || 0, f2r = +c.filas === 2, e8 = !!g.e8, ext = e8 ? pfo + pb + de : pfo + de;
  const top = ras ? -25 : -ext, bot = ras ? db + 25 : c.ambos ? db + ext : db + 25, Hp = bot - top, k = 300 / (Hp + 60);
  const tcf = cl ? cl.tf : 12, dc = cl ? cl.d : 200, bfc = cl ? cl.bf : bp + 20;
  // vista lateral
  const X = v => 70 + (v + dc) * k, Y = v => 40 + (v - top) * k;
  const filas = ras ? [tf + pfi].concat(f2r ? [tf + pfi + pb] : []).concat(c.ambos ? [db - tf - pfi].concat(f2r ? [db - tf - pfi - pb] : []) : [])
    : e8 ? [-pfo - pb, -pfo, tf + pfi, tf + pfi + pb].concat(c.ambos ? [db - tf - pfi - pb, db - tf - pfi, db + pfo, db + pfo + pb] : [])
    : [-pfo, tf + pfi].concat(c.ambos ? [db - tf - pfi, db + pfo] : []);
  let h = `<rect x="${X(-dc)}" y="${Y(top - 25)}" width="${(dc - tcf) * k}" height="${(Hp + 50) * k}" class="vg"/><rect x="${X(-tcf)}" y="${Y(top - 25)}" width="${tcf * k}" height="${(Hp + 50) * k}" class="sop"/>
    <rect x="${X(-dc)}" y="${Y(top - 25)}" width="${tcf * k}" height="${(Hp + 50) * k}" class="sop"/>
    <rect x="${X(0)}" y="${Y(top)}" width="${tp * k}" height="${Hp * k}" class="pl"/>
    <rect x="${X(tp)}" y="${Y(0)}" width="${260 * k}" height="${db * k}" class="vg"/>
    <rect x="${X(tp)}" y="${Y(0)}" width="${260 * k}" height="${tf * k}" fill="#475569"/><rect x="${X(tp)}" y="${Y(db - tf)}" width="${260 * k}" height="${tf * k}" fill="#475569"/>`;
  // 8ES: rigidizador triangular de la extensión (alto = extensión, largo = alto/tan30°)
  if(e8){ const Lst = ext / Math.tan(Math.PI / 6), tri = (y0, sg) => `<path d="M${X(tp)} ${Y(y0 + sg * ext)} L${X(tp)} ${Y(y0)} L${X(tp + Lst)} ${Y(y0)} Z" fill="#bfdbfe" stroke="#1e3a8a"/>`;
    h += tri(0, -1) + (c.ambos ? tri(db, 1) : ''); }
  // rigidizadores (placas de continuidad) de la columna a la altura de las alas de la viga
  if(g.rig) [tf / 2, db - tf / 2].forEach(y => h += `<rect x="${X(-dc + tcf)}" y="${Y(y) - g.rig.ts * k / 2}" width="${(dc - 2 * tcf) * k}" height="${Math.max(2, g.rig.ts * k)}" fill="#bfdbfe" stroke="#1e3a8a"/>`);
  // viga al otro lado de la columna (solo como referencia)
  if(c.dosLados) h += `<rect x="${X(-dc) - 34}" y="${Y(0)}" width="34" height="${db * k}" class="vg" stroke-dasharray="4 3"/><text x="${X(-dc) - 17}" y="${Y(db / 2) + 3}" class="lbl" text-anchor="middle">M₂</text>`;
  filas.forEach(y => h += `<line x1="${X(-tcf - 6)}" y1="${Y(y)}" x2="${X(tp + 6)}" y2="${Y(y)}" class="bl"/>`);
  h += (ras ? (f2r ? cotaV(X(-dc) - 8, Y(tf + pfi), Y(tf + pfi + pb), `pb ${pb}`) : '') : cotaV(X(-dc) - 8, Y(top), Y(-pfo), `de ${de}`) + cotaV(X(-dc) - 8, Y(-pfo), Y(0), `pfo ${pfo}`)) + cotaV(X(-dc) - 8, Y(tf), Y(tf + pfi), `pfi ${pfi}`)
    + `<text x="${X(tp + 110)}" y="${Y(db / 2) + 3}" class="lbl" text-anchor="middle">${esc(vg.nom)}</text><text x="${X(-dc / 2)}" y="${Y(bot + 25) + 12}" class="lbl" text-anchor="middle">${cl ? esc(cl.nom) : 'columna'}</text>
    <text x="${X(tp / 2)}" y="${Y(top) - 5}" class="lbl" text-anchor="middle">PL ${tp}</text>
    <g class="mom"><path d="M${X(tp + 215)} ${Y(-10)} A ${(db + 30) * k * 0.62} ${(db + 30) * k * 0.62} 0 0 1 ${X(tp + 215)} ${Y(db + 10)}"/><path class="pt" d="M${X(tp + 215) + 7} ${Y(db + 10) - 7} L${X(tp + 215)} ${Y(db + 10)} L${X(tp + 215) + 9} ${Y(db + 10) + 3} Z"/></g>
    <text x="${X(tp + 215)}" y="${Y(-10) - 4}" class="lbl" text-anchor="middle" style="fill:#7c3aed">${c.sismo && c.sismo !== 'no' ? 'Mf' : 'Mu'} = ${f2(g.Mu ?? +c.Mu, 1)}</text>`;
  // vista de la placa (frente)
  const ox = X(tp + 290), k2 = k, PX = v => ox + 20 + (v + bp / 2) * k2;
  h += `<rect x="${PX(-bp / 2)}" y="${Y(top)}" width="${bp * k2}" height="${Hp * k2}" class="pl"/>
    <path d="M${PX(-vg.bf / 2)} ${Y(0)} h${vg.bf * k2} v${tf * k2} h${-(vg.bf - vg.tw) / 2 * k2} v${(db - 2 * tf) * k2} h${(vg.bf - vg.tw) / 2 * k2} v${tf * k2} h${-vg.bf * k2} v${-tf * k2} h${(vg.bf - vg.tw) / 2 * k2} v${-(db - 2 * tf) * k2} h${-(vg.bf - vg.tw) / 2 * k2} z" fill="none" stroke="#475569" stroke-dasharray="3 2"/>`;
  filas.forEach(y => [-1, 1].forEach(sg => h += `<circle cx="${PX(sg * gg / 2)}" cy="${Y(y)}" r="${Math.max(3, g.dh / 2 * k2)}" class="bolt"/>`));
  h += cotaH(Y(bot) + 14, PX(-gg / 2), PX(gg / 2), `g = ${gg}`) + cotaH(Y(top) - 10, PX(-bp / 2), PX(bp / 2), `bp = ${bp}`, -1);
  return `<svg viewBox="0 0 ${PX(bp / 2) + 20} ${Y(bot + 25) + 26}" class="dsvg" role="img" aria-label="Chapa de testa: vista lateral y frente de la placa">${h}</svg>
    <div class="hint" style="text-align:center">Izquierda: vista lateral · Derecha: frente de la placa (la viga en líneas punteadas)${e8 ? ' · rigidizador de la extensión en azul' : ''}${g.rig ? ` · rigidizadores de la columna ${g.rig.bs}×${g.rig.ts} mm en azul` : ''}</div>`;
}
function dibAleta(c, r){
  const g = r.geo, vg = g.vg, n = +c.n, s = +c.s, Lev = +c.Lev, Leh = +c.Leh, a = +c.a, hol = +c.holgura || 0, tp = +c.tp;
  const W = a + Leh + 160, H = vg.d + 40, k = Math.min(300 / W, 330 / H);
  const X = v => 92 + v * k, Y = v => 50 + v * k;
  const yb = g.yb ?? (vg.d - g.Lp) / 2;                           // chapa centrada en el alma (o bajo el destaje)
  const dct = g.dct || 0, dcb = g.dcb || 0, xc = hol + (g.cD || 0), xe = a + Leh + 140;
  const sup = `<rect x="${X(-24)}" y="${Y(-12)}" width="${24 * k}" height="${(vg.d + 24) * k}" class="sop"/>`;
  const contorno = (dct || dcb) ? `M${X(hol)},${Y(dct)} L${X(xc)},${Y(dct)} L${X(xc)},${Y(0)} L${X(xe)},${Y(0)} L${X(xe)},${Y(vg.d)} L${X(xc)},${Y(vg.d)} L${X(xc)},${Y(vg.d - dcb)} L${X(hol)},${Y(vg.d - dcb)} Z`
    : `M${X(hol)},${Y(0)} L${X(xe)},${Y(0)} L${X(xe)},${Y(vg.d)} L${X(hol)},${Y(vg.d)} Z`;
  const viga = `<path d="${contorno}" class="vg"/>
    <line x1="${X(dct ? xc : hol)}" y1="${Y(vg.tf)}" x2="${X(xe)}" y2="${Y(vg.tf)}" class="vgl"/><line x1="${X(dcb ? xc : hol)}" y1="${Y(vg.d - vg.tf)}" x2="${X(xe)}" y2="${Y(vg.d - vg.tf)}" class="vgl"/>`
    + (dct ? cotaV(X(xc) + 10, Y(0), Y(dct), `dc ${dct}`, 1) + cotaH(Y(vg.d) + 40, X(hol), X(xc), `destaje c = ${g.cD}`) : '') + (dcb ? cotaV(X(xc) + 10, Y(vg.d - dcb), Y(vg.d), `${dcb}`, 1) : '');
  const ch = `<rect x="${X(0)}" y="${Y(yb)}" width="${(a + Leh) * k}" height="${g.Lp * k}" class="pl"/>`;
  const sold = `<path d="M${X(0)} ${Y(yb)} l${6} ${0} l${-6} ${6} z M${X(0)} ${Y(yb + g.Lp)} l6 0 l-6 -6 z" class="wld"/><line x1="${X(0)}" y1="${Y(yb)}" x2="${X(0)}" y2="${Y(yb + g.Lp)}" class="wl"/>`;
  const per = Array.from({ length:n }, (_, i) => `<circle cx="${X(a)}" cy="${Y(yb + Lev + i * s)}" r="${Math.max(3, g.dh / 2 * k)}" class="bolt"/>`).join('');
  const cot = cotaV(X(-34), Y(yb), Y(yb + g.Lp), `Lp ${f2(g.Lp, 0)}`) + (n > 1 ? cotaV(X(a + Leh + 14), Y(yb + Lev), Y(yb + Lev + s), `s = ${s}`, 1) : '')
    + cotaV(X(a + Leh + 14), Y(yb + g.Lp - Lev), Y(yb + g.Lp), `Lev = ${Lev}`, 1)
    + cotaH(Y(vg.d) + 16, X(0), X(a), `a = ${a}`) + cotaH(Y(vg.d) + 16, X(a), X(a + Leh), `Leh = ${Leh}`) + (hol ? cotaH(Y(-12) - 8, X(0), X(hol), `holgura ${hol}`, -1) : '');
  const txt = `<text x="${X(a + Leh + 100)}" y="${Y(vg.d / 2)}" class="lbl" text-anchor="middle">${esc(vg.nom)}</text><text x="${X(-12)}" y="${Y(vg.d + 10)}" class="lbl" text-anchor="middle">soporte</text>
    <text x="${X((a + Leh) / 2)}" y="${Y(yb) + 12}" class="lbl" text-anchor="middle">PL ${tp} · w ${c.w}</text>`;
  const V = `<g class="carga"><line x1="${X(a)}" y1="${Y(yb + g.Lp) + 10}" x2="${X(a)}" y2="${Y(yb + g.Lp) + 34}"/><path d="M${X(a) - 5} ${Y(yb + g.Lp) + 28} L${X(a)} ${Y(yb + g.Lp) + 36} L${X(a) + 5} ${Y(yb + g.Lp) + 28} Z"/></g>`;
  return `<svg viewBox="0 0 ${X(a + Leh + 140) + 10} ${Y(vg.d) + (dct ? 62 : 44)}" class="dsvg" role="img" aria-label="Elevación de la chapa de aleta">${sup}${viga}${ch}${sold}${per}${cot}${txt}${V}</svg>
    <div class="hint" style="text-align:center">Elevación · la flecha marca Vu = ${f2(+c.Vu, 1)} kN · configuración ${g.conv ? 'convencional' : 'extendida'} (pernos con e = ${f2(g.eB, 0)} mm)${g.des && g.des !== 'no' ? ` · destaje ho = ${f2(g.ho, 0)} mm` : ''}</div>`;
}
function dibGrupo(c, r){
  const g = r.geo, nf = +c.filas, nc = +c.cols, s = +c.s, gg = +c.g, Lev = +c.Lev, Leh = +c.Leh, e = +c.e, ang = +c.ang || 0;
  const Bw = (nc - 1) * gg + 2 * Leh, Hp = g.Hp, xc = Leh + (nc - 1) * gg / 2, yc = Lev + (nf - 1) * s / 2;
  const xmin = Math.min(-60, xc + e - 30), xmax = Math.max(Bw + 20, xc + e + 40) + 110, W = xmax - xmin, k = Math.min(330 / W, 300 / (Hp + 60));
  const X = v => 20 + (v - xmin) * k, Y = v => 44 + v * k;
  let h = `<rect x="${X(-12)}" y="${Y(-20)}" width="${12 * k}" height="${(Hp + 40) * k}" class="sop"/><rect x="${X(0)}" y="${Y(0)}" width="${Bw * k}" height="${Hp * k}" class="pl"/>`;
  for(let j = 0; j < nc; j++) for(let i = 0; i < nf; i++) h += `<circle cx="${X(Leh + j * gg)}" cy="${Y(Lev + i * s)}" r="${Math.max(3, (+c.d + 1.6) / 2 * k)}" class="bolt"/>`;
  h += `<circle cx="${X(xc)}" cy="${Y(yc)}" r="3" class="cg"/><text x="${X(xc) + 5}" y="${Y(yc) - 5}" class="lbl">CG</text>`;
  const t = ang * Math.PI / 180, lx = X(xc + e), ly = Y(yc), L = 46;
  h += `<g class="carga"><line x1="${lx - Math.sin(t) * L}" y1="${ly - Math.cos(t) * L}" x2="${lx}" y2="${ly}"/><circle cx="${lx}" cy="${ly}" r="3"/>
    <path d="M${lx} ${ly} l${-5 * Math.cos(t) - 8 * Math.sin(t)} ${5 * Math.sin(t) - 8 * Math.cos(t)} l${10 * Math.cos(t)} ${-10 * Math.sin(t)} z"/></g>
    <text x="${lx + 6}" y="${ly - L / 2}" class="lbl">Pu = ${f2(+c.Pu, 1)} kN</text>`;
  if(isFinite(g.ic?.ro) && !ang && Math.abs(xc - Math.sign(e) * g.ic.ro - xmin) < W) h += `<g class="icr"><circle cx="${X(xc - Math.sign(e) * g.ic.ro)}" cy="${Y(yc)}" r="4"/><text x="${X(xc - Math.sign(e) * g.ic.ro)}" y="${Y(yc) + 15}" text-anchor="middle">CI</text></g>`;
  h += cotaH(Y(Hp) + 16, X(xc), X(xc + e), `e = ${e}`) + (nf > 1 ? cotaV(X(-22), Y(Lev), Y(Lev + s), `s = ${s}`) : '') + (nc > 1 ? cotaH(Y(0) - 10, X(Leh), X(Leh + gg), `g = ${gg}`, -1) : '');
  return `<svg viewBox="0 0 ${X(xmax) + 20} ${Y(Hp) + 40}" class="dsvg" role="img" aria-label="Grupo de pernos con la carga excéntrica">${h}</svg>
    <div class="hint" style="text-align:center">CG = centro del grupo · CI = centro instantáneo de rotación</div>`;
}

// ── Lista en el celular (igual que el generador: una línea fija con el elemento abierto) ─────────────
function datosPrint(c){
  const t = (l, v) => `<tr><th>${l}</th><td>${v}</td></tr>`, dn = (Conex.DIAM.find(x => x[1] === +c.d) || [c.d])[0];
  if(['ras', 'testaV', 'asiento', 'empalme', 'cartela', 'esquina', 'cruce', 'base', 'soldada', 'empZ', 'empCol'].includes(c.tipo)){
    const carga = cargasTxt(c);
    return `<table class="t kv">${t('Cargas', carga)}${seccionesDe(c).map(([, tt, res]) => t(esc(tt), esc(res()))).join('')}</table>`; }
  if(c.tipo === 'angular') return `<table class="t kv">${t('Cargas', cargasTxt(c))}${t('Viga', `${esc(c.viga)} · ${esc(c.aceroViga)} · holgura ${c.holgura} mm`)}${t('Soporte', `${SOPN[c.soporte]} · t = ${c.tSop} mm · ${esc(c.aceroSop)} · angulares ${c.unSop === 'sold' ? `soldados (filete ${c.wS} mm ${esc(c.electrodo || '')}, retorno 2w)` : 'atornillados'}`)}
    ${c.destaje && c.destaje !== 'no' ? t('Destaje', `${c.destaje === 'sup' ? 'ala superior' : 'las dos alas'}: dc = ${c.dct}${c.destaje === 'ambos' ? ` / ${c.dcb}` : ''} mm, c = ${c.cDes} mm, perno superior a ${c.LevB} mm del corte`) : ''}
    ${t('Angulares', `2L ${c.bAng}×${c.bAng}×${c.tAng} mm · ${esc(c.aceroAng)}`)}${t('Pernos', `${c.n} en el alma${c.unSop === 'sold' ? '' : ` + ${2 * c.n} en el soporte`}, ${dn} ${esc(c.grado)}-${esc(c.rosca)}${c.cizalla ? ' · bordes con cizalla' : ''}`)}${t('Distancias', `s = ${c.s} · Lev = ${c.Lev} · g₁ = ${c.g1}${c.unSop === 'sold' ? '' : ` · g₂ = ${c.g2}`} mm`)}</table>`;
  if(c.tipo === 'testa') return `<table class="t kv">${t('Cargas', cargasTxt(c))}${t('Viga', `${esc(c.viga)} · ${esc(c.aceroViga)}`)}${t('Columna', c.columna ? `${esc(c.columna)} · ${esc(c.aceroCol)}` : 'no revisada')}
    ${t('Placa', `${c.tp} × ${c.bp} mm · ${esc(c.aceroPl)} · extensión ${c.ambos ? 'arriba y abajo' : 'arriba'}`)}${t('Pernos', `${c.ambos ? 8 : 4 + (+c.nbc || 0)} × ${dn} ${esc(c.grado)}-${esc(c.rosca)} pretensionados · g = ${c.g} mm`)}
    ${t('Distancias', `pfo = ${c.pfo} · pfi = ${c.pfi} · de = ${c.de} mm`)}${t('Soldaduras', `alas: ${c.soldAla === 'cjp' ? 'penetración completa' : `filete ${c.wAla} mm`} · alma: filete ${c.wAlma} mm · ${esc(c.electrodo)}`)}</table>`;
  if(c.tipo === 'aleta') return `<table class="t kv">${t('Cargas', cargasTxt(c))}${t('Viga', `${esc(c.viga)} · ${esc(c.aceroViga)}`)}${t('Soporte', `${{ ala:'Ala de columna', alma:'Alma de columna', viga:'Alma de viga' }[c.soporte]} · t = ${c.tSop} mm · ${esc(c.aceroSop)}`)}
    ${c.destaje && c.destaje !== 'no' ? t('Destaje', `${c.destaje === 'sup' ? 'ala superior' : 'las dos alas'}: dc = ${c.dct}${c.destaje === 'ambos' ? ` / ${c.dcb}` : ''} mm, c = ${c.cDes} mm, perno superior a ${c.LevB} mm del corte`) : ''}
    ${t('Chapa', `${c.tp} mm · ${esc(c.aceroPl)} · a = ${c.a} mm`)}${t('Pernos', `${c.n} × ${dn} ${esc(c.grado)}-${esc(c.rosca)} · s = ${c.s} mm · agujeros ${c.agujeros === 'SSLT' ? 'de ranura corta horizontal' : 'estándar'}`)}${t('Bordes', `Lev = ${c.Lev} · Leh = ${c.Leh} mm`)}${t('Soldadura', `filete ${c.w} mm por ambas caras · ${esc(c.electrodo)}`)}</table>`;
  return `<table class="t kv">${t('Cargas', cargasTxt(c))}${t('Pernos', `${c.filas} × ${c.cols} de ${dn} ${esc(c.grado)}-${esc(c.rosca)}`)}${t('Separaciones', `s = ${c.s} · g = ${c.g} mm`)}${t('Bordes', `Lev = ${c.Lev} · Leh = ${c.Leh} mm`)}
    ${t('Chapa', `${c.tp} mm · ${esc(c.aceroPl)}`)}${t('Soporte', `t = ${c.tSop} mm · ${esc(c.aceroSop)}`)}</table>`;
}


/* Barra lateral (estilo B de Amo, 18-nov; igual al generador de memorias). En un proyecto, en el computador, la lista de
   conexiones y la galería para agregar pasan a la barra lateral; en el celular quedan como antes (lista desplegable). */
G.ConUI = { rigHTML, doublerHTML, CLASE_RIG, NOMBRES, CATS, PREF, recalcular, campo, SEL_DIAM, SEL_ACERO, dnom, SOPN, conFig, svgCorteEsq, figLcr, figContinuidad, opDebil, svgPlantaDebil, figDebil, svgCorteDebil, figCorteDebil, figPlacaApoyo, seccionesDe, abiertas, ejesCon, cargasHTML, cargasTxt, nz, formHTML, GRUPOS, chequeosHTML, reqHTML, resHTML, ICO_ALETA, ICO_GRUPO, cotaV, cotaH, dibujo, ICO_ANG, dibAngular, ICO_TESTA, ICO_TV, ICO_AS, ICO_EMP, ICO_CAR, ICO_BASE, ICO_SP, ICO_EZ, ICO, svgW, dibTestaV, dibAsiento, dibEmpalme, dibCartela, dibBase, dibSoldada, dibEmpZ, dibTesta, dibAleta, dibGrupo, datosPrint };
})(window);
