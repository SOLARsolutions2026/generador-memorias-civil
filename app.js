/* ═══════════════════════════════════════════════════════════════
   Generador de Memorias de Cálculo — P. Electric S.A.S.
   App sin compilación: HTML + JS. Datos en Supabase (pelectric-apps).
   Tablas: mem_usuarios, mem_config, mem_perfiles_pie, mem_memorias, mem_revisiones
   Archivos: bucket privado "memorias" → <memoria_id>/modelo3d.jpg · config/firma.png
   ═══════════════════════════════════════════════════════════════ */
'use strict';
const CFG = window.APP_CONFIG;
const sb = supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY);
const BUCKET = CFG.BUCKET;
const CAP_MB = 1024;               // espacio de archivos del plan gratuito
const TITULO_DEF = 'MEMORIA DE CÁLCULO ESTRUCTURA METÁLICA';

// Estado de la app (lo que está cargado en memoria)
const S = { user:null, rol:'consulta', cfg:null, perfiles:[], mems:[], m:null, revs:[], editPerfil:null, urls:{} };
const esIng = () => S.rol === 'ingeniero';

// ─── Utilidades ───
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Nombre del programa de análisis que sale en lo impreso (Configuración; por licencia no se nombra el programa)
const SW_DEF = 'software de análisis estructural';
const swNom = () => (S.cfg?.software || '').trim() || SW_DEF;
const enSw = () => { const n = swNom(); return /^[a-záéíóúñ]/.test(n) ? 'un ' + n : n; };   // «en un software…» / «en ETABS»
const pill = (st, t) => `<span class="pill ${st}">${t}</span>`;
const hoyISO = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset()*60000).toISOString().slice(0,10); };
const fmtFecha = iso => iso ? iso.slice(0,10).split('-').reverse().join('/') : '';
function toast(m, ms=2600){ const t=$('#toast'); t.textContent=m; t.hidden=false; clearTimeout(toast.h); toast.h=setTimeout(()=>t.hidden=true, ms); }
function err(e, pre='Error'){ console.error(e); toast(`${pre}: ${e?.message || e}`, 4500); }
const debounce = (fn, ms) => { let h; const d=(...a)=>{ clearTimeout(h); d.pend=()=>{ clearTimeout(h); d.pend=null; return fn(...a); }; h=setTimeout(d.pend, ms); }; return d; };
const ESTADOS = { wip:['wip','En proceso'], apr:['ok','Aprobada'], arch:['arch','Archivada en NAS'] };

// URL temporal (firmada) para ver archivos privados del bucket
async function urlDe(path){
  if(!path) return null;
  const c = S.urls[path]; if(c && c.exp > Date.now()) return c.url;
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600);
  if(error){ console.warn(error); return null; }
  S.urls[path] = { url:data.signedUrl, exp:Date.now()+50*60000 };
  return data.signedUrl;
}
// Reduce la imagen antes de subirla (ahorra espacio en el plan gratuito)
async function comprimir(file, { max=2000, type='image/jpeg', q=0.85 }={}){
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width*s); c.height = Math.round(bmp.height*s);
  const x = c.getContext('2d');
  if(type === 'image/jpeg'){ x.fillStyle='#fff'; x.fillRect(0,0,c.width,c.height); }
  x.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(r, type, q));
}
async function subir(path, blob, type){
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { upsert:true, contentType:type, cacheControl:'60' });
  if(error) throw error;
  delete S.urls[path];
}
function elegirArchivo(accept){
  return new Promise(res => { const i=document.createElement('input'); i.type='file'; i.accept=accept; i.onchange=()=>res(i.files[0]||null); i.click(); });
}

