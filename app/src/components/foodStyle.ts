// Clases compartidas de las pantallas de Comida (paleta HERO, como GymView)
export const card = 'flex flex-col gap-3 rounded-xl border border-hero-border bg-hero-surface p-4 shadow-sm sm:p-5'
export const field = 'min-h-11 w-full rounded-lg border border-hero-border bg-transparent px-3 text-sm text-hero-text outline-hero focus-visible:outline-2 focus-visible:outline-offset-2'
const btnBase = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold outline-hero transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
export const primary = `${btnBase} bg-hero text-hero-on-accent hover:bg-hero/90 active:scale-[0.98] motion-reduce:transform-none`
export const secondary = `${btnBase} border border-hero-border bg-transparent text-hero-text hover:bg-hero-surface`
