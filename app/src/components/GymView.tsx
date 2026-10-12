import { useRef, useState } from 'react'
import { ArrowLeft, CircleAlert, Minus, Plus } from 'lucide-react'
import type { Exercise, GymData, GymSet, RecordKind, WeightUnit } from '../core/types'
import { GROUPS, STEP, allExercises, convert, daySets, exerciseName, fmtSet, fmtWeight, fromKg, lastSet, liveSets, parseReps, parseWeight, recordText, records, stepWeight } from '../core/gym'
import { dayLabel } from '../core/stats'
import { DayPicker } from './DayPicker'
import { SaveFailBanner } from './SaveFailBanner'
import { Segmented } from './Segmented'

type Props = {
  gym: GymData
  today: string
  onAddSet: (input: Omit<GymSet, 'id' | 'occurredAt'>, day: string) => { kinds: RecordKind[]; auto: boolean }
  onUndoSet: (s: GymSet) => { retracted: boolean }
  onSetUnit: (u: WeightUnit) => void
  onBack: () => void
  saveFailed: boolean
  onExport: () => void
}

const DEFAULT_EXERCISE = 'bench-press'
const card = 'flex flex-col gap-3 rounded-xl border border-hero-border bg-hero-surface p-4 shadow-sm sm:p-5'
const field = 'min-h-11 w-full rounded-lg border border-hero-border bg-transparent px-3 text-sm text-hero-text outline-hero focus-visible:outline-2 focus-visible:outline-offset-2'
const btnBase = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold outline-hero transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
const primary = `${btnBase} bg-hero text-hero-on-accent hover:bg-hero/90 active:scale-[0.98] motion-reduce:transform-none`
const secondary = `${btnBase} border border-hero-border bg-transparent text-hero-text hover:bg-hero-surface`
const num = (n: number) => String(n).replace('.', ',')

