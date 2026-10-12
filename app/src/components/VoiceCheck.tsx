import { useEffect, useRef, useState } from 'react'
import { Mic } from 'lucide-react'
import { getRecognition, isStandaloneApp, listenOnce, speechLang, type SpeechLog, type SpeechOutcome } from '../speech'
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
  useEffect(() => () => stopRef.current?.(), [])

  function start() {
    setAsking(false); setRun(null); setListening(true)
    const log: SpeechLog = [], t0 = Date.now()
    const { result, stop } = listenOnce({ lang: speechLang(), onEvent: e => log.push(e) })
    stopRef.current = stop
    void result.then(outcome => { stopRef.current = null; setListening(false); setRun({ outcome, ms: Date.now() - t0, log }) })
  }
  const tap = () => { if (listening) stopRef.current?.(); else if (!ack) setAsking(true); else start() }

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
