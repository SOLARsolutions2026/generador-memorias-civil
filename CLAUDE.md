# Generador de Memorias de Cálculo — notas del proyecto

App web de P. Electric S.A.S. (Departamento Civil) para armar memorias de cálculo de estructuras metálicas (NSR-10).
Usuario principal: Gabriel Tellez ("Amo"), ingeniero civil. Explicar en español, simple y paso a paso.

## Tecnología (no cambiar sin consultar)
- HTML + CSS + JS puro, **sin compilación**. Publicada en GitHub Pages: https://solarsolutions2026.github.io/generador-memorias-civil/
- Instalable en el celular (PWA): `manifest.webmanifest` + `sw.js`. Al cambiar archivos, subir la versión de `CACHE` en `sw.js`. El SW pide con `cache:'no-cache'` (GitHub Pages cachea 10 min) y la app se recarga sola en `controllerchange`.
- Datos: Supabase proyecto **pelectric-apps** (`ykomritaklitlwnuxooy`), plan gratuito. No tocar el proyecto `proyecto-manhattan`.
- `vendor/supabase.js` = supabase-js 2.45.4 (UMD). Fuentes EB Garamond locales en `fonts/`.

## Base de datos (prefijo `mem_`)
- `mem_usuarios(user_id, email, rol)` — rol `ingeniero` (crea/edita/firma) o `consulta` (solo ve aprobadas/archivadas). Trigger crea la fila al registrarse un usuario.
- `mem_config` (fila id=1): nombre_firma, matricula, iniciales, firma_path, prefijo.
- `mem_perfiles_pie`: perfiles de pie de página (nombre, l1, l2, correo, dir, ciudad, tel, predeterminado).
- `mem_memorias`: consecutivo, titulo, estado (`wip`/`apr`/`arch`), perfil_id, `ficha` (jsonb), imagen_path, paquete, archivada_en.
- `mem_revisiones`: memoria_id, rev, fecha, descripcion, elaboro, reviso, aprobo.
- RLS con `mem_priv.es_ingeniero()` (security definer en esquema privado).
- Bucket privado `memorias`: `<memoria_id>/modelo3d.jpg`, `config/firma.png`.

## Campos de `ficha` (jsonb)
tipo (natural|empresa), prop, docTipo (NIT|C.C.|C.E.), doc, rep, dirCorr, tel, mail, proyecto, uso, dir, lote, mz, mun, depto,
coord, matricula, predial, fecha, titulo_doc, titulo_archivo.

## Anexos (`mem_memorias.anexos` jsonb)
- `anexos.A` = datos del Anexo A (ver `AnexoA.defaults()` en `calc/anexoA.js`). Cálculo puro en `calc/anexoA.js`, pantalla en `anexoA-ui.js`.
- Biblioteca de paneles y rieles: `mem_config.biblioteca` = { paneles:[{nombre,L,W,H,peso,cargaF,cargaP}] (6 paneles de la tabla de Amo, cargas en Pa), rieles:[{nombre,alto,ancho,peso,material?,vmax?,luzMax}] (sin inercias, decisión de Amo); todos con `ficha` (ruta del PDF) } (Alurack 0.906 kg/m; CHIKO 537 0.73 kg/m = 14 kg ÷ 8 piezas ÷ 2.4 m).
- Fichas técnicas: las de la biblioteca base están en el repo `fichas/*.pdf` (públicas, comprimidas con qpdf); las que sube Amo van a
  Supabase `<memoria_id>/fichas/{panel|riel}.pdf` y, al "Guardar en biblioteca", se copian a `biblioteca/<lista>-<nombre>.pdf`. `urlFicha()` resuelve ambas.
  Se unirán al PDF final después de las páginas del Anexo A (pendiente).
- Separación máxima de apoyos del riel (`riel.luzMax`): CHIKO 1.5 m, Alurack 2.0 m (fichas técnicas). La separación de apoyos del riel = `lamina.sep` si hay cubierta (solo lectura), si no `viento.luz` (`luzRiel()`); la correa usa `viento.luzCorrea`. Aviso en pantalla y nota impresa.
- Correcciones acordadas frente a los Excel originales (26-oct-2026): D de lámina multiplica por la separación (el Excel dividía);
  peso de lámina kg/m ÷ ancho útil; ancho aferente del riel = L/2 (editable) en muerta, viva y viento; g = 9.81;
  exposición según B.6.5.6.3 (propuesta automática + opción manual); CN leídos de las figuras B.6.5-18A (SPRFV, θ<7.5° usa 0°)
  y B.6.5-19A (CyR, interpolación por θ y clase de área); zona 3 = franja exterior de ancho a; Kz con z mín. 4.0 m (9.0 m CyR exp. B);
  Kd = 0.85 (edificios/cubiertas); presión mínima 0.40 kN/m².
