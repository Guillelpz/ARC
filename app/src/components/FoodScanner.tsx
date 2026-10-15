import { useEffect, useRef, useState } from 'react'
import { Camera, CircleAlert } from 'lucide-react'
import { normEan } from '../core/off'
import { hasCamera, makeDetector } from '../scan'
import { primary, secondary } from './foodStyle'

type Phase = 'idle' | 'loading' | 'on' | 'paused'
type Detector = Awaited<ReturnType<typeof makeDetector>>
type Props = {
  onCode: (ean: string) => void       // primer EAN válido: ya se han parado las pistas
  onError: (text: string) => void     // el padre muestra el mensaje y enfoca el campo
}


const DENIED = 'Sin permiso para la cámara. Teclea el código.'
const NO_CAM = 'No hay cámara disponible. Teclea el código.'
const NO_READER = 'No se ha podido cargar el lector. Teclea el código.'

// Escáner con cámara: el permiso se pide en el clic (antes de cargar el lector) y las pistas se paran al cancelar, detectar, ocultar la pestaña o desmontar.
export function FoodScanner({ onCode, onError }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [det, setDet] = useState<Detector | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const run = useRef(0)
  const cb = useRef({ onCode, onError })
  useEffect(() => { cb.current = { onCode, onError } })

  const stop = () => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null }
  const cancel = () => { run.current++; stop(); setPhase('idle') }
  useEffect(() => () => { run.current++; streamRef.current?.getTracks().forEach(t => t.stop()) }, [])

  async function start() {
    if (!hasCamera()) return
    const id = ++run.current
    setPhase('loading')
    const media = navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    const detector = makeDetector()
    detector.catch(() => undefined)
    let stream: MediaStream
    try { stream = await media } catch (e) {
      if (id !== run.current) return
      setPhase('idle')
      return cb.current.onError((e as { name?: string })?.name === 'NotAllowedError' ? DENIED : NO_CAM)
    }
    if (id !== run.current) { stream.getTracks().forEach(t => t.stop()); return }
    streamRef.current = stream
    let d: Detector
    try { d = await detector } catch {
      if (id !== run.current) return
      stop(); setPhase('idle')
      return cb.current.onError(NO_READER)
    }
    if (id !== run.current) return
    setDet(d); setPhase('on')
  }

  useEffect(() => {
    if (phase !== 'on' || !det) return
    const v = videoRef.current
    if (v) { v.srcObject = streamRef.current; void v.play?.()?.catch(() => undefined) }
    let off = false, t: ReturnType<typeof setTimeout>
    const tick = async () => {
      let code: string | null = null
      try { for (const c of await det.detect(v!)) { code = normEan(c); if (code) break } } catch { /* fotograma no listo: se reintenta */ }
      if (off) return
      if (code) { run.current++; stop(); setPhase('idle'); cb.current.onCode(code) }
      else t = setTimeout(tick, 250)
    }
    t = setTimeout(tick, 250)
    return () => { off = true; clearTimeout(t) }
  }, [phase, det])

  // También durante la carga: invalida el start() en curso, que parará las pistas en cuanto lleguen.
  const live = phase === 'loading' || phase === 'on'
  useEffect(() => {
    if (!live) return
    const hide = () => { if (document.hidden) { run.current++; stop(); setPhase('paused') } }
    document.addEventListener('visibilitychange', hide)
    return () => document.removeEventListener('visibilitychange', hide)
  }, [live])

  if (phase === 'idle') return <button type="button" onClick={() => void start()} className={`${secondary} self-start`}><Camera className="size-4" aria-hidden />Escanear con la cámara</button>
  if (phase === 'paused') return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="flex items-center gap-2 text-sm text-hero-muted"><CircleAlert className="size-4 shrink-0" aria-hidden />Cámara en pausa.</p>
      <button type="button" onClick={() => void start()} className={primary}>Reanudar cámara</button>
      <button type="button" onClick={cancel} className={secondary}>Cancelar</button>
    </div>
  )
  return (
    <div className="flex flex-col gap-2">
      <video ref={videoRef} playsInline muted autoPlay aria-label="Vista de la cámara" className="aspect-video w-full rounded-lg border border-hero-border bg-hero-surface object-cover" />
      <p role="status" className="text-sm text-hero-muted">{phase === 'loading' ? 'Abriendo la cámara…' : 'Apunta al código de barras'}</p>
      <button type="button" onClick={cancel} className={`${secondary} self-start`}>Cancelar</button>
    </div>
  )
}
