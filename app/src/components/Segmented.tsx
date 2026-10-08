import { transition, vtName } from '../viewTransition'

type Tone = 'hero' | 'villain' | 'neutral'

type Props<T extends string> = {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  label: string
  toneFor?: (v: T) => Tone
}

const ACTIVE_BG: Record<Tone, string> = { neutral: 'bg-app-text', hero: 'bg-hero', villain: 'bg-villain-bg' }
const ACTIVE_TEXT: Record<Tone, string> = { neutral: 'text-app-surface', hero: 'text-hero-on-accent', villain: 'text-villain-text' }

export function Segmented<T extends string>({ options, value, onChange, label, toneFor }: Props<T>) {
  return (
    <div role="group" aria-label={label} className="grid grid-flow-col auto-cols-fr gap-1 rounded-lg border border-app-border bg-app-surface p-1">
      {options.map(o => {
        const on = o.value === value
        const tone = toneFor?.(o.value) ?? 'neutral'
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => on || transition(() => onChange(o.value))}
            className={`relative min-h-11 rounded-md px-2 text-sm transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-text active:scale-[0.97] motion-reduce:transform-none ${
              on ? `${ACTIVE_TEXT[tone]} font-semibold` : 'font-medium text-app-muted hover:text-app-text'}`}
          >
            {/* el nombre (único por grupo) hace que la pastilla se deslice entre opciones */}
            {on && <span aria-hidden className={`absolute inset-0 rounded-md ${ACTIVE_BG[tone]}`} style={{ viewTransitionName: `seg-${vtName(label)}` }} />}
            {/* las etiquetas también llevan nombre para pintarse encima de la pastilla durante la transición */}
            <span className="relative" style={{ viewTransitionName: `seg-${vtName(label)}-${vtName(o.value)}` }}>{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
