# TECH SPEC — Claves desconocidas en `custom` y despliegue estático (ciclo 13)

Fuente: `docs/cycles/cycle-13/proposals.md` (P13.1, P13.2) con los cambios de `docs/cycles/cycle-13/evaluation.md`. Base: `main` con los ciclos 1-12.

## 1. Resumen

- **P13.1 (XS):** `readCustom` conserva las claves de primer nivel de `life-rpg-custom-v1` que no conoce y las vuelve a guardar sin cambios. Los eventos, los trackers y las propuestas ya conservan sus campos (`storage.ts:27`, `{ ...t }`, `filter`), así que no se tocan.
- **P13.2 (S):** el build queda listo para publicarse como sitio estático. `base` se configura con `BASE_PATH` y, sin proxy, `classifyAI` usa la heurística sin hacer la petición. Se añade un workflow de GitHub Pages que solo se lanza a mano y una guía `docs/DEPLOY.md` para GitHub Pages y Cloudflare Pages.
- **Fuera de alcance:** activar el despliegue, push, cuentas, secretos, endpoint de IA (P13.4), PWA (P13.3), e2e (P13.5), versión de esquema, cambios de copy y la actualización de `ESTADO-ACTUAL.md`.

## 2. Decisiones técnicas

| Tema | Decisión | Por qué |
|---|---|---|
| Alcance de P13.1 | Solo las claves de primer nivel de `custom` | Es lo único que se pierde hoy (evaluación). |
| Validación de claves desconocidas | Se copian tal cual, sin validar, y no cuentan en `dropped`/`fixed` | No se conoce su forma. Contarlas provocaría backups y avisos falsos en cada carga. |
| `__proto__` | No se copia | `JSON.parse` lo crea como clave propia, y asignarlo cambiaría el prototipo de `data`. |
| Prioridad | Las claves conocidas siempre salen de sus validadores | Una clave desconocida nunca puede pisar `trackers`, `proposals`, `goals` ni `goalLog`. |
| «Borrar todo» | Sigue con `EMPTY_CUSTOM` y también borra las claves desconocidas | Es lo que el usuario pide al borrar. |
| `base` | `env.BASE_PATH \|\| '/'` desde el `loadEnv` que ya existe, en todos los comandos | `preview` tiene que servir con el mismo `base` que el build. Sin la variable, dev, preview y tests no cambian. |
| IA sin proxy | Constante de build `__AI_PROXY__` = hay key cuando se ejecuta `vite.config` | Sin ella, la heurística responde al momento y no aparece ningún `POST /api/claude 404/405` en rojo en la consola. Con key en local, dev y preview funcionan igual que ahora. |
| Workflow | Archivo aparte `.github/workflows/deploy-pages.yml`, solo con `workflow_dispatch` | Nunca se ejecuta solo. Para activarlo basta con añadir el trigger `push`. `ci.yml` no se toca. |
| Cloudflare Pages | Sin workflow: build en el panel de Cloudflare, documentado en la guía | Así lo integra Cloudflare. Ahorra un job y un token. |
| Fallback 404/SPA | Ninguno | No hay router: solo existe `index.html`. |

## 3. Decisiones que requieren aprobación

Ninguna. El hosting queda sin decidir por decisión del usuario: todo se deja preparado y sin activar.

## 4. Impacto en el código

| Archivo | Cambio |
|---|---|
| `app/src/core/storage.ts` | `readCustom` copia las claves de primer nivel desconocidas. Lleva un `ponytail:` con el límite. |
| `app/src/core/storage.test.ts` | Tests C13 a C15 (§11). |
| `app/vite.config.ts` | `base` y `define.__AI_PROXY__`. Se actualiza el `ponytail:`. |
| `app/src/core/classify.ts` | `declare const __AI_PROXY__: boolean` y una guarda al principio del `try` de `classifyAI`. |
| `.github/workflows/deploy-pages.yml` (nuevo) | Build y despliegue en GitHub Pages, solo con `workflow_dispatch`. |
| `docs/DEPLOY.md` (nuevo) | Guía corta de GitHub Pages y Cloudflare Pages. |

