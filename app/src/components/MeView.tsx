import { useEffect, useRef } from 'react'
import { ChevronRight, Dumbbell } from 'lucide-react'

export function MeView({ onOpenGym, focusGym }: { onOpenGym: () => void; focusGym: boolean }) {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (focusGym) ref.current?.focus() }, [focusGym])
  return (
    <div className="min-h-dvh bg-app-bg text-app-text">
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-6 pb-28 sm:max-w-2xl lg:max-w-4xl">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Yo</h1>
          <p className="text-sm text-app-muted">Tus módulos personales.</p>
        </header>
        <button ref={ref} type="button" onClick={onOpenGym}
          className="group flex min-h-11 items-center gap-3 rounded-xl border border-hero-border bg-hero-surface p-4 text-left text-hero-text shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 outline-hero">
          <Dumbbell className="size-5 shrink-0 text-hero" aria-hidden />
          <span className="flex flex-1 flex-col">
            <span className="text-base font-semibold">Gym</span>
            <span className="text-sm text-hero-muted">Series, pesos y récords</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-hero-muted transition duration-150 group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden />
        </button>
      </main>
    </div>
  )
}
