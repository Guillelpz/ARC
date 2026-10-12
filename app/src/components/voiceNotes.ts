import type { Exercise, WeightUnit } from '../core/types'
import { draftText, type GymDraft } from '../core/voice'
import type { VoiceMissing } from './VoiceLog'

const MISSING_TEXT: Record<VoiceMissing, string> = { exercise: 'No se ha entendido el ejercicio.', reps: 'Faltan las repeticiones.', weight: 'Falta el peso.', sets: 'Indica entre 1 y 10 series.' }

// Avisos del formulario de Gym prerrellenado por voz (Editar / comando incompleto). `active` = ejercicios activos.
export const editNote = (d: GymDraft, active: Exercise[], unit: WeightUnit) =>
  `Formulario rellenado con ${draftText(d, active, unit)}. Registra la serie${d.sets > 1 ? ' y usa «Repetir serie» para las demás' : ''}.`
export const incompleteNote = (missing: VoiceMissing[]) => `${missing.map(m => MISSING_TEXT[m]).join(' ')} Completa el formulario.`
