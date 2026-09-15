import { defineConfig } from '@playwright/test'

// Runs against the production build (`npm run test:e2e` builds first), loaded over app://.
export default defineConfig({
  testDir: 'tests/e2e',
  // Each test launches its own Electron app with its own windows.
  workers: 1,
  timeout: 30_000,
  reporter: 'list',
})