// ═══ INICIO DE SESIÓN ═══
function renderLogin(msg=''){
  $('#userbox').hidden = true;
  $('#app').innerHTML = `<div class="login"><div class="card">
    <h2>Iniciar sesión</h2><p class="lead" style="margin-bottom:14px">Usa el correo y la contraseña que te asignó el ingeniero.</p>
    <form id="fLogin">
      <div class="f"><label for="lEmail">Correo</label><input id="lEmail" type="email" autocomplete="username" required/></div>
      <div class="f"><label for="lPass">Contraseña</label><input id="lPass" type="password" autocomplete="current-password" required/></div>
      <button class="btn pri" type="submit" style="width:100%;margin-top:4px">Entrar</button>
      <div class="err" id="lErr">${esc(msg)}</div>
    </form>
    <button class="btn sm" type="button" id="lOlvido" style="margin-top:12px">¿Olvidaste la contraseña?</button>
  </div></div>`;
  $('#fLogin').onsubmit = async e => {
    e.preventDefault(); $('#lErr').textContent = 'Entrando…';
    const { error } = await sb.auth.signInWithPassword({ email:$('#lEmail').value.trim(), password:$('#lPass').value });
    if(error){ $('#lErr').textContent = error.message.includes('Invalid') ? 'Correo o contraseña incorrectos.' : error.message; return; }
    boot();
  };
  $('#lOlvido').onclick = async () => {
    const email = $('#lEmail').value.trim();
    if(!email){ $('#lErr').textContent = 'Escribe primero tu correo.'; return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    $('#lErr').textContent = error ? error.message : 'Te enviamos un correo para crear una contraseña nueva.';
  };
}
function renderNuevaClave(){
  $('#app').innerHTML = `<div class="login"><div class="card"><h2>Nueva contraseña</h2>
    <form id="fClave"><div class="f" style="margin-top:12px"><label for="nPass">Contraseña nueva (mínimo 8 caracteres)</label><input id="nPass" type="password" minlength="8" autocomplete="new-password" required/></div>
    <button class="btn pri" type="submit" style="width:100%">Guardar</button><div class="err" id="nErr"></div></form></div></div>`;
  $('#fClave').onsubmit = async e => {
    e.preventDefault();
    const { error } = await sb.auth.updateUser({ password:$('#nPass').value });
    if(error){ $('#nErr').textContent = error.message; return; }
    toast('Contraseña actualizada.'); location.hash = '#/'; boot();
  };
}

async function boot(){
  const { data:{ session } } = await sb.auth.getSession();
  if(!session) return renderLogin();
  S.user = session.user;
  try{ await cargarBase(); }catch(e){ return err(e, 'No se pudieron cargar los datos'); }
  $('#userbox').hidden = false;
  $('#btnCfg').hidden = !esIng();
  route();
}
async function cargarBase(){
  const [u, c, p] = await Promise.all([
    sb.from('mem_usuarios').select('rol').eq('user_id', S.user.id).maybeSingle(),
    sb.from('mem_config').select('*').eq('id', 1).maybeSingle(),
    sb.from('mem_perfiles_pie').select('*').order('nombre'),
  ]);
  for(const r of [u,c,p]) if(r.error) throw r.error;
  S.rol = u.data?.rol || 'consulta';
  S.cfg = c.data || {};
  S.perfiles = p.data || [];
}

// ═══ NAVEGACIÓN (por la dirección #/...) ═══
// #/  → lista · #/config → configuración · #/m/<id>/<paso> → memoria
async function route(){
  if(!S.user) return;
  await guardarPendientes();
  document.body.classList.remove('notas-on');
  const h = location.hash.replace(/^#\/?/, '').split('/');
  window.scrollTo({ top:0 });
  if(h[0] === 'config' && esIng()) return renderConfig();
  if(h[0] === 'm' && h[1]) return abrirMemoria(h[1], h[2] || (esIng() ? 'ficha' : 'portada'));
  return esIng() ? renderLista() : renderConsulta();
}
window.addEventListener('hashchange', route);
const ir = h => { if(location.hash === h) route(); else location.hash = h; };

// ═══ LISTA DE MEMORIAS (ingeniero) ═══
async function cargarMemorias(){
  const { data, error } = await sb.from('mem_memorias').select('id,consecutivo,titulo,estado,ficha,imagen_path,paquete,archivada_en,created_at,updated_at').order('created_at', { ascending:false });
  if(error) throw error;
  S.mems = data;
}
// Lista todos los archivos de una carpeta del bucket, incluidas sus subcarpetas
async function archivosDe(prefijo){
  const { data, error } = await sb.storage.from(BUCKET).list(prefijo, { limit:1000 });
  if(error || !data) return [];
  let out = [];
  for(const o of data){
    const ruta = `${prefijo}/${o.name}`;
    if(o.id === null || !o.metadata) out = out.concat(await archivosDe(ruta)); // es una subcarpeta
    else out.push({ ruta, size:o.metadata.size || 0 });
  }
  return out;
}
async function tamanoCarpeta(prefijo){ return (await archivosDe(prefijo)).reduce((a, f) => a + f.size, 0); }
async function renderLista(){
  $('#app').innerHTML = '<p class="muted">Cargando memorias…</p>';
  try{ await cargarMemorias(); }catch(e){ return err(e); }
  const tam = await Promise.all(S.mems.map(m => tamanoCarpeta(m.id)));
  const tamCfg = (await tamanoCarpeta('config')) + (await tamanoCarpeta('biblioteca'));
  const MB = b => b / 1048576;
  const usado = MB(tam.reduce((a,b)=>a+b,0) + tamCfg), pct = usado / CAP_MB * 100;
  const cols = ['#1a56db','#10b981','#a855f7','#f59e0b'];
  const acts = m => {
    const [c,t] = ESTADOS[m.estado] || ESTADOS.wip;
    let b = pill(c, t);
    if(m.estado === 'wip') b += `<button class="btn sm danger" type="button" data-borrar="${m.id}" aria-label="Eliminar memoria">Eliminar</button><button class="btn sm pri" type="button" data-go="#/m/${m.id}/ficha">Continuar</button>`;
    else if(m.estado === 'apr') b += `<button class="btn sm" type="button" data-go="#/m/${m.id}/portada">Portada</button><button class="btn sm" type="button" data-go="#/m/${m.id}/ficha">Abrir</button>`;
    else b += `<button class="btn sm" type="button" data-go="#/m/${m.id}/ficha">Ver ficha</button>`;
    return b;
  };
  $('#app').innerHTML = `
  <div class="main-hd"><div><h2>Memorias de cálculo</h2><p class="lead">Las memorias en ejecución viven en la app. Cuando una esté aprobada, la archivas en el NAS y se libera su espacio; su ficha queda en la lista.</p></div>
    <div class="nav-btns"><button class="btn pri" type="button" id="nueva">+ Nueva memoria</button></div></div>
  <div class="card"><div class="ct">Espacio de archivos en la app${pill(pct>=80?'no':pct>=60?'pend':'ok', `${usado.toFixed(1)} MB de 1 GB · ${pct.toFixed(1)} %`)}</div>
    <div class="store"><div class="bar2">${S.mems.map((m,k)=> tam[k] ? `<i style="width:${MB(tam[k])/CAP_MB*100}%;background:${cols[k%4]}" title="${esc(m.consecutivo)}"></i>` : '').join('')}</div></div>
    <div class="hint" style="margin-top:6px">Al llegar al 80 % archiva en el NAS las memorias aprobadas para liberar espacio.</div></div>
  <div class="mlist">${S.mems.length ? S.mems.map((m,k) => {
      const f = m.ficha || {};
      const lugar = [f.mun, f.depto].filter(Boolean).join(', ');
      return `<div class="mi"><div><div class="code">${esc(m.consecutivo)}</div><div class="nm">${esc(m.titulo || 'Sin nombre')}</div>
        <div class="meta">${esc(lugar || 'Sin ubicación')} · ${esc(f.prop || 'Sin propietario')} · ${m.estado==='arch' ? `archivada ${fmtFecha(m.archivada_en)}${m.paquete?` · ${esc(m.paquete)}`:''}` : `${MB(tam[k]).toFixed(1)} MB en la app`} · editada ${fmtFecha(m.updated_at)}</div></div>
        <div class="acts">${acts(m)}</div></div>`; }).join('')
    : '<div class="card empty">Todavía no hay memorias. Crea la primera con <b>+ Nueva memoria</b>.</div>'}</div>`;
  $('#nueva').onclick = nuevaMemoria;
  $$('[data-go]').forEach(b => b.onclick = () => ir(b.dataset.go));
  $$('[data-borrar]').forEach(b => b.onclick = () => borrarMemoria(S.mems.find(m => m.id === b.dataset.borrar)));
}
async function borrarMemoria(m){
  if(!m || !confirm(`¿Eliminar ${m.consecutivo} con sus revisiones e imágenes? No se puede deshacer.`)) return;
  try{
    const arch = await archivosDe(m.id);
    if(arch.length) await sb.storage.from(BUCKET).remove(arch.map(f => f.ruta));
    const { error } = await sb.from('mem_memorias').delete().eq('id', m.id);
    if(error) throw error;
    if(S.m?.id === m.id) S.m = null;
    toast(`${m.consecutivo} eliminada.`); renderLista();
  }catch(e){ err(e, 'No se pudo eliminar'); }
}

async function nuevaMemoria(){
  const btn = $('#nueva'); btn.disabled = true;
  try{
    const d = new Date(), p2 = n => String(n).padStart(2,'0');
    const base = `${S.cfg.prefijo || 'DOC-MEM'}-${p2(d.getDate())}-${p2(d.getMonth()+1)}-${String(d.getFullYear()).slice(-2)}`;
    const { data:ex, error:e1 } = await sb.from('mem_memorias').select('consecutivo').like('consecutivo', base + '%');
    if(e1) throw e1;
    const usados = new Set(ex.map(x => x.consecutivo));
    let cons = base, n = 2; while(usados.has(cons)) cons = `${base}-${n++}`;
    const perfil = S.perfiles.find(x => x.predeterminado) || S.perfiles[0];
    const hoy = hoyISO();
    const { data:m, error } = await sb.from('mem_memorias').insert({
      consecutivo:cons, titulo:'Nueva memoria', perfil_id:perfil?.id || null,
      ficha:{ tipo:'empresa', docTipo:'NIT', fecha:hoy, titulo_doc:TITULO_DEF },
    }).select().single();
    if(error) throw error;
    await sb.from('mem_revisiones').insert({ memoria_id:m.id, rev:0, fecha:hoy, descripcion:'Emisión inicial', elaboro:S.cfg.iniciales || '', reviso:'', aprobo:'' });
    toast(`Memoria ${cons} creada.`);
    ir(`#/m/${m.id}/ficha`);
  }catch(e){ err(e, 'No se pudo crear'); btn.disabled = false; }
}

// ═══ VISTA DE CONSULTA (resto de la empresa) ═══
async function renderConsulta(){
  $('#app').innerHTML = '<p class="muted">Cargando…</p>';
  try{ await cargarMemorias(); }catch(e){ return err(e); }
  const lista = S.mems.filter(m => m.estado !== 'wip');
  $('#app').innerHTML = `<div class="main-hd"><div><h2>Memorias aprobadas</h2><p class="lead">Consulta y descarga. Las memorias archivadas indican el paquete que se debe buscar en el NAS.</p></div>
    <div class="f" style="min-width:240px"><label for="q">Buscar</label><input id="q" placeholder="Proyecto, municipio o consecutivo"/></div></div>
    <div class="card"><div class="tw"><table class="t"><thead><tr><th>Consecutivo</th><th>Proyecto</th><th>Municipio</th><th>Estado</th><th></th></tr></thead><tbody id="tb"></tbody></table></div></div>`;
  const pintar = () => {
    const q = $('#q').value.toLowerCase();
    const f = lista.filter(m => [m.consecutivo, m.titulo, m.ficha?.mun, m.ficha?.prop].join(' ').toLowerCase().includes(q));
    $('#tb').innerHTML = f.length ? f.map(m => `<tr><td><b>${esc(m.consecutivo)}</b></td><td>${esc(m.titulo)}</td><td>${esc(m.ficha?.mun || '')}</td>
      <td>${pill(...ESTADOS[m.estado])}</td><td>${m.estado==='arch' ? `<span class="hint">En el NAS: <b>${esc(m.paquete || m.consecutivo + '_paquete.zip')}</b></span>` : `<button class="btn sm" type="button" data-go="#/m/${m.id}/portada">Ver portada</button>`}</td></tr>`).join('')
      : '<tr><td colspan="5" class="hint">No hay memorias aprobadas todavía.</td></tr>';
    $$('[data-go]').forEach(b => b.onclick = () => ir(b.dataset.go));
  };
  $('#q').oninput = pintar; pintar();
}

// ═══ ESPACIO DE TRABAJO DE UNA MEMORIA ═══
const STEPS = [
  { id:'ficha',      ph:'Proyecto',   n:'0', t:'Ficha del proyecto',      s:'Propietario, proyecto, ubicación' },
  { id:'revisiones', ph:'Proyecto',   n:'1', t:'Control de revisiones',   s:'Tabla de la portada' },
  { id:'portada',    ph:'Proyecto',   n:'2', t:'Portada',                 s:'Vista previa e impresión' },
  { id:'A',  ph:'Cálculos',   n:'A', t:'Anexo A — Cargas',        s:'Muerta, viva y viento' },
  { id:'B',  ph:'Cálculos',   n:'B', t:'Anexo B — FHE',           s:'Análisis sísmico' },
  { id:'K',  ph:'Cálculos',   n:'∑', t:'Combinaciones',           s:'Irregularidades y NSR-10 B.2' },
  { id:'C',  ph:'Cálculos',   n:'C', t:'Anexo C — Modelo',        s:'Datos y resultados' },
  { id:'D',  ph:'Cálculos',   n:'D', t:'Anexo D — Elementos',     s:'Metálicos y concreto' },
  { id:'E',  ph:'Cálculos',   n:'E', t:'Anexo E — Conexiones',    s:'Próximamente', off:1 },
  { id:'FG', ph:'Documentos', n:'F', t:'Planos y suelos',         s:'Próximamente', off:1 },
  { id:'gen',ph:'Documentos', n:'✓', t:'Generar PDF final',       s:'Próximamente', off:1 },
];
async function abrirMemoria(id, paso){
  if(!S.m || S.m.id !== id){
    $('#app').innerHTML = '<p class="muted">Abriendo memoria…</p>';
    const [m, r] = await Promise.all([
      sb.from('mem_memorias').select('*').eq('id', id).maybeSingle(),
      sb.from('mem_revisiones').select('*').eq('memoria_id', id).order('rev'),
    ]);
    if(m.error || !m.data){ toast('No se encontró la memoria.'); return ir('#/'); }
    S.m = m.data; S.m.ficha = S.m.ficha || {}; S.revs = r.data || [];
  }
  if(!esIng()) paso = 'portada';
  renderWS(STEPS.some(s => s.id === paso && !s.off) ? paso : 'ficha');
}
function renderWS(cur){
  const m = S.m, pasos = esIng() ? STEPS : STEPS.filter(s => s.id === 'portada');
  const st = estadoPaso;
  let ph = '', side = '';
  pasos.forEach(s => { if(s.ph !== ph){ ph = s.ph; side += `<div class="ph">${ph}</div>`; }
    side += `<button type="button" class="step ${s.id===cur?'on':''}" data-step="${s.id}" ${s.off?'disabled':''}><span class="dot ${st(s)}">${st(s)==='ok'?'✓':s.n}</span><span class="lbl">${s.t}<small>${s.s}</small></span><span class="ydot" ${notasPend(s.id) ? '' : 'hidden'} title="Tiene observaciones pendientes"></span></button>`; });
  const s = pasos.find(x => x.id === cur), activos = pasos.filter(x => !x.off), i = activos.indexOf(s);
  $('#app').innerHTML = `
  <div style="margin-bottom:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn sm" type="button" id="back">← Memorias</button>
    <span class="hint"><b>${esc(m.consecutivo)}</b> · ${esc(m.titulo || '')}</span><span class="sp" style="flex:1"></span><span class="saved" id="saved"></span></div>
  <div class="mbar"><div class="mi2"><small>Paso ${s.n}</small><b>${s.t}</b></div>
    <button type="button" class="hamb" id="openSteps" aria-label="Ver todos los pasos"><span class="ln"><i></i><i></i><i></i></span>Pasos</button></div>
  <div class="scrim" id="scrim" hidden></div>
  <div class="ws"><nav class="steps" id="stepsNav" aria-label="Pasos"><div class="drawer-hd"><b>Pasos de la memoria</b><button type="button" id="closeSteps" aria-label="Cerrar">✕</button></div>${side}</nav>
  <section><div class="main-hd"><div><div class="hint" style="font-weight:700;text-transform:uppercase;letter-spacing:1px">Paso ${s.n} · ${pill(...(ESTADOS[m.estado]||ESTADOS.wip))}</div><h2>${s.t}</h2></div>
    <div class="hd-r"><div class="nav-btns" id="hdActs"></div><div class="nav-btns">${activos.length>1?`<button class="btn" type="button" id="prev" ${i<=0?'disabled':''}>← Anterior</button><button class="btn pri" type="button" id="next" ${i>=activos.length-1?'disabled':''}>Siguiente →</button>`:''}</div>
      <div class="hd-pop" id="hdPop" hidden></div></div></div>
    <div id="pane"></div></section></div>
  ${esIng() ? `<button type="button" class="notas-tab" id="notasTab" aria-label="Observaciones"><span>📝 Observaciones</span><b id="notasN"></b></button>
  <aside class="notas-dr" id="notasDr" aria-label="Observaciones" hidden></aside>` : ''}`;
  $('#back').onclick = () => ir('#/');
  const nav = $('#stepsNav'), scr = $('#scrim');
  const abrir = () => { nav.classList.add('open'); scr.hidden = false; }, cerrar = () => { nav.classList.remove('open'); scr.hidden = true; };
  $('#openSteps').onclick = abrir; $('#closeSteps').onclick = cerrar; scr.onclick = cerrar;
  $$('[data-step]').forEach(b => b.onclick = () => ir(`#/m/${m.id}/${b.dataset.step}`));
  if($('#prev')){ $('#prev').onclick = () => ir(`#/m/${m.id}/${activos[i-1].id}`); $('#next').onclick = () => ir(`#/m/${m.id}/${activos[i+1].id}`); }
  S.paso = cur; PANES[cur](); pintarListo(); pintarNotas();
}
const pane = h => $('#pane').innerHTML = h;
function fichaCompleta(){ const f = S.m.ficha; return ['prop','doc','proyecto','dir','mun','depto'].every(k => (f[k]||'').trim()); }

// ─── Guardado automático ───
function marcaGuardado(estado){ const el = $('#saved'); if(!el) return;
  el.className = 'saved ' + (estado==='ok'?'ok':estado==='err'?'err':'');
  el.textContent = estado==='ok' ? 'Guardado ✓' : estado==='err' ? 'Error al guardar — revisa la conexión' : 'Guardando…'; }
const guardarMemoria = debounce(async () => {
  const m = S.m; if(!m) return;
  marcaGuardado('...');
  const { error } = await sb.from('mem_memorias').update({ ficha:m.ficha, anexos:m.anexos || {}, titulo:(m.ficha.proyecto||'').trim() || 'Sin nombre', perfil_id:m.perfil_id, estado:m.estado }).eq('id', m.id);
  marcaGuardado(error ? 'err' : 'ok'); if(error) console.error(error);
  else m.titulo = (m.ficha.proyecto||'').trim() || 'Sin nombre';
  pintarListo();
}, 700);
async function guardarPendientes(){ for(const d of [guardarMemoria, guardarPerfil, guardarCfg]) if(d.pend) await d.pend(); }
window.addEventListener('beforeunload', e => { if(guardarMemoria.pend || guardarPerfil.pend || guardarCfg.pend){ guardarPendientes(); e.preventDefault(); } });

// ─── Datos para la portada ───
const perfilDe = m => S.perfiles.find(p => p.id === m.perfil_id) || S.perfiles.find(p => p.predeterminado) || S.perfiles[0] || {};
function tituloArchivo(f){
  if((f.titulo_archivo||'').trim()) return f.titulo_archivo.trim();
  const p = (f.proyecto||'').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Z0-9Ñ ]+/g,' ').trim().replace(/\s+/g,'_');
  if(!p) return 'MEMORIA-CALCULO-ESTRUCTURA';
  return 'MEMORIA-CALCULO-' + (p.startsWith('ESTRUCTURA') ? p : 'ESTRUCTURA-' + p);
}
function filasDatos(f, imprimir){
  const v = (x, ph) => (x||'').trim() ? esc(x.trim()) : (imprimir ? '—' : `<span class="ph">[${ph}]</span>`);
  const emp = f.tipo !== 'natural';
  const ub = [f.dir, f.lote && 'Lote ' + f.lote, f.mz && 'Mz ' + f.mz, [f.mun, f.depto].filter(Boolean).join(', ')].filter(x => (x||'').trim()).join(' · ');
  return [
    ['Propietario / cliente', v(f.prop, emp ? 'Razón social' : 'Nombre completo')],
    [esc(f.docTipo || (emp ? 'NIT' : 'C.C.')), v(f.doc, 'Número de identificación')],
    ...(emp ? [['Representante legal', v(f.rep, 'Nombre del representante')]] : []),
    ['Dirección de correspondencia', v(f.dirCorr, 'Dirección')],
    ['Teléfono · correo', v(f.tel, 'Teléfono') + ' · ' + v(f.mail, 'Correo')],
    ['Proyecto', v(f.proyecto, 'Nombre exacto del proyecto')],
    ['Ubicación', ub ? esc(ub) : v('', 'Dirección, lote, manzana, municipio')],
    ['Matrícula inmobiliaria · N° predial', v(f.matricula, 'Matrícula') + ' · ' + v(f.predial, 'N° predial')],
  ];
}
function filasRevision(){
  const r = S.revs.slice(-5).map(x => [x.rev ?? '', fmtFecha(x.fecha), x.descripcion, x.elaboro, x.reviso || '—', x.aprobo || '—']);
  while(r.length < 3) r.push(['','','','','','']);
  return r;
}
function pieHTML(p, cls='pfoot', ncls='pn'){
  const l = [p.l1, p.l2, p.correo && 'CORREO: ' + p.correo, p.dir && 'DIR: ' + p.dir, p.tel && 'TEL: ' + p.tel, p.ciudad].filter(x => (x||'').trim());
  return `<div class="${cls}">${l.map(esc).join('<br/>')}<span class="${ncls}">1</span></div>`;
}
const datosHTML = (f, imprimir) => `<div class="tt">Datos del propietario y del proyecto</div>
  <table class="dt">${filasDatos(f, imprimir).map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table>`;
