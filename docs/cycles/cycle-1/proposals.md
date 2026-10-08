# Propuestas — ciclo 1

Primer ciclo tras la demo. Orden = prioridad: P1.1 desbloquea P1.2; P1.3 y P1.4 son independientes.

## P1.1 — Fecha real en lugar de `DEMO_DATE` (`deuda`)
- Problema: «hoy» es siempre `2026-10-07`. `App.tsx` pasa `DEMO_DATE` a `deriveGame`/`derivePartyState` (l. 49, 51, 67, 75) y `nowStamp` (l. 18) fecha todo registro nuevo el 7 oct con la hora real. Un usuario real registra en un día que no es el suyo y la semana nunca avanza (ESTADO-ACTUAL §5, «Fecha»).
- Propuesta: `App.tsx` calcula la fecha local real (`YYYY-MM-DD` en zona del navegador, no `toISOString()`, que es UTC) y la usa para derivar y para `nowStamp`. El motor ya recibe `today` como parámetro, así que `core/` no cambia; `selfcheck.ts` sigue usando `DEMO_DATE` fijo y sus asserts no se tocan. NO: cambiar reglas de semana, ni editar la fecha de un registro, ni zonas horarias por usuario.
- Valor alto (sin esto la app no sirve a diario) / Coste S / Riesgo medio (cambio de día con la app abierta y desfase UTC; con la fecha real los 28 eventos semilla quedan en semanas pasadas → lo resuelve P1.2).
- Requiere: nada.
- Depende de: —

## P1.2 — Onboarding vacío con «Cargar ejemplo» y salida de la demo (`deuda`)
- Problema: un usuario nuevo arranca con 28 eventos ficticios (`storage.ts` l. 8 devuelve `SEED_EVENTS`) y la home ofrece «Restablecer demo» (`HomeView.tsx` l. 97). Decisión del usuario en `STATE.md`: arrancar vacío con botón «Cargar ejemplo».
- Propuesta: sin datos guardados → lista vacía y estado vacío con «Cargar ejemplo». La semilla se genera relativa a la fecha real (mismos 28 eventos desplazados para que caigan en esta semana y la anterior); `selfcheck` sigue usando la semilla fija. Renombrar claves de localStorage (sin «demo») migrando las `-v1` existentes sin perder datos. Revisar copy con «demo» (ESTADO-ACTUAL §5, «Copy»). NO: tutorial, pasos guiados ni tocar PARTY simulada (sigue mostrándose como ejemplo).
- Valor alto / Coste M / Riesgo medio (la migración de claves es el punto donde se pueden perder datos de quien ya usa la app).
- Requiere: nada.
- Depende de: P1.1

## P1.3 — No perder datos: validar al leer y exportar/importar copia (`calidad`)
- Problema: `loadEvents()` acepta cualquier array sin validar sus elementos (`storage.ts` l. 7), al contrario de lo que dice ESTADO-ACTUAL §4. Y si el JSON está corrupto devuelve la semilla, que el `useEffect` de `App.tsx` (l. 29) guarda encima: los datos originales se sobrescriben sin aviso. Además la única copia vive en un navegador (§5, «Persistencia»).
- Propuesta: validar cada evento como ya hace `parseCustom`; si la clave existe pero es ilegible, no sobrescribirla (guardarla aparte y avisar). Botones «Exportar» (descarga JSON con eventos + custom) e «Importar» (valida y reemplaza, con confirmación). NO: sincronización, backend ni copias automáticas.
- Valor alto (es la única protección hasta tener backend) / Coste S / Riesgo bajo
- Requiere: nada (Blob + `<input type="file">` nativos).
- Depende de: — (si va junto a P1.2, la migración de claves usa esta validación).

## P1.4 — Tests ejecutables: `selfcheck` como `npm test` (`calidad`)
- Problema: el oráculo de dominio solo corre en DEV, en la consola del navegador (`main.tsx`); un fallo no rompe nada y nadie lo ve sin abrir la app (§5, «Calidad»). Los ciclos siguientes tocan `core/` (fecha, semilla, storage) sin red de seguridad.
- Propuesta: añadir Vitest (dependencia de desarrollo) y un `npm test` que ejecute los asserts de `selfcheck.ts` sin cambiarlos, más tests de `storage.ts` (validación y migración de P1.2/P1.3). `npm test` pasa a ser gate del paso 5 junto a build y lint. NO: tests de componentes, e2e ni CI remota (no hay remoto).
- Valor medio-alto (desbloquea refactors seguros) / Coste S / Riesgo bajo
- Requiere: nada de runtime (Vitest solo dev).
- Depende de: —
