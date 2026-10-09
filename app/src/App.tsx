import { useEffect, useMemo, useReducer, useState } from 'react'
import { transition } from './viewTransition'
import type { ActivityEvent, CustomData, Tracker } from './core/types'
import { seedFor } from './core/seed'
import { clampAmount, localDate, todaySummary, undoneIds } from './core/stats'
import { EMPTY_CUSTOM, backupCurrent, backupDue, exportBackup, hasLastBackup, loadAll, loadLastExport, parseBackup, readLast, requestPersist, restoreLast, saveCustom, saveEvents, saveLastExport, unlockStorage, type LoadProblem } from './core/storage'
import { deriveGame, diffLevelDowns, diffLevelUps } from './core/rpg'
import { allTrackers, setGoal } from './core/trackers'
import { PARTIES, buildRanking, derivePartyState, overtakes, proposeTo } from './core/party'
import { BottomNav, type Screen } from './components/BottomNav'
import { HomeView } from './components/HomeView'
import { MissionsView } from './components/MissionsView'
import { UnknownView } from './components/UnknownView'
import { PartyView } from './components/PartyView'
import type { Gain } from './components/TrackerCard'
import { LevelUpToast, OvertakeBanner, PassedBanner, type Overtake, type Toast } from './components/LevelUpToast'

// fuera del componente: solo se llama desde manejadores de eventos
const nowStamp = (day?: string, d = new Date()) => `${day ?? localDate(d)}T${d.toTimeString().slice(0, 8)}`

const noticeFor = (problems: LoadProblem[]) => !problems.length ? null
  : problems.some(p => p.backupKey === null)
    ? 'Parte de tus datos guardados no se pudo leer ni copiar. Tus cambios no se guardarán en este navegador hasta que importes una copia.'
    : problems.every(p => p.dropped === 0)
    ? 'Hemos corregido algunos datos guardados con campos no válidos; no se ha perdido ningún registro. El original está copiado aparte en este navegador.'
    : 'Parte de tus datos guardados no se pudo leer. El original está copiado aparte en este navegador. Exporta una copia para conservar lo que ves.'

