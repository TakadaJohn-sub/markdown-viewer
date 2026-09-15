import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { appEnv, clickMenuItem, expect, fixturePath, projectRoot, tempDir, test, windowTitles } from './fixtures'

test('starts on the welcome screen served from app://', async ({ launch }) => {
  const { page } = await launch()
  await expect(page.getByTestId('welcome')).toBeVisible()
  await expect(page.getByRole('button', { name: /ファイルを開く|Open File/ })).toBeVisible()
  expect(page.url()).toBe('app://bundle/index.html')
})

test('opens a file passed on the command line', async ({ launch }) => {
  const { app, page } = await launch({ files: [fixturePath('hello.md')] })
  await expect(page.getByTestId('document')).toContainText('こんにちは')
  expect(await windowTitles(app)).toEqual(['hello.md'])
})

test('decodes Shift_JIS files', async ({ launch }) => {
  const { page } = await launch({ files: [fixturePath('sjis.md')] })
  await expect(page.getByTestId('document')).toContainText('Shift_JIS で保存されたファイルです。')
  await expect(page.getByRole('status')).toHaveCount(0)
})

test('explains why a file cannot be opened', async ({ launch }) => {
  const binary = await launch({ files: [fixturePath('binary.md')] })
  await expect(binary.page.getByTestId('error')).toContainText(/バイナリ|binary/)

  const missing = await launch({ files: [fixturePath('does-not-exist.md')] })
  await expect(missing.page.getByTestId('error')).toContainText(/見つかりません|not found/)
  await expect(missing.page.getByRole('button', { name: /再試行|Try Again/ })).toBeVisible()
})

test('opens files chosen in the Open dialog, extra files in new windows', async ({ launch }) => {
  const { app, page } = await launch()
  await app.evaluate(({ dialog }, filePaths) => {
    dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths })
  }, [fixturePath('hello.md'), fixturePath('sjis.md')])

  const secondWindow = app.waitForEvent('window')
  await page.getByRole('button', { name: /ファイルを開く|Open File/ }).click()
  await expect(page.getByTestId('document')).toContainText('こんにちは')
  await expect((await secondWindow).getByTestId('document')).toContainText('日本語のテスト')
  expect((await windowTitles(app)).sort()).toEqual(['hello.md', 'sjis.md'])
})

test('the top-left open-file button opens another file into the same window', async ({ launch }) => {
  const { app, page } = await launch({ files: [fixturePath('gfm.md')] })
  await expect(page.getByTestId('document')).toBeVisible()

  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [filePath] })
  }, fixturePath('hello.md'))

  await page.getByRole('button', { name: /^(開く…|Open…)$/ }).click()
  await expect(page.getByTestId('document')).toContainText('こんにちは')
})

test('opens a dropped file in the window it was dropped on', async ({ launch }) => {
  const { page } = await launch()
  await expect(page.getByTestId('welcome')).toBeVisible()
  // A real File backed by a path on disk, as Finder would provide on drop.
  await page.evaluate(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.id = 'e2e-file-source'
    input.hidden = true
    document.body.append(input)
  })
  await page.setInputFiles('#e2e-file-source', fixturePath('hello.md'))
  await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('#e2e-file-source')
    const file = input?.files?.[0]
    if (!file) throw new Error('No file selected')
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(file)
    window.dispatchEvent(new DragEvent('drop', { dataTransfer, cancelable: true }))
  })
  await expect(page.getByTestId('document')).toContainText('こんにちは')
})

test('Reload re-reads the file from disk', async ({ launch }) => {
  const dir = tempDir('mdv-reload-')
  const file = path.join(dir, 'live.md')
  fs.writeFileSync(file, 'first version\n')
  try {
    const { app, page } = await launch({ files: [file] })
    await expect(page.getByTestId('document')).toContainText('first version')
    fs.writeFileSync(file, 'second version\n')
    await clickMenuItem(app, 'reload')
    await expect(page.getByTestId('document')).toContainText('second version')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('a second launch hands its files to the running instance', async ({ launch }) => {
  const { app, page, userDataDir } = await launch()
  await expect(page.getByTestId('welcome')).toBeVisible()

  const electronPath = await app.evaluate(() => process.execPath)
  const second = spawn(electronPath, [projectRoot, fixturePath('hello.md')], { env: appEnv(userDataDir), stdio: 'ignore' })
  const exitCode = await new Promise<number | null>((resolve) => second.on('exit', resolve))

  expect(exitCode).toBe(0)
  await expect(page.getByTestId('document')).toContainText('こんにちは')
  expect(await windowTitles(app)).toEqual(['hello.md'])
})

/** Replaces `app.addRecentDocument` so calls can be observed without touching the real
 * macOS "recent items" list. */
async function stubRecentDocuments(app: import('@playwright/test').ElectronApplication) {
  await app.evaluate(({ app }) => {
    const calls: string[] = []
    ;(globalThis as { __recentDocumentCalls?: string[] }).__recentDocumentCalls = calls
    app.addRecentDocument = (path: string) => calls.push(path)
  })
  return () => app.evaluate(() => (globalThis as { __recentDocumentCalls?: string[] }).__recentDocumentCalls ?? [])
}

test('opening a file registers it as a recent document, but following a link does not (§17 Phase 3)', async ({
  launch,
}) => {
  const { app, page } = await launch()
  const getCalls = await stubRecentDocuments(app)

  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [filePath] })
  }, fixturePath('gfm.md'))
  await page.getByRole('button', { name: /ファイルを開く|Open File/ }).click()
  await expect(page.getByTestId('document')).toBeVisible()
  await expect.poll(getCalls).toEqual([fixturePath('gfm.md')])

  await page.getByRole('link', { name: 'linked document' }).click()
  await expect(page.getByRole('heading', { name: 'Linked Document' })).toBeVisible()
  // Following a link is `navigate`, not `open` — the recent-documents list is unaffected.
  await expect.poll(getCalls).toEqual([fixturePath('gfm.md')])
})
