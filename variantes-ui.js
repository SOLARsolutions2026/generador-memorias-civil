/* ═══ Variantes de diseño (opción A de Amo, 29-oct) ═══
   Una variante es una copia completa de la memoria (ficha, anexos, revisiones y archivos) que se agrupa debajo de la
   original (variante_de = id de la original). Amo le pone un nombre interno (variante_nom, no sale en lo impreso).
   Una del grupo es la ★ definitiva (definitiva = true): la que se muestra en la fila y ve el rol consulta. */
const nomDiseno = m => m.variante_de ? (m.variante_nom || 'Variante') : (m.variante_nom || 'Inicial');

function activarVariantes(grupos){
  const g_ = id => grupos.find(g => g.todos.some(x => x.id === id));
  $$('[data-variante]').forEach(b => b.onclick = () => modalVariante(g_(b.dataset.variante)));
  $$('[data-defvar]').forEach(b => b.onclick = () => hacerDefinitiva(g_(b.dataset.defvar), b.dataset.defvar));
  $$('[data-renvar]').forEach(b => b.onclick = () => renombrarDiseno(S.mems.find(m => m.id === b.dataset.renvar)));
  $$('[data-borvar]').forEach(b => b.onclick = () => borrarVariante(g_(b.dataset.borvar), S.mems.find(m => m.id === b.dataset.borvar)));
}

function modalVariante(g){
  const { md, cerrar } = abrirModal(`${hdModal('Crear variante de diseño')}
    <p class="lead">Se hace una copia completa de <b>${esc(g.r.consecutivo)}</b> (ficha, anexos A–E, modelo, imágenes y revisiones) para probar otro diseño
      sin tocar el que tienes. El consecutivo es el mismo; el nombre es solo interno, para que sepas por qué la duplicaste.</p>
    <div class="f"><label for="vNom">Nombre de la variante</label><input id="vNom" maxlength="60" placeholder="Ej.: Revisión con perfiles tubulares"/></div>
    ${g.todos.length > 1 ? `<div class="f"><label for="vOrig">Copiar desde</label><select id="vOrig">${g.todos.map(m => `<option value="${m.id}" ${m === g.def ? 'selected' : ''}>${esc(nomDiseno(m))}${m === g.def ? ' ★' : ''}</option>`).join('')}</select></div>` : ''}
    <div class="doc-log" id="vLog" hidden></div>
    <div class="nav-btns" style="margin-top:10px"><button class="btn pri" type="button" id="vIr">⧉ Crear y abrir la variante</button></div>`);
  const inp = $('#vNom', md); inp.focus();
  $('#vIr', md).onclick = async () => {
    const nom = inp.value.trim(); if(!nom){ inp.focus(); return toast('Escribe un nombre para la variante.'); }
    const orig = $('#vOrig', md)?.value || g.r.id, b = $('#vIr', md), lg = $('#vLog', md);
    b.disabled = true; lg.hidden = false; lg.textContent = '';
    const log = t => { lg.textContent += t + '\n'; };
    try{ const nid = await crearVariante(g, orig, nom, log); cerrar(); toast(`Variante «${nom}» creada.`); S.m = null; ir(`#/m/${nid}/ficha`); }
    catch(e){ log('⚠ ' + (e.message || e)); b.disabled = false; }
  };
  inp.onkeydown = e => { if(e.key === 'Enter') $('#vIr', md).click(); };
}

async function crearVariante(g, origenId, nombre, log){
  await guardarPendientes();
  log('Leyendo el diseño de origen…');
  const [{ data:src, error:e1 }, { data:revs, error:e2 }] = await Promise.all([
    sb.from('mem_memorias').select('*').eq('id', origenId).maybeSingle(), sb.from('mem_revisiones').select('*').eq('memoria_id', origenId)]);
  if(e1 || !src) throw e1 || new Error('No se encontró el diseño de origen'); if(e2) throw e2;
  const nid = crypto.randomUUID(), cambia = x => x == null ? x : JSON.parse(JSON.stringify(x).split(`${src.id}/`).join(`${nid}/`));
  // archivos: misma ruta dentro de la carpeta de la variante
  const arch = await archivosDe(src.id);
  let k = 0;
  for(const f of arch){ k++; log(`Copiando archivo ${k} de ${arch.length}…`);
    const { error } = await sb.storage.from(BUCKET).copy(f.ruta, nid + f.ruta.slice(src.id.length)); if(error) throw new Error(`No se pudo copiar ${f.ruta.split('/').pop()}: ${error.message}`); }
  log('Guardando la variante…');
  const { error:e3 } = await sb.from('mem_memorias').insert({ id:nid, consecutivo:src.consecutivo, titulo:src.titulo, estado:'wip', perfil_id:src.perfil_id,
    ficha:cambia(src.ficha), anexos:cambia(src.anexos) || {}, imagen_path:cambia(src.imagen_path),
    variante_de:g.r.id, variante_nom:nombre, variante_origen:nomDiseno(src), definitiva:false });
  if(e3){ if(arch.length) await sb.storage.from(BUCKET).remove(arch.map(f => nid + f.ruta.slice(src.id.length))); throw e3; }
  if(revs?.length){ const { error } = await sb.from('mem_revisiones').insert(revs.map(r => { const c = { ...r, memoria_id:nid }; delete c.id; delete c.created_at; return c; })); if(error) throw error; }
  if(!g.r.variante_nom) await sb.from('mem_memorias').update({ variante_nom:'Inicial' }).eq('id', g.r.id);   // para mostrar «Inicial» al abrirla
  return nid;
}

async function hacerDefinitiva(g, id){
  const m = g.todos.find(x => x.id === id);
  if(!confirm(`¿Dejar «${nomDiseno(m)}» como el diseño definitivo de ${g.r.consecutivo}?\n\nEs el que se muestra en la lista y el que ve el personal de consulta. Los demás diseños no se borran.`)) return;
  try{
    for(const x of g.todos){ const v = x.id === id; if((x.definitiva !== false) !== v){ const { error } = await sb.from('mem_memorias').update({ definitiva:v }).eq('id', x.id); if(error) throw error; } }
    toast(`«${nomDiseno(m)}» es ahora el diseño definitivo.`); renderLista();
  }catch(e){ err(e, 'No se pudo cambiar'); }
}

async function renombrarDiseno(m){
  const n = prompt('Nombre interno del diseño (solo para ti, no sale en la memoria):', nomDiseno(m)); if(n == null || !n.trim()) return;
  const { error } = await sb.from('mem_memorias').update({ variante_nom:n.trim().slice(0, 60) }).eq('id', m.id);
  if(error) return err(error, 'No se pudo cambiar el nombre');
  renderLista();
}

async function borrarVariante(g, m){
  if(!confirm(`¿Eliminar la variante «${nomDiseno(m)}» con sus archivos? No se puede deshacer. El diseño inicial y las demás variantes no se tocan.`)) return;
  try{
    const arch = await archivosDe(m.id); if(arch.length) await sb.storage.from(BUCKET).remove(arch.map(f => f.ruta));
    const { error } = await sb.from('mem_memorias').delete().eq('id', m.id); if(error) throw error;
    if(m.definitiva !== false) await sb.from('mem_memorias').update({ definitiva:true }).eq('id', g.r.id);   // la original vuelve a ser la definitiva
    if(S.m?.id === m.id) S.m = null;
    toast(`Variante «${nomDiseno(m)}» eliminada.`); renderLista();
  }catch(e){ err(e, 'No se pudo eliminar'); }
}