export default function App() {
  const [loaded] = useState(loadAll)
  const [events, setEvents] = useState<ActivityEvent[]>(loaded.events)
  const [custom, setCustom] = useState<CustomData>(loaded.custom)
  const [notice, setNotice] = useState<string | null>(() => noticeFor(loaded.problems))
  const [screen, setScreen] = useState<Screen>('home')
  const [partyId, setPartyId] = useState(PARTIES[0].id)
  const [toast, setToast] = useState<Toast | null>(null)
  const [gain, setGain] = useState<Gain | null>(null)
  const [overtake, setOvertake] = useState<Overtake | null>(null)
  const [canRestore, setCanRestore] = useState(hasLastBackup)
  const [lastExport, setLastExport] = useState(loadLastExport)

  const [, refresh] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])
  // ponytail: «hoy» se recalcula en cada render y al volver a la pestaña; con la app visible
  // pasada la medianoche y sin tocar nada, la pantalla muestra el día anterior hasta la siguiente
  // interacción. Añadir un timer a medianoche si molesta.
  const now = new Date(); const today = localDate(now)
  const hasData = events.length > 0 || custom.trackers.length > 0 || Object.keys(custom.goals ?? {}).length > 0
  const copy = backupDue(lastExport, now, hasData)

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

  const trackers = useMemo(() => allTrackers(custom.trackers, custom.goals), [custom.trackers, custom.goals])
  const game = useMemo(() => deriveGame(events, today, trackers), [events, today, trackers])
  const summary = useMemo(() => todaySummary(events, game.trackers, today), [events, game, today])
  const partyStates = useMemo(
    () => PARTIES.map(p => derivePartyState(p, events, today, trackers, custom.proposals)),
    [events, today, trackers, custom.proposals],
  )

  function go(s: Screen) {
    if (s === screen) return window.scrollTo(0, 0)
    transition(() => { setScreen(s); window.scrollTo(0, 0) }, 'screen')
  }

  // amount < 0 = corrección (evento negativo); no deja el día por debajo de 0
  // undo = registro positivo que se anula entero
  function add(t: Tracker, amount: number, day = today, undo?: ActivityEvent) {
    if (day > today) day = today
    if (undo && undoneIds(events).has(undo.id)) return
    amount = clampAmount(events, t.id, day, amount)
    if (!amount || (undo && amount !== -undo.amount)) return
    const ev: ActivityEvent = { id: crypto.randomUUID(), trackerId: t.id, amount,
      occurredAt: undo ? undo.occurredAt : nowStamp(day), ...(undo && { undoes: undo.id }) }
    const next = [...events, ev]
    const after = deriveGame(next, today, trackers)
    const up = amount > 0 ? diffLevelUps(game, after) : diffLevelDowns(game, after)
    setEvents(next) // evento creado fuera del updater (StrictMode)
    setGain({ trackerId: t.id, xp: amount * t.xpPerUnit, branch: t.branch, key: ev.id })
    if (up) setToast({ ...up, key: ev.id, down: amount < 0, tone: up.title.includes('— PLAYER') ? 'neutral' : t.branch })
    // adelantamientos: tú superas a alguien (ranking HERO) o alguien te supera en HERO/VILLAIN/profundidad
    for (const [i, p] of PARTIES.entries()) {
      const before = partyStates[i]
      const after = derivePartyState(p, next, today, trackers, custom.proposals)
      const names = overtakes(after.ranking, before.ranking)
      if (names.length) { setOvertake({ key: ev.id, party: p.name, names, position: after.position }); break }
      const lost = ([t.branch, 'depth'] as const).map(metric => {
        const a = buildRanking(after.game, p.members, metric, today)
        const names = overtakes(buildRanking(before.game, p.members, metric, today), a)
        return { key: ev.id, party: p.name, names, position: a.findIndex(m => m.isYou) + 1, lost: metric }
      }).find(o => o.names.length)
      if (lost) { setOvertake(lost); break }
    }
  }

  const undo = (t: Tracker, e: ActivityEvent) => add(t, -e.amount, e.occurredAt.slice(0, 10), e)

  const saveTracker = (t: Tracker) => t.custom
    ? setCustom(c => ({ ...c, trackers: c.trackers.map(x => (x.id === t.id ? t : x)) }))
    : setCustom(c => ({ ...c, goals: setGoal(c.goals, t.id, t.weeklyGoal ?? null) }))
  const unarchive = (t: Tracker) => saveTracker({ ...t, archived: false })
  const archived = useMemo(() => custom.trackers.filter(t => t.archived), [custom.trackers])
  const create = (t: Tracker) => setCustom(c => ({ ...c, trackers: [...c.trackers, t] }))

  function propose(trackerId: string, partyIds: string[]) {
    const now = nowStamp()
    setCustom(c => ({ ...c, proposals: proposeTo(c.proposals, trackerId, partyIds, allTrackers(c.trackers, c.goals), now) }))
  }

  const loadExample = () => setEvents(seedFor(today))

  function reset() {
    if (copy.due && hasData && window.confirm('No tienes una copia reciente de tus datos. ¿Exportar una antes de borrar? Aceptar exporta y no borra nada; Cancelar sigue con el borrado.')) {
      exportData(); setNotice('Copia exportada. Pulsa «Borrar todo» otra vez si quieres borrar.'); return
    }
    if (!window.confirm('¿Borrar todos tus registros y misiones nuevas? No se puede deshacer. Exporta una copia antes si quieres conservarlos.')) return
    if (hasData && !backupCurrent()) return setNotice('No se pudo guardar la copia interna, así que no se ha borrado nada. Exporta una copia y vuelve a intentarlo.')
    setCanRestore(hasLastBackup())
    setEvents([]); setCustom(EMPTY_CUSTOM); setToast(null); setGain(null); setOvertake(null)
  }

  function exportData() {
    const stamp = new Date().toISOString()
    const url = URL.createObjectURL(new Blob([exportBackup(events, custom, stamp)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url; a.download = `rpg-life-tracker-${stamp.slice(0, 10)}.json`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    // ponytail: cuenta como copia al lanzar la descarga; el navegador no confirma que se guardó.
    saveLastExport(stamp); setLastExport(stamp)
    requestPersist() // en el primer gesto del usuario (no al arrancar: Firefox muestra un diálogo de permiso)
  }

  function importData(text: string) {
    const b = parseBackup(text)
    if (!b) return setNotice('Ese archivo no es una copia válida de RPG Life Tracker.')
    const n = b.events.length, m = b.custom.trackers.length
    if (!window.confirm(`¿Importar esta copia? Se reemplazan tus ${events.length} registros y ${custom.trackers.length} misiones nuevas por ${n} y ${m}.${b.dropped ? ` Se ignorarán ${b.dropped} elementos no válidos.` : ''}${b.fixed ? ` Se corregirán ${b.fixed} elementos con campos no válidos.` : ''} Exporta antes si quieres conservar lo actual.`)) return
    if (hasData && !backupCurrent()) return setNotice('No se pudo guardar la copia interna, así que no se ha importado nada. Exporta una copia y vuelve a intentarlo.')
    setCanRestore(hasLastBackup())
    unlockStorage()
    setEvents(b.events); setCustom(b.custom); setToast(null); setGain(null); setOvertake(null)
    setNotice(`Copia importada: ${n} registros y ${m} misiones nuevas.`)
  }

  function restore() {
    const r = readLast()
    if (r === 'none') { setCanRestore(false); return setNotice('No hay ninguna copia interna que recuperar.') }
    if (r === 'unreadable') return setNotice('La copia interna está dañada y no se puede recuperar. Tus datos actuales no se han tocado.')
    const ev = r.events ?? events, cu = r.custom ?? custom
    if (!window.confirm(`¿Recuperar la copia guardada antes de tu último «Importar» o «Borrar todo»? Se reemplazan tus ${events.length} registros y ${custom.trackers.length} misiones nuevas por ${ev.length} y ${cu.trackers.length}.${r.dropped ? ` Se ignorarán ${r.dropped} elementos no válidos.` : ''}${r.fixed ? ` Se corregirán ${r.fixed} elementos con campos no válidos.` : ''} Lo que tienes ahora queda guardado como copia: si cambias de idea, pulsa otra vez «Recuperar copia anterior».`)) return
    if (!restoreLast(r)) return setNotice('No se pudo recuperar la copia, así que no se ha cambiado nada. Exporta una copia y vuelve a intentarlo.')
    setEvents(ev); setCustom(cu); setToast(null); setGain(null); setOvertake(null)
    setNotice(`Copia recuperada: ${ev.length} registros y ${cu.trackers.length} misiones nuevas.`)
  }

  return (
    <>
      {screen === 'home' && (
        <HomeView game={game} summary={summary} partyStates={partyStates} archived={archived} onUnarchive={unarchive} onNavigate={go}
          onOpenParty={id => { setPartyId(id); go('party') }} onReset={reset} onLoadExample={events.length === 0 ? loadExample : undefined} onRestore={canRestore ? restore : undefined}
          onExport={exportData} onImport={importData} onImportError={() => setNotice('No se pudo leer el archivo.')} copy={copy}
          notice={notice} onDismissNotice={() => setNotice(null)} />
      )}
      {(screen === 'hero' || screen === 'villain') && (
        <MissionsView key={screen} branch={screen} game={game} partyStates={partyStates} gain={gain} events={events} today={today} onAdd={add} onUndo={undo} onSave={saveTracker} onPropose={propose} />
      )}
      {screen === 'new' && (
        <UnknownView trackers={trackers} parties={PARTIES} onCreate={create} onAdd={add} onPropose={propose} onGoToMissions={go} onUnarchive={unarchive} />
      )}
      {screen === 'party' && (
        <PartyView states={partyStates} selectedId={partyId} onSelect={setPartyId} global={game} today={today} />
      )}
      {toast && <LevelUpToast toast={toast} />}
      {overtake && !toast && (overtake.lost ? <PassedBanner o={overtake} lost={overtake.lost} /> : <OvertakeBanner o={overtake} />)}
      <BottomNav screen={screen} onChange={go} />
    </>
  )
}
