import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CircleAlert } from 'lucide-react'
import type { Branch, Tracker } from '../core/types'
import { AUTO_CREATE_S, MAX_CAPTURE, type NewHabit } from '../core/capture'
import { isValidName, isValidUnit, normalizeText, trackerName } from '../core/classify'
import { Segmented } from './Segmented'
import { BRANCH_BTN, CARD, LABEL } from './branchTone'

const validAmount = (v: string) => { const n = Number(v); return v.trim() !== '' && Number.isInteger(n) && n >= 1 && n <= MAX_CAPTURE }

// Hábito existente: acciones de lo guardado («Deshacer», «Editar», «Cerrar») o formulario de cantidad. Va dentro del panel
// de la rama (el panel y el texto de estado los pone CaptureView). Paleta entera de la rama del hábito.
export function TrackerResult({ tracker, heard, note, form, amount, onUndo, onEdit, onClose, onSubmit, onCancel }: {
  tracker: Tracker
  heard: string
  note: string | null // conversión («50 páginas ≈ 100 min»)
  form: boolean // true = pedir la cantidad
  amount: number | null
  onUndo: () => void
  onEdit: () => void
  onClose: () => void
  onSubmit: (amount: number) => void
  onCancel: () => void
}) {
  const c = CARD[tracker.branch]
  const [value, setValue] = useState(amount === null ? '' : String(amount))
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { if (form) input.current?.focus() }, [form])
  if (form) {
    const ok = validAmount(value), id = `captura-cantidad-${tracker.id}`
    return (
      <form onSubmit={e => { e.preventDefault(); if (ok) onSubmit(Number(value)) }} className="flex flex-col gap-2">
        <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider">Cantidad ({tracker.unit})</label>
        <input id={id} ref={input} type="number" min={1} max={MAX_CAPTURE} step={1} value={value} onChange={e => setValue(e.target.value)}
          aria-invalid={value !== '' && !ok} className={`min-h-11 w-32 rounded-lg border px-3 text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 ${c.input}`} />
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={!ok} className={`${c.secondary} font-semibold`}>Apuntar</button>
          <button type="button" onClick={onCancel} className={c.link}>Cancelar</button>
        </div>
      </form>
    )
  }
  return (
    <>
      {note && <p className={`text-sm ${c.muted}`}>{note}</p>}
      <p className={`text-sm ${c.muted}`}>Oído: «{heard}»</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onUndo} className={c.secondary}>Deshacer</button>
        <button type="button" onClick={onEdit} className={c.secondary}>Editar</button>
        <button type="button" onClick={onClose} className={c.link}>Cerrar</button>
      </div>
    </>
  )
}

// Hábito creado: acciones (el texto «Creada: …» lo pone CaptureView en su región de estado).
export function CreatedResult({ branch, onUndo, onGo, onClose }: { branch: Branch; onUndo: () => void; onGo: () => void; onClose: () => void }) {
  const c = CARD[branch]
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={onUndo} className={c.secondary}>Deshacer</button>
      <button type="button" onClick={onGo} className={c.secondary}>Ir a {LABEL[branch]}</button>
      <button type="button" onClick={onClose} className={c.link}>Cerrar</button>
    </div>
  )
}

const TYPES: { value: Tracker['type']; label: string }[] = [
  { value: 'count', label: 'Veces' },
  { value: 'distance', label: 'Km' },
  { value: 'duration', label: 'Min' },
  { value: 'custom', label: 'Otro' },
]
const AMOUNT_UNIT = { count: 'veces', distance: 'km', duration: 'min' } as const

