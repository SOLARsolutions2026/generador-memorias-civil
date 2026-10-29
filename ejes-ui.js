/* ═══ Convención de ejes y cargas (pedido de Amo 29-oct): cuando las cargas se escriben a mano, un dibujo dice qué es x, y, z
   (o los ejes 1-2-3 del elemento) y hacia dónde va cada fuerza y momento. Los momentos van como vector de doble flecha
   (regla de la mano derecha). Solo dibujos SVG, sin datos. */
const EJ = { az:'#1f3a60', gr:'#64748b', f:'#b45309', m:'#7c3aed', fill:'#e8eef7', fill2:'#cbd5e1' };
const ejDefs = id => `<defs>
  <marker id="${id}a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9 z" fill="${EJ.gr}"/></marker>
  <marker id="${id}f" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9 z" fill="${EJ.f}"/></marker>
  <marker id="${id}m" viewBox="0 0 14 10" refX="13" refY="5" markerWidth="10" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L7,5 L0,9 z M6,1 L13,5 L6,9 z" fill="${EJ.m}"/></marker></defs>`;
let _ejN = 0;
const ejId = () => 'ej' + (++_ejN);
const lin = (id, k, x1, y1, x2, y2, w = 1.6) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${k === 'f' ? EJ.f : k === 'm' ? EJ.m : EJ.gr}" stroke-width="${w}" marker-end="url(#${id}${k})"/>`;
const txt = (x, y, t, c = EJ.az, a = 'start', w = 600) => `<text x="${x}" y="${y}" font-size="10.5" font-weight="${w}" fill="${c}" text-anchor="${a}" stroke="#fff" stroke-width="3" paint-order="stroke">${t}</text>`;
// proyección isométrica: x hacia la derecha-abajo, y hacia la izquierda-abajo, z hacia arriba
const iso = (ox, oy, s) => (x, y, z) => [ox + (x - y) * 0.866 * s, oy + (x + y) * 0.5 * s - z * s];
const poly = (P, pts, fill, st = EJ.az) => `<path d="M${pts.map(p => P(...p).map(v => v.toFixed(1)).join(',')).join(' L')} Z" fill="${fill}" stroke="${st}" stroke-width="1.2"/>`;
const caja = (P, x0, y0, z0, dx, dy, dz, f1, f2, f3) => poly(P, [[x0, y0 + dy, z0], [x0 + dx, y0 + dy, z0], [x0 + dx, y0 + dy, z0 + dz], [x0, y0 + dy, z0 + dz]], f2)
  + poly(P, [[x0 + dx, y0, z0], [x0 + dx, y0 + dy, z0], [x0 + dx, y0 + dy, z0 + dz], [x0 + dx, y0, z0 + dz]], f1)
  + poly(P, [[x0, y0, z0 + dz], [x0 + dx, y0, z0 + dz], [x0 + dx, y0 + dy, z0 + dz], [x0, y0 + dy, z0 + dz]], f3);
const fig = (svg, cap) => `<figure class="ejes-fig">${svg}<figcaption>${cap}</figcaption></figure>`;

// Zapata + pedestal: x en la dirección de b (pedestal) y B (zapata); y en la de h y L; z hacia arriba
function ejesCim(){
  const id = ejId(), P = iso(160, 128, 56);
  const z = caja(P, -1.0, -0.75, -0.9, 2.0, 1.5, 0.35, '#d6dde8', '#e5e9f0', '#eef1f5');
  const pd = caja(P, -0.25, -0.25, -0.55, 0.5, 0.5, 0.55, '#c7d2e3', '#dbe3ee', '#e8eef7');
  const o = P(0, 0, 0), ax = P(1.55, 0, 0), ay = P(0, 1.55, 0), az = P(0, 0, 1.15);
  const vx = P(0.95, 0, 0), vy = P(0, 0.95, 0);
  const svg = `<svg viewBox="0 0 330 265" role="img" aria-label="Ejes y sentido de las cargas sobre el pedestal">${ejDefs(id)}${z}${pd}
    ${lin(id, 'a', ...o, ...ax)}${lin(id, 'a', ...o, ...ay)}${lin(id, 'a', ...o, ...az)}
    ${txt(ax[0] + 4, ax[1] + 4, 'x (b, B)', EJ.az)}${txt(ay[0] - 4, ay[1] + 4, 'y (h, L)', EJ.az, 'end')}${txt(az[0] + 5, az[1] + 4, 'z', EJ.az)}
    ${lin(id, 'f', o[0], o[1] - 46, o[0], o[1] - 4, 2.2)}${txt(o[0] + 8, o[1] - 44, 'P (+ compresión)', EJ.f)}
    ${lin(id, 'f', ...P(0.35, 0, 0.12), ...P(0.95, 0, 0.12), 2.2)}${txt(vx[0] + 2, vx[1] - 10, 'Vx', EJ.f)}
    ${lin(id, 'f', ...P(0, 0.35, 0.12), ...P(0, 0.95, 0.12), 2.2)}${txt(vy[0] - 2, vy[1] - 10, 'Vy', EJ.f, 'end')}
    ${lin(id, 'm', ...P(0.25, 0, 0.85), ...P(1.05, 0, 0.85), 2)}${txt(P(1.05, 0, 0.85)[0] + 4, P(1.05, 0, 0.85)[1] - 2, 'Mx', EJ.m)}
    ${lin(id, 'm', ...P(0, 0.25, 0.85), ...P(0, 1.05, 0.85), 2)}${txt(P(0, 1.05, 0.85)[0] - 4, P(0, 1.05, 0.85)[1] - 2, 'My', EJ.m, 'end')}</svg>`;
  return fig(svg, 'Cargas en la cara superior del pedestal. Vx y My actúan en la dirección x (b del pedestal, B de la zapata); Vy y Mx en la dirección y (h, L). Momentos con doble flecha = giran alrededor de ese eje (regla de la mano derecha).');
}
// Elemento metálico: ejes locales 1 (a lo largo), 2 (alma, eje fuerte de flexión con M3/V2) y 3
function ejesMiembro(){
  const id = ejId(), P = iso(55, 112, 62);
  const b = 0.35, h = 0.6, t = 0.07, Lm = 2.6;
  // perfil I extruido en x (eje 1), alma en z (eje 2), alas en y (eje 3)
  const ala = zz => caja(P, 0, -b, zz, Lm, 2 * b, t, '#c7d2e3', '#dbe3ee', '#e8eef7');
  const alma = caja(P, 0, -t / 2, -h / 2 + t, Lm, t, h - 2 * t, '#c7d2e3', '#dbe3ee', '#e8eef7');
  const e0 = P(Lm, 0, 0), e1 = P(Lm + 1.0, 0, 0), e2 = P(Lm, 0, 1.0), e3 = P(Lm, 0.95, 0);
  const svg = `<svg viewBox="0 0 440 275" role="img" aria-label="Ejes locales del elemento">${ejDefs(id)}${ala(-h / 2)}${alma}${ala(h / 2 - t)}
    ${lin(id, 'a', ...e0, ...e1)}${lin(id, 'a', ...e0, ...e2)}${lin(id, 'a', ...e0, ...e3)}
    ${txt(e1[0] + 4, e1[1] + 14, '1 (eje del elemento)')}${txt(e2[0] + 6, e2[1] + 4, '2 (alma)')}${txt(e3[0] - 4, e3[1] + 12, '3', EJ.az, 'end')}
    ${lin(id, 'f', ...P(Lm + 0.1, 0, 0.75), ...P(Lm + 0.1, 0, 0.25), 2.2)}${txt(P(Lm + 0.1, 0, 0.75)[0] + 6, P(Lm + 0.1, 0, 0.75)[1], 'V2', EJ.f)}
    ${lin(id, 'm', ...P(Lm, 0.2, 0), ...P(Lm, 0.8, 0), 2)}${txt(P(Lm, 0.8, 0)[0] - 6, P(Lm, 0.8, 0)[1] - 6, 'M3', EJ.m, 'end')}
    ${lin(id, 'm', ...P(Lm + 0.25, 0, 0), ...P(Lm + 0.8, 0, 0), 2)}${txt(P(Lm + 0.55, 0, 0)[0], P(Lm + 0.55, 0, 0)[1] + 16, 'T, P', EJ.m)}</svg>`;
  return fig(svg, 'Ejes locales: 1 a lo largo del elemento, 2 en la dirección del alma (peralte) y 3 en la de las alas. M3 y V2 = flexión en el eje fuerte (cargas en dirección 2); M2 y V3 = eje débil. P = axial (negativa = compresión), T = torsión alrededor del eje 1. En tubos, 2 va en la dirección de H y 3 en la de B.');
}
// Placa base vista en planta: N en la dirección del peralte d de la columna, B en la de las alas
function ejesPlaca(){
  const id = ejId(), cx = 150, cy = 110, N = 170, B = 120, d = 90, bf = 70, tf = 10, tw = 6;
  const svg = `<svg viewBox="0 0 320 225" role="img" aria-label="Sentidos N y B de la placa base">${ejDefs(id)}
    <rect x="${cx - N / 2}" y="${cy - B / 2}" width="${N}" height="${B}" fill="#eef1f5" stroke="${EJ.az}" stroke-width="1.4"/>
    <path d="M${cx - d / 2},${cy - bf / 2} h${tf} v${bf / 2 - tw / 2} h${d - 2 * tf} v${-(bf / 2 - tw / 2)} h${tf} v${bf} h${-tf} v${-(bf / 2 - tw / 2)} h${-(d - 2 * tf)} v${bf / 2 - tw / 2} h${-tf} Z" fill="#c7d2e3" stroke="${EJ.az}" stroke-width="1.2"/>
    ${lin(id, 'a', cx - N / 2 - 8, cy + B / 2 + 18, cx + N / 2 + 18, cy + B / 2 + 18)}${txt(cx + N / 2 + 22, cy + B / 2 + 22, 'N (peralte d)')}
    ${lin(id, 'a', cx - N / 2 - 20, cy + B / 2 + 8, cx - N / 2 - 20, cy - B / 2 - 14)}${txt(cx - N / 2 - 24, cy - B / 2 - 18, 'B (alas)', EJ.az, 'start')}
    <circle cx="${cx}" cy="${cy}" r="7" fill="#fff" stroke="${EJ.f}" stroke-width="2"/><path d="M${cx - 5},${cy - 5} L${cx + 5},${cy + 5} M${cx + 5},${cy - 5} L${cx - 5},${cy + 5}" stroke="${EJ.f}" stroke-width="2"/>${txt(cx + 10, cy - 10, 'P', EJ.f)}
    ${lin(id, 'f', cx + 12, cy + 30, cx + 62, cy + 30, 2.2)}${txt(cx + 66, cy + 34, 'Vn', EJ.f)}
    ${lin(id, 'f', cx - 30, cy + 22, cx - 30, cy - 28, 2.2)}${txt(cx - 34, cy - 30, 'Vb', EJ.f, 'end')}
    ${lin(id, 'm', cx + 14, cy - 40, cx + 14, cy - 80, 2)}${txt(cx + 20, cy - 70, 'Mn', EJ.m)}
    ${lin(id, 'm', cx - 60, cy - 20, cx - 110, cy - 20, 2)}${txt(cx - 112, cy - 26, 'Mb', EJ.m, 'end')}</svg>`;
  return fig(svg, 'Planta de la placa: N en la dirección del peralte d de la columna, B en la de las alas. P (⊗) entra en la placa = compresión. Mn flexiona la placa en el sentido N (vector a lo largo de B); Mb en el sentido B. Vn y Vb son los cortantes en cada sentido.');
}
// Conexión viga–columna: momento, cortante y axial en el extremo de la viga
function ejesVC(){
  const id = ejId();
  const svg = `<svg viewBox="0 0 320 200" role="img" aria-label="Fuerzas en el extremo de la viga">${ejDefs(id)}
    <rect x="40" y="10" width="34" height="180" fill="#dbe3ee" stroke="${EJ.az}" stroke-width="1.2"/>${txt(57, 200, 'columna', EJ.gr, 'middle', 400)}
    <rect x="74" y="80" width="200" height="40" fill="#e8eef7" stroke="${EJ.az}" stroke-width="1.2"/>${txt(255, 136, 'viga', EJ.gr, 'middle', 400)}
    <path d="M118,62 A34,34 0 1 1 112,140" fill="none" stroke="${EJ.m}" stroke-width="2" marker-end="url(#${id}f)"/>${txt(152, 64, 'M', EJ.m)}
    ${lin(id, 'f', 98, 40, 98, 78, 2.2)}${txt(104, 44, 'V', EJ.f)}
    ${lin(id, 'f', 200, 100, 150, 100, 2.2)}${txt(204, 104, 'P', EJ.f)}</svg>`;
  return fig(svg, 'Fuerzas mayoradas en el extremo de la viga que llega a la columna: M = momento en el eje fuerte de la viga, V = cortante vertical, P = axial de la viga.');
}
// Soldadura: plano del cordón con x, y y N normal al plano
function ejesSold(){
  const id = ejId(), cx = 150, cy = 105;
  const svg = `<svg viewBox="0 0 320 215" role="img" aria-label="Ejes del grupo de soldadura">${ejDefs(id)}
    <rect x="${cx - 70}" y="${cy - 55}" width="140" height="110" fill="none" stroke="#b45309" stroke-width="4" stroke-dasharray="1 0"/>
    ${lin(id, 'a', cx, cy, cx + 105, cy)}${lin(id, 'a', cx, cy, cx, cy - 92)}${txt(cx + 108, cy + 4, 'x')}${txt(cx + 4, cy - 94, 'y')}
    <circle cx="${cx}" cy="${cy}" r="6" fill="#fff" stroke="${EJ.az}" stroke-width="1.6"/><circle cx="${cx}" cy="${cy}" r="1.8" fill="${EJ.az}"/>${txt(cx - 8, cy + 18, 'N (sale del plano)', EJ.az, 'end')}
    ${lin(id, 'f', cx + 30, cy + 40, cx + 30, cy + 2, 2.2)}${txt(cx + 34, cy + 36, 'V', EJ.f)}
    ${lin(id, 'f', cx - 60, cy + 30, cx - 18, cy + 30, 2.2)}${txt(cx - 64, cy + 34, 'H', EJ.f, 'end')}
    <path d="M${cx + 40},${cy - 40} A50,50 0 0 0 ${cx - 40},${cy - 40}" fill="none" stroke="${EJ.m}" stroke-width="2" marker-end="url(#${id}f)"/>${txt(cx, cy - 56, 'T', EJ.m, 'middle')}
    ${lin(id, 'm', cx + 12, cy - 22, cx + 62, cy - 22, 2)}${txt(cx + 66, cy - 18, 'Mx', EJ.m)}
    ${lin(id, 'm', cx - 22, cy - 8, cx - 22, cy - 50, 2)}${txt(cx - 26, cy - 46, 'My', EJ.m, 'end')}</svg>`;
  return fig(svg, 'Plano del cordón: x horizontal, y vertical, N perpendicular al plano (⊙ sale hacia ti). V y H son cortantes en el plano, T es la torsión en el plano; Mx y My flexionan alrededor de x y de y (doble flecha).');
}
// Ejes pequeños para los dibujos de sección en planta (pedestal, etc.)
const ejesMini = (x, y, lx = 'x', ly = 'y', s = 22) => `<g><line x1="${x}" y1="${y}" x2="${x + s}" y2="${y}" stroke="${EJ.gr}" stroke-width="1.3"/><path d="M${x + s},${y} l-5,-3 v6 z" fill="${EJ.gr}"/>
  <line x1="${x}" y1="${y}" x2="${x}" y2="${y - s}" stroke="${EJ.gr}" stroke-width="1.3"/><path d="M${x},${y - s} l-3,5 h6 z" fill="${EJ.gr}"/>
  <text x="${x + s + 3}" y="${y + 3}" font-size="9" fill="${EJ.gr}">${lx}</text><text x="${x - 2}" y="${y - s - 3}" font-size="9" fill="${EJ.gr}" text-anchor="middle">${ly}</text></g>`;
