# TECH SPEC — Ciclo 19: varias pestañas, despliegue automático y vista previa del enlace

Fuente: `docs/cycles/cycle-19/proposals.md` (P19.2, P19.1, P19.3) con **todos** los cambios de `docs/cycles/cycle-19/evaluation.md`. Aprobadas por el usuario. Base: `main`, con los ciclos 1–17 y 14 (PWA, service worker, e2e y kill switch) ya incluidos.

## 1. Resumen

- **P19.2:** `App.tsx` escucha el evento `storage` de `window`. Cuando otra pestaña o ventana cambia una de las dos claves principales (o hace `clear()`), recarga el estado entero con `loadAll()`, sin fusionar. Además actualiza `canRestore` y `lastExport`. Si la lectura tiene problemas, muestra el aviso y conserva el estado. Así deja de perderse en silencio lo registrado en la otra pestaña.
- **P19.1:** `deploy-pages.yml` también se lanza en cada push a `main` que toque `app/**` o el propio workflow. El e2e va dentro del job y bloquea la publicación, salvo cuando se despliega con `sw_kill`. Se actualiza `DEPLOY.md`.
- **P19.3:** `index.html` añade `meta description` y las etiquetas Open Graph, con la URL absoluta de Pages y `icon-512.png`.
- **Fuera de alcance:** `BroadcastChannel`, Web Locks, fusionar eventos, avisar de que hubo un cambio en otra pestaña, previews por rama, staging, releases, una imagen social diseñada, Twitter cards y analítica.

## 2. Decisiones técnicas

| Tema | Decisión |
|---|---|
| Qué claves se escuchan | `e.key` igual a `life-rpg-demo-v1`, `life-rpg-custom-v1` o `null` (`clear()`) → `loadAll()`. `.backup.*` se ignora. Las escrituras de `backupCurrent`/`restoreLast` llegan como cambios de las claves principales, y un estado intermedio de `restoreLast` se corrige solo con el evento siguiente, porque `loadAll` relee las dos claves. |
| `life-rpg-meta-v1` | No recarga datos; solo hace `setLastExport(loadLastExport())`. Es una línea y evita que el recordatorio de copia quede desfasado si se exporta en la otra pestaña. No contradice el filtro de la evaluación, porque no pasa por `loadAll`. |
| Predicado y claves | Se exportan desde `storage.ts` (`isDataKey`, `META_KEY`). `App.tsx` no repite literales de claves. |
| Si `loadAll` devuelve `problems` | Se hace `setNotice(noticeFor(problems))` y **no** se tocan `events` ni `custom`. |
| Si no hay problemas | Se sustituyen `events` y `custom` y **no** se borra el aviso que ya se esté mostrando. |
| `unlockStorage()` | **Sí**, cuando la lectura es limpia (sin `problems`). El bloqueo existía porque esta pestaña no pudo leer ni copiar la clave. Si ahora se lee bien y el estado pasa a ser exactamente lo guardado, guardar ya no destruye nada que no se haya leído. Es el mismo criterio que sigue `importData`. |
| Rebote de guardado | Sin guardas. El efecto de guardado vuelve a escribir lo recibido. `setItem` con el mismo valor no lanza `storage`, y `readCustom` puede reordenar claves, lo que da como mucho un rebote que converge. El test lo comprueba. |
| Toasts y level-ups | No se calculan para los cambios que vienen de otra pestaña. Los que estén en curso no se tocan, porque caducan solos en ≤3,2 s. |
| Carrera residual | Se marca con `ponytail:` en el listener: si las dos pestañas escriben en menos tiempo del que tarda en llegar el evento, se pierde una de las escrituras. |
| e2e en el deploy | Pasos dentro de `deploy-pages.yml`, antes del build, con `if: ${{ !inputs.sw_kill }}`. En un push, `inputs` está vacío, así que el e2e se ejecuta y `SW_KILL` queda `''`. |
| Comprobar `SW_KILL` | El paso de build hace `echo "SW_KILL=[$SW_KILL]"` antes de `npm run build`. Se queda de forma permanente porque es barato y deja rastro en el log. |
| Informe de Playwright en el deploy | No se sube. `ci.yml` ya ejecuta el e2e en el mismo push y sube `playwright-report` si falla. |
| URL de OG | Absoluta y escrita a mano (`https://guillelpz.github.io/ARC/`), con `ponytail:`. Vite no reescribe URLs absolutas. |

## 3. Decisiones que requieren aprobación

