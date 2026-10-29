/* ═══ Seguridad de la información (pedido de Amo 29-oct) ═══
   A. Historial: la base de datos guarda sola una copia de la memoria antes de cambiarla (máx. una cada 30 min,
      se conservan las últimas 5; tabla mem_versiones con el disparador mem_memorias_version). Aquí se ven y se restauran.
   B. Respaldo: descarga un .zip con todos los datos (datos.json) y, si se quiere, todos los archivos (PDF, imágenes,
      modelos); y lo vuelve a cargar («Restaurar desde respaldo»). fflate (vendor/fflate.min.js, MIT) arma el zip. */

const MOTIVO_V = { auto:'Copia automática', manual:'Copia guardada a mano', inicial:'Copia inicial', 'antes de restaurar':'Antes de restaurar otra copia', 'antes de restaurar respaldo':'Antes de restaurar un respaldo' };
const fechaHora = s => new Date(s).toLocaleString('es-CO', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });

function abrirModal(html){
  const md = document.createElement('div'); md.className = 'modal';
  md.innerHTML = `<div class="box2" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(md);
  const cerrar = () => { md.remove(); document.removeEventListener('keydown', k); };
  const k = e => { if(e.key === 'Escape') cerrar(); };
  document.addEventListener('keydown', k);
  md.addEventListener('click', e => { if(e.target === md || e.target.closest('[data-cerrar]')) cerrar(); });
  return { md, cerrar };
}
const hdModal = t => `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px"><h3>${t}</h3><button class="btn sm" type="button" data-cerrar aria-label="Cerrar">✕</button></div>`;

// Resumen de una copia: qué tenía llenado, para reconocerla
function resumenCopia(d){
  const a = d.anexos || {}, L = [];
  if(a.A) L.push('A'); if(a.B) L.push('B'); if(a.K) L.push('Comb.'); if(a.C?.modelo) L.push('C');
  const D = a.D; if(D && ((D.met||[]).length || (D.zap||[]).length || (D.ped||[]).length)) L.push(`D (${(D.met||[]).length} met., ${(D.zap||[]).length} zap., ${(D.ped||[]).length} ped.)`);
  if((a.E?.con||[]).length) L.push(`E (${a.E.con.length} con.)`);
  return `${esc(d.titulo || 'Sin nombre')}${L.length ? ' · ' + L.join(', ') : ''}`;
}

// ─── A. Historial de la memoria abierta ───
async function abrirHistorial(){
  const m = S.m; if(!m) return;
  await guardarPendientes();
  const { md, cerrar } = abrirModal(`${hdModal('Historial de esta memoria')}
    <p class="lead">La app guarda sola una copia antes de cambiar la memoria (como máximo una cada 30 minutos) y conserva las <b>últimas 5</b>.
      Si algo se daña o borras algo por error, restaura la copia de antes. Al restaurar, lo que hay ahora también queda guardado como copia, para poder deshacer.</p>
    <div id="hvLista"><p class="muted">Cargando…</p></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn" type="button" id="hvAhora">📌 Guardar una copia ahora</button>
      <span class="hint" style="align-self:center">Útil antes de un cambio grande.</span></div>
    <p class="hint" style="margin-top:8px">Las copias guardan los datos y cálculos. Los archivos (PDF, imágenes, modelo) no cambian al restaurar.</p>`);
  const pintar = async () => {
    const { data, error } = await sb.from('mem_versiones').select('id,creada,motivo,datos').eq('memoria_id', m.id).order('creada', { ascending:false });
    if(error){ $('#hvLista', md).innerHTML = `<div class="note red">No se pudo leer el historial: ${esc(error.message)}</div>`; return; }
    $('#hvLista', md).innerHTML = data.length ? `<div class="mlist">${data.map(v => `<div class="mi"><div><div class="code">${fechaHora(v.creada)}</div>
        <div class="nm" style="font-size:13px">${esc(MOTIVO_V[v.motivo] || v.motivo)}</div><div class="meta">${resumenCopia(v.datos)}</div></div>
        <div class="acts"><button class="btn sm" type="button" data-restv="${v.id}">Restaurar</button></div></div>`).join('')}</div>`
      : '<div class="card empty">Todavía no hay copias. Se crea la primera la próxima vez que cambies algo, o con «Guardar una copia ahora».</div>';
    $$('[data-restv]', md).forEach(b => b.onclick = async () => {
      const v = data.find(x => x.id === b.dataset.restv);
      if(!confirm(`¿Volver la memoria a como estaba el ${fechaHora(v.creada)}?\n\nLo que hay ahora queda guardado como copia en el historial.`)) return;
      try{
        b.disabled = true; await guardarPendientes();
        const { error:e1 } = await sb.rpc('mem_restaurar_version', { vid:v.id }); if(e1) throw e1;
        const { data:fila, error:e2 } = await sb.from('mem_memorias').select('*').eq('id', m.id).maybeSingle(); if(e2 || !fila) throw e2 || new Error('No se pudo volver a leer la memoria');
        S.m = fila; S.m.ficha = S.m.ficha || {}; cerrar(); renderWS(S.paso || 'ficha'); toast(`Memoria restaurada al ${fechaHora(v.creada)}.`, 4000);
      }catch(e){ b.disabled = false; err(e, 'No se pudo restaurar'); }
    });
  };
  $('#hvAhora', md).onclick = async () => {
    try{ await guardarPendientes(); const { error } = await sb.rpc('mem_guardar_version', { mid:m.id, motivo:'manual' }); if(error) throw error; toast('Copia guardada.'); pintar(); }
    catch(e){ err(e, 'No se pudo guardar la copia'); }
  };
  pintar();
}

// ─── B. Respaldo completo ───
let _fflate = null;
async function libZip(){ if(window.fflate) return window.fflate; if(!_fflate) _fflate = new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'vendor/fflate.min.js'; s.onload = () => ok(window.fflate); s.onerror = () => no(new Error('No se pudo cargar el compresor')); document.head.appendChild(s); }); return _fflate; }
const TIPOS = { pdf:'application/pdf', jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp', json:'application/json' };
const tipoDe = r => TIPOS[(r.split('.').pop() || '').toLowerCase()] || 'application/octet-stream';
const diasDesde = s => s ? (Date.now() - new Date(s).getTime()) / 86400000 : Infinity;

function tarjetaRespaldo(usadoMB){
  const u = S.cfg.ultimo_respaldo, d = diasDesde(u);
  return `<div class="card"><div class="ct">Respaldo de la información${pill(d <= 7 ? 'ok' : 'pend', u ? `último: ${fechaHora(u)}` : 'nunca se ha hecho')}</div>
    <p class="hint" style="margin-bottom:8px">Descarga un archivo .zip con todas las memorias (y, si quieres, todos sus PDF e imágenes) y guárdalo en el NAS.
      Recomendado: una vez por semana y antes de cada actualización grande de la app.${d > 7 ? ' <b>Ya pasó más de una semana desde el último.</b>' : ''}</p>
    <div class="nav-btns"><button class="btn pri" type="button" id="respDesc">⬇ Descargar respaldo</button><button class="btn" type="button" id="respRest">⬆ Restaurar desde respaldo</button></div></div>`;
}
function activarRespaldo(usadoMB){
  $('#respDesc').onclick = () => modalDescargar(usadoMB);
  $('#respRest').onclick = modalRestaurar;
}

function modalDescargar(usadoMB){
  const { md, cerrar } = abrirModal(`${hdModal('Descargar respaldo')}
    <div class="f"><label class="chk"><input type="radio" name="rtipo" value="todo" checked/> <b>Completo</b>: datos + archivos (PDF, imágenes, modelos) · unos ${Math.max(1, Math.round(usadoMB))} MB</label>
      <label class="chk"><input type="radio" name="rtipo" value="datos"/> <b>Solo datos</b>: memorias, revisiones, configuración y perfiles · rápido y liviano</label></div>
    <p class="hint">Con el completo puedes recuperar todo aunque se pierda la cuenta de la base de datos. El de solo datos sirve para el día a día.</p>
    <div class="doc-log" id="respLog" hidden></div>
    <div class="nav-btns" style="margin-top:10px"><button class="btn pri" type="button" id="respIr">Descargar</button></div>`);
  $('#respIr', md).onclick = async () => {
    const todo = $('input[name=rtipo]:checked', md).value === 'todo', lg = $('#respLog', md), b = $('#respIr', md);
    lg.hidden = false; lg.textContent = ''; b.disabled = true;
    const log = t => { lg.textContent += t + '\n'; lg.scrollTop = lg.scrollHeight; };
    try{ await descargarRespaldo(todo, log); setTimeout(cerrar, 1500); }
    catch(e){ log('⚠ ' + (e.message || e)); b.disabled = false; }
  };
}
async function descargarRespaldo(todo, log){
  const fz = await libZip();
  log('Leyendo las memorias…');
  const [mm, rv, cf, pf] = await Promise.all([sb.from('mem_memorias').select('*').order('created_at'), sb.from('mem_revisiones').select('*'), sb.from('mem_config').select('*').eq('id', 1).maybeSingle(), sb.from('mem_perfiles_pie').select('*')]);
  for(const r of [mm, rv, cf, pf]) if(r.error) throw r.error;
  const datos = { app:'generador-memorias-civil', formato:1, fecha:new Date().toISOString(), por:S.user.email, config:cf.data, perfiles:pf.data, memorias:mm.data, revisiones:rv.data, archivos:[] };
  const zip = {};
  if(todo){
    const rutas = [];
    for(const p of [...mm.data.map(m => m.id), 'config', 'biblioteca']) for(const f of await archivosDe(p)) rutas.push(f);
    let k = 0, kb = 0;
    for(const f of rutas){
      k++; log(`Archivo ${k} de ${rutas.length}: ${f.ruta.split('/').pop()}`);
      const { data:blob, error } = await sb.storage.from(BUCKET).download(f.ruta);
      if(error || !blob){ log(`  ⚠ no se pudo descargar (${error?.message || 'sin datos'})`); continue; }
      const u8 = new Uint8Array(await blob.arrayBuffer()); kb += u8.length / 1024;
      zip['archivos/' + f.ruta] = [u8, { level:/\.(s2k|\$2k|json|txt)$/i.test(f.ruta) ? 6 : 0 }];   // PDF e imágenes ya vienen comprimidos
      datos.archivos.push({ ruta:f.ruta, kb:Math.round(u8.length / 1024) });
    }
    log(`${datos.archivos.length} archivos, ${(kb / 1024).toFixed(1)} MB.`);
  }
  zip['datos.json'] = [fz.strToU8(JSON.stringify(datos, null, 1)), { level:6 }];
  zip['LEEME.txt'] = [fz.strToU8(`Respaldo del Generador de Memorias de Cálculo — P. Electric S.A.S.\nFecha: ${fechaHora(datos.fecha)}\nMemorias: ${datos.memorias.length}\nArchivos: ${datos.archivos.length}\n\nPara recuperarlo: en la app, lista de memorias → «Restaurar desde respaldo» y escoge este .zip.\ndatos.json tiene toda la información en texto; la carpeta archivos/ tiene los PDF, imágenes y modelos.\n`), { level:6 }];
  log('Armando el .zip…');
  const u8 = await new Promise((ok, no) => fz.zip(zip, (e, d) => e ? no(e) : ok(d)));
  const hoy = new Date(), dd = n => String(n).padStart(2, '0');
  const nombre = `respaldo-memorias-${hoy.getFullYear()}-${dd(hoy.getMonth() + 1)}-${dd(hoy.getDate())}${todo ? '' : '-solo-datos'}.zip`;
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([u8], { type:'application/zip' })); a.download = nombre; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  const ahora = new Date().toISOString();
  const { error } = await sb.from('mem_config').update({ ultimo_respaldo:ahora }).eq('id', 1); if(!error) S.cfg.ultimo_respaldo = ahora;
  log(`Listo: ${nombre} (${(u8.length / 1048576).toFixed(1)} MB). Guárdalo en el NAS.`);
  toast('Respaldo descargado.');
}

