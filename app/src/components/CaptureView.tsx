import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { CircleAlert, Mic } from 'lucide-react'
import type { ActivityEvent, Branch, Exercise, Tracker, WeightUnit } from '../core/types'
import { VOICE_MAX_CHARS, draftText, isComplete, type GymDraft, type VoiceCommand } from '../core/voice'
import { AUTO_CREATE_S, MAX_CAPTURE, convNote, type CaptureCommand, type NewHabit, type Problem } from '../core/capture'
import { unitFor } from '../core/trackers'
import { listenOnce, speechLang, speechSupported, keyboardFirst, type ListenStart, type SpeechOutcome } from '../speech'
import { VT } from './voiceTone'
import { VoicePrivacy } from './VoicePrivacy'
import { noApiText, offlineText, speechErrorText } from './voiceErrors'
import { missingOf, type VoiceMissing } from './voiceNotes'
import { CARD, LABEL } from './branchTone'
import { CreatedResult, NewHabitCard, TrackerResult } from './CaptureCards'

export type CaptureStart = ListenStart | { mode: 'privacy' } | { mode: 'idle' }

type Props = {
  start: CaptureStart
  onConsumed: () => void
  ack: boolean
  onAck: () => void
  trackers: Tracker[] // todos
  exercises: Exercise[] // activos
  unit: WeightUnit
  onInterpret: (text: string) => Promise<CaptureCommand>
  onSaveGym: (cmd: VoiceCommand) => { ids: string[]; auto: boolean }
  onUndoGym: (ids: string[]) => { retracted: boolean }
  onGymEdit: (draft: GymDraft) => void
  onGymIncomplete: (draft: GymDraft, missing: VoiceMissing[]) => void
  onAdd: (trackerId: string, amount: number) => ActivityEvent | null
  onUndoEvent: (t: Tracker, ev: ActivityEvent) => void
  onCreate: (h: NewHabit) => { tracker: Tracker; event: ActivityEvent }
  onUndoCreate: (t: Tracker, ev: ActivityEvent) => void
  onGoToMissions: (b: Branch) => void
  onManual: (text: string) => void
  onBusy: (busy: boolean) => void
  onLearn: (cmd: CaptureCommand) => void
  onForget: (text: string) => void
}
type Mode = 'idle' | 'privacy' | 'listening' | 'processing' | 'text'
type Res =
  | { k: 'gym'; cmd: VoiceCommand; ids: string[]; auto: boolean }
  | { k: 'trk'; text: string; t: Tracker; ev: ActivityEvent; note: string | null }
  | { k: 'form'; text: string; t: Tracker; problem: Problem | null; amount: number | null }
  | { k: 'new'; cmd: Extract<CaptureCommand, { kind: 'new' }>; auto: boolean }
  | { k: 'created'; t: Tracker; ev: ActivityEvent }
  | { k: 'other-day' }
  | { k: 'unknown' }
  | { k: 'undone'; text: string }

const WHAT = 'lo que has hecho'
const OTHER_DAY_TEXT = 'Por voz solo se apunta hoy. Para otro día, hazlo a mano.'
const UNKNOWN_TEXT = 'No se ha entendido qué apuntar. Prueba otra vez o escríbelo a mano.'

