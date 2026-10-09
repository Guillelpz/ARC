import { useState } from 'react'
import { Search } from 'lucide-react'
import type { ActivityEvent, Branch, GameState, PartyState, Tracker } from '../core/types'
import { countsIn, vote } from '../core/party'
import { addDays, byRecent, dayLabel, dayTotal, history } from '../core/stats'
import { isDuplicateName, normalizeText } from '../core/classify'
import { ProgressBar } from './ProgressBar'
import { SaveFailBanner } from './SaveFailBanner'
import { TrackerCard, type Gain } from './TrackerCard'

type Props = {
  branch: Branch
  game: GameState
  partyStates: PartyState[]
  gain: Gain | null
  events: ActivityEvent[]
  today: string
  onAdd: (t: Tracker, amount: number, day: string) => void
  onUndo: (t: Tracker, e: ActivityEvent) => void
  onSave: (t: Tracker) => void
  onPropose: (trackerId: string, partyIds: string[]) => void
  saveFailed: boolean
  onExport: () => void
}

export function MissionsView({ branch, game, partyStates, gain, events, today, onAdd, onUndo, onSave, onPropose, saveFailed, onExport }: Props) {
  const hero = branch === 'hero'
  const name = hero ? 'HERO' : 'VILLAIN'
  const info = game[branch]
  // orden fijado al entrar: si se reordenara al registrar, la tarjeta saltaría bajo el dedo
  const [order] = useState(() => byRecent(game.trackers.map(s => s.tracker), events).map(t => t.id))
  const [query, setQuery] = useState('')
  const q = normalizeText(query)
  const shown = game.trackers
    .filter(s => s.tracker.branch === branch && !s.tracker.archived && normalizeText(s.tracker.name).includes(q))
    .sort((a, b) => order.indexOf(a.tracker.id) - order.indexOf(b.tracker.id))
  const [day, setDay] = useState(today)
  const yesterday = addDays(today, -1)
  const SEG = hero
    ? { ring: 'outline-hero', box: 'border-hero-border bg-hero-surface', opt: 'text-hero-muted', on: 'bg-hero text-hero-on-accent font-semibold', scheme: 'scheme-light' }
    : { ring: 'outline-villain', box: 'border-villain-border bg-villain-surface', opt: 'text-villain-muted', on: 'bg-villain text-villain-on-accent font-semibold', scheme: 'scheme-dark' }
  const optCls = (active: boolean) => `min-h-11 rounded-md text-sm focus-visible:outline-2 focus-visible:outline-offset-2 ${SEG.ring} ${active ? SEG.on : `font-medium ${SEG.opt}`}`
  const muted = hero ? 'text-hero-muted' : 'text-villain-muted'
  const has = (s: PartyState, id: string) => s.criteria.some(c => c.id === id)
  const isRejected = (s: PartyState, id: string) => s.rejected.some(r => r.tracker.id === id)
  const proposable = (t: Tracker) => partyStates.filter(s => !has(s, t.id) && !isRejected(s, t.id)).map(s => s.party)
  const proposals = (t: Tracker) => partyStates.flatMap(s =>
    has(s, t.id) ? [{ party: s.party.name, result: vote(t.branch, s.party) }]
    : s.rejected.filter(r => r.tracker.id === t.id).map(r => ({ party: s.party.name, result: r.result })))
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
        {saveFailed && <SaveFailBanner tone={branch} onExport={onExport} />}
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
        <div className="flex flex-col gap-1">
          <span className={`text-xs leading-5 ${muted}`}>Registrar en</span>
          <div className={`grid grid-flow-col auto-cols-fr gap-1 rounded-lg border p-1 ${SEG.box}`}>
            <button type="button" aria-pressed={day === today} onClick={() => setDay(today)} className={optCls(day === today)}>Hoy</button>
            <button type="button" aria-pressed={day === yesterday} onClick={() => setDay(yesterday)} className={optCls(day === yesterday)}>Ayer</button>
            <input type="date" max={today} value={day} aria-label="Elegir día"
              onChange={e => setDay(e.target.value && e.target.value <= today ? e.target.value : today)}
              className={`${optCls(day !== today && day !== yesterday)} min-w-0 bg-transparent text-center ${SEG.scheme}`} />
          </div>
        </div>
        {shown.length === 0 && <p className={`text-sm ${muted}`}>Ninguna misión con «{query.trim()}».</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {shown.map((s, i) => (
            <div key={s.tracker.id} className="rise" style={{ animationDelay: `${i * 60}ms` }}>
            <TrackerCard stats={s} gain={gain} today={today} history={history(events, s.tracker.id)} onUndo={e => onUndo(s.tracker, e)} dayTotal={dayTotal(events, s.tracker.id, day)} dayNote={day === today ? undefined : dayLabel(day, today).toLowerCase()} onAdd={n => onAdd(s.tracker, n, day)}
              countsIn={countsIn(s.tracker.id, partyStates)}
              proposable={s.tracker.custom ? proposable(s.tracker) : undefined}
              proposals={s.tracker.custom ? proposals(s.tracker) : undefined}
              onPropose={s.tracker.custom ? ids => onPropose(s.tracker.id, ids) : undefined}
              onSave={s.tracker.custom || s.tracker.weeklyGoal ? onSave : undefined}
              nameTaken={n => isDuplicateName(n, game.trackers.map(x => x.tracker).filter(x => x.id !== s.tracker.id))} />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