function modalRestaurar(){
  const { md, cerrar } = abrirModal(`${hdModal('Restaurar desde respaldo')}
    <p class="lead">Escoge el .zip de un respaldo. Luego eliges qué memorias recuperar. Las que ya existen en la app se reemplazan por la del respaldo,
      pero antes la app guarda una copia de cómo estaban en su historial.</p>
    <button class="btn pri" type="button" id="rrArch">📂 Escoger archivo de respaldo</button>
    <div id="rrCont" style="margin-top:12px"></div>`);
  $('#rrArch', md).onclick = async () => {
    const f = await elegirArchivo('.zip,application/zip'); if(!f) return;
    const cont = $('#rrCont', md); cont.innerHTML = '<p class="muted">Leyendo el respaldo…</p>';
    try{
      const fz = await libZip(), files = fz.unzipSync(new Uint8Array(await f.arrayBuffer()));
      if(!files['datos.json']) throw new Error('Este .zip no es un respaldo de la app (no tiene datos.json).');
      const R = JSON.parse(fz.strFromU8(files['datos.json']));
      if(R.app !== 'generador-memorias-civil' || !Array.isArray(R.memorias)) throw new Error('Este .zip no es un respaldo de la app.');
      await cargarMemorias();
      const actual = id => S.mems.find(m => m.id === id), nArch = id => Object.keys(files).filter(k => k.startsWith(`archivos/${id}/`)).length;
      cont.innerHTML = `<div class="note blue">Respaldo del <b>${fechaHora(R.fecha)}</b> · ${R.memorias.length} memorias · ${R.archivos?.length || 0} archivos${R.archivos?.length ? '' : ' (solo datos)'}.</div>
        <div class="mlist" style="margin-top:8px">${R.memorias.map(m => { const a = actual(m.id);
          return `<label class="mi" style="cursor:pointer"><div><div class="code">${esc(m.consecutivo)}</div><div class="nm" style="font-size:13px">${esc(m.titulo || 'Sin nombre')}</div>
            <div class="meta">En el respaldo: editada ${fechaHora(m.updated_at)}${nArch(m.id) ? ` · ${nArch(m.id)} archivos` : ''} · ${a ? `<b>en la app: editada ${fechaHora(a.updated_at)}</b> (se reemplaza)` : '<b>no está en la app</b> (se vuelve a crear)'}</div></div>
            <div class="acts"><input type="checkbox" data-rrm="${m.id}" ${a ? '' : 'checked'} aria-label="Restaurar ${esc(m.consecutivo)}"/></div></label>`; }).join('')}</div>
        <label class="chk" style="margin-top:8px"><input type="checkbox" id="rrCfg"/> Restaurar también la configuración (datos del ingeniero, firma, biblioteca) y los perfiles de pie de página</label>
        <div class="doc-log" id="rrLog" hidden></div>
        <div class="nav-btns" style="margin-top:10px"><button class="btn pri" type="button" id="rrIr">Restaurar las seleccionadas</button></div>`;
      $('#rrIr', md).onclick = async () => {
        const ids = $$('[data-rrm]', md).filter(c => c.checked).map(c => c.dataset.rrm), cfg = $('#rrCfg', md).checked;
        if(!ids.length && !cfg) return toast('Selecciona al menos una memoria.');
        const reemp = ids.filter(id => actual(id)).length;
        if(!confirm(`Se van a restaurar ${ids.length} memoria${ids.length === 1 ? '' : 's'}${reemp ? ` (${reemp} se reemplaza${reemp === 1 ? '' : 'n'}; su estado actual queda en el historial)` : ''}${cfg ? ' y la configuración' : ''}. ¿Continuar?`)) return;
        const lg = $('#rrLog', md), b = $('#rrIr', md); lg.hidden = false; lg.textContent = ''; b.disabled = true;
        const log = t => { lg.textContent += t + '\n'; lg.scrollTop = lg.scrollHeight; };
        try{ const malos = await restaurarRespaldo(R, files, ids, cfg, log);
          log(malos ? `Terminado con ${malos} problema${malos > 1 ? 's' : ''} (ver arriba).` : 'Listo. Todo restaurado.');
          S.m = null; await cargarBase(); if(!malos) setTimeout(() => { cerrar(); renderLista(); }, 1500); else renderLista(); }
        catch(e){ log('⚠ ' + (e.message || e)); b.disabled = false; }
      };
    }catch(e){ cont.innerHTML = `<div class="note red">${esc(e.message || e)}</div>`; }
  };
}
async function restaurarRespaldo(R, files, ids, cfg, log){
  let malos = 0;
  const subirZip = async ruta => { const u8 = files['archivos/' + ruta]; if(!u8) return;
    const { error } = await sb.storage.from(BUCKET).upload(ruta, new Blob([u8], { type:tipoDe(ruta) }), { upsert:true, contentType:tipoDe(ruta), cacheControl:'60' });
    if(error){ malos++; log(`  ⚠ archivo ${ruta.split('/').pop()}: ${error.message}`); } else delete S.urls[ruta]; };
  const rutasDe = pre => Object.keys(files).filter(k => k.startsWith(`archivos/${pre}/`)).map(k => k.slice(9));
  if(cfg){
    log('Configuración y perfiles…');
    if(R.perfiles?.length){ const { error } = await sb.from('mem_perfiles_pie').upsert(R.perfiles); if(error){ malos++; log('  ⚠ perfiles: ' + error.message); } }
    if(R.config){ const c = { ...R.config }; delete c.id; delete c.updated_at; const { error } = await sb.from('mem_config').update(c).eq('id', 1); if(error){ malos++; log('  ⚠ configuración: ' + error.message); } }
    for(const r of [...rutasDe('config'), ...rutasDe('biblioteca')]) await subirZip(r);
  }
  const { data:pfs } = await sb.from('mem_perfiles_pie').select('id'); const hayPf = new Set((pfs || []).map(p => p.id));
  for(const id of ids){
    const m = R.memorias.find(x => x.id === id); if(!m) continue;
    log(`${m.consecutivo} — ${m.titulo || ''}`);
    try{
      const existe = S.mems.some(x => x.id === id);
      if(existe){ const { error } = await sb.rpc('mem_guardar_version', { mid:id, motivo:'antes de restaurar respaldo' }); if(error) throw error; }
      const fila = { ...m }; delete fila.updated_at;
      if(fila.perfil_id && !hayPf.has(fila.perfil_id)) fila.perfil_id = null;
      const { error:e1 } = await sb.from('mem_memorias').upsert(fila); if(e1) throw e1;
      const revs = (R.revisiones || []).filter(r => r.memoria_id === id);
      const { error:e2 } = await sb.from('mem_revisiones').delete().eq('memoria_id', id); if(e2) throw e2;
      if(revs.length){ const { error:e3 } = await sb.from('mem_revisiones').insert(revs); if(e3) throw e3; }
      const rr = rutasDe(id); for(const r of rr) await subirZip(r);
      log(`  ✓ datos${revs.length ? `, ${revs.length} revisiones` : ''}${rr.length ? `, ${rr.length} archivos` : ''}`);
    }catch(e){ malos++; log(`  ⚠ ${e.message || e}${/consecutivo/.test(e.message || '') ? ' (ya hay otra memoria con ese consecutivo)' : ''}`); }
  }
  return malos;
}
