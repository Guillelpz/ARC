import { useState } from 'react'
import { Search } from 'lucide-react'
import type { ActivityEvent, Branch, GameState, PartyState, Tracker } from '../core/types'
import { countsIn } from '../core/party'
import { byRecent } from '../core/stats'
import { normalizeText } from '../core/classify'
import { ProgressBar } from './ProgressBar'
import { TrackerCard, type Gain } from './TrackerCard'

type Props = {
  branch: Branch
  game: GameState
  partyStates: PartyState[]
  gain: Gain | null
  events: ActivityEvent[]
  onAdd: (t: Tracker, amount: number) => void
}

export function MissionsView({ branch, game, partyStates, gain, events, onAdd }: Props) {
  const hero = branch === 'hero'
  const name = hero ? 'HERO' : 'VILLAIN'
  const info = game[branch]
  // orden fijado al entrar: si se reordenara al registrar, la tarjeta saltaría bajo el dedo
  const [order] = useState(() => byRecent(game.trackers.map(s => s.tracker), events).map(t => t.id))
  const [query, setQuery] = useState('')
  const q = normalizeText(query)
  const shown = game.trackers
    .filter(s => s.tracker.branch === branch && normalizeText(s.tracker.name).includes(q))
    .sort((a, b) => order.indexOf(a.tracker.id) - order.indexOf(b.tracker.id))
  const muted = hero ? 'text-hero-muted' : 'text-villain-muted'
  return (
    <div className={`min-h-dvh ${hero ? 'bg-hero-bg text-hero-text' : 'bg-villain-bg text-villain-text'}`}>
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-6 pb-28 sm:max-w-2xl lg:max-w-4xl">
        <header className="rise flex flex-col gap-1">
          <span className={`text-xs font-semibold uppercase tracking-wider ${hero ? 'text-hero' : 'text-villain'}`}>{name}</span>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Misiones {name}</h1>
          <span key={gain?.branch === branch ? gain.key : undefined} className={`text-sm font-semibold tabular-nums ${gain?.branch === branch ? 'bump' : ''}`}>Lv. {info.level} · {info.xp} XP</span>
          <ProgressBar value={info.progress} tone={branch} label={`Progreso ${name}`} />
          <span className={`text-xs leading-5 tabular-nums ${hero ? 'text-hero-muted' : 'text-villain-muted'}`}>{info.xpInLevel} / {info.threshold} XP</span>
        </header>
        <label className="relative">
          <Search className={`pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 ${muted}`} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar misión"
            aria-label="Buscar misión"
            className={`min-h-11 w-full rounded-lg border bg-transparent pr-3 pl-9 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 ${hero ? 'border-hero-border placeholder:text-hero-muted outline-hero' : 'border-villain-border placeholder:text-villain-muted outline-villain'}`}
          />
        </label>
        {shown.length === 0 && <p className={`text-sm ${muted}`}>Ninguna misión con «{query.trim()}».</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {shown.map((s, i) => (
            <div key={s.tracker.id} className="rise" style={{ animationDelay: `${i * 60}ms` }}>
            <TrackerCard stats={s} gain={gain} onAdd={n => onAdd(s.tracker, n)}
              countsIn={countsIn(s.tracker.id, partyStates)} />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
