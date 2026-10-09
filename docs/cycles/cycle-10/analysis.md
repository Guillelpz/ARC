# Análisis ciclo 10 — deuda menor y avisos accesibles

## Entregado frente a lo especificado
- P9.1: `storage.ts` separa descartados y reparados (`dropped`/`fixed`); el original se sella si hay cualquiera de los dos. Archivar guarda cambios válidos; Nuevo detecta archivadas y ofrece «Reactivar».
- P9.4: avisos en regiones `role="status"` (una global y una en `UnknownView`) y chequeo axe en `npm test`. 70 tests, lint sin avisos tras la segunda vuelta.
- No se recortó nada.

## Deuda nueva
- menor (sin corregir): `aria-label="Importar copia"` en el `<input type="file" hidden>` (solo contenta a axe en happy-dom); U18 depende del título exacto del toast.
- `ponytail:` nuevo en `App.tsx`: dos avisos seguidos con el mismo texto pueden no repetirse en el lector.
- Retirado: el `ponytail:` de `UnknownView` solo con activas.

## Fricción del proceso
- Test intermitente `U6 importar` (3 fallos de 17): leía localStorage antes de que React vaciara el efecto de guardado. Costó una vuelta de review. Lección: en tests de UI esperar con `vi.waitFor`, nunca leer storage síncrono tras una acción asíncrona; el implementer debería repetir `npm test` ~5 veces antes de entregar.

## Huecos y riesgos para el siguiente ciclo
- axe en happy-dom no mide contraste ni foco real; la accesibilidad sigue sin verificarse en navegador.
- `streak` sigue usando el objetivo actual hacia atrás (P11.1, ciclo 11).
- `saveEvents`/`saveCustom` aún tragan errores de cuota sin avisar.
