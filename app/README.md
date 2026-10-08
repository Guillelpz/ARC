# RPG Life Tracker — app

React 19 + TypeScript + Vite + Tailwind CSS v4. Estado del proyecto, arquitectura y deuda heredada de la demo: [`../docs/ESTADO-ACTUAL.md`](../docs/ESTADO-ACTUAL.md).

```bash
npm install
npm run dev     # servidor de desarrollo; selfcheck de dominio en la consola del navegador
npm run build   # type-check + build de producción
npm run lint    # oxlint
```

Clasificación con IA (opcional, solo `dev`/`preview`): crear `.env.local` con `ANTHROPIC_API_KEY=...`. Sin key, la app usa la heurística local.
