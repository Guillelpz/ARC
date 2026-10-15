# Review ciclo 38

Veredicto: CAMBIOS

build, lint y test (286) en verde sobre cycle-38.

## Importante
1. `app/src/components/VoicePrivacy.tsx:4`: el aviso de privacidad no dice que ahora también se envían a Anthropic los nombres de los alimentos propios (`ownBlock` en `haiku.ts`) ni que «Dictar comida» llama a Haiku. Corrección: añadir «alimentos propios» a la lista y actualizar el test que fija `PRIVACY_TEXT`.

## Menor
1. `app/src/core/foodVoice.ts` (`foodItemsFromAI`, `head`): «tarta de queso» con el propio «Tarta» se resuelve por el término inicial y, con cantidad en gramos, queda `itemReady` y se guarda sin confirmar. No es una estimación (FV3 se cumple), pero es una mala resolución silenciosa. Mitigación sugerida: exigir coincidencia completa del nombre para guardar sola, o tratarla como «guess».
2. `FoodVoiceLog.tsx` `confirm`: usa `done` del cierre; dos clics rápidos en «Apuntar» podrían guardar dos veces antes del re-render. `confirmDone` debería ser idempotente por ítem (comprobar que sigue en `pending`).
3. U-C2 y U-FV4: la causa más probable NO son aserciones síncronas tras `fireEvent`. U-FV4 solo tiene aserciones síncronas tras un `await findByText`; el fallo encaja con el timeout por defecto de 1 s de `findBy*` con la CPU cargada (el parser/`interpret` es asíncrono y la suite tarda ~30 s). En U-C2 (líneas 1234-1237) sí hay `getByLabelText`/`net()` síncronos justo tras `fireEvent.click(Editar)`, pero `editTracker` es síncrono, así que es secundario. No se ha cambiado nada.

## Comprobado sin hallazgos
- FV3: `voiceAdds` descarta `estimate` sin `ownFlags`; captura y Dictar solo guardan `itemReady`. `learn` solo aprende un único alimento resuelto y listo (nunca una estimación), `recall` solo devuelve alimentos existentes no archivados, y O3 `deviceSure` exige `source==='parser'` y todo listo. La ración típica (`guess`) no es `itemReady`: siempre pide «Apuntar».
- A4/A5: `estimateEntry` sin propio, con macros y nombre «X (200 g)». Con la casilla se crea el propio y «Deshacer» lo archiva (`created` → `undoVoice`). Cubierto por U-FV9 y U-FV10.
- `pickCapture`: el parche acotado solo deja ganar al parser si casó un alimento no `pending`; un «new» de alta confianza no crea «Arroz».
- `interpretFood`: otro día → parser, sin clave u offline no llama a Haiku. CV/MC sin cambios salvo CV9.
- Esquema: 10 campos obligatorios por alimento, `foods` obligatorio en `captureSchema` (18 campos), `additionalProperties: false`, `max_tokens` 1000 (captura) y 800 (comida). Salida validada por tipos, enums y rangos; si algo falla, manda el parser.
- Prompt injection: el texto va recortado y sin `<`/`>`, el sistema dice que es dato, y la salida solo llega a la app como datos validados; nada se ejecuta.
- UI: tokens y paletas bien, chip de texto «Estimación», casilla con `min-h-11` y botón con `aria-label`.