Vacía. Las tres propuestas, incluido el cambio de proceso de P19.1 («todo push a `main` que toque `app/` publica»), ya están aprobadas. No hay dependencias nuevas ni cambios en las reglas de juego, y no se elimina ningún atajo de la demo.

## 4. Impacto en el código

| Archivo | Cambio |
|---|---|
| `app/src/core/storage.ts` | Exporta `META_KEY` y añade `isDataKey`. |
| `app/src/App.tsx` | `useEffect` con el listener `storage`. |
| `app/src/App.test.tsx` | Test `U-pestañas`. |
| `.github/workflows/deploy-pages.yml` | `on.push` con `paths`, pasos de e2e condicionados, `echo` de `SW_KILL` y comentario de cabecera. |
| `docs/DEPLOY.md` | Estado activado, despliegue automático, interacción con el kill switch y `cancel-in-progress`, y nota sobre `MSYS_NO_PATHCONV`. |
| `app/index.html` | Meta description y Open Graph. |

No hay archivos nuevos.

## 5. Modelos de datos

Sin cambios de tipos.

## 6. Persistencia y migración

Los formatos no cambian, así que no hace falta migrar. Solo se **lee** con más frecuencia: en cada evento `storage` de otra pestaña. La única escritura nueva es la de `loadAll`, que ya existía: si la lectura tiene problemas, copia la clave a `<clave>.backup.<stamp>`. Esa clave la ignora el filtro de la otra pestaña.

## 7. Lógica de dominio

`storage.ts` (junto a las constantes):

```ts
export const META_KEY = 'life-rpg-meta-v1'   // ya existe; solo se exporta
// null = localStorage.clear() en otra pestaña
export const isDataKey = (k: string | null) => k === null || k === KEY || k === CUSTOM_KEY
```

`App.tsx`, después de los efectos de guardado:

```ts
// ponytail: si dos pestañas escriben en menos tiempo del que tarda en llegar el evento `storage`, la última escritura pisa a la otra.
// Cerrarlo de verdad exige fusionar eventos o Web Locks.
useEffect(() => {
  const onStorage = (e: StorageEvent) => {
    if (e.key === META_KEY) return setLastExport(loadLastExport())
    if (!isDataKey(e.key)) return
    const r = loadAll()
    setCanRestore(hasLastBackup()); setLastExport(loadLastExport())
    if (r.problems.length) return setNotice(noticeFor(r.problems)) // se conserva lo que se ve; el original queda copiado aparte
    unlockStorage() // lo guardado se ha leído entero: guardar ya no destruye nada
    setEvents(r.events); setCustom(r.custom)
  }
  window.addEventListener('storage', onStorage)
  return () => window.removeEventListener('storage', onStorage)
}, [])
```

El handler solo usa setters y funciones del módulo, así que `[]` es correcto y no deja cierres con estado antiguo. No se filtra por `e.storageArea`: la app no usa `sessionStorage`, y el test crea el evento sin ese campo. `selfcheck.ts` no cambia.

## 8. UI

No hay componentes nuevos.
- **Otra pestaña registra, deshace, borra todo, importa o recupera:** la vista se actualiza sola, sin toast.
- **Datos ilegibles o reparados que llegan de otra pestaña:** en Inicio aparece el aviso de `noticeFor` que ya existe, y la vista no cambia.
- **«Recuperar copia anterior»** aparece o desaparece según lo que haya hecho la otra pestaña. **«Última copia»** se actualiza al exportar en la otra.
- **Vista previa del enlace:** título «Life RPG», descripción e icono de 512.

## 9. Backlog

