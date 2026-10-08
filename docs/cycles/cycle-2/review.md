# Review ciclo 2

Veredicto: APROBADO

build OK, lint OK (1 warning, exit 0), test OK (18/18).

## Hallazgos

### menor
1. `app/src/App.tsx:46` — `localDate(new Date())` en render da `react(purity)`. Se acepta: el exit code de oxlint es 0 y la CI no falla. Alternativa igual de simple y sin warning: `const [today, setToday] = useState(() => localDate(new Date()))` y en `onVisible` hacer `setToday(localDate(new Date()))` (quita también el `useReducer`). Cambia el comportamiento: `today` queda fijo hasta volver a la pestaña, mientras `nowStamp()` usa la hora real. Pasada la medianoche, un evento nuevo quedaría fechado en un día posterior a `today`. La versión actual no tiene ese desfase, así que mantenerla es razonable.
2. `app/src/App.tsx:21` y `app/src/core/seed.ts:28` — `SEED_EVENTS` y `DEMO_DATE` solo los usan selfcheck y tests; es herencia aceptable. Sin acción.
3. `app/src/core/storage.ts:56-61` — si `getItem` lanza, ahora se devuelve `[]` en vez de la semilla. Es coherente con el arranque vacío y no hay pérdida (no se escribe nada). Sin acción.

## Puntos de atención
1. Datos guardados: sin cambios en el formato ni en las claves. Los eventos guardados (incluida la semilla antigua de 2026-09/10) se leen igual; solo cambia la fecha de referencia a hoy. Clave ausente da `[]`. Clave corrupta crea el backup del ciclo 1 (`load()` intacta) y devuelve `[]`. `storage.test` cubre ambos casos. «Borrar todo» pide confirmación y avisa de exportar antes.
2. selfcheck: el diff solo añade imports y 3 asserts (`localDate`, `seedFor` con +10 semanas y `seedFor` con lunes, sin eventos futuros). Ningún assert existente cambia. `SEED_EVENTS = seedFor(DEMO_DATE)` reproduce los 28 eventos (offset 0).
3. Purity: ver el hallazgo 1.
4. `.github/workflows/ci.yml`: correcto. `defaults.run.working-directory: app`, `cache-dependency-path: app/package-lock.json` (existe), `npm ci`, lint, build y test. Node 22 está bien. El `uses: actions/checkout` no se ve afectado por el working-directory.

## Otros
- Arquitectura: `localDate` está en `core/stats.ts` sin React y no se persiste nada derivado. UI: tokens, sin hex ni `slate-*`. El tono del texto de onboarding es correcto.
- Sin exceso relevante.
