// Clases de los controles de voz según la paleta (Gym = HERO; Inicio y «Yo» = neutral). Literales completos para Tailwind.
export type VoiceTone = 'hero' | 'app'
const BASE = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
export const VT = {
  hero: {
    text: 'text-hero-text', muted: 'text-hero-muted', border: 'border-hero-border', surface: 'bg-hero-surface', icon: 'text-hero',
    primary: `${BASE} bg-hero text-hero-on-accent hover:bg-hero/90 active:scale-[0.98] motion-reduce:transform-none outline-hero`,
    secondary: `${BASE} border border-hero-border bg-transparent text-hero-text hover:bg-hero-surface outline-hero`,
    field: 'min-h-11 rounded-lg border border-hero-border bg-hero-surface px-3 text-sm text-hero-text outline-hero focus-visible:outline-2 focus-visible:outline-offset-2',
    link: 'min-h-11 px-2 text-xs font-medium text-hero-muted underline underline-offset-2 hover:text-hero-text outline-hero focus-visible:outline-2',
  },
  app: {
    text: 'text-app-text', muted: 'text-app-muted', border: 'border-app-border', surface: 'bg-app-surface', icon: 'text-app-text',
    primary: `${BASE} bg-app-text text-app-surface hover:bg-app-text/90 active:scale-[0.98] motion-reduce:transform-none outline-app-text`,
    secondary: `${BASE} border border-app-border bg-transparent text-app-text hover:bg-app-surface outline-app-text`,
    field: 'min-h-11 rounded-lg border border-app-border bg-app-surface px-3 text-sm text-app-text outline-app-text focus-visible:outline-2 focus-visible:outline-offset-2',
    link: 'min-h-11 px-2 text-xs font-medium text-app-muted underline underline-offset-2 hover:text-app-text outline-app-text focus-visible:outline-2',
  },
} as const
