import type { DietChange, Food } from '../core/types'
import { dietNote, fmtKcal } from '../core/food'
import { itemKcal, voiceAdds, type FoodItem, type VoiceAdd } from '../core/foodVoice'

// Comida apuntada por una frase: lo guardado, lo pendiente, los propios creados (para archivarlos al deshacer) y el efecto en Dieta
export type FoodDone = { ids: string[]; created: string[]; saved: FoodItem[]; pending: FoodItem[]; diet: DietChange; undone: string | null }

// «Apuntar» en una fila a confirmar (estimación o ración propuesta): un guardado más que suma sus ids al mismo «Deshacer».
export function confirmDone<T extends FoodDone>(d: T, item: FoodItem, own: boolean, foods: Food[], save: (adds: VoiceAdd[]) => { ids: string[]; created: string[]; diet: DietChange }): T {
  const adds = voiceAdds([item], foods, [own])
  if (!adds.length) return d
  const s = save(adds)
  return { ...d, ids: [...d.ids, ...s.ids], created: [...d.created, ...s.created], saved: [...d.saved, item], pending: d.pending.filter(x => x !== item), diet: Math.sign(d.diet + s.diet) as DietChange }
}

// Textos de estado de una frase de comida (captura y Comida)
export const foodCount = (n: number) => `${n} ${n === 1 ? 'alimento' : 'alimentos'}`
export const kcalOf = (items: FoodItem[], own: Food[]) => fmtKcal(items.reduce((n, i) => n + itemKcal(i, own), 0))
export const foodStatus = (d: { ids: string[]; saved: FoodItem[]; diet: DietChange; undone: string | null }, own: Food[]) => d.undone ?? (d.ids.length
  ? `Registrado en Comida: ${foodCount(d.ids.length)} · ${kcalOf(d.saved, own)} kcal${dietNote(d.diet)}`
  : 'Revisa la propuesta: no se ha apuntado nada.')
