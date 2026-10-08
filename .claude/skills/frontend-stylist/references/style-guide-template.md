# Style Guide — <App name>

> Fuente de referencia para el diseño de la aplicación. La skill frontend-stylist debe comprobar los cambios contra esta guía. Mantener cada sección breve. Esta dirección visual prevalece sobre las referencias anteriores a una estética muy playful o a un fondo oscuro uniforme.

## Feel
Una ficha de personaje RPG sobria y contemporánea: datos legibles, jerarquía clara y contraste entre luz (HERO) y oscuridad (VILLAIN). El carácter de juego viene de los niveles, emblemas y progreso; evitar estética de juguete, neón, confeti y decoración excesiva.

## Language & tone
- Idioma de interfaz: español; vocabulario fijo: `YOU`, `HERO`, `VILLAIN`, `XP`, `Lv.`, `PARTY`.
- Tono: directo, breve y sereno; segunda persona, sin exclamaciones constantes, bromas ni mensajes que juzguen al usuario.
- HERO y VILLAIN representan ramas del personaje. No asociar luz/oscuridad con aprobación, castigo o valor personal; evitar verde/rojo como código de rama.

## HERO / VILLAIN: luz y oscuridad
- HERO funciona como un modo claro local: fondos marfil o gris muy claro, texto oscuro y acento azul petróleo contenido. VILLAIN funciona como un modo oscuro local: fondos carbón, texto claro y acento violeta apagado.
- La diferencia debe reconocerse por toda la superficie, no solo por un icono o una barra. Cada bloque conserva su paleta en tarjetas, botones, bordes, barras y feedback.
- Mantener las ramas visualmente separadas: sin degradados entre ellas, resplandores cruzados, transparencias que mezclen fondos ni tarjetas con ambas paletas superpuestas. Usar espacio y límites definidos.
- Compartir tipografía, tamaños, espaciado y estructura de componentes para mantener coherencia. Contrastar las paletas sin fusionarlas.
- En vistas compartidas (cabecera, navegación, PARTY), usar una base neutral. Si aparecen ambas ramas, presentarlas en paneles o indicadores independientes, siempre etiquetados.
- La distribución de XP puede mostrar dos segmentos sólidos con un separador visible y porcentajes etiquetados; sin interpolación de colores. La rama dominante no cambia el tema de toda la aplicación.

## Color tokens
Tokens propuestos: declararlos en `app/src/index.css` mediante `@theme` antes de usarlos. Los valores son una referencia de paleta; validar contraste en las combinaciones finales. No usar hex directamente en componentes.

| Uso | HERO · claro | VILLAIN · oscuro |
|---|---|---|
| Fondo de sección | `bg-hero-bg` · `#F5F4EF` | `bg-villain-bg` · `#16141C` |
| Tarjeta / superficie | `bg-hero-surface` · `#FFFFFF` | `bg-villain-surface` · `#211E2A` |
| Borde | `border-hero-border` · `#D6D9D5` | `border-villain-border` · `#4A435A` |
| Texto principal | `text-hero-text` · `#18242B` | `text-villain-text` · `#F2EFF7` |
| Texto secundario / metadatos | `text-hero-muted` · `#53616A` | `text-villain-muted` · `#B9B1C8` |
| Acento / progreso / foco | `hero` · `#285B70` | `villain` · `#B2A0CF` |
| Texto sobre botón de acento | `text-hero-on-accent` · `#FFFFFF` | `text-villain-on-accent` · `#16141C` |
| Fondo de barra de progreso | `bg-hero-track` · `#E3E7E5` | `bg-villain-track` · `#393242` |

- Base compartida: `bg-app-bg` · `#E8E9E5`, `text-app-text` · `#20272D`, `border-app-border` · `#C8CDC9`. Sin acento de rama en la navegación global.
- No reutilizar el acento como texto sobre cualquier fondo: comprobar la pareja concreta. Estados de error, éxito y advertencia usan tokens semánticos propios, texto e icono, independientes de HERO/VILLAIN.

## Type
Una sola familia sans-serif; evitar fuentes de fantasía para datos y controles. Mayúsculas solo en el vocabulario fijo y etiquetas breves.

