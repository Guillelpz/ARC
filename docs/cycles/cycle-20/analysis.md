# Análisis ciclo 20

## Entregado frente a lo especificado
- P20.2: si otra pestaña trae datos dañados, la clave se bloquea para escribir y un banner fijo avisa en todas las pantallas; se limpia al recargar, recibir datos válidos, importar o recuperar. Tests `U-pestañas` y `U-pestañas-bloqueo`.
- P20.1: paso de humo tras el deploy (build + modo kill vía primera línea de `sw.js`) y «Volver atrás» en `DEPLOY.md`.
- Recortado: nada relevante; `.gitattributes` (LF) quedó fuera por opcional.

## Deuda nueva
- Menor 2 (corregido en segunda vuelta con bloqueo de acciones, pero `restoreLast` sigue sin desbloquear una clave sin copia: caso raro).
- Menor 3: «Borrar todo» con banner rota la copia buena a `.prev` (mitigado al bloquear el botón).
- Menor 4: el humo asume `page_url` terminado en `/`.
- `ponytail:` nuevos: aviso `role="status"` repetido no se relee; restaurar `.backup.<stamp>` es manual y sin purga.

## Fricción del proceso
- Lección CRLF (Windows): el `BUILD_ID` es un hash de `dist/`; con saltos de línea CRLF locales difiere del de CI (Linux, LF). Comparar `sw.js` byte a byte contra producción daba falso rojo; se resolvió comparando solo la primera línea. No comparar artefactos locales de Windows con los de CI; `.gitattributes` `* text=auto eol=lf` sería higiene.
- Hizo falta una segunda vuelta del orquestador para cerrar los menores del review; el reviewer detectó el fallo de `sw.js` solo por lectura, no ejecutando el humo.

## Riesgos para el siguiente ciclo
- El primer merge despliega: la protección real es el entorno `github-pages` limitado a `main` (checklist del usuario, pendiente de confirmar).
- El humo no está probado contra un fallo real; verificarlo en el primer deploy.
- Persisten los huecos mayores de §5: sin backend/sync, party simulada, IA solo en dev.
