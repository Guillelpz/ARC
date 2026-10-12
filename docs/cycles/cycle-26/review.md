# Review ciclo 26 — voz en Gym

**Veredicto: CAMBIOS**

Comprobaciones en `cycle-26`: `npm run build` OK, `npm run lint` OK, `npm test` OK (177 tests), `npm run e2e` OK (9/9). Ninguna prueba llama a la API real.

## Hallazgos

### Importante
1. `app/src/core/voice.ts:25-31` (WORDS) y `:57` (normalizeVoice). Los números en palabra solo llegan a «treinta» y «veinticinco». Decenas como «ochenta» o «sesenta» y compuestos como «treinta y cinco» no se convierten, y el «y» se descarta. Sin clave de IA, el parser guarda como completos registros equivocados:
   - «press banca treinta y cinco kilos 8» da 5 kg × 30 reps.
   - «press banca ochenta y cinco kilos cinco» da 5 kg × 5.
   - «press banca ochenta kilos cinco» da peso 5 y sin repeticiones (incompleto, con prefill erróneo).

   Esto rompe V5 («si falta algo, no guarda») en la práctica: guarda datos falsos sin avisar. Corrección esperada: decenas completas (40..90) y compuestos «decena y unidad», o bien tratar como incompleta cualquier frase con palabras-número no resueltas. Añadir asserts VZ. Los dictados de iOS suelen dar dígitos, pero no siempre.
2. `app/src/core/voice.ts:~158` (paso 3: `if (body && weight === null) weight = 0`) más `isComplete`. Es lo que apuntaba el implementer: «dominadas 2500 kg 5» guarda 5 repeticiones con lastre 0. Lo hace tal como dice la spec (línea 159), pero contradice el espíritu de V5: el peso se oyó y era inválido, y se sustituye en silencio por 0, así que no abre el formulario. Corrección esperada: distinguir «no dicho» (→ 0) de «dicho pero fuera de rango» (→ incompleto, con el formulario prerrellenado). Lo mismo en `fromAI` (`voice.ts:~165`) para un peso fuera de rango de la IA en peso corporal. Hay que ajustar la spec y añadir un assert.

### Menor
3. Parser: no cubre «Nx» con espacios raros ni «a» («a 80 kilos»), aunque estos casos probados sí salen bien («80 x 5», «3x8 con 10 kg», «3 sets of 5 at 100 kg», «82,5 kilos»). No bloquea.
4. `vite.config.ts` añade `preview.allowedHosts` para túneles. Está documentado en T1, es inocuo y no afecta al build.

## Resto de lo pedido (sin hallazgos)
- **`haiku.ts`**: URL, cabeceras (`x-api-key`, `anthropic-version`, `anthropic-dangerous-direct-browser-access`), modelo `claude-haiku-5-5` y `output_config.format` json_schema son correctos. `thinking: {type:'disabled'}` sin `effort`, así que vale con el defecto `medium`. Trata `refusal` y cualquier `stop_reason` distinto de `end_turn` (incluye `max_tokens`) como `invalid`. Timeout de 8 s con AbortController. Valida `exerciseId` contra el catálogo activo, cae al parser con `aiError`, y escapa `<>` en la frase y en los nombres de ejercicio, con una instrucción anti-inyección en el system prompt.
- **Clave**: vive solo en `life-rpg-ai-key-v1`, fuera de `isDataKey`, de las copias, de la fusión, de `backupCurrent` y de «Borrar todo». En el estado de React solo se guardan los últimos 4 caracteres, y `askHaiku` no la escribe en consola ni en los errores.
- **V5**: guarda con `addSets` (un solo `setGym`, `occurredAt` común, un solo récord), `undoSets` de todo el comando con `retractAuto` solo si el día queda sin series, y `ensureAuto` coherente. Editar e incompleto abren Gym prerrellenado. `KEYBOARD_ON_IOS='never'` y la caída al campo de texto están según STATE, y T8 omitida a propósito.
- **Arquitectura**: `core/` sin React, persistencia solo en `storage.ts`, sin derivados guardados.
- **`ponytail:` y UI**: presentes y razonables.
- **Trailer `Co-Authored-By`**: se deja, como indicaste.

## Pendiente para aprobar
Corregir 1 y 2, con sus asserts en `selfcheck.ts`, y actualizar la línea 159 de la spec.

## Vuelta 2

Verificado `git diff 181fc5b..cycle-26` (voice.ts, selfcheck.ts, spec §7.1).

- Hallazgo 1 (números en palabra): resuelto. Decenas, compuestos con «y», veinti-, centenas y «one hundred twenty» se convierten; `mil/cero/media/docena...` dejan la frase incompleta (VZ17).
- Hallazgo 2 (peso corporal fuera de rango): resuelto en `parseGym` y `fromAI` (dicho fuera de rango = incompleto; no dicho = lastre 0) (VZ18).
- Comandos en `cycle-26`: build OK, lint OK, e2e 9/9 OK. `npm test`: 177/177 en 3 ejecuciones; en una ejecución previa falló una vez `U-V3` (App.test.tsx ~1001, valor del peso tras Editar), coincidiendo con carga por el build; no reproducible. Se anota como posible flaky, `menor`.

### Hallazgos

1. **importante** — `app/src/core/voice.ts:~76-80` (`wordNumber`, rama `TENS_EN` vs `TENS`): la asimetría ES/EN produce registros falsos guardados como completos. Comprobado ejecutando `parseGym`:
   - «press banca 3 series de ochenta cinco» → normaliza a `3 series de 80 5` → 3 series, **80 reps, 5 kg** (completo, falso).
   - «press banca ochenta cinco kilos 5 repeticiones» → **5 kg × 5** (el peso 85 se pierde en silencio; el 80 se descarta).
   - «sentadilla ochenta cinco por cinco» → 80 kg × 5 × 5 series (el 85 pasa a 80).
   - Inglés: «bench eighty five» → 85 kg, sin reps (incompleto, correcto). «thirty five by eight» → 35 × 8 (correcto).
   Es dato inventado que se guarda sin confirmación (solo queda Deshacer), justo lo que la vuelta 1 quería evitar. No es bloqueante (reversible, solo ocurre con el número hablado en palabra sin «y»; el reconocimiento del navegador suele entregar dígitos), pero un `ponytail:` no es suficiente porque el arreglo cuesta una línea. Corrección esperada: en español, decena + unidad sin «y» debe fusionarse (80+5=85) o, mínimo, marcar la frase incompleta (como `UNRESOLVED`); en ningún caso partirse en dos números. Añadir assert VZ con «ochenta cinco» (ES) y «press banca 3 series de ochenta cinco».
2. **menor** — posible flaky `U-V3` (ver arriba); sin acción salvo que reaparezca.

### Veredicto final: CAMBIOS (1 importante, 0 bloqueantes, 1 menor)
