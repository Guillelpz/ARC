import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { CircleAlert, Keyboard, Mic } from 'lucide-react'
import type { DietChange, Food } from '../core/types'
import { dietNote } from '../core/food'
import { isConfirmable, itemReady, voiceAdds, type FoodItem, type VoiceAdd } from '../core/foodVoice'
import type { CaptureCommand } from '../core/capture'
import { VOICE_MAX_CHARS } from '../core/voice'
import { dayLabel } from '../core/stats'
import { keyboardFirst, listenOnce, speechLang, speechSupported } from '../speech'
import { VT } from './voiceTone'
import { VoicePrivacy } from './VoicePrivacy'
import { noApiText, offlineText, speechErrorText } from './voiceErrors'
import { FoodVoiceCard } from './FoodVoiceCard'
import { confirmDone, foodCount, foodStatus, kcalOf } from './foodVoiceText'

export type FoodVoiceCmd = Extract<CaptureCommand, { kind: 'food' | 'other-day' | 'unknown' }>
type Props = {
  day: string // día del selector
  today: string
  own: Food[] // propios (también archivados)
  ack: boolean
  onAck: () => void
  onInterpret: (text: string) => Promise<FoodVoiceCmd>
  onSave: (adds: VoiceAdd[], day: string) => { ids: string[]; created: string[]; diet: DietChange }
  onUndo: (ids: string[], archive: string[]) => { undone: number; diet: DietChange }
  onPending: (items: FoodItem[], heard: string) => void // «Completar»/«Editar»: pasan a «Por voz: pendiente»
  onLearn: (cmd: CaptureCommand) => void // O1: frase de un alimento guardado solo
  onForget: (text: string) => void // «Deshacer»/«Editar»
}
type Done = { cmd: Extract<FoodVoiceCmd, { kind: 'food' }>; ids: string[]; created: string[]; saved: FoodItem[]; pending: FoodItem[]; diet: DietChange; undone: null; day: string }
type Mode = 'idle' | 'privacy' | 'listening' | 'processing' | 'saved' | 'undone' | 'text'

export const FOOD_OTHER_DAY = 'Para otro día, cámbialo en el selector y dicta sin decir el día.'
const UNKNOWN = 'No se ha entendido qué has comido. Prueba otra vez o escríbelo.'
const WHAT = 'lo que has comido'