// Propuesta de hábito nuevo, editable. Con `auto` (IA con confianza alta y datos completos) se crea sola tras AUTO_CREATE_S segundos,
// salvo que el usuario toque la tarjeta (pointerdown, teclado, cambio), pare la cuenta atrás, oculte la pestaña o salga de la pantalla.
export function NewHabitCard({ habit, heard, trackers, auto, stopped, onStop, onCreate, onDiscard }: {
  habit: NewHabit
  heard: string
  trackers: Tracker[] // todos, con archivadas
  auto: boolean
  stopped: boolean // la cuenta atrás ya se paró (lo guarda CaptureView para el aviso)
  onStop: () => void
  onCreate: (h: NewHabit) => void
  onDiscard: () => void
}) {
  const [name, setName] = useState(habit.name)
  const [branch, setBranch] = useState<Branch>(habit.branch)
  const [type, setType] = useState<Tracker['type']>(habit.type)
  const [unit, setUnit] = useState(habit.unit ?? '')
  const [amount, setAmount] = useState(habit.amount === null ? '' : String(habit.amount))
  const [secs, setSecs] = useState(AUTO_CREATE_S)
  const h2 = useRef<HTMLHeadingElement>(null)
  const c = CARD[branch]
  const live = auto && AUTO_CREATE_S > 0 && !stopped
  const dup = trackers.find(t => normalizeText(t.name) === normalizeText(name))
  const n = Number(amount)
  const amountOk = validAmount(amount)
  const unitOk = type !== 'custom' || isValidUnit(unit)
  const nameOk = isValidName(name) && !dup
  const ok = nameOk && unitOk && amountOk
  const draft: NewHabit = { name: trackerName(name), branch, type, ...(type === 'custom' && { unit: unit.trim() }), amount: amountOk ? n : null, confidence: habit.confidence, reason: habit.reason }
  const create = () => { if (ok) onCreate(draft) }
  const createRef = useRef(create)
  useLayoutEffect(() => { createRef.current = create })
  useEffect(() => { h2.current?.focus() }, []) // el foco programático no cancela la cuenta atrás
  useEffect(() => {
    if (!live) return
    const id = setTimeout(() => { if (secs <= 1) createRef.current(); else setSecs(secs - 1) }, 1000)
    return () => clearTimeout(id)
  }, [live, secs])
  useEffect(() => {
    if (!live) return
    const hidden = () => { if (document.visibilityState === 'hidden') onStop() }
    document.addEventListener('visibilitychange', hidden)
    return () => document.removeEventListener('visibilitychange', hidden)
  }, [live, onStop])
  const touch = () => { if (live) onStop() }
  const low = habit.confidence === 'baja'
  const unitLabel = type === 'custom' ? unit.trim() || 'unidades' : AMOUNT_UNIT[type]

  return (
    <section aria-labelledby="captura-propuesta" onPointerDown={touch} onKeyDown={touch} onChange={touch} onClickCapture={touch}
      className={`rise flex flex-col gap-3 rounded-xl border p-4 shadow-sm transition duration-150 sm:p-5 ${c.box} ${low ? 'border-dashed' : ''}`}>
      <h2 id="captura-propuesta" ref={h2} tabIndex={-1} className="text-lg font-semibold outline-none">Propuesta: {LABEL[branch]}</h2>
      <span className={`inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-xs font-medium ${c.border} ${c.muted}`}>Confianza {habit.confidence}</span>
      <p className={`text-xs leading-5 ${c.muted}`}>{habit.reason}</p>
      <p className={`text-sm ${c.muted}`}>Oído: «{heard}»</p>
      {dup && (
        <p className="inline-flex items-center gap-1 text-sm">
          <CircleAlert className="size-4 shrink-0" aria-hidden />{dup.archived ? `Ya tienes «${dup.name}» archivada. Reactívala desde Inicio.` : `Ya tienes «${dup.name}».`}
        </p>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wider">Nombre</span>
        <input value={name} onChange={e => setName(e.target.value)} maxLength={40} autoComplete="off" aria-invalid={!nameOk}
          className={`min-h-11 rounded-lg border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 ${c.input}`} />
      </label>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wider">Rama</span>
        <Segmented<Branch> label="Rama" options={[{ value: 'hero', label: 'HERO' }, { value: 'villain', label: 'VILLAIN' }]} value={branch}
          onChange={b => { touch(); setBranch(b) }} toneFor={v => v} />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wider">Tipo</span>
        <Segmented<Tracker['type']> label="Tipo" options={TYPES} value={type} onChange={v => { touch(); setType(v) }} />
      </div>
      {type === 'custom' && (
        <label className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider">Unidad</span>
          <input value={unit} onChange={e => setUnit(e.target.value)} maxLength={20} autoComplete="off" placeholder="páginas" aria-invalid={!unitOk}
            className={`min-h-11 w-40 rounded-lg border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 ${c.input}`} />
        </label>
      )}
      <label className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider">Cantidad ({unitLabel})</span>
        <input type="number" min={1} max={MAX_CAPTURE} step={1} value={amount} onChange={e => setAmount(e.target.value)} aria-invalid={!amountOk}
          className={`min-h-11 w-28 rounded-lg border px-3 text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 ${c.input}`} />
      </label>
      {live && (
        <p className={`text-sm ${c.muted}`}>Se crea sola en <span aria-hidden className="tabular-nums">{secs}</span> s</p>
      )}
      <div className="flex flex-wrap gap-2">
        {live && <button type="button" onClick={onStop} className={c.secondary}>Parar cuenta atrás</button>}
        <button type="button" onClick={create} disabled={!ok} className={BRANCH_BTN[branch]}>Crear y apuntar</button>
        <button type="button" onClick={onDiscard} className={c.link}>Descartar</button>
      </div>
    </section>
  )
}
