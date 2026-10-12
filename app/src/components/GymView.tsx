import { useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, CircleAlert, Minus, Plus } from 'lucide-react'
import type { Exercise, GymData, GymSet, MuscleGroup, RecordKind, Routine, WeightUnit } from '../core/types'
import { GROUPS, MAX_ROUTINES, STEP, allExercises, convert, daySets, exerciseName, fmtSet, fmtWeight, fromKg, groupVolume, lastSet, liveSets, parseReps, parseWeight, recordText, records, routineFromDay, routineProgress, stepWeight, weeklyBest1rm } from '../core/gym'
import { dayLabel, shortDate } from '../core/stats'
import { isValidName, normalizeText, trackerName } from '../core/classify'
import { draftText, type GymDraft, type VoiceCommand } from '../core/voice'
import { DayPicker } from './DayPicker'
import { VoiceLog, type VoiceMissing } from './VoiceLog'
import { SaveFailBanner } from './SaveFailBanner'
import { Segmented } from './Segmented'

type Props = {
  gym: GymData
  today: string
  onAddSet: (input: Omit<GymSet, 'id' | 'occurredAt'>, day: string) => { kinds: RecordKind[]; auto: boolean }
  onUndoSet: (s: GymSet) => { retracted: boolean }
  onSetUnit: (u: WeightUnit) => void
  onCreateExercise: (e: Exercise) => void
  onArchiveExercise: (id: string, archived: boolean) => void
  onSaveRoutine: (r: Routine) => void
  onDeleteRoutine: (id: string) => void
  onBack: () => void
  saveFailed: boolean
  onExport: () => void
  voice: { ack: boolean; onAck: () => void; onInterpret: (text: string) => Promise<VoiceCommand>; onSave: (cmd: VoiceCommand, day: string) => { ids: string[]; auto: boolean }; onUndo: (ids: string[]) => { retracted: boolean } }
}

const DEFAULT_EXERCISE = 'bench-press'
const card = 'flex flex-col gap-3 rounded-xl border border-hero-border bg-hero-surface p-4 shadow-sm sm:p-5'
const field = 'min-h-11 w-full rounded-lg border border-hero-border bg-transparent px-3 text-sm text-hero-text outline-hero focus-visible:outline-2 focus-visible:outline-offset-2'
const btnBase = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold outline-hero transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
const primary = `${btnBase} bg-hero text-hero-on-accent hover:bg-hero/90 active:scale-[0.98] motion-reduce:transform-none`
const secondary = `${btnBase} border border-hero-border bg-transparent text-hero-text hover:bg-hero-surface`
const int = (kg: number, u: WeightUnit) => `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0, useGrouping: 'always' }).format(Math.round(fromKg(kg, u)))} ${u}`
const num = (n: number) => String(n).replace('.', ',')

