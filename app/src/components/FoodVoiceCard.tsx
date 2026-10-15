import { useState } from 'react'
import { Check, CircleAlert } from 'lucide-react'
import type { Branch, Food } from '../core/types'
import { isConfirmable, itemText, pendingText, type FoodItem } from '../core/foodVoice'
import { CARD } from './branchTone'

// Resultado de una frase de comida (captura y FV4): lo apuntado, lo pendiente y las acciones. El panel y el texto de estado los pone quien la usa.
// `tone` = paleta de la tarjeta que la contiene (HERO en la captura; la de la rama dentro de un hábito).
// Las filas a confirmar (estimación de Haiku o ración propuesta) llevan su propio «Apuntar»: nunca se guardan solas (FV3, FV6).
export function FoodVoiceCard({ tone, heard, saved, pending, rest, own, undoLabel = 'Deshacer', onUndo, onConfirm, onComplete, onEdit, onClose }: {
  tone: Branch
  heard: string
  saved: FoodItem[]
  pending: FoodItem[]
  rest: string
  own: Food[]
  undoLabel?: string
  onUndo?: () => void // solo con algo apuntado
  onConfirm?: (item: FoodItem, asOwn: boolean) => void // «Apuntar» de una fila a confirmar; asOwn = «Guardar también como alimento propio»
  onComplete?: () => void // «Completar en Comida»
  onEdit?: () => void
  onClose: () => void
}) {
  const c = CARD[tone]
  const [asOwn, setAsOwn] = useState<FoodItem[]>([]) // estimaciones con la casilla marcada
  const confirm = pending.filter(i => onConfirm && isConfirmable(i)), others = pending.filter(i => !confirm.includes(i))
  return (
    <>
      <p className={`text-sm ${c.muted}`}>Oído: «{heard}»</p>
      {(saved.length > 0 || pending.length > 0) && (
        <ul className="flex flex-col gap-2 text-sm">
          {saved.map((i, k) => <li key={`s${k}`} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden />{itemText(i, own)}</li>)}
          {confirm.map((i, k) => {
            const text = itemText(i, own), est = i.k === 'estimate', on = asOwn.includes(i)
            return (
              <li key={`c${k}`} className="flex flex-col items-start gap-1">
                <span className={`inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-xs font-medium ${c.border} ${c.muted}`}>{est ? 'Estimación' : 'Ración propuesta'}</span>
                <span>{text}</span>
                {est && (
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input type="checkbox" checked={on} onChange={e => setAsOwn(a => (e.target.checked ? [...a, i] : a.filter(x => x !== i)))} className={`size-4 ${tone === 'hero' ? 'accent-hero' : 'accent-villain'}`} />
                    Guardar también como alimento propio
                  </label>
                )}
                <button type="button" onClick={() => onConfirm?.(i, on)} aria-label={`Apuntar ${text}`} className={c.secondary}>Apuntar</button>
              </li>
            )
          })}
          {others.map((i, k) => <li key={`p${k}`} className="flex items-start gap-2"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />{pendingText(i, own)}</li>)}
        </ul>
      )}
      {rest !== '' && <p className={`text-sm ${c.muted}`}>Sin reconocer: {rest}</p>}
      <div className="flex flex-wrap gap-2">
        {others.length > 0 && onComplete && <button type="button" onClick={onComplete} className={c.secondary}>Completar en Comida</button>}
        {onUndo && <button type="button" onClick={onUndo} className={c.secondary}>{undoLabel}</button>}
        {onEdit && <button type="button" onClick={onEdit} className={c.secondary}>Editar</button>}
        <button type="button" onClick={onClose} className={c.link}>Cerrar</button>
      </div>
    </>
  )
}
