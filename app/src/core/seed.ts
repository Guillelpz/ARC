import type { ActivityEvent } from './types'

export const DEMO_DATE = '2026-10-07'

const ev = (n: number, date: string, trackerId: string, amount = 1): ActivityEvent =>
  ({ id: `seed-${String(n).padStart(2, '0')}`, trackerId, amount, occurredAt: `${date}T09:00:00` })

export const SEED_EVENTS: ActivityEvent[] = [
  ev(1, '2026-09-28', 'gym'), ev(2, '2026-09-28', 'bjj'), ev(3, '2026-09-28', 'running', 5), ev(4, '2026-09-28', 'reading', 30), ev(5, '2026-09-28', 'burgers'),
  ev(6, '2026-09-29', 'reading', 30),
  ev(7, '2026-09-30', 'gym'), ev(8, '2026-09-30', 'bjj'), ev(9, '2026-09-30', 'running', 7), ev(10, '2026-09-30', 'beer'), ev(11, '2026-09-30', 'beer'), ev(12, '2026-09-30', 'burgers'),
  ev(13, '2026-10-05', 'gym'), ev(14, '2026-10-05', 'bjj'), ev(15, '2026-10-05', 'running', 4), ev(16, '2026-10-05', 'reading', 30),
  ev(17, '2026-10-06', 'gym'), ev(18, '2026-10-06', 'running', 6), ev(19, '2026-10-06', 'reading', 30), ev(20, '2026-10-06', 'beer'), ev(21, '2026-10-06', 'beer'), ev(22, '2026-10-06', 'burgers'),
  ev(23, '2026-10-07', 'gym'), ev(24, '2026-10-07', 'bjj'), ev(25, '2026-10-07', 'running', 8), ev(26, '2026-10-07', 'reading', 30), ev(27, '2026-10-07', 'beer'), ev(28, '2026-10-07', 'beer'),
]