const revHTML = () => `<div class="tt">Control de revisiones</div>
  <table class="rv"><tr><th style="width:7%">Rev.</th><th style="width:14%">Fecha</th><th>Descripción de la modificación</th><th style="width:11%">Elaboró</th><th style="width:11%">Revisó</th><th style="width:11%">Aprobó</th></tr>
  ${filasRevision().map(r => '<tr>' + r.map(c => `<td>${esc(c)}</td>`).join('') + '</tr>').join('')}</table>`;
const tablasHTML = (f, imprimir) => datosHTML(f, imprimir) + revHTML();
function portadaHTML(imprimir, urlImg, urlFirma){
  const m = S.m, f = m.ficha, c = S.cfg, ta = tituloArchivo(f);
  return `<div class="pg">
    <div class="hd"><span>${esc(m.consecutivo)}</span><span>${esc(ta)}</span></div>
    <h1>${esc(f.titulo_doc || TITULO_DEF)}</h1>
    <div class="img">${urlImg ? `<img src="${esc(urlImg)}" alt="Modelo 3D"/>` : (imprimir ? '' : 'Imagen del modelo 3D — se sube en la ficha')}</div>
    ${tablasHTML(f, imprimir)}
    <div class="firma">${urlFirma ? `<img src="${esc(urlFirma)}" alt="Firma"/>` : '<div class="sinfirma"></div>'}
      <div class="ln">${esc(c.nombre_firma || '')}<br/>${esc(c.matricula || '')}</div>
      <div class="code">${esc(m.consecutivo)}_ ${esc(ta)}</div></div>
    ${pieHTML(perfilDe(m), 'ft', 'n')}
  </div>`;
}

