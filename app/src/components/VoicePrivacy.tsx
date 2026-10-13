import { useEffect, useRef } from 'react'
import { VT, type VoiceTone } from './voiceTone'

export const PRIVACY_TEXT = 'Para entender lo que dices, tu navegador envía el audio a Google (Chrome) o a Apple (Safari). Si guardas una clave de Anthropic en Ajustes, el texto reconocido se envía a Anthropic para interpretarlo, junto con los nombres de tus hábitos y ejercicios. No se envía nada más.'

// Aviso de privacidad de la voz: panel en línea (no modal). El foco va al encabezado al abrirse.
export function VoicePrivacy({ tone, onAccept, onSecondary, secondaryLabel = 'Escribir' }: { tone: VoiceTone; onAccept: () => void; onSecondary: () => void; secondaryLabel?: string }) {
  const t = VT[tone], h = useRef<HTMLHeadingElement>(null)
  useEffect(() => { h.current?.focus() }, [])
  return (
    <section aria-labelledby="voz-privacidad" className={`flex flex-col gap-3 rounded-lg border p-3 ${t.border} ${t.surface} ${t.text}`}>
      <h3 id="voz-privacidad" ref={h} tabIndex={-1} className="text-sm font-semibold outline-none">Privacidad de la voz</h3>
      <p className={`text-sm leading-6 ${t.muted}`}>{PRIVACY_TEXT}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onAccept} className={t.primary}>Entendido</button>
        <button type="button" onClick={onSecondary} className={t.secondary}>{secondaryLabel}</button>
      </div>
    </section>
  )
}
