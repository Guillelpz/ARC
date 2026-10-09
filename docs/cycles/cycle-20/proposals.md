# Propuestas — ciclo 20

Contexto: desde el ciclo 19 cada push a main que toque `app/` publica en https://guillelpz.github.io/ARC/ (`.github/workflows/deploy-pages.yml`). Los riesgos que señala el análisis del ciclo 19 son tres: producción sin barrera, colisiones entre pestañas y persistencia solo local. Propongo poco: dos cosas baratas que reducen riesgo hoy y una decisión del usuario para lo que más valor tiene (sincronización).

## P20.1 — Proteger producción: rama, entorno y vuelta atrás (`infra`)
- Problema: cualquier push a main publica, y la única puerta es la CI del propio push (`deploy-pages.yml:3-33`). El menor 2 del ciclo 19 sigue abierto: `workflow_dispatch` lanzado desde otra rama puede publicar si el entorno `github-pages` no restringe ramas. No hay procedimiento documentado para volver a la versión anterior si una regresión pasa la puerta.
- Propuesta:
  - **Código (S):** en `deploy-pages.yml`, `if: github.ref == 'refs/heads/main'` en el job, para que la protección no dependa solo de la configuración de GitHub. Después de `deploy-pages`, un paso de humo con `curl -fsS` a la URL publicada (`index.html` 200 y contiene el `<title>`; `sw.js` 200). Si falla, el job sale en rojo y se ve en la pestaña Actions. Con `sw_kill` se salta este paso, igual que el resto de puertas, y la spec debe decirlo de forma explícita (lección del ciclo 19).
  - **Docs:** sección «Volver atrás» en `docs/DEPLOY.md`: Actions → ejecución verde anterior → «Re-run all jobs». Así se vuelve a publicar el commit antiguo sin tocar git. Si lo roto es el SW, se usa `sw_kill`.
  - **Pasos del usuario en GitHub (no es código; el orquestador no puede hacerlo):**
    1. Settings → Environments → `github-pages` → Deployment branches and tags → «Selected branches» → solo `main`. Cierra el menor 2.
    2. Settings → Rules → Rulesets → New branch ruleset sobre `main`: «Block force pushes» y «Restrict deletions». No marcar «Require a pull request» mientras el flujo sea push directo del orquestador, porque bloquearía el cierre de cada ciclo.
    3. Opcional: en el entorno `github-pages`, «Required reviewers» = el propio usuario. Cada despliegue espera un clic de aprobación. Es la barrera más fuerte, pero también la más lenta; recomiendo empezar sin ella.
  - NO: staging separado, PRs obligatorios ni cambios en la CI de `ci.yml`.
- Valor: alto (una regresión deja de llegar en silencio, existe una vuelta atrás conocida y se cierra el menor 2) / Coste: S / Riesgo: bajo. El paso de humo no puede romper el despliegue, porque se ejecuta después de publicar.
- Requiere: los pasos 1–2 los hace el usuario en la web de GitHub. Nada de runtime.
- Depende de: —

## P20.2 — No pisar los datos de otra pestaña tras un aviso de datos dañados (`deuda`)
- Problema: menor 3 del ciclo 19 (`App.tsx:75`, `ponytail:`). Si el evento `storage` trae datos con problemas, la pestaña conserva su estado viejo, pero la clave sigue desbloqueada. Al siguiente registro, `saveEvents`/`saveCustom` sobrescribe lo que escribió la otra pestaña. El original queda en `.backup.<stamp>`, pero recuperarlo es manual en DevTools (§5 de ESTADO-ACTUAL). Es el único camino de pérdida de datos entre pestañas que se puede alcanzar sin una carrera de milisegundos.
- Propuesta: aplicar a las claves con problemas el mismo bloqueo que ya existe en `storage.ts` (el `Set` `locked`: `saveEvents`/`saveCustom` devuelven `null` y no escriben). Por ejemplo, que `loadAll` bloquee las claves con problemas, o un `lockStorage(keys)` llamado desde `onStorage`. Con la clave bloqueada, el aviso existente pide recargar. Un test en `storage.test` o `App.test`: un `storage` con datos corruptos seguido de un registro no sobrescribe la clave. NO: fusionar eventos entre pestañas ni Web Locks. La carrera «dos escrituras en el mismo instante» exige que la misma persona registre en dos pestañas en milisegundos; no compensa y se queda el `ponytail:`.
- Valor: medio (cierra una pérdida de datos real, aunque rara) / Coste: S / Riesgo: bajo (el mecanismo de bloqueo ya está probado al arrancar).
- Requiere: nada.
- Depende de: —

## P20.3 — Decidir la sincronización: plan mínimo sin cuentas (`infra`, necesita decisión del usuario)
- Problema: los datos solo viven en el localStorage de un origen (§5 de ESTADO-ACTUAL, «Persistencia» y «Usuarios»). Si se borra el navegador o se cambia de móvil, se pierde todo, salvo que el usuario haya exportado a mano. Ahora que hay usuarios reales en producción, es el mayor riesgo de pérdida de datos. P3.5 (cuentas) está pospuesta porque era cara.
- Propuesta: **este ciclo solo pide la decisión**, no implementa nada. Plan mínimo y barato para aprobar o rechazar:
  - Sin cuentas ni auth: una **clave de sincronización** de 128 bits aleatorios, generada en el dispositivo, que el usuario copia al otro dispositivo (texto o QR). Quien tiene la clave tiene los datos. No hay email, contraseña ni datos personales.
  - Servidor: un Cloudflare Worker con KV (plan gratuito) y dos rutas, `GET /sync/:hash` y `PUT /sync/:hash`, guardando un JSON por clave (el mismo formato que exportar). La fusión se hace en el cliente: unión de `ActivityEvent` por `id`, que ya es único y de solo añadir. Para `custom`, gana la última escritura. «Borrar todo» y la importación tendrían que propagarse como marca explícita; es el punto delicado.
  - Encaja con P13.4: el mismo Worker podría servir más adelante el endpoint de IA, aunque P13.4 sigue sin aprobar y no se incluye.
  - Coste si se aprueba: M para el Worker y la sincronización manual con un botón «Sincronizar»; L si se quiere automática y en segundo plano.
  - NO: cuentas, PARTY real ni sincronización en tiempo real.
- Valor: alto (es la única propuesta que resuelve de verdad la pérdida por dispositivo) / Coste: S para decidir; M para implementar en un ciclo posterior / Riesgo: alto. Los datos pasan a estar en un servidor de terceros, una clave filtrada expone el historial, hay un servicio más que mantener y la fusión con borrados es delicada.
- Requiere: decisión del usuario (proveedor, cuenta de Cloudflare o alternativa, aceptar datos en servidor) y un primer servidor. Ninguna dependencia de runtime en el cliente (`fetch`).
- Depende de: P20.1 (antes de añadir un servicio, conviene que producción tenga vuelta atrás).