// Sube la imagen de portada de la memoria abierta (se usa en la ficha y en la portada)
async function subirPortada(file, luego){
  const m = S.m;
  try{
    toast('Subiendo imagen…', 15000);
    const blob = await comprimir(file, { max:2000, type:'image/jpeg', q:0.85 });
    const path = `${m.id}/modelo3d.jpg`;
    await subir(path, blob, 'image/jpeg');
    if(m.imagen_path !== path){ const { error } = await sb.from('mem_memorias').update({ imagen_path:path }).eq('id', m.id); if(error) throw error; m.imagen_path = path; }
    toast(`Imagen guardada (${(blob.size/1024).toFixed(0)} KB).`); luego && luego();
  }catch(e){ err(e, 'No se pudo subir la imagen'); }
}

// ═══ Anexo terminado: revisión de datos + botón «Marcar como terminado» ═══
// Al marcar se guarda una huella de los datos; si después cambian, el anexo vuelve a «en proceso» solo.
function huella(...objs){
  const limpio = v => Array.isArray(v) ? v.map(limpio) : v && typeof v === 'object'
    ? Object.keys(v).sort().filter(k => !['listo','listoFecha'].includes(k) && !k.startsWith('_') && v[k] !== '' && v[k] != null).reduce((o, k) => (o[k] = limpio(v[k]), o), {}) : v;
  const t = JSON.stringify(objs.map(limpio)); let h = 5381;
  for(let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + '-' + t.length;
}
const ANEXOS_LISTO = {
  A: { n:'Anexo A', huella: an => huella(an.A), faltan(an){
    if(!an.A) return ['datos del anexo'];
    const A = an.A, R = AnexoA.calcular(A), f = [];
    if(!A.tipo?.paneles && !A.tipo?.lamina) f.push('escoger paneles o cubierta');
    if(!R.viento.ok) f.push('geometría para el viento: ' + R.viento.faltan.join(', '));
    return f; } },
  B: { n:'Anexo B', huella: an => huella(an.B, an.A), faltan(an){
    if(!an.B) return ['datos del anexo'];
    if(an.B.aplica === false) return [];
    const R = calcB(); return R.ok ? [] : R.faltan; } },
  K: { n:'paso de combinaciones', huella: an => huella(an.K, an.B?.aplica), faltan(an){
    if(!an.K) return ['datos del paso'];
    const R = Combos.calcular(an.K, an.B?.aplica !== false), f = [];
    if(an.B?.aplica !== false && !(R.R.R > 0)) f.push('R0 del sistema estructural');
    if(R.faltaPat.length) f.push('nombre del patrón en el modelo para ' + R.faltaPat.join(', '));
    return f; } },
  D: { n:'Anexo D', huella: an => { const sin = l => (l || []).map(e => ({ ...e, res:undefined })); return huella(sin(an.D?.met), sin(an.D?.zap), sin(an.D?.ped), an.D?.cServ, an.D?.cRes, an.C?.archivo?.fecha, an.C?.modelo?.fuerzas?.res); }, faltan(an){
    const met = an.D?.met || [], f = [];
    if(!met.length && !an.D?.zap?.length && !an.D?.ped?.length) f.push('elementos');
    for(const e of [...met, ...(an.D?.zap || []), ...(an.D?.ped || [])]){ if(!e.res?.ok) f.push(`${e.nom}: ${e.res?.error || 'sin calcular'}`); else if(!e.res.cumple) f.push(e.res.ratio > 1 ? `${e.nom} no cumple (relación ${e.res.ratio})` : `${e.nom} no cumple un requisito (separación, núcleo, esbeltez o anclaje)`); }
    return f; } },
  C: { n:'Anexo C', huella: an => huella(an.C), faltan(an){
    const C = an.C, f = [];
    if(!C?.modelo) f.push('archivo del modelo (.$2k)');
    if(!C?.img) f.push('imagen del modelo');
    return f; } },
};
function estadoAnexo(id){
  const an = S.m?.anexos || {}, X = an[id], D = ANEXOS_LISTO[id];
  if(!X) return '';
  if(id === 'B' && X.aplica === false) return 'ok';
  return X.listo && X.listo === D.huella(an) ? 'ok' : 'wip';
}
function estadoPaso(s){
  if(s.off) return '';
  if(s.id === 'ficha') return fichaCompleta() ? 'ok' : 'wip';
  if(s.id === 'revisiones') return S.revs.length ? 'ok' : 'wip';
  return ANEXOS_LISTO[s.id] ? estadoAnexo(s.id) : '';
}
// Botones de la cabecera de cada anexo: «Imprimir anexo» y «Marcar terminado» (siempre arriba, en el mismo sitio)
const IMPRIME = { A:() => imprimirA(), B:() => imprimirB(), C:() => imprimirC(datosC()), D:() => imprimirD() };
function puedeImprimir(id){ const an = S.m?.anexos || {};
  return id === 'A' ? true : id === 'B' ? an.B?.aplica !== false : id === 'C' ? !!an.C?.modelo : id === 'D' ? ['met','zap','ped'].some(k => an.D?.[k]?.length) : false; }
function pintarListo(){
  const box = $('#hdActs'); if(!box || !S.m) return;
  // puntos de la barra lateral
  $$('[data-step]').forEach(b => { const s = STEPS.find(x => x.id === b.dataset.step), d = b.querySelector('.dot'); if(!s || !d) return;
    const e = estadoPaso(s); d.className = 'dot ' + e; d.textContent = e === 'ok' ? '✓' : s.n; });
  const id = S.paso, D = ANEXOS_LISTO[id], pop = $('#hdPop');
  let h = '';
  if(IMPRIME[id] && puedeImprimir(id)) h += `<button class="btn" type="button" id="hdPrint">🖨 Imprimir anexo${id === 'C' ? ' ▾' : ''}</button>`;
  let est = null, f = [], X = {};
  if(D && esIng() && !(id === 'B' && S.m.anexos?.B?.aplica === false)){
    const an = S.m.anexos || {}; X = an[id] || {}; f = D.faltan(an); est = estadoAnexo(id);
    h += est === 'ok' ? `<button class="btn grn" type="button" id="hdListo" title="Terminado">✓ Terminado</button>`
      : f.length ? `<button class="btn hd-falta" type="button" id="hdListo" title="Faltan datos">✓ Marcar terminado <span class="hd-n">${f.length}</span></button>`
      : `<button class="btn grn-o" type="button" id="hdListo">✓ Marcar terminado</button>`;
  }
  box.innerHTML = h;
  if(pop && !pop.hidden && pop.dataset.para && !$('#' + pop.dataset.para)) pop.hidden = true;
  const abrir = (para, html) => { if(!pop.hidden && pop.dataset.para === para){ pop.hidden = true; return; } pop.dataset.para = para; pop.innerHTML = html; pop.hidden = false; };
  const pr = $('#hdPrint');
  if(pr) pr.onclick = () => {
    if(id !== 'C') return IMPRIME[id]();
    const C = datosC();
    abrir('hdPrint', `<b>Opciones de impresión</b><p class="hint" style="margin:4px 0 8px">En la memoria salen los resúmenes. Las tablas completas (cada nudo, cada elemento y cada carga) son opcionales y ocupan varias páginas.</p>
      <label class="chk"><input type="checkbox" id="compC" ${C.completas ? 'checked' : ''} ${esIng() ? '' : 'disabled'}/> Incluir también las tablas completas</label>
      <div style="margin-top:10px"><button class="btn grn sm" type="button" id="hdPrintGo">🖨 Imprimir / Guardar PDF</button></div>`);
    const cc = $('#compC'); if(cc) cc.onchange = e => { C.completas = e.target.checked; guardarMemoria(); };
    const go = $('#hdPrintGo'); if(go) go.onclick = () => { pop.hidden = true; IMPRIME.C(); };
  };
  const bl = $('#hdListo'); if(!bl) return;
  const fecha = X.listoFecha ? new Date(X.listoFecha).toLocaleString('es-CO', { dateStyle:'medium', timeStyle:'short' }) : '';
  bl.onclick = () => {
    const an2 = S.m.anexos, Y = an2[id] = an2[id] || {};
    if(est === 'ok') return abrir('hdListo', `<b>${D.n[0].toUpperCase() + D.n.slice(1)} terminado</b><p class="hint" style="margin:4px 0 8px">Marcado el ${esc(fecha)} · si cambias un dato, vuelve solo a «en proceso».</p>
        <button class="btn sm" type="button" id="hdReabrir">Volver a abrir</button>`) || (($('#hdReabrir') || {}).onclick = () => { delete Y.listo; delete Y.listoFecha; pop.hidden = true; guardarMemoria(); pintarListo(); });
    if(f.length) return abrir('hdListo', `<b>Para marcar el ${D.n} como terminado falta:</b><ul class="hd-ul">${f.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`);
    Y.listo = D.huella(an2); Y.listoFecha = new Date().toISOString(); pop.hidden = true; toast(`${D.n[0].toUpperCase() + D.n.slice(1)} marcado como terminado.`); guardarMemoria(); pintarListo();
  };
}
// Cierra el recuadro de la cabecera al tocar fuera
document.addEventListener('click', e => { const pop = $('#hdPop'); if(pop && !pop.hidden && !e.target.closest('#hdPop, #hdActs')) pop.hidden = true; });

// ═══ Observaciones internas por paso (no salen en la memoria) ═══
// anexos.notas = { paso: [{ id, t, fecha, autor, hecha }] }
const notasDe = id => (S.m?.anexos?.notas || {})[id] || [];
const notasPend = id => notasDe(id).filter(n => !n.hecha).length;
let notasAbierto = (() => { try{ return localStorage.getItem('notasAbierto') === '1'; }catch(e){ return false; } })();
function pintarNotas(){
  const tab = $('#notasTab'), dr = $('#notasDr'); if(!tab || !dr || !S.m) return;
  const id = S.paso, paso = STEPS.find(x => x.id === id), lista = notasDe(id), pend = notasPend(id);
  $('#notasN').textContent = pend || ''; tab.classList.toggle('con', pend > 0);
  $$('[data-step]').forEach(b => { const y = b.querySelector('.ydot'); if(y) y.hidden = !notasPend(b.dataset.step); });
  dr.hidden = !notasAbierto; tab.hidden = notasAbierto;
  document.body.classList.toggle('notas-on', notasAbierto);   // en pantallas anchas el panel empuja el contenido en vez de taparlo
  const fmt = f => new Date(f).toLocaleString('es-CO', { day:'numeric', month:'short', hour:'numeric', minute:'2-digit' });
  const orden = [...lista.filter(n => !n.hecha), ...lista.filter(n => n.hecha)];
  dr.innerHTML = `<div class="notas-hd"><b>📝 Observaciones · ${esc(paso?.t || '')}</b><button type="button" id="notasX" aria-label="Cerrar">✕</button></div>
    <div class="notas-li">${orden.length ? orden.map(n => `<div class="nota ${n.hecha ? 'hecha' : ''}">
        <label><input type="checkbox" data-nh="${n.id}" ${n.hecha ? 'checked' : ''}/> <span>${esc(n.t).replace(/\n/g, '<br/>')}</span></label>
        <div class="nota-m">${esc((n.autor || '').split('@')[0])} · ${esc(fmt(n.fecha))}${n.hecha ? ' · resuelta' : ''}<button type="button" data-nd="${n.id}" aria-label="Borrar">✕</button></div></div>`).join('')
      : '<p class="hint">No hay observaciones en este paso.</p>'}</div>
    <textarea id="notaTxt" rows="3" placeholder="Escribe una observación o recordatorio…"></textarea>
    <button class="btn sm pri" type="button" id="notaAdd" style="margin-top:6px">＋ Agregar</button>
    <p class="hint" style="margin-top:8px">Son internas: no salen en la memoria. El circulito amarillo en la lista de pasos indica observaciones sin resolver.</p>`;
  const abrir = v => { notasAbierto = v; try{ localStorage.setItem('notasAbierto', v ? '1' : '0'); }catch(e){} pintarNotas(); if(v) $('#notaTxt')?.focus(); };
  tab.onclick = () => abrir(true); $('#notasX').onclick = () => abrir(false);
  const cambiar = fn => { const an = S.m.anexos = S.m.anexos || {}; an.notas = an.notas || {}; an.notas[id] = fn(an.notas[id] || []); guardarMemoria(); pintarNotas(); };
  const agregar = () => { const t = $('#notaTxt').value.trim(); if(!t) return;
    cambiar(l => [...l, { id:Date.now().toString(36), t, fecha:new Date().toISOString(), autor:S.user?.email || '', hecha:false }]); $('#notaTxt')?.focus(); };
  $('#notaAdd').onclick = agregar;
  $('#notaTxt').onkeydown = e => { if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)) agregar(); };
  $$('[data-nh]').forEach(c => c.onchange = () => cambiar(l => l.map(n => n.id === c.dataset.nh ? { ...n, hecha:c.checked } : n)));
  $$('[data-nd]').forEach(b => b.onclick = () => cambiar(l => l.filter(n => n.id !== b.dataset.nd)));
}

