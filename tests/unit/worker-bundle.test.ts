import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Build-integrity check for §3.7/§17 of the design doc: the Worker's `resolve.conditions`
 * must pick the DOM-free build of packages like `decode-named-character-reference` (used
 * by micromark) and `hast-util-from-html-isomorphic` (used by rehype-katex), not the
 * `document`-using one, or the Worker throws the instant it starts. Guarded on `dist/`
 * existing so plain `npm test` (no build) skips it instead of failing; `npm run test:e2e`
 * runs `vite build` first, so it actually checks something there.
 *
 * Deliberately narrow, not a blanket "no `document.` anywhere" ban: KaTeX's own module
 * has unrelated `toNode()` methods that build real DOM nodes for its *other* API
 * (`katex.render()`), which we never call (we use `renderToString()`) — that code is
 * inert dead weight in this bundle, not a startup crash, and a broad check flagged it as
 * a false positive. Each pattern below is the exact unconditional, module-load-time call
 * the *browser* build of that one specific package opens with.
 */
const distAssets = path.resolve(import.meta.dirname, '../../dist/assets')
const workerChunk = fs.existsSync(distAssets)
  ? fs.readdirSync(distAssets).find((name) => name.startsWith('worker-') && name.endsWith('.js'))
  : undefined

describe.skipIf(!workerChunk)('the built Worker bundle', () => {
  it('contains no DOM-only fallback code', () => {
    const source = fs.readFileSync(path.join(distAssets, workerChunk!), 'utf8')
    expect(source).not.toMatch(/document\.createElement\(.i.\)/) // decode-named-character-reference/index.dom.js
    expect(source).not.toMatch(/new DOMParser\(\)/) // hast-util-from-html-isomorphic/lib/browser.js
  })
})
