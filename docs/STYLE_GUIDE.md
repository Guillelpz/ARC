# Style Guide — RPG Life Tracker (V2)

> Fuente de referencia del diseño. La skill `frontend-stylist` compara cada cambio con esta guía. Basada en `.claude/skills/frontend-stylist/references/style-guide-template.md`; estado del producto en `docs/ESTADO-ACTUAL.md`. Las pantallas se definen en `docs/DESIGN-V2.md`.
> Stack: Tailwind CSS v4 (sin `tailwind.config`); los tokens se declaran con `@theme` en `app/src/index.css` y se usan como clases (`bg-hero-bg`, `text-villain-muted`…). En componentes no se usan colores hex ni la escala `slate-*`.

## Feel
Una ficha de personaje RPG sobria y contemporánea: datos legibles, jerarquía clara y contraste entre luz (HERO) y oscuridad (VILLAIN). El carácter de juego viene de niveles, XP y progreso; nada de neón, confeti, degradados ni fuentes de fantasía.

## Language & tone
- Interfaz en español. Vocabulario fijo, escrito siempre igual: `YOU`, `HERO`, `VILLAIN`, `PLAYER`, `XP`, `Lv.`, `PARTY` (como marca de sección) y `Party` en la navegación y en «Party de ejemplo». `IA` solo en la pantalla Desconocido.
- Formatos: `Lv. 3`, `120 XP`, `+15 VILLAIN XP`, `3 / 4 sesiones esta semana`, `Aceptada 2/3`, `Rechazada 1/3`, `Cuenta en: Los del Gym · La Oficina`. Separador: ` · `.
- Tono: directo, breve, sereno, en segunda persona. Sin exclamaciones en cadena ni bromas. La IA **propone**, no juzga: `La IA propone: VILLAIN`, nunca «mal hábito».
- HERO/VILLAIN son ramas, no valoraciones. Sin verde/rojo; los votos se expresan con ✓/✕ más texto.
- Botones con verbo en infinitivo: `Analizar con IA`, `Crear misión`, `Proponer`, `Ahora no`, `Volver`, `Añadir otra`, `Borrar todo`.

## Color tokens
Pegar en `app/src/index.css` (sustituye el `@theme` de V1):

```css
@theme {
  /* Base neutral: Inicio, Nuevo, Party, navegación, toasts de PLAYER */
  --color-app-bg: #E8E9E5;
  --color-app-surface: #F7F7F4;
  --color-app-border: #C8CDC9;
  --color-app-text: #20272D;
  --color-app-muted: #4F5A60;
  --color-app-track: #D5D9D5;

  /* HERO: modo claro local */
  --color-hero: #285B70;
  --color-hero-bg: #F5F4EF;
  --color-hero-surface: #FFFFFF;
  --color-hero-border: #D6D9D5;
  --color-hero-text: #18242B;
  --color-hero-muted: #53616A;
  --color-hero-on-accent: #FFFFFF;
  --color-hero-track: #E3E7E5;

  /* VILLAIN: modo oscuro local */
  --color-villain: #B2A0CF;
  --color-villain-bg: #16141C;
  --color-villain-surface: #211E2A;
  --color-villain-border: #4A435A;
  --color-villain-text: #F2EFF7;
  --color-villain-muted: #B9B1C8;
  --color-villain-on-accent: #16141C;
  --color-villain-track: #393242;
}
body { @apply bg-app-bg text-app-text antialiased; }
```

| Uso | Neutral | HERO · claro | VILLAIN · oscuro |
|---|---|---|---|
| Fondo de pantalla/sección | `bg-app-bg` | `bg-hero-bg` | `bg-villain-bg` |
| Tarjeta / superficie | `bg-app-surface` | `bg-hero-surface` | `bg-villain-surface` |
| Borde | `border-app-border` | `border-hero-border` | `border-villain-border` |
| Texto principal | `text-app-text` | `text-hero-text` | `text-villain-text` |
| Texto secundario | `text-app-muted` | `text-hero-muted` | `text-villain-muted` |
| Acento / relleno de barra / foco | `bg-app-text` · `outline-app-text` | `bg-hero` · `text-hero` · `outline-hero` | `bg-villain` · `text-villain` · `outline-villain` |
| Texto sobre acento | `text-app-surface` | `text-hero-on-accent` | `text-villain-on-accent` |
| Pista de barra | `bg-app-track` | `bg-hero-track` | `bg-villain-track` |

