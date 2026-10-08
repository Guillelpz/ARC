import { useRef } from 'react'
import { ArchiveRestore, ChevronRight, CircleAlert, Download, Moon, Plus, RotateCcw, Shield, Sparkles, Trash2, Upload, X } from 'lucide-react'
import type { Branch, GameState, PartyState, TodaySummary, Tracker } from '../core/types'
import type { CopyStatus } from '../core/storage'
import type { Screen } from './BottomNav'
import { weeklyXp } from '../core/rpg'
import { PlayerHeader } from './PlayerHeader'
const MEDAL = ['bg-gold', 'bg-silver', 'bg-bronze'] // mismo podio que PartyView

type Props = {
  game: GameState
  summary: TodaySummary
  partyStates: PartyState[]
  archived: Tracker[]
  onUnarchive: (t: Tracker) => void
  onNavigate: (s: Screen) => void
  onOpenParty: (id: string) => void
  onReset: () => void
  onLoadExample?: () => void
  onRestore?: () => void
  onExport: () => void
  onImport: (text: string) => void
  onImportError: () => void
  copy: CopyStatus
  notice: string | null
  onDismissNotice: () => void
}

const btn = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2'

const access = {
  hero: { Icon: Shield, label: 'HERO', tagline: 'El camino de la luz', cls: 'bg-hero-surface text-hero-text hover:bg-hero-bg outline-hero', accent: 'text-hero', muted: 'text-hero-muted' },
  villain: { Icon: Moon, label: 'VILLAIN', tagline: 'El camino de la sombra', cls: 'bg-villain-bg text-villain-text hover:bg-villain-surface outline-villain', accent: 'text-villain', muted: 'text-villain-muted' },
} as const

