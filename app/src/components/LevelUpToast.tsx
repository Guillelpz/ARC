import type { CSSProperties } from 'react'
import { ChevronsDown, Crown, Ghost, Sparkles, TrendingDown, TrendingUp, Zap } from 'lucide-react'
import type { RankMetric } from '../core/types'

export type Toast = { title: string; detail: string; key: string; tone: 'hero' | 'villain' | 'neutral'; down?: boolean }
export type Overtake = { key: string; party: string; names: string[]; position: number; lost?: RankMetric }

const THEME: Record<Toast['tone'], { glow: string; text: string; detail: string }> = {
  neutral: { glow: 'var(--color-gold)', text: 'text-app-text', detail: 'text-app-muted' },
  hero: { glow: 'var(--color-hero)', text: 'text-hero-text', detail: 'text-hero-muted' },
  villain: { glow: 'var(--color-villain)', text: 'text-villain-text', detail: 'text-villain-muted' },
}
const CARD: Record<Toast['tone'], string> = {
  neutral: 'border-gold bg-app-surface',
  hero: 'border-hero bg-hero-surface',
  villain: 'border-villain bg-villain-bg',
}
const SPARKS = Array.from({ length: 14 }, (_, i) => i * (360 / 14))
// fragmentos que caen: x en vw, retraso en ms y giro, repartidos de forma fija
const SHARDS = Array.from({ length: 16 }, (_, i) => ({ x: ((i * 37) % 60) - 30, d: 520 + ((i * 53) % 260), r: ((i * 71) % 300) - 150 }))

export function LevelUpToast({ toast }: { toast: Toast }) {
  const c = THEME[toast.tone]
  if (toast.down) return <LevelDownToast toast={toast} />
  return (
    <div key={toast.key} aria-hidden className="levelup-backdrop pointer-events-none fixed inset-0 z-50 grid place-items-center px-4"
      style={{ '--glow': c.glow } as CSSProperties}>
      <div className="levelup-rays absolute size-[140vmax]" aria-hidden />
      {SPARKS.map(a => (
        <span key={a} className="spark absolute size-2.5 rounded-full" style={{ '--a': `${a}deg` } as CSSProperties} aria-hidden />
      ))}
      <div className={`levelup-card relative flex flex-col items-center gap-2 rounded-xl border-2 px-8 py-6 text-center ${CARD[toast.tone]} ${c.text}`}>
        <Sparkles className="size-8" style={{ color: c.glow }} aria-hidden />
        <div className="text-4xl font-semibold tracking-wider sm:text-5xl">{toast.title.replace(' — ', '\n')}</div>
        {toast.detail && <div className={`max-w-xs text-sm leading-6 ${c.detail}`}>{toast.detail}</div>}
      </div>
    </div>
  )
}

// LEVEL DOWN: la tarjeta cae y se estrella, la pantalla tiembla, se agrieta y suelta fragmentos
function LevelDownToast({ toast }: { toast: Toast }) {
  const c = THEME[toast.tone]
  return (
    <div key={toast.key} aria-hidden className="leveldown-backdrop pointer-events-none fixed inset-0 z-50 grid place-items-center px-4"
      style={{ '--glow': c.glow } as CSSProperties}>
      {SHARDS.map((s, i) => (
        <span key={i} className="shard absolute size-3" aria-hidden
          style={{ '--x': `${s.x}vw`, '--r': `${s.r}deg`, animationDelay: `${s.d}ms` } as CSSProperties} />
      ))}
      <div className={`leveldown-card relative flex flex-col items-center gap-2 overflow-hidden rounded-xl border-2 px-8 py-6 text-center ${CARD[toast.tone]} ${c.text}`}>
        <TrendingDown className="size-8" style={{ color: c.glow }} aria-hidden />
        <div className="text-4xl font-semibold tracking-wider sm:text-5xl">{toast.title.replace(' — ', '\n')}</div>
        {toast.detail && <div className={`max-w-xs text-sm leading-6 ${c.detail}`}>{toast.detail}</div>}
        <svg className="crack absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <polyline points="38,0 46,22 36,38 52,55 44,72 58,100" pathLength="1" />
          <polyline points="46,22 70,30 82,24" pathLength="1" />
          <polyline points="52,55 28,64 14,60" pathLength="1" />
        </svg>
      </div>
    </div>
  )
}

