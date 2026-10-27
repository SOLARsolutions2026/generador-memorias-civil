# Generador de Memorias de Cálculo — notas del proyecto

App web de P. Electric S.A.S. (Departamento Civil) para armar memorias de cálculo de estructuras metálicas (NSR-10).
Usuario principal: Gabriel Tellez ("Amo"), ingeniero civil. Explicar en español, simple y paso a paso.

## Tecnología (no cambiar sin consultar)
- HTML + CSS + JS puro, **sin compilación**. Publicada en GitHub Pages: https://solarsolutions2026.github.io/generador-memorias-civil/
- Instalable en el celular (PWA): `manifest.webmanifest` + `sw.js`. Al cambiar archivos, subir la versión de `CACHE` en `sw.js`.
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
- Impresión de anexos: `imprimirConMargen()` agrega `@page` con márgenes solo al imprimir (la portada usa margen 0).

## Almacenamiento
Supabase gratis = 1 GB de archivos. Flujo acordado: al aprobar, se descarga un ZIP (PDF + fuentes + datos_proyecto.json),
Amo lo guarda en su NAS, y la app libera el espacio dejando la ficha como "Archivada en NAS". (Pendiente de construir.)

## Estado
- Hecho: login, lista con medidor de espacio, nueva memoria (consecutivo DOC-MEM-DD-MM-AA), ficha con autoguardado,
  imagen 3D, revisiones, portada imprimible (carta), Configuración (perfiles, datos del ingeniero, firma, roles), vista Consulta.
- Hecho también: Anexo A (cargas muerta, viva y viento B.6.5 para cubierta libre a un agua), con páginas imprimibles.
- Siguiente: B (FHE), C (SAP2000), D (IPE/HEA/tubulares, zapatas,
  pedestales), E (conexiones), F/G (PDF), archivo ZIP y PDF final con índice, rótulos y numeración.

## Pruebas
El entorno de trabajo no alcanza Supabase por red: probar con Playwright sustituyendo `vendor/supabase.js` por un cliente falso en memoria.
