# Revisión ciclo 32

Veredicto: APROBADO

`npm run build`, `npm run lint` y `npm test` (245 tests) pasan sobre `cycle-32`. No he ejecutado e2e.

Hallazgos: 0 bloqueantes, 0 importantes, 3 menores.

Verificado:
- `normEan` valida el dígito de control y acepta EAN-8, UPC-A y EAN-13.
- `parseOff` convierte kJ a kcal, prefiere kcal frente a kJ, descarta valores fuera de rango (kcal > 900, macros > 100, p+c+f > 100) y devuelve una ficha sin nutrición como `found` con `complete` falso. Elige la ración y la base g/ml.
- `fetchOff` usa `X-User-Agent` (la URL del repo, sin email), un timeout de 8 s con AbortController, 429 → `rate`, 404 → `not-found`, el resto de fallos → `http`/`network`/`timeout`/`invalid`. Nunca lanza.
- `foodByRef` evita la petición si el EAN ya existe: abre el alimento, o ofrece «Reactivar» si está archivado.
- El alimento se guarda como `Food` propio con `source`/`ref`. Esos campos ya los validaba `readFood`, así que no hay migración, y entran en las copias y la fusión como los demás propios.
- El aviso de privacidad se guarda en `life-rpg-food-privacy-v1`. Queda fuera de copias, `isDataKey` y «Borrar todo», y solo se muestra la primera vez.
- Atribución ODbL con enlace `rel="noopener noreferrer"` en la revisión. Los tests simulan `fetch` y ninguno toca la red.
- UI con tokens HERO, sin hex ni `slate-*`. Hay roles y `aria-invalid`, y A-FI1/A-FI2 con axe.
- Las cinco desviaciones declaradas son razonables. `manualRef` cumple T10, `NET_PRIVACY` se comparte con el ciclo 33 y U-FI13 cubre un punto de la spec.

Menores (no bloquean):
1. `app/src/components/FoodBarcode.tsx`: la comprobación de conexión está duplicada (`net.online` y `navigator.onLine`). Basta con una.
2. `app/src/core/merge.ts` (sin cambios): al fusionar dos copias, el mismo EAN con ids distintos genera dos alimentos con el mismo `ref`. `foodByRef` lo tolera, pero convendría anotar un `ponytail:`.
3. `app/src/components/FoodNetPrivacy.tsx` y `foodNetText.ts`: el texto `kind="label"` no se usa hasta el ciclo 33. Es deliberado, pero conviene dejarlo anotado.
