import { useState } from 'react'
import { Check, CircleAlert, Sparkles, X } from 'lucide-react'
import type { Branch, Classification, Party, Tracker, TrackerDraft, VoteResult } from '../core/types'
import { TYPE_DEFAULTS, buttonLabel, classifyAI, createTracker, findSimilar, isValidName, isValidUnit, normalizeText, trackerName } from '../core/classify'
import { vote } from '../core/party'
import { Segmented } from './Segmented'

type Props = {
  trackers: Tracker[]
  parties: Party[]
  onCreate: (t: Tracker) => void
  onAdd: (t: Tracker, amount: number) => void
  onPropose: (trackerId: string, partyIds: string[]) => void
  onGoToMissions: (b: Branch) => void
}

type Step = 'write' | 'proposal' | 'parties' | 'result'

const BTN = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
const PRESS = 'active:scale-[0.98] motion-reduce:transform-none'
const NEUTRAL = `${BTN} ${PRESS} bg-app-text text-app-surface hover:bg-app-text/90 outline-app-text`
const SECONDARY = `${BTN} border border-app-border bg-transparent text-app-text hover:bg-app-surface outline-app-text`
const BRANCH_BTN: Record<Branch, string> = {
  hero: `${BTN} ${PRESS} bg-hero text-hero-on-accent hover:bg-hero/90 outline-hero`,
  villain: `${BTN} ${PRESS} bg-villain text-villain-on-accent hover:bg-villain/90 outline-villain`,
}
// paleta entera de la tarjeta de propuesta según la rama
const CARD: Record<Branch, { box: string; muted: string; border: string; secondary: string; input: string }> = {
  hero: {
    box: 'bg-hero-surface text-hero-text border-hero-border',
    muted: 'text-hero-muted',
    border: 'border-hero-border',
    secondary: `${BTN} border border-hero-border bg-transparent text-hero-text hover:bg-hero-bg outline-hero`,
    input: 'border-hero-border bg-hero-bg text-hero-text outline-hero',
  },
  villain: {
    box: 'bg-villain-surface text-villain-text border-villain-border',
    muted: 'text-villain-muted',
    border: 'border-villain-border',
    secondary: `${BTN} border border-villain-border bg-transparent text-villain-text hover:bg-villain-bg outline-villain`,
    input: 'border-villain-border bg-villain-bg text-villain-text outline-villain',
  },
}
const LABEL = { hero: 'HERO', villain: 'VILLAIN' } as const
const TYPES: { value: Tracker['type']; label: string }[] = [
  { value: 'count', label: 'Veces' },
  { value: 'distance', label: 'Km' },
  { value: 'duration', label: 'Min' },
  { value: 'custom', label: 'Otro' },
]

