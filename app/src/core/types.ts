export type Branch = 'hero' | 'villain'

export type Tracker = {
  id: string
  name: string
  branch: Branch
  type: 'count' | 'distance' | 'duration' | 'custom'
  unit: string
  increment: number
  buttonLabel: string
  xpPerUnit: number
  weeklyGoal?: number
  custom?: true
}

export type ActivityEvent = {
  id: string
  trackerId: string
  amount: number
  occurredAt: string // 'YYYY-MM-DDTHH:mm:ss' local, sin zona
  undoes?: string    // id del evento positivo que este negativo deshace
}

export type HistoryRow = { event: ActivityEvent; undone: boolean; canUndo: boolean }

export type LevelInfo = {
  xp: number
  level: number
  xpInLevel: number
  threshold: number
  progress: number
}

export type TrackerStats = {
  tracker: Tracker
  week: number
  prev: number
  diff: number
  allTime: number
  goalPct: number | null
  xp: LevelInfo
}

export type GameState = {
  trackers: TrackerStats[]
  hero: LevelInfo
  villain: LevelInfo
  player: LevelInfo
  heroPct: number | null
  weeklyHeroXp: number
}

export type PartyMember = {
  id: string
  name: string
  isYou?: boolean
  playerLevel: number
  heroLevel: number
  villainLevel: number
  weeklyHeroXp: number
  weeklyVillainXp: number
}

export type RankMetric = 'hero' | 'villain' | 'depth'

export type Friend = PartyMember & { stance: Record<Branch, boolean> }
export type Party = { id: string; name: string; members: Friend[]; seedCriteria: string[] }

export type Proposal = { trackerId: string; partyId: string; proposedAt: string } // 'YYYY-MM-DDTHH:mm:ss'
export type CustomData = { trackers: Tracker[]; proposals: Proposal[] }

export type VoteResult = {
  partyId: string
  accepted: boolean
  yes: number
  total: number
  votes: { name: string; yes: boolean }[]
}

export type PartyState = {
  party: Party
  game: GameState
  criteria: Tracker[]
  rejected: { tracker: Tracker; result: VoteResult }[]
  ranking: PartyMember[]
  position: number
}

export type Confidence = 'alta' | 'media' | 'baja'
export type Classification = {
  branch: Branch
  confidence: Confidence
  reasons: string[]
  reason: string
  type: Tracker['type']
  unit: string
  increment: number
  xpPerUnit: number
  matchId?: string // actividad existente equivalente (sinónimo, otro idioma, errata)
}
export type TrackerDraft = { name: string; branch: Branch; type: Tracker['type']; xpPerUnit: number; unit?: string }
