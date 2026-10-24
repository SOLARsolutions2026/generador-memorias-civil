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

## Almacenamiento
Supabase gratis = 1 GB de archivos. Flujo acordado: al aprobar, se descarga un ZIP (PDF + fuentes + datos_proyecto.json),
Amo lo guarda en su NAS, y la app libera el espacio dejando la ficha como "Archivada en NAS". (Pendiente de construir.)

## Estado
- Hecho: login, lista con medidor de espacio, nueva memoria (consecutivo DOC-MEM-DD-MM-AA), ficha con autoguardado,
  imagen 3D, revisiones, portada imprimible (carta), Configuración (perfiles, datos del ingeniero, firma, roles), vista Consulta.
- Siguiente: Anexo A (cargas) con las plantillas Excel de Amo; luego B (FHE), C (SAP2000), D (IPE/HEA/tubulares, zapatas,
  pedestales), E (conexiones), F/G (PDF), archivo ZIP y PDF final con índice, rótulos y numeración.

## Pruebas
El entorno de trabajo no alcanza Supabase por red: probar con Playwright sustituyendo `vendor/supabase.js` por un cliente falso en memoria.