// ═══ PANELES DE CADA PASO ═══
const PANES = {
A(){ paneAnexoA(); },
B(){ paneAnexoB(); },
K(){ paneCombos(); },
C(){ paneAnexoC(); },
D(){ paneAnexoD(); },
ficha(){
  const m = S.m, F = m.ficha, emp = F.tipo !== 'natural', ro = !esIng() ? 'disabled' : '';
  const inp = (k, l, o={}) => `<div class="f ${o.cls||''}"><label for="f_${k}">${l}</label><input id="f_${k}" data-k="${k}" type="${o.type||'text'}" value="${esc(F[k])}" placeholder="${esc(o.ph||'')}" ${ro}/>${o.h?`<div class="hint">${o.h}</div>`:''}</div>`;
  pane(`
  <div class="card"><div class="ct">Identificación del documento</div>
    <div class="fg g4">
      <div class="f"><label>Consecutivo</label><input value="${esc(m.consecutivo)}" readonly/><div class="hint">Automático: ${esc(S.cfg.prefijo||'DOC-MEM')}-DD-MM-AA</div></div>
      ${inp('fecha','Fecha de emisión',{type:'date'})}
      <div class="f"><label for="f_perfil">Membrete y pie de página</label><select id="f_perfil" ${ro}>${S.perfiles.map(p => `<option value="${p.id}" ${p.id===perfilDe(m).id?'selected':''}>${esc(p.nombre)}</option>`).join('')}</select><div class="hint">Se editan en ⚙ Configuración</div></div>
      <div class="f"><label for="f_estado">Estado</label><select id="f_estado" ${ro || (m.estado==='arch'?'disabled':'')}>
        <option value="wip" ${m.estado==='wip'?'selected':''}>En proceso — solo tú la ves</option><option value="apr" ${m.estado==='apr'?'selected':''}>Aprobada — visible para consulta</option>${m.estado==='arch'?'<option value="arch" selected>Archivada en NAS</option>':''}</select></div>
      ${inp('titulo_doc','Título en la portada',{cls:'span2',ph:TITULO_DEF})}
      ${inp('titulo_archivo','Nombre del documento (código)',{cls:'span2',ph:tituloArchivo({...F,titulo_archivo:''}),h:'Va arriba a la derecha y debajo de la firma. Vacío = se arma con el nombre del proyecto.'})}
    </div></div>
  <div class="card"><div class="ct">Imagen de portada del proyecto${m.imagen_path?pill('ok','Cargada'):pill('pend','Falta')}</div>
    <div class="drop-img ${m.imagen_path?'has':''}" id="dropImg" ${esIng()?'role="button" tabindex="0" aria-label="Subir imagen de portada"':''}>
      <div class="ph-in" id="thumb">${m.imagen_path?'Cargando imagen…':`<div style="font-size:30px">🖼️</div><b>${esIng()?'Toca aquí para subir la imagen':'Sin imagen'}</b>${esIng()?'<br/>o arrástrala desde tu carpeta (JPG o PNG)':''}`}</div></div>
    ${esIng()?`<div class="nav-btns" style="margin-top:8px"><button class="btn sm pri" type="button" id="upImg">${m.imagen_path?'Cambiar imagen':'Subir imagen'}</button>${m.imagen_path?'<button class="btn sm danger" type="button" id="delImg">Quitar</button>':''}
      <span class="hint">Captura del modelo estructural o render. Va en el recuadro grande de la portada; se reduce sola para ahorrar espacio.</span></div>`:''}</div>
  <div class="card"><div class="ct">Propietario / cliente</div>
    <div style="margin-bottom:10px"><div class="seg" role="group" aria-label="Tipo de propietario"><button type="button" data-tipo="natural" class="${!emp?'on':''}" ${ro}>Persona natural</button><button type="button" data-tipo="empresa" class="${emp?'on':''}" ${ro}>Empresa / persona jurídica</button></div></div>
    <div class="fg g3">${inp('prop', emp ? 'Razón social' : 'Nombre completo', { ph: emp ? 'Ej: Inversiones La Brasa S.A.S.' : 'Nombre y apellidos' })}
      <div class="f"><label for="f_doc">Identificación</label><div class="docrow"><select id="f_docTipo" data-k="docTipo" aria-label="Tipo de documento" ${ro}>${['NIT','C.C.','C.E.'].map(x => `<option ${x===(F.docTipo||'NIT')?'selected':''}>${x}</option>`).join('')}</select><input id="f_doc" data-k="doc" value="${esc(F.doc)}" placeholder="${(F.docTipo||'NIT')==='NIT'?'900.123.456-7':'1.098.765.432'}" ${ro}/></div><div class="hint">El tipo elegido es el rótulo en la portada</div></div>
      ${emp ? inp('rep','Representante legal',{ph:'Nombre del representante'}) : '<div></div>'}
      ${inp('dirCorr','Dirección de correspondencia')}${inp('tel','Teléfono',{type:'tel'})}${inp('mail','Correo electrónico',{type:'email'})}</div></div>
  <div class="card"><div class="ct">Proyecto y ubicación</div>
    <div class="fg g4">${inp('proyecto','Nombre exacto del proyecto',{cls:'span2',ph:'Ej: Estructura metálica parqueadero — Proyecto AGPE La Brasa'})}${inp('uso','Uso proyectado',{cls:'span2',ph:'Ej: Cubierta parqueadero con paneles solares'})}
      ${inp('dir','Dirección del predio',{cls:'span2'})}${inp('lote','Lote')}${inp('mz','Manzana')}${inp('mun','Municipio')}${inp('depto','Departamento')}${inp('coord','Coordenadas',{cls:'span2',ph:'8.311705, -73.597054',h:'Se usarán para sismo y viento'})}
      ${inp('matricula','Matrícula inmobiliaria',{cls:'span2',ph:'196-84811'})}${inp('predial','Número predial / cédula catastral',{cls:'span2',ph:'01-01-0434-0017-000'})}</div></div>
  <div class="card"><div class="ct">Vista previa en la portada${pill('wip','Se actualiza al escribir')}</div><div class="prev" id="fprev"></div></div>`);

  const prev = () => { $('#fprev').innerHTML = tablasHTML(F, false) + pieHTML(perfilDe(m)); };
  prev();
  if(m.imagen_path) urlDe(m.imagen_path).then(u => { if(u && $('#thumb')) $('#thumb').innerHTML = `<img src="${esc(u)}" alt="Imagen de portada"/>`; });
  if(!esIng()) return;
  $$('#pane [data-k]').forEach(el => el.addEventListener(el.tagName==='SELECT' ? 'change' : 'input', () => {
    F[el.dataset.k] = el.value;
    if(el.dataset.k === 'docTipo') $('#f_doc').placeholder = el.value === 'NIT' ? '900.123.456-7' : '1.098.765.432';
    if(el.dataset.k === 'proyecto') $('#f_titulo_archivo').placeholder = tituloArchivo({ ...F, titulo_archivo:'' });
    prev(); guardarMemoria();
  }));
  $('#f_perfil').onchange = e => { m.perfil_id = e.target.value; prev(); guardarMemoria(); };
  $('#f_estado').onchange = e => { m.estado = e.target.value; guardarMemoria(); toast(m.estado==='apr' ? 'Aprobada: ya la puede ver el resto de la empresa.' : 'En proceso: solo tú la ves.'); };
  $$('[data-tipo]').forEach(b => b.onclick = () => {
    F.tipo = b.dataset.tipo;
    if(F.tipo === 'natural' && (F.docTipo||'NIT') === 'NIT') F.docTipo = 'C.C.';
    if(F.tipo === 'empresa') F.docTipo = 'NIT';
    guardarMemoria(); PANES.ficha();
  });
  const elegir = async () => { const f = await elegirArchivo('image/*'); if(f) subirPortada(f, () => PANES.ficha()); };
  $('#upImg').onclick = elegir;
  const dz = $('#dropImg');
  dz.onclick = elegir; dz.onkeydown = e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); elegir(); } };
  dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); };
  dz.ondragleave = () => dz.classList.remove('over');
  dz.ondrop = e => { e.preventDefault(); dz.classList.remove('over'); const f = e.dataTransfer.files[0];
    if(f && f.type.startsWith('image/')) subirPortada(f, () => PANES.ficha()); else toast('Ese archivo no es una imagen.'); };
  if($('#delImg')) $('#delImg').onclick = async () => {
    if(!confirm('¿Quitar la imagen de la portada?')) return;
    await sb.storage.from(BUCKET).remove([m.imagen_path]);
    await sb.from('mem_memorias').update({ imagen_path:null }).eq('id', m.id);
    m.imagen_path = null; PANES.ficha();
  };
},

