# Propuestas — ciclo 22

> **Recomendación: pausar el workflow tras el ciclo 21 y usar la app unas semanas antes de abrir más ciclos de producto.**
> Con el ciclo 21, el bucle básico está completo: registrar, corregir, objetivos, rachas, tendencias, copia, recuperar, fusionar entre dispositivos y despliegue protegido con e2e y humo. Lo que queda abierto en §5 de `docs/ESTADO-ACTUAL.md` (balance de XP «sin validar con usuarios», PARTY simulada, IA solo en dev, cuentas pospuestas) son decisiones que necesitan datos de uso real, no más código. Además, P7.2a/P11.2 y P13.4 se rechazaron y P3.5 está pospuesta, así que cualquier propuesta de producto ahora sería especulativa.
> Hoy no queda en el código ninguna deuda con riesgo real de perder datos: los `ponytail:` abiertos (resurrección al fusionar, `restoreLast` sin copia con el banner, backups `.backup.<stamp>` sin purgar) son casos raros y tienen salida con «Recuperar copia anterior» o con las copias selladas. La única propuesta es cerrar los riesgos *operativos* que quedaron sin verificar antes de dejar producción sola.
>
> Para retomar con datos, anota durante el uso: qué actividades se registran de verdad, si los umbrales de nivel se notan lentos o rápidos, cuántas veces se usa «Importar y fusionar» y si aparecen duplicados.

## P22.1 — Cerrar riesgos operativos antes de la pausa (`calidad`)
- Problema: dos riesgos del ciclo 20 siguen sin confirmar (`cycle-20/analysis.md`, «Riesgos»): (1) la protección real del despliegue es el entorno `github-pages` limitado a `main` (el `if` de `deploy-pages.yml:17-18` es cosmético según su propio comentario), y su configuración en GitHub está pendiente de confirmar por el usuario; (2) el humo post-deploy no se ha visto fallar ni pasar contra un deploy real con cambios de `app/` desde el ciclo 20. Además, la lección CRLF del ciclo 20 sigue sin `.gitattributes`.
- Propuesta: tras el merge del ciclo 21, (a) comprobar en el run de Actions que el paso de humo se ejecuta y pasa; (b) el usuario confirma en Settings → Environments que `github-pages` solo admite `main` (checklist de `DEPLOY.md`); (c) añadir `.gitattributes` con `* text=auto eol=lf` y renormalizar en un commit aparte, sin otros cambios. NO: tocar código de `app/`, ni añadir pasos nuevos al workflow.
- Valor: alto antes de dejar producción sin vigilancia (cada push a main publica). Coste: S. Riesgo: bajo (la renormalización solo cambia finales de línea; revisar que `build`, `lint`, `test` y e2e pasen).
- Requiere: un paso manual del usuario en GitHub (b); nada de runtime.
- Depende de: merge del ciclo 21.