## 5. Modelos de datos

`CustomData` no cambia de tipo. En ejecución, el objeto puede llevar más claves, que TypeScript no ve. No se añade ninguna firma de índice: obligaría a tocar todos los usos.

## 6. Persistencia y migración

- Formato y claves de localStorage: sin cambios. No hace falta migrar nada.
- Datos ya guardados: se leen igual. Si contienen una clave desconocida (de una versión futura), ahora se conserva en memoria y se vuelve a escribir con `saveCustom`, porque `App` hace `{ ...c, … }`. También pasa a sobrevivir a exportar e importar (`parseBackup` → `readCustom`), a `backupCurrent`/`readLast`/`restoreLast` (`JSON.stringify(v)`) y a recargar.
- Despliegue: cada origen (`localhost`, `*.github.io`, `*.pages.dev`) tiene su propio localStorage. Los datos se pasan de uno a otro con Exportar e Importar, que ya existen. Lo explica la guía.

## 7. Lógica de dominio

### 7.1 `readCustom` (storage.ts)

Al final de la función, sustituye la construcción de `data` por esto:

```ts
const KNOWN = new Set(['trackers', 'proposals', 'goals', 'goalLog', '__proto__']) // nivel de módulo
// ponytail: las claves desconocidas se copian sin validar. Una versión anterior conserva p. ej. `goalLog`, pero no lo actualiza
// si cambia un objetivo. Cuando haga falta una migración real: número de versión de esquema.
const data = { trackers, proposals } as CustomData
for (const [k, x] of Object.entries(v)) if (!KNOWN.has(k)) (data as Record<string, unknown>)[k] = x
if (Object.keys(goals).length > 0) data.goals = goals
if (goalLog.length > 0) data.goalLog = goalLog
```

- `dropped` y `fixed` se calculan igual que hoy.
- `EMPTY_CUSTOM` no cambia. `readCustom({})` sigue devolviendo exactamente `{ trackers: [], proposals: [] }`.

### 7.2 `classifyAI` (classify.ts)

```ts
declare const __AI_PROXY__: boolean // vite.config `define`: true si había ANTHROPIC_API_KEY al arrancar o al hacer el build
...
  try {
    if (!__AI_PROXY__) throw new Error('sin proxy') // hosting estático: heurística inmediata, sin petición fallida en consola
    const res = await fetch('/api/claude', { … })
```

- La guarda va dentro del `try`. Si en algún entorno no se sustituye la constante, el `ReferenceError` también acaba en la heurística.
- Ya está comprobado en el código que sin proxy no hay errores sin capturar: todo el cuerpo está en `try/catch`. Un 404 o un 405 lanza en `:79`, un HTML con 200 lanza en `res.json()` y el timeout lanza por `AbortSignal`. Con la guarda, tampoco se espera ni sale la línea de red.
- `fetch('/api/claude')` sigue siendo una ruta absoluta. En dev y preview el proxy la atiende con cualquier `base`. En P13.4 se revisa.

### 7.3 `vite.config.ts`

```ts
const env = loadEnv(mode, process.cwd(), '')
const key = env.ANTHROPIC_API_KEY
// ponytail: proxy solo en dev/preview y con key. Sin key (hosting estático), __AI_PROXY__ = false y classifyAI usa la heurística sin llamar. Endpoint real: P13.4.
...
return {
  base: env.BASE_PATH || '/', // p. ej. '/<repo>/' en GitHub Pages; vacío = raíz (dev, Cloudflare)
  define: { __AI_PROXY__: JSON.stringify(!!key) },
  plugins: [react(), tailwindcss()], server: { proxy }, preview: { proxy },
}
```

- `loadEnv` con prefijo `''` también lee `process.env`, así que `BASE_PATH=/x/ npm run build` funciona.
- La key sigue sin entrar en el bundle: solo entra un booleano.
- `index.html` usa `/favicon.svg` y `/src/main.tsx`. Vite los reescribe con `base` en el build, así que no hay que tocarlos.

### 7.4 Workflow `.github/workflows/deploy-pages.yml`

