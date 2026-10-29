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
- `mem_config` (fila id=1): nombre_firma, matricula, iniciales, firma_path, prefijo, `software` (nombre del programa en lo impreso; default «software de análisis estructural»).
  Por licencia NO se nombra «SAP2000» ni su versión, ni en lo impreso (`swNom()` / `enSw()`) ni en la pantalla (decir «el modelo», «el software»). Solo en comentarios del código.
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
  Se unen al PDF final después de las páginas del Anexo A (paso «Generar PDF final»).
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
  Fuerzas (C-7): «ELEMENT FORCES - FRAMES» del .s2k → `modelo.fuerzas` = `fuerzasDe()`: grupos sección + función (Columna si |dz|/L > 0.9, Viga si < 0.15, si no Diagonal),
  solo combinaciones de resistencia (`combosResistencia`: con D y factor > 1, sismo o impacto; editable con chips, recalcula descargando el .s2k);
  por grupo `env` (máx/mín de P,V2,V3,T,M2,M3 con elemento, combinación y estación) y `crit` (filas concomitantes: comp, tens, M3, M2, V2, V3, T). Decisión de Amo:
  el Anexo D diseña con las filas concomitantes (toma la de mayor interacción) y la envolvente queda de referencia. Filas Max/Min de combinaciones envolventes = aviso.
  Pantalla con pestañas (`tabC`): archivo fijo arriba; «Información del modelo» (revisión + C-1…C-6) y «Resultados» (C-7). Impresión fuera de las pestañas.
  Ya probado con un .s2k real de Amo (v24.2.0).

- Cabecera de cada paso (28-oct, pedido de Amo; lo demás de la interfaz NO se reorganiza): `#hdActs` junto a Anterior/Siguiente con «🖨 Imprimir anexo» (`IMPRIME` → imprimirA/B/C/D; C abre `#hdPop` con «tablas completas»)
  y «✓ Marcar terminado» (con número de faltantes; al tocarlo muestra la lista; terminado → «Volver a abrir»). Ya no hay tarjetas «Páginas del Anexo X» ni barra `#listoBar` abajo.
- Anexo terminado (app.js `ANEXOS_LISTO`, `pintarListo()` llena `#hdActs`): la app revisa datos faltantes y habilita «✓ Marcar terminado»;
  guarda `X.listo` = huella de los datos (B incluye los del A) y `X.listoFecha`. Si los datos cambian, la huella ya no coincide y el paso vuelve a «en proceso» solo. B sin sismo = ✓ directo.
  D y E ya están en `ANEXOS_LISTO`.

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
  Pantalla de irregularidades = lista con desplegable por fila (opción A de Amo): `irrAbierta` (una a la vez); 1aP/1bP abren el cálculo de torsión, las demás una nota, φr el cálculo + foto.
  Redundancia: `redundante`, `redCalc` (texto), `redImg` (`<id>/redundancia.jpg`), `redNota`.
  Sismo por envolventes (método de Amo, `metodoE:'env'` por defecto; 'lineal' = combinación por combinación): componentes sin reducir SX1–8 / SY1–8 (±Ex ±Tx ±0.3Ey),
  envolventes `nomEX` «100% X 30% Y» y `nomEY` «30% X 100% Y» (tipo Envelope; sirven para derivas y torsión), U7X/U7Y = 1.2D + ENV/R y U8X/U8Y = 0.9D + ENV/R (Amo aprobó incluir 0.9D).
  Términos que usan otra combinación: `T('@Nombre', f, lbl)`. Tabla para SAP con CaseType (Combination / Linear Static).
  Impresión: irá en la MEMORIA GENERAL (texto principal; los anexos son el detalle). Pendiente: Amo enviará una memoria general de ejemplo.

