# Review ciclo 5 — Restaurar copia interna

Veredicto: APROBADO

build, lint y test (36/36) en verde sobre cycle-5. selfcheck.ts sin cambios; los tests existentes de backupCurrent no se tocaron y pasan.

## Puntos de atención
1. restoreLast: validación completa en readLast antes de escribir (una rama ilegible devuelve 'unreadable' y no se toca nada). Escrituras vía writeAll con reversión (R4 cubre fallo en la 3.ª). Una copia ilegible nunca sustituye datos buenos. OK.
2. writeAll compartido: backupCurrent conserva orden (prev, last por clave) y atomicidad; lecturas en try aparte. Sin cambio de comportamiento. OK.
3. Bloqueo: locked.delete solo de las claves restauradas y solo si ok (R6). OK.
4. Desviación `setCanRestore(hasLastBackup())` en vez de `true`: válida y mejor que la spec; si hasData es falso no se crea copia y `true` mostraría un botón inexistente. Orden respecto a setEvents/unlockStorage irrelevante (hasLastBackup lee localStorage, no estado React; backupCurrent ya terminó). Aceptada.

## Hallazgos
- bloqueante: 0
- importante: 0
- menor: 1
  - app/src/App.tsx (restore): tras restaurar no se llama a setCanRestore; es correcto (la copia sigue existiendo), solo se anota. Además `.backup.last` guarda el valor bruto de localStorage, no el estado en memoria; si la clave estaba bloqueada (escritura fallida) la copia puede diferir de lo visible. Aceptable y cubierto por el ponytail.