revisiones(){
  const m = S.m;
  pane(`<div class="note blue">Cada cambio que se emita de la memoria es una revisión nueva. En la portada aparecen las últimas 5 (mínimo 3 filas).</div>
  <div class="card"><div class="ct">Revisiones<button class="btn sm pri" type="button" id="addRev">+ Nueva revisión</button></div>
    <div class="tw"><table class="t"><thead><tr><th style="width:70px">Rev.</th><th style="width:150px">Fecha</th><th>Descripción de la modificación</th><th style="width:90px">Elaboró</th><th style="width:90px">Revisó</th><th style="width:90px">Aprobó</th><th></th></tr></thead>
    <tbody>${S.revs.length ? S.revs.map(r => `<tr data-id="${r.id}">
      <td><input data-c="rev" type="number" min="0" value="${esc(r.rev)}"/></td><td><input data-c="fecha" type="date" value="${esc(r.fecha)}"/></td>
      <td><input data-c="descripcion" value="${esc(r.descripcion)}"/></td><td><input data-c="elaboro" value="${esc(r.elaboro)}"/></td>
      <td><input data-c="reviso" value="${esc(r.reviso)}"/></td><td><input data-c="aprobo" value="${esc(r.aprobo)}"/></td>
      <td><button class="btn sm danger" type="button" data-del="${r.id}" aria-label="Eliminar revisión">✕</button></td></tr>`).join('')
      : '<tr><td colspan="7" class="hint">Sin revisiones.</td></tr>'}</tbody></table></div>
    <div class="hint" style="margin-top:6px">Se guarda al salir de cada casilla. Elaboró, revisó y aprobó van con iniciales (ej: ${esc(S.cfg.iniciales||'GRTQ')}).</div></div>
  <div class="card"><div class="ct">Así se ve en la portada</div><div class="prev" id="rprev"></div></div>`);
  const prev = () => { $('#rprev').innerHTML = revHTML(); };
  prev();
  $$('#pane [data-c]').forEach(el => el.addEventListener('change', async () => {
    const id = el.closest('tr').dataset.id, r = S.revs.find(x => x.id === id), c = el.dataset.c;
    let val = el.value; if(c === 'rev') val = val === '' ? null : +val; if(c === 'fecha' && !val) val = null;
    r[c] = val; marcaGuardado('...');
    const { error } = await sb.from('mem_revisiones').update({ [c]:val }).eq('id', id);
    marcaGuardado(error ? 'err' : 'ok'); if(error) console.error(error);
    if(c === 'rev') S.revs.sort((a,b) => (a.rev??0) - (b.rev??0));
    prev();
  }));
  $('#addRev').onclick = async () => {
    const rev = S.revs.reduce((a, r) => Math.max(a, r.rev ?? -1), -1) + 1;
    const { data, error } = await sb.from('mem_revisiones').insert({ memoria_id:m.id, rev, fecha:hoyISO(), descripcion: rev === 0 ? 'Emisión inicial' : '', elaboro:S.cfg.iniciales||'', reviso:'', aprobo:'' }).select().single();
    if(error) return err(error);
    S.revs.push(data); PANES.revisiones();
    const ins = $$('#pane input[data-c="descripcion"]'); ins[ins.length-1]?.focus();
  };
  $$('[data-del]').forEach(b => b.onclick = async () => {
    if(!confirm('¿Eliminar esta revisión?')) return;
    const { error } = await sb.from('mem_revisiones').delete().eq('id', b.dataset.del);
    if(error) return err(error);
    S.revs = S.revs.filter(r => r.id !== b.dataset.del); PANES.revisiones();
  });
},

