# Review ciclo 1 (P1.4 + P1.3)

**Veredicto: APROBADO**

Hallazgos: 0 bloqueantes, 0 importantes, 3 menores.

## Comprobaciones
- `npm run build`, `npm run lint` y `npm test` (18 tests) en verde sobre cycle-1.
- Dependencias: `vitest@^4.1.11` en devDependencies. `npm ls vite` muestra una sola copia (vite@8.3.3, deduped bajo vitest, mocker, tailwind y plugin-react). `npm ls` sin invalid/missing. `npm ci --dry-run` pasa sin `--legacy-peer-deps` y no hay `.npmrc`: package.json y lockfile son coherentes.
- `selfcheck.ts` sin cambios en el diff. `selfcheck.test.ts` falla si algún `console.assert` recibe falso.
- Pérdida silenciosa: `loadAll` copia el bruto a `<clave>.backup.<stamp>` antes de devolver datos filtrados o vacíos y antes de que `save*` sobrescriba. Si `setItem` del backup falla, la clave se bloquea y `save*` no escribe; el aviso lo dice. Clave ilegible arranca vacía (no semilla). Clave ausente igual que antes. Importar desbloquea.
- Arquitectura: persistencia solo en `storage.ts`, sin derivados guardados, `core/` sin React. UI con tokens, sin hex ni `slate-*`.

## Menores
1. `app/src/core/storage.ts:35-36`: doble línea en blanco sobrante tras `parseCustom`.
2. `app/src/App.tsx:~108-112` (`exportData`): `URL.revokeObjectURL` justo tras `a.click()` puede cancelar la descarga en algunos navegadores (Firefox/Safari antiguos). Diferir con `setTimeout(..., 0)` o similar si se observa.
3. `app/src/core/storage.ts` (`loadAll`): si `getItem` lanza, devuelve semilla sin aviso ni bloqueo, y luego `save*` puede sobrescribir. Caso muy raro y coherente con «igual que hoy»; considerar bloquear la clave.
