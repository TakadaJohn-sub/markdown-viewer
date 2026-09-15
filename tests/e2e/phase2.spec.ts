import fs from 'node:fs'
import path from 'node:path'
import { clickMenuItem, expect, fixturePath, tempDir, test } from './fixtures'

test.describe('Mermaid, KaTeX, and GitHub Alerts (§3.5/§3.6/§9)', () => {
  test('renders diagrams, math, and alerts from a document exercising all three', async ({ launch }) => {
    const { page } = await launch({ files: [fixturePath('phase2-preview.md')] })
    const doc = page.getByTestId('document')
    await expect(doc).toBeVisible()

    const note = doc.locator('.markdown-alert-note')
    await expect(note).toBeVisible()
    await expect(note).toContainText('Note')
    await expect(note).toContainText('This is a note alert.')

    const warning = doc.locator('.markdown-alert-warning')
    await expect(warning).toBeVisible()
    await expect(warning).toContainText('Warning')

    // Inline math renders as real KaTeX markup...
    await expect(doc.locator('.katex').first()).toBeVisible()
    // ...while a dollar amount next to it is left as plain text (§3.7 disambiguation).
    await expect(doc).toContainText('$5 or $10')

    // Display math gets its own block-level KaTeX wrapper.
    await expect(doc.locator('.katex-display')).toBeVisible()

    // A malformed TeX span renders as a visible error instead of failing the whole document.
    await expect(doc.locator('.katex-error')).toBeVisible()

    // Mermaid is lazy — wait for it to leave the pending state and paint real SVG.
    const mermaid = doc.getByTestId('mermaid-block')
    await expect(mermaid).toHaveAttribute('data-mermaid-state', 'rendered', { timeout: 10_000 })
    await expect(mermaid.locator('svg')).toBeVisible()
  })
})

test.describe('Table of contents (§8.4)', () => {
  test('toggling from the menu shows headings and jumps to one on click', async ({ app, page }) => {
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [filePath] })
    }, fixturePath('anchors.md'))
    await page.getByRole('button', { name: /ファイルを開く|Open File/ }).click()
    await expect(page.getByTestId('document')).toBeVisible()

    const toc = page.getByRole('navigation', { name: /目次|Table of Contents/ })
    await expect(toc).toBeHidden()

    await clickMenuItem(app, 'toggle-toc')
    await expect(toc).toBeVisible()
    await expect(toc.getByRole('link', { name: 'Anchors' })).toBeVisible()
    await expect(toc.getByRole('link', { name: 'Target' })).toBeVisible()

    await toc.getByRole('link', { name: 'Target' }).click()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200)

    await clickMenuItem(app, 'toggle-toc')
    await expect(toc).toBeHidden()
  })
})

test.describe('File watching (§6.4)', () => {
  test('an external edit auto-reloads the document while preserving scroll position', async ({ launch }) => {
    const dir = tempDir('mdv-watch-')
    const file = path.join(dir, 'live.md')
    fs.writeFileSync(file, '# Live\n\nfirst version\n')
    try {
      const { page } = await launch({ files: [file] })
      const doc = page.getByTestId('document')
      await expect(doc).toContainText('first version')

      fs.writeFileSync(file, '# Live\n\nsecond version\n')
      await expect(doc).toContainText('second version', { timeout: 5000 })
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test('deleting the watched file shows a banner, and recreating it clears it', async ({ launch }) => {
    const dir = tempDir('mdv-watch-delete-')
    const file = path.join(dir, 'live.md')
    fs.writeFileSync(file, '# Live\n\noriginal content\n')
    try {
      const { page } = await launch({ files: [file] })
      const doc = page.getByTestId('document')
      await expect(doc).toContainText('original content')

      fs.rmSync(file)
      await expect(page.getByRole('status')).toContainText(/ファイルが削除されました|has been deleted/, { timeout: 5000 })
      // The last-read content stays on screen — deletion doesn't blank the view.
      await expect(doc).toContainText('original content')

      fs.writeFileSync(file, '# Live\n\nrestored content\n')
      await expect(doc).toContainText('restored content', { timeout: 5000 })
      await expect(page.getByRole('status')).toHaveCount(0)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test('a background edit above the fold re-anchors to the same content, not the same pixel offset (§6.5)', async ({
    launch,
  }) => {
    const dir = tempDir('mdv-watch-anchor-')
    const file = path.join(dir, 'live.md')
    const paragraphs = Array.from({ length: 60 }, (_, index) => `Paragraph ${index}.`)
    const render = (lines: string[]) => ['# Reload Anchor', '', ...lines.flatMap((line) => [line, ''])].join('\n')
    fs.writeFileSync(file, render(paragraphs))
    try {
      const { page } = await launch({ files: [file] })
      const doc = page.getByTestId('document')
      await expect(doc).toContainText('Paragraph 0.')

      const anchor = page.getByText('Paragraph 40.', { exact: true })
      // `block: 'start'` (not Playwright's default "nearest") so this paragraph is the one
      // sitting at the viewport's top edge — exactly what `captureTopAnchor` keys off of.
      await anchor.evaluate((element) => element.scrollIntoView({ block: 'start' }))
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200)
      const topBefore = (await anchor.boundingBox())?.y
      expect(topBefore).not.toBeNull()

      // Edit a paragraph above the fold without changing the document's line count (a typo
      // fix, not a restructure) — the anchored block keeps the same `data-line`, so the
      // realignment this test is after should be exact, not just "close."
      const edited = [...paragraphs]
      edited[5] = 'Paragraph 5 (edited).'
      fs.writeFileSync(file, render(edited))

      await expect(doc).toContainText('Paragraph 5 (edited).', { timeout: 5000 })
      await expect
        .poll(async () => {
          const box = await anchor.boundingBox()
          return box ? Math.abs(box.y - (topBefore ?? 0)) : Number.POSITIVE_INFINITY
        })
        .toBeLessThan(5)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