export function UnknownView({ trackers, parties, onCreate, onAdd, onPropose, onGoToMissions }: Props) {
  const [step, setStep] = useState<Step>('write')
  const [text, setText] = useState('')
  const [ai, setAi] = useState<Classification | null>(null)
  const [draft, setDraft] = useState<TrackerDraft | null>(null)
  const [created, setCreated] = useState<Tracker | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [results, setResults] = useState<VoteResult[]>([])
  const [skipped, setSkipped] = useState(false)
  const [loading, setLoading] = useState(false)

  const valid = isValidName(text)
  const dup = trackers.find(t => normalizeText(t.name) === normalizeText(text)) // = isDuplicateName, pero necesitamos el nombre
  const canAnalyze = valid && !dup
  const similar = dup ?? (valid ? findSimilar(text, trackers) : undefined)

  async function analyze() {
    if (!canAnalyze || loading) return
    setLoading(true)
    const c = await classifyAI(text, trackers)
    setLoading(false)
    setAi(c)
    setDraft({ name: trackerName(text), branch: c.branch, type: c.type, xpPerUnit: c.xpPerUnit })
    setStep('proposal')
  }

  function create() {
    if (!draft || (draft.type === 'custom' && !isValidUnit(draft.unit ?? ''))) return
    const t = createTracker(draft, `custom-${crypto.randomUUID()}`)
    onCreate(t)
    setCreated(t)
    setSelected([])
    setSkipped(false)
    setStep('parties')
  }

  function propose() {
    if (!created || selected.length === 0) return
    onPropose(created.id, selected)
    setResults(parties.filter(p => selected.includes(p.id)).map(p => vote(created.branch, p)))
    setStep('result')
  }

  function restart() {
    setText(''); setAi(null); setDraft(null); setCreated(null); setSelected([]); setResults([]); setSkipped(false)
    setStep('write')
  }

  const goButton = (b: Branch) => (
    <button type="button" className={BRANCH_BTN[b]} onClick={() => onGoToMissions(b)}>Ir a Misiones {LABEL[b]}</button>
  )

  return (
    <div className="min-h-dvh bg-app-bg text-app-text">
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-6 pb-28 sm:max-w-2xl lg:max-w-4xl">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Desconocido</h1>
          <p className="text-sm text-app-muted">Añade algo nuevo a tu personaje</p>
        </header>

        <div className="flex w-full max-w-xl flex-col gap-6">
          {step === 'write' && (
            <form className="rise flex flex-col gap-3" onSubmit={e => { e.preventDefault(); analyze() }}>
              <label htmlFor="new-activity" className="text-lg font-semibold">¿Qué has hecho?</label>
              <input
                id="new-activity"
                value={text}
                onChange={e => setText(e.target.value)}
                readOnly={loading}
                maxLength={60}
                autoComplete="off"
                placeholder="comer pizza a las 3am"
                aria-describedby="new-activity-help"
                aria-invalid={text.trim() !== '' && !canAnalyze}
                className="min-h-11 rounded-lg border border-app-border bg-app-surface px-3 text-sm text-app-text placeholder:text-app-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-text"
              />
              <p id="new-activity-help" className="text-xs leading-5 text-app-muted">
                {similar ? (
                  <span className="inline-flex items-center gap-1 text-app-text">
                    <CircleAlert className="size-4" aria-hidden="true" /> {dup ? 'Ya tienes' : 'Se parece a'} «{similar.name}»
                  </span>
                ) : '2–40 caracteres'}
              </p>
              {similar && (
                <button type="button" className={BRANCH_BTN[similar.branch]}
                  onClick={() => { onAdd(similar, similar.increment); onGoToMissions(similar.branch) }}>
                  Sumar a {similar.name} · {similar.buttonLabel}
                </button>
              )}
              <button type="submit" disabled={!canAnalyze || loading} aria-busy={loading} className={NEUTRAL}>
                <Sparkles className={`size-4 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" /> {loading ? 'Analizando…' : 'Analizar con IA'}
              </button>
            </form>
          )}

          {step === 'proposal' && ai && draft && (() => {
            const c = CARD[draft.branch]
            const { increment } = TYPE_DEFAULTS[draft.type]
            const isCustom = draft.type === 'custom'
            const unitOk = !isCustom || isValidUnit(draft.unit ?? '')
            const unit = isCustom ? (draft.unit ?? '').trim() || 'unidades' : TYPE_DEFAULTS[draft.type].unit
            const low = ai.confidence === 'baja'
            const match = trackers.find(t => t.id === ai.matchId)
            return (
              <section aria-labelledby="ai-title" className={`rise flex flex-col gap-3 rounded-xl border p-4 shadow-sm transition duration-150 sm:p-5 ${c.box} ${low ? 'border-dashed' : ''}`}>
                <h2 id="ai-title" className="text-lg font-semibold">La IA propone: {LABEL[ai.branch]}</h2>
                <span className={`inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-xs font-medium ${c.border} ${c.muted}`}>
                  Confianza {ai.confidence}
                </span>
                <p className="text-sm leading-6 font-semibold">{draft.name}</p>
                {!low && <p className={`text-xs leading-5 ${c.muted}`}>{ai.reason}</p>}
                {match && (
                  <>
                    <p className="inline-flex items-center gap-1 text-sm">
                      <CircleAlert className="size-4" aria-hidden="true" /> Se parece a «{match.name}»
                    </p>
                    <button type="button" className={BRANCH_BTN[match.branch]}
                      onClick={() => { onAdd(match, match.increment); onGoToMissions(match.branch) }}>
                      Sumar a {match.name} · {match.buttonLabel}
                    </button>
                  </>
                )}

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wider">Rama</span>
                  {low && (
                    <p className="inline-flex items-center gap-1 text-sm">
                      <CircleAlert className="size-4" aria-hidden="true" /> {ai.reason}
                    </p>
                  )}
                  <Segmented<Branch>
                    label="Rama"
                    options={[{ value: 'hero', label: 'HERO' }, { value: 'villain', label: 'VILLAIN' }]}
                    value={draft.branch}
                    onChange={branch => setDraft({ ...draft, branch })}
                    toneFor={v => v}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wider">Tipo</span>
                  <Segmented<Tracker['type']>
                    label="Tipo"
                    options={TYPES}
                    value={draft.type}
                    onChange={type => setDraft({ ...draft, type, xpPerUnit: TYPE_DEFAULTS[type].xpPerUnit })}
                  />
                </div>

                {isCustom && (
                  <label className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wider">Unidad</span>
                    <input
                      value={draft.unit ?? ''}
                      onChange={e => setDraft({ ...draft, unit: e.target.value })}
                      maxLength={20}
                      autoComplete="off"
                      placeholder="páginas"
                      aria-invalid={!unitOk}
                      className={`min-h-11 w-40 rounded-lg border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 ${c.input}`}
                    />
                  </label>
                )}

                <label className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wider">XP por unidad</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    step={1}
                    value={draft.xpPerUnit}
                    onChange={e => setDraft({ ...draft, xpPerUnit: Number(e.target.value) })}
                    className={`min-h-11 w-24 rounded-lg border px-3 text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 ${c.input}`}
                  />
                </label>

                <div className="flex items-center justify-between gap-3">
                  <span className={`text-xs leading-5 ${c.muted}`}>Vista previa:</span>
                  <span aria-hidden="true" className={`${BRANCH_BTN[draft.branch]} pointer-events-none`}>
                    {buttonLabel(unit, increment)} · {increment * Math.min(50, Math.max(1, Math.round(draft.xpPerUnit) || 1))} XP
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button type="button" className={c.secondary} onClick={() => setStep('write')}>Volver</button>
                  <button type="button" className={BRANCH_BTN[draft.branch]} onClick={create} disabled={!unitOk}>Crear misión</button>
                </div>
              </section>
            )
          })()}

          {step === 'parties' && created && (
            <div className="rise flex flex-col gap-6">
              <p aria-live="polite" className="text-sm leading-6">
                Misión creada: <span className="font-semibold">{created.name}</span>. Ya cuenta en tu personaje.
              </p>
              {skipped ? (
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" className={SECONDARY} onClick={restart}>Añadir otra</button>
                  {goButton(created.branch)}
                </div>
              ) : (
                <form className="flex flex-col gap-3" onSubmit={e => { e.preventDefault(); propose() }}>
                  <fieldset className="flex flex-col gap-1">
                    <legend className="mb-2 text-lg font-semibold">¿A qué parties la propones?</legend>
                    {parties.map(p => (
                      <label key={p.id} className="flex min-h-11 items-center gap-3 text-sm">
                        <input
                          type="checkbox"
                          className="size-5 accent-app-text"
                          checked={selected.includes(p.id)}
                          onChange={e => setSelected(s => e.target.checked ? [...s, p.id] : s.filter(id => id !== p.id))}
                        />
                        {p.name}
                      </label>
                    ))}
                  </fieldset>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" className={SECONDARY} onClick={() => setSkipped(true)}>Ahora no</button>
                    <button type="submit" className={NEUTRAL} disabled={selected.length === 0}>Proponer</button>
                  </div>
                </form>
              )}
            </div>
          )}

          {step === 'result' && created && (
            <div className="rise flex flex-col gap-6">
              <div aria-live="polite" className="flex flex-col rounded-xl border border-app-border bg-app-surface p-4 shadow-sm sm:p-5">
                {results.map((r, i) => (
                  <div key={r.partyId} style={{ animationDelay: `${150 + i * 120}ms` }} className={`rise flex flex-col gap-1 py-3 ${i > 0 ? 'border-t border-app-border' : ''}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">{parties.find(p => p.id === r.partyId)?.name}</span>
                      <span className="text-sm font-semibold tabular-nums">{r.accepted ? 'Aceptada' : 'Rechazada'} {r.yes}/{r.total}</span>
                    </div>
                    <p className="flex flex-wrap items-center gap-x-1 text-xs leading-5 text-app-muted">
                      {r.votes.map((v, j) => (
                        <span key={v.name} className="inline-flex items-center gap-1">
                          {j > 0 && <span aria-hidden="true">·</span>}
                          {v.name}
                          {v.yes ? <Check className="size-4" aria-hidden="true" /> : <X className="size-4" aria-hidden="true" />}
                          <span className="sr-only">{v.yes ? 'sí' : 'no'}</span>
                        </span>
                      ))}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-sm leading-6 text-app-muted">
                En las parties que la aceptaron, tus registros de {created.name} suman XP; en el resto, solo a tu personaje.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" className={SECONDARY} onClick={restart}>Añadir otra</button>
                {goButton(created.branch)}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