export function GymView({ gym, today, onAddSet, onUndoSet, onSetUnit, onBack, saveFailed, onExport }: Props) {
  const unit = gym.unit ?? 'kg'
  const exercises = allExercises(gym.exercises)
  const active = exercises.filter(x => !x.archived)
  const kindOf = (id: string): Exercise['kind'] => exercises.find(x => x.id === id)?.kind ?? 'load'
  const prefill = (id: string, u: WeightUnit) => {
    const s = lastSet(gym.log, id)
    return s ? { w: num(convert(s.weight, s.unit, u)), r: String(s.reps) } : { w: kindOf(id) === 'bodyweight' ? '0' : '', r: '' }
  }
  const [exerciseId, setExerciseId] = useState(() => {
    const l = lastSet(gym.log)
    return l && active.some(x => x.id === l.exerciseId) ? l.exerciseId : DEFAULT_EXERCISE
  })
  const [form, setForm] = useState(() => prefill(exerciseId, unit))
  const [day, setDay] = useState(today)
  const [errors, setErrors] = useState<{ weight?: string; reps?: string }>({})
  const [status, setStatus] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)

  const sel = active.some(x => x.id === exerciseId) ? exerciseId : DEFAULT_EXERCISE
  const kind = kindOf(sel)
  const name = exerciseName(sel, gym.exercises)
  const last = lastSet(gym.log, sel)
  const recs = records(liveSets(gym.log).filter(s => s.exerciseId === sel))
  const sessionSets = daySets(gym.log, day)
  const groups: { id: string; label: string; items: Exercise[] }[] = GROUPS.map(g => ({ ...g, items: active.filter(x => x.group === g.id) }))
  const dayWord = dayLabel(day, today).toLowerCase()
  const sessionNote = (auto: boolean) => (auto ? ` Sesión de Gym apuntada en HERO (${dayWord}).` : '')

  const changeExercise = (id: string) => { setExerciseId(id); setForm(prefill(id, unit)); setErrors({}) }
  const changeUnit = (u: WeightUnit) => { onSetUnit(u); setForm(prefill(sel, u)); setErrors({}) }
  const step = (dir: 1 | -1) => setForm(f => ({ ...f, w: num(stepWeight(parseWeight(f.w) ?? 0, unit, dir)) }))

  const register = (input: Omit<GymSet, 'id' | 'occurredAt'>) => {
    const res = onAddSet(input, day)
    const s = { ...input, id: '', occurredAt: '' }
    const nm = exerciseName(input.exerciseId, gym.exercises), k = kindOf(input.exerciseId)
    setStatus(res.kinds.length
      ? `${recordText(res.kinds, s, nm, unit, k)}.${sessionNote(res.auto)}`
      : `Serie registrada: ${nm}, ${fmtSet(s, unit, k)}.${sessionNote(res.auto)}`)
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const w = parseWeight(form.w), r = parseReps(form.r)
    const errs: typeof errors = {}
    if (w === null) errs.weight = 'Indica un peso entre 0 y 2000.'
    else if (kind === 'load' && w === 0) errs.weight = 'Indica un peso mayor que 0.'
    if (r === null) errs.reps = 'Indica las repeticiones (1 a 999).'
    setErrors(errs)
    if (errs.weight || errs.reps || w === null || r === null) return
    register({ exerciseId: sel, weight: w, unit, reps: r })
  }
  const undo = (s: GymSet) => {
    const res = onUndoSet(s)
    setStatus(`Serie deshecha.${res.retracted ? ' Sesión de Gym retirada.' : ''}`)
    headingRef.current?.focus() // la fila pulsada desaparece: el foco va al encabezado de la tarjeta
  }

  const byExercise: { id: string; sets: GymSet[] }[] = []
  for (const s of sessionSets) {
    const g = byExercise.find(x => x.id === s.exerciseId)
    if (g) g.sets.push(s); else byExercise.push({ id: s.exerciseId, sets: [s] })
  }
  const sessionTitle = day === today ? 'Sesión de hoy' : dayWord === 'ayer' ? 'Sesión de ayer' : `Sesión del ${dayWord}`
  const stepLabel = fmtWeight(STEP[unit], unit)

  return (
    <div className="min-h-dvh bg-hero-bg text-hero-text">
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-6 pb-28 sm:max-w-2xl lg:max-w-4xl">
        <header className="flex flex-col items-start gap-1">
          <button type="button" onClick={onBack} className={`${secondary} mb-2`}>
            <ArrowLeft className="size-4" aria-hidden />Volver
          </button>
          <span className="text-xs font-semibold uppercase tracking-wider text-hero">HERO</span>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Gym</h1>
          <p className="text-sm text-hero-muted">Cada día con series cuenta como sesión de Gym en HERO.</p>
        </header>
        {saveFailed && <SaveFailBanner tone="hero" onExport={onExport} />}
        <Segmented<WeightUnit> label="Unidad de peso" value={unit} onChange={changeUnit} toneFor={() => 'hero'}
          options={[{ value: 'kg', label: 'kg' }, { value: 'lbs', label: 'lbs' }]} />
        <DayPicker day={day} today={today} onChange={setDay} tone="hero" />
        <label className="flex flex-col gap-1 text-sm font-medium">Ejercicio
          <select value={sel} onChange={e => changeExercise(e.target.value)} className={field}>
            {groups.filter(g => g.items.length > 0).map(g => (
              <optgroup key={g.id} label={g.label}>
                {g.items.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </optgroup>
            ))}
          </select>
        </label>

        <form onSubmit={submit} className={card} noValidate>
          <h2 className="text-base font-semibold">Registrar serie</h2>
          <div className="flex flex-col gap-1">
            <label htmlFor="gym-weight" className="text-xs font-medium">{kind === 'bodyweight' ? `Lastre (${unit})` : `Peso (${unit})`}</label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => step(-1)} aria-label={`Bajar ${stepLabel}`} className={`${secondary} min-w-11 px-0`}><Minus className="size-5" aria-hidden /></button>
              <input id="gym-weight" type="text" inputMode="decimal" autoComplete="off" value={form.w} onChange={e => setForm(f => ({ ...f, w: e.target.value }))}
                aria-invalid={!!errors.weight} aria-describedby={errors.weight ? 'gym-weight-err' : undefined} className={`${field} text-center tabular-nums`} />
              <button type="button" onClick={() => step(1)} aria-label={`Subir ${stepLabel}`} className={`${secondary} min-w-11 px-0`}><Plus className="size-5" aria-hidden /></button>
            </div>
            {errors.weight && <p id="gym-weight-err" className="flex items-center gap-2 text-sm text-hero-text"><CircleAlert className="size-4 shrink-0" aria-hidden />{errors.weight}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="gym-reps" className="text-xs font-medium">Repeticiones</label>
            <input id="gym-reps" type="text" inputMode="numeric" autoComplete="off" value={form.r} onChange={e => setForm(f => ({ ...f, r: e.target.value }))}
              aria-invalid={!!errors.reps} aria-describedby={errors.reps ? 'gym-reps-err' : undefined} className={`${field} tabular-nums`} />
            {errors.reps && <p id="gym-reps-err" className="flex items-center gap-2 text-sm text-hero-text"><CircleAlert className="size-4 shrink-0" aria-hidden />{errors.reps}</p>}
          </div>
          <button type="submit" className={primary}>Registrar serie</button>
          {last && (
            <button type="button" className={secondary} aria-label={`Repetir serie: ${fmtSet(last, unit, kind)}`}
              onClick={() => { setErrors({}); register({ exerciseId: last.exerciseId, weight: last.weight, unit: last.unit, reps: last.reps }) }}>
              Repetir serie
            </button>
          )}
        </form>

        <p role="status" className="text-sm text-hero-muted empty:sr-only">{status}</p>

        <section aria-labelledby="gym-records" className={card}>
          <h2 id="gym-records" className="text-base font-semibold">Récords · {name}</h2>
          {recs.mostReps === null ? <p className="text-sm text-hero-muted">Aún no hay series de este ejercicio.</p> : (
            <dl className="flex flex-col gap-2 text-sm">
              {recs.maxWeight && <div className="flex justify-between gap-3"><dt>Peso máximo</dt><dd className="font-semibold tabular-nums">{fmtSet(recs.maxWeight, unit, kind)}</dd></div>}
              {recs.best1rm && (
                <div className="flex justify-between gap-3">
                  <dt className="flex flex-col">1RM estimado<span className="text-xs font-normal text-hero-muted">Epley, series de hasta 12 repeticiones</span></dt>
                  <dd className="font-semibold tabular-nums">≈ {fmtWeight(fromKg(recs.best1rm.kg, unit), unit)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3"><dt>Más repeticiones</dt><dd className="font-semibold tabular-nums">{fmtSet(recs.mostReps, unit, kind)}</dd></div>
            </dl>
          )}
        </section>

        <section aria-labelledby="gym-session" className={card}>
          <h2 id="gym-session" ref={headingRef} tabIndex={-1} className="text-base font-semibold outline-hero focus-visible:outline-2">{sessionTitle}</h2>
          {byExercise.length === 0 ? <p className="text-sm text-hero-muted">No hay series este día.</p> : (
            <div className="flex flex-col gap-3">
              {byExercise.map(g => {
                const nm = exerciseName(g.id, gym.exercises), k = kindOf(g.id)
                return (
                  <div key={g.id} className="flex flex-col gap-1">
                    <h3 className="text-sm font-semibold">{nm}</h3>
                    <ul className="divide-y divide-hero-border rounded-lg border border-hero-border">
                      {g.sets.map((s, i) => (
                        <li key={s.id} className="flex items-center justify-between gap-2 pl-3">
                          <span className="text-sm tabular-nums">Serie {i + 1} · {fmtSet(s, unit, k)}</span>
                          <button type="button" onClick={() => undo(s)} aria-label={`Deshacer serie ${i + 1} de ${nm}: ${fmtSet(s, unit, k)}`}
                            className="m-1 inline-flex min-h-11 items-center justify-center rounded-lg border border-hero-border px-3 text-sm font-semibold text-hero-text outline-hero hover:bg-hero-bg focus-visible:outline-2 focus-visible:outline-offset-2">
                            Deshacer
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
