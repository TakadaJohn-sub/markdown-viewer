import { defineConfig } from 'vitest/config'

// Kept apart from vite.config.mts so running tests never starts Electron.
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
})
