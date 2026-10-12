import { ArrowLeft } from 'lucide-react'
import { SaveFailBanner } from './SaveFailBanner'

type Props = { onBack: () => void; saveFailed: boolean; onExport: () => void }

export function GymView({ onBack, saveFailed, onExport }: Props) {
  return (
    <div className="min-h-dvh bg-hero-bg text-hero-text">
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-6 pb-28 sm:max-w-2xl lg:max-w-4xl">
        <header className="flex flex-col items-start gap-1">
          <button type="button" onClick={onBack}
            className="mb-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-hero-border bg-transparent px-4 text-sm font-semibold text-hero-text outline-hero transition-colors duration-150 hover:bg-hero-surface focus-visible:outline-2 focus-visible:outline-offset-2">
            <ArrowLeft className="size-4" aria-hidden />Volver
          </button>
          <span className="text-xs font-semibold uppercase tracking-wider text-hero">HERO</span>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Gym</h1>
          <p className="text-sm text-hero-muted">Cada día con series cuenta como sesión de Gym en HERO.</p>
        </header>
        {saveFailed && <SaveFailBanner tone="hero" onExport={onExport} />}
      </main>
    </div>
  )
}