### T1 — P19.2: sincronizar entre pestañas
- **Archivos:** `storage.ts`, `App.tsx`, `App.test.tsx`.
- **Qué hacer:** lo descrito en §7.
- **Test `U-pestañas`** (async; toda lectura de localStorage o de la vista va con `vi.waitFor`; el evento se lanza a mano porque happy-dom no lo dispara solo):
  1. `render(<App />); go('HERO')`. Se espía `localStorage.setItem` con `vi.spyOn`, sin `mockImplementation`.
  2. Otra pestaña registra: `localStorage.setItem(EV, JSON.stringify([{ id: 't1', trackerId: 'gym', amount: 1, occurredAt: '2026-10-07T09:00:00' }]))` y después `window.dispatchEvent(new StorageEvent('storage', { key: EV }))`. Se espera a que la tarjeta Gym muestre `^1 \/ 4 sesiones esta semana`, y `localStorage.getItem(EV)` sigue siendo exactamente la cadena escrita: no se ha pisado.
  3. Sin bucle: `localStorage.setItem(CU, JSON.stringify({ proposals: [], trackers: [] , zz: 1 }))` (claves en un orden distinto del de `readCustom`) y despacho de `{ key: CU }`. Se guarda `v1 = localStorage.getItem(CU)` después de `waitFor`. Se vuelve a despachar `{ key: CU }` (es el rebote) y, tras `waitFor`, `localStorage.getItem(CU) === v1`. El número de llamadas a `setItem` con `CU` después del segundo despacho es como mucho 1, y con el mismo valor. Se conserva `zz`, que sigue la regla de P13.1.
  4. Clave ignorada: `setItem(EV + '.backup.last', '[]')` y despacho de esa key. Gym sigue en 1. Después se despacha `{ key: EV }`, se va a «Inicio» y aparece el botón «Recuperar copia anterior» (`canRestore` está al día).
  5. Problemas: `setItem(EV, '{roto')` y despacho de `{ key: EV }`. Aparece «Parte de tus datos guardados no se pudo leer…», y en HERO, Gym sigue en 1.
  6. `clear()`: `localStorage.clear()` y despacho de `{ key: null }`. Gym pasa a 0.
- **Criterios de aceptación:** `build`, `lint` (`--deny-warnings`) y `test` en verde. U1–U* y los asserts de `selfcheck` sin cambios.
- **Dependencias:** ninguna.

### T2 — P19.1: desplegar en cada push a `main`
- **Archivos:** `.github/workflows/deploy-pages.yml`, `docs/DEPLOY.md`.
- **Workflow:**
  ```yaml
  name: Deploy Pages
  # Publica en cada push a main que toque app/ o este archivo, y a mano (Run workflow) con el input sw_kill = kill switch. Ver docs/DEPLOY.md.
  on:
    push:
      branches: [main]
      paths: ['app/**', '.github/workflows/deploy-pages.yml']
    workflow_dispatch:
      inputs: { sw_kill: … sin cambios … }
  # permissions y concurrency sin cambios
  steps:
    … checkout, setup-node, npm ci, lint, test …
    # e2e = puerta antes de publicar; con sw_kill se salta (en una emergencia el build puede estar roto)
    - if: ${{ !inputs.sw_kill }}
      run: npx playwright install --with-deps chromium
    - if: ${{ !inputs.sw_kill }}
      run: npm run e2e
    - run: |
        echo "SW_KILL=[$SW_KILL]"
        npm run build
      env: { BASE_PATH: …sin cambios…, SW_KILL: …sin cambios… }
    … upload-pages-artifact, deploy-pages sin cambios …
  ```
  El e2e va antes del build final: su `webServer` hace su propio build con `/ARC/` en `dist`, y el build final lo sobrescribe.
- **`DEPLOY.md`:**
  - Quitar «Nada de esto está activado». GitHub Pages está activo en `https://guillelpz.github.io/ARC/`.
  - Paso 3: el despliegue es automático en cada push a `main` que toque `app/**` o el workflow. Los push de solo `docs/` no publican. «Run workflow» sigue sirviendo para redesplegar a mano y para `sw_kill`.
  - Quitar el paso 5, que ya está hecho.
  - Añadir a «PWA y kill switch»:
    - Con el kill switch activo, el siguiente push a `main` que toque `app/` vuelve a registrar el service worker, así que tiene que llevar el arreglo.
    - `concurrency: cancel-in-progress` cancela un despliegue en curso si entra otro, incluido el del kill switch: no hacer push mientras se publica el kill.
    - El despliegue con `sw_kill` se salta el e2e.
  - En la línea de la prueba local, añadir que en Git Bash hay que anteponer `MSYS_NO_PATHCONV=1`.
- **Criterios de aceptación:**
  - YAML válido.
  - El primer push a `main` que toque `app/` lanza «Deploy Pages». En el log, el e2e se ejecuta y aparece `SW_KILL=[]`.
  - Un push de solo `docs/` no lo lanza.
  - «Run workflow» con `sw_kill` muestra el e2e como *skipped* y `SW_KILL=[1]`. Esto es opcional y se comprueba solo si se prueba el kill switch.
- **Dependencias:** T1 mergeado o no, da igual. No toca `app/`.