- `anexos.D` (paso D con pestañas `tabD`: met / zap / ped; cálculo `calc/anexoD.js` = `AnexoD`, pantalla `anexoD-ui.js`, biblioteca `data/perfiles.js` = `PERFILES_LAM`
  111 perfiles IPE/IPN/HEA/HEB/HEM de la hoja PERFILES de Amo, en mm: [nombre, fam, h, b, tw, tf, r, A, Ix, Sx, Zx, Iy, Sy, Zy, J, Cw, kg/m]).
  `D.met[]` = {id, nom PF-n, desc, tipo I|HSS|BAR, perfil | H,B,t | d, acero, Lx,Ly,Lb,Lz [m], Kx,Ky,Kz,Cb, tension{U,nAg,dperno,tAg,roscada}, pernos{n,d,tipo,tpl,rosca},
  fuerzas 'grupo'|'manual', grupo 'sección|función' (de C-7), manual{P,V2,V3,T,M2,M3}, res (resumen guardado)}. «Crear desde el Anexo C» arma uno por grupo (`AnexoD.desdeNombre`). Lx NO se llena sola (decisión de Amo: la escribe él = longitud entre apoyos; antes se tomaba el elemento más largo del grupo y daba relaciones falsas).
  Fuerzas: todas las filas del grupo (`AnexoC.filasGrupos`, descarga el .s2k una vez por sesión; si falla, usa las filas críticas guardadas). Ejes SAP: M3/V2 fuerte, M2/V3 débil, P− compresión.
  NSR-10 F.2 con las 16 correcciones aprobadas por Amo (Cw b³/Iw, rts eje débil, LTB A/B/C ≤ Mp, FLB no compacta, φ eje menor, H1-1a/b (H3-6 en HSS si T > 0.2Tc),
  cortante φv/Aw correctos, torsión I por esfuerzo, L y K por eje, J de tabla; HSS t = 0.93t, Q (f = Fcr con Q=1), torsión (i)(ii)(iii), Aw = 2·h·t;
  tensión L/rmín ≤ 300, pernos 0.75·2.4·d·t·Fu y corte; barra: solo tensión, rotura 0.75, aviso si hay compresión). Verificado contra los Excel: IPE 200 φMn 56.5, IPE 120 13.2 (int 0.57).
  Dibujo de la sección con cotas (`svgSeccion`, I con radios, HSS, barra) + propiedades principales (`propsSeccion`, unidades 10⁶/10³ según tamaño) en pantalla (`#dSec`) y en el PDF de cada elemento.
  Diseño del software (mejora 9, aprobada 27-oct): `AnexoC.disenoDe` lee «STEEL DESIGN 1 - SUMMARY DATA - <norma>» y «STEEL DESIGN 2 - PMM DETAILS - <norma>» (columnas buscadas por patrón,
  pendiente confirmar nombres con un export real de Amo) → `modelo.diseno` {norma, n, max, porticos, conL, frames{F:{L,ratio,combo,tipo,portico,l33,l22,lltb,k33,k22,cb}}} (l = factor × L).
  Anexo C revisión: aviso de diseño, relaciones > 1, norma ≠ 360-10, pórtico vs `K.sisR` (DES→SMF, DMO→IMF, DMI→OMF).
  Anexo D: `calcMet` revisa cada elemento del grupo con sus filas (`res.porEl`, `res.Fc` = el que controla, `res.rp` = máx. del software); `el.fuente` 'programa' (L, K, Cb del software por elemento, `el.ov{F:{Lx,Ly,Lb,Cb}}` = ✎) | 'manual';
  nuevos desde el Anexo C = 'programa' si hay diseño con longitudes. Bloque `progHTML` en cada elemento, resumen `pintarCompSw` (#dComp, «Revisar» si |dif| > 15 %), tabla en el PDF `swPrintHTML` (10 mayores, solo L, Lx, Ly, Lb, Cb y relación D/C; sin la relación del software). En el PDF las longitudes y Cb se describen solo como «datos de cálculo» (sin decir que vienen del software; pedido de Amo 28-oct); en pantalla sigue igual.
  Bombillo 💡 (opción A de Amo, 28-oct): en cada chequeo que no cumple (metálicos, zapatas, pedestales; solo pantalla, rol ingeniero) `bulbHTML(sg)` con recuadro flotante fijo
  (por qué falla + cambio mínimo + alternativas). `calc/sugerencias.js` = `Sugerir.metal(el, filas, k)` (Lb/Ly por bisección, Cb, pernos, perfil siguiente de la familia, el más liviano de otra familia, tubos/barras),
  `Sugerir.zapata(z, serv, res, k)` (B=L, alargar, h, f'c, barra, pedestal, gancho) y `Sugerir.pedestal(p, res, k)`; cada opción se recalcula con las mismas fuerzas. Usa `R._uso` (elemento y filas del que controla).
  Botón «Ordenar por nombre» (orden natural) en las tres pestañas; el orden guardado es el del PDF.
  Concreto (`calc/concreto.js` = `Concreto`, pantalla `anexoDc-ui.js`): reacciones de «JOINT REACTIONS» del .$2k (`AnexoC.reacciones`, resumen en `modelo.reac` {nudos,casos,res,serv});
  combinaciones `D.cServ` / `D.cRes` (por defecto serv = con D y no de resistencia). `D.zap[]` {nom Z-n, nudos[], pos centrada|medianera|esquinera (αs 40/30/20), B,L,h,Df [m], ped (enlace → bx,by,Hp),
  qa, gs, qsup, fc, fy, rec [m], barX, barY, MmX/MmY (kN·m/m del modelo sobre resortes, se usa el mayor), imgs[] (`<id>/zapata-*.jpg`)}; chequeos Z1–Z6 aprobados (presión + núcleo, cortante, punzonamiento,
  flexión en la cara, Ld/gancho, aplastamiento). `D.ped[]` {nom PD-n, nudos[], b,h,rec [mm], Hp [m], barEsq (4 esquinas; vacío = bar), bar (intermedias; dos diámetros = opción A de Amo 28-oct), nx, ny, est, ramasX/Y, sConf, sFuera, k, zap (anclaje)}; P1, P3–P7 aprobados
  (P–M por compatibilidad con SVG, Bresler, esbeltez ≤ 22, cortante, confinamiento DMO, cargas simultáneas, anclaje); cuantía mínima 1 % de Ag = chequeo con tolerancia 0.5 % (Ast ≥ 0.995·0.01·Ag; C.10.9.1, pedido de Amo 28-oct; `rhoOk`, `AstMin`, bombillo 'rho'); la máxima 4 % solo aviso.
  Impresión: D-1 metálicos, luego Zapatas y Pedestales (numeración corrida si no hay metálicos).

- `anexos.E` (paso E; cálculo `calc/anexoE.js` = `AnexoE`, pantalla `anexoE-ui.js`), datos `E.con[]` = {id, tipo placa|vc|sold, nom CN-n|TP-n|SL-n, etiqueta (vacía = «Conexión PF-1 a PL-1 sobre PD-1» automática), desc, de, a (ids del Anexo D; 'PL' = platina), plN (PL-n),
  cargas 'modelo'|'manual', man{}, extremo ambos|i|j, nudos, res}. Opción A de Amo (28-oct): galería con dibujos para agregar + editor sobre el dibujo (cotas con recuadro `data-cota` → casilla flotante `#cotaPop`),
  fallas en rojo (`fallasE`), 💡 `sugE` (recalcula con las mismas cargas). Correcciones aprobadas a los Excel: P1–P12, V1–V9, S1–S5.
  Placa base: columna = PF (perfil), pedestal = PD (b,h,Hp,f'c; `ori` y = peralte d paralelo a Y del modelo → Mn = M1, Vn = F2), reacciones de los nudos del PD con `D.cRes`; Guía de diseño 1 (fp,máx con √(A2/A1) ≤ 2, ecrít con N, n con 0.8bf, Y por momento grande, t en compresión y tensión),
  anclajes C-D (φ 0.75/0.65 acero, 0.70 concreto; h'ef con 3+ bordes; ψc 1.0 fisurado; Abrg = arandela − perno; Avc correcto por sentido; pryout; interacción D.7 con la regla 0.2 y /1.2; reventón lateral), soldadura con el contorno real del I.
  Viga–columna: filas de los extremos de los elementos del grupo de la viga (M3, V2, P); Nf = M/(d − tf) + |P|/2; pernos, aplastamiento, An ≤ 0.85Ag, bloque, compresión K 0.65, soldadura 2b, columna (ala 6.25Fy·tf², alma, aplastamiento, panel), cartela con excentricidad. Pestañas (pedido de Amo 28-oct): Perfiles · Cubrejuntas y pernos · Cartela a cortante y pernos · Soldaduras · Cargas; cada una con secciones «Datos de la platina», «Datos de los pernos» y «Gráfico» (`#eGraf`: `svgCubrejunta` planta / `svgCartelaE` frente, agujeros d + 1.6 mm, cotas editables, bordes reales en rojo si < mínimo); también en el PDF.
  Chequeos agrupados por parte (`GRUPOS_E`: pernos, platina, viga, columna, cartela, soldaduras; placa: concreto, placa, anclajes acero/concreto, interacción, soldadura) en pantalla y PDF. Ayudas con fórmula bajo cada medida (`hvE`, `data-hv`, se recalculan al escribir): s, le, g, lu, L, b, h, e de las platinas; S1, S2, N, B, hef de la placa base. Aviso «no caben» corregido: L ≥ lu + (n − 1)·s + le (antes sumaba le dos veces).
  Soldaduras: formas según el elemento soldado (decisión de Amo 28-oct, `FORMAS_EL`): perfil I → I contorno, Ia solo alas, Iw solo alma, T; tubo → O, Hd/Hb dos lados, T; barra → c, T; platina (sin perfil, `de` vacío) → 1, 2, 3, L, C, U, O, T con b, d editables. Medidas del perfil con `segPerfil`; a tope = esfuerzos de la línea / t (metal base). Formas (`FORMAS`) por segmentos (`propLineas`: A, centroide, Ix, Iy, J); f = √(fx²+fy²+fz²) en cada extremo; NSR-10 φ·0.6·FEXX sobre 0.707w, metal base, tamaños mín./máx.
  Verificado: J del L 100×150 = 852 083 y G (20, 45) del ejemplo del PDF; flexión local del ala HEA 200 = 194 kN (Excel 192). Impresión `imprimirE` (E-1 resumen + E-1.n con dibujos, datos, chequeos y cálculo).

## Documentos (29-oct, decisiones de Amo: F = planos, G = estudio de suelos, PDF final en dos pasos) — `documentos-ui.js`
- Paso `FG`: `anexos.F` / `anexos.G` = {aplica, desc, nota, archivos[{nombre,path,kb,pags,fecha}]}; PDF en Supabase `<id>/anexoF|G/<ts>-<nombre>.pdf` (máx. 50 MB c/u), orden ↑↓, ver, quitar.
- Paso `gen`: revisión de todos los pasos → Paso 1 `imprimirCompleta()` (portada + anexos A–E con `htmlAnexo()` + portadas de F y G `portadaFG()`; `@page` .85/.75/1.05 in y `@page portada{margin:0}`; B sin sismo = página con la nota de alcance)
  → Paso 2 `unirPDF()`: pdf.js lee el texto y ubica «ANEXO X - »; pdf-lib arma: portada, índice (Garamond TTF, puntos guía), anexos, fichas técnicas del Anexo A después de A, archivos de F/G detrás de su portada;
  rótulo en cada página (consecutivo y nombre arriba; pie del perfil y «X / Y» abajo, como la portada) y solo el número en la esquina de los PDF anexos. Opciones `gen.op` {indice, fichas, rotulo, numExt}. `gen.impreso`, `gen.unido`.
- Librerías locales (se cargan solo en este paso): `vendor/pdf-lib.min.js` (1.17.1, MIT), `vendor/fontkit.min.js` (@pdf-lib/fontkit 1.1.1, MIT), `vendor/pdf.min.mjs` + `pdf.worker.min.mjs` (pdfjs-dist 4.10.38, Apache-2.0, `isEvalSupported:false`);
  fuentes `fonts/ebg-400.ttf`, `ebg-600.ttf`, `ebg-400i.ttf` (EB Garamond OFL, convertidas de woff2 porque pdf-lib no incrusta woff2).
- Memoria general (paso `MG`, `memoria-ui.js`, 29-oct; ejemplo de Amo DOC-MEM-18-08-26 La Brasa, 296 págs.): «automático + editable», figuras «ambas», las cuatro listas.
  `anexos.M` = {txt{clave: texto propio (vacío = automático)}, img{clave:{path,nota}} (`<id>/memoria-<clave>-<ts>.jpg`), dat{uso, zona, nPisos, ejesL, ejesN, impF, impH}}.
  `memDoc(ctx, ed)` arma los capítulos 1–10 (generalidades, introducción, planta, ubicación, materiales, cargas A/B, R y irregularidades K, combinaciones K, análisis: derivas y torsión con `K.tor.res`, resumen de cada PF (CHK), pedestales, zapatas, conexiones con `descCon`) numerando títulos, tablas y figuras;
  en la impresión cada uno lleva una marca invisible `.mk` «@@H<id>@@ / @@T<i>@@ / @@F<i>@@»; `gen.impreso` guarda toc/tabs/figs. Separadores «ANEXO X» (`sepAnexo`, marca @@S<L>@@, `gen.op.sep`).
  Paso 2: tabla de contenido (capítulos + anexos + A-1 fichas + archivos F/G), lista de tablas, de figuras y de anexos, paginadas con puntos guía; numeración final = posición + páginas de las listas.
- Pendiente: ZIP para el NAS.

## Estilo (opción A de Amo, 29-oct: sobrio, «el tamaño ordena, el color solo dice si cumple»)
Bloque al final de `app.css`: títulos de tarjeta 16 px azul oscuro sin mayúsculas; subtítulos 12.5 px gris oscuro; totales `.wtot` en franja gris con raya azul oscuro (roja si no cumple);
cálculo detallado en letra de máquina; pestañas subrayadas; avisos con barra a la izquierda; verde/rojo solo en Cumple / No cumple; botones azul oscuro liso.

## Almacenamiento
Supabase gratis = 1 GB de archivos. Flujo acordado: al aprobar, se descarga un ZIP (PDF + fuentes + datos_proyecto.json),
Amo lo guarda en su NAS, y la app libera el espacio dejando la ficha como "Archivada en NAS". (Pendiente de construir.)

## Estado
- Hecho: login, lista con medidor de espacio, nueva memoria (consecutivo DOC-MEM-DD-MM-AA), ficha con autoguardado,
  imagen 3D, revisiones, portada imprimible (carta), Configuración (perfiles, datos del ingeniero, firma, roles), vista Consulta.
- Hecho también: Anexo A (cargas muerta, viva y viento B.6.5 para cubierta libre a un agua), con páginas imprimibles.
- Hecho: Anexo B (FHE, iteraciones) y Anexo C (modelo SAP2000 desde .$2k).
- Hecho: paso Combinaciones e irregularidades (solo pantalla).
- Hecho: Anexo D elementos metálicos.
- Hecho: Anexo D concreto (zapatas y pedestales).
- Hecho: Anexo E conexiones (placa base, viga–columna, soldaduras).
- Hecho: Anexos F y G (PDF) y PDF final en dos pasos (índice, fichas, rótulos, numeración).
- Hecho: memoria general (capítulos 1–10) con tabla de contenido y listas.
- Siguiente: archivo ZIP para el NAS.

## Pruebas
El entorno de trabajo no alcanza Supabase por red: probar con Playwright sustituyendo `vendor/supabase.js` por un cliente falso en memoria.
