# TECH SPEC — Ciclo 20: pestañas y producción (P20.2 + P20.1)

Fuentes: `docs/cycles/cycle-20/proposals.md` y `docs/cycles/cycle-20/evaluation.md`. Si no coinciden, manda la evaluación.

## 1. Resumen

- **P20.2:** si llega un evento `storage` con datos con problemas, la pestaña bloquea la escritura de las claves de datos y muestra un aviso fijo que pide recargar. Ya no pisa lo que guardó la otra pestaña. El bloqueo se quita con el siguiente evento `storage` limpio, al recargar, al importar o al recuperar una copia.
- **P20.1:** en `deploy-pages.yml`, se añade la guarda de rama (cosmética) y un paso de humo después del deploy. Ese paso compara el `assets/index-*.js` y el `sw.js` publicados con los de `dist/`, con reintentos. También se ejecuta con `sw_kill`. `docs/DEPLOY.md` gana las secciones «Volver atrás» (`git revert` + push) y «Proteger producción» (checklist del usuario en GitHub).
- **No entra:** fusionar eventos entre pestañas, Web Locks, staging, PR obligatorios, cambios en `ci.yml` ni P20.3 (sincronización).

## 2. Decisiones técnicas

| Tema | Decisión | Por qué |
|---|---|---|
| Dónde se bloquea | Solo en `onStorage` (`App.tsx`), llamando a `lockStorage()`. `loadAll` no cambia | Si se bloqueara en `loadAll`, al arrancar con datos reparables nunca se reescribiría lo reparado y la clave quedaría bloqueada para siempre (evaluación) |
| Qué claves se bloquean | Las **dos** claves de datos, aunque solo una tenga problemas | Con problemas, `onStorage` sale antes de leer nada, así que la clave «limpia» de la otra pestaña tampoco se ha cargado y escribirla también la pisaría |
| Firma | `lockStorage(keys = [KEY, CUSTOM_KEY])` | Las constantes de clave no salen de `storage.ts` |
| Aviso | Estado `stale` en App y un banner fijo y no descartable (reutiliza `UpdateBanner` con `text`, sin `onClose`), visible en todas las pantallas | El `notice` actual solo se ve en Inicio y se puede cerrar. Con la clave bloqueada, `save*` devuelve `null` y no aparece `SaveFailBanner`: sin este banner, lo que se registre se perdería sin aviso |
| Desbloqueo | Igual que hoy: un evento `storage` limpio llama a `unlockStorage()` y además `setStale(false)`. Con `stale` activo, «Borrar todo», «Importar copia» y «Recuperar copia anterior» no hacen nada y muestran «Recarga la página antes de cambiar tus datos.». Las únicas salidas son recargar o un `storage` limpio | Importar o recuperar con la clave bloqueada o con la otra pestaña desactualizada podría pisar sus datos |
| `if` de rama en el job | Se añade, con un comentario que lo marca como cosmético | Un `workflow_dispatch` lanzado desde otra rama ejecuta el YAML de esa rama. La protección real es el entorno `github-pages` limitado a `main` (paso 1 del usuario) |
| Humo y caché | `?smoke=<run_id>-<intento>` en cada `curl` | Una URL nueva evita la copia en caché del CDN de Pages |
| Humo con `sw_kill` | **Se ejecuta.** Va después de `deploy-pages`, así que no bloquea el kill switch. Si falla, el job sale en rojo, pero lo publicado ya está publicado | Confirma que el `sw.js` del kill switch está en línea |
| Qué compara el humo | El primer `assets/index-[^"]*\.js` de `dist/index.html` frente al del `index.html` publicado, y `sw.js` publicado byte a byte (solo su primera línea (BUILD_ID, ASSETS y KILL) frente a la de `dist/sw.js` | Detecta la versión anterior servida y, a la vez, que `sw.js` responde 200 |

## 3. Decisiones que requieren aprobación

Ninguna. No hay dependencias, backend ni cambios de reglas de juego. Los pasos de GitHub (entorno, ruleset, reviewers y Source de Pages) los hace el usuario y van como checklist en `DEPLOY.md` (§8, T3), no como código.

## 4. Impacto en el código

| Archivo | Cambio |
|---|---|
| `app/src/core/storage.ts` | + `lockStorage(keys?)` |
| `app/src/components/UpdateBanner.tsx` | `text?` y `onClose?` opcionales; se exporta `STALE_TAB_TEXT` |
| `app/src/App.tsx` | Estado `stale`; `onStorage` bloquea y activa `stale`; `reset`, `importData` y `restore` se bloquean mientras está activo; render del banner |
| `app/src/App.test.tsx` | Se ajusta `U-pestañas` y se añade el test `U-pestañas-bloqueo` |
| `.github/workflows/deploy-pages.yml` | `if` de rama en el job y paso de humo al final |
| `docs/DEPLOY.md` | Secciones «Volver atrás» y «Proteger producción (pasos en GitHub)»; nota del humo en «PWA y kill switch» |

## 5. Modelos de datos

No cambian.

## 6. Persistencia y migración

No cambia el formato ni las claves, así que no hay migración. El `Set` `locked` es memoria de la sesión y no se persiste: recargar siempre parte desbloqueado, salvo que `loadAll` no pueda hacer la copia (eso ya existe hoy). Al recargar, `loadAll` lee los datos de la otra pestaña, guarda el original en `.backup.<stamp>` (como hoy) y muestra `noticeFor`.

## 7. Lógica de dominio

`storage.ts`, junto a `unlockStorage`:

```ts
// Solo desde onStorage: otra pestaña guardó datos que esta no ha podido leer. Al arrancar no se usa (bloquearía para siempre).
export const lockStorage = (keys: readonly string[] = [KEY, CUSTOM_KEY]) => keys.forEach(k => locked.add(k))
```

`App.tsx`, en `onStorage`, se sustituye la línea 75:

```ts
if (r.problems.length) { lockStorage(); return setStale(true) } // no pisar lo de la otra pestaña: recargar lo lee (original en .backup.<stamp>)
unlockStorage(); setStale(false)
```

- `const [stale, setStale] = useState(false)`.
- `reset`, `importData` y `restore` empiezan con `if (stale) return setNotice(STALE_BLOCK_TEXT)`. No apagan `stale`.
- Ese evento ya no llama a `setNotice(noticeFor(...))`: el banner lo sustituye. `noticeFor` sigue en uso al arrancar.
- Los comentarios `ponytail:` de las líneas 67–68 (carrera de milisegundos) se quedan tal cual.

No se toca `core/` fuera de esta función, así que `selfcheck.ts` no cambia.

## 8. UI

`UpdateBanner`:

```ts
export const STALE_TAB_TEXT = 'Otra pestaña ha guardado datos que esta no puede leer. Recarga para seguir; lo que registres aquí no se guardará.'
// props: { tone; onReload; onClose?: () => void; text?: string } — text por defecto 'Hay una versión nueva de la app.'; sin onClose no se pinta la X
```

En App, en el lugar del render actual:

```tsx
{stale ? <UpdateBanner tone={…mismo cálculo…} text={STALE_TAB_TEXT} onReload={() => location.reload()} />
  : update && <UpdateBanner tone={…} onReload={() => location.reload()} onClose={() => setUpdate(false)} />}
```

- El banner es fijo arriba, tiene `role="status"` (ya lo tiene el componente), sigue el tono de la pantalla y no se puede cerrar. Mientras `stale` sea `true`, la región sr-only global no cambia.
- No se añaden tokens ni estilos nuevos.

## 9. Backlog

### T1 — P20.2: bloqueo tras un `storage` con problemas
- **Archivos:** `storage.ts`, `UpdateBanner.tsx`, `App.tsx`, `App.test.tsx`.
- **Funcionalidad:** §7 y §8.
- **Tests (`App.test.tsx`):**
  - En `U-pestañas`, las líneas 411–415 cambian: tras `'{roto'` + `fire(EV)`, `await vi.waitFor(() => expect(screen.getByText(STALE_TAB_TEXT)).toBeTruthy())`, sin ir a Inicio, y gym sigue en `1 /`. La línea 416 (`clear` + `fire(null)`) añade que el banner desaparece (`queryByText(STALE_TAB_TEXT)` es `null`).
  - Nuevo test `U-pestañas-bloqueo no pisa datos de otra pestaña`:
    1. `render`, ir a HERO y pulsar +1 Gym.
    2. `localStorage.setItem(EV, '{roto')`, `fire(EV)` y esperar el banner con `vi.waitFor`.
    3. Pulsar +1 Gym. La UI muestra `2 /` y `await vi.waitFor(() => expect(localStorage.getItem(EV)).toBe('{roto'))`.
    4. Escribir un array válido de un evento y `fire(EV)`. Esperar a que desaparezca el banner y a que gym muestre `1 /`.
    5. Pulsar +1 Gym y `await vi.waitFor(() => expect(stored()).toHaveLength(2))`.
    6. Repetir con `CU` = `'{roto'`. `EV` tampoco se escribe, porque se bloquean las dos claves.
- **Criterios:** se cumplen los tests; `build`, `lint` (`--deny-warnings`) y `test` en verde; ningún otro test cambia.
- **Depende de:** —

### T2 — P20.1: guarda de rama y humo en `deploy-pages.yml`
- **Archivos:** `.github/workflows/deploy-pages.yml`.
- **Funcionalidad:**
  - En el job `deploy`:
    ```yaml
    # cosmético: un workflow_dispatch desde otra rama ejecuta el YAML de esa rama. La protección real es el entorno github-pages limitado a main (DEPLOY.md)
    if: github.ref == 'refs/heads/main'
    ```
  - Último paso, después de `id: deployment`, **sin** `if: !inputs.sw_kill`:
    ```yaml
    # humo: también con sw_kill. Va después del deploy, así que no bloquea nada; si falla, el job sale en rojo
    - name: Humo (la URL publicada sirve este build)
      run: |
        url='${{ steps.deployment.outputs.page_url }}'
        want=$(grep -o 'assets/index-[^"]*\.js' dist/index.html | head -1)
        [ -n "$want" ] || { echo "::error::dist/index.html no referencia assets/index-*.js"; exit 1; }
        for i in 1 2 3 4 5; do
          got=$(curl -fsS "${url}?smoke=${GITHUB_RUN_ID}-$i" | grep -o 'assets/index-[^"]*\.js' | head -1) || true
          if [ "$got" = "$want" ] && [ "$(curl -fsS "${url}sw.js?smoke=${GITHUB_RUN_ID}-$i" | head -1)" = "$(head -1 dist/sw.js)" ]; then echo "Humo OK: $want"; exit 0; fi
          echo "Intento $i/5: publicado '$got', esperado '$want' (o sw.js distinto)"; sleep 10
        done
        echo "::error::Humo: la URL publicada no sirve este build. Ver docs/DEPLOY.md «Volver atrás»"; exit 1
    ```
    `page_url` termina en `/`. El `working-directory` del job ya es `app`.
  - El comentario de la línea 25 pasa a: «lint, test y e2e = puerta antes de publicar; con sw_kill se saltan… El humo final se ejecuta siempre».
- **Criterios:** el YAML es válido. En el primer push a main tras el merge, el paso de humo sale en verde en Actions con `Humo OK: assets/index-….js`. Con un `want` falso (prueba mental o local con `url` de otra versión), el bucle hace 5 intentos y sale con `exit 1` y una anotación `::error::`.
- **Depende de:** —

### T3 — P20.1: `docs/DEPLOY.md`
- **Archivos:** `docs/DEPLOY.md`.
- **Funcionalidad:**
  - **«Volver atrás»** (nueva sección, después de «PWA y kill switch»):
    1. Principal: `git revert <commit>` + `git push` a `main`. Vuelve a pasar la puerta (lint, test, e2e), despliega y se queda en la historia.
    2. Vía rápida: Actions → «Deploy Pages» → la última ejecución verde anterior → «Re-run all jobs». Avisos: solo funciona dentro de los 30 días siguientes a la ejecución original, y el siguiente push a `main` vuelve a publicar HEAD si no se ha revertido.
    3. Si lo roto es el service worker: `sw_kill` (sección anterior).
    4. Si el paso de humo sale en rojo, abrir la URL. Si sirve la versión anterior, relanzar el workflow; si sirve una versión rota, aplicar el punto 1.
  - **«Proteger producción (pasos en GitHub, los hace el usuario)»**, como checklist:
    - [ ] Settings → Environments → `github-pages` → «Deployment branches and tags» → «Selected branches and tags» → Add rule `main`. **Es la protección real** contra publicar desde otra rama; el `if` del workflow es cosmético.
    - [ ] Settings → Rules → Rulesets → New ruleset → New branch ruleset: nombre `main`, Enforcement «Active», Target «Include default branch», con «Restrict deletions» y «Block force pushes». **No** marcar «Require a pull request» ni «Require status checks», porque bloquean el push directo del orquestador.
    - [ ] (Opcional, no recomendado de entrada) En el mismo entorno, «Required reviewers» = tú. Cada despliegue espera tu clic.
    - [ ] Settings → Pages → Source sigue en «GitHub Actions».
  - En «PWA y kill switch», punto 6: «El despliegue con `sw_kill` se salta lint, test y e2e, pero no el humo final, que comprueba que el `sw.js` de desinstalación está publicado».
- **Criterios:** las secciones existen con esos pasos. No se toca ningún otro documento.
- **Depende de:** T2.

## 10. Riesgos

| Riesgo | Prevención | Recorte |
|---|---|---|
| El banner `stale` se queda fijo si la otra pestaña nunca escribe algo limpio | «Recargar» siempre lo resuelve (`loadAll` repara y no bloquea) | — |
| El CDN sirve `index.html` antiguo más de 50 s | Cache-buster por intento | Subir a 10 intentos |
| La comparación de `sw.js` falla por transformación del CDN (ya solo se compara la primera línea) | `curl` sin `--compressed` pide el fichero sin comprimir | Si da falsos rojos, quedarse con `curl -fsS -o /dev/null` (200) para `sw.js` |
| `cancel-in-progress` cancela el humo si entra otro push | Se acepta: el job queda cancelado, no verde | — |

## 11. Verificación

- `selfcheck.ts`: sin cambios; debe seguir terminando en `[selfcheck] done`.
- `npm run build`, `npm run lint` y `npm test` en verde desde `app/`. Los tests de UI que leen localStorage usan `vi.waitFor`.
- Checklist manual:
  - [ ] Dos pestañas en `npm run dev`. En la B, DevTools → `localStorage.setItem('life-rpg-demo-v1','{roto')`. La A muestra el banner en HERO, VILLAIN e Inicio, sin X.
  - [ ] En la A, registrar +1: la UI sube, pero la clave sigue siendo `{roto` en DevTools.
  - [ ] «Recargar» en la A: aparece el aviso de Inicio de datos dañados, se crea `.backup.<stamp>` y el siguiente registro sí se guarda.
  - [ ] En móvil (375 px), el banner no tapa la navegación inferior.
  - [ ] Después del merge, en Actions → Deploy Pages, el paso «Humo» sale en verde.

## 12. Handoff para Claude Code

1. Rama del ciclo 20. Hacer T1 → T2 → T3, en ese orden, con un commit por tarea.
2. T1: añadir `lockStorage` en `storage.ts` junto a `unlockStorage`; seguir §7 y §8 al pie de la letra. No tocar `loadAll`, `noticeFor` ni `selfcheck.ts`.
3. T2: copiar los bloques YAML de §9. El humo **no** lleva `if:`. No tocar `ci.yml`.
4. T3: solo `docs/DEPLOY.md`. No actualizar `ESTADO-ACTUAL.md` en este ciclo.
5. Sin dependencias nuevas. Cerrar con `build`, `lint` y `test` en verde desde `app/`.
