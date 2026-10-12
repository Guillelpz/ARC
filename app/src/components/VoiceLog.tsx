import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { CircleAlert, Keyboard, Mic } from 'lucide-react'
import type { Exercise, WeightUnit } from '../core/types'
import { MAX_VOICE_SETS, VOICE_MAX_CHARS, draftText, isComplete, type GymDraft, type VoiceCommand } from '../core/voice'
import { dayLabel } from '../core/stats'
import { keyboardFirst, listenOnce, speechLang, speechSupported, type SpeechError } from '../speech'
import { VT, type VoiceTone } from './voiceTone'
import { VoicePrivacy } from './VoicePrivacy'

export type VoiceMissing = 'exercise' | 'weight' | 'reps' | 'sets'

type Props = {
  tone: VoiceTone
  day: string
  today: string
  exercises: Exercise[] // activos
  unit: WeightUnit // preferencia del gym
  ack: boolean
  onAck: () => void
  onInterpret: (text: string) => Promise<VoiceCommand>
  onSave: (cmd: VoiceCommand, day: string) => { ids: string[]; auto: boolean }
  onUndo: (ids: string[]) => { retracted: boolean }
  onEdit: (draft: GymDraft) => void
  onIncomplete: (draft: GymDraft, missing: VoiceMissing[]) => void
}
type Saved = { cmd: VoiceCommand; ids: string[]; auto: boolean; day: string }
type Mode = 'idle' | 'privacy' | 'listening' | 'processing' | 'saved' | 'undone' | 'text'

const ERRORS: Record<SpeechError, (d?: string) => string | null> = {
  'not-allowed': () => 'No hay permiso para el micrófono o el reconocimiento de voz. Escribe la serie o revisa los permisos (en el iPhone: Siri y Dictado activados).',
  'service-not-allowed': () => 'No hay permiso para el micrófono o el reconocimiento de voz. Escribe la serie o revisa los permisos (en el iPhone: Siri y Dictado activados).',
  'no-speech': () => 'No se ha oído nada. Vuelve a intentarlo o escribe la serie.',
  'no-result': () => 'No se ha oído nada. Vuelve a intentarlo o escribe la serie.',
  timeout: () => 'No se ha oído nada. Vuelve a intentarlo o escribe la serie.',
  'audio-capture': () => 'No se encuentra el micrófono.',
  network: () => 'Sin conexión: el reconocimiento de voz necesita internet. Escribe la serie.',
  'not-supported': () => 'Este navegador no puede reconocer la voz. Escribe la serie.',
  other: d => `No se ha podido reconocer la voz (${d ?? 'error desconocido'}).`,
  aborted: () => null,
}
const OFFLINE_TEXT = 'Sin conexión: el reconocimiento de voz necesita internet. Escribe la serie.'
const NO_API_TEXT = 'Este navegador no puede reconocer la voz. Escribe la serie.'

function missingOf(d: GymDraft, exercises: Exercise[]): VoiceMissing[] {
  const e = exercises.find(x => x.id === d.exerciseId)
  const out: VoiceMissing[] = []
  if (!e) out.push('exercise')
  if (d.weight === null || (e?.kind === 'load' && d.weight <= 0)) out.push('weight')
  if (d.reps === null) out.push('reps')
  if (!Number.isInteger(d.sets) || d.sets < 1 || d.sets > MAX_VOICE_SETS) out.push('sets')
  return out
}