```yaml
name: Deploy Pages
# Desactivado: solo manual. Para activarlo tras elegir GitHub Pages, añadir `push: { branches: [main] }` (ver docs/DEPLOY.md).
on: workflow_dispatch
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: '${{ steps.deployment.outputs.page_url }}' }
    defaults: { run: { working-directory: app } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm, cache-dependency-path: app/package-lock.json }
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
        env: { BASE_PATH: '/${{ github.event.repository.name }}/' }
      - uses: actions/upload-pages-artifact@v3
        with: { path: app/dist }
      - id: deployment
        uses: actions/deploy-pages@v4
```

- Repite lint y test porque `needs:` no funciona entre workflows. Evita publicar un build roto.
- No se lanza sola. Si se lanza a mano sin haber activado Pages, falla en el último paso y no tiene ningún efecto.

## 8. UI

Sin cambios. En el sitio desplegado, «Nuevo» muestra la propuesta heurística («Detectado: …» o «Sin pistas claras: elige tú»), igual que hoy en local sin key, y sin el retardo de la petición.

## 9. Backlog

**T1 — Conservar claves desconocidas de `custom` (P13.1)**
- Archivos: `app/src/core/storage.ts`, `app/src/core/storage.test.ts`.
- Qué: §7.1, con el `ponytail:` y los tests C13 a C15.
- Depende de: nada.
- Acepta: C1 a C12 y los tests de App pasan sin cambios. C13 a C15 están en verde. `build`, `lint` y `test` en verde.

**T2 — Build listo para hosting estático (P13.2, código)**
- Archivos: `app/vite.config.ts`, `app/src/core/classify.ts`.
- Qué: §7.2 y §7.3.
- Depende de: nada (puede ir en paralelo a T1).
- Acepta: `npm run dev` con key clasifica con IA como antes. Sin `.env.local`, «Nuevo» responde al instante y la pestaña Network no muestra ninguna petición a `/api/claude`. `BASE_PATH=/rpg/ npm run build` genera `dist/index.html` con `/rpg/assets/…` y `/rpg/favicon.svg`. `npm run preview` con ese build sirve en `/rpg/`. `build`, `lint` y `test` en verde.

**T3 — Workflow desactivado y guía (P13.2, despliegue)**
- Archivos: `.github/workflows/deploy-pages.yml` (nuevo) y `docs/DEPLOY.md` (nuevo).
- Qué: el workflow de §7.4 y una guía de una página como mucho, con:
  1. **Antes de elegir:** cada origen tiene sus propios datos (Exportar en local y luego Importar en el sitio). No hay servidor: los datos siguen en el navegador. La URL es pública. Nunca se define `ANTHROPIC_API_KEY` en el hosting: sin ella, la IA se desactiva sola.
  2. **GitHub Pages:** el repo tiene que ser público en el plan gratuito. Settings → Pages → Source «GitHub Actions». Actions → «Deploy Pages» → Run workflow. URL `https://<usuario>.github.io/<repo>/`. Para desplegar en cada push a `main`, añadir `push: { branches: [main] }` al `on:`. Aviso: todas las páginas de proyecto de un usuario comparten el origen `<usuario>.github.io` y, por tanto, el localStorage.
  3. **Cloudflare Pages:** puede usarse con repo privado. Panel → Workers & Pages → Create → Pages → conectar con Git. Root directory `app`, build command `npm run build`, output `dist`, variable `NODE_VERSION=22`, sin `BASE_PATH`. URL `https://<proyecto>.pages.dev`. Cloudflare despliega en cada push y crea previews por rama. Si se usa Cloudflare, `deploy-pages.yml` se borra. Es la única opción que deja abierta P13.4.
  4. **Comprobar tras desplegar:** el checklist manual de §11.
- Depende de: T2.
- Acepta: el YAML es válido (el repo no tiene remoto, así que no se ejecuta) y su único trigger es `workflow_dispatch`. `ci.yml` no cambia. La guía no menciona ningún secreto.

## 10. Riesgos

