import type { Branch } from '../core/types'

export const BTN = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
export const PRESS = 'active:scale-[0.98] motion-reduce:transform-none'
export const BRANCH_BTN: Record<Branch, string> = {
  hero: `${BTN} ${PRESS} bg-hero text-hero-on-accent hover:bg-hero/90 outline-hero`,
  villain: `${BTN} ${PRESS} bg-villain text-villain-on-accent hover:bg-villain/90 outline-villain`,
}
// paleta entera de una tarjeta según la rama (HERO claro, VILLAIN oscuro)
export const CARD: Record<Branch, { box: string; muted: string; border: string; secondary: string; input: string; link: string }> = {
  hero: {
    box: 'bg-hero-surface text-hero-text border-hero-border',
    muted: 'text-hero-muted',
    border: 'border-hero-border',
    secondary: `${BTN} border border-hero-border bg-transparent text-hero-text hover:bg-hero-bg outline-hero`,
    input: 'border-hero-border bg-hero-bg text-hero-text outline-hero',
    link: 'min-h-11 px-2 text-xs font-medium text-hero-muted underline underline-offset-2 hover:text-hero-text outline-hero focus-visible:outline-2',
  },
  villain: {
    box: 'bg-villain-surface text-villain-text border-villain-border',
    muted: 'text-villain-muted',
    border: 'border-villain-border',
    secondary: `${BTN} border border-villain-border bg-transparent text-villain-text hover:bg-villain-bg outline-villain`,
    input: 'border-villain-border bg-villain-bg text-villain-text outline-villain',
    link: 'min-h-11 px-2 text-xs font-medium text-villain-muted underline underline-offset-2 hover:text-villain-text outline-villain focus-visible:outline-2',
  },
}
export const LABEL = { hero: 'HERO', villain: 'VILLAIN' } as const