- Pestaña Cubierta: paneles Sí/No (`tipo.paneles`); material (`lamina.perfil`: ninguna → `tipo.lamina=false`; master1000/canaleta por calibre; zinc 5, eternit 20, arcilla 80 kg/m²; otra), `lamina.wManual` reemplaza el peso de tabla;
  `extras` = cielo raso (PVC 5, Drywall 15, Fibrocemento 20, Machimbre 15, Icopor 5, Registrable 10), ductería eléctrica 5, mecánica 20, iluminaria 5 y `otras[]` {n,w}.
  Los extras van sobre las correas; si no hay cubierta, sobre los rieles de paneles.
- Exposición: botón 📘 abre `modalCondiciones()` (texto B.6.5.6.2/.3 con límites del proyecto); `viento.imgsExpo[]` = {path,nota} imágenes de comprobación de distancias (`<memoria_id>/exposicion-*.jpg`, máx. 4), se imprimen en el Anexo A.
- Impresión de anexos: `imprimirConMargen()` agrega `@page` con márgenes solo al imprimir (la portada usa margen 0).

- `anexos.B` (ver `AnexoB.defaults()` en `calc/anexoB.js`, pantalla `anexoB-ui.js`): aplica Sí/No (si No, nota de alcance `TXT_SIN_SISMO`);
  Aa/Av: `metodo` tabla (depto + `munCode`) | coord (`lat`,`lon` → punto en polígono municipal) | manual. Datos en `data/sismo.js` (carga diferida, `NSR_SISMO.mun[{c,n,d,aa,av,z,lat,lon,r}]`):
  Apéndice A-4 (1117 municipios, extraídos del PDF oficial por github.com/Yojemr/Espectra-NSR10) + límites DANE MGN 2018 (@john-guerra/geo-colombia, MIT) simplificados ~900 m; regenerar con tools/build_sismo.py.
  Mapa coloreado Aa/Av por municipio (equivale a figuras A.2.3-2/3), también en el PDF. Fa/Fv interpolados (Tablas A.2.4-3/4, editables), I (A.2.5-1), Ct/α, h = Hr del Anexo A, Tx/Ty de SAP con límite Cu·Ta,
  Sa(T) por tramos To/Tc/TL (corrección: el Excel fijaba la meseta), un solo nivel (Cvx = 1), torsión 5 % de la dimensión perpendicular. B-2.4 comparación modal: Tx/Ty vs Cu·Ta (A.4.2.1) y Vtx/Vty ≥ 80 % (90 % irregular) de Vs con factor de ajuste (A.5.4.5).
  Historial de iteraciones: `iter[]` = foto (`AnexoB.foto`) {n,fecha,nota,W,Tx,Ty,VsX,VsY,Vtx,Vty,fX,fY,pct,ok}; botón "Guardar iteración y empezar otra" (`notaIter`); la fila Actual = datos vigentes; en el PDF sale B-2.5 con todas + la final.
  W = ① `items{clave:{on,area}}` cargas por área del Anexo A + ② `estructura` {modo lista|sap, perfiles[{perfil,kgm,L,nom}], sapKN, sapImg} + ③ `otras[]` {n,cant,unidad,pu,ubic}.
  Biblioteca `AnexoB.PERFILES` (IPE/HEA/HEB Euronorm; tubos calculados, 120×60×2 = 5.59 de la plantilla). Las cargas sobre la estructura (anuncios…) van en ③, NO en el Anexo A (decisión de Amo).

- `anexos.C` (pantalla `anexoC-ui.js`, cálculo `calc/anexoC.js`): Amo sube el archivo de texto de SAP2000 (.$2k, File → Export → SAP2000 .s2k Text File, unidades KN, m, C);
  se guarda tal cual en Supabase `<memoria_id>/modelo-sap.s2k` y en la memoria solo el resumen `C.modelo` = `AnexoC.analizar()` (materiales, patrones, nudos+apoyos,
  secciones con longitud y peso = área×L×γ, cargas agrupadas por patrón/dirección/valor con rangos de elementos, sumas de cargas en nudos). `C.archivo` {nombre,path,fecha,kb},
  `C.img` (`<id>/modelo-sap.jpg`, una sola imagen), `C.notaImg`, `C.descripcion` (vacío = texto automático), `C.completas` (tablas completas en el PDF, descargando el .s2k y en varias columnas),
  `C.sinPeso` (secciones fuera del peso propio; null = rieles por defecto, ya están en el Anexo A). Botón para enviar el peso propio al Anexo B ② (modo sap).
  Revisión cruzada solo en pantalla (`AnexoC.revisar`): tipos de patrón, SelfWtMult = 1 una vez, cargas D/L/W del Anexo A (tolerancia 3 %), Fx/Fy/Tx/Ty en nudos frente a la FHE y Mt del Anexo B.
  Pendiente: probar con un .$2k real de Amo (el formato se probó con un archivo armado desde su Excel).