### T3 — P19.3: vista previa del enlace
- **Archivo:** `app/index.html`. Después de `<title>`:
  ```html
  <meta name="description" content="Registra lo que haces cada día y conviértelo en XP y niveles, en dos ramas: HERO y VILLAIN. Sin cuenta: tus datos se guardan en tu navegador." />
  <!-- ponytail: URL absoluta de GitHub Pages escrita a mano (og:url y og:image la exigen). Si se renombra el repo o cambia el hosting, cambiarla aquí. -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Life RPG" />
  <meta property="og:description" content="Registra lo que haces cada día y conviértelo en XP y niveles, en dos ramas: HERO y VILLAIN. Sin cuenta: tus datos se guardan en tu navegador." />
  <meta property="og:url" content="https://guillelpz.github.io/ARC/" />
  <meta property="og:image" content="https://guillelpz.github.io/ARC/icon-512.png" />
  ```
- **Criterios de aceptación:**
  - `build`, `lint` y `test` en verde.
  - Tras `MSYS_NO_PATHCONV=1 BASE_PATH=/ARC/ npm run build` (en Git Bash), `dist/index.html` contiene las dos URLs absolutas sin cambios.
  - Tras desplegar, `https://guillelpz.github.io/ARC/icon-512.png` responde 200.
- **Dependencias:** ninguna. Si T2 ya está mergeado, este push publica solo.

## 10. Riesgos

| Riesgo | Prevención o recorte |
|---|---|
| Una pestaña con problemas de lectura conserva su estado y, al guardar después, pisa lo que escribió la otra. | Es lo que pide la evaluación: hay aviso, y el original queda en `.backup.<stamp>`. Solo pasa con datos dañados o con una versión antigua que escribe campos no válidos. |
| Rebote infinito entre pestañas. | Converge en un paso como mucho (§2). Lo comprueba el test, punto 3, y la prueba manual con dos pestañas reales. |
| Un e2e inestable bloquea el despliegue. | `retries: 1` en CI. Si falla, «Run workflow» relanza. El e2e en paralelo de `ci.yml` duplica minutos en `main`: se acepta. |
| Un push publica algo roto. | Lint, test y e2e funcionan como puerta. Como red queda el kill switch, documentado. |
| Si hay que recortar | Se hace solo T1, que es la única tarea que evita pérdida de datos. |

## 11. Verificación

- **`selfcheck.ts`:** sin cambios. No cambian reglas de dominio.
- **`App.test.tsx`:** nuevo `U-pestañas` (T1).
- **Comandos (desde `app/`):** `npm run build`, `npm run lint`, `npm test` y `npm run e2e`.
- **Checklist manual:**
  - [ ] Abrir la app en dos pestañas (`npm run preview` o Pages). Registrar Gym en A: B lo muestra sin recargar. Registrar en B: A ve los dos registros y, al recargar, siguen los dos.
  - [ ] «Deshacer» y «Borrar todo» en A se reflejan en B. En B no aparece ningún toast.
  - [ ] «Borrar todo» en A hace aparecer «Recuperar copia anterior» en B. Al pulsarlo en B, A muestra los datos recuperados.
  - [ ] Exportar en A cambia «Última copia» en B.
  - [ ] En DevTools → Application, con las dos pestañas abiertas, el valor de `life-rpg-custom-v1` deja de cambiar después de una edición (no hay bucle).
  - [ ] Ventana instalada (PWA) y pestaña de Chrome a la vez: mismo resultado.
  - [ ] En el log del primer deploy automático aparece `SW_KILL=[]` y el e2e ha pasado.
  - [ ] Pegar `https://guillelpz.github.io/ARC/` en WhatsApp o Telegram muestra título, descripción e icono. Si la caché de vista previa lo impide, añadir `?v=1` a la URL.

## 12. Handoff para Claude Code

1. Se trabaja en una rama del ciclo 19, desde `main` (ya contiene el ciclo 14). Orden: T1 → T2 → T3, con un commit por tarea.
2. T1: primero los exports de `storage.ts`, luego el efecto de §7 copiado tal cual, y después el test. Los tests que lean localStorage o esperen a la vista usan `vi.waitFor`. Si oxlint avisa con `--deny-warnings`, se arregla el código; no se añade un `disable` nuevo sin un `ponytail:` que lo justifique.
3. T2: se parte del `deploy-pages.yml` actual y solo cambian `on:`, los dos pasos de e2e y el `run` del build. `permissions`, `concurrency` y `environment` no se tocan.
4. T3: los textos van tal cual, sin hex nuevos ni otras etiquetas.
5. Sin dependencias nuevas. No se toca `docs/ESTADO-ACTUAL.md` en este ciclo. Antes de cerrar cada tarea: `npm run build`, `npm run lint` y `npm test` en verde, y `npm run e2e` en T2.
