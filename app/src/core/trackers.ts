import type { Tracker } from './types'

export const TRACKERS: Tracker[] = [
  { id: 'gym', name: 'Gym', branch: 'hero', type: 'count', unit: 'sesiones', increment: 1, buttonLabel: '+1 sesión', xpPerUnit: 30, weeklyGoal: 4 },
  { id: 'bjj', name: 'BJJ', branch: 'hero', type: 'count', unit: 'clases', increment: 1, buttonLabel: '+1 clase', xpPerUnit: 30, weeklyGoal: 3 },
  { id: 'running', name: 'Running', branch: 'hero', type: 'distance', unit: 'km', increment: 5, buttonLabel: '+5 km', xpPerUnit: 5, weeklyGoal: 20 },
  { id: 'reading', name: 'Reading', branch: 'hero', type: 'duration', unit: 'min', increment: 30, buttonLabel: '+30 min', xpPerUnit: 1, weeklyGoal: 120 },
  { id: 'beer', name: 'Beer', branch: 'villain', type: 'count', unit: 'unidades', increment: 1, buttonLabel: '+1', xpPerUnit: 15 },
  { id: 'burgers', name: 'Burgers', branch: 'villain', type: 'count', unit: 'unidades', increment: 1, buttonLabel: '+1', xpPerUnit: 20 },
]

export const allTrackers = (custom: Tracker[]): Tracker[] => [...TRACKERS, ...custom]
