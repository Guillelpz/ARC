# Propuestas — ciclo 19

> Contexto: la app ya está publicada en https://guillelpz.github.io/ARC/ y el ciclo 14 (PWA + e2e) se da por hecho. El ciclo 14 ya cubre la robustez ante versiones nuevas: `index.html` se pide primero a la red, hay aviso «Hay una versión nueva», `reg.update()` y kill switch (`TECH_SPEC-pwa-y-e2e.md` §7). El primer uso también está cubierto: estado vacío con «Cargar ejemplo», etiqueta «Party de ejemplo» y «Tus datos se guardan solo en este navegador» (`HomeView.tsx:122`, `:252`; `PartyView.tsx:73`). Por eso solo se proponen los tres huecos que aparecen al estar en producción.

## P19.1 — Desplegar automáticamente al hacer push a `main` (`infra`)
- Problema: `deploy-pages.yml` solo tiene `workflow_dispatch` (l.2-3) y el comentario de cabecera ya explica cómo activarlo. Como tras cada ciclo cerrado se hace push de `main` (decisión del 2026-10-09), cada cierre exige además lanzar «Run workflow» a mano. Si se olvida, el sitio publicado se queda en una versión anterior a la que dicen `ESTADO-ACTUAL` y los análisis.
- Propuesta: añadir `push: { branches: [main] }` sin quitar `workflow_dispatch`, que sigue haciendo falta para el input `sw_kill`. Antes de publicar, el job tiene que pasar lo mismo que la CI, también el e2e del ciclo 14 si no está ya en el job. Hay que comprobar que en un push `inputs.sw_kill` vale vacío y no activa el kill switch. Se actualizan el comentario de cabecera y `DEPLOY.md`. NO: despliegues de vista previa por rama o PR, entornos de staging ni versionado o etiquetas de release.
- Valor: medio (el sitio siempre coincide con `main` y se quita un paso manual en cada cierre) / Coste: S / Riesgo: bajo. Un push roto llega a los usuarios, pero solo se hace push tras la revisión, el job ejecuta los tests y el kill switch del ciclo 14 sirve de red.
- Requiere: nada (sin dependencias de runtime). Es un cambio de proceso: a partir de aquí, todo push a `main` publica.
- Depende de: ciclo 14 (kill switch y e2e).

## P19.2 — No perder registros con la app abierta en dos pestañas o ventanas (`calidad`)
- Problema: `saveEvents` y `saveCustom` (`storage.ts:112-119`) escriben el array o el objeto completo desde el estado en memoria de cada pestaña, y no hay ningún listener de `storage` (Grep en `src/`: 0 coincidencias). Con la PWA instalada es fácil tener a la vez la ventana instalada y una pestaña del navegador: lo que se registra en una se pierde en silencio cuando la otra guarda (gana la última escritura). Hoy es la vía más probable de que un usuario real pierda datos sin aviso.
- Propuesta: en `App.tsx`, escuchar `window` `storage` para `life-rpg-demo-v1` y `life-rpg-custom-v1` y, cuando cambien, recargar el estado con `loadAll()`. Se sustituye el estado entero, sin fusionar: la otra pestaña ya escribió el estado completo. Hay que evitar que esa recarga vuelva a disparar un guardado que pise lo recibido, o asegurarse de que no hace daño. Se añade un test de UI que simula el evento `storage` y comprueba que la vista muestra el registro nuevo. NO: `BroadcastChannel`, bloqueos (Web Locks), fusión de eventos ni aviso propio.
- Valor: alto (cierra una pérdida silenciosa de datos que solo existe en producción con PWA) / Coste: S / Riesgo: bajo-medio (hay que vigilar los efectos de guardado y los avisos de carga que muestra `problems`).
- Requiere: nada.
- Depende de: —

## P19.3 — Vista previa del enlace al compartirlo (`producto`)
- Problema: la vía de entrada de un usuario nuevo es el enlace, y `index.html` solo tiene `<title>Life RPG</title>`: no hay `description` ni etiquetas Open Graph. Al pegarlo en WhatsApp o Telegram sale un enlace pelado que no dice qué es la app.
- Propuesta: en `index.html`, añadir `meta description`, `og:title`, `og:description`, `og:type`, `og:url` (la URL de Pages) y `og:image` reutilizando el icono PNG de la PWA del ciclo 14 con URL absoluta. El texto tiene que seguir el tono de `STYLE_GUIDE.md`. NO: imagen social diseñada aparte, Twitter cards específicas, analítica ni landing page.
- Valor: bajo-medio (primera impresión de quien recibe el enlace) / Coste: S / Riesgo: bajo. Puede ir dentro del mismo ciclo que P19.1 como menor.
- Requiere: nada.
- Depende de: ciclo 14 (icono PNG).

## No se proponen
- **P13.4 (IA en servidor):** desplegar no lo abarata, lo encarece. GitHub Pages no ejecuta código de servidor, así que haría falta un segundo proveedor (p. ej. un Worker), una key de pago y protección contra abuso en un endpoint público, para una clasificación que la heurística ya resuelve. No ha cambiado nada a favor.
- **P3.5 (cuentas + sincronización):** sigue sin evidencia de usuarios que la pidan. El riesgo de pérdida que existe hoy (varias pestañas) se cierra con P19.2 sin backend. Se reabre si algún usuario real pide usar varios dispositivos.
- **Menor del ciclo 17** (leyenda de «Últimas semanas» a 390 px): ahora el usuario la puede comprobar en el sitio publicado. Si falla, entra como menor del ciclo que se abra, sin propuesta propia.
