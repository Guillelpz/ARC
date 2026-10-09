# Review ciclo 12 — Registrar desde «Te faltan»

Veredicto: **APROBADO**

Comprobado sobre `cycle-12`: `npm run build` OK, `npm run lint` solo 2 warnings preexistentes (App.tsx:58-59), `npm test` 3 veces seguidas: 79/79 en verde, sin intermitencias.

- El «+» llama a `add(t, t.increment)` sin día, así que usa hoy y los mismos clamps y feedback (toast, banners, status). Sin cambios en `core/`, `storage.ts` ni `selfcheck.ts`.
- Cada fila de «Te faltan» navega a `t.branch` (`onGo={onNavigate}`).
- Foco: `h2#hoy` con `tabIndex={-1}` y ref; se enfoca cuando `left <= increment`. U22 lo verifica.
- Accesibilidad: aria-label «<buttonLabel> en <name>», `min-h-11 min-w-11` más `m-1`, paleta neutra `app-*`, sin hex ni `slate-*`.
- U21/U22 cubren lo pedido por la spec, con `vi.waitFor` para localStorage.

## Hallazgos
- bloqueante: 0
- importante: 0
- menor: 1
  - `HomeView.tsx` (handler de «Te faltan»): `left!` y la comparación de foco dependen de `m.left`; si algún día `add` recortara la cantidad (clamp), el foco podría no moverse aunque la fila siga o viceversa. Hoy no ocurre porque el incremento es positivo. Sin acción.
