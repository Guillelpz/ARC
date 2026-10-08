import { useState } from 'react'
import { BookOpen, Beer, Check, Dumbbell, Footprints, Minus, Sandwich, Sparkles, Swords, type LucideIcon } from 'lucide-react'
import type { HistoryRow, TrackerStats } from '../core/types'
import { dayLabel } from '../core/stats'
import { ProgressBar } from './ProgressBar'

export type Gain = { trackerId: string; xp: number; branch: 'hero' | 'villain'; key: string }

const ICONS: Record<string, LucideIcon> = {
  gym: Dumbbell, bjj: Swords, running: Footprints, reading: BookOpen, beer: Beer, burgers: Sandwich,
}

// clases literales por rama (Tailwind las detecta así): una tarjeta, una paleta
const THEME = {
  hero: {
    card: 'border-hero-border bg-hero-surface text-hero-text',
    accent: 'text-hero', muted: 'text-hero-muted', chip: 'border-hero-border text-hero-muted',
    button: 'bg-hero text-hero-on-accent hover:bg-hero/90 outline-hero',
  },
  villain: {
    card: 'border-villain-border bg-villain-surface text-villain-text',
    accent: 'text-villain', muted: 'text-villain-muted', chip: 'border-villain-border text-villain-muted',
    button: 'bg-villain text-villain-on-accent hover:bg-villain/90 outline-villain',
  },
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0')
// km/min se añaden a la diferencia; sesiones/clases/unidades no
const withUnit = (n: string, unit: string) => (unit === 'km' || unit === 'min' ? `${n} ${unit}` : n)

type Props = { stats: TrackerStats; gain: Gain | null; dayTotal: number; dayNote?: string; today: string; history: HistoryRow[]; onUndo: (e: HistoryRow['event']) => void; onAdd: (amount: number) => void; countsIn: string[] }

export function TrackerCard({ stats, gain, dayTotal, dayNote, today, history, onUndo, onAdd, countsIn }: Props) {
  const { tracker: t, week, diff, allTime, goalPct, xp } = stats
  const Icon = ICONS[t.id] ?? Sparkles
  const c = THEME[t.branch]
  const [qty, setQty] = useState(String(t.increment))
  const n = Math.round(Number(qty))
  const valid = Number.isFinite(n) && n > 0

  return (
    <div className={`relative flex flex-col gap-3 rounded-xl border p-4 shadow-sm sm:p-5 ${c.card}`}>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className={`flex min-w-0 items-center gap-2 text-sm font-semibold uppercase tracking-wide ${c.accent}`}>
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{t.name} · Lv. {xp.level}</span>
            {t.custom && (
              <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium normal-case tracking-normal ${c.chip}`}>
                Nueva
              </span>
            )}
          </div>
          <span key={gain?.trackerId === t.id ? gain.key : undefined} className={`shrink-0 text-sm font-semibold tabular-nums ${gain?.trackerId === t.id ? 'bump' : ''}`}>{xp.xp} XP</span>
        </div>
        <ProgressBar value={xp.progress} tone={t.branch} thin label={`XP ${t.name}`} />
      </div>

      <div className="text-sm leading-6">
        <span key={gain?.trackerId === t.id ? gain.key : undefined} className={`text-3xl font-semibold tabular-nums ${gain?.trackerId === t.id ? 'bump' : ''}`}>{week}</span>
        {t.weeklyGoal ? ` / ${t.weeklyGoal} ${t.unit} esta semana` : ` ${t.unit} esta semana`}
        {goalPct !== null && goalPct >= 100 && (
          <span className={`pop ml-2 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 align-middle text-xs font-medium ${c.chip}`}>
            <Check className="size-4" aria-hidden /> Objetivo cumplido
          </span>
        )}
      </div>
      {goalPct !== null && <ProgressBar value={goalPct / 100} tone={t.branch} label={`Objetivo semanal ${t.name}`} />}

      <div className={`flex flex-col text-xs leading-5 ${c.muted}`}>
        <span>{withUnit(signed(diff), t.unit)} vs. mismo tramo anterior</span>
        <span>Histórico: {allTime} {t.unit}</span>
        {t.custom && allTime === 0 && <span>Registra tu primera vez</span>}
        <span>Cuenta en: {countsIn.join(' · ') || 'ninguna party'}</span>
      </div>

      <div className="relative">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onAdd(-n)}
            disabled={!valid || dayTotal <= 0}
            aria-label={`Restar ${n} ${t.unit} a ${t.name}`}
            className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-95 disabled:opacity-40 motion-reduce:transform-none ${c.chip}`}
          >
            <Minus className="size-4" aria-hidden />
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={qty}
            onChange={e => setQty(e.target.value)}
            aria-label={`Cantidad (${t.unit})`}
            className={`min-h-11 w-20 rounded-lg border bg-transparent px-2 text-center text-sm font-semibold tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 ${c.chip}`}
          />
          <button
            type="button"
            onClick={() => onAdd(n)}
            disabled={!valid}
            className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98] disabled:opacity-40 motion-reduce:transform-none ${c.button}`}
          >
            {valid ? `+${n} ${t.unit}${dayNote ? ` · ${dayNote}` : ''}` : t.buttonLabel}
          </button>
        </div>
        {gain?.trackerId === t.id && (
          <span key={gain.key} className={`float-xp -top-6 right-2 text-sm font-semibold tabular-nums ${c.accent}`}>
            {signed(gain.xp)} {gain.branch.toUpperCase()} XP
          </span>
        )}
      </div>

      {history.length > 0 && (
        <details className={`text-xs leading-5 ${c.muted}`}>
          <summary className="min-h-11 cursor-pointer py-3">Últimos registros</summary>
          <ul className="flex flex-col gap-1">
            {history.map(({ event: e, undone, canUndo }) => {
              const day = dayLabel(e.occurredAt.slice(0, 10), today)
              return (
                <li key={e.id} className="flex items-center justify-between gap-2">
                  <span className="tabular-nums">{day} · {signed(e.amount)} {t.unit} · {signed(e.amount * t.xpPerUnit)} XP</span>
                  {e.amount < 0
                    ? <span className={`rounded-md border px-2 py-0.5 font-medium ${c.chip}`}>{e.undoes ? 'deshecho' : 'corrección'}</span>
                    : undone
                      ? <span className={`rounded-md border px-2 py-0.5 font-medium ${c.chip}`}>deshecho</span>
                      : <button type="button" onClick={() => onUndo(e)} disabled={!canUndo}
                          aria-label={`Deshacer ${e.amount} ${t.unit} de ${day}`}
                          className={`min-h-11 rounded-lg border px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40 ${c.chip}`}>Deshacer</button>}
                </li>
              )
            })}
          </ul>
        </details>
      )}
    </div>
  )
}
