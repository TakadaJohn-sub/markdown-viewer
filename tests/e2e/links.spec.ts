import { clickMenuItem, expect, fixturePath, test, windowTitles } from './fixtures'

/** Replaces `shell.openExternal` in Main so external-link clicks can be observed without
 * actually launching a browser, and returns the URLs it was called with. */
async function stubOpenExternal(app: import('@playwright/test').ElectronApplication) {
  await app.evaluate(({ shell }) => {
    const calls: string[] = []
    ;(globalThis as { __openExternalCalls?: string[] }).__openExternalCalls = calls
    shell.openExternal = (url: string) => {
      calls.push(url)
      return Promise.resolve()
    }
  })
  return () => app.evaluate(() => (globalThis as { __openExternalCalls?: string[] }).__openExternalCalls ?? [])
}

test.describe('Links (§5)', () => {
  test('an external link is handed to the OS browser, not opened inside the app', async ({ app, page }) => {
    const getCalls = await stubOpenExternal(app)
    await launchGfm(app, page)
    await page.getByRole('link', { name: 'external site' }).click()
    await expect.poll(getCalls).toEqual(['https://example.com/'])
    expect(page.url()).toBe('app://bundle/index.html')
  })

  test('a mailto link is handed to the OS mail client', async ({ app, page }) => {
    const getCalls = await stubOpenExternal(app)
    await launchGfm(app, page)
    await page.getByRole('link', { name: 'mail link' }).click()
    await expect.poll(getCalls).toEqual(['mailto:a@b.c'])
  })

  test('a link to a missing file shows a "not found" banner', async ({ app, page }) => {
    await launchGfm(app, page)
    await page.getByRole('link', { name: 'broken link' }).click()
    await expect(page.getByRole('status')).toContainText(/見つかりません|could not be found/)
  })

  // A Markdown-authored link to a scheme like "vscode:" never survives sanitize (§3.2
  // restricts href to http/https/mailto + relative — anything else is stripped to plain
  // text before it reaches the DOM), so 'unsupported' can't be reached by clicking rendered
  // content. This instead exercises the IPC round trip directly, the way a future, less
  // restrictive entry point (or a bug in the sanitize schema) would.
  test('followLink classifies an unsupported scheme without opening or crashing anything', async ({ app, page }) => {
    await launchGfm(app, page)
    const result = await page.evaluate(() => window.mdv.followLink('vscode://file/x'))
    expect(result).toBe('unsupported')
  })

  test('a link to another Markdown file navigates within the same window (§5.3), not a new one', async ({ app, page }) => {
    await launchGfm(app, page)
    await page.getByRole('link', { name: 'linked document' }).click()
    await expect(page.getByRole('heading', { name: 'Linked Document' })).toBeVisible()
    expect(await windowTitles(app)).toEqual(['linked.md'])
    expect(page.url()).toBe('app://bundle/index.html')
  })

  test('Alt+←/→ and Cmd+[/] both go back and forward through that history (§5.3/§10)', async ({ app, page }) => {
    await launchGfm(app, page)
    await page.getByRole('link', { name: 'linked document' }).click()
    await expect(page.getByRole('heading', { name: 'Linked Document' })).toBeVisible()

    await page.keyboard.press('Alt+ArrowLeft')
    await expect(page.getByRole('heading', { name: 'Guide' })).toBeVisible()
    expect(await windowTitles(app)).toEqual(['gfm.md'])

    await clickMenuItem(app, 'go-forward')
    await expect(page.getByRole('heading', { name: 'Linked Document' })).toBeVisible()

    await clickMenuItem(app, 'go-back')
    await expect(page.getByRole('heading', { name: 'Guide' })).toBeVisible()

    await page.keyboard.press('Alt+ArrowRight')
    await expect(page.getByRole('heading', { name: 'Linked Document' })).toBeVisible()
  })

  test('going back restores the scroll position last seen in that entry (§5.3)', async ({ launch }) => {
    const { app, page } = await launch({ files: [fixturePath('anchors.md')] })
    await expect(page.getByRole('heading', { name: 'Anchors' })).toBeVisible()

    // A #fragment jump never touches history (§5.1) — it just moves the scroll position
    // that this same entry will be restored to later.
    await page.getByRole('link', { name: 'target' }).click()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200)
    const scrollYAtTarget = await page.evaluate(() => window.scrollY)

    await page.getByRole('link', { name: 'linked document' }).click()
    await expect(page.getByRole('heading', { name: 'Linked Document' })).toBeVisible()

    await clickMenuItem(app, 'go-back')
    await expect(page.getByRole('heading', { name: 'Anchors' })).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollYAtTarget)
  })

  test('an in-page fragment link scrolls to the heading without leaving the app', async ({ launch }) => {
    const { page } = await launch({ files: [fixturePath('anchors.md')] })
    await expect(page.getByRole('heading', { name: 'Anchors' })).toBeVisible()
    const before = await page.evaluate(() => window.scrollY)
    await page.getByRole('link', { name: 'target' }).click()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 200)
    expect(page.url()).toBe('app://bundle/index.html')
  })

  test('a footnote reference scrolls to its definition despite the sanitizer re-prefixing the id', async ({ launch }) => {
    const { page } = await launch({ files: [fixturePath('anchors.md')] })
    await expect(page.getByRole('heading', { name: 'Anchors' })).toBeVisible()
    const before = await page.evaluate(() => window.scrollY)
    await page.locator('a[data-footnote-ref]').click()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 200)
  })
})

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
