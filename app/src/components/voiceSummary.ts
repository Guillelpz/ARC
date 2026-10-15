import type { SpeechLog, SpeechOutcome } from '../speech'

export type VoiceSummaryInput = {
  ua: string; standalone: boolean; iosStandalone: boolean | null /* navigator.standalone; null si no existe */
  recognition: 'SpeechRecognition' | 'webkitSpeechRecognition' | null
  lang: string; online: boolean; keyboardOnIos: string
  outcome: SpeechOutcome; ms: number; log: SpeechLog; at: string /* sello local YYYY-MM-DDTHH:mm:ss */
}

// Resumen de «Probar voz» para pegar en el chat. Puro y sin acceso a la clave de Anthropic: no la recibe.
export function voiceSummary(i: VoiceSummaryInput): string {
  const o = i.outcome
  const result = o.ok ? `«${o.text}» en ${(i.ms / 1000).toFixed(1).replace('.', ',')} s` : `Error: ${o.error}${o.detail ? ` (${o.detail})` : ''}`
  const events = i.log.length ? i.log.map(e => `${e.t} ms ${e.ev}${e.detail ? ` ${e.detail}` : ''}`).join(' · ') : 'Sin eventos'
  return [
    `Probar voz · RPG Life Tracker · ${i.at}`,
    `Agente: ${i.ua}`,
    `Modo: ${i.standalone ? 'app instalada' : 'navegador'} · navigator.standalone: ${i.iosStandalone === null ? 'no existe' : i.iosStandalone ? 'sí' : 'no'}`,
    `Reconocimiento: ${i.recognition ?? 'no disponible'}`,
    `Idioma: ${i.lang} · Conexión: ${i.online ? 'sí' : 'no'} · KEYBOARD_ON_IOS: ${i.keyboardOnIos}`,
    `Resultado: ${result}`,
    `Eventos: ${events}`,
  ].join('\n')
}
