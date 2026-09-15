import react from '@vitejs/plugin-react'
import { defaultClientConditions, defineConfig } from 'vite'
import electron from 'vite-plugin-electron/simple'

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        // The plugin launches Electron with --no-sandbox by default; drop it so development
        // runs under the same sandbox as production (§11.1 of the design doc).
        onstart: async ({ startup }) => {
          await startup(['.'])
        },
      },
      // Sandboxed preloads cannot use ESM: the plugin bundles this into one CommonJS file.
      preload: { input: 'electron/preload.ts' },
    }),
  ],
  resolve: {
    // Several unified-ecosystem packages (decode-named-character-reference used by micromark,
    // hast-util-from-html-isomorphic used by rehype-katex) pick a DOM-based build under the
    // "browser" condition, which throws inside the Markdown Worker where there is no `document`.
    // Their exports list "worker" before "browser", so enabling it selects the DOM-free build.
    conditions: ['worker', ...defaultClientConditions],
  },
  worker: { format: 'es' },
  server: { port: 5173, strictPort: true },
  build: { target: 'esnext' },
})
