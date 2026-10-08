import { ChevronRight, Moon, Plus, RotateCcw, Shield, Sparkles } from 'lucide-react'
import type { Branch, GameState, PartyState } from '../core/types'
import type { Screen } from './BottomNav'
import { weeklyXp } from '../core/rpg'
import { PlayerHeader } from './PlayerHeader'
const MEDAL = ['bg-gold', 'bg-silver', 'bg-bronze'] // mismo podio que PartyView

type Props = {
  game: GameState
  partyStates: PartyState[]
  onNavigate: (s: Screen) => void
  onOpenParty: (id: string) => void
  onReset: () => void
}

const btn = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2'

const access = {
  hero: { Icon: Shield, label: 'HERO', tagline: 'El camino de la luz', cls: 'bg-hero-surface text-hero-text hover:bg-hero-bg outline-hero', accent: 'text-hero', muted: 'text-hero-muted' },
  villain: { Icon: Moon, label: 'VILLAIN', tagline: 'El camino de la sombra', cls: 'bg-villain-bg text-villain-text hover:bg-villain-surface outline-villain', accent: 'text-villain', muted: 'text-villain-muted' },
} as const

export function HomeView({ game, partyStates, onNavigate, onOpenParty, onReset }: Props) {
  const branchSummary = (b: Branch) => {
    return { count: game.trackers.filter(t => t.tracker.branch === b).length, weekXp: weeklyXp(game, b) }
  }

  return (
    <div className="min-h-dvh bg-app-bg text-app-text">
      <nav aria-label="Elige tu camino" className="relative grid min-h-[calc(100dvh-3.5rem)] grid-rows-2 sm:grid-cols-2 sm:grid-rows-1">
        {(['hero', 'villain'] as const).map(b => {
          const { Icon, label, cls, accent, muted, tagline } = access[b]
          const { count, weekXp } = branchSummary(b)
          return (
            <button key={b} type="button" onClick={() => onNavigate(b)}
              className={`group flex flex-col items-center justify-center gap-3 p-8 text-center transition duration-300 focus-visible:outline-2 focus-visible:-outline-offset-4 active:brightness-95 ${cls}`}>
              <Icon className={`size-14 transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none ${accent}`} strokeWidth={1.5} aria-hidden />
              <span className="text-3xl font-semibold tracking-wider sm:text-4xl">{label}</span>
              <span className={`text-sm ${muted}`}>{tagline}</span>
              <span className="text-sm font-semibold tabular-nums">
                Lv. {game[b].level} · {count} misiones · {weekXp} XP sem.
              </span>
            </button>
          )
        })}
        <span className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 rounded-full border border-app-border bg-app-surface px-3 py-1 text-sm font-semibold whitespace-nowrap tabular-nums shadow-sm">
          PLAYER Lv. {game.player.level}
        </span>
        <button type="button" onClick={() => onNavigate('new')} aria-label="Añadir actividad nueva"
          className="group absolute top-1/2 left-1/2 grid size-[72px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full shadow-lg transition duration-150 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-text motion-reduce:transition-none"
          style={{ background: 'conic-gradient(var(--color-hero-surface) 0 50%, var(--color-villain-bg) 0)' }}>
          <span className="grid size-[58px] place-items-center rounded-full bg-app-surface">
            <Plus className="size-7 transition-transform duration-150 group-hover:rotate-90 motion-reduce:transition-none" strokeWidth={2.5} aria-hidden />
          </span>
        </button>
      </nav>

      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-6 pb-28 sm:max-w-2xl lg:grid lg:max-w-4xl lg:grid-cols-2 lg:items-start">
        <div className="rise"><PlayerHeader game={game} /></div>

        <div className="rise flex flex-col gap-6" style={{ animationDelay: '80ms' }}>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Tus parties</h2>
            <ul className="divide-y divide-app-border overflow-hidden rounded-xl border border-app-border bg-app-surface shadow-sm">
              {partyStates.map(s => (
                <li key={s.party.id}>
                  <button type="button" onClick={() => onOpenParty(s.party.id)}
                    className="group flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left transition duration-150 hover:bg-app-bg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-app-text">
                    <span className={`grid size-10 shrink-0 place-items-center rounded-full text-base font-semibold tabular-nums text-app-text ${MEDAL[s.position - 1] ?? 'bg-app-track'}`}>
                      {s.position}.º
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{s.party.name}</span>
                        <span className="inline-flex items-center rounded-md border border-app-border px-2 py-0.5 text-xs font-medium text-app-muted">de ejemplo</span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        Lv. {s.game.player.level} · {s.position}.º de {s.ranking.length}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-app-muted transition duration-150 group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <button type="button" onClick={() => onNavigate('new')}
            className={`${btn} w-full border border-app-border bg-transparent text-app-text outline-app-text hover:bg-app-surface`}>
            <Sparkles className="size-4" aria-hidden /> Añadir algo nuevo
          </button>

          <footer className="flex flex-wrap items-center gap-x-1 text-xs leading-5 text-app-muted">
            <span>Historial de ejemplo · Fecha demo: 7 oct 2026 ·</span>
            <button type="button" onClick={onReset}
              className="inline-flex min-h-11 items-center gap-1 px-2 text-xs font-medium text-app-muted underline underline-offset-2 hover:text-app-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-text">
              <RotateCcw className="size-4" aria-hidden /> Restablecer demo
            </button>
          </footer>
        </div>
      </main>
    </div>
  )
}
