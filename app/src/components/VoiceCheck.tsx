import { useEffect, useRef, useState } from 'react'
import { Copy, Mic } from 'lucide-react'
import { getRecognition, isStandaloneApp, KEYBOARD_ON_IOS, listenOnce, speechLang, type SpeechLog, type SpeechOutcome } from '../speech'
import { localDate } from '../core/stats'
import { voiceSummary } from './voiceSummary'
import { VT } from './voiceTone'
import { VoicePrivacy } from './VoicePrivacy'

type Run = { outcome: SpeechOutcome; ms: number; log: SpeechLog }

// Diagnóstico «Probar voz»: escucha una vez y muestra qué ha pasado. No guarda nada.
export function VoiceCheck({ ack, onAck }: { ack: boolean; onAck: () => void }) {
  const t = VT.app
  const [asking, setAsking] = useState(false)
  const [listening, setListening] = useState(false)
  const [run, setRun] = useState<Run | null>(null)
  const stopRef = useRef<(() => void) | null>(null)
  const [copy, setCopy] = useState<'ok' | 'fail' | null>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => () => stopRef.current?.(), [])

  function start() {
    setAsking(false); setRun(null); setCopy(null); setListening(true)
    const log: SpeechLog = [], t0 = Date.now()
    const { result, stop } = listenOnce({ lang: speechLang(), onEvent: e => log.push(e) })
    stopRef.current = stop
    void result.then(outcome => { stopRef.current = null; setListening(false); setRun({ outcome, ms: Date.now() - t0, log }) })
  }
  const tap = () => { if (listening) stopRef.current?.(); else if (!ack) setAsking(true); else start() }

  const summary = () => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }
    const std = (navigator as { standalone?: boolean }).standalone
    const d = new Date()
    return voiceSummary({
      ua: navigator.userAgent, standalone: isStandaloneApp(), iosStandalone: std === undefined ? null : std,
      recognition: w.SpeechRecognition ? 'SpeechRecognition' : w.webkitSpeechRecognition ? 'webkitSpeechRecognition' : null,
      lang: speechLang(), online: navigator.onLine !== false, keyboardOnIos: KEYBOARD_ON_IOS,
      outcome: run!.outcome, ms: run!.ms, log: run!.log, at: `${localDate(d)}T${d.toTimeString().slice(0, 8)}`,
    })
  }
  // ponytail: sin portapapeles (o si falla) se muestra el texto seleccionado para copiarlo a mano.
  async function copySummary() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('no clipboard')
      await navigator.clipboard.writeText(summary()); setCopy('ok')
    } catch { setCopy('fail') }
  }
  useEffect(() => { if (copy === 'fail') { areaRef.current?.focus(); areaRef.current?.select() } }, [copy])

  const supported = getRecognition() !== undefined
  const o = run?.outcome
  const status = listening ? 'Probando la voz' : o ? (o.ok ? `Resultado: «${o.text}»` : `Error: ${o.error}`) : ''
  return (
    <div className="flex flex-col gap-3">
      {asking ? <VoicePrivacy tone="app" onAccept={() => { onAck(); start() }} onSecondary={() => setAsking(false)} secondaryLabel="Ahora no" />
        : <button type="button" onClick={tap} aria-pressed={listening} className={t.secondary + ' self-start'}>
          <Mic className="size-4" aria-hidden />{listening ? 'Probando · toca para parar' : 'Probar voz'}
        </button>}
      <p role="status" className="sr-only">{status}</p>
      {run && (
        <>
          <dl className={`grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm ${t.text}`}>
            <dt className={t.muted}>Reconocimiento</dt><dd>{supported ? 'disponible (webkitSpeechRecognition)' : 'no disponible'}</dd>
            <dt className={t.muted}>Modo</dt><dd>{isStandaloneApp() ? 'app instalada' : 'navegador'}</dd>
            <dt className={t.muted}>Conexión</dt><dd>{navigator.onLine === false ? 'no' : 'sí'}</dd>
            <dt className={t.muted}>Resultado</dt>
            <dd>{run.outcome.ok ? `«${run.outcome.text}» en ${(run.ms / 1000).toFixed(1).replace('.', ',')} s` : `Error: ${run.outcome.error}${run.outcome.detail ? ` (${run.outcome.detail})` : ''}`}</dd>
          </dl>
          <button type="button" onClick={() => void copySummary()} className={t.secondary + ' self-start'}>
            <Copy className="size-4" aria-hidden />Copiar resumen
          </button>
          {copy === 'ok' && <p role="status" className={`text-sm ${t.text}`}>Resumen copiado. Pégalo en el chat.</p>}
          {copy === 'fail' && (
            <div className="flex flex-col gap-2">
              <p role="status" className={`text-sm ${t.text}`}>No se ha podido copiar: selecciona el texto y cópialo.</p>
              <textarea ref={areaRef} readOnly rows={8} aria-label="Resumen de la prueba de voz" defaultValue={summary()} className={`${t.field} w-full py-2 font-mono text-xs`} />
            </div>
          )}
          <details className={`text-xs leading-5 ${t.muted}`}>
            <summary className="min-h-11 cursor-pointer py-3">Detalles técnicos</summary>
            <ul className="flex flex-col gap-0.5 tabular-nums">
              {run.log.map((e, i) => <li key={i}>{e.t} ms · {e.ev}{e.detail ? ` · ${e.detail}` : ''}</li>)}
              {run.log.length === 0 && <li>Sin eventos</li>}
            </ul>
            <p className="mt-2 break-words">{navigator.userAgent}</p>
          </details>
        </>
      )}
    </div>
  )
}
