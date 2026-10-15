import { Check, CircleAlert } from 'lucide-react'
import type { Branch, Food } from '../core/types'
import { itemText, pendingText, type FoodItem } from '../core/foodVoice'
import { CARD } from './branchTone'

// Resultado de una frase de comida (captura y FV4): lo apuntado, lo pendiente y las acciones. El panel y el texto de estado los pone quien la usa.
// `tone` = paleta de la tarjeta que la contiene (HERO en la captura; la de la rama dentro de un hábito).
export function FoodVoiceCard({ tone, heard, saved, pending, rest, own, undoLabel = 'Deshacer', onUndo, onComplete, onEdit, onClose }: {
  tone: Branch
  heard: string
  saved: FoodItem[]
  pending: FoodItem[]
  rest: string
  own: Food[]
  undoLabel?: string
  onUndo?: () => void // solo con algo apuntado
  onComplete?: () => void // «Completar en Comida»
  onEdit?: () => void
  onClose: () => void
}) {
  const c = CARD[tone]
  return (
    <>
      <p className={`text-sm ${c.muted}`}>Oído: «{heard}»</p>
      {(saved.length > 0 || pending.length > 0) && (
        <ul className="flex flex-col gap-1 text-sm">
          {saved.map((i, k) => <li key={`s${k}`} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden />{itemText(i, own)}</li>)}
          {pending.map((i, k) => <li key={`p${k}`} className="flex items-start gap-2"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />{pendingText(i, own)}</li>)}
        </ul>
      )}
      {rest !== '' && <p className={`text-sm ${c.muted}`}>Sin reconocer: {rest}</p>}
      <div className="flex flex-wrap gap-2">
        {pending.length > 0 && onComplete && <button type="button" onClick={onComplete} className={c.secondary}>Completar en Comida</button>}
        {onUndo && <button type="button" onClick={onUndo} className={c.secondary}>{undoLabel}</button>}
        {onEdit && <button type="button" onClick={onEdit} className={c.secondary}>Editar</button>}
        <button type="button" onClick={onClose} className={c.link}>Cerrar</button>
      </div>
    </>
  )
}
