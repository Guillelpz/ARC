# Review ciclo 40

**Veredicto: APROBADO.** 0 bloqueantes, 0 importantes, 2 menores. Build, lint y npm test (311) verificados por el orquestador; e2e 23/23 según el implementer.

El diff `main..cycle-40` (T1-T7) cumple la spec: `storageUsage`/`usageWarn` puros y solo de lectura (null si lanza), sin purga (D3). `needsConfirm` + `confirm` en `interpretCapture` solo cuando Haiku no respondió bien (D1); el comando no se persiste ni se aprende (`onLearn` no se llama). Tarjeta con «Apuntar»/«Descartar» sin cuenta atrás y foco en «Apuntar». Cuenta atrás parada si la pestaña ya está oculta. Sin hex ni `slate-*`; paleta de rama. Ningún assert existente se relajó; SU1, CV15 y MC6 son nuevos.

## Desviaciones

1. **CV15 «leí un libro»: correcto respecto a D1.** D1 pide confirmación cuando no hay coincidencia exacta y limpia (`deviceSure`); «libro» es alias exacto de Reading, así que se guarda sola, como `selfcheck.ts:671` ya asumía. La nota de evaluation.md era una suposición errónea. `DEPLOY.md` no cita «leí un libro» (solo «ate a burguer» e «I ran out of milk»), así que no necesita cambios. Queda desfasada solo la spec (§7.4 línea 131 y §11 línea 266), que se elimina al cerrar el ciclo.
2. **U-M3: aceptable, y más estricto.** Ahora exporta de verdad con la UI y comprueba que la copia no lleva la clave, `maquina` ni la clave de la memoria (antes usaba `exportBackup([])`, que no demostraba nada). `mockReturnValueOnce(true)` es coherente: tras exportar, la copia ya no es antigua.
3. **ponytail de `saveFood`: aceptado.** 170 car. × 10/día ≈ 0,62 M/año; con copias ×3 el límite de ~5 M llega en ~3 años. Coherente. Menor: la cifra no se mide en ningún test, solo se afirma en el comentario.

## Hallazgos

- **menor** `docs/TECH_SPEC-cycle40.md:131,266`: cita «leí un libro» como tarjeta. Corregir o descartar al eliminar la spec.
- **menor** `app/src/App.tsx:129`: el ponytail dice que se mide «tras cada guardado hecho en Inicio», pero `getItem` se repite con cada cambio de `events` o `food` en Inicio. Con >3 MB cuesta unos ms por toque en «+»; límite ya documentado, sin acción.
