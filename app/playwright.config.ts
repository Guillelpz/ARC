import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { ...devices['Pixel 7'], baseURL: 'http://localhost:4173/ARC/', reducedMotion: 'reduce' },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/ARC/',
    env: { BASE_PATH: '/ARC/' },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