async portada(){
  pane(`<div class="nav-btns" style="margin-bottom:12px"><button class="btn grn" type="button" id="btnPrint">🖨 Imprimir / Guardar PDF</button>
    ${esIng()?`<button class="btn" type="button" id="btnImgP">🖼️ ${S.m.imagen_path?'Cambiar':'Subir'} imagen de portada</button>`:''}
    <span class="hint">En el cuadro de impresión elige <b>Guardar como PDF</b>, tamaño <b>Carta</b> y márgenes <b>Ninguno</b>.</span></div>
    <div class="sheet-wrap" id="sw"><div class="sheet-scale" id="ss"><p class="muted" style="padding:20px">Preparando portada…</p></div></div>
    ${!S.cfg.firma_path && esIng() ? '<div class="note amber" style="margin-top:12px"><b>Falta la firma.</b> Súbela en ⚙ Configuración → Datos del ingeniero y firma.</div>' : ''}`);
  if($('#btnImgP')) $('#btnImgP').onclick = async () => { const f = await elegirArchivo('image/*'); if(f) subirPortada(f, () => PANES.portada()); };
  const [uImg, uFirma] = await Promise.all([urlDe(S.m.imagen_path), urlDe(S.cfg.firma_path)]);
  if(!$('#ss')) return;
  $('#ss').innerHTML = portadaHTML(false, uImg, uFirma);
  const ajustar = () => { const w = $('#sw'); if(!w) return; const sc = Math.min(1, (w.clientWidth - 28) / 816);
    $('#ss').style.transform = `scale(${sc})`; w.style.height = (1056*sc + 28) + 'px'; };
  ajustar(); window.onresize = ajustar;
  $('#btnPrint').onclick = async () => {
    const pa = $('#print-area');
    pa.innerHTML = portadaHTML(true, uImg, uFirma);
    await Promise.all([...pa.querySelectorAll('img')].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
    await document.fonts.ready;
    const t = document.title; document.title = `${S.m.consecutivo}_PORTADA`;
    window.print(); document.title = t;
  };
},
};

// ═══ CONFIGURACIÓN (solo ingeniero) ═══
const guardarPerfil = debounce(async p => {
  marcaGuardado('...');
  const { error } = await sb.from('mem_perfiles_pie').update({ nombre:p.nombre, l1:p.l1, l2:p.l2, correo:p.correo, dir:p.dir, ciudad:p.ciudad, tel:p.tel }).eq('id', p.id);
  marcaGuardado(error ? 'err' : 'ok'); if(error) console.error(error);
}, 700);
const guardarCfg = debounce(async () => {
  marcaGuardado('...');
  const c = S.cfg;
  const { error } = await sb.from('mem_config').update({ nombre_firma:c.nombre_firma, matricula:c.matricula, iniciales:c.iniciales, prefijo:c.prefijo, software:(c.software || '').trim() || SW_DEF }).eq('id', 1);
  marcaGuardado(error ? 'err' : 'ok'); if(error) console.error(error);
}, 700);

