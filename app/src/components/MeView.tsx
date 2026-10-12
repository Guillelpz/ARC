import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Dumbbell } from 'lucide-react'
import { VoiceCheck } from './VoiceCheck'
import { AiKeySettings, type KeySave } from './AiKeySettings'
import type { HaikuError } from '../core/haiku'
import { loadVoicePrefs, saveVoicePrefs, type VoiceLang } from '../core/storage'
import { Segmented } from './Segmented'

export type AiKeyProps = { hint: string | null; invalid: boolean; onSave: (key: string) => KeySave; onClear: () => void; onTest: () => Promise<HaikuError | 'ok'> }

export function MeView({ onOpenGym, focusGym, voiceAck, onVoiceAck, aiKey }: { onOpenGym: () => void; focusGym: boolean; voiceAck: boolean; onVoiceAck: () => void; aiKey: AiKeyProps }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [lang, setLang] = useState<VoiceLang>(() => loadVoicePrefs().lang ?? 'es-ES')
  const pickLang = (l: VoiceLang) => { saveVoicePrefs({ ...loadVoicePrefs(), lang: l }); setLang(l) }
  useEffect(() => { if (focusGym) ref.current?.focus() }, [focusGym])
  return (
    <div className="min-h-dvh bg-app-bg text-app-text">
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-6 pb-28 sm:max-w-2xl lg:max-w-4xl">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Yo</h1>
          <p className="text-sm text-app-muted">Tus módulos personales.</p>
        </header>
        <button ref={ref} type="button" onClick={onOpenGym}
          className="group flex min-h-11 items-center gap-3 rounded-xl border border-hero-border bg-hero-surface p-4 text-left text-hero-text shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 outline-hero">
          <Dumbbell className="size-5 shrink-0 text-hero" aria-hidden />
          <span className="flex flex-1 flex-col">
            <span className="text-base font-semibold">Gym</span>
            <span className="text-sm text-hero-muted">Series, pesos y récords</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-hero-muted transition duration-150 group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden />
        </button>
        <section aria-labelledby="ajustes" className="flex flex-col gap-3">
          <h2 id="ajustes" className="text-lg font-semibold">Ajustes</h2>
          <div className="flex flex-col gap-3 rounded-xl border border-app-border bg-app-surface p-4 shadow-sm sm:p-5">
            <h3 className="text-sm font-semibold">Voz</h3>
            <Segmented label="Idioma del dictado" value={lang} onChange={pickLang}
              options={[{ value: 'es-ES', label: 'Español' }, { value: 'en-US', label: 'English' }]} />
            <p className="text-sm leading-6 text-app-muted">El dictado escucha en este idioma, aunque el móvil esté en otro. Comprueba si este dispositivo puede transcribir lo que dices. No guarda nada.</p>
            <VoiceCheck ack={voiceAck} onAck={onVoiceAck} />
          </div>
          <div className="flex flex-col gap-3 rounded-xl border border-app-border bg-app-surface p-4 shadow-sm sm:p-5">
            <h3 className="text-sm font-semibold">Clave de Anthropic</h3>
            <AiKeySettings {...aiKey} />
          </div>
        </section>
      </main>
    </div>
  )
}
