/* ═══ Documentos: Anexos F (planos) y G (estudio de suelos) + PDF final (decisión de Amo 29-oct) ═══
   El PDF final se arma en dos pasos:
   1) «Imprimir memoria completa»: portada + anexos A–E + portadas de F y G, en una sola impresión del navegador.
   2) Amo sube ese PDF; la app (pdf-lib, en el navegador) agrega el índice, las fichas técnicas después del Anexo A,
      los planos y el estudio de suelos detrás de sus portadas, el rótulo y la numeración «X / Y», y descarga el PDF final.
   Para ubicar dónde empieza cada anexo, la app lee el texto del PDF con pdf.js (busca «ANEXO X - »). */
'use strict';
const DOCS = {
  F:{ n:'Planos estructurales', t:'PLANOS ESTRUCTURALES', ico:'📐', ph:'Planos de cimentación, columnas, vigas, cubierta y detalles de conexión.' },
  G:{ n:'Estudio de suelos', t:'ESTUDIO DE SUELOS', ico:'🪨', ph:'Estudio geotécnico: perfil del suelo, capacidad admisible y recomendaciones de cimentación.' },
};
function datosFG(k){
  const an = S.m.anexos = S.m.anexos || {};
  const X = an[k] = an[k] || { aplica:true, archivos:[], desc:'', nota:'' };
  if(!Array.isArray(X.archivos)) X.archivos = [];
  return X;
}
function estadoFG(){ return ['F','G'].every(k => { const X = S.m.anexos?.[k]; return X && (X.aplica === false || X.archivos?.length); }) ? 'ok' : 'wip'; }

// ─── Librerías (se cargan solo cuando se necesitan) ───
const _scripts = {};
function cargarScript(src){ return _scripts[src] = _scripts[src] || new Promise((ok, mal) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => mal(new Error('No se pudo cargar ' + src)); document.head.appendChild(s); }); }
async function libPDF(){ await cargarScript('vendor/pdf-lib.min.js'); await cargarScript('vendor/fontkit.min.js'); return window.PDFLib; }
let _pdfjs = null;
async function libPDFjs(){
  if(_pdfjs) return _pdfjs;
  _pdfjs = await import(new URL('vendor/pdf.min.mjs', location.href).href);
  _pdfjs.GlobalWorkerOptions.workerSrc = new URL('vendor/pdf.worker.min.mjs', location.href).href;
  return _pdfjs;
}
async function bytesDe(path){ const u = await urlFicha(path); if(!u) throw new Error('Sin dirección para ' + path); const r = await fetch(u); if(!r.ok) throw new Error(`No se pudo descargar ${path} (${r.status})`); return r.arrayBuffer(); }
const kbTxt = kb => kb >= 1024 ? fx(kb/1024, 1) + ' MB' : Math.round(kb) + ' kB';
const slugArch = n => String(n).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(0, 60);
function elegirArchivos(accept){
  return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.multiple = true; i.onchange = () => res([...i.files]); i.click(); });
}

