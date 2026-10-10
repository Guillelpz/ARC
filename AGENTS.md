# RPG Life Tracker — instrucciones para Codex

## Proyecto

- Estado actual (vigente): `docs/ESTADO-ACTUAL.md` (despliegue a Pages: `docs/DEPLOY.md`). El proyecto nació como demo de hackathon y ahora está en desarrollo real. `MVP-RPG.md`, `docs/PRD-V2.md`, `docs/TECH_SPEC.md` y `docs/TECH_SPEC-V2.md` son histórico de la demo.
- Aplicación en `app/`: React, TypeScript, Vite, Tailwind CSS y Lucide. Las versiones instaladas se consultan en `app/package.json` y su lockfile.
- `ActivityEvent[]` es la fuente de verdad; estadísticas, XP y niveles son derivados. Persistencia aislada en `app/src/core/storage.ts` y cálculos puros en `app/src/core/` (incl. `merge.ts`: fusión de copias, «Importar y fusionar»; compartir copia con `navigator.share` y respaldo a descarga).
- Hoy no hay backend ni autenticación y la PARTY es simulada; cambiarlo o añadir dependencias requiere decisión explícita del usuario. No añadir funcionalidades fuera del encargo.
- Dirección visual: HERO claro y VILLAIN oscuro, separados sin mezclar paletas; estética RPG sobria. Consultar `.claude/skills/frontend-stylist/references/style-guide-template.md` y `docs/STYLE_GUIDE.md` cuando exista. Las instrucciones recientes del usuario prevalecen sobre referencias visuales antiguas.

## Agentes del proyecto

Las definiciones están instaladas en `.codex/agents/*.toml` (con `.codex/config.toml`).

- **tech-lead**: usar para convertir un PRD en especificación técnica, arquitectura mínima y backlog. Su definición es `.codex/agents/tech-lead.toml` (sincronizada con `.claude/agents/tech-lead.md`). Entregarle el PRD o la petición; escribe una spec incremental en `docs/TECH_SPEC-<tema>.md` a partir de `docs/ESTADO-ACTUAL.md`. No implementa la aplicación.
- **frontend-stylist**: usar para revisiones y correcciones de coherencia visual cuando el usuario pida pulir/restilizar la UI o cuando un cambio de frontend necesite esta revisión. Su definición es `.codex/agents/frontend-stylist.toml`. Entregarle el alcance y archivos concretos. Puede corregir presentación y documentar estilo; no cambia `app/src/core/`.

Si el usuario pide uno de estos roles y están instalados, delegar al agente correspondiente. Si aún no están instalados o el cliente no permite iniciar agentes personalizados, leer el campo `developer_instructions` de su TOML y aplicar las instrucciones en el agente principal, indicando que se está usando el rol en la sesión principal. Para tareas pequeñas que no necesitan delegación, aplicar las instrucciones pertinentes directamente.

## Coordinación y comprobaciones

- Definir un resultado concreto y archivos asignados antes de delegar. No permitir que dos agentes editen los mismos archivos simultáneamente; realizar en secuencia tareas dependientes.
- El agente principal integra resultados, comprueba los cambios y entrega una respuesta final en español. Crear los archivos de configuración no equivale a ejecutar los agentes.
- Para cambios de código, ejecutar `npm run build`, `npm run lint` (oxlint `--deny-warnings`: cualquier warning rompe la CI) y `npm test` (Vitest: selfcheck + tests de `core/` + tests de UI en `src/App.test.tsx` con happy-dom + chequeo axe en `src/a11y.test.tsx`) desde `app/`. El proyecto también tiene comprobaciones de dominio en `app/src/core/selfcheck.ts`; revisar las relevantes cuando cambie el núcleo.
- `npm run e2e` (Playwright + Chromium, `app/e2e/*.e2e.ts`, build con `BASE_PATH=/ARC/`) no lo incluye `npm test`; se ejecuta en su job de la CI. Todo push a main que toque `app/` despliega a producción (GitHub Pages) tras lint, test y e2e. El service worker se genera en el build (solo PROD) y tiene kill switch (`sw_kill` en `deploy-pages.yml`, ver `docs/DEPLOY.md`).
- Para cambios exclusivos de documentación/configuración, validar formato y rutas. No afirmar que se ha probado visualmente la UI sin haberla abierto.
