/* ═══ Memoria general (cuerpo de la memoria, capítulos 1 a 10) — decisiones de Amo 29-oct ═══
   «Automático + editable»: cada capítulo se arma con los datos de la ficha y de los anexos y trae un texto base;
   Amo puede cambiar cualquier texto (✎) o volver al automático (↺). Figuras: por defecto los dibujos de la app;
   en cada una se puede subir una imagen propia (de AutoCAD, del modelo…) que la reemplaza.
   Basado en la memoria de ejemplo de Amo (DOC-MEM-18-08-26, La Brasa). Por licencia no se nombra el programa: swNom().
   En la impresión cada título, tabla y figura lleva una marca invisible (@@H3@@, @@T5@@, @@F2@@) para que el paso 2
   del PDF final sepa en qué página quedó y arme la tabla de contenido y las listas de tablas y figuras. */
'use strict';
let selCap = 1;

function datosM(){
  const an = S.m.anexos = S.m.anexos || {};
  const M = an.M = an.M || {};
  M.txt = M.txt || {}; M.img = M.img || {}; M.dat = M.dat || {};
  return M;
}
const CAPS = [
  [1, 'Generalidades del proyecto'], [2, 'Introducción'], [3, 'Características de la edificación'], [4, 'Ubicación del proyecto'],
  [5, 'Características de los materiales'], [6, 'Avalúo de cargas'], [7, 'Coeficiente de disipación de energía'], [8, 'Combinaciones de carga'],
  [9, 'Análisis y diseño estructural'], [10, 'Anexos'],
];
const NOM_ACERO = { 'A572 Gr 50':'ASTM A572 Grado 50 (Fy = 345 MPa)', 'A36':'ASTM A36 / NTC 1920 (Fy = 250 MPa)', 'A500 Gr B':'ASTM A500 Grado B / NTC 4526 (Fy = 317 MPa)',
  'A500 Gr C':'ASTM A500 Grado C / NTC 4526 (Fy = 345 MPa)', 'A1065':'ASTM A1065 (Fy = 345 MPa)', 'A1085':'ASTM A1085 (Fy = 345 MPa)' };
const uniq = a => [...new Set(a.filter(Boolean))];
const listaY = a => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1];
const mayus = s => String(s || '').toLocaleUpperCase('es');

// ─── Datos de todos los pasos (se calculan una vez por vista) ───
async function ctxMemoria(){
  const m = S.m, an = m.anexos || {}, f = m.ficha || {};
  const A = datosA(), RA = AnexoA.calcular(A);
  const B = an.B || null, sismo = !!B && B.aplica !== false;
  let RB = null; if(sismo){ try{ RB = calcB(); }catch(e){ console.warn(e); } }
  if(sismo && B.munCode && !window.NSR_SISMO) try{ await cargarSismo(); }catch(e){}
  const K = an.K || null; let RK = null; if(K){ try{ RK = Combos.calcular(K, sismo); }catch(e){ console.warn(e); } }
  const D = datosD(), E = datosE();
  let G = null; if(D.met.length) try{ G = await filasModelo(); }catch(e){ console.warn(e); }
  const met = D.met.map(e => ({ e, R:calcMet(e, G) }));
  let RR = null; try{ RR = await reacModelo(); }catch(e){ console.warn(e); }
  const zap = RR ? D.zap.map(z => ({ z, X:calcCim(z, 'zap', D, RR) })) : [], ped = RR ? D.ped.map(p => ({ p, X:calcCim(p, 'ped', D, RR) })) : [];
  let con = []; if(E.con.length){ const cx = await ctxE(); con = E.con.map(c => ({ c, X:calcE(c, D, cx) })); }
  const M = datosM(), urls = {};
  for(const [k, im] of Object.entries(M.img)) if(im?.path) urls[k] = await urlDe(im.path);
  return { m, f, A, RA, B, sismo, RB, K, RK, C:an.C || null, D, met, zap, ped, E, con, M, urls, F:an.F, Gs:an.G };
}

