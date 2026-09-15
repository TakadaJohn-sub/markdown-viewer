import { test as base, _electron as electron, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export { expect }

export const projectRoot = path.resolve(__dirname, '../..')
export const fixturePath = (name: string): string => path.join(projectRoot, 'tests/fixtures', name)

export interface LaunchOptions {
  files?: string[]
  /** Reuse a profile to test persistence; a fresh temporary one by default. */
  userDataDir?: string
}

export interface LaunchedApp {
  app: ElectronApplication
  page: Page
  userDataDir: string
}

/** Environment for the app under test: production build, isolated profile. */
export function appEnv(userDataDir: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== 'VITE_DEV_SERVER_URL') env[key] = value
  }
  env.MDV_USER_DATA_DIR = userDataDir
  return env
}

export function tempDir(prefix: string): string {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)))
}

interface Fixtures {
  launch: (options?: LaunchOptions) => Promise<LaunchedApp>
  /** An app launched without files, showing the welcome screen. */
  welcomeApp: LaunchedApp
  app: ElectronApplication
  page: Page
}

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the destructuring pattern.
  launch: async ({}, use) => {
    const launched: ElectronApplication[] = []
    const createdDirs: string[] = []

    await use(async ({ files = [], userDataDir } = {}) => {
      const profile = userDataDir ?? tempDir('mdv-e2e-')
      if (!userDataDir) createdDirs.push(profile)
      const app = await electron.launch({
        args: [projectRoot, ...files],
        cwd: projectRoot,
        env: appEnv(profile),
        // Playwright forces prefers-color-scheme: light by default; let nativeTheme drive it.
        colorScheme: null,
      })
      launched.push(app)
      const page = await app.firstWindow()
      return { app, page, userDataDir: profile }
    })

    for (const app of launched) await app.close().catch(() => undefined)
    for (const dir of createdDirs) fs.rmSync(dir, { recursive: true, force: true })
  },

  welcomeApp: async ({ launch }, use) => {
    const launched = await launch()
    await expect(launched.page.getByTestId('welcome')).toBeVisible()
    await use(launched)
  },
  app: async ({ welcomeApp }, use) => use(welcomeApp.app),
  page: async ({ welcomeApp }, use) => use(welcomeApp.page),
})

/**
 * Clicks an application menu item by id for the frontmost app window, as choosing it from
 * the menu bar would. Tests run in the background, so no window may have OS focus.
 */
export async function clickMenuItem(app: ElectronApplication, id: string): Promise<void> {
  await app.evaluate(({ Menu, BrowserWindow }, itemId) => {
    const item = Menu.getApplicationMenu()?.getMenuItemById(itemId)
    if (!item) throw new Error(`No menu item with id ${itemId}`)
    // Electron types MenuItem.click as a bare Function.
    const click = item.click as (event: unknown, window?: Electron.BrowserWindow) => void
    click(undefined, BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0])
  }, id)
}

export async function windowTitles(app: ElectronApplication): Promise<string[]> {
  return app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map((window) => window.getTitle()))
}