// ═══ Paso F/G: subir los PDF ═══
function paneFG(){
  const ro_ = esIng() ? '' : 'disabled';
  const card = k => {
    const X = datosFG(k), d = DOCS[k], tot = X.archivos.reduce((s, a) => s + (a.pags || 0), 0);
    return `<div class="card"><div class="ct"><span>Anexo ${k} · ${d.n}</span>${X.aplica === false ? pill('gray', 'No aplica') : X.archivos.length ? pill('ok', `${X.archivos.length} archivo${X.archivos.length > 1 ? 's' : ''} · ${tot} pág.`) : pill('pend', 'Falta el PDF')}</div>
      <div class="f" style="margin-bottom:10px"><label>¿La memoria lleva ${d.n.toLowerCase()}?</label><div class="seg" role="group"><button type="button" data-fgap="${k}|1" class="${X.aplica !== false ? 'on' : ''}" ${ro_}>Sí</button><button type="button" data-fgap="${k}|0" class="${X.aplica === false ? 'on' : ''}" ${ro_}>No</button></div></div>
      ${X.aplica === false ? `<p class="hint">No se agrega ninguna hoja de este anexo a la memoria.</p>` : `
      <div class="f"><label>Descripción (sale en la portada del anexo)</label><textarea data-fgdesc="${k}" rows="2" ${ro_} placeholder="${esc(d.ph)}">${esc(X.desc || '')}</textarea></div>
      <h4 class="sub">Archivos PDF (en este orden van en la memoria)</h4>
      ${X.archivos.length ? `<div class="tw"><table class="t"><thead><tr><th>#</th><th>Archivo</th><th>Páginas</th><th>Tamaño</th><th></th></tr></thead><tbody>${X.archivos.map((a, i) => `<tr><td>${i + 1}</td><td>${esc(a.nombre)}</td><td class="n">${a.pags ?? '—'}</td><td class="n">${kbTxt(a.kb)}</td>
        <td style="white-space:nowrap"><button class="btn sm" type="button" data-fgver="${k}|${i}">Ver</button>${esIng() ? `<button class="btn sm" type="button" data-fgmv="${k}|${i}|-1" ${i ? '' : 'disabled'} aria-label="Subir">↑</button><button class="btn sm" type="button" data-fgmv="${k}|${i}|1" ${i < X.archivos.length - 1 ? '' : 'disabled'} aria-label="Bajar">↓</button><button class="btn sm danger" type="button" data-fgdel="${k}|${i}" aria-label="Quitar">✕</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`
        : '<p class="hint">Aún no hay archivos.</p>'}
      ${esIng() ? `<button class="btn pri" type="button" data-fgsub="${k}" style="margin-top:8px">📎 Subir PDF${k === 'F' ? ' (puedes escoger varios planos a la vez)' : ''}</button>` : ''}
      <p class="hint" style="margin-top:6px">En la memoria va primero una portada «ANEXO ${k} - ${d.t}» con la descripción y la lista de archivos, y detrás los PDF completos, con el número de página en la esquina.</p>`}</div>`;
  };
  pane(`<p class="lead" style="margin-bottom:12px">Estos anexos no se calculan aquí: subes los PDF y la app los pega en el PDF final, detrás de su portada.</p>${card('F')}${card('G')}`);
  activarFG();
}
function activarFG(){
  $$('[data-fgver]').forEach(b => b.onclick = async () => { const [k, i] = b.dataset.fgver.split('|'); const u = await urlDe(datosFG(k).archivos[+i].path); if(u) window.open(u, '_blank', 'noopener'); });
  if(!esIng()) return;
  const re = () => { guardarMemoria(); PANES.FG(); };
  $$('[data-fgap]').forEach(b => b.onclick = () => { const [k, v] = b.dataset.fgap.split('|'); datosFG(k).aplica = v === '1'; re(); });
  $$('[data-fgdesc]').forEach(t => t.oninput = () => { datosFG(t.dataset.fgdesc).desc = t.value; guardarMemoria(); });
  $$('[data-fgnota]').forEach(t => t.oninput = () => { datosFG(t.dataset.fgnota).nota = t.value; guardarMemoria(); });
  $$('[data-fgmv]').forEach(b => b.onclick = () => { const [k, i, d] = b.dataset.fgmv.split('|'), L = datosFG(k).archivos, j = +i + +d; [L[+i], L[j]] = [L[j], L[+i]]; re(); });
  $$('[data-fgdel]').forEach(b => b.onclick = async () => { const [k, i] = b.dataset.fgdel.split('|'), L = datosFG(k).archivos, a = L[+i];
    if(!confirm(`¿Quitar «${a.nombre}» de la memoria?`)) return;
    try{ await sb.storage.from(BUCKET).remove([a.path]); }catch(e){ console.warn(e); }
    L.splice(+i, 1); re(); });
  $$('[data-fgsub]').forEach(b => b.onclick = async () => {
    const k = b.dataset.fgsub, fs = (await elegirArchivos('application/pdf,.pdf')).filter(f => /\.pdf$/i.test(f.name) || f.type === 'application/pdf');
    if(!fs.length) return;
    const X = datosFG(k); let PDFLib = null; try{ PDFLib = await libPDF(); }catch(e){ console.warn(e); }
    for(const f of fs){
      if(f.size > 50*1024*1024){ toast(`«${f.name}» pesa más de 50 MB (límite del plan gratuito por archivo). Comprímelo antes de subirlo.`, 6000); continue; }
      try{
        toast(`Subiendo «${f.name}»…`, 30000);
        let pags = null; try{ if(PDFLib){ const d = await PDFLib.PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption:true }); pags = d.getPageCount(); } }catch(e){ console.warn(e); }
        const path = `${S.m.id}/anexo${k}/${Date.now().toString(36)}-${slugArch(f.name)}`;
        await subir(path, f, 'application/pdf');
        X.archivos.push({ nombre:f.name, path, kb:+(f.size/1024).toFixed(1), pags, fecha:new Date().toISOString() });
        guardarMemoria();
      }catch(e){ err(e, `No se pudo subir «${f.name}»`); }
    }
    toast('Archivos guardados.'); PANES.FG();
  });
}

