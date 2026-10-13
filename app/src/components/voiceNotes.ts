import type { Exercise, WeightUnit } from '../core/types'
import { MAX_VOICE_SETS, draftText, type GymDraft } from '../core/voice'
export type VoiceMissing = 'exercise' | 'weight' | 'reps' | 'sets'

const MISSING_TEXT: Record<VoiceMissing, string> = { exercise: 'No se ha entendido el ejercicio.', reps: 'Faltan las repeticiones.', weight: 'Falta el peso.', sets: 'Indica entre 1 y 10 series.' }

// Avisos del formulario de Gym prerrellenado por voz (Editar / comando incompleto). `active` = ejercicios activos.
export const editNote = (d: GymDraft, active: Exercise[], unit: WeightUnit) =>
  `Formulario rellenado con ${draftText(d, active, unit)}. Registra la serie${d.sets > 1 ? ' y usa «Repetir serie» para las demás' : ''}.`
export const incompleteNote = (missing: VoiceMissing[]) => `${missing.map(m => MISSING_TEXT[m]).join(' ')} Completa el formulario.`

export function missingOf(d: GymDraft, exercises: Exercise[]): VoiceMissing[] {
  const e = exercises.find(x => x.id === d.exerciseId)
  const out: VoiceMissing[] = []
  if (!e) out.push('exercise')
  if (d.weight === null || (e?.kind === 'load' && d.weight <= 0)) out.push('weight')
  if (d.reps === null) out.push('reps')
  if (!Number.isInteger(d.sets) || d.sets < 1 || d.sets > MAX_VOICE_SETS) out.push('sets')
  return out
}