export function GymView({ gym, today, onAddSet, onUndoSet, onSetUnit, onCreateExercise, onArchiveExercise, onSaveRoutine, onDeleteRoutine, onBack, saveFailed, onExport, voice }: Props) {
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
  const selectRef = useRef<HTMLSelectElement>(null)
  const weightRef = useRef<HTMLInputElement>(null)
  const repsRef = useRef<HTMLInputElement>(null)
  const [newName, setNewName] = useState('')
  const [newGroup, setNewGroup] = useState<MuscleGroup>('chest')
  const [newKind, setNewKind] = useState<Exercise['kind']>('load')
  const [newErr, setNewErr] = useState('')
  const [routineName, setRoutineName] = useState('')
  const [routineErr, setRoutineErr] = useState('')
  const [loadedId, setLoadedId] = useState<string | null>(null) // estado de UI: no se persiste
  const routinesRef = useRef<HTMLHeadingElement>(null)
  const loadedRef = useRef<HTMLHeadingElement>(null)

  const sel = active.some(x => x.id === exerciseId) ? exerciseId : DEFAULT_EXERCISE
  const kind = kindOf(sel)
  const name = exerciseName(sel, gym.exercises)
  const last = lastSet(gym.log, sel)
  const recs = records(liveSets(gym.log).filter(s => s.exerciseId === sel))
  const sessionSets = daySets(gym.log, day)
  const progress = useMemo(() => weeklyBest1rm(gym.log, sel, today), [gym.log, sel, today])
  const volume = useMemo(() => groupVolume(gym.log, gym.exercises, today).filter(v => v.sets > 0 || v.prevSets > 0), [gym.log, gym.exercises, today])
  const maxSets = Math.max(1, ...volume.map(v => v.sets))
  const withData = progress.flatMap(w => (w.kg === null ? [] : [w.kg]))
  const pMin = Math.min(...withData), pMax = Math.max(...withData)
  const px = (i: number) => 6 + i * (88 / (progress.length - 1))
  const py = (kg: number) => (pMax === pMin ? 20 : 34 - ((kg - pMin) / (pMax - pMin)) * 28)
  const runs: string[] = [] // tramos de semanas consecutivas con dato; los huecos cortan la línea
  progress.forEach((w, i) => {
    if (w.kg === null) return
    const pt = `${px(i).toFixed(1)},${py(w.kg).toFixed(1)}`
    if (i > 0 && progress[i - 1].kg !== null) runs[runs.length - 1] += ` ${pt}`; else runs.push(pt)
  })
  const groups: { id: string; label: string; items: Exercise[] }[] = GROUPS.map(g => ({ ...g, items: active.filter(x => x.group === g.id) }))
  const dayWord = dayLabel(day, today).toLowerCase()
  const routines = gym.routines ?? []
  const loaded = routines.find(r => r.id === loadedId) // si se borra la rutina activa, el panel se cierra solo
  const loadedItems = loaded ? routineProgress(loaded, gym.log, day) : []
  const routineDay = day === today ? 'hoy' : dayWord === 'ayer' ? 'ayer' : `el ${dayWord}`
  const sessionNote = (auto: boolean) => (auto ? ` Sesión de Gym apuntada en HERO (${dayWord}).` : '')

  const changeExercise = (id: string) => { setExerciseId(id); setForm(prefill(id, unit)); setErrors({}) }
  const changeUnit = (u: WeightUnit) => { onSetUnit(u); setForm(prefill(sel, u)); setErrors({}) }
  const MISSING_TEXT: Record<VoiceMissing, string> = { exercise: 'No se ha entendido el ejercicio.', reps: 'Faltan las repeticiones.', weight: 'Falta el peso.', sets: 'Indica entre 1 y 10 series.' }
  // Rellena el formulario con el borrador de voz y enfoca el primer dato que falte (si no falta nada, el peso).
  function applyDraft(d: GymDraft, note: string) {
    const id = d.exerciseId !== null && active.some(x => x.id === d.exerciseId) ? d.exerciseId : null
    const target = id ?? sel
    if (id) setExerciseId(id)
    const base = prefill(target, unit)
    setForm({ w: d.weight !== null ? num(convert(d.weight, d.unit, unit)) : base.w, r: d.reps !== null ? String(d.reps) : '' })
    setErrors({}); setStatus(note)
    const el = id === null ? selectRef : d.weight === null ? weightRef : d.reps === null ? repsRef : weightRef
    setTimeout(() => el.current?.focus(), 0) // como loadRoutine: los campos ya existen, pero el estado aún no se ha pintado
  }
  const editNote = (d: GymDraft) => `Formulario rellenado con ${draftText(d, active, unit)}. Registra la serie${d.sets > 1 ? ' y usa «Repetir serie» para las demás' : ''}.`
  const incompleteNote = (missing: VoiceMissing[]) => `${missing.map(m => MISSING_TEXT[m]).join(' ')} Completa el formulario.`
  const step = (dir: 1 | -1) => setForm(f => ({ ...f, w: num(stepWeight(parseWeight(f.w) ?? 0, unit, dir)) }))

  const register = (input: Omit<GymSet, 'id' | 'occurredAt'>) => {
    const res = onAddSet(input, day)
    const s = { ...input, id: '', occurredAt: '' }
    const nm = exerciseName(input.exerciseId, gym.exercises), k = kindOf(input.exerciseId)
    setStatus(res.kinds.length
      ? `${recordText(res.kinds, s, nm, unit, k)}.${sessionNote(res.auto)}`
      : `Serie registrada: ${nm}, ${fmtSet(s, unit, k)}.${sessionNote(res.auto)}`)
  }
  const create = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValidName(newName)) return setNewErr('El nombre debe tener entre 2 y 40 caracteres.')
    const dup = exercises.find(x => normalizeText(x.name) === normalizeText(newName))
    if (dup) return setNewErr(dup.archived ? `Ya tienes «${dup.name}» archivado: reactívalo abajo.` : 'Ya existe un ejercicio con ese nombre.')
    const x: Exercise = { id: `custom-${crypto.randomUUID()}`, name: trackerName(newName), group: newGroup, kind: newKind }
    onCreateExercise(x)
    setNewName(''); setNewErr('')
    setExerciseId(x.id); setForm(prefill(x.id, unit)); setErrors({}) // queda seleccionado
  }
  const saveRoutine = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValidName(routineName)) return setRoutineErr('El nombre debe tener entre 2 y 40 caracteres.')
    if (routines.some(r => normalizeText(r.name) === normalizeText(routineName))) return setRoutineErr('Ya tienes una rutina con ese nombre.')
    if (routines.length >= MAX_ROUTINES) return setRoutineErr(`Has llegado al máximo de ${MAX_ROUTINES} rutinas: borra alguna para guardar otra.`)
    const r = routineFromDay(gym.log, day, trackerName(routineName), `routine-${crypto.randomUUID()}`)
    if (!r) return
    onSaveRoutine(r)
    setRoutineName(''); setRoutineErr(''); setStatus(`Rutina ${r.name} guardada.`)
  }
  const loadRoutine = (r: Routine) => {
    setLoadedId(r.id); setStatus(`Rutina ${r.name} cargada.`)
    setTimeout(() => loadedRef.current?.focus(), 0) // el panel aún no existe en este render
  }
  const deleteRoutine = (r: Routine) => {
    if (!window.confirm(`¿Borrar la rutina «${r.name}»? Tus series no cambian.`)) return
    onDeleteRoutine(r.id)
    setStatus(`Rutina ${r.name} borrada.`)
    routinesRef.current?.focus()
  }
  const archive = (id: string, archived: boolean) => {
    onArchiveExercise(id, archived)
    if (archived && id === sel) changeExercise(DEFAULT_EXERCISE)
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
          <select ref={selectRef} value={sel} onChange={e => changeExercise(e.target.value)} className={field}>
            {groups.filter(g => g.items.length > 0).map(g => (
              <optgroup key={g.id} label={g.label}>
                {g.items.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </optgroup>
            ))}
          </select>
        </label>

        {loaded && (
          <section aria-labelledby="gym-loaded" className={card}>
            <div className="flex items-center justify-between gap-3">
              <h2 id="gym-loaded" ref={loadedRef} tabIndex={-1} className="text-base font-semibold outline-hero focus-visible:outline-2">Rutina: {loaded.name}</h2>
              <button type="button" onClick={() => setLoadedId(null)} className={secondary}>Quitar</button>
            </div>
            <ul className="divide-y divide-hero-border rounded-lg border border-hero-border">
              {loadedItems.map(i => {
                const x = active.find(e => e.id === i.exerciseId)
                return (
                  <li key={i.exerciseId} className="flex items-center justify-between gap-2">
                    {x
                      ? <button type="button" onClick={() => changeExercise(x.id)} aria-current={x.id === sel ? 'true' : undefined}
                          className="min-h-11 flex-1 px-3 text-left text-sm font-semibold outline-hero hover:bg-hero-bg focus-visible:outline-2 focus-visible:-outline-offset-2">
                          {x.name} · {i.done}/{i.sets} series
                        </button>
                      : <span className="min-h-11 flex-1 px-3 py-3 text-sm text-hero-muted">{exerciseName(i.exerciseId, gym.exercises)} (no disponible)</span>}
                    {i.complete && <span className="mr-3 inline-flex items-center gap-1 text-sm font-semibold text-hero"><Check className="size-4" aria-hidden />hecho</span>}
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <section aria-labelledby="gym-voice" className={card}>
          <h2 id="gym-voice" className="text-base font-semibold">Por voz</h2>
          <VoiceLog tone="hero" day={day} today={today} exercises={active} unit={unit} ack={voice.ack} onAck={voice.onAck} onInterpret={voice.onInterpret}
            onSave={voice.onSave} onUndo={voice.onUndo} onEdit={d => applyDraft(d, editNote(d))} onIncomplete={(d, m) => applyDraft(d, incompleteNote(m))} />
        </section>

        <form onSubmit={submit} className={card} noValidate>
          <h2 className="text-base font-semibold">Registrar serie</h2>
          <div className="flex flex-col gap-1">
            <label htmlFor="gym-weight" className="text-xs font-medium">{kind === 'bodyweight' ? `Lastre (${unit})` : `Peso (${unit})`}</label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => step(-1)} aria-label={`Bajar ${stepLabel}`} className={`${secondary} min-w-11 px-0`}><Minus className="size-5" aria-hidden /></button>
              <input id="gym-weight" ref={weightRef} type="text" inputMode="decimal" autoComplete="off" value={form.w} onChange={e => setForm(f => ({ ...f, w: e.target.value }))}
                aria-invalid={!!errors.weight} aria-describedby={errors.weight ? 'gym-weight-err' : undefined} className={`${field} text-center tabular-nums`} />
              <button type="button" onClick={() => step(1)} aria-label={`Subir ${stepLabel}`} className={`${secondary} min-w-11 px-0`}><Plus className="size-5" aria-hidden /></button>
            </div>
            {errors.weight && <p id="gym-weight-err" className="flex items-center gap-2 text-sm text-hero-text"><CircleAlert className="size-4 shrink-0" aria-hidden />{errors.weight}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="gym-reps" className="text-xs font-medium">Repeticiones</label>
            <input id="gym-reps" ref={repsRef} type="text" inputMode="numeric" autoComplete="off" value={form.r} onChange={e => setForm(f => ({ ...f, r: e.target.value }))}
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

        <section aria-labelledby="gym-progress" className={card}>
          <h2 id="gym-progress" className="text-base font-semibold">Progreso · {name}</h2>
          {withData.length === 0 ? <p className="text-sm text-hero-muted">Aún no hay datos para el progreso: cuenta el 1RM estimado de series con peso y de hasta 12 repeticiones.</p> : (
            <>
              <svg viewBox="0 0 100 40" className="h-24 w-full text-hero" aria-hidden>
                {runs.filter(r => r.includes(' ')).map(r => <polyline key={r} points={r} fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" />)}
                {progress.map((w, i) => w.kg === null ? null
                  : <circle key={w.monday} cx={px(i)} cy={py(w.kg)} r="1.6" stroke="currentColor" strokeWidth="1" fill={w.current ? 'none' : 'currentColor'} />)}
              </svg>
              <p className="text-sm font-semibold tabular-nums">Mejor del periodo: ≈ {fmtWeight(fromKg(pMax, unit), unit)}</p>
              <p className="text-xs text-hero-muted">Mejor 1RM estimado por semana (Epley)</p>
              <ul className="sr-only">
                {progress.map(w => <li key={w.monday}>{`Semana del ${shortDate(w.monday)}${w.current ? ' (en curso)' : ''}: ${w.kg === null ? 'sin datos' : `≈ ${fmtWeight(fromKg(w.kg, unit), unit)}`}`}</li>)}
              </ul>
            </>
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

        <section aria-labelledby="gym-volume" className={card}>
          <h2 id="gym-volume" className="text-base font-semibold">Volumen semanal</h2>
          {volume.length === 0 ? <p className="text-sm text-hero-muted">Aún no hay series esta semana.</p> : (
            <ul className="flex flex-col gap-3">
              {volume.map(v => (
                <li key={v.group} className="flex flex-col gap-1">
                  <span className="text-sm font-semibold tabular-nums">{`${v.label} · ${v.sets} ${v.sets === 1 ? 'serie' : 'series'} · ${int(v.kg, unit)}`}</span>
                  <span className="h-2 w-full overflow-hidden rounded-full bg-hero-border" aria-hidden><span className="block h-full rounded-full bg-hero" style={{ width: `${(v.sets / maxSets) * 100}%` }} /></span>
                  <span className="text-xs text-hero-muted tabular-nums">{`semana anterior hasta hoy: ${v.prevSets} ${v.prevSets === 1 ? 'serie' : 'series'} · ${int(v.prevKg, unit)}`}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-hero-muted">El volumen es peso × repeticiones; el peso corporal sin lastre cuenta solo como serie.</p>
        </section>

        <section aria-labelledby="gym-routines" className={card}>
          <h2 id="gym-routines" ref={routinesRef} tabIndex={-1} className="text-base font-semibold outline-hero focus-visible:outline-2">Rutinas</h2>
          <form onSubmit={saveRoutine} className="flex flex-col gap-3" noValidate>
            <h3 className="text-sm font-semibold">Guardar la sesión de {routineDay} como rutina</h3>
            <label className="flex flex-col gap-1 text-xs font-medium">Nombre de la rutina
              <input value={routineName} onChange={e => setRoutineName(e.target.value)} maxLength={40} autoComplete="off" aria-invalid={!!routineErr}
                aria-describedby={routineErr ? 'gym-routine-err' : undefined} className={field} />
            </label>
            {routineErr && <p id="gym-routine-err" className="flex items-center gap-2 text-sm text-hero-text"><CircleAlert className="size-4 shrink-0" aria-hidden />{routineErr}</p>}
            <button type="submit" disabled={sessionSets.length === 0} aria-describedby={sessionSets.length === 0 ? 'gym-routine-help' : undefined} className={primary}>Guardar rutina</button>
            {sessionSets.length === 0 && <p id="gym-routine-help" className="text-xs text-hero-muted">Registra alguna serie en este día para guardarla como rutina.</p>}
          </form>
          {routines.length === 0 ? <p className="text-sm text-hero-muted">Aún no tienes rutinas.</p> : (
            <ul className="divide-y divide-hero-border rounded-lg border border-hero-border">
              {routines.map(r => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-1 pl-3">
                  <span className="text-sm"><span className="font-semibold">{r.name}</span> · {r.items.length} {r.items.length === 1 ? 'ejercicio' : 'ejercicios'}</span>
                  <span className="flex gap-1 pr-1">
                    <button type="button" onClick={() => loadRoutine(r)} aria-label={`Cargar rutina ${r.name}`} className={`${secondary} px-3`}>Cargar</button>
                    <button type="button" onClick={() => deleteRoutine(r)} aria-label={`Borrar rutina ${r.name}`} className={`${secondary} px-3`}>Borrar</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="gym-custom" className={card}>
          <h2 id="gym-custom" className="text-base font-semibold">Ejercicios propios</h2>
          <details className="flex flex-col gap-3">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold outline-hero focus-visible:outline-2 focus-visible:outline-offset-2">Añadir ejercicio</summary>
            <form onSubmit={create} className="flex flex-col gap-3" noValidate>
              <label className="flex flex-col gap-1 text-xs font-medium">Nombre
                <input value={newName} onChange={e => setNewName(e.target.value)} maxLength={40} autoComplete="off" aria-invalid={!!newErr} aria-describedby={newErr ? 'gym-new-err' : undefined} className={field} />
              </label>
              {newErr && <p id="gym-new-err" className="flex items-center gap-2 text-sm text-hero-text"><CircleAlert className="size-4 shrink-0" aria-hidden />{newErr}</p>}
              <label className="flex flex-col gap-1 text-xs font-medium">Grupo
                <select value={newGroup} onChange={e => setNewGroup(e.target.value as MuscleGroup)} className={field}>
                  {GROUPS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                </select>
              </label>
              <Segmented<Exercise['kind']> label="Tipo" value={newKind} onChange={setNewKind} toneFor={() => 'hero'}
                options={[{ value: 'load', label: 'Con carga' }, { value: 'bodyweight', label: 'Peso corporal' }]} />
              <button type="submit" className={primary}>Crear ejercicio</button>
            </form>
          </details>
          {gym.exercises.length > 0 && (
            <ul className="divide-y divide-hero-border rounded-lg border border-hero-border">
              {gym.exercises.map(x => (
                <li key={x.id} className="flex items-center justify-between gap-2 pl-3">
                  <span className="text-sm">{x.name}{x.archived && <span className="text-hero-muted"> · archivado</span>}</span>
                  <button type="button" onClick={() => archive(x.id, !x.archived)} aria-label={`${x.archived ? 'Reactivar' : 'Archivar'} ${x.name}`}
                    className="m-1 inline-flex min-h-11 items-center justify-center rounded-lg border border-hero-border px-3 text-sm font-semibold text-hero-text outline-hero hover:bg-hero-bg focus-visible:outline-2 focus-visible:outline-offset-2">
                    {x.archived ? 'Reactivar' : 'Archivar'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
