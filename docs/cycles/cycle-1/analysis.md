# Análisis ciclo 1 (P1.4 + P1.3)

## Entregado frente a lo especificado
Todo lo especificado: Vitest con `npm test` (18 tests: selfcheck + validadores de storage), validación de eventos al leer, backup previo a cualquier pérdida, bloqueo de clave si el backup falla, aviso en home y exportar/importar JSON. Review aprobada sin bloqueantes ni importantes. Recortado por spec: UI de restauración de backups, copias automáticas, tests de componentes/e2e, CI.

## Deuda nueva
- Menor 1: doble línea en blanco en `storage.ts:35-36`.
- Menor 2: `URL.revokeObjectURL` justo tras `a.click()` en `exportData` puede cancelar la descarga en navegadores antiguos.
- Menor 3: si `getItem` lanza, `loadAll` devuelve la semilla sin aviso ni bloqueo y `save*` puede sobrescribir.
- `ponytail:` nuevo: restaurar backup interno es manual (DevTools).
- Backups internos nunca se borran (acumulan en localStorage).

## Fricción del proceso
Sin incidencias graves. Coste principal: la spec ya traía decisiones finas (nombres, formatos, bloqueo) y la review tuvo que verificar peer-deps de Vitest/Vite a mano; conviene que el implementador deje `npm ls vite` en su informe. Los commits de docs de otros agentes (ciclo 3) conviven en main durante el cierre: staging explícito evita mezclarlos.

## Huecos para el siguiente ciclo
- Los avisos y la exportación dependen de que el usuario actúe; sin copias automáticas el riesgo de pérdida persiste.
- Las claves `-v1` siguen sin migración de esquema; P1.1/P1.2 (fecha real, onboarding) cambiarán semántica de datos y tocarán la lógica de «clave ausente → semilla».
- Importar reemplaza sin backup del estado previo; considerar backup automático al importar.
- Sin CI: el gate build+lint+test es manual.
