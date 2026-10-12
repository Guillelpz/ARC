# Estado actual — RPG Life Tracker

> Fecha de corte: 2026-10-12 (tras ciclo 22). Describe lo que hay en el código que no está ya en `CLAUDE.md` (comandos, arquitectura de `core/`, restricciones) y lo que lo separa de un producto en producción.

## 1. Qué es

App web (móvil primero) que convierte actividades de la vida real en un personaje RPG:

- **HERO**: hábitos (Gym, BJJ, Running, Reading + los que cree el usuario).
- **VILLAIN**: vicios (Beer, Burgers + los que cree el usuario).
- Cada registro suma XP a la actividad, a su rama y al nivel global **PLAYER**.
- **Party**: grupos de amigos con criterios propios; una actividad solo cuenta en una party si esa party la aceptó.

## 2. Funcionalidad implementada

| Pantalla (`screen`) | Qué hace |
|---|---|
| Inicio (`home`) | Bloque «Hoy» (XP neta de hoy por rama, registrado hoy con «Deshacer» por fila (anula ese registro; mueve el foco a «Hoy» si desaparece la fila), «Te faltan» con días restantes y mejor racha; cada fila lleva a su rama y tiene un «+» que registra el incremento de hoy, moviendo el foco a «Hoy» si con eso se cumple el objetivo), nivel PLAYER, ramas HERO/VILLAIN, composición %, bloque «Últimas semanas» (HERO vs VILLAIN: XP por semana, últimas 8, barras CSS, semana en curso con borde discontinuo, lista `sr-only`; solo con XP), resumen de parties, estado vacío de bienvenida para usuario nuevo, bloque «Tus datos» (estado de la última copia y aviso si pasan 14 días con datos), «Cargar ejemplo» / «Borrar todo» (con confirmación; «Borrar todo» ofrece exportar antes), «Exportar copia» / «Importar copia» (JSON, con confirmación) / «Importar y fusionar» (une la copia con los datos actuales sin perder lo local; avisa si no hay nada nuevo o la copia es antigua; deshacible con «Recuperar copia anterior»), «Compartir» la copia (hoja del sistema solo en la PWA instalada en táctil; si no, descarga), «Recuperar copia anterior» (intercambia el estado actual con `.backup.last`; repetirlo deshace) y aviso si al cargar se perdieron o descartaron datos. |
| HERO / VILLAIN (`hero`, `villain`) | Tarjetas de actividad: registro con incremento fijo, selector de día («Hoy», «Ayer» o fecha pasada) para registrar y corregir, corrección (evento negativo, limitada al total de ese día), «Últimos registros» (10 más recientes) con «Deshacer», semana actual vs. mismo tramo de la anterior, objetivo semanal con chip de racha semanal (semanas seguidas cumpliendo el objetivo vigente en cada semana; cambiar el objetivo no reescribe el pasado; no da XP), «Últimas 8 semanas» (barras CSS por semana, `Check` si cumplida, borde discontinuo la semana en curso, lista `sr-only`), XP y nivel por actividad, en qué parties cuenta. |
| Actividades propias | (Las 4 fijas HERO editan solo su objetivo semanal; campo vacío = valor por defecto.) En su tarjeta (HERO/VILLAIN) se pueden editar nombre, incremento y objetivo semanal (solo HERO) y archivar; no se cambia rama, tipo, unidad ni XP/unidad. Las archivadas se ocultan de las tarjetas, pero su XP, histórico y parties siguen contando; se reactivan desde Inicio o con «Reactivar» en Nuevo si el usuario escribe su nombre. |
| Nuevo (`new`) | Crear actividad propia: texto libre → clasificación (Claude Haiku o heurística local) → el usuario confirma rama, tipo, unidad y XP/unidad. Detecta actividades parecidas ya existentes, incluidas las archivadas (ofrece «Reactivar»). Permite proponerla a parties. |
| Party (`party`) | Dos parties fijas (*Los del Gym*, *La Oficina*), criterios aceptados/rechazados, ranking semanal (HERO, VILLAIN, profundidad; los amigos simulados puntúan prorrateados por día de la semana), «proponer actividad existente» desde una tarjeta custom a parties donde aún no hay criterio ni rechazo, y nivel del usuario calculado solo con los criterios de esa party. |

Si un guardado en localStorage falla, la home y la rama activa muestran un aviso persistente con «Exportar copia ahora» (también anunciado en `role="status"`); desaparece con el siguiente guardado correcto.

