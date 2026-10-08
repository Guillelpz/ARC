import type { ActivityEvent, Branch, GameState, Party, PartyMember, PartyState, Proposal, RankMetric, Tracker, VoteResult } from './types'
import { deriveGame, weeklyXp } from './rpg'
import { daysLeftInWeek } from './stats'

export const PARTIES: Party[] = [
  { id: 'los-del-gym', name: 'Los del Gym', seedCriteria: ['gym', 'bjj', 'running', 'reading', 'beer', 'burgers'], members: [
    { id: 'carlos', name: 'Carlos', playerLevel: 8, heroLevel: 9, villainLevel: 2, weeklyHeroXp: 515, weeklyVillainXp: 30, stance: { hero: true, villain: false } },
    { id: 'alex', name: 'Alex', playerLevel: 6, heroLevel: 6, villainLevel: 2, weeklyHeroXp: 350, weeklyVillainXp: 150, stance: { hero: true, villain: true } },
    { id: 'dani', name: 'Dani', playerLevel: 5, heroLevel: 4, villainLevel: 3, weeklyHeroXp: 220, weeklyVillainXp: 210, stance: { hero: true, villain: true } },
  ] },
  { id: 'la-oficina', name: 'La Oficina', seedCriteria: ['running', 'reading', 'burgers'], members: [
    { id: 'lucia', name: 'Lucía', playerLevel: 4, heroLevel: 4, villainLevel: 1, weeklyHeroXp: 240, weeklyVillainXp: 15, stance: { hero: true, villain: false } },
    { id: 'marta', name: 'Marta', playerLevel: 3, heroLevel: 3, villainLevel: 1, weeklyHeroXp: 160, weeklyVillainXp: 45, stance: { hero: true, villain: false } },
    { id: 'pablo', name: 'Pablo', playerLevel: 2, heroLevel: 2, villainLevel: 1, weeklyHeroXp: 120, weeklyVillainXp: 120, stance: { hero: true, villain: true } },
  ] },
]

export function vote(branch: Branch, party: Party): VoteResult {
  const votes = party.members.map(m => ({ name: m.name, yes: m.stance[branch] }))
  const yes = votes.filter(v => v.yes).length
  const total = votes.length
  return { partyId: party.id, accepted: yes * 2 > total, yes, total, votes }
}

// tracker propuesto a esta party (si existe)
const proposedTracker = (p: Proposal, party: Party, trackers: Tracker[]) =>
  p.partyId === party.id ? trackers.find(t => t.id === p.trackerId) : undefined

export function partyCriteria(party: Party, trackers: Tracker[], proposals: Proposal[]): Tracker[] {
  const ids = new Set(party.seedCriteria)
  for (const p of proposals) {
    const t = proposedTracker(p, party, trackers)
    if (t && vote(t.branch, party).accepted) ids.add(t.id)
  }
  return trackers.filter(t => ids.has(t.id))
}

export function proposeTo(proposals: Proposal[], trackerId: string, partyIds: string[], trackers: Tracker[], now: string): Proposal[] {
  const next = [...proposals]
  if (!trackers.some(t => t.id === trackerId)) return next
  for (const partyId of partyIds) {
    const party = PARTIES.find(p => p.id === partyId)
    if (!party || next.some(p => p.trackerId === trackerId && p.partyId === partyId)) continue
    if (partyCriteria(party, trackers, next).some(t => t.id === trackerId)) continue
    next.push({ trackerId, partyId, proposedAt: now })
  }
  return next
}

// depth = profundidad de personaje: HERO + VILLAIN semanal
export const rankScore = (m: PartyMember, metric: RankMetric): number =>
  metric === 'hero' ? m.weeklyHeroXp : metric === 'villain' ? m.weeklyVillainXp : m.weeklyHeroXp + m.weeklyVillainXp

// ponytail: amigos simulados a ritmo lineal (semanal × días transcurridos / 7; lun 1/7 … dom 7/7).
// Se sustituye por su XP semanal real cuando haya PARTY real (P3.5).
const paced = (m: PartyMember, today: string): PartyMember => {
  const d = 8 - daysLeftInWeek(today)
  return { ...m, weeklyHeroXp: Math.round(m.weeklyHeroXp * d / 7), weeklyVillainXp: Math.round(m.weeklyVillainXp * d / 7) }
}

export function buildRanking(game: GameState, members: PartyMember[], metric: RankMetric, today: string): PartyMember[] {
  const you: PartyMember = {
    id: 'you', name: 'Tú', isYou: true,
    playerLevel: game.player.level, heroLevel: game.hero.level, villainLevel: game.villain.level,
    weeklyHeroXp: game.weeklyHeroXp, weeklyVillainXp: weeklyXp(game, 'villain'),
  }
  // usuario primero: sort estable => gana empates
  return [you, ...members.map(m => paced(m, today))].sort((a, b) => rankScore(b, metric) - rankScore(a, metric))
}

export function derivePartyState(party: Party, events: ActivityEvent[], today: string, trackers: Tracker[], proposals: Proposal[]): PartyState {
  const criteria = partyCriteria(party, trackers, proposals)
  const game = deriveGame(events, today, criteria)
  const rejected = proposals.flatMap(p => {
    const tracker = proposedTracker(p, party, trackers)
    if (!tracker) return []
    const result = vote(tracker.branch, party)
    return result.accepted ? [] : [{ tracker, result }]
  })
  const ranking = buildRanking(game, party.members, 'hero', today)
  return { party, game, criteria, rejected, ranking, position: ranking.findIndex(r => r.isYou) + 1 }
}

export const countsIn = (trackerId: string, states: PartyState[]): string[] =>
  states.filter(s => s.criteria.some(t => t.id === trackerId)).map(s => s.party.name)

// nombres de quienes iban detrás de ti en `before` y van delante en `after`
export function overtakes(before: PartyMember[], after: PartyMember[]): string[] {
  const behind = new Set(before.slice(before.findIndex(m => m.isYou) + 1).map(m => m.id))
  return after.slice(0, after.findIndex(m => m.isYou)).filter(m => behind.has(m.id)).map(m => m.name)
}