async function renderConfig(){
  S.m = null;
  if(!S.editPerfil || !S.perfiles.some(p => p.id === S.editPerfil)) S.editPerfil = (S.perfiles.find(p => p.predeterminado) || S.perfiles[0])?.id;
  const p = S.perfiles.find(x => x.id === S.editPerfil) || {}, c = S.cfg;
  const pi = (k, l, h) => `<div class="f"><label for="p_${k}">${l}</label><input id="p_${k}" data-pk="${k}" value="${esc(p[k])}"/>${h?`<div class="hint">${h}</div>`:''}</div>`;
  const ci = (k, l, h) => `<div class="f"><label for="c_${k}">${l}</label><input id="c_${k}" data-ck="${k}" value="${esc(c[k])}"/>${h?`<div class="hint">${h}</div>`:''}</div>`;
  $('#app').innerHTML = `<div style="margin-bottom:10px;display:flex;gap:8px;align-items:center"><button class="btn sm" type="button" id="back2">← Memorias</button><span style="flex:1"></span><span class="saved" id="saved"></span></div>
  <div class="main-hd"><div><h2>Configuración</h2><p class="lead">Perfiles de pie de página, tus datos de ingeniero y quién puede entrar. Los cambios se guardan solos.</p></div></div>
  <div class="card"><div class="ct">Perfiles de pie de página<button class="btn sm pri" type="button" id="newP">+ Nuevo perfil</button></div>
    <div class="pcards">${S.perfiles.map(x => `<button type="button" class="pcard ${x.id===p.id?'on':''}" data-pid="${x.id}"><b>${esc(x.nombre)}</b><small>${esc(x.l1)}</small>${x.predeterminado?'<span class="pill ok" style="margin-top:6px">Predeterminado</span>':''}</button>`).join('')}</div>
    ${p.id ? `<div class="fg g3">${pi('nombre','Nombre del perfil','Solo lo ves tú, para elegirlo')}${pi('l1','Línea 1','Nombre o razón social')}${pi('l2','Línea 2 (opcional)','Ej: cargo, NIT o matrícula')}
      ${pi('correo','Correo')}${pi('dir','Dirección')}${pi('ciudad','Ciudad')}${pi('tel','Teléfono (opcional)')}</div>
    <div class="hint" style="font-weight:800;text-transform:uppercase;letter-spacing:1px;margin:14px 0 4px">Vista previa del pie de página</div>
    <div class="prev" id="pprev">${pieHTML(p)}</div>
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn" type="button" id="defP" ${p.predeterminado?'disabled':''}>Usar como predeterminado</button><button class="btn danger" type="button" id="delP" ${S.perfiles.length<2||p.predeterminado?'disabled':''}>Eliminar perfil</button></div>` : ''}</div>
  <div class="card"><div class="ct">Datos del ingeniero y firma</div>
    <div class="fg g4">${ci('nombre_firma','Nombre en la firma')}${ci('matricula','Matrícula profesional')}${ci('iniciales','Iniciales para revisiones')}${ci('software','Programa de análisis (como sale en lo impreso)','Por licencia, en los anexos no se nombra el programa. Vacío = «software de análisis estructural»')}${ci('prefijo','Prefijo del consecutivo','Ej: DOC-MEM → DOC-MEM-18-08-26')}</div>
    <div class="sig" style="margin-top:12px"><div class="box" id="sigBox">Sin firma</div><div><b>Firma escaneada</b><div class="hint">PNG o JPG con fondo blanco o transparente. Va en la portada sobre la línea de firma.</div>
      <button class="btn sm pri" type="button" id="upSig" style="margin-top:6px">${c.firma_path?'Cambiar firma':'Subir firma'}</button></div></div></div>
  <div class="card"><div class="ct">Usuarios</div><div id="users"><p class="muted">Cargando…</p></div>
    <div class="hint" style="margin-top:8px">Para dar acceso a alguien: créalo en Supabase → Authentication → <b>Add user</b>. Entra como <b>Consulta</b> (solo ve memorias aprobadas) y aquí puedes cambiarle el rol.</div></div>`;
  $('#back2').onclick = () => ir('#/');
  urlDe(c.firma_path).then(u => { if(u && $('#sigBox')) $('#sigBox').innerHTML = `<img src="${esc(u)}" alt="Firma"/>`; });
  $$('[data-pid]').forEach(b => b.onclick = async () => { await guardarPendientes(); S.editPerfil = b.dataset.pid; renderConfig(); });
  $$('[data-pk]').forEach(el => el.addEventListener('input', () => {
    p[el.dataset.pk] = el.value; $('#pprev').innerHTML = pieHTML(p); guardarPerfil(p);
    if(['nombre','l1'].includes(el.dataset.pk)){ const card = document.querySelector(`[data-pid="${p.id}"]`); card.querySelector('b').textContent = p.nombre; card.querySelector('small').textContent = p.l1; }
  }));
  $$('[data-ck]').forEach(el => el.addEventListener('input', () => { c[el.dataset.ck] = el.value; guardarCfg(); }));
  $('#newP').onclick = async () => {
    const { data, error } = await sb.from('mem_perfiles_pie').insert({ nombre:'Nuevo perfil', l1:'', l2:'', correo:'', dir:'', ciudad:'', tel:'', predeterminado:false }).select().single();
    if(error) return err(error);
    S.perfiles.push(data); S.editPerfil = data.id; renderConfig(); $('#p_nombre')?.select();
  };
  if($('#defP')) $('#defP').onclick = async () => {
    await guardarPendientes();
    const r1 = await sb.from('mem_perfiles_pie').update({ predeterminado:false }).neq('id', p.id);
    const r2 = await sb.from('mem_perfiles_pie').update({ predeterminado:true }).eq('id', p.id);
    if(r1.error || r2.error) return err(r1.error || r2.error);
    S.perfiles.forEach(x => x.predeterminado = x.id === p.id); renderConfig(); toast('Las memorias nuevas usarán este perfil.');
  };
  if($('#delP')) $('#delP').onclick = async () => {
    if(!confirm(`¿Eliminar el perfil "${p.nombre}"?`)) return;
    const { error } = await sb.from('mem_perfiles_pie').delete().eq('id', p.id);
    if(error) return toast(error.code === '23503' ? 'No se puede: alguna memoria usa este perfil. Cámbialo en su ficha primero.' : error.message, 4500);
    S.perfiles = S.perfiles.filter(x => x.id !== p.id); S.editPerfil = null; renderConfig();
  };
  $('#upSig').onclick = async () => {
    const file = await elegirArchivo('image/png,image/jpeg'); if(!file) return;
    try{
      const blob = await comprimir(file, { max:1000, type:'image/png' });
      const path = 'config/firma.png';
      await subir(path, blob, 'image/png');
      if(c.firma_path !== path){ const { error } = await sb.from('mem_config').update({ firma_path:path }).eq('id', 1); if(error) throw error; c.firma_path = path; }
      toast('Firma guardada.'); renderConfig();
    }catch(e){ err(e, 'No se pudo subir la firma'); }
  };
  // Usuarios y roles
  const { data:us, error } = await sb.from('mem_usuarios').select('user_id,email,rol').order('email');
  if(!$('#users')) return;
  if(error){ $('#users').innerHTML = `<p class="err">${esc(error.message)}</p>`; return; }
  $('#users').innerHTML = `<div class="tw"><table class="t"><thead><tr><th>Correo</th><th>Rol</th></tr></thead><tbody>${us.map(u => `<tr><td>${esc(u.email)}${u.user_id===S.user.id?' <span class="pill gray">tú</span>':''}</td>
    <td><div class="f"><select data-uid="${u.user_id}" ${u.user_id===S.user.id?'disabled':''}><option value="consulta" ${u.rol==='consulta'?'selected':''}>Consulta — ve y descarga aprobadas</option><option value="ingeniero" ${u.rol==='ingeniero'?'selected':''}>Ingeniero — crea, edita y firma</option></select></div></td></tr>`).join('')}</tbody></table></div>`;
  $$('[data-uid]').forEach(s => s.onchange = async () => {
    const { error } = await sb.from('mem_usuarios').update({ rol:s.value }).eq('user_id', s.dataset.uid);
    error ? err(error) : toast('Rol actualizado.');
  });
}

// ═══ ARRANQUE ═══
$('#btnCfg').onclick = () => ir('#/config');
$('#btnSalir').onclick = async () => { await guardarPendientes(); await sb.auth.signOut(); S.user = null; S.m = null; $('#toast').hidden = true; location.hash = ''; renderLogin(); };
sb.auth.onAuthStateChange(ev => { if(ev === 'PASSWORD_RECOVERY') setTimeout(renderNuevaClave, 0); });
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js', { updateViaCache:'none' }).then(r => r.update()).catch(() => {});
  // cuando se instala una versión nueva de la app, recarga una vez para usarla
  let recargado = false, habia = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if(habia && !recargado){ recargado = true; guardarPendientes().finally(() => location.reload()); } });
}
if(/type=recovery/.test(location.hash)) { /* lo maneja onAuthStateChange */ } else boot();