Reglas:
- **Una superficie, una paleta.** Un contenedor usa solo tokens de su contexto (neutral, HERO o VILLAIN). Nada de `/opacity` que deje ver otra paleta, ni degradados entre ramas.
- **Ramas dentro de vistas neutrales** (Inicio, Party, cabecera): cada rama va en su propio panel con su paleta completa (`bg-hero-surface text-hero-text` / `bg-villain-bg text-villain-text`). No pintar texto `text-villain` sobre fondo neutral claro (contraste insuficiente).
- **Indicadores de dos segmentos** (distribución de XP, anillo del nivel): segmento HERO `bg-hero`, segmento VILLAIN `bg-villain-bg`, separados por `gap-0.5` y siempre con etiqueta de porcentaje. El `conic-gradient` del anillo usa `var(--color-hero)` y `var(--color-villain-bg)` con corte seco; vacío → `var(--color-app-track)`.
- `text-hero` / `text-villain` solo para etiquetas y cifras sobre su propio fondo (contraste comprobado ≥ 4.5:1 sobre `*-surface` y `*-bg`).
- Estados de error/aviso: texto `text-app-text` + icono `CircleAlert`; no hay color semántico en V2.

## Type
Fuente del sistema (sans). Sin `font-black` ni `tracking-[0.3em]` (V1): usar la tabla.

| Rol | Clases |
|---|---|
| Título de pantalla (h1) | `text-2xl sm:text-3xl font-semibold tracking-tight` |
| Título de sección (h2) | `text-lg font-semibold` |
| Etiqueta de rama / vocabulario fijo | `text-xs font-semibold uppercase tracking-wider` |
| Nombre de tarjeta | `text-sm font-semibold uppercase tracking-wide` |
| Número destacado | `text-3xl font-semibold tabular-nums` |
| Cifra en fila (XP, Lv.) | `text-sm font-semibold tabular-nums` |
| Cuerpo | `text-sm leading-6` |
| Metadatos | `text-xs leading-5` + token `*-muted` del contexto |

## Shape & spacing
- Pantalla: `mx-auto w-full max-w-md px-4 pt-6 pb-28 sm:max-w-2xl lg:max-w-4xl` (el `pb-28` deja sitio a la navegación).
- Ritmo: `gap-6` entre bloques de pantalla; `gap-3` dentro de tarjetas y listas. Usar `flex flex-col gap-*` en lugar de `space-y-*`.
- Tarjeta: `rounded-xl border p-4 sm:p-5 shadow-sm` + tokens del contexto.
- Panel de rama compacto (dentro de vista neutral): `rounded-lg border p-3`.
- Radios permitidos: `rounded-xl` (tarjetas, toast), `rounded-lg` (botones, campos, paneles), `rounded-full` (barras, anillo). Nada de `rounded-2xl`.
- Listas de tarjetas: `grid gap-3 sm:grid-cols-2`. Sin scroll horizontal a 320 px.

## Icons
- Solo `lucide-react`, trazo por defecto. `size-4` junto a texto, `size-5` en controles independientes y navegación. Siempre acompañan a una etiqueta; si un control es solo icono, lleva `aria-label`.
- Navegación: `House` Inicio, `Shield` HERO, `Moon` VILLAIN, `Sparkles` Nuevo, `Users` Party.
- Trackers: los de V1 (`Dumbbell`, `Swords`, `Footprints`, `BookOpen`, `Beer`, `Sandwich`); personalizados `Sparkles`.
- Otros: `Check` / `X` en votos, `CircleAlert` en avisos, `ChevronRight` en filas navegables, `Trash2` en «Borrar todo».

## Buttons
Base común (todas las variantes):
`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50`
+ `outline-*` del contexto (`outline-hero`, `outline-villain`, `outline-app-text`).

| Variante | Cuándo | Clases añadidas |
|---|---|---|
| Principal HERO | Registrar, `Crear misión` con rama HERO | `bg-hero text-hero-on-accent hover:bg-hero/90 active:scale-[0.98] motion-reduce:transform-none` |
| Principal VILLAIN | Igual en VILLAIN | `bg-villain text-villain-on-accent hover:bg-villain/90 active:scale-[0.98] motion-reduce:transform-none` |
| Principal neutral | `Analizar con IA`, `Proponer` | `bg-app-text text-app-surface hover:bg-app-text/90 active:scale-[0.98] motion-reduce:transform-none` |
| Secundario | `Volver`, `Ahora no`, `Añadir algo nuevo`, `Añadir otra` | `border border-{ctx}-border bg-transparent text-{ctx}-text hover:bg-{ctx}-surface` (en neutral: `hover:bg-app-surface`) |
| Discreto | `Borrar todo` | `min-h-11 px-2 text-xs font-medium text-app-muted underline underline-offset-2 hover:text-app-text` |
| Segmento | Selector de party, rama, tipo | Contenedor `grid grid-flow-col auto-cols-fr gap-1 rounded-lg border border-app-border bg-app-surface p-1`; opción `min-h-11 rounded-md text-sm font-medium text-app-muted`; activa `bg-app-text text-app-surface font-semibold` + `aria-pressed="true"` |

- `/90` en hover solo opaca el acento sobre su propio fondo; no mezcla paletas.
- El selector de rama en Desconocido usa segmento con opción activa de su rama: HERO activa `bg-hero text-hero-on-accent`, VILLAIN activa `bg-villain-bg text-villain-text` (el panel de la propuesta ya cambia de paleta entera).
- Operaciones nunca bloquean: no hay estado «cargando» en V2 (todo es local y síncrono).

