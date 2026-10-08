import { useEffect, useMemo, useState } from 'react'
import { transition } from './viewTransition'
import type { ActivityEvent, CustomData, Tracker } from './core/types'
import { DEMO_DATE, SEED_EVENTS } from './core/seed'
import { EMPTY_CUSTOM, loadCustom, loadEvents, saveCustom, saveEvents } from './core/storage'
import { deriveGame, diffLevelDowns, diffLevelUps } from './core/rpg'
import { allTrackers } from './core/trackers'
import { PARTIES, buildRanking, derivePartyState, overtakes, proposeTo } from './core/party'
import { BottomNav, type Screen } from './components/BottomNav'
import { HomeView } from './components/HomeView'
import { MissionsView } from './components/MissionsView'
import { UnknownView } from './components/UnknownView'
import { PartyView } from './components/PartyView'
import type { Gain } from './components/TrackerCard'
import { LevelUpToast, OvertakeBanner, PassedBanner, type Overtake, type Toast } from './components/LevelUpToast'

// fuera del componente: solo se llama desde manejadores de eventos
const nowStamp = () => `${DEMO_DATE}T${new Date().toTimeString().slice(0, 8)}`

export default function App() {
  const [events, setEvents] = useState<ActivityEvent[]>(loadEvents)
  const [custom, setCustom] = useState<CustomData>(loadCustom)
  const [screen, setScreen] = useState<Screen>('home')
  const [partyId, setPartyId] = useState(PARTIES[0].id)
  const [toast, setToast] = useState<Toast | null>(null)
  const [gain, setGain] = useState<Gain | null>(null)
  const [overtake, setOvertake] = useState<Overtake | null>(null)

  useEffect(() => saveEvents(events), [events])
  useEffect(() => saveCustom(custom), [custom])
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(id)
  }, [toast])
  useEffect(() => {
    if (!gain) return
    const id = setTimeout(() => setGain(null), 900) // = duración de .float-xp
    return () => clearTimeout(id)
  }, [gain])
  // el banner espera a que termine el level-up: una celebración cada vez
  useEffect(() => {
    if (!overtake || toast) return
    const id = setTimeout(() => setOvertake(null), 3200)
    return () => clearTimeout(id)
  }, [overtake, toast])

  const trackers = useMemo(() => allTrackers(custom.trackers), [custom.trackers])
  const game = useMemo(() => deriveGame(events, DEMO_DATE, trackers), [events, trackers])
  const partyStates = useMemo(
    () => PARTIES.map(p => derivePartyState(p, events, DEMO_DATE, trackers, custom.proposals)),
    [events, trackers, custom.proposals],
  )

  function go(s: Screen) {
    if (s === screen) return window.scrollTo(0, 0)
    transition(() => { setScreen(s); window.scrollTo(0, 0) }, 'screen')
  }

  // amount < 0 = corrección (evento negativo); no deja la semana por debajo de 0
  function add(t: Tracker, amount: number) {
    const week = game.trackers.find(s => s.tracker.id === t.id)?.week ?? 0
    amount = Math.max(Math.round(amount), -week)
    if (!amount) return
    const ev: ActivityEvent = { id: crypto.randomUUID(), trackerId: t.id, amount, occurredAt: nowStamp() }
    const next = [...events, ev]
    const after = deriveGame(next, DEMO_DATE, trackers)
    const up = amount > 0 ? diffLevelUps(game, after) : diffLevelDowns(game, after)
    setEvents(next) // evento creado fuera del updater (StrictMode)
    setGain({ trackerId: t.id, xp: amount * t.xpPerUnit, branch: t.branch, key: ev.id })
    if (up) setToast({ ...up, key: ev.id, down: amount < 0, tone: up.title.includes('— PLAYER') ? 'neutral' : t.branch })
    // adelantamientos: tú superas a alguien (ranking HERO) o alguien te supera en HERO/VILLAIN/profundidad
    for (const [i, p] of PARTIES.entries()) {
      const before = partyStates[i]
      const after = derivePartyState(p, next, DEMO_DATE, trackers, custom.proposals)
      const names = overtakes(after.ranking, before.ranking)
      if (names.length) { setOvertake({ key: ev.id, party: p.name, names, position: after.position }); break }
      const lost = ([t.branch, 'depth'] as const).map(metric => {
        const a = buildRanking(after.game, p.members, metric)
        const names = overtakes(buildRanking(before.game, p.members, metric), a)
        return { key: ev.id, party: p.name, names, position: a.findIndex(m => m.isYou) + 1, lost: metric }
      }).find(o => o.names.length)
      if (lost) { setOvertake(lost); break }
    }
  }

  const create = (t: Tracker) => setCustom(c => ({ ...c, trackers: [...c.trackers, t] }))

  function propose(trackerId: string, partyIds: string[]) {
    const now = nowStamp()
    setCustom(c => ({ ...c, proposals: proposeTo(c.proposals, trackerId, partyIds, allTrackers(c.trackers), now) }))
  }

  function reset() {
    if (!window.confirm('¿Restablecer la demo? Se borran tus registros y misiones nuevas.')) return
    setEvents(SEED_EVENTS); setCustom(EMPTY_CUSTOM); setToast(null); setGain(null); setOvertake(null)
  }

  return (
    <>
      {screen === 'home' && (
        <HomeView game={game} partyStates={partyStates} onNavigate={go}
          onOpenParty={id => { setPartyId(id); go('party') }} onReset={reset} />
      )}
      {(screen === 'hero' || screen === 'villain') && (
        <MissionsView key={screen} branch={screen} game={game} partyStates={partyStates} gain={gain} events={events} onAdd={add} />
      )}
      {screen === 'new' && (
        <UnknownView trackers={trackers} parties={PARTIES} onCreate={create} onAdd={add} onPropose={propose} onGoToMissions={go} />
      )}
      {screen === 'party' && (
        <PartyView states={partyStates} selectedId={partyId} onSelect={setPartyId} global={game} />
      )}
      {toast && <LevelUpToast toast={toast} />}
      {overtake && !toast && (overtake.lost ? <PassedBanner o={overtake} lost={overtake.lost} /> : <OvertakeBanner o={overtake} />)}
      <BottomNav screen={screen} onChange={go} />
    </>
  )
}
