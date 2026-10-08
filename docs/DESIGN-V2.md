# Diseño V2 — Pantallas y componentes

Entrada: `docs/PRD-V2.md` (con las recomendaciones por defecto de §12: Q1 retroactivo, Q3 HERO + confianza baja, Q4/P1 fuera del flujo principal, Q6 ninguna party marcada, Q7 título `Desconocido` / pestaña `Nuevo`, Q8 fila genérica de ranking, Q10 toast solo global). Tokens y clases: `docs/STYLE_GUIDE.md`. Sin dependencias nuevas, sin router: `useState<Screen>` en `App.tsx`.

```ts
type Screen = 'home' | 'hero' | 'villain' | 'new' | 'party'
```

## 0. Estructura común

```text
┌──────────── 390 px ────────────┐
│ <main> pantalla activa          │  fondo de pantalla: neutral | HERO | VILLAIN
│                                 │  (envoltorio min-h-dvh con bg del contexto)
│                                 │
│ ...                             │
├─────────────────────────────────┤  <nav> neutral fija (BottomNav)
│  ⌂      ⛨      ☾      ✦      👥 │  icono size-5
│Inicio  HERO  VILLAIN Nuevo Party│  text-xs; activa: borde superior 2px + semibold
└─────────────────────────────────┘
```

- Cada pantalla es `<div className="min-h-dvh {bg} {text}"><main className="mx-auto w-full max-w-md px-4 pt-6 pb-28 sm:max-w-2xl lg:max-w-4xl flex flex-col gap-6">`.
- Escritorio: el contenido se ensancha (`sm:max-w-2xl lg:max-w-4xl`) y las listas pasan a 2 columnas (`sm:grid-cols-2`); la barra inferior se mantiene, centrada (`max-w-md`). Sin barra lateral: 5 destinos caben y evita un segundo patrón de navegación.
- `LevelUpToast` flota arriba en todas las pantallas.

## 1. Inicio (`home`, neutral)

```text
┌─────────────────────────────────┐
│ ┌ PlayerHeader (app-surface) ─┐ │
│ │ (◐3)  YOU                   │ │  anillo: segmentos hero / villain-bg
│ │       PLAYER Lv. 3          │ │
│ │       ▓▓▓▓▓▓░░░░ 220/250 XP │ │  barra neutral
│ │ ┌ panel HERO claro ───────┐ │ │
│ │ │ ⛨ HERO · Lv. 3   570 XP │ │ │
│ │ │ ▓▓▓▓▓▓▓░░░              │ │ │
│ │ └─────────────────────────┘ │ │
│ │ ┌ panel VILLAIN oscuro ───┐ │ │
│ │ │ ☾ VILLAIN · Lv. 1 150 XP│ │ │
│ │ │ ▓▓▓▓▓▓▓░░░              │ │ │
│ │ └─────────────────────────┘ │ │
│ │ Distribución de XP          │ │
│ │ ███████████ ▌█████          │ │  2 segmentos + gap
│ │ 79% HERO · 21% VILLAIN      │ │
│ └─────────────────────────────┘ │
│ ┌ HERO claro ┐  ┌ VILLAIN osc.┐ │  grid-cols-2 gap-3 (botones)
│ │⛨ Misiones  │  │☾ Misiones   │ │
│ │  HERO · 4  │  │  VILLAIN · 2│ │
│ │120 XP sem. │  │ 45 XP sem.  │ │
│ └────────────┘  └─────────────┘ │
│ Tus parties                     │  h2
│ ┌ app-surface ────────────────┐ │
│ │ Los del Gym  de ejemplo     │ │
│ │ Lv. 3 · 3.º de 4          › │ │  fila = botón → Party con esa party
│ ├─────────────────────────────┤ │
│ │ La Oficina   de ejemplo     │ │
│ │ Lv. 2 · 2.º de 4          › │ │
│ └─────────────────────────────┘ │
│ [ ✦ Añadir algo nuevo ]         │  secundario neutral, ancho completo
│ Historial de ejemplo · Fecha    │
│ demo: 7 oct 2026 · Restablecer  │  discreto + confirm()
└─────────────────────────────────┘
```

Escritorio (`lg`): `PlayerHeader` a la izquierda, columna derecha con accesos, «Tus parties» y botón (`lg:grid lg:grid-cols-2 lg:gap-6`).