- Anexo terminado (app.js `ANEXOS_LISTO`, `pintarListo()` en `#listoBar` debajo del panel): la app revisa datos faltantes y habilita «✓ Marcar como terminado»;
  guarda `X.listo` = huella de los datos (B incluye los del A) y `X.listoFecha`. Si los datos cambian, la huella ya no coincide y el paso vuelve a «en proceso» solo. B sin sismo = ✓ directo.
  Pendiente: agregar D y E a `ANEXOS_LISTO` cuando existan.

- Observaciones internas (app.js `pintarNotas`): pestaña amarilla plegable al borde derecho (opción B de Amo) que abre un panel; `anexos.notas = {paso:[{id,t,fecha,autor,hecha}]}`
  para cualquier paso; casilla «resuelta» (tachada). Circulito amarillo (`.ydot`) en la lista de pasos si hay pendientes. No salen en la memoria; solo rol ingeniero.
  Abierto en pantallas > 900 px: `body.notas-on` corre la página (padding-right) para no tapar el contenido; en celular se superpone.
  Anexo C: patrones IMP* = impacto de vehículos (parqueaderos) u otras especiales = categoría N (sin aviso de tipo).

- Paso «Combinaciones» (id `K`, entre B y C; `calc/combos.js` = `Combos`, pantalla `combos-ui.js`), datos `anexos.K`:
  irregularidades A.3.3 como lista Sí/No con nota (`irrP`, `irrA`, `notasIrr`; Tablas A.3-6/A.3-7), `redundante` (φr 1.0/0.75), `sisR` (R0 de Tabla A.3-3: DES 7, DMO 5, DMI 3, otro → `R0`);
  R = φa·φp·φr·R0; `sincronizarIrregular()` fija `anexos.B.irregular` (el Anexo B ya no tiene la casilla si existe K).
  Patrones SAP por símbolo `pat{D,Lr,W,Ex,Ey,Tx,Ty,IMPx,IMPy}` (se proponen desde el modelo del Anexo C). Decisiones de Amo: viva de cubierta = Lr (L = 0);
  impacto de vehículos en combinaciones aparte 1.2D + 1.0IMP + 1.0L (se usa Lr al 1.0); sismo E = Fs/R con ±Ex ±Tx ±0.3Ey (`orto`), derivas sin R, servicio B.2.3 (con sismo opcional),
  `off[]` combinaciones desactivadas, `otras[]` {nom, txt} escritas como «1.2D + 1.0IMPx». Copiar/descargar tabla ComboName/ComboType/CaseName/ScaleSF.
  El Anexo C lee «COMBINATION DEFINITIONS» del .$2k (`modelo.combos`) y revisa que estén con los mismos factores.
  Torsión 1aP/1bP calculada: `tor{nudos,nudosY,casoX,casoY,res}`; desplazamientos de «JOINT DISPLACEMENTS» del mismo .$2k (exportar con Analysis Results → Joint Output → Displacements)
  o de la tabla pegada (`AnexoC.desplazamientos`); Δ = √(U1²+U2²), 1aP si Δmáx > 1.2·prom, 1bP si > 1.4·prom (`Combos.torsion`) → fija irrP 1aP/1bP. `modelo.desp.casos` lista los casos.
  Redundancia: `redundante`, `redCalc` (texto), `redImg` (`<id>/redundancia.jpg`), `redNota`.
  Impresión: irá en la MEMORIA GENERAL (texto principal; los anexos son el detalle). Pendiente: Amo enviará una memoria general de ejemplo.

## Almacenamiento
Supabase gratis = 1 GB de archivos. Flujo acordado: al aprobar, se descarga un ZIP (PDF + fuentes + datos_proyecto.json),
Amo lo guarda en su NAS, y la app libera el espacio dejando la ficha como "Archivada en NAS". (Pendiente de construir.)

## Estado
- Hecho: login, lista con medidor de espacio, nueva memoria (consecutivo DOC-MEM-DD-MM-AA), ficha con autoguardado,
  imagen 3D, revisiones, portada imprimible (carta), Configuración (perfiles, datos del ingeniero, firma, roles), vista Consulta.
- Hecho también: Anexo A (cargas muerta, viva y viento B.6.5 para cubierta libre a un agua), con páginas imprimibles.
- Hecho: Anexo B (FHE, iteraciones) y Anexo C (modelo SAP2000 desde .$2k).
- Hecho: paso Combinaciones e irregularidades (solo pantalla).
- Siguiente: memoria general (plantilla de Amo), D (IPE/HEA/tubulares, zapatas,
  pedestales), E (conexiones), F/G (PDF), archivo ZIP y PDF final con índice, rótulos y numeración.

## Pruebas
El entorno de trabajo no alcanza Supabase por red: probar con Playwright sustituyendo `vendor/supabase.js` por un cliente falso en memoria.
