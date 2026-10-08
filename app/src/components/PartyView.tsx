import { useState } from 'react'
import type { Branch, GameState, Party, PartyState, RankMetric, Tracker, VoteResult } from '../core/types'
import { Check, Crown, X } from 'lucide-react'
import { buildRanking, rankScore, vote } from '../core/party'
import { Segmented } from './Segmented'

type Props = {
  states: PartyState[]
  selectedId: string
  onSelect: (id: string) => void
  global: GameState
}

const PANEL: Record<Branch, string> = {
  hero: 'border-hero-border bg-hero-surface text-hero-text',
  villain: 'border-villain-border bg-villain-bg text-villain-text',
}
const MUTED: Record<Branch, string> = { hero: 'text-hero-muted', villain: 'text-villain-muted' }
const ACCENT: Record<Branch, string> = { hero: 'text-hero', villain: 'text-villain' }
const LABEL: Record<Branch, string> = { hero: 'HERO', villain: 'VILLAIN' }
const MEDAL = ['bg-gold', 'bg-silver', 'bg-bronze']
const METRICS: { value: RankMetric; label: string }[] = [
  { value: 'hero', label: 'HERO' },
  { value: 'villain', label: 'VILLAIN' },
  { value: 'depth', label: 'Profundidad' },
]
const METRIC_TITLE: Record<RankMetric, string> = { hero: 'XP HERO', villain: 'XP VILLAIN', depth: 'Profundidad (HERO + VILLAIN)' }

// mismo marcado de votos que Desconocido: icono Lucide + texto para lector de pantalla
const Votes = ({ r }: { r: VoteResult }) => r.votes.map((v, j) => (
  <span key={v.name} className="inline-flex items-center gap-1">
    {j > 0 && <span aria-hidden="true">·</span>}
    {v.name}
    {v.yes ? <Check className="size-4" aria-hidden="true" /> : <X className="size-4" aria-hidden="true" />}
    <span className="sr-only">{v.yes ? 'sí' : 'no'}</span>
  </span>
))

function Criteria({ branch, trackers, party }: { branch: Branch; trackers: Tracker[]; party: Party }) {
  const list = trackers.filter(t => t.branch === branch)
  return (
    <div className={`rounded-lg border p-3 ${PANEL[branch]}`}>
      <p className={`text-xs font-semibold uppercase tracking-wider ${ACCENT[branch]}`}>{LABEL[branch]}</p>
      {list.length === 0
        ? <p className={`mt-1 text-sm leading-6 ${MUTED[branch]}`}>Sin criterios {LABEL[branch]}</p>
        : <ul className="mt-1 flex flex-col gap-1">
            {list.map(t => {
              // propuesta aceptada: muestra su votación; los criterios semilla no la tienen
              const r = party.seedCriteria.includes(t.id) ? null : vote(t.branch, party)
              return (
                <li key={t.id} className="text-sm font-medium">
                  {t.name}
                  {r && <span className={`flex flex-wrap items-center gap-x-1 text-xs leading-5 font-normal ${MUTED[branch]}`}>Aceptada {r.yes}/{r.total} · <Votes r={r} /></span>}
                </li>
              )
            })}
          </ul>}
    </div>
  )
}

