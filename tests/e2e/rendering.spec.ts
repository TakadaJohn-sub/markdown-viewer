import { expect, fixturePath, test } from './fixtures'

test.describe('Markdown rendering (§3, §8, §12)', () => {
  test('renders CommonMark and GFM instead of showing raw source', async ({ launch }) => {
    const { page } = await launch({ files: [fixturePath('gfm.md')] })
    const doc = page.getByTestId('document')
    await expect(doc).toBeVisible()

    await expect(page.getByRole('heading', { level: 1, name: 'Guide' })).toBeVisible()
    // The raw "# " marker must not survive into the rendered text.
    await expect(doc).not.toContainText('# Guide')

    await expect(page.getByRole('table')).toBeVisible()
    await expect(page.getByRole('cell', { name: '10' })).toBeVisible()

    const checkboxes = page.locator('input[type="checkbox"]')
    await expect(checkboxes).toHaveCount(2)
    await expect(checkboxes.nth(0)).toBeChecked()
    await expect(checkboxes.nth(0)).toBeDisabled()
    await expect(checkboxes.nth(1)).not.toBeChecked()

    await expect(page.locator('del')).toHaveText('old')
    await expect(page.getByRole('link', { name: 'https://example.com/page' })).toBeVisible()
  })

  test('syntax-highlights a fenced code block, colours it, and labels its language', async ({ app, page }) => {
    await launchGfm(app, page)
    const pre = page.locator('pre[data-language="ts"]')
    await expect(pre).toBeVisible()
    // The language name is shown in the header, not re-exposed as a DOM attribute.
    await expect(page.locator('.code-block__language')).toHaveText('TypeScript')

    // Shiki wraps tokens in spans carrying BOTH themes' colours as --shiki-light/-dark
    // custom properties (defaultColor:false, §3.6) — our own CSS has to turn one of those
    // into the actual `color`, so check the computed style, not just that the attribute
    // exists (a missing CSS rule here previously left every token looking like plain text,
    // silently inheriting the body colour instead of Shiki's).
    const constKeyword = pre.getByText('const', { exact: true })
    // github-light's keyword colour (#D73A49).
    await app.evaluate(({ nativeTheme }) => {
      nativeTheme.themeSource = 'light'
    })
    await expect.poll(() => constKeyword.evaluate((el) => getComputedStyle(el).color)).toBe('rgb(215, 58, 73)')

    // github-dark's keyword colour (#F97583) — the same token, after only the theme changed.
    await app.evaluate(({ nativeTheme }) => {
      nativeTheme.themeSource = 'dark'
    })
    await expect.poll(() => constKeyword.evaluate((el) => getComputedStyle(el).color)).toBe('rgb(249, 117, 131)')
  })

  test('Copy writes the raw code (not the highlighted markup) to the clipboard', async ({ app, page }) => {
    await launchGfm(app, page)
    await page.getByRole('button', { name: 'Copy' }).click()
    await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible()
    const clipboardText = await app.evaluate(({ clipboard }) => clipboard.readText())
    expect(clipboardText).toBe('const hello: string = "world"\nconsole.log(hello)')
  })

  test('folds front matter into a collapsed, syntax-highlighted block instead of a heading (§3.4)', async ({ launch }) => {
    const { page } = await launch({ files: [fixturePath('frontmatter.md')] })
    const details = page.locator('details.mdv-frontmatter')
    await expect(details).toBeVisible()
    await expect(page.locator('summary')).toHaveText('YAML Front Matter')
    await expect(page.getByRole('heading', { name: 'Frontmatter Demo' })).toBeVisible()
    // Collapsed by default.
    await expect(details).not.toHaveAttribute('open')

    await page.locator('summary').click()
    await expect(details).toHaveAttribute('open')
    await expect(details).toContainText('title: Sample Doc')
  })

  test('shows a fallback for a missing local image but loads one that exists', async ({ launch }) => {
    const { page } = await launch({ files: [fixturePath('gfm.md')] })
    await expect(page.getByRole('img', { name: 'A pixel' })).toBeVisible()

    const fallbacks = page.locator('.markdown-image-fallback')
    await expect(fallbacks).toHaveCount(2)
    // With alt text, the fallback shows it (more meaningful than an internal asset URL).
    await expect(fallbacks.first()).toContainText('Missing')
    // Without alt text, it falls back to a real filesystem path — never the raw mdv-asset: URL.
    await expect(fallbacks.last()).toContainText('missing2.png')
    await expect(fallbacks.last()).not.toContainText('mdv-asset:')
  })
})

// The Copy test needs a document already open; reuse the shared welcomeApp-derived app/page
// fixtures by opening the file after they start on the welcome screen.
async function launchGfm(app: import('@playwright/test').ElectronApplication, page: import('@playwright/test').Page) {
  await app.evaluate(
    ({ dialog }, filePath) => {
      dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [filePath] })
    },
    fixturePath('gfm.md'),
  )
  await page.getByRole('button', { name: /ファイルを開く|Open File/ }).click()
  await expect(page.getByTestId('document')).toBeVisible()
}