// ─── Constructor del documento (pantalla «ed» o impresión) ───
function memDoc(ctx, ed){
  const M = ctx.M, toc = [], tabs = [], figs = [], caps = {};
  let cap = 0, n2 = 0, n3 = 0, n4 = 0, cur = null, html = '';
  const mk = s => ed ? '' : `<span class="mk">@@${s}@@</span>`;
  const out = h => { html += h; if(cur) caps[cur] += h; };
  const H = (niv, t) => {
    let num;
    if(niv === 1){ cap++; n2 = n3 = n4 = 0; num = `${cap}.`; cur = cap; caps[cap] = ''; }
    else if(niv === 2){ n2++; n3 = n4 = 0; num = `${cap}.${n2}.`; }
    else if(niv === 3){ n3++; n4 = 0; num = `${cap}.${n2}.${n3}.`; }
    else { n4++; num = `${cap}.${n2}.${n3}.${n4}.`; }
    const id = toc.length; toc.push({ id, n:num, t:mayus(t), niv });
    out(`<h${niv + 1} class="m-h${niv}">${mk('H' + id)}${num} ${esc(mayus(t))}</h${niv + 1}>`);
  };
  // Texto editable: párrafos separados por línea en blanco; líneas con «• » o «- » = viñetas
  const parr = t => String(t || '').trim().split(/\n\s*\n/).map(b => {
    const ls = b.split('\n').map(x => x.trim()).filter(Boolean);
    if(ls.length && ls.every(l => /^[•\-]\s+/.test(l))) return `<ul class="m-ul">${ls.map(l => `<li>${esc(l.replace(/^[•\-]\s+/, ''))}</li>`).join('')}</ul>`;
    return `<p>${esc(ls.join(' '))}</p>`;
  }).join('');
  const T = (key, def) => {
    const custom = M.txt[key] != null && M.txt[key] !== '', t = custom ? M.txt[key] : def;
    if(!ed) return out(parr(t));
    out(`<div class="m-ed ${custom ? 'mod' : ''}" data-mk="${key}"><div class="m-ed-t">${parr(t) || '<p class="hint">(vacío)</p>'}</div>
      <div class="m-ed-b"><button class="btn sm" type="button" data-mked="${key}" title="Cambiar el texto">✎ Editar</button>${custom ? `<button class="btn sm" type="button" data-mkre="${key}" title="Volver al texto automático">↺ Automático</button>` : ''}</div>
      <template>${esc(t)}</template></div>`);
  };
  const tabla = (cab, filas, cap_, cls='') => {
    const n = tabs.length + 1; tabs.push({ n, t:cap_ });
    out(`<table class="ax-tb m-tb ${cls}">${cab ? `<thead><tr>${cab.map(c => `<th>${c}</th>`).join('')}</tr></thead>` : ''}<tbody>${filas.map(r => `<tr>${r.map((c, i) => `<td class="${i ? 'c' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>
      <div class="m-cap">${mk('T' + (n - 1))}Tabla ${n}. ${esc(cap_)}</div>`);
  };
  // Figura: imagen subida por Amo o dibujo de la app (def); en pantalla, botón para subir o quitar
  const fig = (key, cap_, def) => {
    const im = M.img[key], u = ctx.urls[key], cuerpo = u ? `<img src="${esc(u)}" alt="${esc(cap_)}"/>` : def;
    if(!cuerpo && !ed) return;
    const n = figs.length + 1; if(cuerpo) figs.push({ n, t:im?.nota || cap_ });
    out(`<figure class="m-fig">${cuerpo || '<div class="m-fig-v">Sin imagen</div>'}${cuerpo ? `<figcaption>${mk('F' + (n - 1))}Figura ${n}. ${esc(im?.nota || cap_)}</figcaption>` : ''}
      ${ed ? `<div class="m-fig-b"><button class="btn sm" type="button" data-mimg="${key}">📎 ${u ? 'Cambiar imagen' : def ? 'Usar mi imagen en vez del dibujo' : 'Subir imagen'}</button>${u ? `<button class="btn sm danger" type="button" data-mimgx="${key}">Quitar imagen${def ? ' (volver al dibujo)' : ''}</button><input class="m-fig-n" data-mimgn="${key}" value="${esc(im?.nota || '')}" placeholder="Pie de figura: ${esc(cap_)}"/>` : ''}</div>` : ''}</figure>`);
  };
  const ver = L => out(`<p class="m-ver">El detalle del cálculo se encuentra en el <b>ANEXO ${L}</b>.</p>`);
  const f = ctx.f, A = ctx.A, RA = ctx.RA, v = A.viento || {}, RB = ctx.RB, K = ctx.K, RK = ctx.RK, Rk = RK?.R;
  const proy = f.proyecto || ctx.m.titulo || 'el proyecto', mun = f.mun || '', dep = f.depto || '';
  const area = RB?.area || (num0(v.L) * num0(v.W)) || 0;
  const dat = M.dat, zona = dat.zona || 'urbana';
  const perfDe = re => uniq(ctx.D.met.filter(e => re.test(e.desc || '')).map(e => nomSec(e)));
  const cols = perfDe(/col/i), vigas = perfDe(/viga/i), diag = perfDe(/diag/i);
  const sisN = Rk?.sis?.n || 'Pórticos de acero estructural resistentes a momento con capacidad de disipación de energía moderada (DMO)';

  // ══ 1. Generalidades ══
  H(1, 'Generalidades del proyecto');
  H(2, `Proyecto: ${proy}`);
  T('gen.proy', [`• Uso proyectado: ${dat.uso || f.uso || 'Cubierta para soporte de paneles solares'}.`, `• Ubicación: zona ${zona} de ${[mun, dep].filter(Boolean).join(', ') || '(municipio)'}, Colombia.`,
    `• Número de pisos: ${dat.nPisos || 1}.`, area ? `• Área en planta: ${fx(area, 2)} m².` : '', `• Sistema estructural: aporticado en acero.`].filter(Boolean).join('\n'));
  H(2, 'Normas de diseño');
  T('gen.normas', ['• Reglamento Colombiano de Construcción Sismo Resistente NSR-10 (Decreto 926 del 19 de marzo de 2010) y sus modificaciones.',
    '• ANSI/AISC 360-10, Specification for Structural Steel Buildings (incorporada en el Título F de la NSR-10).',
    '• ANSI/AISC 341-10, Seismic Provisions for Structural Steel Buildings.',
    '• ACI 318 (incorporado en el Título C de la NSR-10) para los elementos de concreto y los anclajes.'].join('\n'));
  H(2, 'Sistema estructural');
  T('gen.sis', `• ${sisN}${Rk?.R0 ? `, R0 = ${fx(Rk.R0, 1)} (Tabla A.3-3)` : ''}.`);
  H(2, 'Materiales');
  T('gen.mat', ['• Materiales cementantes: NTC 121, NTC 321, ASTM C150.', '• Agregados de peso normal: NTC 174 (ASTM C33).', '• Agua: NTC 3459 (ASTM C1602).',
    ...uniq(ctx.D.met.map(e => e.acero)).map(a => `• Perfiles de acero estructural: ${NOM_ACERO[a] || a}.`),
    ctx.ped.length || ctx.zap.length ? '• Acero de refuerzo corrugado Ø3/8" y mayores: fy = 420 MPa (4 200 kg/cm²), NTC 2289.' : '',
    '• Platinas: NTC 1920 (ASTM A36/A36M).', '• Pernos, tuercas y arandelas de uso estructural: ASTM A325, ASTM F563, ASTM F436.', '• Soldadura: electrodos E70XX (y E60XX donde se indique).'].filter(Boolean).join('\n'));

  // ══ 2. Introducción ══
  H(1, 'Introducción');
  T('intro', [`En el presente documento se desarrollan las memorias de diseño y cálculo estructural de la estructura metálica ${dat.uso ? 'para ' + dat.uso.toLowerCase() : 'para soporte de paneles solares'} del proyecto ${proy}${f.dir ? `, ubicado en ${f.dir}` : ''}${mun ? ` (${mun}${dep ? ', ' + dep : ''})` : ''}. ${area ? `La estructura tiene un área en planta de ${fx(area, 2)} m².` : ''}`,
    `El sistema estructural está conformado por elementos de acero estructural${cols.length ? `: las columnas son perfiles ${listaY(cols)}` : ''}${vigas.length ? `${cols.length ? ',' : ':'} las vigas son perfiles ${listaY(vigas)}` : ''}${diag.length ? ` y los arriostramientos son perfiles ${listaY(diag)}` : ''}.`,
    'El objeto del presente estudio es analizar y verificar el comportamiento estructural de la estructura metálica proyectada, determinando la capacidad de los elementos que conforman el sistema resistente frente a las cargas y combinaciones de diseño, y verificando las condiciones de resistencia, estabilidad y servicio durante su vida útil.',
    'El análisis y el diseño se desarrollan de acuerdo con el Reglamento Colombiano de Construcción Sismo Resistente NSR-10. La memoria contiene los criterios para determinar las cargas de diseño, el modelo y el análisis estructural, las combinaciones de carga y las verificaciones de los elementos, cuyo detalle se presenta en los anexos.'].join('\n\n'));

  // ══ 3. Características ══
  H(1, 'Características de la edificación');
  H(2, 'Descripción en planta');
  T('plan', `Para el análisis y diseño de la estructura, el área en planta se organizó en ejes horizontales y verticales:\n\n• Ejes literales: ${dat.ejesL || 'A – C'}.\n• Ejes numerales: ${dat.ejesN || '1 – 5'}.`);
  fig('planta', 'Planta y geometría de la estructura', typeof svgGeo === 'function' && (num0(v.L) > 0) ? svgGeo(A, true) : '');

  // ══ 4. Ubicación ══
  H(1, 'Ubicación del proyecto');
  T('ubic', `El proyecto se localiza en zona ${zona} del municipio de ${mun || '(municipio)'}${dep ? ', departamento del ' + dep : ''}, Colombia${f.dir ? `, en la dirección ${f.dir}` : ''}.${f.coord ? `\n\nCoordenadas del proyecto: ${f.coord}.` : ''}`);
  fig('ubic', 'Microlocalización del proyecto', '');

  // ══ 5. Materiales ══
  H(1, 'Características de los materiales');
  const fcs = uniq([...ctx.zap.map(x => x.z.fc), ...ctx.ped.map(x => x.p.fc)].map(String)), fys = uniq([...ctx.zap.map(x => x.z.fy), ...ctx.ped.map(x => x.p.fy)].map(String));
  if(fcs.length){ H(2, 'Concretos');
    T('mat.conc', [ctx.zap.length ? `• Zapatas: f'c = ${listaY(fcs)} MPa.` : '', ctx.ped.length ? `• Pedestales: f'c = ${listaY(uniq(ctx.ped.map(x => String(x.p.fc))))} MPa.` : ''].filter(Boolean).join('\n'));
    H(2, 'Acero de refuerzo');
    T('mat.ref', `• Acero corrugado Ø3/8" y mayores: fy = ${listaY(fys.length ? fys : ['420'])} MPa, NTC 2289.`); }
  H(2, 'Perfiles y platinas de acero');
  T('mat.acero', [...uniq(ctx.D.met.map(e => e.acero)).map(a => `• Perfiles: ${NOM_ACERO[a] || a}.`), '• Platinas: ASTM A36, NTC 1920 (Fy = 250 MPa).'].join('\n'));

  // ══ 6. Avalúo de cargas ══
  H(1, 'Avalúo de cargas');
  H(2, 'Cargas muertas');
  T('cm', 'Para determinar las cargas muertas se consideran todos los elementos permanentes del sistema: el peso propio de los elementos estructurales, los módulos fotovoltaicos con sus rieles, anclajes y accesorios, y los demás elementos fijos que se apoyan en la estructura. El peso propio de los perfiles lo calcula el programa de análisis a partir de la densidad del material; los pesos de los paneles y sus componentes se toman de las fichas técnicas de los fabricantes.');
  const P = RA.paneles, Lm = RA.lamina, r3 = x => fx(x, 3);
  if(P){
    tabla(['Ítem', 'Unidad', 'Peso', 'Fuente'], [[esc(`Panel solar ${A.panel?.nombre || ''}`), 'kg/m²', fx(P.wPanel, 2), 'Ficha técnica (Anexo A-1)'], [esc(`Riel ${A.riel?.nombre || ''}`), 'kg/m', fx(num0(A.riel?.peso), 3), 'Ficha técnica (Anexo A-1)'],
      ...P.ext.map(x => [esc(x.n), 'kg/m²', fx(x.w, 2), 'NSR-10 / diseñador'])], 'Cargas muertas utilizadas en el diseño, según fabricantes y NSR-10');
    tabla(['Ítem', 'Ancho aferente [m]', 'Carga [kN/m]'], [['Paneles solares', fx(P.trib, 3), r3(P.Dpanel)], ['Riel', '—', r3(P.Driel)], ...(P.Dext ? [['Cargas adicionales', fx(P.trib, 3), r3(P.Dext)]] : []), ['<b>Total sobre el riel</b>', '', `<b>${r3(P.D)}</b>`]], 'Cargas muertas aplicadas sobre los rieles de los paneles');
  }
  if(Lm) tabla(['Ítem', 'Peso [kg/m²]'], [...Lm.items.map(x => [esc(x.n), fx(x.w, 2)]), ['<b>Total</b>', `<b>${fx(Lm.wTot, 2)}</b>`], [`Carga sobre la correa (separación ${fx(Lm.s, 2)} m)`, `${r3(Lm.D)} kN/m`]], 'Cargas muertas de la cubierta aplicadas sobre las correas');
  ver('A');
  if(RB){ H(3, 'Carga muerta total (peso sísmico)');
    tabla(['Componente', 'W [kN]'], [['Cargas por área del Anexo A', fx(RB.Wcargas, 2)], ['Peso propio de la estructura', fx(RB.Wprop, 2)], ...(RB.Wotras ? [['Otras cargas permanentes', fx(RB.Wotras, 2)]] : []), ['<b>Peso total W</b>', `<b>${fx(RB.W, 2)} kN (${fx(RB.W * 1000 / 9.81, 0)} kg)</b>`]], 'Carga muerta total para el cálculo de la fuerza horizontal equivalente'); }
  H(2, 'Carga viva');
  T('cv', `Las cargas vivas se determinan según el Capítulo B.4 de la NSR-10, de acuerdo con las condiciones de uso y mantenimiento de la cubierta. ${P ? `Sobre los módulos fotovoltaicos se considera una carga de mantenimiento de ${fx(num0(A.qMant), 0)} kgf/m², que corresponde a los equipos y elementos usados en la limpieza y revisión del sistema. Los módulos no están destinados al tránsito peatonal; el mantenimiento se realiza desde las zonas de circulación previstas.` : ''}${Lm ? ` Sobre la cubierta se adopta una carga viva de ${fx(Lm.Lr, 0)} kgf/m² (Tabla B.4.2.1-2).` : ''} Las cargas lineales sobre los elementos se obtienen con su ancho aferente.`);
  const filasCV = [...(P ? [['Mantenimiento sobre los paneles (riel)', `${fx(num0(A.qMant), 0)} kgf/m² × ${fx(P.trib, 3)} m`, r3(P.L)]] : []), ...(Lm ? [['Viva de cubierta (correa)', `${fx(Lm.Lr, 0)} kgf/m² × ${fx(Lm.s, 2)} m`, r3(Lm.L)]] : [])];
  if(filasCV.length) tabla(['Ítem', 'Carga y ancho aferente', 'Carga [kN/m]'], filasCV, 'Cargas vivas aplicadas sobre los elementos');
  ver('A');
  const W = RA.viento;
  H(2, 'Cargas de viento');
  T('cvi', 'Las presiones de viento se determinan con el procedimiento analítico del Capítulo B.6 de la NSR-10 para cubiertas libres, considerando la ubicación, la exposición y la geometría de la estructura. Se analizan el sistema principal de resistencia de fuerzas de viento (SPRFV) y los componentes y revestimientos, con efectos de presión y succión.');
  if(W?.ok){
    H(3, 'Parámetros de diseño');
    tabla(['Parámetro', 'Símbolo', 'Valor', 'Referencia'], [['Ubicación', '—', esc([mun, dep].filter(Boolean).join(', ') || '—'), ''], ['Velocidad básica del viento', 'V', `${fx(W.V, 0)} m/s (${fx(W.V * 3.6, 0)} km/h)`, 'Figura B.6.4-1'],
      ['Grupo de uso / factor de importancia', 'I', `${esc(W.grupo)} · ${fx(W.I, 2)}`, 'Tabla B.6.5-1'], ['Exposición', '—', esc(String(W.ex.usada)), 'B.6.5.6.3'], ['Factor topográfico', 'Kzt', fx(W.Kzt, 2), 'B.6.5.7'],
      ['Coeficiente de exposición', 'Kz', fx(W.Kz2, 3), 'B.6.5.6.6'], ['Factor de dirección', 'Kd', fx(W.Kd, 2), 'Tabla B.6.5-4'], ['Presión por velocidad', 'qh', `${fx(W.qh2, 1)} N/m²`, 'Ec. B.6.5-13'],
      ['Factor de ráfaga', 'G', fx(W.G, 2), 'B.6.5.8'], ['Pendiente de la cubierta', 'θ', `${fx(W.theta, 1)}°`, ''], ['Presión mínima de diseño', 'pmín', '0.40 kN/m²', 'B.6.1.3']], 'Parámetros para el cálculo de las cargas de viento');
    H(3, 'Sistema principal (SPRFV)');
    tabla(['Caso', 'γ', 'CNW', 'CNL', 'pW [kN/m²]', 'pL [kN/m²]'], W.sp.map(x => [x.caso, `${x.gam}°`, fx(x.CNW, 2), fx(x.CNL, 2), fx(x.pW, 3), fx(x.pL, 3)]), 'Coeficientes y presiones netas sobre la cubierta (Figura B.6.5-18A)');
    H(3, 'Cargas de diseño sobre los elementos');
    tabla(['Elemento', 'Presión [kN/m²]', 'Succión [kN/m²]', 'Ancho aferente [m]', 'Presión [kN/m]', 'Succión [kN/m]'], W.porElem.map(x => [esc(x.nombre), fx(x.dPres, 3), fx(x.dSucc, 3), fx(x.trib, 3), fx(x.Wp, 3), fx(x.Ws, 3)]), 'Cargas de viento de diseño (no menores que 0.40 kN/m²)');
    T('cvi.min', 'Las presiones obtenidas se comparan con la presión mínima de diseño de 0.40 kN/m² (NSR-10 B.6.1.3); se usa la mayor.');
  }
  ver('A');
  H(2, 'Cargas horizontales');
  H(3, 'Evaluación de la carga sísmica');
  if(!ctx.sismo){ T('sis.no', ctx.B?.texto || TXT_SIN_SISMO); }
  else if(RB?.ok){
    const p = RB.p, mm = window.NSR_SISMO && ctx.B.munCode ? NSR_SISMO.mun.find(x => x.c === ctx.B.munCode) : null;
    H(4, 'Parámetros sísmicos');
    T('sis.par', `Los coeficientes de aceleración Aa y Av se toman del Apéndice A-4 de la NSR-10 para ${mm ? mm.n : (mun || 'el municipio del proyecto')}. Con el perfil de suelo tipo ${ctx.B.suelo || 'D'} se obtienen los coeficientes de amplificación Fa y Fv de las Tablas A.2.4-3 y A.2.4-4, interpolando linealmente cuando es necesario.`);
    tabla(['Municipio', 'Aa', 'Av', 'Zona de amenaza', 'Suelo', 'Fa', 'Fv', 'I'], [[esc(mm?.n || mun || '—'), fx(p.Aa, 2), fx(p.Av, 2), esc(mm?.z || '—'), esc(ctx.B.suelo || 'D'), fx(p.Fa, 2), fx(p.Fv, 2), fx(p.I, 2)]], `Parámetros sísmicos para ${mm?.n || mun || 'el proyecto'}`);
    if(typeof svgMapaSismo === 'function' && window.NSR_SISMO) fig('mapaAa', 'Mapa de valores de Aa por municipio (Figura A.2.3-2)', svgMapaSismo({ ...ctx.B, mapa:'aa' }, true));
    H(4, 'Espectro de diseño');
    fig('espectro', 'Espectro elástico de aceleraciones de diseño (Figura A.2.6-1)', svgEspectro(RB, true));
    tabla(['To [s]', 'Tc [s]', 'TL [s]', 'Ct', 'α', 'h [m]', 'Ta [s]', 'Cu', 'Cu·Ta [s]'], [[fx(p.To, 3), fx(p.Tc, 3), fx(p.TL, 2), fx(RB.sis.Ct, 3), fx(RB.sis.a, 2), fx(RB.h, 2), fx(RB.Ta, 3), fx(RB.Cu, 3), fx(RB.CuTa, 3)]], 'Periodos del espectro y periodo aproximado de la estructura');
    ver('B');
    H(4, 'Fuerza horizontal equivalente');
    tabla(['Dirección', 'T [s]', 'Sa [g]', 'W [kN]', 'k', 'Vs [kN]'], [['X', fx(RB.tx.T, 3), fx(RB.tx.Sa, 4), fx(RB.W, 2), fx(RB.tx.k, 2), fx(RB.tx.Vs, 2)], ['Y', fx(RB.ty.T, 3), fx(RB.ty.Sa, 4), fx(RB.W, 2), fx(RB.ty.k, 2), fx(RB.ty.Vs, 2)]], 'Cálculo de la fuerza horizontal equivalente (Ec. A.4.3-1, Vs = Sa·W)');
    H(4, 'Torsión accidental');
    T('sis.tor', 'Se incluyen los efectos de torsión accidental producidos por la incertidumbre en la posición de la masa: el momento torsional se obtiene con una excentricidad del 5 % de la dimensión de la estructura perpendicular a la dirección de la fuerza (A.3.6.7.1).');
    tabla(['Dirección de la fuerza', 'Vs [kN]', 'Excentricidad', 'Dimensión perpendicular [m]', 'Mt [kN·m]'], [['X', fx(RB.tx.Vs, 2), fx(RB.e, 2), fx(RB.dimY, 2), fx(RB.MtX, 3)], ['Y', fx(RB.ty.Vs, 2), fx(RB.e, 2), fx(RB.dimX, 2), fx(RB.MtY, 3)]], 'Momentos de torsión accidental');
    ver('B');
  } else T('sis.falta', 'Faltan los datos del análisis sísmico (Anexo B).');
  if(K?.impacto){ H(3, 'Cargas de impacto');
    T('imp', `Las columnas se ubican en zonas de tránsito y maniobra de vehículos, por lo que se considera una acción horizontal accidental por impacto vehicular: una carga concentrada de ${dat.impF || 30} kN aplicada a ${dat.impH || 0.5} m sobre el nivel del piso, en las dos direcciones principales (NSR-10 B.4.2.2). Esta condición se combina de manera independiente (1.2D + 1.0IMP + 1.0Lr) y se verifica en las columnas, la placa base, los anclajes y la cimentación.`); }

  // ══ 7. Disipación de energía ══
  H(1, 'Coeficiente de disipación de energía');
  if(!ctx.sismo || !Rk) T('r.no', 'El alcance no incluye la evaluación sísmica; no se calcula el coeficiente de disipación de energía.');
  else {
    T('r.txt', `El sistema estructural es de ${sisN.charAt(0).toLowerCase() + sisN.slice(1)}; el coeficiente básico de disipación de energía es R0 = ${fx(Rk.R0, 1)} (Tabla A.3-3).`);
    H(2, 'Irregularidades de la estructura');
    H(3, 'Redundancia');
    tabla(['Irregularidad', 'Sí / No', 'φr'], [['Ausencia de redundancia', K.redundante === false ? 'SÍ' : 'NO', fx(Rk.phiR, 2)]], 'Irregularidad por redundancia (A.3.3.8)');
    if(K.redCalc) T('r.red', K.redCalc);
    if(K.redImg) fig('red', 'Revisión de la redundancia de la estructura', ctx.urlsRed ? `<img src="${esc(ctx.urlsRed)}" alt=""/>` : '');
    H(3, 'Irregularidades en planta');
    tabla(['', 'Irregularidad', 'Sí / No', 'φp'], Combos.IRR_P.map(i => [i.k, esc(i.n), K.irrP?.[i.k] ? 'SÍ' : 'NO', K.irrP?.[i.k] ? fx(i.phi, 2) : '—']).concat([['', '<b>φp</b>', '', `<b>${fx(Rk.phiP, 2)}</b>`]]), 'Irregularidades en planta (Tabla A.3-6)');
    H(3, 'Irregularidades en altura');
    tabla(['', 'Irregularidad', 'Sí / No', 'φa'], Combos.IRR_A.map(i => [i.k, esc(i.n), K.irrA?.[i.k] ? 'SÍ' : 'NO', K.irrA?.[i.k] ? fx(i.phi, 2) : '—']).concat([['', '<b>φa</b>', '', `<b>${fx(Rk.phiA, 2)}</b>`]]), 'Irregularidades en altura (Tabla A.3-7)');
    H(3, 'Coeficiente de disipación de energía R');
    out(`<p class="m-eq">R = φa · φp · φr · R0 = ${fx(Rk.phiA, 2)} × ${fx(Rk.phiP, 2)} × ${fx(Rk.phiR, 2)} × ${fx(Rk.R0, 1)} = <b>${fx(Rk.R, 2)}</b> &nbsp;(Ec. A.3.3-1)</p>`);
  }

  // ══ 8. Combinaciones ══
  H(1, 'Combinaciones de carga');
  if(RK){
    const act = RK.activas.filter(c => ['Resistencia', 'Impacto', 'Otras'].includes(c.grupo));
    T('comb', 'Las combinaciones de carga para el diseño por resistencia se toman de B.2.4.2 de la NSR-10. La carga viva de la cubierta se representa con Lr.');
    tabla(['Nombre', 'Combinación', 'Referencia'], act.map(c => [esc(c.id), esc(c.txt), esc(c.ref)]), 'Combinaciones de carga para el diseño por resistencia');
    out(`<p class="m-eq">D = carga muerta · Lr = carga viva de cubierta · W = viento${ctx.sismo && Rk?.R ? ` · E = fuerzas sísmicas reducidas de diseño, E = Fs/R = ${fx(1 / Rk.R, 3)}·Fs` : ''}${K?.impacto ? ' · IMP = impacto vehicular' : ''}</p>`);
  } else T('comb.no', 'Las combinaciones se definen en el paso «Combinaciones».');

  // ══ 9. Análisis y diseño ══
  H(1, 'Análisis y diseño estructural');
  T('an', `La estructura se modela y analiza tridimensionalmente con ${swNom()}. Se definen la geometría, las secciones y los materiales; el programa calcula la matriz de rigidez considerando las deformaciones axiales y de cortante, y obtiene los desplazamientos, las fuerzas internas y las reacciones. Con los desplazamientos producidos por las fuerzas sísmicas sin reducir se verifican las derivas; luego se diseñan los elementos por el método de resistencia de la NSR-10, con las combinaciones del capítulo 8. La información del modelo (materiales, secciones, nudos, elementos y cargas) se presenta en el ANEXO C.`);
  const tor = K?.tor?.res?.ok ? K.tor.res : null, der = ctx.C?.der?.res?.ok ? ctx.C.der.res : null;
  if(ctx.sismo){
    H(2, 'Chequeo de derivas');
    T('der', 'Las derivas se revisan con los desplazamientos de la envolvente de las fuerzas sísmicas sin reducir (A.6). Para una estructura de un nivel la deriva es el desplazamiento horizontal total Δ = √(U1² + U2²) dividido por la altura, y debe ser menor o igual al 1 % de la altura (Tabla A.6.4-1).');
    if(der){
      const filas = ['X', 'Y'].flatMap(d => der[d].n.map(x => [d, esc(der[d].caso), esc(x.j), fx(x.U1 * 1000, 2), fx(x.U2 * 1000, 2), fx(x.D * 1000, 2), fx(der.h, 2), fx(x.der * 100, 3) + ' %', x.der <= 0.01 ? 'Cumple' : '<b>No cumple</b>']));
      tabla(['Sentido', 'Caso', 'Nudo', 'U1 [mm]', 'U2 [mm]', 'Δ [mm]', 'h [m]', 'Deriva', '≤ 1 %'], filas, 'Chequeo de derivas con las fuerzas sísmicas sin reducir');
      out(`<p>La deriva máxima es ${fx(der.max * 100, 3)} % de la altura: ${der.cumple ? 'cumple' : 'NO cumple'} con el límite de 1.0 %. El detalle está en el ANEXO C.</p>`);
    }
    fig('der', 'Puntos de la estructura usados para el análisis de derivas', '');
    H(2, 'Revisión de irregularidad torsional');
    if(tor){
      tabla(['Sentido', 'Δ1 [mm]', 'Δ2 [mm]', 'Promedio [mm]', '1.2·prom', '1.4·prom', 'Resultado'], ['X', 'Y'].map(d => { const t = tor[d].t; return [d, fx(t.D1 * 1000, 2), fx(t.D2 * 1000, 2), fx(t.prom * 1000, 2), fx(t.l12 * 1000, 2), fx(t.l14 * 1000, 2), t.tipo ? `Irregularidad ${t.tipo}` : 'Sin irregularidad']; }), 'Verificación de irregularidad torsional, sismo en X y en Y (Tabla A.3-6)');
      out(`<p>Por lo tanto, ${K.irrP?.['1bP'] ? 'hay irregularidad torsional extrema 1bP, φp = 0.8' : K.irrP?.['1aP'] ? 'hay irregularidad torsional 1aP, φp = 0.9' : 'no hay irregularidad torsional (1aP), φp = 1.0'}.</p>`);
    } else T('tor.no', 'La irregularidad torsional se revisa comparando el desplazamiento máximo con el promedio de los extremos (Tabla A.3-6).');
  }
  H(2, 'Diseño de elementos estructurales');
  if(ctx.met.length){ H(3, 'Diseño de elementos metálicos');
    for(const { e, R } of ctx.met){
      if(!R?.ok) continue;
      H(4, `${e.nom} — ${nomSec(e)}${e.desc ? ' (' + e.desc + ')' : ''}`);
      T('met.' + e.id, `El perfil ${e.nom} (${nomSec(e)}, acero ${e.acero}) ${/col/i.test(e.desc || '') ? 'corresponde a las columnas, que reciben las cargas de las vigas y las transmiten a la cimentación' : /viga/i.test(e.desc || '') ? 'corresponde a las vigas, que reciben las cargas de las correas y de la cubierta y las llevan a las columnas' : /diag/i.test(e.desc || '') ? 'corresponde a los elementos de arriostramiento, que controlan las deformaciones laterales' : 'hace parte del sistema estructural'}. Con la combinación que controla, la relación demanda / capacidad máxima es ${fx(R.ratio, 3)}: el elemento ${R.cumple ? 'cumple' : 'NO cumple'} con las solicitaciones.`);
      fig('met.' + e.id, `Elemento ${e.nom}: combinación con mayor solicitación`, '');
      tabla(['Chequeo', 'Demanda', 'Capacidad φRn', 'Relación', 'Verificación'], Object.entries(CHK).filter(([k]) => R.checks[k]).map(([k, [n, ref, u, cap, dem]]) => { const ch = R.checks[k], fl = ch.f;
        return [`${n} (${k === 'int' ? fl.ec : ref})`, k === 'int' ? `${fx(fl.pr, 3)} / ${fx(fl.mm, 3)}` : `${fx(dem(fl), 2)} ${u}`, k === 'int' ? '≤ 1.00' : `${fx(cap(R), 2)} ${u}`, fx(ch.r, 3), ch.r <= 1 ? 'Cumple' : '<b>No cumple</b>']; }), `Resumen de diseño del elemento ${e.nom}, sección ${nomSec(e)}`);
      ver('D');
    } }
  if(ctx.ped.length || ctx.zap.length){ H(3, 'Diseño de elementos de concreto');
    for(const { p, X } of ctx.ped){ if(!X?.ok) continue;
      H(4, `Pedestal ${p.nom} — ${p.b} × ${p.h} mm`);
      T('ped.' + p.id, `El pedestal ${p.nom} de ${p.b} × ${p.h} mm lleva ${armadoTxt(p)} como refuerzo longitudinal (cuantía ${fx(X.rho * 100, 2)} %) y estribos Ø${p.est} cada ${p.sConf} mm en la zona confinada (longitud ${fx(X.Lo, 0)} mm) y cada ${p.sFuera} mm fuera de ella. La relación demanda / capacidad máxima es ${fx(X.ratio, 3)}: ${X.cumple ? 'cumple' : 'NO cumple'}.`);
      fig('ped.' + p.id, `Sección del pedestal ${p.nom}: refuerzo`, svgPedestal(X));
      ver('D'); }
    for(const { z, X } of ctx.zap){ if(!X?.ok) continue;
      H(4, `Zapata ${z.nom} — ${fx(X.B / 1000, 2)} × ${fx(X.L / 1000, 2)} × ${fx(X.h / 1000, 2)} m`);
      T('zap.' + z.id, `La zapata ${z.nom} (${z.pos}) de ${fx(X.B / 1000, 2)} × ${fx(X.L / 1000, 2)} m y ${fx(X.h / 1000, 2)} m de espesor requiere ${X.fx.n} barras Ø ${fx(X.fx.db, 1)} mm cada ${fx(X.fx.s, 0)} mm en dirección x y ${X.fy.n} barras Ø ${fx(X.fy.db, 1)} mm cada ${fx(X.fy.s, 0)} mm en dirección y. La relación demanda / capacidad máxima es ${fx(X.ratio, 3)}: ${X.cumple ? 'cumple' : 'NO cumple'}.`);
      fig('zap.' + z.id, `Refuerzo de la zapata ${z.nom}`, '');
      ver('D'); } }
  if(ctx.con.length){ H(3, 'Diseño de conexiones');
    for(const { c, X } of ctx.con){ if(!X?.ok) continue;
      const I = entradaE(c, ctx.D), fl = fallasE(X), dsc = descCon(c, ctx.D, I);
      H(4, `${c.nom} — ${etiquetaE(c, ctx.D)}`);
      T('con.' + c.id, `${dsc} La relación demanda / capacidad máxima es ${fx(X.ratio, 3)}: ${X.cumple ? 'cumple' : 'NO cumple'}.`);
      const e = metDe(ctx.D, c.de), s = e ? secDe(e) : null;
      fig('con.' + c.id, `Detalle de la conexión ${c.nom}`, c.tipo === 'placa' ? `<div class="m-2f">${svgPlacaPlanta(I, X, false, fl)}${svgPlacaAlzado(I, X, false, fl)}</div>` : c.tipo === 'vc' ? svgVC(I, X, false, fl) : svgSoldX({ ...I, _sec:s }, X, false, fl.falla));
      ver('E'); } }

  // ══ 10. Anexos ══
  out(`<div class="m-anx">`); H(1, 'Anexos'); out(`</div>`);
  return { html, toc, tabs, figs, caps };
}
// Descripción automática de cada conexión (como en la memoria de Amo)
function descCon(c, D, I){
  const de = nomEl(D, c.de, c), a = nomEl(D, c.a, c);
  if(c.tipo === 'placa') return `Esta conexión comprende la unión del perfil ${de} a la placa base ${c.plN || 'PL'} de ${fx(+c.N, 0)} × ${fx(+c.B, 0)} × ${fx(+c.tp, 2)} mm, soldada perimetralmente con cordón de ${fx(+c.w, 0)} mm, y su anclaje al pedestal ${a} con ${2 * Math.round(+c.nB)} pernos de ${c.perno} (${c.anclaje}) embebidos ${fx(+c.hef, 0)} mm.`;
  if(c.tipo === 'vc') return `Esta conexión comprende la unión pernada a momento de la viga ${de} a la columna ${a}: cubrejuntas de ${fx(+c.pl.L, 0)} × ${fx(+c.pl.b, 0)} × ${fx(+c.pl.t, 2)} mm conectadas a las aletas de la viga con ${Math.round(+c.pc.nf) * Math.round(+c.pc.nc)} pernos de ${c.pc.d} por aleta, y cartela de ${fx(+c.ct.h, 0)} × ${fx(+c.ct.t, 2)} mm conectada al alma con ${Math.round(+c.ct.n)} pernos de ${c.ct.d}; las platinas se sueldan a la columna con cordones de ${fx(+c.wPl, 0)} y ${fx(+c.wCt, 0)} mm.`;
  return `Esta conexión comprende la unión soldada del elemento ${de} a ${a === 'platina' ? 'la platina' : a}, con soldadura ${c.forma === 'T' ? 'a tope de penetración completa' : `de filete de ${fx(+c.w, 0)} mm`} (${(AnexoE.FORMAS[c.forma]?.n || '').toLowerCase()}), electrodo ${c.electrodo}.`;
}

// ═══ Pantalla ═══
async function paneMemoria(){
  pane('<p class="muted">Armando la memoria con los datos de los anexos…</p>');
  let ctx; try{ ctx = await ctxMemoria(); }catch(e){ err(e, 'No se pudo armar la memoria'); return; }
  if(S.paso !== 'MG') return;
  const M = ctx.M; if(ctx.K?.redImg) ctx.urlsRed = await urlDe(ctx.K.redImg);
  const doc = memDoc(ctx, true), dat = M.dat, ro_ = esIng() ? '' : 'disabled';
  const campos = {
    1:`<div class="fg g4"><div class="f span2"><label>Uso proyectado</label><input data-md="uso" value="${esc(dat.uso || '')}" placeholder="${esc(ctx.f.uso || 'Cubierta para soporte de paneles solares')}" ${ro_}/></div>
      <div class="f"><label>Zona</label><select data-md="zona" ${ro_}><option value="urbana" ${dat.zona !== 'rural' ? 'selected' : ''}>Urbana</option><option value="rural" ${dat.zona === 'rural' ? 'selected' : ''}>Rural</option></select></div>
      <div class="f"><label>Número de pisos</label><input data-md="nPisos" inputmode="numeric" value="${esc(dat.nPisos || '')}" placeholder="1" ${ro_}/></div></div>`,
    3:`<div class="fg g4"><div class="f"><label>Ejes literales</label><input data-md="ejesL" value="${esc(dat.ejesL || '')}" placeholder="A – C" ${ro_}/></div><div class="f"><label>Ejes numerales</label><input data-md="ejesN" value="${esc(dat.ejesN || '')}" placeholder="1 – 5" ${ro_}/></div></div>`,
    4:`<div class="fg g4"><div class="f"><label>Zona</label><select data-md="zona" ${ro_}><option value="urbana" ${dat.zona !== 'rural' ? 'selected' : ''}>Urbana</option><option value="rural" ${dat.zona === 'rural' ? 'selected' : ''}>Rural</option></select></div></div><p class="hint">Dirección y coordenadas: se cambian en la ficha del proyecto.</p>`,
    6:ctx.K?.impacto ? `<div class="fg g4"><div class="f"><label>Impacto vehicular [kN]</label><input data-md="impF" inputmode="decimal" value="${esc(dat.impF || '')}" placeholder="30" ${ro_}/></div><div class="f"><label>Altura de aplicación [m]</label><input data-md="impH" inputmode="decimal" value="${esc(dat.impH || '')}" placeholder="0.50" ${ro_}/></div></div>` : '',
  };
  const nMod = c => Object.keys(M.txt).filter(k => M.txt[k] && (doc.caps[c] || '').includes(`data-mk="${k}"`)).length;
  pane(`<p class="lead" style="margin-bottom:12px">El cuerpo de la memoria se arma solo con los datos de la ficha y de los anexos. Revisa cada capítulo: con <b>✎ Editar</b> cambias un texto (queda marcado) y con <b>↺ Automático</b> vuelves al texto de la app. En cada figura puedes usar tu propia imagen.</p>
    <div class="d-grid"><div class="d-lista">${CAPS.map(([n, t]) => `<button type="button" class="d-el ${n === selCap ? 'on' : ''}" data-cap="${n}"><span><b>${n}.</b> ${esc(t)}${nMod(n) ? `<small>${nMod(n)} texto${nMod(n) > 1 ? 's' : ''} cambiado${nMod(n) > 1 ? 's' : ''}</small>` : ''}</span></button>`).join('')}
      <p class="hint" style="margin-top:8px">${doc.tabs.length} tablas · ${doc.figs.length} figuras. La tabla de contenido y las listas de tablas, figuras y anexos se arman solas en el PDF final.</p></div>
      <div class="card m-hoja"><div class="ct"><span>${selCap}. ${esc(CAPS[selCap - 1][1])}</span></div>
        ${campos[selCap] ? `<div class="m-datos"><h4 class="sub">Datos de este capítulo</h4>${campos[selCap]}</div>` : ''}
        <div class="ax m-prev">${doc.caps[selCap] || '<p class="hint">Sin contenido.</p>'}</div></div></div>`);
  activarMemoria(M);
}
function activarMemoria(M){
  $$('[data-cap]').forEach(b => b.onclick = () => { selCap = +b.dataset.cap; paneMemoria(); });
  if(!esIng()) return;
  $$('[data-md]').forEach(i => i.addEventListener(i.tagName === 'SELECT' ? 'change' : 'input', debounce(() => { M.dat[i.dataset.md] = i.value; guardarMemoria(); paneMemoria(); }, 600)));
  $$('[data-mked]').forEach(b => b.onclick = () => {
    const k = b.dataset.mked, box = b.closest('.m-ed'), t = box.querySelector('template').content.textContent;
    box.innerHTML = `<textarea class="m-ta" rows="${Math.min(18, Math.max(4, t.split('\n').length + 2))}">${esc(t)}</textarea>
      <div class="m-ed-b"><button class="btn sm pri" type="button" data-ok>Guardar</button><button class="btn sm" type="button" data-no>Cancelar</button><span class="hint">Párrafos separados por una línea en blanco · viñetas: líneas que empiezan con «• » o «- ».</span></div>`;
    const ta = box.querySelector('textarea'); ta.focus();
    box.querySelector('[data-ok]').onclick = () => { M.txt[k] = ta.value; guardarMemoria(); paneMemoria(); };
    box.querySelector('[data-no]').onclick = () => paneMemoria();
  });
  $$('[data-mkre]').forEach(b => b.onclick = () => { delete M.txt[b.dataset.mkre]; guardarMemoria(); paneMemoria(); });
  $$('[data-mimg]').forEach(b => b.onclick = async () => { const k = b.dataset.mimg, f = await elegirArchivo('image/*'); if(!f) return;
    try{ toast('Subiendo imagen…', 15000); const blob = await comprimir(f, { max:1800, type:'image/jpeg', q:0.85 }), path = `${S.m.id}/memoria-${k.replace(/[^\w.-]/g, '_')}-${Date.now().toString(36)}.jpg`;
      const old = M.img[k]?.path; await subir(path, blob, 'image/jpeg'); M.img[k] = { path, nota:M.img[k]?.nota || '' }; if(old) sb.storage.from(BUCKET).remove([old]).catch(() => {});
      guardarMemoria(); toast('Imagen guardada.'); paneMemoria(); }catch(e){ err(e, 'No se pudo subir la imagen'); } });
  $$('[data-mimgx]').forEach(b => b.onclick = async () => { const k = b.dataset.mimgx, old = M.img[k]?.path; delete M.img[k]; if(old) sb.storage.from(BUCKET).remove([old]).catch(() => {}); guardarMemoria(); paneMemoria(); });
  $$('[data-mimgn]').forEach(i => i.oninput = () => { const k = i.dataset.mimgn; if(M.img[k]){ M.img[k].nota = i.value; guardarMemoria(); } });
}

// ═══ Impresión: cuerpo de la memoria (lo usa «Imprimir memoria completa») ═══
async function htmlMemoria(){
  const ctx = await ctxMemoria(); if(ctx.K?.redImg) ctx.urlsRed = await urlDe(ctx.K.redImg);
  const d = memDoc(ctx, false);
  return { html:`<div class="doc-blk ax m-doc">${d.html}</div>`, toc:d.toc, tabs:d.tabs, figs:d.figs };
}