export function OvertakeBanner({ o }: { o: Overtake }) {
  const lead = o.position === 1
  const Icon = lead ? Crown : TrendingUp
  return (
    <div key={o.key} aria-hidden className="banner-out vt-banner pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div className="slide-down shine flex items-center gap-3 rounded-xl border-2 border-gold bg-app-text px-5 py-3 text-app-surface shadow-xl">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gold text-app-text"><Icon className="size-5" aria-hidden /></span>
        <span className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wider text-gold">{lead ? 'Líder de la party' : 'Adelantamiento'}</span>
          <span className="text-sm font-semibold">Superas a {o.names.join(', ')} · {o.position}.º en {o.party}</span>
        </span>
      </div>
    </div>
  )
}

// Te superan: HERO = un rival pasa como un rayo y te empuja; VILLAIN = glitch; profundidad = bajas escalones
const PASSED: Record<RankMetric, { card: string; badge: string; label: string; muted: string; title: string; Icon: typeof Zap }> = {
  hero: { card: 'passed-hero border-hero bg-hero-surface text-hero-text', badge: 'bg-hero text-hero-on-accent', label: 'text-hero', muted: 'text-hero-muted', title: 'Te adelantan', Icon: Zap },
  villain: { card: 'passed-villain border-villain bg-villain-bg text-villain-text', badge: 'bg-villain text-villain-on-accent', label: 'text-villain', muted: 'text-villain-muted', title: 'Te superan en el lado oscuro', Icon: Ghost },
  depth: { card: 'passed-depth border-app-text bg-app-surface text-app-text', badge: 'bg-app-text text-app-surface', label: 'text-app-muted', muted: 'text-app-muted', title: 'Pierdes profundidad', Icon: ChevronsDown },
}
const RANK_NAME: Record<RankMetric, string> = { hero: 'HERO', villain: 'VILLAIN', depth: 'profundidad' }

export function PassedBanner({ o, lost }: { o: Overtake; lost: RankMetric }) {
  const t = PASSED[lost]
  return (
    <div key={o.key} aria-hidden className="banner-out vt-banner pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div className={`relative flex items-center gap-3 overflow-hidden rounded-xl border-2 px-5 py-3 shadow-xl ${t.card}`}>
        {lost === 'hero' && (
          <span className="zoom-by absolute inset-y-0 left-0 flex items-center gap-1" aria-hidden>
            <span className="speed-lines h-6 w-16" />
            <span className={`grid size-8 place-items-center rounded-full text-xs font-semibold ${t.badge}`}>{o.names[0][0]}</span>
          </span>
        )}
        <span className={`passed-icon grid size-10 shrink-0 place-items-center rounded-full ${t.badge}`}><t.Icon className="size-5" aria-hidden /></span>
        <span className="flex flex-col">
          <span className={`passed-title text-xs font-semibold uppercase tracking-wider ${t.label}`} data-text={t.title}>{t.title}</span>
          <span className="text-sm font-semibold">
            {o.names.join(', ')} te {o.names.length > 1 ? 'superan' : 'supera'} en {RANK_NAME[lost]} ·{' '}
            {lost === 'depth' && <s className={t.muted}>{o.position - o.names.length}.º</s>} {o.position}.º en {o.party}
          </span>
        </span>
      </div>
    </div>
  )
}

export function liveText(toast: Toast | null, o: Overtake | null): string {
  if (toast) return toast.detail ? `${toast.title}. ${toast.detail}` : toast.title
  if (!o) return ''
  const where = `${o.position}.º en ${o.party}`
  if (o.lost) return `${PASSED[o.lost].title}: ${o.names.join(', ')} te ${o.names.length > 1 ? 'superan' : 'supera'} en ${RANK_NAME[o.lost]} · ${where}`
  return `${o.position === 1 ? 'Líder de la party' : 'Adelantamiento'}: Superas a ${o.names.join(', ')} · ${where}`
}