// Micro + «Escribir» de Comida: guarda en el día del selector. Copia el patrón de VoiceLog (callbacks por ref, gesto de iOS).
// ponytail: dos shells de micro (VoiceLog y este); unificar en un hook si aparece un tercero.
export function FoodVoiceLog(props: Props) {
  const { day, today, own, ack } = props
  const t = VT.hero
  const ref = useRef(props)
  useLayoutEffect(() => { ref.current = props })
  const [mode, setMode] = useState<Mode>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [done, setDone] = useState<Done | null>(null)
  const [undone, setUndone] = useState('')
  const [text, setText] = useState('')
  const stopRef = useRef<(() => void) | null>(null)
  const alive = useRef(true)
  const micRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const focusInput = useRef(false)
  useEffect(() => { alive.current = true; return () => { alive.current = false; stopRef.current?.() } }, [])
  useEffect(() => { if (mode === 'text' && focusInput.current) { focusInput.current = false; inputRef.current?.focus() } }, [mode])
  const focusMic = () => setTimeout(() => micRef.current?.focus(), 0)

  function openText(msg: string | null) {
    flushSync(() => { setMode('text'); setMessage(msg); setDone(null) })
    inputRef.current?.focus()
  }
  function openTextLater(msg: string | null) { focusInput.current = true; setMessage(msg); setDone(null); setMode('text') }

  async function process(raw: string) {
    setMode('processing'); setMessage(null); setDone(null)
    const cmd = await ref.current.onInterpret(raw)
    if (!alive.current) return
    const r = ref.current
    setText('')
    if (cmd.kind !== 'food') { setMessage(cmd.kind === 'other-day' ? FOOD_OTHER_DAY : UNKNOWN); setMode('idle'); focusMic(); return } // A7: otro día no guarda
    const ready = cmd.items.filter(itemReady), pending = cmd.items.filter(i => !itemReady(i))
    if (!ready.length && !pending.some(isConfirmable)) { setMode('idle'); r.onPending(cmd.items, cmd.text); return } // nada que guardar ni que confirmar: Comida lo completa
    const s = r.onSave(voiceAdds(ready, r.own), r.day)
    if (pending.length === 0) r.onLearn(cmd)
    setDone({ cmd, ids: s.ids, created: s.created, saved: ready, pending, diet: s.diet, undone: null, day: r.day }); setMode('saved'); focusMic()
  }

  async function listen() {
    setMode('listening'); setMessage(null); setDone(null)
    const { result, stop } = listenOnce({ lang: speechLang() })
    stopRef.current = stop
    const o = await result
    stopRef.current = null
    if (!alive.current) return
    if (!o.ok) {
      const msg = speechErrorText(o.error, o.detail, WHAT)
      if (msg === null) return setMode('idle')
      return openTextLater(msg)
    }
    await process(o.text)
  }
  function begin() {
    if (navigator.onLine === false) return openText(offlineText(WHAT))
    if (!speechSupported() || keyboardFirst()) return openText(speechSupported() ? null : noApiText(WHAT))
    void listen()
  }
  function dictate() {
    if (mode === 'listening') return stopRef.current?.()
    if (!ack) { setDone(null); setMessage(null); setMode('privacy'); return }
    begin()
  }
  function accept() { ref.current.onAck(); begin() }
  function submit(e: React.FormEvent) { e.preventDefault(); if (text.trim()) void process(text) }

  function undo() {
    if (!done) return
    const r = ref.current.onUndo(done.ids, done.created)
    ref.current.onForget(done.cmd.text)
    setUndone(`Deshecho: ${foodCount(done.ids.length)} (${kcalOf(done.saved, own)} kcal).${dietNote(r.diet)}`)
    setDone(null); setMode('undone'); focusMic()
  }
  function edit() {
    if (!done) return
    if (done.ids.length) ref.current.onUndo(done.ids, done.created)
    ref.current.onForget(done.cmd.text)
    setDone(null); setMode('idle')
    ref.current.onPending(done.cmd.items, done.cmd.text) // todos los ítems vuelven como pendientes
  }
  // «Apuntar» de una estimación o ración propuesta: guarda en el día elegido y suma sus ids al mismo «Deshacer»
  const confirmed = useRef(new Set<FoodItem>()) // `done` es el del render: un segundo clic rápido no debe guardar dos veces
  function confirm(item: FoodItem, asOwn: boolean) {
    if (!done || confirmed.current.has(item)) return
    confirmed.current.add(item)
    setDone(confirmDone(done, item, asOwn, ref.current.own, adds => ref.current.onSave(adds, done.day)))
  }
  function complete() { if (done) { const d = done; setDone({ ...d, pending: [] }); ref.current.onPending(d.pending, d.cmd.text) } }
  function close() { setDone(null); setMode('idle'); focusMic() }

  const busy = mode === 'processing'
  const dayWord = dayLabel(done?.day ?? day, today).toLowerCase()
  const statusText = mode === 'privacy' ? 'Aviso de privacidad de la voz'
    : mode === 'listening' ? 'Escuchando'
    : busy ? 'Procesando…'
    : mode === 'saved' && done ? `${foodStatus({ ...done, undone: null }, own)} (${dayWord}).`
    : mode === 'undone' ? undone
    : message ?? ''
  const aiNote = mode === 'saved' && done && done.cmd.source !== 'ai' && (done.cmd.aiError === 'auth' || done.cmd.aiError === 'rate')
  const visible = busy || mode === 'saved' || mode === 'undone' || message !== null

  return (
    <div className="flex flex-col gap-3">
      {mode === 'privacy' ? (
        <VoicePrivacy tone="hero" onAccept={accept} onSecondary={() => openText(null)} />
      ) : (
        <div className="flex flex-wrap gap-2">
          <button ref={micRef} type="button" onClick={dictate} disabled={busy} aria-pressed={mode === 'listening' ? true : undefined} className={t.primary}>
            <Mic className="size-4" aria-hidden />{mode === 'listening' ? 'Escuchando · toca para parar' : 'Dictar comida'}
          </button>
          <button type="button" onClick={() => openText(null)} disabled={busy || mode === 'listening'} className={t.secondary}>
            <Keyboard className="size-4" aria-hidden />Escribir
          </button>
        </div>
      )}
      <div className={mode === 'saved' ? `flex flex-col gap-2 rounded-lg border p-3 ${t.border} ${t.surface} ${t.text}` : ''}>
        <p role="status" className={visible ? `flex items-start gap-2 text-sm ${mode === 'saved' ? 'font-semibold' : ''} ${t.text}` : 'sr-only'}>
          {message !== null && mode !== 'saved' && <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />}{statusText}
        </p>
        {aiNote && <p className={`text-sm ${t.muted}`}>La IA no está disponible (clave rechazada o sin saldo): interpretado en el dispositivo.</p>}
        {mode === 'saved' && done && (
          <FoodVoiceCard tone="hero" heard={done.cmd.text} saved={done.saved} pending={done.pending} rest={done.cmd.rest} own={own}
            onUndo={done.ids.length ? undo : undefined} onConfirm={confirm} onComplete={complete} onEdit={edit} onClose={close} />
        )}
      </div>
      {mode === 'text' && (
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label htmlFor="comida-voz-texto" className={`text-xs font-medium ${t.text}`}>Comida</label>
          <input id="comida-voz-texto" ref={inputRef} value={text} onChange={e => setText(e.target.value)} maxLength={VOICE_MAX_CHARS} autoComplete="off" enterKeyHint="send" className={`${t.field} w-full`} />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={!text.trim()} className={t.primary}>Apuntar</button>
            <button type="button" onClick={() => { setMode('idle'); setMessage(null); setText(''); focusMic() }} className={t.secondary}>Cancelar</button>
          </div>
          <p className={`text-xs leading-5 ${t.muted}`}>Ej.: 200 g de arroz y dos huevos. En el iPhone puedes dictar con el micro del teclado.</p>
        </form>
      )}
    </div>
  )
}
