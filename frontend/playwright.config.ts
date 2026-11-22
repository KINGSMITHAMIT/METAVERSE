import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 65_000,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5173',
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH,
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
    },
  },
})
