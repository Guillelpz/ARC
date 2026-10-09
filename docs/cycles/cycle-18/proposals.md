# Propuestas — ciclo 18

> **Recomendación: el producto local está maduro. Lo que más valor aporta ahora depende de decisiones del usuario, no de otro ciclo local.**
> Tras los ciclos 16 y 17 (tendencia por actividad y HERO frente a VILLAIN), la app local cubre registro, corrección, historial, objetivos, rachas, tendencias y protección de datos (validación, backups, exportar/importar, restaurar). Los huecos que quedan en §5 de `docs/ESTADO-ACTUAL.md` son la persistencia solo en localStorage, la IA solo en local, la PARTY simulada y el balance de juego sin validar con usuarios. Ninguno se resuelve en local: todos piden desplegar (ciclo 14 bloqueado, P13.2 preparado sin activar) o tener cuentas (P3.5 pospuesta). Más mejoras locales tienen un retorno decreciente y aumentan la superficie de UI sin que nadie de fuera la haya probado.
> Por eso se propone **una decisión** (P18.1) y un único cierre menor (P18.2). Si el usuario no quiere activar el despliegue todavía, la recomendación es **no abrir el ciclo 18**: cerrar el 16 y el 17 y parar hasta esa decisión.

## P18.1 — Activar el despliegue estático en GitHub Pages (`infra`)
- Problema: el despliegue está preparado desde el ciclo 13 (`deploy-pages.yml` solo con `workflow_dispatch`, `BASE_PATH`, `docs/DEPLOY.md`) y la trampa del build con IA se cierra en el ciclo 16 (P16.3). Aun así, sigue sin activarse porque falta elegir hosting (STATE, decisión P13.2). Esto bloquea el ciclo 14 (PWA + e2e) y es la única vía para tener usuarios reales que validen el balance (§5 «Progresión»: «sin validar con usuarios»).
- Propuesta: el usuario elige **GitHub Pages** (el workflow ya está escrito para Pages; Cloudflare queda como alternativa en `DEPLOY.md`), crea el repo remoto, habilita Pages con la fuente «GitHub Actions» y lanza el workflow una vez. En el ciclo solo se hace lo mínimo: fijar `BASE_PATH` al nombre real del repo, comprobar en el móvil que la URL carga, que los datos persisten tras recargar y que «Nuevo» usa la heurística sin errores en consola, y apuntar la URL en `DEPLOY.md` y en ESTADO-ACTUAL. Con eso queda desbloqueado el ciclo 14. NO: dominio propio, despliegue automático en cada push, IA desplegada (P13.4 sigue no aprobada), analítica ni cuentas.
- Valor: alto (desbloquea el ciclo 14 y da usuarios reales) / Coste: S / Riesgo: bajo (sitio estático; los datos siguen solo en el navegador de cada usuario: un usuario desplegado puede perder datos si borra el navegador, y eso hay que asumirlo de forma explícita; el aviso de 14 días y exportar ya existen).
- Requiere: **decisión del usuario** (hosting y crear el repo remoto con Pages activo). Sin dependencias de runtime ni cambios de reglas.
- Depende de: P16.3 (ciclo 16).

## P18.2 — Menores del ciclo 15 (`deuda`)
- Problema: con cantidad 1, los `aria-label` de «Deshacer» dicen «+1 sesiones» (`HomeView.tsx:136`, `TrackerCard.tsx:223`; `cycle-15/analysis.md`), y un lector de pantalla lo lee mal. Es pequeño, pero está en la ruta accesible de un flujo diario.
- Propuesta: un helper mínimo de unidad singular/plural para las unidades que existen hoy (sesiones, clases, unidades; km/min sin cambio), usado en esos dos `aria-label` y donde ya se pinte «+1 <unidad>». Ajustar el test U23 si depende del texto. NO: i18n ni librería de pluralización. Si se abre el ciclo 17, encaja dentro como menor, sin ciclo propio.
- Valor: bajo / Coste: S / Riesgo: bajo
- Requiere: nada.
- Depende de: —

No se proponen:
- **Fijar la versión de oxlint** (riesgo citado en `cycle-15/analysis.md`): la CI usa `npm ci` con lockfile, así que la versión ya queda fija salvo actualización manual. No hay ningún problema hoy.
- **Migraciones o versión de esquema del almacenamiento:** hoy no hay ningún cambio de esquema pendiente. Tiene sentido cuando se decida P3.5 (cuentas y sincronización), no antes.
- **Más funciones locales** (límites VILLAIN, Web Share, IA en servidor): ya se decidieron como no aprobadas (P11.2, P15.2, P13.4) y no ha cambiado nada que justifique volver a proponerlas.