| Rol | Clases |
|---|---|
| Título de pantalla (h1) | `text-2xl sm:text-3xl font-semibold tracking-tight` |
| Título de sección (h2) | `text-lg font-semibold` |
| Etiqueta de rama | `text-xs font-semibold uppercase tracking-wider` |
| Número destacado | `text-3xl font-semibold tabular-nums` |
| Cuerpo | `text-sm leading-6` |
| Metadatos | `text-xs leading-5` con el token secundario de su contexto |

## Shape & spacing
- Tarjetas: `rounded-xl p-4 sm:p-5`, borde fino y sombra mínima; evitar cápsulas grandes y relieves de juguete.
- Botones: `rounded-lg px-4`; ritmo entre bloques: `gap-6`, dentro de tarjetas: `gap-3`.
- Iconos: `size-4` junto a etiquetas, `size-5` en controles independientes. Usar una sola biblioteca y el mismo grosor de trazo.
- En móvil, apilar HERO y VILLAIN con separación visible; en escritorio pueden ocupar columnas. Mantener el mismo orden de lectura y evitar scroll horizontal a 320 px.

## Buttons
Aplicar los tokens del bloque al que pertenece la acción.

| Variante | Cuándo | Clases / tratamiento |
|---|---|---|
| Acción principal | Registrar una actividad | `bg-hero text-hero-on-accent` o `bg-villain text-villain-on-accent`, `font-semibold` |
| Navegación | Cambiar entre YOU y PARTY | Superficie neutral; activo con borde y peso de texto, sin color de rama |
| Secundario | Acciones de menor énfasis | Fondo transparente, borde y texto del contexto; hover con superficie del mismo tema |

Todos: altura mínima de 44 px, `transition-colors duration-150`, foco visible con anillo de 2 px y separación. Hover perceptible, sin salto de tamaño. Disabled debe impedir la acción y conservar legibilidad; durante una operación mostrar estado ocupado y evitar envíos repetidos.

## Navigation
- YOU y PARTY mantienen posición y estilo en ambas vistas. Usar botones para cambiar la vista local y enlaces para navegación por URL.
- Indicar la vista activa con texto y borde; usar `aria-current="page"` cuando corresponda. Si se implementan tabs reales, usar `aria-selected` y su interacción de teclado.
- Cada sección HERO/VILLAIN conserva su título visible; los iconos complementan la etiqueta y no la sustituyen.

## Motion
- Feedback breve y discreto: transiciones de 150–200 ms; `.float-xp` solo junto a la acción realizada y `.pop` con escala suave solo para subida de nivel. Usar animaciones compartidas, sin keyframes por componente.
- Sin rebotes, partículas, flashes, movimientos continuos ni modales que interrumpan cada registro. El feedback hereda la paleta de su rama.
- Respetar `prefers-reduced-motion`: quitar desplazamientos y escalados, mantener confirmación textual. Ninguna animación retrasa la actualización de los datos.

## Data & progress
- Prioridad de lectura: actividad, valor actual, objetivo o periodo, acción; acumulados y comparativas quedan en segundo plano.
- Mostrar unidades, periodo y etiquetas consistentes (`Lv. 3`, `120 XP`, `3 / 4 sesiones esta semana`). Alinear números con `tabular-nums`.
- Barras con relleno sólido y contraste frente a su pista; acompañarlas de valor textual y nombre accesible. Distinguir «Distribución de XP» del progreso hacia el siguiente nivel.
- No depender del color para comunicar rama, posición en ranking o evolución. Mientras existan datos de ejemplo o fecha fija, mantener explícitas sus etiquetas («Party de ejemplo», «Historial de ejemplo», fecha).

## States & accessibility
- Vacío / cero: mostrar `0` con su unidad y una invitación breve como «Registra tu primera sesión». Un valor desconocido se indica como «Sin datos», nunca como cero.
- Carga: conservar el espacio del contenido, usar un indicador discreto y texto «Cargando…» cuando haya una operación real. Error: explicar qué falló y ofrecer recuperación; éxito: confirmar la acción sin tapar controles.
- Feedback de XP y nivel anunciado con `aria-live="polite"` sin mover el foco. Controles solo con icono requieren nombre accesible; todas las acciones deben funcionar con teclado.
- Contraste mínimo: 4.5:1 en texto normal, 3:1 en texto grande y límites o indicadores esenciales de controles. Revisar ambas paletas, incluidos foco, hover y texto secundario.
- «Restablecer demo» es una acción secundaria separada de los registros; confirmar su efecto antes de borrar el progreso local.