Feedback: avisos anunciados por regiones `role="status"` (`liveText` en `components/liveText.ts`); toast de level-up / level-down, XP flotante, aviso de adelantamientos en el ranking. Transiciones con View Transitions API (`src/viewTransition.ts`).

## 3. Detalles de implementación

- **Deshacer:** un negativo con el mismo `occurredAt` y `undoes: <id>` del positivo anulado (nunca se borra ni edita un evento). Solo un negativo con `undoes` anula; deshacer algo ya deshecho se ignora.
- **Objetivos:** `allTrackers(custom, goals, goalLog)` aplica los overrides de las fijas HERO y adjunta `pastGoals`. `goalLog` apunta el objetivo anterior al cambiarlo (`until` = lunes exclusivo).
- **Persistencia:** `readEvents`/`readCustom` separan descartados de reparados (un `undoes` inválido se repara conservando el evento). Clave ilegible → arranca vacía (no semilla). Las claves desconocidas de `life-rpg-custom-v1` se conservan al guardar. Si la copia interna falla antes de borrar/importar, se aborta con aviso; si falla el backup de una clave corrupta, la clave se bloquea (`save*` devuelve `null`) hasta importar una copia. La app restaura solo `.backup.last` (`.backup.prev` y `.backup.<stamp>` solo por DevTools; los sellados no se purgan).
- **Sincronía entre pestañas:** `App.tsx` escucha el evento `storage` (solo `KEY`/`CUSTOM_KEY`, ignora `.backup.*`; `META` solo actualiza `lastExport`) y sustituye el estado. Si los datos de la otra pestaña traen problemas, bloquea la escritura (`lockStorage`), muestra el banner fijo `UpdateBanner` y deshabilita «Borrar todo», «Importar» y «Recuperar» hasta recargar, recibir datos válidos, importar o recuperar.
- **PWA:** `manifest.webmanifest` e iconos en `app/public/`; plantilla `app/sw.js`: index.html network-first, assets cache-first, caché `rpg-life-*`, `skipWaiting`/`clients.claim`. Aviso «Recargar» con tono de pantalla (`bannerTones.ts`).
- **Despliegue:** repo público https://github.com/Guillelpz/ARC → https://guillelpz.github.io/ARC/. Tras desplegar, un paso de humo comprueba (5 reintentos) que producción sirve el `assets/index-*.js` y la primera línea de `sw.js` del build; si falla, el job queda rojo (no bloquea). Meta description y Open Graph en `app/index.html` con URL absoluta de Pages.
- **Tests:** en tests de UI que lean localStorage tras una acción asíncrona, esperar con `vi.waitFor` (el guardado va en un efecto). `npm run e2e` reconstruye `dist/` con base `/ARC/` (no sirve luego para un preview en raíz).

## 4. Lo que falta para producción

| Área | Estado actual | Implicación |
|---|---|---|
| Party | Amigos, parties y votos son ficticios y deterministas (`PARTIES`, `stance`). | Requiere backend, cuentas e invitaciones para ser real. |
| Usuarios | Un único usuario local, sin cuenta. | Sin auth ni sincronización entre dispositivos (solo «Importar y fusionar»). |
| Persistencia | Solo localStorage, con exportar/importar manual. Las claves llevan «demo» en el nombre. | Pérdida de datos al borrar el navegador (persist es solo petición); recordatorio fijo de 14 días, sin copias automáticas ni migraciones de esquema. |
| IA | Proxy de Vite solo en local; sin reintentos, caché ni límite de uso. | En producción solo heurística. |
| Progresión | Umbrales lineales y XP/unidad fijos; sin límite de registros por día. | Balance de juego sin validar con usuarios. |
| Calidad | El aviso de versión nueva e iOS solo en el checklist manual de `DEPLOY.md`. | Ampliar `App.test.tsx` al añadir flujos; los tests dependen de textos de la UI. |
| Copy | Quedan textos y claves con «demo» (`life-rpg-demo-v1`, «Party de ejemplo»). | Se quedan de momento (decisión 2026-10-12). |

Simplificaciones deliberadas: comentarios `ponytail:` en el código (`git grep -n "ponytail:"`).

Pendiente de verificar a mano: el aviso «Copia exportada…» de `reset()` llega tras la hoja de compartir (iPhone real).