## Navigation
Barra inferior fija, neutral, 5 destinos: `Inicio`, `HERO`, `VILLAIN`, `Nuevo`, `Party`.
- `<nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-40 border-t border-app-border bg-app-surface pb-[env(safe-area-inset-bottom)]">`
- Lista: `mx-auto grid max-w-md grid-cols-5`.
- Botón: `flex min-h-14 flex-col items-center justify-center gap-0.5 border-t-2 text-xs transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-app-text`.
  - Inactivo: `border-transparent text-app-muted hover:text-app-text`.
  - Activo: `border-app-text font-semibold text-app-text` + `aria-current="page"`.
- Sin color de rama en la barra, también cuando la pantalla activa es HERO o VILLAIN.

## Cards & data
- `TrackerCard`: tarjeta del contexto de su rama. Cabecera (icono + nombre + `Lv.`), barra fina de XP, cifra semanal destacada, metadatos (`vs. mismo tramo anterior`, `Histórico`, `Cuenta en:`), botón principal a ancho completo.
- Barras (`ProgressBar`): pista `h-2` (`h-1` en variante fina) `rounded-full` con `bg-{ctx}-track`; relleno sólido `bg-hero` / `bg-villain` / `bg-app-text`; `transition-[width] duration-500`. Siempre con valor textual cerca y `role="progressbar"` + `aria-valuenow`/`aria-label`.
- Diferenciar «Distribución de XP» (dos segmentos) del progreso al siguiente nivel (una barra).
- Números con `tabular-nums`. Valores cero se muestran como `0 XP`, `0 veces esta semana`; desconocido = «Sin datos».
- Etiquetas de ejemplo visibles: `de ejemplo` (filas de party), `Party de ejemplo`.
- Chip (confianza, `Nueva`, `de ejemplo`): `inline-flex items-center rounded-md border border-{ctx}-border px-2 py-0.5 text-xs font-medium text-{ctx}-muted`.

## Motion
- Solo clases compartidas de `index.css`; nada de keyframes sueltos en componentes. Animar solo `transform`/`opacity` (nunca `width`).
  - `.rise` entrada de bloques (320 ms, escalonar 60–120 ms) · `.bar-fill` relleno de barra con `translateX` (crece al montar) · `.bump` cifra que acaba de cambiar · `.float-xp` · `.pop`.
  - Celebraciones (level-up/down, adelantamientos): una a la vez; el banner espera a que acabe el level-up. `.banner-out` sale a los 3000 ms. `.shine` hace una sola pasada.
- View Transitions con `transition()` de `src/viewTransition.ts` (sin soporte: cambio directo):
  - Cambio de pantalla (`'screen'`): la nueva entra encima subiendo 8 px; la vieja no se desvanece (evita el fogonazo claro↔oscuro). La barra de navegación (`.vt-nav`) queda fija y el indicador (`.vt-tab`) se desliza.
  - `Segmented`: la pastilla activa y las etiquetas tienen `view-transition-name` y se deslizan; las filas del ranking (`rank-<id>`) se recolocan solas.
  - Los nombres deben ser únicos en pantalla (usar `vtName()`).
- Botones con `transition` (no `transition-colors`) para que `active:scale-*` se anime. Entrada `cubic-bezier(.2, .8, .2, 1)`; salida `ease-in` y más corta.
- Toda clase nueva entra en el bloque `prefers-reduced-motion`; las `::view-transition-*` van en su propio bloque.
- Celebraciones sin `font-black`, `rounded-2xl` ni exclamaciones: la emoción la ponen el movimiento y el color.

## States & accessibility
- `aria-live="polite"` en el contenedor del toast y del resultado de votación; no mover el foco.
- Al cambiar de pantalla con la navegación: `window.scrollTo(0, 0)`; el foco se queda en el botón de navegación.
- Contraste mínimo 4.5:1 texto normal, 3:1 indicadores. Los tokens de esta guía cumplen en sus parejas de contexto; no cruzar parejas.
- Touch targets ≥ 44 px (`min-h-11`); navegación 56 px (`min-h-14`).
- «Borrar todo» pide confirmación nativa (`window.confirm('¿Borrar todos tus registros y misiones nuevas? No se puede deshacer. Exporta una copia antes si quieres conservarlos.')`).

## Migración desde V1 (hallazgos a corregir al implementar)
- `index.css`: `--color-hero #22d3ee` (cian) y `body bg-slate-950` → tokens de esta guía.
- Todos los componentes usan `slate-*`, `rounded-2xl`, `font-black`, `tracking-[0.3em]` → tablas de arriba.
- `PlayerHeader`: hex `#334155` en `style` → `var(--color-app-track)`; filas HERO/VILLAIN con `text-villain` sobre fondo neutral → paneles de rama.
- `LevelUpToast`: siempre borde `hero` aunque suba VILLAIN → paleta según rama.
- `PartyView`: fila con estadísticas fijas Gym/BJJ/Running/Beer → fila genérica (PRD Q8).
- Botones con `active:scale-95` y sin foco visible → variantes de botón.
