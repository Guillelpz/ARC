import { useRef } from 'react'
import { CircleAlert } from 'lucide-react'
import type { Food } from '../core/types'
import { pendingText, type FoodItem } from '../core/foodVoice'
import { card, secondary } from './foodStyle'

// «Por voz: pendiente»: lo que la voz entendió a medias y falta completar (una fila por ítem). «Revisar» abre el panel de Apuntar comida.
export function FoodPending({ heard, items, own, onReview, onRemove }: {
  heard: string
  items: FoodItem[]
  own: Food[]
  onReview: (i: FoodItem) => void
  onRemove: (i: FoodItem) => void
}) {
  const h2 = useRef<HTMLHeadingElement>(null)
  const remove = (i: FoodItem) => {
    onRemove(i)
    if (items.length > 1) h2.current?.focus(); else document.getElementById('food-search')?.focus() // la fila pulsada desaparece
  }
  return (
    <section aria-labelledby="food-pending" className={card}>
      <h2 id="food-pending" ref={h2} tabIndex={-1} className="text-base font-semibold outline-hero focus-visible:outline-2">Por voz: pendiente</h2>
      <p className="text-sm text-hero-muted">Oído: «{heard}»</p>
      <ul className="divide-y divide-hero-border rounded-lg border border-hero-border">
        {items.map((i, k) => {
          const text = pendingText(i, own)
          return (
            <li key={k} className="flex flex-wrap items-center justify-between gap-2 py-1 pl-3">
              <span className="flex min-w-0 flex-1 items-start gap-2 py-2 text-sm"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />{text}</span>
              <span className="flex gap-1 pr-1">
                <button type="button" onClick={() => onReview(i)} aria-label={`Revisar ${text}`} className={secondary}>Revisar</button>
                <button type="button" onClick={() => remove(i)} aria-label={`Quitar ${text}`} className={secondary}>Quitar</button>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
