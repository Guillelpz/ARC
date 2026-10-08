# Propuestas — ciclo 4

Contexto: ciclos 1 y 2 cerrados; ciclo 3 («Tus datos», aviso de copia, `persist`) se da por hecho. P3.4 (despliegue + IA) y P3.5 (cuentas) siguen pospuestas por decisión del usuario y no se reproponen. La deuda de la demo está casi saldada; el foco pasa al uso diario.

## P4.1 — Registrar en otro día (`producto`)
- Problema: todo registro se fecha con `nowStamp()` (`App.tsx:84`). Si el usuario olvida apuntar el domingo, el lunes ya no puede: el objetivo semanal, la comparación con la semana anterior y el ranking de party quedan mal para siempre. La corrección también está limitada a la semana en curso (`App.tsx:82`, clamp a `-week`).
- Propuesta: selector de día compacto en `TrackerCard` («Hoy» por defecto, «Ayer» y un `<input type="date">` nativo con `max` = hoy). El evento usa ese día + hora actual. La corrección se limita con el total de ese día, no con el de la semana. NO: horas editables, fechas futuras, registros masivos ni cambios en el cálculo de XP.
- Valor: alto (es el fallo más probable en uso diario) / Coste: S / Riesgo: bajo (el formato `occurredAt` y el validador `STAMP` de `storage.ts` ya aceptan cualquier fecha).
- Requiere: nada (sin dependencias; asserts nuevos en `selfcheck.ts` para «evento en día pasado cuenta en su semana» y para el nuevo clamp).
- Depende de: —

## P4.2 — Historial de una actividad y deshacer un registro concreto (`producto`)
- Problema: el usuario no ve qué ha registrado; solo totales (`TrackerCard.tsx:58-71`). La única forma de corregir es «restar n» a ciegas, y un error de cantidad (p. ej. 50 km en vez de 5) no se puede localizar.
- Propuesta: en cada tarjeta, un desplegable «Últimos registros» (nativo `<details>`) con los 10 eventos más recientes de esa actividad (día, cantidad, XP). Cada positivo tiene «Deshacer», que añade un evento negativo con el mismo `occurredAt` (se mantiene la regla de «solo eventos, nunca borrar»). NO: editar eventos en sitio, paginación, historial global.
- Valor: alto / Coste: S-M / Riesgo: bajo (no cambia el modelo; reutiliza la corrección negativa).
- Requiere: nada.
- Depende de: — (combina bien con P4.1: deshacer usa el día del evento, no hoy).

## P4.3 — Editar y archivar misiones propias (`producto`)
- Problema: una actividad creada en «Nuevo» no se puede tocar después: no hay edición ni borrado (ningún `onDelete`/`edit` en `src/`), y las custom nacen sin objetivo semanal (`selfcheck.ts:110`, `!med.weeklyGoal`), así que no tienen barra de progreso. Un error al crearla obliga a «Borrar todo».
- Propuesta: en tarjetas custom, editar nombre, incremento por defecto y objetivo semanal (opcional, solo HERO, como las fijas), y «Archivar» (se oculta de HERO/VILLAIN pero sus eventos siguen contando en el histórico y en XP; se puede reactivar desde la home). NO: cambiar rama ni `xpPerUnit` tras crear (alteraría XP pasada), editar las 6 fijas, borrado duro de eventos.
- Valor: medio-alto / Coste: M / Riesgo: medio (añade campos opcionales a `Tracker` en `life-rpg-custom-v1`; `readCustom` debe aceptarlos y los datos antiguos seguir siendo válidos, con test).
- Requiere: cambio de esquema compatible en `life-rpg-custom-v1` (campos opcionales `weeklyGoal`, `archived`); sin dependencias.
- Depende de: —

## P4.4 — Restaurar la copia interna desde la app (`deuda`)
- Problema: `loadAll` guarda `<clave>.backup.<stamp>` y el ciclo 3 añade `.backup.last` antes de importar o borrar, pero restaurar es manual en DevTools (`ponytail:` en `storage.ts`, §5 de ESTADO-ACTUAL). Los backups con sello nunca se borran y se acumulan en localStorage (análisis ciclo 1), lo que puede llenar la cuota y hacer fallar `save*`.
- Propuesta: en el bloque «Tus datos», si existe alguna copia interna, botón «Recuperar copia anterior (fecha)» que restaura la más reciente pasando por el mismo validador que importar (con confirmación y `backupCurrent` previo). Al restaurar o al cargar, conservar solo la copia con sello más reciente por clave. NO: lista de copias ni selector entre varias.
- Valor: medio (cierra el último camino de pérdida de datos que depende de DevTools) / Coste: S / Riesgo: bajo-medio (toca `storage.ts`; cubierto con tests de funciones puras).
- Requiere: nada.
- Depende de: ciclo 3 (bloque «Tus datos», `backupCurrent`).

## P4.5 — Tests de componentes para los flujos críticos (`calidad`)
- Problema: `npm test` solo cubre `selfcheck` y funciones puras de `storage.ts` (§5 «Calidad»). La lógica de `add()` en `App.tsx` (clamp de corrección, toasts, adelantamientos) y los flujos de importar/borrar no tienen ningún test, y P4.1-P4.3 los van a tocar.
- Propuesta: Testing Library + jsdom en Vitest con 4-6 tests: registrar suma a la semana, la corrección no baja de 0, importar una copia inválida muestra el aviso, «Borrar todo» cancelado no borra. NO: e2e con navegador real, snapshots, cobertura mínima en CI.
- Valor: medio (red de seguridad para los cambios de producto de este y próximos ciclos) / Coste: S-M / Riesgo: bajo.
- Requiere: dependencias de desarrollo (`@testing-library/react`, `jsdom`); ninguna de runtime.
- Depende de: — (mejor antes o junto a P4.1/P4.2).
