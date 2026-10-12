# Análisis ciclo 24 (módulo Gym)

## Entregado frente a lo especificado
P24.1-P24.5 completos (T1-T11): núcleo `core/gym.ts`, persistencia/backup/fusión con clave `life-rpg-gym-v1`, sesión automática en HERO, catálogo de 21 ejercicios, pestaña «Yo» (BottomNav de 6), pantalla Gym, ejercicios propios y banner de récord. Review: CAMBIOS en vuelta 1 (aviso de gym al «Recuperar»), OK en vuelta 2; 119 tests.
Desviaciones aceptadas: sin «Cargar ejemplo» de gym, «Repetir serie» por ejercicio, RecordBanner sin prefijo, `exportBackup` con gym opcional, 3 expectativas de `storage.test.ts` actualizadas. Pospuestas: P24.6-P24.12.

## Deuda nueva
- `ponytail:` (App.tsx): día con sesión manual deshecha y series vivas queda con series y 0 sesiones hasta registrar otra serie (menor aplazado).
- `ponytail:` (App.tsx): `restoreLast` con copia anterior al módulo conserva el gym actual: series sin sesión automática; se arregla con «+1» o importando copia con gym (menor aplazado).
- Sin aviso al recuperar cuando `r.gym` es null.
- El aviso `role="status"` repetido con mismo texto puede no releerse (ponytail previo).

## Fricción del proceso
El review de vuelta 1 detectó un efecto lateral de `restoreLast` (claves nuevas en backups) que la spec no listaba; conviene que el tech-lead enumere en la spec todos los puntos que tocan «la lista de claves de datos» (backup, restore, lock, isDataKey, merge, import/export). Dos menores se aplazaron por decisión de producto en vez de corregirse.

## Huecos y riesgos para el siguiente ciclo
- Pospuestas: P24.6 (nivel Gym; requiere peso corporal, dato de salud, okay explícito), P24.7 progreso 1RM por semana, P24.8 volumen por grupo, P24.9 sobrecarga progresiva (depende de P24.7), P24.10 rutinas (nuevo dato en fusión), P24.11 temporizador (riesgo en PWA), P24.12 integración con «Hoy».
- Las series de gym no dan XP propio: solo la sesión cuenta; el valor de P24.6 depende de decidir esto.
- Riesgo de escala: `GymData` crece sin límite en localStorage; sin purga ni copia automática.
- «Yo» tiene una sola tarjeta; decidir si crecerá (ajustes, perfil) antes de seguir añadiendo pestañas.