// Pantalla «Nuevo»: dicta (o escribe) una frase y se reparte entre una serie de Gym, un hábito existente o uno nuevo.
// La escucha ya viene empezada desde el toque que abrió la pantalla (`start`, requisito de iOS). Los callbacks van por una ref:
// tras cualquier `await` se llaman los del último render.
export function CaptureView(props: Props) {
  const { exercises, unit, ack } = props
  const t = VT.app
  const ref = useRef(props)
  useLayoutEffect(() => { ref.current = props })
  const s0 = props.start
  const [mode, setMode] = useState<Mode>(() => s0.mode === 'listen' ? 'listening' : s0.mode === 'privacy' ? 'privacy' : s0.mode === 'text' ? 'text' : 'idle')
  const [message, setMessage] = useState<string | null>(() => s0.mode === 'text' ? (s0.reason === 'offline' ? offlineText(WHAT) : s0.reason === 'no-api' ? noApiText(WHAT) : null) : null)
  const [res, setRes] = useState<Res | null>(null)
  const [text, setText] = useState('')
  const [stopped, setStopped] = useState(false) // la cuenta atrás de la propuesta se ha parado
  const heard = useRef('')
  const stopRef = useRef<(() => void) | null>(null)
  const alive = useRef(true)
  const consumed = useRef(false)
  const h1Ref = useRef<HTMLHeadingElement>(null)
  const micRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const focusInput = useRef(s0.mode === 'text')
  const focusMic = () => setTimeout(() => micRef.current?.focus(), 0)

  useEffect(() => { ref.current.onBusy(mode === 'listening' || mode === 'processing') }, [mode])
  useEffect(() => { if (mode === 'text' && focusInput.current) { focusInput.current = false; inputRef.current?.focus() } }, [mode])

  function openText(msg: string | null) {
    flushSync(() => { setMode('text'); setMessage(msg); setRes(null) })
    inputRef.current?.focus()
  }
  function openTextLater(msg: string | null) { focusInput.current = true; setMessage(msg); setRes(null); setMode('text') }

  async function process(raw: string) {
    heard.current = raw
    setMode('processing'); setMessage(null); setRes(null)
    const cmd = await ref.current.onInterpret(raw)
    if (!alive.current) return
    const r = ref.current
    setText('')
    switch (cmd.kind) {
      case 'gym':
        if (isComplete(cmd.draft, r.exercises)) {
          const s = r.onSaveGym(cmd)
          r.onLearn(cmd)
          setRes({ k: 'gym', cmd, ...s }); setMode('idle'); focusMic()
        } else {
          setMode('idle')
          r.onGymIncomplete(cmd.draft, missingOf(cmd.draft, r.exercises))
        }
        return
      case 'other-day': setRes({ k: 'other-day' }); setMode('idle'); focusMic(); return
      case 'unknown': setRes({ k: 'unknown' }); setMode('idle'); focusMic(); return
      case 'tracker': {
        const tr = r.trackers.find(x => x.id === cmd.trackerId)
        if (!tr) { setRes({ k: 'unknown' }); setMode('idle'); focusMic(); return }
        const ev = cmd.amount !== null && cmd.problem === null ? r.onAdd(tr.id, cmd.amount) : null
        setMode('idle')
        if (ev) { r.onLearn(cmd); setRes({ k: 'trk', text: cmd.text, t: tr, ev, note: convNote(cmd.said, cmd.amount) }); focusMic() }
        else setRes({ k: 'form', text: cmd.text, t: tr, problem: cmd.problem, amount: cmd.amount })
        return
      }
      case 'new':
        setStopped(false); setMode('idle')
        setRes({ k: 'new', cmd, auto: cmd.source === 'ai' && cmd.habit.confidence === 'alta' && cmd.habit.amount !== null && !cmd.habit.archivedDup && AUTO_CREATE_S > 0 })
        return
    }
  }

  async function settle(result: Promise<SpeechOutcome>) {
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

  function listen() {
    setMode('listening'); setMessage(null); setRes(null)
    const { result, stop } = listenOnce({ lang: speechLang() })
    stopRef.current = stop
    void settle(result)
  }
  // ponytail: sin API de voz, sin conexión o con KEYBOARD_ON_IOS se abre el campo de texto; cualquier error del reconocimiento cae también a él.
  function begin() {
    if (navigator.onLine === false) return openText(offlineText(WHAT))
    if (!speechSupported() || keyboardFirst()) return openText(speechSupported() ? null : noApiText(WHAT))
    listen()
  }
  function dictate() {
    if (mode === 'listening') return stopRef.current?.()
    if (!ack) { setRes(null); setMessage(null); setMode('privacy'); return }
    begin()
  }
  function accept() { ref.current.onAck(); begin() }
  function submit(e: React.FormEvent) { e.preventDefault(); if (text.trim()) void process(text) }
  function manual() { ref.current.onManual((mode === 'text' ? text : '').trim() || heard.current) }

  function undoGym() {
    if (res?.k !== 'gym') return
    const r = ref.current.onUndoGym(res.ids)
    ref.current.onForget(res.cmd.text)
    const nm = exercises.find(x => x.id === res.cmd.draft.exerciseId)?.name ?? 'ejercicio', n = res.ids.length
    setRes({ k: 'undone', text: `Deshecho: ${n} ${n === 1 ? 'serie' : 'series'} de ${nm}.${r.retracted ? ' Sesión de Gym retirada.' : ''}` }); focusMic()
  }
  function editGym() {
    if (res?.k !== 'gym') return
    ref.current.onUndoGym(res.ids)
    ref.current.onForget(res.cmd.text)
    const d = res.cmd.draft
    setRes(null)
    ref.current.onGymEdit(d)
  }
  function undoTracker() {
    if (res?.k !== 'trk') return
    ref.current.onUndoEvent(res.t, res.ev)
    ref.current.onForget(res.text) // ponytail: deshacer después desde la pantalla de misiones no olvida la frase
    setRes({ k: 'undone', text: `Deshecho: +${res.ev.amount} ${unitFor(res.ev.amount, res.t.unit)} en ${res.t.name}.` }); focusMic()
  }
  function editTracker() {
    if (res?.k !== 'trk') return
    ref.current.onUndoEvent(res.t, res.ev)
    ref.current.onForget(res.text)
    setRes({ k: 'form', text: res.text, t: res.t, problem: null, amount: res.ev.amount })
  }
  function applyAmount(n: number) {
    if (res?.k !== 'form') return
    const ev = ref.current.onAdd(res.t.id, n)
    if (!ev) return
    setRes({ k: 'trk', text: res.text, t: res.t, ev, note: null }); focusMic()
  }
  function createHabit(h: NewHabit) {
    if (res?.k !== 'new') return
    const { tracker, event } = ref.current.onCreate(h)
    setRes({ k: 'created', t: tracker, ev: event }); focusMic()
  }
  function undoCreated() {
    if (res?.k !== 'created') return
    ref.current.onUndoCreate(res.t, res.ev)
    setRes({ k: 'undone', text: `Deshecho: ${res.t.name} archivada y registro anulado.` }); focusMic()
  }
  const close = () => { setRes(null); focusMic() }

  useEffect(() => {
    alive.current = true
    if (!consumed.current) { // StrictMode monta dos veces: la escucha solo se consume una
      consumed.current = true
      const s = ref.current.start
      ref.current.onConsumed()
      if (s.mode === 'listen') { stopRef.current = s.stop; void settle(s.result) }
      if (s.mode === 'listen' || s.mode === 'idle') h1Ref.current?.focus()
    }
    return () => {
      alive.current = false
      setTimeout(() => { if (!alive.current) { stopRef.current?.(); ref.current.onBusy(false) } }, 0) // tras el remontaje de StrictMode alive vuelve a ser true
    }
  }, [])
  const busy = mode === 'processing'
  const aiNote = res?.k === 'gym' && res.cmd.source !== 'ai' && (res.cmd.aiError === 'auth' || res.cmd.aiError === 'rate')
  const statusText = mode === 'privacy' ? 'Aviso de privacidad de la voz'
    : mode === 'listening' ? 'Escuchando'
    : busy ? 'Procesando…'
    : res?.k === 'gym' ? `Registrado: ${draftText(res.cmd.draft, exercises, unit)}${res.auto ? ' Sesión de Gym apuntada en HERO (hoy).' : ''}`
    : res?.k === 'trk' ? `Registrado: ${res.t.name} · +${res.ev.amount} ${unitFor(res.ev.amount, res.t.unit)} · +${res.ev.amount * res.t.xpPerUnit} ${LABEL[res.t.branch]} XP`
    : res?.k === 'form' ? (res.problem === 'unit' ? `${res.t.name} se mide en ${res.t.unit}: no se ha apuntado nada.` : res.problem === 'range' ? `La cantidad debe estar entre 1 y ${MAX_CAPTURE} ${res.t.unit}: no se ha apuntado nada.` : '')
    : res?.k === 'new' ? (res.auto ? (stopped ? 'Cuenta atrás parada. Revisa la propuesta.' : `Se creará sola en ${AUTO_CREATE_S} segundos. Toca la tarjeta para revisarla.`) : '')
    : res?.k === 'created' ? `Creada: ${res.t.name} (${LABEL[res.t.branch]}) · +${res.ev.amount} ${unitFor(res.ev.amount, res.t.unit)}.`
    : res?.k === 'other-day' ? OTHER_DAY_TEXT
    : res?.k === 'unknown' ? UNKNOWN_TEXT
    : res?.k === 'undone' ? res.text
    : mode === 'text' ? (message ?? '') : ''
  const visible = statusText !== '' && res?.k !== 'new' && (busy || res !== null || (mode === 'text' && message !== null))
  const branch = res?.k === 'trk' || res?.k === 'form' || res?.k === 'created' ? CARD[res.t.branch] : null
  const card = res?.k === 'gym' ? `flex flex-col gap-2 rounded-lg border p-3 ${t.border} ${t.surface} ${t.text}` : branch ? `flex flex-col gap-2 rounded-lg border p-3 ${branch.box}` : ''

  return (
    <div className="min-h-dvh bg-app-bg text-app-text">
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-6 pb-28 sm:max-w-2xl lg:max-w-4xl">
        <header className="flex flex-col gap-1">
          <h1 ref={h1Ref} tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none sm:text-3xl">Apuntar</h1>
          <p className="text-sm text-app-muted">Di qué has hecho hoy</p>
        </header>
        <div className="flex w-full max-w-xl flex-col gap-3">
          {mode === 'privacy' ? (
            <>
              <VoicePrivacy tone="app" onAccept={accept} onSecondary={() => openText(null)} />
              <button type="button" onClick={manual} className={`${t.secondary} self-start`}>Escribir a mano</button>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button ref={micRef} type="button" onClick={dictate} disabled={busy} aria-pressed={mode === 'listening' ? true : undefined} className={t.primary}>
                <Mic className="size-4" aria-hidden />{mode === 'listening' ? 'Escuchando · toca para parar' : 'Dictar'}
              </button>
              <button type="button" onClick={manual} disabled={busy || mode === 'listening'} className={t.secondary}>Escribir a mano</button>
            </div>
          )}
          <div className={card}>
            <p role="status" className={visible ? `flex items-start gap-2 text-sm ${res?.k === 'gym' || res?.k === 'trk' || res?.k === 'created' ? 'font-semibold' : ''} ${branch ? '' : t.text}` : 'sr-only'}>
              {(res?.k === 'other-day' || res?.k === 'unknown' || (mode === 'text' && message !== null)) && <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />}{statusText}
            </p>
            {(res?.k === 'trk' || res?.k === 'form') && (
              <TrackerResult key={res.k} tracker={res.t} heard={res.text} note={res.k === 'trk' ? res.note : null} form={res.k === 'form'} amount={res.k === 'form' ? res.amount : null}
                onUndo={undoTracker} onEdit={editTracker} onClose={close} onSubmit={applyAmount} onCancel={close} />
            )}
            {res?.k === 'created' && <CreatedResult branch={res.t.branch} onUndo={undoCreated} onGo={() => ref.current.onGoToMissions(res.t.branch)} onClose={close} />}
            {res?.k === 'new' && (
              <NewHabitCard habit={res.cmd.habit} heard={res.cmd.text} trackers={props.trackers} auto={res.auto} stopped={stopped} onStop={() => setStopped(true)}
                onCreate={createHabit} onDiscard={close} />
            )}
            {res?.k === 'gym' && (
              <>
                <p className={`text-sm ${t.muted}`}>Oído: «{res.cmd.text}»</p>
                {aiNote && <p className={`text-sm ${t.muted}`}>La IA no está disponible (clave rechazada o sin saldo): interpretado en el dispositivo.</p>}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={undoGym} className={t.secondary}>Deshacer</button>
                  <button type="button" onClick={editGym} className={t.secondary}>Editar</button>
                  <button type="button" onClick={close} className={t.link}>Cerrar</button>
                </div>
              </>
            )}
          </div>
          {mode === 'text' && (
            <form onSubmit={submit} className="flex flex-col gap-2">
              <label htmlFor="captura-texto" className={`text-xs font-medium ${t.text}`}>¿Qué has hecho hoy?</label>
              <input id="captura-texto" ref={inputRef} value={text} onChange={e => setText(e.target.value)} maxLength={VOICE_MAX_CHARS} autoComplete="off" enterKeyHint="send" className={`${t.field} w-full`} />
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={!text.trim()} className={t.primary}>Apuntar</button>
                <button type="button" onClick={() => { setMode('idle'); setMessage(null); setText(''); focusMic() }} className={t.secondary}>Cancelar</button>
              </div>
              <p className={`text-xs leading-5 ${t.muted}`}>Ej.: 80 kg press banca 5 reps, o 30 min de lectura. En el iPhone puedes dictar con el micro del teclado.</p>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
