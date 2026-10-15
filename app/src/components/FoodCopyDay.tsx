import { useEffect, useRef, useState } from 'react'
import { Copy } from 'lucide-react'
import type { DietChange, FoodData } from '../core/types'
import { dayEntries, dayTotals, dietNote, fmtKcal, hasCopy } from '../core/food'
import { addDays, dayLabel } from '../core/stats'
import { secondary } from './foodStyle'

type Props = {
  food: FoodData
  day: string
  today: string
  onCopy: (day: string) => { ids: string[]; diet: DietChange }
  onUndo: (ids: string[]) => { undone: number; diet: DietChange }
}

const small = 'inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-hero-border px-3 text-sm font-semibold text-hero-text outline-hero hover:bg-hero-bg focus-visible:outline-2 focus-visible:outline-offset-2'
const foods = (n: number) => `${n} ${n === 1 ? 'alimento' : 'alimentos'}`

// «Copiar día anterior»: copia las entradas vivas del día anterior al del selector. Un único «Deshacer» las retira. Se monta con key={day}.
export function FoodCopyDay({ food, day, today, onCopy, onUndo }: Props) {
  const [notice, setNotice] = useState<{ text: string; ids: string[]; undone?: boolean }>({ text: '', ids: [] })
  const btnRef = useRef<HTMLButtonElement>(null)
  const prev = addDays(day, -1)
  const n = dayEntries(food.log, prev).length, k = Math.round(dayTotals(food.log, prev).kcal)
  const copied = hasCopy(food.log, day)
  const hint = copied ? 'Ya has copiado el día anterior aquí. Deshaz las copias para volver a copiar.'
    : n === 0 ? 'Nada apuntado el día anterior.'
    : `Añade lo de ${dayLabel(prev, today).toLowerCase()}: ${foods(n)} · ${fmtKcal(k)} kcal`

  const copy = () => {
    const r = onCopy(day)
    if (!r.ids.length) return
    setNotice({ text: `Copiado: ${foods(r.ids.length)} · ${fmtKcal(k)} kcal${dietNote(r.diet)}`, ids: r.ids })
  }
  const undo = () => { const r = onUndo(notice.ids); setNotice({ text: `Deshecho: ${r.undone} ${r.undone === 1 ? 'entrada copiada' : 'entradas copiadas'}${dietNote(r.diet)}`, ids: [], undone: true }) }
  // el foco vuelve al botón cuando ya está activo (tras el render que lo reactiva)
  useEffect(() => { if (notice.undone && !copied) btnRef.current?.focus() }, [notice.undone, copied])

  return (
    <div className="flex flex-col gap-2">
      <button ref={btnRef} type="button" onClick={copy} disabled={copied || n === 0} aria-describedby="food-copy-hint" className={`${secondary} self-start`}>
        <Copy className="size-4" aria-hidden />Copiar día anterior
      </button>
      <p id="food-copy-hint" className="text-sm text-hero-muted">{hint}</p>
      <p role="status" className="flex flex-wrap items-center gap-2 text-sm text-hero-muted empty:hidden">
        {notice.text}
        {notice.ids.length > 0 && <button type="button" onClick={undo} className={small}>Deshacer</button>}
      </p>
    </div>
  )
}