// Micro + «Escribir»: dicta (o escribe) una serie y la guarda directamente; si falta algo, abre el formulario. Los callbacks se
// guardan en una ref y se llaman desde ella tras cualquier `await`: los de un render antiguo pisarían cambios hechos mientras tanto.
export function VoiceLog(props: Props) {
  const { tone, day, today, exercises, unit, ack } = props
  const t = VT[tone]
  const ref = useRef(props)
  useEffect(() => { ref.current = props })
  const [mode, setMode] = useState<Mode>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [saved, setSaved] = useState<Saved | null>(null)
  const [undone, setUndone] = useState('')
  const [text, setText] = useState('')
  const stopRef = useRef<(() => void) | null>(null)
  const alive = useRef(true)
  const micRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const focusInput = useRef(false) // el campo se enfoca tras un error asíncrono (no hay gesto: iOS no abre el teclado)
  useEffect(() => { alive.current = true; return () => { alive.current = false; stopRef.current?.() } }, [])
  useEffect(() => { if (mode === 'text' && focusInput.current) { focusInput.current = false; inputRef.current?.focus() } }, [mode])

  // Abre el campo de texto y lo enfoca en el mismo toque (iOS solo abre el teclado dentro del gesto).
  function openText(msg: string | null) {
    flushSync(() => { setMode('text'); setMessage(msg); setSaved(null) })
    inputRef.current?.focus()
  }
  function openTextLater(msg: string | null) { focusInput.current = true; setMessage(msg); setSaved(null); setMode('text') }

  async function process(raw: string) {
    setMode('processing'); setMessage(null); setSaved(null)
    const cmd = await ref.current.onInterpret(raw)
    if (!alive.current) return
    const r = ref.current
    if (isComplete(cmd.draft, r.exercises)) {
      const s = r.onSave(cmd, r.day)
      setSaved({ cmd, ...s, day: r.day }); setMode('saved'); setText('')
      setTimeout(() => micRef.current?.focus(), 0) // el botón estaba deshabilitado: el foco se había perdido
    } else {
      setMode('idle'); setText('')
      r.onIncomplete(cmd.draft, missingOf(cmd.draft, r.exercises))
    }
  }

  async function listen() {
    setMode('listening'); setMessage(null); setSaved(null)
    const { result, stop } = listenOnce({ lang: speechLang() })
    stopRef.current = stop
    const o = await result
    stopRef.current = null
    if (!alive.current) return
    if (!o.ok) {
      const msg = ERRORS[o.error](o.detail)
      if (msg === null) return setMode('idle')
      return openTextLater(msg)
    }
    await process(o.text)
  }

  // ponytail: si no hay API de voz, sin conexión o el valor de KEYBOARD_ON_IOS lo indica, se abre el campo de texto directamente.
  // Cualquier error del reconocimiento cae también al campo, enfocado y con el motivo (ver ERRORS).
  function begin() {
    if (navigator.onLine === false) return openText(OFFLINE_TEXT)
    if (!speechSupported() || keyboardFirst()) return openText(speechSupported() ? null : NO_API_TEXT)
    void listen()
  }
  function dictate() {
    if (mode === 'listening') return stopRef.current?.()
    if (!ack) { setSaved(null); setMessage(null); setMode('privacy'); return }
    begin()
  }
  function accept() {
    ref.current.onAck()
    begin() // en el mismo toque: la voz empieza a escuchar o, sin voz, el campo de texto se enfoca
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (text.trim()) void process(text)
  }
  function undo() {
    if (!saved) return
    const r = ref.current.onUndo(saved.ids)
    const nm = exercises.find(x => x.id === saved.cmd.draft.exerciseId)?.name ?? 'ejercicio'
    const n = saved.ids.length
    setUndone(`Deshecho: ${n} ${n === 1 ? 'serie' : 'series'} de ${nm}.${r.retracted ? ' Sesión de Gym retirada.' : ''}`)
    setSaved(null); setMode('undone')
    setTimeout(() => micRef.current?.focus(), 0)
  }
  function edit() {
    if (!saved) return
    ref.current.onUndo(saved.ids)
    const d = saved.cmd.draft
    setSaved(null); setMode('idle')
    ref.current.onEdit(d)
  }
  function close() { setSaved(null); setMode('idle'); setTimeout(() => micRef.current?.focus(), 0) }

  const busy = mode === 'processing'
  const dayWord = dayLabel(saved?.day ?? day, today).toLowerCase()
  const ai = saved && saved.cmd.source === 'parser' && (saved.cmd.aiError === 'auth' || saved.cmd.aiError === 'rate')
  const statusText = mode === 'privacy' ? 'Aviso de privacidad de la voz'
    : mode === 'listening' ? 'Escuchando'
    : busy ? 'Procesando…'
    : mode === 'saved' && saved ? `Registrado: ${draftText(saved.cmd.draft, exercises, unit)}${saved.auto ? ` Sesión de Gym apuntada en HERO (${dayWord}).` : ''}`
    : mode === 'undone' ? undone
    : mode === 'text' ? (message ?? '') : ''
  const visible = busy || mode === 'saved' || mode === 'undone' || (mode === 'text' && message !== null)

  return (
    <div className="flex flex-col gap-3">
      {mode === 'privacy' ? (
        <VoicePrivacy tone={tone} onAccept={accept} onSecondary={() => openText(null)} />
      ) : (
        <div className="flex flex-wrap gap-2">
          <button ref={micRef} type="button" onClick={dictate} disabled={busy} aria-pressed={mode === 'listening' ? true : undefined} className={t.primary}>
            <Mic className="size-4" aria-hidden />{mode === 'listening' ? 'Escuchando · toca para parar' : 'Dictar serie'}
          </button>
          <button type="button" onClick={() => openText(null)} disabled={busy || mode === 'listening'} className={t.secondary}>
            <Keyboard className="size-4" aria-hidden />Escribir
          </button>
        </div>
      )}
      <div className={mode === 'saved' ? `flex flex-col gap-2 rounded-lg border p-3 ${t.border} ${t.surface} ${t.text}` : ''}>
        <p role="status" className={visible ? `flex items-start gap-2 text-sm ${mode === 'saved' ? 'font-semibold' : ''} ${t.text}` : 'sr-only'}>
          {mode === 'text' && message !== null && <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />}{statusText}
        </p>
        {mode === 'saved' && saved && (
          <>
            <p className={`text-sm ${t.muted}`}>Oído: «{saved.cmd.text}»</p>
            {ai && <p className={`text-sm ${t.muted}`}>La IA no está disponible (clave rechazada o sin saldo): interpretado en el dispositivo.</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={undo} className={t.secondary}>Deshacer</button>
              <button type="button" onClick={edit} className={t.secondary}>Editar</button>
              <button type="button" onClick={close} className={t.link}>Cerrar</button>
            </div>
          </>
        )}
      </div>
      {mode === 'text' && (
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label htmlFor={`voz-texto-${tone}`} className={`text-xs font-medium ${t.text}`}>Serie</label>
          <input id={`voz-texto-${tone}`} ref={inputRef} value={text} onChange={e => setText(e.target.value)} maxLength={VOICE_MAX_CHARS} autoComplete="off" enterKeyHint="send" className={`${t.field} w-full`} />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={!text.trim()} className={t.primary}>Registrar</button>
            <button type="button" onClick={() => { setMode('idle'); setMessage(null); setText(''); setTimeout(() => micRef.current?.focus(), 0) }} className={t.secondary}>Cancelar</button>
          </div>
          <p className={`text-xs leading-5 ${t.muted}`}>Ej.: 80 kg press banca 5 reps. En el iPhone puedes dictar con el micro del teclado.</p>
        </form>
      )}
    </div>
  )
}
