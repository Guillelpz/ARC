import { useState } from 'react'
import { CircleAlert, Eye, EyeOff, KeyRound } from 'lucide-react'
import type { HaikuError } from '../core/haiku'
import { isIosStandalone } from '../speech'
import { VT } from './voiceTone'
import { TEST_TEXT } from './aiKeyText'

export type KeySave = 'ok' | 'format' | 'save'

// Clave de Anthropic de este dispositivo. Solo recibe los últimos 4 caracteres de la guardada (`hint`): nunca la entera.
export function AiKeySettings({ hint, invalid, onSave, onClear, onTest }: {
  hint: string | null; invalid: boolean
  onSave: (key: string) => KeySave; onClear: () => void; onTest: () => Promise<HaikuError | 'ok'>
}) {
  const t = VT.app
  const [value, setValue] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [testing, setTesting] = useState(false)

  function save() {
    const r = onSave(value)
    if (r === 'ok') { setValue(''); setShow(false); setError(null); setStatus('Clave guardada.') }
    else setError(r === 'format' ? 'La clave debe empezar por sk-ant-.' : 'No se ha podido guardar la clave en este navegador.')
  }
  async function test() {
    setTesting(true); setStatus('Probando…')
    const r = await onTest()
    setTesting(false); setStatus(TEST_TEXT[r])
  }
  function clear() {
    if (!window.confirm('¿Borrar la clave de Anthropic de este dispositivo? La voz seguirá funcionando sin IA.')) return
    onClear(); setStatus('Clave borrada.')
  }

  return (
    <div className="flex flex-col gap-3">
      <p className={`text-sm leading-6 ${t.muted}`}>
        Opcional. Con una clave, Haiku interpreta lo que dictas; sin ella se usa el intérprete del dispositivo. La clave se guarda solo en este navegador y no entra en las copias. Crea una clave solo para esta app con un límite de gasto bajo.
        {isIosStandalone() && ' En el iPhone, la app instalada no comparte datos con Safari: pega aquí la clave.'}
      </p>
      {hint === null ? (
        <>
          {invalid && <p className={`flex items-start gap-2 text-sm ${t.text}`}><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />La clave guardada no es válida. Bórrala y pega otra.</p>}
          <form onSubmit={e => { e.preventDefault(); save() }} className="flex flex-col gap-2">
            <label htmlFor="ai-key" className="text-sm font-medium">Clave</label>
            <div className="flex gap-2">
              <input id="ai-key" type={show ? 'text' : 'password'} value={value} onChange={e => { setValue(e.target.value); setError(null) }}
                autoComplete="off" spellCheck={false} autoCapitalize="off" aria-invalid={error ? true : undefined} aria-describedby={error ? 'ai-key-error' : undefined}
                className={`${t.field} min-w-0 flex-1`} />
              <button type="button" onClick={() => setShow(s => !s)} aria-pressed={show} className={t.secondary}>
                {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}{show ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            {error && <p id="ai-key-error" className={`flex items-start gap-2 text-sm ${t.text}`}><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />{error}</p>}
            <button type="submit" className={`${t.primary} self-start`}><KeyRound className="size-4" aria-hidden />Guardar clave</button>
          </form>
          {invalid && <button type="button" onClick={clear} className={`${t.link} self-start`}>Borrar clave</button>}
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <p className={`flex items-center gap-2 text-sm ${t.text}`}><KeyRound className="size-4 shrink-0" aria-hidden />Clave guardada: termina en {hint}</p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void test()} disabled={testing} className={t.secondary}>Probar clave</button>
            <button type="button" onClick={clear} className={t.link}>Borrar clave</button>
          </div>
        </div>
      )}
      <p role="status" className={`text-sm ${t.muted}`}>{status}</p>
    </div>
  )
}