## 2. Misiones HERO (`hero`, tema claro) / Misiones VILLAIN (`villain`, tema oscuro)

Misma estructura; cambia solo la paleta (`bg-hero-bg text-hero-text` ↔ `bg-villain-bg text-villain-text`) y el icono.

```text
┌─────────────────────────────────┐  bg-hero-bg
│ HERO                            │  etiqueta de rama (text-hero)
│ Misiones HERO                   │  h1
│ Lv. 3 · 570 XP                  │
│ ▓▓▓▓▓▓▓▓░░░░  170 / 200 XP      │  ProgressBar hero
│ ┌ TrackerCard (hero-surface) ─┐ │
│ │ 🏋 GYM · Lv. 4       240 XP │ │
│ │ ▓▓▓▓▓▓░░ (fina)             │ │
│ │ 3 / 4 sesiones esta semana  │ │  número text-3xl
│ │ ▓▓▓▓▓▓▓▓▓░░░ (objetivo)     │ │
│ │ +1 vs. mismo tramo anterior │ │  metadatos muted
│ │ Histórico: 12 sesiones      │ │
│ │ Cuenta en: Los del Gym ·    │ │
│ │ La Oficina                  │ │
│ │ [        + 1 sesión       ] │ │  principal HERO   +30 HERO XP ↑ (float-xp)
│ └─────────────────────────────┘ │
│ ... BJJ, Running, Reading       │
│ ┌ TrackerCard personalizada ──┐ │
│ │ ✦ MEDITAR · Lv. 1  [Nueva]  │ │
│ │ 0 veces esta semana         │ │  sin objetivo semanal
│ │ Registra tu primera vez     │ │  (solo con 0 histórico)
│ │ Cuenta en: ninguna party    │ │
│ │ [          + 1            ] │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

- Orden: 4 (o 2) semilla, después personalizados por creación. Lista `grid gap-3 sm:grid-cols-2`.
- VILLAIN: sin objetivos ni «te falta» (igual que V1).
- Estado vacío de pantalla: no aplica (siempre hay semilla).

## 3. Desconocido (`new`, neutral; la propuesta en paleta de su rama)

Cabecera fija de la pantalla: h1 `Desconocido`, subtítulo `Añade algo nuevo a tu personaje` (muted). Un solo paso visible a la vez (`step: 'write' | 'proposal' | 'parties' | 'result'`).

**Paso 1 — Escribir**
```text
│ ¿Qué has hecho?                 │  <label>
│ [ comer pizza a las 3am       ] │  input rounded-lg border-app-border min-h-11
│ 2–40 caracteres                 │  ayuda muted (aria-describedby)
│ ⚠ Ya tienes «Beer»              │  solo si duplicado (CircleAlert + texto)
│ [      ✦ Analizar con IA      ] │  principal neutral; disabled si inválido
```

**Paso 2 — Propuesta IA** (tarjeta con paleta de la rama elegida; al cambiar rama, la tarjeta cambia entera con `transition-colors`)
```text
│ ┌ villain-surface ────────────┐ │
│ │ La IA propone: VILLAIN      │ │
│ │ [Confianza alta]            │ │  chip
│ │ Detectado: «pizza», «3am»   │ │  muted
│ │ Rama   [ HERO | VILLAIN● ]  │ │  segmento
│ │ Tipo   [Veces●| Km | Min ]  │ │  segmento
│ │ XP por unidad  [ 20 ]       │ │  input number min 5 max 50 step 1
│ │ Vista previa: [ +1 · 20 XP ]│ │  botón principal no interactivo (aria-hidden, sin hover)
│ │ [ Volver ]  [ Crear misión ]│ │  secundario + principal de la rama
│ └─────────────────────────────┘ │
```
Confianza baja: chip `Confianza baja`, borde `border-dashed`, motivo `Sin pistas claras: elige tú` justo encima del segmento de rama. HERO preseleccionado (Q3), sin más énfasis.

**Paso 3 — Proponer a parties**
```text
│ Misión creada: Comer pizza a    │  aria-live
│ las 3am. Ya cuenta en tu        │
│ personaje.                      │
│ ¿A qué parties la propones?     │  fieldset/legend
│ [☐] Los del Gym                 │  checkbox nativo, fila min-h-11, accent-app-text
│ [☐] La Oficina                  │  (ninguna marcada, Q6)
│ [ Ahora no ]  [ Proponer ]      │  Proponer disabled sin selección
```
`Ahora no` → muestra `Ir a Misiones VILLAIN` (fin del flujo, PRD 4.4).

**Paso 4 — Resultado** (`aria-live="polite"`)
```text
│ ┌ app-surface ────────────────┐ │
│ │ Los del Gym    Aceptada 2/3 │ │  texto semibold, sin color
│ │ Carlos ✕ · Alex ✓ · Dani ✓  │ │  Lucide X/Check size-4 + sr-only «no»/«sí»
│ ├─────────────────────────────┤ │
│ │ La Oficina    Rechazada 1/3 │ │
│ │ Lucía ✕ · Marta ✕ · Pablo ✓ │ │
│ └─────────────────────────────┘ │
│ En las parties que la aceptaron,│
│ tus registros de Comer pizza…   │
│ suman XP; en el resto, solo a   │
│ tu personaje.                   │
│ [ Añadir otra ] [ Ir a Misiones VILLAIN ] │  secundario + principal de la rama
```
Aceptada vs. rechazada se distingue por texto e icono, nunca por color (R8). Escritorio: la columna del flujo se limita a `max-w-xl` para legibilidad.

## 4. Party (`party`, neutral)

```text
│ PARTY                 Party de ejemplo │
│ [ Los del Gym● | La Oficina ]   │  segmento; recuerda selección en memoria
│ Tú en esta party                │  h2
│ ┌ app-surface ────────────────┐ │
│ │ PLAYER Lv. 2       360 XP   │ │
│ │ Global: Lv. 3 · Aquí: Lv. 2 │ │  muted
│ │ ┌HERO claro──┐┌VILLAIN osc.┐│ │  grid-cols-2 gap-3, paneles de rama
│ │ │HERO Lv. 2  ││VILLAIN Lv.1││ │
│ │ │300 XP      ││60 XP       ││ │
│ │ └────────────┘└────────────┘│ │
│ └─────────────────────────────┘ │
│ Ranking semanal · XP HERO       │  h2
│ ┌─────────────────────────────┐ │
│ │ 1  Lucía             240 XP │ │
│ │    Player Lv. 4 · HERO Lv. 4 · VILLAIN Lv. 1
│ ├═════════════════════════════┤ │  tu fila: border-2 border-app-text + «Tú»
│ │ 2  Tú                180 XP │ │
│ │    Player Lv. 2 · HERO Lv. 2 · VILLAIN Lv. 1
│ ├─────────────────────────────┤ │
│ │ 3  Marta ... 4 Pablo ...    │ │
│ └─────────────────────────────┘ │
│ Criterios de esta party         │  h2
│ ┌HERO claro──┐ ┌VILLAIN oscuro┐ │  grid-cols-2 (apila en <360 px: grid-cols-1 min-[360px]:grid-cols-2)
│ │Running     │ │Burgers       │ │
│ │Reading     │ │              │ │
│ └────────────┘ └──────────────┘ │
│ No aceptados: Comer pizza a las │  muted; oculto si no hay rechazos
│ 3am · 1/3                       │
```

- Niveles en fila de ranking: texto neutral, sin color de rama (indicadores pequeños sobre fondo neutral no cumplirían contraste con `text-villain`).
- Panel de criterios vacío de una rama: `Sin criterios VILLAIN` en muted.
- Escritorio (`lg`): «Tú en esta party» + criterios a la izquierda, ranking a la derecha.

## 5. Componentes

| Componente | Estado | Props (alto nivel) | Notas |
|---|---|---|---|
| `BottomNav` | **Nuevo** | `screen`, `onChange(screen)` | 5 botones, `aria-current="page"`. Sustituye el `<nav>` inline de `App.tsx`. |
| `ProgressBar` | Modificado | `value`, `tone: 'hero' \| 'villain' \| 'neutral'`, `thin?`, `label` | Pista según tono (`bg-hero-track` / `bg-villain-track` / `bg-app-track`); `role="progressbar"`. `slate` → `neutral`. |
| `PlayerHeader` | Modificado | `game` (igual) | Neutral; filas HERO/VILLAIN en paneles de rama; anillo y distribución sin hex. Se reutiliza tal cual en Inicio. |
| `TrackerCard` | Modificado | `stats`, `gain`, `onAdd`, `countsIn: string[]` | Tokens de rama completos; icono `Sparkles` + chip `Nueva` si `tracker.custom`; línea `Cuenta en:`; botón principal de rama. |
| `LevelUpToast` | Modificado | `toast` + `tone: 'hero' \| 'villain' \| 'neutral'` | Paleta según tono: PLAYER → neutral, si no → rama del tracker registrado (se decide en `App`, sin tocar `core/`). |
| `PartyView` | Modificado | `parties`, `selectedId`, `onSelect`, `you` (niveles global y de party), `rows`, `criteria` (hero/villain/rejected) | Fila genérica (Q8); selector `Segmented`; paneles de criterios. |
| `HomeView` | **Nuevo** | `game`, `missionCounts`, `partySummaries`, `onNavigate`, `onOpenParty(id)`, `onReset` | Compone `PlayerHeader`, accesos, «Tus parties», pie. |
| `MissionsView` | **Nuevo** | `branch`, `game`/`level`, `cards` (stats + countsIn), `gain`, `onAdd` | Una sola vista para HERO y VILLAIN; sustituye la función `section()` de `App.tsx`. |
| `UnknownView` | **Nuevo** | `existingNames`, `parties`, `onCreate(tracker)`, `onPropose(trackerId, partyIds) → resultados`, `onGoToMissions(branch)` | Flujo de 4 pasos con estado local; llama a `classify`/`vote` de `core/`. |
| `Segmented` | **Nuevo** | `options: {value, label}[]`, `value`, `onChange`, `label` (aria) | Usado en Party (party), Desconocido (rama, tipo). Variante de rama vía `toneFor?(value)`. |

No se crean componentes para filas de party, votos o chips: son marcado inline de su vista (un solo uso cada uno). Si las clases de botón se repiten en 3+ archivos, extraerlas como constantes en `app/src/components/ui.ts` (opcional).

## 6. Estados

| Estado | Dónde | Tratamiento |
|---|---|---|
| Vacío / cero | Tarjeta personalizada sin eventos | `0 veces esta semana`, `Histórico: 0`, ayuda `Registra tu primera vez`. Nunca vacía la cifra. |
| Distribución sin XP | `PlayerHeader` | Anillo `app-track`; texto `Tu personaje empieza aquí` (V1). |
| Texto inválido / duplicado | Desconocido paso 1 | Botón disabled; ayuda `2–40 caracteres` o `⚠ Ya tienes «Beer»`. |
| Propuesta confianza baja | Desconocido paso 2 | Chip `Confianza baja`, borde discontinuo, `Sin pistas claras: elige tú` sobre el selector de rama. Mismo flujo. |
| Sin party seleccionada | Desconocido paso 3 | `Proponer` disabled; `Ahora no` disponible. |
| Votación aceptada | Desconocido paso 4 | `Aceptada 2/3` + votos ✓/✕ con nombre. |
| Votación rechazada | Desconocido paso 4 y Party | `Rechazada 1/3`; en Party aparece en `No aceptados:` con recuento. |
| Ya propuesto a una party | Desconocido paso 3 | No aplica en P0 (tracker recién creado). P1: checkbox disabled + `Ya propuesta`. |
| Level-up | Global, tras `+` | `LevelUpToast` con `.pop`, 2 s, `aria-live`; título `LEVEL UP — PLAYER 4` neutral o `LEVEL UP` en paleta de la rama. Sin modal. |
| Criterios vacíos de una rama | Party | `Sin criterios VILLAIN`. |

## 7. Microinteracciones (mínimas)

- Registrar: botón `active:scale-[0.98]` + `.float-xp` `+20 VILLAIN XP` en color de la rama sobre su tarjeta; barras animan ancho (500 ms).
- Level-up: `.pop` en el toast. Nada más.
- Cambio de rama en la propuesta IA: `transition-colors duration-150` en la tarjeta.
- Navegación: cambio instantáneo + `scrollTo(0, 0)`; sin transiciones de pantalla.
- `prefers-reduced-motion`: sin `.float-xp`, `.pop` ni escala; el texto y los números siguen confirmando.

## 8. Comprobaciones visuales para el implementador

- 320 px y 390 px: barra de 5 destinos sin desbordar (etiqueta `VILLAIN` en `text-xs` cabe en 64 px), accesos de Inicio en 2 columnas sin scroll horizontal.
- Misiones HERO: ninguna clase `villain-*`/`app-*` dentro del envoltorio; Misiones VILLAIN: ninguna `hero-*`. Excepción: la barra de navegación (neutral, fuera del envoltorio).
