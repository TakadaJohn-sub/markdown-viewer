import fs from 'node:fs'
import path from 'node:path'
import { HIGHLIGHT_SKIP_BYTES, CONFIRM_RENDER_BYTES } from '../../shared/markdown-files'
import { expect, tempDir, test } from './fixtures'

/** A Markdown file just over `minBytes`, ending with a heading and a fenced code block so
 * tests can assert on the rendered (or not-yet-rendered) result, not just its size. */
function makeLargeFixture(dir: string, name: string, minBytes: number): string {
  const filePath = path.join(dir, name)
  // One filler word repeated into long paragraphs — reaches the target size with far fewer
  // AST/DOM nodes than the same bytes split into many short lines or list items, so
  // rendering it (the "render anyway" tier) doesn't itself take longer than the test's budget.
  const paragraph = `${'filler '.repeat(200).trim()}\n\n`
  const tail = '\n# Tail Heading\n\n```ts\nconst tail = true\n```\n'
  const repeats = Math.ceil((minBytes - tail.length) / paragraph.length) + 2
  fs.writeFileSync(filePath, paragraph.repeat(repeats) + tail)
  return filePath
}

test.describe('Large files (§12)', () => {
  test('renders normally but skips syntax highlighting between 500 KB and 5 MB', async ({ launch }) => {
    const dir = tempDir('mdv-large-')
    try {
      const file = makeLargeFixture(dir, 'medium.md', HIGHLIGHT_SKIP_BYTES + 1024)
      const { page } = await launch({ files: [file] })
      await expect(page.getByRole('status')).toContainText(/ハイライトを省略|highlighting has been skipped/)
      await expect(page.getByRole('heading', { name: 'Tail Heading' })).toBeVisible()
      const pre = page.locator('pre[data-language="ts"]')
      await expect(pre).toBeVisible()
      await expect(pre).not.toHaveClass(/shiki/)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test('asks before rendering a file over 5 MB, and honours the choice', async ({ launch }) => {
    const dir = tempDir('mdv-confirm-')
    try {
      const file = makeLargeFixture(dir, 'huge.md', CONFIRM_RENDER_BYTES + 1024 * 1024)
      const { page } = await launch({ files: [file] })
      await expect(page.getByTestId('confirm-large')).toBeVisible()
      await expect(page.getByTestId('confirm-large')).toContainText('6.') // ~6 MB, locale-neutral

      await page.getByRole('button', { name: /プレーンテキストで表示|Show as Plain Text/ }).click()
      const plain = page.getByTestId('document')
      await expect(plain).toBeVisible()
      // Unrendered: the raw "# " marker is still literally in the text.
      await expect(plain).toContainText('# Tail Heading')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test('renders anyway when chosen, still without syntax highlighting', async ({ launch }) => {
    const dir = tempDir('mdv-confirm-render-')
    try {
      const file = makeLargeFixture(dir, 'huge2.md', CONFIRM_RENDER_BYTES + 1024 * 1024)
      const { page } = await launch({ files: [file] })
      await expect(page.getByTestId('confirm-large')).toBeVisible()

      await page.getByRole('button', { name: /それでもレンダリングする|Render Anyway/ }).click()
      await expect(page.getByRole('heading', { name: 'Tail Heading' })).toBeVisible()
      await expect(page.getByRole('status')).toContainText(/ハイライトを省略|highlighting has been skipped/)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
