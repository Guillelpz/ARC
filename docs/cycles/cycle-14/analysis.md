# Análisis ciclo 14

## Entregado frente a lo especificado
Todo: manifest, iconos y nota iOS (T1); smoke e2e en Chromium E1 flujo, E2 offline, E3 axe, con job `e2e` en la CI (T2); service worker generado en el build, aviso de versión nueva y kill switch `sw_kill` (T3). Review APROBADO: 0 bloqueantes, 0 importantes; 85 tests + 3 e2e. Sin recortes; el aviso de versión nueva no tiene e2e (previsto, checklist manual).

## Deuda nueva
- menor: `playwright.config.ts:13` `reuseExistingServer` puede reutilizar un preview viejo; `npm run e2e` deja `dist/` con base `/ARC/`.
- menor: `sw.js:19` fallback `caches.match('./index.html')` sin `ignoreVary`.
- menor: manifest sin icono `maskable`.
- menor: no verificado que E2 falle sin `ignoreVary`.
- `ponytail:` nuevos: navegación del SW sin timeout ni caché en runtime (`sw.js`); Chromium sin cachear en la CI.

## Fricción del proceso
Lección de Git Bash: con `BASE_PATH=/ARC/` Git Bash convierte la ruta en una de Windows; hay que anteponer `MSYS_NO_PATHCONV=1` (en la CI Linux no pasa). El SW es difícil de probar en happy-dom: la verificación real recae en e2e y checklist manual.

## Huecos y riesgos para el siguiente ciclo
- Probar en dispositivo real (Android instalar, iOS) y el kill switch una vez; solo están en `docs/DEPLOY.md`.
- Un SW roto afecta a usuarios ya instalados hasta que se despliegue con `sw_kill`: conviene probar el despliegue real antes de añadir más cambios de SW.
- IA desplegada sigue sin endpoint (P13.4); datos solo en localStorage por origen.
