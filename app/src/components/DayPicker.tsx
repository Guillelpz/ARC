import { addDays } from '../core/stats'

const SEG = {
  hero: { ring: 'outline-hero', box: 'border-hero-border bg-hero-surface', opt: 'text-hero-muted', on: 'bg-hero text-hero-on-accent font-semibold', scheme: 'scheme-light', muted: 'text-hero-muted' },
  villain: { ring: 'outline-villain', box: 'border-villain-border bg-villain-surface', opt: 'text-villain-muted', on: 'bg-villain text-villain-on-accent font-semibold', scheme: 'scheme-dark', muted: 'text-villain-muted' },
}

// Selector Hoy / Ayer / fecha (sin futuro) de las pantallas de registro.
export function DayPicker({ day, today, onChange, tone }: { day: string; today: string; onChange: (d: string) => void; tone: 'hero' | 'villain' }) {
  const yesterday = addDays(today, -1)
  const c = SEG[tone]
  const optCls = (active: boolean) => `min-h-11 rounded-md text-sm focus-visible:outline-2 focus-visible:outline-offset-2 ${c.ring} ${active ? c.on : `font-medium ${c.opt}`}`
  return (
    <div className="flex flex-col gap-1">
      <span className={`text-xs leading-5 ${c.muted}`}>Registrar en</span>
      <div className={`grid grid-flow-col auto-cols-fr gap-1 rounded-lg border p-1 ${c.box}`}>
        <button type="button" aria-pressed={day === today} onClick={() => onChange(today)} className={optCls(day === today)}>Hoy</button>
        <button type="button" aria-pressed={day === yesterday} onClick={() => onChange(yesterday)} className={optCls(day === yesterday)}>Ayer</button>
        <input type="date" max={today} value={day} aria-label="Elegir día"
          onChange={e => onChange(e.target.value && e.target.value <= today ? e.target.value : today)}
          className={`${optCls(day !== today && day !== yesterday)} min-w-0 bg-transparent text-center ${c.scheme}`} />
      </div>
    </div>
  )
}
