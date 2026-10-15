import type { DietChange, Food } from '../core/types'
import { dietNote, fmtKcal } from '../core/food'
import { itemKcal, type FoodItem } from '../core/foodVoice'

// Textos de estado de una frase de comida (captura y Comida)
export const foodCount = (n: number) => `${n} ${n === 1 ? 'alimento' : 'alimentos'}`
export const kcalOf = (items: FoodItem[], own: Food[]) => fmtKcal(items.reduce((n, i) => n + itemKcal(i, own), 0))
export const foodStatus = (d: { ids: string[]; saved: FoodItem[]; diet: DietChange; undone: string | null }, own: Food[]) => d.undone ?? (d.ids.length
  ? `Registrado en Comida: ${foodCount(d.ids.length)} · ${kcalOf(d.saved, own)} kcal${dietNote(d.diet)}`
  : 'Revisa la propuesta: no se ha apuntado nada.')
