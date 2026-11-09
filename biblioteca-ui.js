/* Biblioteca de paneles solares y rieles (pedido de Amo 9-nov, opciones B + C):
   - B: botón «＋ Nuevo» junto a los desplegables (revisión de cubierta y Anexo A) → ventana con todos los datos.
   - C: sección en Configuración para ver, corregir y borrar.
   Se guarda en mem_config.biblioteca = { paneles:[…], rieles:[…] }; la ficha PDF en Storage biblioteca/<lista>-<nombre>.pdf.
   Unidades (iguales al Anexo A): panel L, W, H [m], peso [kg], cargaF/cargaP [Pa]; riel alto/ancho [m], peso [kg/m], luzMax [m]. */
const CAMPOS_BIB = {
  paneles:{ uno:'panel', campos:[
    ['nombre', 'Referencia (marca y modelo)', 'text', 'Ej.: JA Solar JAM72D40 620 W'],
    ['L', 'Largo L [m]', 'num', '2.382'], ['W', 'Ancho A [m]', 'num', '1.134'], ['H', 'Espesor H [m]', 'num', '0.030'],
    ['peso', 'Peso [kg]', 'num', '32.5'],
    ['cargaF', 'Carga de diseño frontal [Pa]', 'num', '5400', 'Presión (nieve/viento) de la ficha técnica'],
    ['cargaP', 'Carga de diseño posterior [Pa]', 'num', '2400', 'Succión de la ficha técnica'] ] },
  rieles:{ uno:'riel', campos:[
    ['nombre', 'Referencia (marca y modelo)', 'text', 'Ej.: Alurack Master Rail'],
    ['alto', 'Alto [m]', 'num', '0.040'], ['ancho', 'Ancho [m]', 'num', '0.040'], ['peso', 'Peso [kg/m]', 'num', '0.906'],
    ['material', 'Material', 'text', 'Aluminio 6005-T5'],
    ['luzMax', 'Separación máx. de apoyos del fabricante [m]', 'num', '2.0'] ] },
};
const slugBib = t => String(t || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
async function guardarBiblioteca(){
  const { error } = await sb.from('mem_config').update({ biblioteca:S.cfg.biblioteca }).eq('id', 1);
  if(error) throw error;
}
// Ventana para crear (idx = null) o corregir (idx = n) un panel o riel. Devuelve el objeto guardado, o null si se canceló.
function modalItemBib(lista, idx = null){
  const D = CAMPOS_BIB[lista], bib = S.cfg.biblioteca = S.cfg.biblioteca || {}, L = bib[lista] = bib[lista] || [];
  const it = idx == null ? {} : { ...L[idx] };
  let pdf = null;
  return new Promise(fin => {
    const { md, cerrar } = abrirModal(`${hdModal(`${idx == null ? 'Nuevo' : 'Corregir'} ${D.uno}`)}
      <p class="hint" style="margin:0 0 8px">Queda en la biblioteca para todas las memorias (diseños completos, revisiones y verificaciones).</p>
      <div class="fg g2">${D.campos.map(([k, l, t, ph, h]) => `<div class="f" ${k === 'nombre' ? 'style="grid-column:1/-1"' : ''}><label for="bib_${k}">${l}</label>
        <input id="bib_${k}" data-bk="${k}" ${t === 'num' ? 'inputmode="decimal"' : ''} value="${esc(it[k] ?? '')}" placeholder="${esc(ph || '')}"/>${h ? `<div class="hint">${h}</div>` : ''}</div>`).join('')}</div>
      <div class="f" style="margin-top:8px"><label>Ficha técnica (PDF, opcional)</label>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn sm" type="button" id="bibPdf">📎 ${it.ficha ? 'Cambiar PDF' : 'Adjuntar PDF'}</button><span class="hint" id="bibPdfTxt">${it.ficha ? '📄 Tiene ficha técnica' : 'Sin ficha'}</span></div>
        <div class="hint">Se une al PDF final de los diseños completos, después del Anexo A.</div></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn" type="button" data-cerrar>Cancelar</button><button class="btn pri" type="button" id="bibOk">💾 Guardar en la biblioteca</button></div>`);
    md.querySelector('.box2').style.maxWidth = '620px';
    const fuera = new MutationObserver(() => { if(!document.body.contains(md)){ fuera.disconnect(); fin(null); } });
    fuera.observe(document.body, { childList:true });
    $('#bib_nombre', md).focus();
    $('#bibPdf', md).onclick = async () => { const f = await elegirArchivo('application/pdf'); if(!f) return;
      if(f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) return toast('El archivo debe ser PDF.');
      pdf = f; $('#bibPdfTxt', md).textContent = `📄 ${f.name} (${(f.size/1048576).toFixed(1)} MB)`; };
    $('#bibOk', md).onclick = async () => {
      const nuevo = { ...it };
      $$('[data-bk]', md).forEach(el => { const k = el.dataset.bk, t = D.campos.find(c => c[0] === k)[2], v = el.value.trim();
        nuevo[k] = t === 'num' ? (v === '' ? '' : Number(v.replace(',', '.'))) : v; });
      if(!nuevo.nombre) return toast('Escriba la referencia.');
      if(L.some((x, i) => i !== idx && x.nombre.trim().toLowerCase() === nuevo.nombre.toLowerCase())) return toast(`Ya hay un ${D.uno} con ese nombre en la biblioteca.`);
      const malos = D.campos.filter(([k, , t]) => t === 'num' && nuevo[k] !== '' && !(nuevo[k] >= 0)).map(c => c[1]);
      if(malos.length) return toast('Revise: ' + malos.join(', '));
      if(!(nuevo.peso > 0)) return toast('Falta el peso.');
      const b = $('#bibOk', md); b.disabled = true; b.textContent = 'Guardando…';
      try{
        if(pdf){ const path = `biblioteca/${lista}-${slugBib(nuevo.nombre)}-${Date.now().toString(36)}.pdf`; await subir(path, pdf, 'application/pdf'); nuevo.ficha = path; }
        if(idx == null) L.push(nuevo); else L[idx] = nuevo;
        await guardarBiblioteca();
        toast(`«${nuevo.nombre}» guardado en la biblioteca.`); fuera.disconnect(); cerrar(); fin(nuevo);
      }catch(e){ b.disabled = false; b.textContent = '💾 Guardar en la biblioteca'; err(e, 'No se pudo guardar en la biblioteca'); }
    };
  });
}

// Configuración → tarjeta de la biblioteca (opción C)
function bibliotecaCfgHTML(){
  const bib = S.cfg.biblioteca || {}, P = bib.paneles || [], R = bib.rieles || [], f = (v, d = 3) => v === '' || v == null ? '—' : (+v).toLocaleString('es-CO', { maximumFractionDigits:d });
  const acc = (l, i, x) => `<td class="c"><span style="display:inline-flex;gap:4px">${x.ficha ? `<button class="ib" type="button" data-bibver="${l}|${i}" title="Ver ficha técnica" aria-label="Ver ficha técnica">📄</button>` : ''}<button class="ib" type="button" data-bibed="${l}|${i}" title="Corregir" aria-label="Corregir">✎</button><button class="ib" type="button" data-bibdel="${l}|${i}" title="Quitar de la biblioteca" aria-label="Quitar">🗑</button></span></td>`;
  return `<div class="card"><div class="ct">Biblioteca de paneles solares y rieles</div>
    <div class="hint" style="margin:-4px 0 8px">Lo que aparece en los desplegables del Anexo A y de las revisiones de cubierta. Corregir o quitar aquí no cambia las memorias ya hechas: cada una guarda su propia copia de los datos.</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin:4px 0 6px"><b>☀️ Paneles (${P.length})</b><button class="btn sm pri" type="button" data-bibnuevo="paneles">＋ Nuevo panel</button></div>
    <div class="tw"><table class="t"><thead><tr><th>Referencia</th><th>L × A × H [m]</th><th>Peso [kg]</th><th>Frontal / posterior [Pa]</th><th></th></tr></thead><tbody>
      ${P.map((x, i) => `<tr><td>${esc(x.nombre)}</td><td class="n">${f(x.L)} × ${f(x.W)} × ${f(x.H)}</td><td class="n">${f(x.peso, 1)}</td><td class="n">${f(x.cargaF, 0)} / ${f(x.cargaP, 0)}</td>${acc('paneles', i, x)}</tr>`).join('') || '<tr><td colspan="5" class="muted">Sin paneles.</td></tr>'}</tbody></table></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin:14px 0 6px"><b>▬ Rieles (${R.length})</b><button class="btn sm pri" type="button" data-bibnuevo="rieles">＋ Nuevo riel</button></div>
    <div class="tw"><table class="t"><thead><tr><th>Referencia</th><th>Alto × ancho [m]</th><th>Peso [kg/m]</th><th>Material</th><th>Apoyos máx. [m]</th><th></th></tr></thead><tbody>
      ${R.map((x, i) => `<tr><td>${esc(x.nombre)}</td><td class="n">${f(x.alto)} × ${f(x.ancho)}</td><td class="n">${f(x.peso)}</td><td>${esc(x.material || '—')}</td><td class="n">${f(x.luzMax, 2)}</td>${acc('rieles', i, x)}</tr>`).join('') || '<tr><td colspan="6" class="muted">Sin rieles.</td></tr>'}</tbody></table></div></div>`;
}
function activarBibliotecaCfg(re){
  $$('[data-bibnuevo]').forEach(b => b.onclick = async () => { if(await modalItemBib(b.dataset.bibnuevo)) re(); });
  $$('[data-bibed]').forEach(b => b.onclick = async () => { const [l, i] = b.dataset.bibed.split('|'); if(await modalItemBib(l, +i)) re(); });
  $$('[data-bibver]').forEach(b => b.onclick = async () => { const [l, i] = b.dataset.bibver.split('|'); const u = await urlFicha(S.cfg.biblioteca[l][+i].ficha); u ? window.open(u, '_blank', 'noopener') : toast('No se encontró el PDF.'); });
  $$('[data-bibdel]').forEach(b => b.onclick = async () => {
    const [l, i] = b.dataset.bibdel.split('|'), L = S.cfg.biblioteca[l], x = L[+i];
    if(!confirm(`¿Quitar «${x.nombre}» de la biblioteca?\nLas memorias que ya lo usan conservan sus datos.`)) return;
    L.splice(+i, 1);
    try{ await guardarBiblioteca(); toast('Quitado de la biblioteca.'); re(); }catch(e){ L.splice(+i, 0, x); err(e, 'No se pudo quitar'); }
  });
}