function TodayList({ rows, onGo }: { rows: { t: Tracker; text: string }[]; onGo: (s: Screen) => void }) {
  return (
    <ul className="divide-y divide-app-border rounded-lg border border-app-border">
      {rows.map(({ t, text }) => (
        <li key={t.id}>
          <button type="button" onClick={() => onGo(t.branch)}
            className="flex min-h-11 w-full items-center gap-3 px-3 text-left hover:bg-app-bg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-app-text">
            <span className="flex-1 text-sm font-semibold">{t.name}</span>
            <span className="text-sm text-app-muted tabular-nums">{text}</span>
            <ChevronRight className="size-4 shrink-0 text-app-muted" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  )
}

export function HomeView({ game, summary, partyStates, archived, onUnarchive, onNavigate, onOpenParty, onReset, onLoadExample, onRestore, onExport, onImport, onImportError, copy, notice, onDismissNotice }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const branchSummary = (b: Branch) => {
    return { count: game.trackers.filter(t => t.tracker.branch === b && !t.tracker.archived).length, weekXp: weeklyXp(game, b) }
  }

  return (
    <div className="min-h-dvh bg-app-bg text-app-text">
      <nav aria-label="Elige tu camino" className="relative grid min-h-[calc(100dvh-3.5rem)] grid-rows-2 sm:grid-cols-2 sm:grid-rows-1">
        {(['hero', 'villain'] as const).map(b => {
          const { Icon, label, cls, accent, muted, tagline } = access[b]
          const { count, weekXp } = branchSummary(b)
          return (
            <button key={b} type="button" onClick={() => onNavigate(b)}
              className={`group flex flex-col items-center justify-center gap-3 p-8 text-center transition duration-300 focus-visible:outline-2 focus-visible:-outline-offset-4 active:brightness-95 ${cls}`}>
              <Icon className={`size-14 transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none ${accent}`} strokeWidth={1.5} aria-hidden />
              <span className="text-3xl font-semibold tracking-wider sm:text-4xl">{label}</span>
              <span className={`text-sm ${muted}`}>{tagline}</span>
              <span className="text-sm font-semibold tabular-nums">
                Lv. {game[b].level} · {count} misiones · {weekXp} XP sem.
              </span>
            </button>
          )
        })}
        <span className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 rounded-full border border-app-border bg-app-surface px-3 py-1 text-sm font-semibold whitespace-nowrap tabular-nums shadow-sm">
          PLAYER Lv. {game.player.level}
        </span>
        <button type="button" onClick={() => onNavigate('new')} aria-label="Añadir actividad nueva"
          className="group absolute top-1/2 left-1/2 grid size-[72px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full shadow-lg transition duration-150 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-text motion-reduce:transition-none"
          style={{ background: 'conic-gradient(var(--color-hero-surface) 0 50%, var(--color-villain-bg) 0)' }}>
          <span className="grid size-[58px] place-items-center rounded-full bg-app-surface">
            <Plus className="size-7 transition-transform duration-150 group-hover:rotate-90 motion-reduce:transition-none" strokeWidth={2.5} aria-hidden />
          </span>
        </button>
      </nav>

      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-6 pb-28 sm:max-w-2xl lg:grid lg:max-w-4xl lg:grid-cols-2 lg:items-start">
        {notice && (
          <div role="status" className="flex items-start gap-3 rounded-xl border border-app-border bg-app-surface p-4 shadow-sm lg:col-span-2">
            <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
            <p className="flex-1 text-sm text-app-text">{notice}</p>
            <button type="button" onClick={onDismissNotice} aria-label="Cerrar aviso"
              className="-m-2 grid min-h-11 min-w-11 place-items-center rounded-lg hover:bg-app-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-text">
              <X className="size-4" aria-hidden />
            </button>
          </div>
        )}
        {onLoadExample && (
          <section className="flex flex-col gap-3 rounded-xl border border-app-border bg-app-surface p-4 shadow-sm sm:p-5 lg:col-span-2">
            <h2 className="text-lg font-semibold">Empieza tu historial</h2>
            <p className="text-sm leading-6">Registra tu primera actividad en HERO o VILLAIN. Si prefieres ver antes cómo funciona, carga un ejemplo de dos semanas; puedes borrarlo cuando quieras con «Borrar todo».</p>
            <button type="button" onClick={onLoadExample}
              className={`${btn} self-start border border-app-border bg-transparent text-app-text outline-app-text hover:bg-app-surface`}>
              Cargar ejemplo
            </button>
          </section>
        )}
        <section aria-labelledby="hoy" className="rise flex flex-col gap-3 rounded-xl border border-app-border bg-app-surface p-4 shadow-sm sm:p-5 lg:col-span-2">
          <h2 id="hoy" className="text-lg font-semibold">Hoy</h2>
          {summary.done.length === 0
            ? <p className="text-sm text-app-muted">Aún nada hoy.</p>
            : <p className="text-sm font-semibold tabular-nums text-app-text">
                {(['hero', 'villain'] as const).filter(b => summary.xp[b] !== 0)
                  .map(b => `${summary.xp[b] > 0 ? '+' : '−'}${Math.abs(summary.xp[b])} ${b.toUpperCase()}`).join(' · ')}
              </p>}
          {summary.done.length > 0 && (
            <>
              <h3 className="text-sm font-semibold">Registrado hoy</h3>
              <TodayList rows={summary.done.map(d => ({ t: d.tracker, text: `+${Math.round(d.amount)} ${d.tracker.unit}` }))} onGo={onNavigate} />
            </>
          )}
          {summary.missing.length > 0 && (
            <>
              <h3 className="text-sm font-semibold">Te faltan · {summary.daysLeft === 1 ? 'queda 1 día' : `quedan ${summary.daysLeft} días`}</h3>
              <TodayList rows={summary.missing.map(m => ({ t: m.tracker, text: `${Math.round(m.left)} ${m.tracker.unit}` }))} onGo={() => onNavigate('hero')} />
            </>
          )}
        </section>
        <div className="rise"><PlayerHeader game={game} /></div>

        <div className="rise flex flex-col gap-6" style={{ animationDelay: '80ms' }}>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Tus parties</h2>
            <ul className="divide-y divide-app-border overflow-hidden rounded-xl border border-app-border bg-app-surface shadow-sm">
              {partyStates.map(s => (
                <li key={s.party.id}>
                  <button type="button" onClick={() => onOpenParty(s.party.id)}
                    className="group flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left transition duration-150 hover:bg-app-bg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-app-text">
                    <span className={`grid size-10 shrink-0 place-items-center rounded-full text-base font-semibold tabular-nums text-app-text ${MEDAL[s.position - 1] ?? 'bg-app-track'}`}>
                      {s.position}.º
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{s.party.name}</span>
                        <span className="inline-flex items-center rounded-md border border-app-border px-2 py-0.5 text-xs font-medium text-app-muted">de ejemplo</span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        Lv. {s.game.player.level} · {s.position}.º de {s.ranking.length}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-app-muted transition duration-150 group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {archived.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">Archivadas</h2>
              <ul className="divide-y divide-app-border overflow-hidden rounded-xl border border-app-border bg-app-surface shadow-sm">
                {archived.map(t => (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">{t.name}</span>
                      <span className="inline-flex items-center rounded-md border border-app-border px-2 py-0.5 text-xs font-medium text-app-muted">{t.branch === 'hero' ? 'HERO' : 'VILLAIN'}</span>
                    </span>
                    <button type="button" onClick={() => onUnarchive(t)} aria-label={`Reactivar ${t.name}`}
                      className={`${btn} border border-app-border bg-transparent text-app-text outline-app-text hover:bg-app-bg`}>
                      <ArchiveRestore className="size-4" aria-hidden /> Reactivar
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <button type="button" onClick={() => onNavigate('new')}
            className={`${btn} w-full border border-app-border bg-transparent text-app-text outline-app-text hover:bg-app-surface`}>
            <Sparkles className="size-4" aria-hidden /> Añadir algo nuevo
          </button>

          <section aria-labelledby="tus-datos" className="flex flex-col gap-3 rounded-xl border border-app-border bg-app-surface p-4 shadow-sm sm:p-5">
            <h2 id="tus-datos" className="text-lg font-semibold">Tus datos</h2>
            {copy.due ? (
              <p className="flex items-start gap-2 text-sm leading-6 text-app-text">
                <CircleAlert className="mt-1 size-4 shrink-0" aria-hidden />
                {copy.days === null
                  ? 'Aún no has exportado ninguna copia. Tus datos solo están en este navegador.'
                  : `Tu última copia es de hace ${copy.days} días. Exporta otra para no perder lo reciente.`}
              </p>
            ) : (
              <p className="text-xs leading-5 text-app-muted">
                {copy.days === null ? 'Tus datos se guardan solo en este navegador.'
                  : copy.days === 0 ? 'Última copia: hoy.'
                  : `Última copia: hace ${copy.days} ${copy.days === 1 ? 'día' : 'días'}.`}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={onExport}
                className={`${btn} border border-app-border bg-transparent text-app-text outline-app-text hover:bg-app-bg`}>
                <Download className="size-4" aria-hidden /> Exportar copia
              </button>
              <button type="button" onClick={() => fileRef.current?.click()}
                className={`${btn} border border-app-border bg-transparent text-app-text outline-app-text hover:bg-app-bg`}>
                <Upload className="size-4" aria-hidden /> Importar copia
              </button>
              {onRestore && (
                <button type="button" onClick={onRestore}
                  className={`${btn} border border-app-border bg-transparent text-app-text outline-app-text hover:bg-app-bg`}>
                  <RotateCcw className="size-4" aria-hidden /> Recuperar copia anterior
                </button>
              )}
              <input ref={fileRef} type="file" accept=".json,application/json" hidden
                onChange={e => {
                  const input = e.currentTarget, file = input.files?.[0]
                  if (file) file.text().then(onImport, onImportError)
                  input.value = ''
                }} />
            </div>
            <button type="button" onClick={onReset}
              className="inline-flex min-h-11 items-center gap-1 self-start px-2 text-xs font-medium text-app-muted underline underline-offset-2 hover:text-app-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-text">
              <Trash2 className="size-4" aria-hidden /> Borrar todo
            </button>
          </section>
        </div>
      </main>
    </div>
  )
}