// ═══ Paso 1: impresión de la memoria completa ═══
function hdAx(L, tit, norma, sub){
  const m = S.m, f = m.ficha, c = S.cfg;
  const fecha = f.fecha ? new Date(f.fecha + 'T12:00').toLocaleDateString('es-CO', { month:'long', year:'numeric' }) : '';
  return `<div class="ax-hd"><div class="ax-t">ANEXO ${L} - ${tit}</div><div class="ax-n">${norma}</div><div class="ax-n2">${sub}</div>
    <table class="ax-id"><tr><td><b>Proyecto:</b></td><td>${esc(f.proyecto||m.titulo||'')}</td><td><b>Ingeniero:</b></td><td>${esc((c.nombre_firma||'').replace(/^ING\.\s*/,''))}</td></tr>
    <tr><td><b>Proyecto No.:</b></td><td>${esc(m.consecutivo)}</td><td><b>Fecha:</b></td><td>${esc(fecha)}</td></tr></table></div>`;
}
function portadaFG(k){
  const X = datosFG(k), d = DOCS[k];
  const lista = X.aplica === false ? '' : X.archivos.length ? `<table class="ax-tb" style="max-width:5.5in;margin:14px auto 0"><thead><tr><th>#</th><th>Documento</th><th>Páginas</th></tr></thead><tbody>${X.archivos.map((a, i) => `<tr><td class="c">${i + 1}</td><td>${esc(a.nombre.replace(/\.pdf$/i, ''))}</td><td class="c">${a.pags ?? '—'}</td></tr>`).join('')}</tbody></table>` : '';
  return `<div class="ax doc-blk doc-cover">${hdAx(k, d.t, k === 'F' ? 'NSR-10 Título A.1.5' : 'NSR-10 Título H', X.aplica === false ? 'No aplica' : 'Documentos anexos')}
    <div class="cov-mid"><div class="cov-l">ANEXO ${k}</div><div class="cov-t">${d.t}</div>
      <p class="cov-p">${esc(X.aplica === false ? (X.nota || `Para el presente proyecto no se anexan ${d.n.toLowerCase()}.`) : (X.desc || d.ph))}</p>${lista}</div></div>`;
}
// HTML de cada anexo (los mismos de «Imprimir anexo»), o null si no se puede imprimir
async function htmlAnexo(id){
  if(id === 'A'){ const A = datosA(), R = AnexoA.calcular(A); for(const im of (A.viento.imgsExpo||[])) im._url = await urlDe(im.path); const h = anexoAPrintHTML(A, R); for(const im of (A.viento.imgsExpo||[])) delete im._url; return h; }
  if(id === 'B'){ const B = datosB();
    if(B.aplica === false) return `<div class="ax"><section>${hdAx('B', 'ANÁLISIS DE FUERZA HORIZONTAL EQUIVALENTE "FHE"', 'NSR-10 Título A', 'Alcance del análisis')}<p>${esc(B.texto || TXT_SIN_SISMO)}</p></section></div>`;
    const R = calcB(); if(!R.ok) return null;
    B.estructura._url = B.estructura.modo === 'sap' && B.estructura.sapImg ? await urlDe(B.estructura.sapImg) : null; const h = anexoBPrintHTML(B, R); delete B.estructura._url; return h; }
  if(id === 'C'){ const C = datosC(), M = C.modelo; if(!M) return null; const K = C.completas ? AnexoC.completas(await textoModelo(C)) : null; return anexoCPrintHTML(C, M, K, C.img ? await urlDe(C.img) : null); }
  if(id === 'D'){ const D = datosD(); if(!D.met.length && !D.zap.length && !D.ped.length) return null; let G = null; if(D.met.length) try{ G = await filasModelo(); }catch(e){ console.warn(e); }
    const Rs = D.met.map(e => ({ e, R:calcMet(e, G) })); const conc = await conPrintHTML(D, 'D'); return anexoDPrintHTML(Rs, conc); }
  if(id === 'E'){ const E = datosE(), D = datosD(); if(!E.con.length) return null; const ctx = await ctxE(); return anexoEPrintHTML(E.con.map(c => ({ c, X:calcE(c, D, ctx) })), D); }
  return null;
}
const TIT_AX = { A:'Análisis de cargas', B:'Fuerza horizontal equivalente', C:'Modelo estructural', D:'Diseño de elementos', E:'Diseño de conexiones', F:'Planos estructurales', G:'Estudio de suelos' };
// Página separadora antes de cada anexo (como en la memoria de Amo); la marca @@S<letra>@@ le dice al paso 2 dónde empieza
const sepAnexo = L => `<div class="doc-blk doc-sep"><span class="mk">@@S${L}@@</span><div class="sep-l">ANEXO ${L}</div><div class="sep-t">${esc(TIT_AX[L])}</div></div>`;
async function imprimirCompleta(){
  const m = S.m, partes = [], incl = [], omit = [], omitNA = [], op = m.anexos.gen?.op || {};
  toast('Preparando la memoria completa…', 90000);
  try{
    const [uImg, uFirma] = await Promise.all([urlDe(m.imagen_path), urlDe(S.cfg.firma_path)]);
    partes.push(portadaHTML(true, uImg, uFirma));
    let mem = null; try{ mem = await htmlMemoria(); partes.push(mem.html); }catch(e){ console.warn(e); omit.push('memoria general'); }
    for(const L of ['A','B','C','D','E']){
      let h = null; try{ h = await htmlAnexo(L); }catch(e){ console.warn(e); }
      if(h){ if(op.sep !== false) partes.push(sepAnexo(L)); partes.push(`<div class="doc-blk">${h}</div>`); incl.push(L); } else omit.push('Anexo ' + L);
    }
    // F o G solo llevan hoja si aplican y tienen PDF adjunto (pedido de Amo 29-oct)
    for(const k of ['F','G']){ const X = datosFG(k); if(X.aplica === false || !X.archivos.length){ omitNA.push('Anexo ' + k); continue; } partes.push(portadaFG(k)); incl.push(k); }
    const gen = m.anexos.gen = m.anexos.gen || {};
    gen.impreso = { fecha:new Date().toISOString(), incl, toc:mem?.toc || [], tabs:mem?.tabs || [], figs:mem?.figs || [] }; guardarMemoria();
    // la portada va sola (margen 0); el resto dentro de .doc-cuerpo con los márgenes laterales como relleno, para que nada
    // sea más ancho que la hoja y el navegador no reduzca todo (la portada salía achicada)
    const pa = $('#print-area'); pa.innerHTML = partes[0] + `<div class="doc-cuerpo">${partes.slice(1).join('')}</div>`;
    await Promise.all([...pa.querySelectorAll('img')].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
    try{ await Promise.all(['400','italic 400','600','italic 600','700','italic 700'].map(v => document.fonts.load(`${v} 12px EBG`))); }catch(e){}
    await document.fonts.ready;
    if(omit.length) toast(`No se incluyeron (faltan datos): ${omit.join(', ')}.`, 6000); else toast('Listo.', 800);
    // márgenes con espacio para el rótulo que se agrega en el paso 2; la portada sin márgenes
    const st = document.createElement('style'); st.textContent = '@page{size:letter;margin:.85in 0 1.05in}@page portada{margin:0}#print-area .pg{page:portada}#print-area .doc-cuerpo{padding:0 .75in}';
    document.head.appendChild(st); const t = document.title; document.title = `${m.consecutivo}_MEMORIA_SIN_UNIR`;
    window.print(); document.title = t; setTimeout(() => st.remove(), 500);
  }catch(e){ err(e, 'No se pudo preparar la memoria'); }
}

// ═══ Paso 2: unir, numerar y descargar ═══
let _final = null;   // { blob, nombre, filas }
function fichasTec(){
  const A = S.m.anexos?.A; if(!A?.tipo?.paneles) return [];
  return [['Ficha técnica del panel', A.panel?.nombre, A.panel?.ficha], ['Ficha técnica del riel', A.riel?.nombre, A.riel?.ficha]].filter(x => x[2]).map(([t, n, path]) => ({ t:`${t}${n ? ' ' + n : ''}`, path }));
}
async function unirPDF(file, op, log){
  const PDFLib = await libPDF(), pdfjs = await libPDFjs(), m = S.m, imp = m.anexos.gen?.impreso || {};
  const bytes = await file.arrayBuffer();
  log('Leyendo el PDF impreso…');
  const doc = await pdfjs.getDocument({ data:new Uint8Array(bytes.slice(0)), isEvalSupported:false }).promise, n = doc.numPages;
  const ini = {}, sep = {}, pH = {}, pT = {}, pF = {};
  for(let i = 1; i <= n; i++){
    const tc = await (await doc.getPage(i)).getTextContent(), raw = tc.items.map(x => x.str).join(''), t = tc.items.map(x => x.str).join(' ').replace(/\s+/g, ' ');
    const mm = t.match(/ANEXO ([A-G]) - /); if(mm && ini[mm[1]] == null) ini[mm[1]] = i - 1;
    for(const x of raw.replace(/\s+/g, '').matchAll(/@@([HTFS])([A-G]|\d+)@@/g)){ const tb = { H:pH, T:pT, F:pF, S:sep }[x[1]]; if(tb[x[2]] == null) tb[x[2]] = i - 1; }
  }
  for(const L of Object.keys(sep)) if(ini[L] == null || sep[L] < ini[L]) ini[L] = sep[L];
  const letras = Object.keys(ini).sort((a, b) => ini[a] - ini[b]);
  if(!letras.length && !Object.keys(pH).length) throw new Error('No encontré la memoria ni los anexos en el PDF. ¿Es el PDF de «Imprimir memoria completa»?');
  log(`Encontré ${Object.keys(pH).length ? 'el cuerpo de la memoria y ' : ''}${letras.length} anexos (${letras.join(', ')}) en ${n} páginas.`);
  const src = await PDFLib.PDFDocument.load(bytes), out = await PDFLib.PDFDocument.create();
  out.registerFontkit(window.fontkit);
  const [fR, fB] = await Promise.all(['fonts/ebg-400.ttf', 'fonts/ebg-600.ttf'].map(async u => out.embedFont(await (await fetch(u)).arrayBuffer(), { subset:true })));
  const cs = new Set(fR.getCharacterSet()), limpio = s => [...String(s ?? '')].map(ch => cs.has(ch.codePointAt(0)) ? ch : ch === '–' || ch === '—' ? '-' : '?').join('');
  // Segmentos: portada (1 página), cuerpo de la memoria, cada anexo (A + fichas; F/G + sus archivos)
  const portadaN = 1, seg = [];
  const fin0 = letras.length ? ini[letras[0]] : n;
  if(fin0 > portadaN) seg.push({ tipo:'imp', de:portadaN, a:fin0, ent:null });
  letras.forEach((L, j) => {
    // un PDF impreso antes con la hoja de F/G que no aplica: esa hoja se descarta
    if((L === 'F' || L === 'G') && (datosFG(L).aplica === false || !datosFG(L).archivos.length)) return;
    seg.push({ tipo:'imp', de:ini[L], a:j < letras.length - 1 ? ini[letras[j + 1]] : n, ent:{ t:`ANEXO ${L} — ${mayus(TIT_AX[L])}`, niv:2, L } });
    if(L === 'A' && op.fichas && fichasTec().length){ seg.push({ tipo:'mark', ent:{ t:'ANEXO A-1 — FICHAS TÉCNICAS DE LOS ELEMENTOS FOTOVOLTAICOS', niv:3, L:'A-1' } }); fichasTec().forEach(f => seg.push({ tipo:'ext', carta:true, path:f.path, ent:{ t:f.t, niv:4 } })); }
    if((L === 'F' || L === 'G') && datosFG(L).aplica !== false) for(const a of datosFG(L).archivos) seg.push({ tipo:'ext', carta:L === 'G', path:a.path, ent:{ t:a.nombre.replace(/\.pdf$/i, ''), niv:3 } });
  });
  // Copia de páginas; idxImp[i] = posición (sin las listas del inicio) de la página impresa i
  const marcas = [], extPag = new Set(), idxImp = {};
  out.addPage((await out.copyPages(src, [0]))[0]); idxImp[0] = 0;
  for(const s of seg){
    if(s.tipo === 'mark'){ marcas.push({ ...s.ent, pag:out.getPageCount(), n:0 }); continue; }
    let pags = [];
    if(s.tipo === 'imp'){ const idx = []; for(let i = s.de; i < s.a; i++) idx.push(i); pags = await out.copyPages(src, idx); idx.forEach((i, k) => idxImp[i] = out.getPageCount() + k); }
    const p0 = out.getPageCount();
    if(s.tipo === 'ext'){ log(`Agregando «${s.ent.t}»…`);
      // fichas técnicas y estudio de suelos: a carta vertical (Carta, calc/carta.js); los planos quedan en su tamaño
      try{ const d = await PDFLib.PDFDocument.load(await bytesDe(s.path), { ignoreEncryption:true });
        if(s.carta) pags = await Carta.paginas(PDFLib, out, d); else { pags = await out.copyPages(d, d.getPageIndices()); pags.forEach(p => out.addPage(p)); } }
      catch(e){ log(`⚠ No se pudo agregar «${s.ent.t}»: ${e.message}`); continue; }
      for(let i = p0; i < out.getPageCount(); i++) extPag.add(i); }
    else pags.forEach(p => out.addPage(p));
    if(s.ent) marcas.push({ ...s.ent, pag:p0, n:pags.length });
  }
  // ── Listas del inicio: tabla de contenido, tablas, figuras y anexos ──
  const W = 612, Hh = 792, X0 = 72, X1 = W - 72, Y0 = Hh - 140, YMIN = 96, gris = PDFLib.rgb(.45, .45, .45), negro = PDFLib.rgb(.07, .07, .07);
  const listas = [];
  if(op.indice){
    const toc = (imp.toc || []).filter(t => pH[t.id] != null).map(t => ({ t:`${t.n} ${t.t}`, niv:t.niv, imp:pH[t.id] }));
    const anx = marcas.filter(mk => mk.niv >= 2).map(mk => ({ t:mk.t, niv:mk.niv, pos:mk.pag }));
    // los anexos van debajo de «10. ANEXOS» (último capítulo)
    listas.push({ tit:'TABLA DE CONTENIDO', filas:[...toc, ...anx] });
    const tb = (imp.tabs || []).filter((t, i) => pT[i] != null).map((t, i) => ({ t:`Tabla ${t.n}. ${t.t}`, niv:9, imp:pT[i] }));
    const fg = (imp.figs || []).filter((t, i) => pF[i] != null).map((t, i) => ({ t:`Figura ${t.n}. ${t.t}`, niv:9, imp:pF[i] }));
    if(tb.length) listas.push({ tit:'LISTA DE TABLAS', filas:tb });
    if(fg.length) listas.push({ tit:'LISTA DE FIGURAS', filas:fg });
    const la = marcas.filter(mk => mk.L).map(mk => ({ t:mk.t, niv:8 }));
    if(la.length) listas.push({ tit:'LISTA DE ANEXOS', filas:la, sinNum:true });
  }
  const alto = f => f.niv === 1 ? 21 : f.niv === 8 ? 22 : 16.5;
  const paginar = L => { const pp = [[]]; let y = Y0; for(const f of L.filas){ const h = alto(f); if(y - h < YMIN){ pp.push([]); y = Y0; } pp[pp.length - 1].push(f); y -= h; } return pp; };
  listas.forEach(L => L.pags = paginar(L));
  const nFront = listas.reduce((s, L) => s + L.pags.length, 0);
  const pagFinal = f => (f.imp != null ? idxImp[f.imp] : f.pos) + 1 + nFront;   // número de página en el PDF final (1 = portada)
  let ins = portadaN;
  for(const L of listas) L.pags.forEach((filas, k) => {
    const pg = out.insertPage(ins++, [W, Hh]), tit = k ? L.tit + ' (continuación)' : L.tit;
    pg.drawText(tit, { x:W/2 - fB.widthOfTextAtSize(tit, 14)/2, y:Hh - 100, size:14, font:fB, color:negro });
    let y = Y0;
    for(const f of filas){
      const sz = f.niv === 1 || f.niv === 2 ? 11 : 10, fnt = f.niv <= 2 || f.niv === 8 ? fB : fR, x = X0 + ({ 1:0, 2:14, 3:28, 4:42 }[f.niv] || 0);
      if(L.sinNum){ const [a, b] = f.t.split(' — '); pg.drawText(limpio(a), { x:X0, y, size:11, font:fB, color:negro }); if(b) pg.drawText(limpio(b), { x:X0 + 120, y, size:11, font:fR, color:negro }); y -= alto(f); continue; }
      const ns = String(pagFinal(f)), xn = X1 - fnt.widthOfTextAtSize(ns, sz);
      let t = limpio(f.t); while(t.length > 4 && x + fnt.widthOfTextAtSize(t, sz) > xn - 24) t = t.slice(0, -2).trimEnd() + '…';
      pg.drawText(t, { x, y, size:sz, font:fnt, color:negro });
      const xt = x + fnt.widthOfTextAtSize(t, sz) + 4; let d = ''; while(xt + fR.widthOfTextAtSize(d + ' .', sz) < xn - 4) d += ' .';
      pg.drawText(d, { x:xt, y, size:sz, font:fR, color:gris }); pg.drawText(ns, { x:xn, y, size:sz, font:fnt, color:negro });
      y -= alto(f);
    }
  });
  // Rótulo y numeración
  const Y = out.getPageCount(), per = perfilDe(m), ta = limpio(tituloArchivo(m.ficha)), con = limpio(m.consecutivo);
  const pie = [per.l1, per.l2, per.correo && 'CORREO: ' + per.correo, per.dir && 'DIR: ' + per.dir, per.tel && 'TEL: ' + per.tel, per.ciudad].filter(x => (x||'').trim()).map(limpio);
  const ext = new Set([...extPag].map(i => i >= portadaN ? i + nFront : i));
  out.getPages().forEach((p, i) => {
    if(i < portadaN) return;
    const { width:w, height:h } = p.getSize(), num = `${i + 1} / ${Y}`;
    if(ext.has(i) || !op.rotulo){   // documentos anexos: solo el número en la esquina
      if(!op.numExt && ext.has(i)) return;
      const sz = Math.max(8, Math.min(w, h)/70), tw = fR.widthOfTextAtSize(num, sz);
      p.drawRectangle({ x:w - tw - 3*sz, y:sz, width:tw + 1.6*sz, height:sz*1.6, color:PDFLib.rgb(1,1,1), borderColor:gris, borderWidth:.6 });
      p.drawText(num, { x:w - tw - 2.2*sz, y:sz*1.45, size:sz, font:fR, color:negro }); return;
    }
    p.drawText(con, { x:54, y:h - 34, size:8, font:fR, color:gris });
    p.drawText(ta, { x:w - 54 - fR.widthOfTextAtSize(ta, 8), y:h - 34, size:8, font:fR, color:gris });
    p.drawLine({ start:{ x:54, y:h - 39 }, end:{ x:w - 54, y:h - 39 }, thickness:.6, color:PDFLib.rgb(.6,.6,.6) });
    p.drawLine({ start:{ x:54, y:66 }, end:{ x:w - 54, y:66 }, thickness:.6, color:PDFLib.rgb(.6,.6,.6) });
    pie.forEach((l, k) => p.drawText(l, { x:w/2 - fR.widthOfTextAtSize(l, 6.5)/2, y:57 - k*8, size:6.5, font:fR, color:gris }));
    const nw = fB.widthOfTextAtSize(num, 9.5);
    p.drawRectangle({ x:w - 54 - nw - 16, y:44, width:nw + 16, height:16, color:PDFLib.rgb(.73,.73,.73) });
    p.drawText(num, { x:w - 54 - nw - 8, y:48.5, size:9.5, font:fB, color:PDFLib.rgb(1,1,1) });
  });
  out.setTitle(`${m.consecutivo} ${tituloArchivo(m.ficha)}`); out.setAuthor(S.cfg.nombre_firma || ''); out.setCreator('Generador de Memorias de Cálculo — P. Electric S.A.S.');
  const blob = new Blob([await out.save()], { type:'application/pdf' });
  let pp = portadaN + 1; const filas = [['Portada', 1, portadaN], ...listas.map(L => { const r = [L.tit.charAt(0) + L.tit.slice(1).toLowerCase(), pp, L.pags.length]; pp += L.pags.length; return r; })];
  if(fin0 > portadaN) filas.push(['Cuerpo de la memoria (capítulos 1 a 10)', idxImp[portadaN] + 1 + nFront, fin0 - portadaN]);
  filas.push(...marcas.map(mk => [(mk.niv > 2 ? '  ' : '') + mk.t, mk.pag + 1 + nFront, mk.n]));
  return { blob, nombre:`${m.consecutivo}_${slugArch(tituloArchivo(m.ficha))}.pdf`, filas, Y };
}

// ═══ Paso «Generar PDF final» ═══
function paneGen(){
  const an = S.m.anexos || {}, gen = an.gen = an.gen || {}, op = gen.op = gen.op || { indice:true, rotulo:true, fichas:true, numExt:true };
  const est = s => s === 'ok' ? pill('ok', 'Listo') : s === 'wip' ? pill('pend', 'En proceso') : pill('gray', 'Sin datos');
  const filas = [
    ['Ficha del proyecto', fichaCompleta() ? 'ok' : 'wip', 'ficha'],
    ['Control de revisiones', S.revs.length ? 'ok' : 'wip', 'revisiones'],
    ['Imagen de portada y firma', S.m.imagen_path && S.cfg.firma_path ? 'ok' : 'wip', 'portada'],
    ...['A','B','K','C','D','E'].map(id => [STEPS.find(s => s.id === id).t, estadoPaso(STEPS.find(s => s.id === id)) || '', id]),
    ['Memoria general (capítulos 1 a 10)', S.m.anexos?.M ? 'ok' : '', 'MG'],
    ['Anexos F y G — planos y suelos', estadoFG(), 'FG'],
  ];
  const falt = filas.filter(f => f[1] !== 'ok').length, fic = fichasTec();
  pane(`<div class="card"><div class="ct"><span>Revisión antes de generar</span>${falt ? pill('pend', `${falt} por revisar`) : pill('ok', 'Todo listo')}</div>
      <div class="tw"><table class="t"><tbody>${filas.map(([t, s, id]) => `<tr><td>${esc(t)}</td><td>${est(s)}</td><td style="text-align:right"><button class="btn sm" type="button" data-irp="${id}">Ir</button></td></tr>`).join('')}</tbody></table></div>
      <p class="hint" style="margin-top:6px">No es obligatorio que todo esté listo: lo que falte simplemente no sale o sale incompleto.</p></div>
    <div class="card"><div class="ct"><span>Paso 1 · Imprimir la memoria completa</span>${gen.impreso ? `<span class="hint">última vez: ${new Date(gen.impreso.fecha).toLocaleString('es-CO', { dateStyle:'short', timeStyle:'short' })}</span>` : ''}</div>
      <p style="margin-bottom:8px">Sale en una sola impresión: la portada, el cuerpo de la memoria (capítulos 1 a 10), los anexos A a E con su página separadora y las portadas de los anexos F y G.</p>
      <ol class="doc-ol"><li>Toca <b>Imprimir memoria completa</b>.</li><li>En el cuadro de impresión escoge <b>Guardar como PDF</b>, tamaño <b>Carta</b> y márgenes <b>Predeterminados</b>.</li>
        <li>En «Más opciones» <b>quita</b> «Encabezados y pies de página» y <b>marca</b> «Gráficos de fondo».</li><li>Guarda el archivo (por ejemplo en Descargas).</li></ol>
      <button class="btn pri" type="button" id="genImp" style="margin-top:8px">🖨 Imprimir memoria completa</button></div>
    <div class="card"><div class="ct"><span>Paso 2 · Unir, numerar y descargar</span></div>
      <p style="margin-bottom:8px">Escoge el PDF que guardaste en el paso 1. La app le agrega:</p>
      <div class="doc-ops">
        <label class="chk"><input type="checkbox" data-gop="indice" ${op.indice ? 'checked' : ''}/> Tabla de contenido, lista de tablas, lista de figuras y lista de anexos, con sus números de página (después de la portada)</label>
        <label class="chk"><input type="checkbox" data-gop="sep" ${op.sep !== false ? 'checked' : ''}/> Página separadora «ANEXO X» antes de cada anexo (se aplica al imprimir en el paso 1)</label>
        <label class="chk"><input type="checkbox" data-gop="fichas" ${op.fichas ? 'checked' : ''} ${fic.length ? '' : 'disabled'}/> Fichas técnicas después del Anexo A ${fic.length ? `(${fic.map(f => esc(f.t)).join(' y ')})` : '(no hay fichas en el Anexo A)'}</label>
        <label class="chk"><input type="checkbox" data-gop="rotulo" ${op.rotulo ? 'checked' : ''}/> Rótulo en cada página: consecutivo y nombre del documento arriba; pie de página y número «X / Y» abajo (igual a la portada)</label>
        <label class="chk"><input type="checkbox" data-gop="numExt" ${op.numExt ? 'checked' : ''}/> Número de página en la esquina de los planos, el estudio de suelos y las fichas</label></div>
      <button class="btn pri" type="button" id="genUnir" style="margin-top:10px">📄 Escoger el PDF del paso 1 y unir</button>
      <div id="genLog" class="doc-log" hidden></div><div id="genRes"></div></div>`);
  $$('[data-irp]').forEach(b => b.onclick = () => ir(`#/m/${S.m.id}/${b.dataset.irp}`));
  $$('[data-gop]').forEach(i => i.onchange = () => { op[i.dataset.gop] = i.checked; guardarMemoria(); });
  $('#genImp').onclick = imprimirCompleta;
  $('#genUnir').onclick = async () => {
    const f = await elegirArchivo('application/pdf,.pdf'); if(!f) return;
    const lg = $('#genLog'); lg.hidden = false; lg.innerHTML = ''; $('#genRes').innerHTML = '';
    const log = t => { lg.insertAdjacentHTML('beforeend', `<div>${esc(t)}</div>`); };
    try{
      _final = await unirPDF(f, op, log);
      gen.unido = { fecha:new Date().toISOString(), pags:_final.Y }; guardarMemoria();
      log(`Listo: ${_final.Y} páginas.`);
      $('#genRes').innerHTML = `<h4 class="sub">Contenido del PDF final</h4><div class="tw"><table class="t"><thead><tr><th>Sección</th><th>Página</th><th>Páginas</th></tr></thead><tbody>${_final.filas.map(([t, p, k]) => `<tr><td>${t.startsWith('  ') ? '&emsp;' + esc(t.trim()) : '<b>' + esc(t) + '</b>'}</td><td class="n">${p}</td><td class="n">${k}</td></tr>`).join('')}</tbody></table></div>
        <div class="wtot"><span>PDF final · ${esc(_final.nombre)}</span><span>${_final.Y} páginas · ${kbTxt(_final.blob.size/1024)}</span></div>
        <div class="nav-btns" style="margin-top:10px"><button class="btn pri" type="button" id="genDesc">⬇ Descargar PDF final</button><button class="btn" type="button" id="genVer">👁 Ver</button></div>`;
      const url = URL.createObjectURL(_final.blob);
      $('#genDesc').onclick = () => { const a = document.createElement('a'); a.href = url; a.download = _final.nombre; a.click(); };
      $('#genVer').onclick = () => window.open(url, '_blank', 'noopener');
      pintarListo();
    }catch(e){ log('✗ ' + (e.message || e)); err(e, 'No se pudo unir el PDF'); }
  };
}
