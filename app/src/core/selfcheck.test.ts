import { expect, test, vi } from 'vitest'
import { runSelfCheck } from './selfcheck'
test('selfcheck: todos los asserts pasan', () => {
  const failed: string[] = []
  const spy = vi.spyOn(console, 'assert').mockImplementation((cond, ...msg) => { if (!cond) failed.push(msg.join(' ')) })
  try { runSelfCheck() } finally { spy.mockRestore() }
  expect(failed).toEqual([])
})
