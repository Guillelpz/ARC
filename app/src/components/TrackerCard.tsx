import { useState } from 'react'
import { Archive, BookOpen, Beer, Check, Dumbbell, Flame, Footprints, Minus, Pencil, Sandwich, Sparkles, Swords, Users, type LucideIcon } from 'lucide-react'
import type { HistoryRow, Party, Tracker, TrackerStats, VoteResult, WeekRow } from '../core/types'
import { defaultGoal, unitFor } from '../core/trackers'
import { editTracker, isValidName } from '../core/classify'
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
    button: 'bg-hero text-hero-on-accent hover:bg-hero/90 outline-hero', check: 'accent-hero', bar: 'bg-hero', barNow: 'border-hero',
  },
  villain: {
    card: 'border-villain-border bg-villain-surface text-villain-text',
    accent: 'text-villain', muted: 'text-villain-muted', chip: 'border-villain-border text-villain-muted',
    button: 'bg-villain text-villain-on-accent hover:bg-villain/90 outline-villain', check: 'accent-villain scheme-dark', bar: 'bg-villain', barNow: 'border-villain',
  },
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0')
// km/min se añaden a la diferencia; sesiones/clases/unidades no
const withUnit = (n: string, unit: string) => (unit === 'km' || unit === 'min' ? `${n} ${unit}` : n)

type Props = { stats: TrackerStats; gain: Gain | null; dayTotal: number; dayNote?: string; today: string; history: HistoryRow[]; weeks: WeekRow[]; onUndo: (e: HistoryRow['event']) => void; onAdd: (amount: number) => void; countsIn: string[]; onSave?: (t: Tracker) => void; nameTaken?: (name: string) => boolean; proposable?: Party[]; proposals?: { party: string; result: VoteResult }[]; onPropose?: (partyIds: string[]) => void }

