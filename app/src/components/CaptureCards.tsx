import { useEffect, useRef, useState } from 'react'
import type { Tracker } from '../core/types'
import { MAX_CAPTURE } from '../core/capture'
import { CARD } from './branchTone'

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