| Riesgo | Prevención | Si se complica |
|---|---|---|
| Una clave desconocida con nombre peligroso (`__proto__`) | Se excluye en `KNOWN` y hay un test (C15). | — |
| Una clave desconocida enorme o basura se arrastra para siempre | Se acepta: es raro y «Borrar todo» la elimina. | Lo resolverá una versión de esquema futura. |
| `base` mal escrito (sin `/` final) | La guía da el formato exacto y el workflow lo calcula. | — |
| `__AI_PROXY__` true en un build local publicado a mano | La petición falla y se usa la heurística: es el comportamiento actual. La guía dice que se use el build del hosting. | — |
| Que alguien añada `ANTHROPIC_API_KEY` en Cloudflare o en GitHub | No serviría de nada (no hay proxy), pero la guía lo prohíbe expresamente. | — |
| `crypto.randomUUID` necesita un contexto seguro | Los dos hosts sirven HTTPS. | — |

Recorte si algo se complica: T3 puede quedarse solo en la guía, sin el YAML.

## 11. Verificación

`selfcheck.ts` no cambia: no se toca ninguna regla de dominio. Tests nuevos en `storage.test.ts` (`describe('readCustom: claves desconocidas')`):

- **C13 se conservan:** `readCustom({ trackers: [], proposals: [], futuro: { a: 1 }, n: 3 })` → `data` es igual a `{ trackers: [], proposals: [], futuro: { a: 1 }, n: 3 }`, con `dropped: 0` y `fixed: 0`. Una clave conocida no se puede pisar: `readCustom({ goals: 'x', otro: 1 })!.data` no tiene `goals` y tiene `otro: 1`.
- **C14 viaje completo:** con `fakeStore({ [CU]: JSON.stringify({ trackers: [], proposals: [], futuro: [1] }) })`, `loadAll` no registra problemas ni escrituras. Después `saveCustom({ ...custom }, s)` y `JSON.parse(s.m.get(CU)).futuro` es igual a `[1]`. Además, `parseBackup(exportBackup([], custom, 'x'))?.custom` conserva `futuro`.
- **C15 `__proto__`:** `const r = readCustom(JSON.parse('{"__proto__":{"x":1}}'))!.data` → `Object.getPrototypeOf(r) === Object.prototype`, `(r as any).x` es `undefined` y `r` es igual a `EMPTY_CUSTOM`.

No se añaden tests para `__AI_PROXY__`: depende del entorno de build. Se verifica con el checklist.

Cierre de cada tarea: `npm run build`, `npm run lint` y `npm test` en verde desde `app/`. En dev, `[selfcheck] done` sin fallos.

Checklist manual:
- [ ] Con `.env.local`: en `npm run dev`, «Nuevo» con «cerveza artesana» propone con IA (razón redactada, no «Detectado: …»).
- [ ] Sin `.env.local` (renombrarlo): en `npm run dev`, «Nuevo» responde al instante. Network no muestra `/api/claude` y la consola no tiene errores.
- [ ] `BASE_PATH=/rpg/ npm run build && npm run preview`: `http://localhost:4173/rpg/` carga con estilos y favicon. Registrar algo y recargar: persiste.
- [ ] En DevTools, añadir a mano `"futuro": 1` en `life-rpg-custom-v1`, recargar y registrar un evento o cambiar un objetivo: la clave sigue ahí y no aparece aviso de datos dañados.
- [ ] (Al activar el hosting, fuera de este ciclo) URL pública desde el móvil: carga, Exportar en local → Importar en el sitio, «Nuevo» usa la heurística.

## 12. Handoff para Claude Code

1. Rama `cycle-13`. T1 y T2 son independientes; T3 va después de T2. Un commit por tarea.
2. No hagas push, no crees remotos y no actives Pages ni Cloudflare. El workflow solo se lanza a mano.
3. No toques `ci.yml`, `selfcheck.ts`, el formato de las claves de localStorage ni el copy. No añadas dependencias.
4. En `readCustom`, la copia de claves desconocidas va antes de asignar `goals`/`goalLog`, para que los validadores siempre ganen.
5. Antes de cerrar cada tarea: `npm run build`, `npm run lint` y `npm test` desde `app/`. Al final, el checklist de §11 salvo el último punto.