export function TrackerCard({ stats, gain, dayTotal, dayNote, today, history, weeks, onUndo, onAdd, countsIn, onSave, nameTaken, proposable, proposals, onPropose }: Props) {
  const { tracker: t, week, diff, allTime, goalPct, xp } = stats
  const Icon = ICONS[t.id] ?? Sparkles
  const c = THEME[t.branch]
  const max = Math.max(1, ...weeks.map(w => w.total))
  const weekText = (w: WeekRow) => {
    const d = new Date(w.monday + 'T00:00:00Z').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    return `Semana del ${d}${w.current ? ' (en curso)' : ''}: ${w.goal ? `${w.total} de ${w.goal} ${t.unit}` : `${w.total} ${t.unit}`}${w.met ? ', cumplida' : w.goal && !w.current ? ', no cumplida' : ''}`
  }
  const fixed = !t.custom
  const [qty, setQty] = useState(String(t.increment))
  const n = Math.round(Number(qty))
  const valid = Number.isFinite(n) && n > 0
  const [editing, setEditing] = useState(false)
  const [proposing, setProposing] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [eName, setEName] = useState(t.name)
  const [eInc, setEInc] = useState(String(t.increment))
  const [eGoal, setEGoal] = useState(t.weeklyGoal ? String(t.weeklyGoal) : '')
  const nameErr = !isValidName(eName) ? '2–40 caracteres' : nameTaken?.(eName) ? 'Ya tienes una misión con ese nombre' : null
  const incOk = Math.round(Number(eInc)) >= 1
  const goalOk = eGoal.trim() === '' || Math.round(Number(eGoal)) >= 1
  const canSave = fixed ? goalOk : !nameErr && incOk && goalOk
  const field = `min-h-11 w-full rounded-lg border bg-transparent px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 ${c.chip}`
  const open = () => { setEName(t.name); setEInc(String(t.increment)); setEGoal(t.weeklyGoal ? String(t.weeklyGoal) : ''); setProposing(false); setEditing(true) }
  const nextT = () => editTracker(t, { name: eName, increment: Number(eInc), weeklyGoal: eGoal.trim() === '' ? null : Number(eGoal) })
  const save = () => {
    if (fixed) { onSave?.({ ...t, weeklyGoal: eGoal.trim() === '' ? undefined : Number(eGoal) }); setEditing(false); return }
    const next = nextT()
    onSave?.(next); setQty(String(next.increment)); setEditing(false)
  }

  return (
    <div role="group" aria-label={t.name} className={`relative flex flex-col gap-3 rounded-xl border p-4 shadow-sm sm:p-5 ${c.card}`}>
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
          <div className="flex shrink-0 items-center gap-2">
            <span key={gain?.trackerId === t.id ? gain.key : undefined} className={`text-sm font-semibold tabular-nums ${gain?.trackerId === t.id ? 'bump' : ''}`}>{xp.xp} XP</span>
            {onSave && (
              <button type="button" onClick={open} aria-label={fixed ? `Editar objetivo de ${t.name}` : `Editar ${t.name}`}
                className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border focus-visible:outline-2 focus-visible:outline-offset-2 ${c.chip}`}>
                <Pencil className="size-4" aria-hidden />
              </button>
            )}
          </div>
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
        {stats.streak >= 1 && (
          <span key={stats.streak} className={`pop ml-2 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 align-middle text-xs font-medium ${c.chip}`}>
            <Flame className="size-4" aria-hidden /> Racha: {stats.streak} {stats.streak === 1 ? 'semana' : 'semanas'}
          </span>
        )}
      </div>
      {goalPct !== null && <ProgressBar value={goalPct / 100} tone={t.branch} label={`Objetivo semanal ${t.name}`} />}

      <div className={`flex flex-col text-xs leading-5 ${c.muted}`}>
        <span>{withUnit(signed(diff), t.unit)} vs. mismo tramo anterior</span>
        <span>Histórico: {allTime} {t.unit}</span>
        {t.custom && allTime === 0 && <span>Registra tu primera vez</span>}
        <span>Cuenta en: {countsIn.join(' · ') || 'ninguna party'}</span>
        {proposals && <div aria-live="polite" className="flex flex-col">
          {proposals.map(p => <span key={p.party}>{p.result.accepted ? 'Aceptada' : 'Rechazada'} en {p.party} · {p.result.yes}/{p.result.total}</span>)}
        </div>}
      </div>

      {editing ? (
        <div className="flex flex-col gap-3">
          {!fixed && (<>
            <label className="flex flex-col gap-1 text-xs font-medium">Nombre
              <input value={eName} onChange={e => setEName(e.target.value)} maxLength={40} className={field} />
              {nameErr && <span className={`text-xs ${c.muted}`}>{nameErr}</span>}
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">Incremento ({t.unit})
              <input type="number" min={1} step={1} value={eInc} onChange={e => setEInc(e.target.value)} className={field} />
            </label>
          </>)}
          {t.branch === 'hero' && (
            <label className="flex flex-col gap-1 text-xs font-medium">Objetivo semanal ({t.unit})
              <input type="number" min={1} step={1} value={eGoal} onChange={e => setEGoal(e.target.value)} placeholder={fixed ? String(defaultGoal(t.id)) : undefined} className={field} />
              {fixed && <span className={`text-xs ${c.muted}`}>Déjalo vacío para volver a {defaultGoal(t.id)} {t.unit}.</span>}
            </label>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(false)}
              className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 ${c.chip}`}>Cancelar</button>
            <button type="button" onClick={save} disabled={!canSave}
              className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-lg px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40 ${c.button}`}>Guardar</button>
          </div>
          {!fixed && <div className="flex flex-col gap-2 border-t pt-3">
            <p className={`text-xs leading-5 ${c.muted}`}>Archivar guarda los cambios válidos y la oculta de esta lista. Sus registros siguen contando y puedes reactivarla desde Inicio.</p>
            <button type="button" onClick={() => onSave?.({ ...(canSave ? nextT() : t), archived: true })}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 ${c.chip}`}>
              <Archive className="size-4" aria-hidden /> Archivar
            </button>
          </div>}
        </div>
      ) : proposing ? (
        <div className="flex flex-col gap-3">
          <fieldset className="flex flex-col">
            <legend className="text-xs font-medium">¿A qué parties la propones?</legend>
            {proposable?.map(p => (
              <label key={p.id} className="flex min-h-11 items-center gap-3 text-sm">
                <input type="checkbox" className={`size-5 ${c.check}`} checked={picked.includes(p.id)}
                  onChange={e => setPicked(e.target.checked ? [...picked, p.id] : picked.filter(x => x !== p.id))} />
                {p.name}
              </label>
            ))}
          </fieldset>
          <div className="flex gap-2">
            <button type="button" onClick={() => setProposing(false)}
              className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 ${c.chip}`}>Cancelar</button>
            <button type="button" disabled={!picked.length} onClick={() => { onPropose?.(picked); setProposing(false) }}
              className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-lg px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40 ${c.button}`}>Proponer</button>
          </div>
        </div>
      ) : (
      <div className="relative flex flex-col gap-3">
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
        {proposable && proposable.length > 0 && (
          <button type="button" onClick={() => { setPicked([]); setProposing(true) }} aria-label={`Proponer ${t.name} a una party`}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 ${c.chip}`}>
            <Users className="size-4" aria-hidden /> Proponer a party
          </button>
        )}
        {gain?.trackerId === t.id && (
          <span key={gain.key} className={`float-xp -top-6 right-2 text-sm font-semibold tabular-nums ${c.accent}`}>
            {signed(gain.xp)} {gain.branch.toUpperCase()} XP
          </span>
        )}
      </div>
      )}

      {weeks.some(w => w.total !== 0) && (
        <details className={`text-xs leading-5 ${c.muted}`}>
          <summary className="min-h-11 cursor-pointer py-3">Últimas 8 semanas</summary>
          <div aria-hidden className={`flex h-16 items-end gap-1 border-b ${c.chip}`}>
            {weeks.map(w => <div key={w.monday} className="flex h-full flex-1 items-end">
              <div className={`w-full rounded-t ${w.current ? `min-h-1 border-2 border-dashed ${c.barNow}` : c.bar}`}
                style={{ height: `${w.total > 0 ? (w.total / max) * 100 : 0}%` }} />
            </div>)}
          </div>
          <div aria-hidden className="flex gap-1">{weeks.map(w => <span key={w.monday} className="flex h-4 flex-1 justify-center">{w.met && <Check className="size-3" />}</span>)}</div>
          <p aria-hidden className="flex flex-wrap items-center gap-1"><Check className="size-3" /> objetivo cumplido · borde discontinuo: semana en curso</p>
          <ul className="sr-only">{weeks.map(w => <li key={w.monday}>{weekText(w)}</li>)}</ul>
        </details>
      )}

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
                          aria-label={`Deshacer ${e.amount} ${unitFor(e.amount, t.unit)} de ${day}`}
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