export function PartyView({ states, selectedId, onSelect, global }: Props) {
  const s = states.find(x => x.party.id === selectedId) ?? states[0]
  const { game } = s
  const [metric, setMetric] = useState<RankMetric>('hero')
  const ranking = metric === 'hero' ? s.ranking : buildRanking(game, s.party.members, metric)
  return (
    <div className="min-h-dvh bg-app-bg text-app-text">
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-6 pb-28 sm:max-w-2xl lg:max-w-4xl">
        <header className="flex items-baseline justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">PARTY</h1>
          <span className="inline-flex items-center rounded-md border border-app-border px-2 py-0.5 text-xs font-medium text-app-muted">Party de ejemplo</span>
        </header>
        <Segmented label="Party" value={s.party.id} onChange={onSelect}
          options={states.map(x => ({ value: x.party.id, label: x.party.name }))} />

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">Tú en esta party</h2>
              <div className="flex flex-col gap-3 rounded-xl border border-app-border bg-app-surface p-4 shadow-sm sm:p-5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold uppercase tracking-wide">PLAYER Lv. {game.player.level}</p>
                  <p className="text-sm font-semibold tabular-nums">{game.player.xp} XP</p>
                </div>
                <p className="text-xs leading-5 tabular-nums text-app-muted">Global: Lv. {global.player.level} · Aquí: Lv. {game.player.level}</p>
                <div className="grid grid-cols-2 gap-3">
                  {(['hero', 'villain'] as const).map(b => (
                    <div key={b} className={`rounded-lg border p-3 ${PANEL[b]}`}>
                      <p className={`text-xs font-semibold uppercase tracking-wider ${ACCENT[b]}`}>{LABEL[b]} · Lv. {game[b].level}</p>
                      <p className="text-sm font-semibold tabular-nums">{game[b].xp} XP</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">Criterios de esta party</h2>
              <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
                <Criteria branch="hero" trackers={s.criteria} party={s.party} />
                <Criteria branch="villain" trackers={s.criteria} party={s.party} />
              </div>
              {s.rejected.length > 0 && (
                <div className="text-sm leading-6 text-app-muted">
                  <p className="font-medium">No aceptados:</p>
                  <ul className="flex flex-col gap-1">
                    {s.rejected.map(({ tracker, result }) => (
                      <li key={tracker.id}>
                        {tracker.name} · Rechazada {result.yes}/{result.total}
                        <span className="flex flex-wrap items-center gap-x-1 text-xs leading-5"><Votes r={result} /></span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Ranking semanal · {METRIC_TITLE[metric]}</h2>
            <Segmented label="Ranking" value={metric} onChange={setMetric} options={METRICS}
              toneFor={m => m === 'depth' ? 'neutral' : m} />
            <ol className="flex flex-col gap-3">
              {ranking.map((r, i) => {
                const top = rankScore(ranking[0], metric) || 1
                return (
                <li key={r.id} aria-current={r.isYou ? 'true' : undefined}
                  className={`pop flex items-center gap-3 rounded-lg p-3 shadow-sm ${r.isYou ? 'shine border-2 border-gold bg-app-text text-app-surface shadow-lg' : 'border border-app-border bg-app-surface'} ${i === 0 ? 'ring-2 ring-gold ring-offset-2 ring-offset-app-bg' : ''}`}
                  style={{ animationDelay: `${i * 80}ms`, viewTransitionName: `rank-${r.id}` }}>
                  <span className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums ${MEDAL[i] ? `${MEDAL[i]} text-app-text` : 'bg-app-track text-app-text'}`}>
                    {i === 0 ? <Crown className="size-5" aria-label="1" /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={`text-sm ${r.isYou ? 'font-bold' : 'font-medium'}`}>{r.name}</p>
                      <p className="text-sm font-semibold tabular-nums">{rankScore(r, metric)} XP</p>
                    </div>
                    <div className={`mt-1 h-1.5 overflow-hidden rounded-full ${r.isYou ? 'bg-app-muted' : 'bg-app-track'}`} aria-hidden>
                      <div className="bar-fill h-full w-full rounded-full bg-gold" style={{ transform: `translateX(${(rankScore(r, metric) / top) * 100 - 100}%)` }} />
                    </div>
                    <p className={`mt-1 text-xs leading-5 tabular-nums ${r.isYou ? 'text-app-track' : 'text-app-muted'}`}>PLAYER Lv. {r.playerLevel} · HERO Lv. {r.heroLevel} · VILLAIN Lv. {r.villainLevel}</p>
                  </div>
                </li>
                )
              })}
            </ol>
          </section>
        </div>
      </main>
    </div>
  )
}
