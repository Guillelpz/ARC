type Tone = 'hero' | 'villain' | 'neutral'
type Props = { value: number; tone: Tone; thin?: boolean; label: string }

const fill: Record<Tone, string> = { hero: 'bg-hero', villain: 'bg-villain', neutral: 'bg-app-text' }
const track: Record<Tone, string> = { hero: 'bg-hero-track', villain: 'bg-villain-track', neutral: 'bg-app-track' }

// value: 0..1, se limita aquí solo el ancho visual
export function ProgressBar({ value, tone, thin, label }: Props) {
  const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100)
  return (
    <div
      role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
      className={`w-full overflow-hidden rounded-full ${track[tone]} ${thin ? 'h-1' : 'h-2'}`}
    >
      <div className={`bar-fill h-full w-full rounded-full ${fill[tone]}`} style={{ transform: `translateX(${pct - 100}%)` }} />
    </div>
  )
}
