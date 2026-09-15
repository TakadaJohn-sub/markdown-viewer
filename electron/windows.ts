import { BrowserWindow, dialog, nativeTheme, type OpenDialogOptions } from 'electron'
import { MESSAGES, type Locale } from '../shared/i18n'
import { MARKDOWN_EXTENSIONS } from '../shared/markdown-files'
import { WINDOW_BACKGROUND } from '../shared/theme'
import { APP_ENTRY_URL } from './security/paths'
import { DocumentSession } from './session'
import type { SettingsStore } from './settings'

const CASCADE_OFFSET = 24
const CRASH_WINDOW_MS = 60_000
const MAX_CRASHES_PER_WINDOW = 3

export interface WindowManagerOptions {
  preloadPath: string
  devServerUrl: string | undefined
  settings: SettingsStore
  locale: Locale
}

export class WindowManager {
  /** Keyed by webContents id, which is what IPC events identify the sender by. */
  private readonly sessions = new Map<number, DocumentSession>()

  constructor(private readonly options: WindowManagerOptions) {}

  isManaged(webContentsId: number): boolean {
    return this.sessions.has(webContentsId)
  }

  sessionFor(webContentsId: number): DocumentSession | undefined {
    return this.sessions.get(webContentsId)
  }

  createWindow(): BrowserWindow {
    const { settings, preloadPath, devServerUrl, locale } = this.options
    const { width, height } = settings.get().windowSize
    const anchor = BrowserWindow.getFocusedWindow()?.getBounds()

    const window = new BrowserWindow({
      width,
      height,
      ...(anchor ? { x: anchor.x + CASCADE_OFFSET, y: anchor.y + CASCADE_OFFSET } : {}),
      minWidth: 420,
      minHeight: 320,
      show: false,
      title: MESSAGES[locale].appName,
      backgroundColor: nativeTheme.shouldUseDarkColors ? WINDOW_BACKGROUND.dark : WINDOW_BACKGROUND.light,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        webviewTag: false,
        spellcheck: false,
      },
    })

    const webContentsId = window.webContents.id
    const session = new DocumentSession(window)
    this.sessions.set(webContentsId, session)

    window.once('ready-to-show', () => window.show())
    // The main process owns the title (the document name), not the page's <title>.
    window.on('page-title-updated', (event) => event.preventDefault())
    window.webContents.on('did-finish-load', () => window.webContents.setZoomLevel(settings.get().zoomLevel))
    // A safety net for file-watch events that don't reliably arrive on some mounts (§6.4).
    window.on('focus', () => session.recheckFile())
    window.on('close', () => {
      const { width: w, height: h } = window.getNormalBounds()
      settings.update({ windowSize: { width: w, height: h } })
    })
    window.on('closed', () => {
      session.dispose()
      this.sessions.delete(webContentsId)
    })
    this.recoverFromCrashes(window, session)

    void window.loadURL(devServerUrl ?? APP_ENTRY_URL)
    return window
  }

  /** Open…, drops: the first file replaces what `window` shows, the rest get new windows. */
  openInWindow(window: BrowserWindow | null, paths: readonly string[]): void {
    const [first, ...rest] = paths
    if (first === undefined) return
    const target = window && !window.isDestroyed() ? window : this.createWindow()
    void this.sessions.get(target.webContents.id)?.open(first)
    for (const filePath of rest) this.openInNewWindow(filePath)
  }

  /** Finder, Dock, "Open With", command line: reuse a window still on the welcome screen. */
  openFromSystem(paths: readonly string[]): void {
    const [first, ...rest] = paths
    if (first === undefined) return
    const empty = BrowserWindow.getAllWindows().find(
      (window) => !window.isDestroyed() && this.sessions.get(window.webContents.id)?.isEmpty,
    )
    if (empty) {
      if (empty.isMinimized()) empty.restore()
      empty.focus()
      void this.sessions.get(empty.webContents.id)?.open(first)
    } else {
      this.openInNewWindow(first)
    }
    for (const filePath of rest) this.openInNewWindow(filePath)
  }

  async showOpenDialog(window: BrowserWindow | null): Promise<void> {
    const messages = MESSAGES[this.options.locale]
    const options: OpenDialogOptions = {
      title: messages.dialog.openTitle,
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: messages.dialog.markdownFilter, extensions: [...MARKDOWN_EXTENSIONS] }],
    }
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
    if (!result.canceled) this.openInWindow(window, result.filePaths)
  }

  private openInNewWindow(filePath: string): void {
    const window = this.createWindow()
    void this.sessions.get(window.webContents.id)?.open(filePath)
  }

  private recoverFromCrashes(window: BrowserWindow, session: DocumentSession): void {
    let crashTimes: number[] = []
    window.webContents.on('render-process-gone', (_event, details) => {
      if (details.reason === 'clean-exit' || window.isDestroyed()) return
      const now = Date.now()
      crashTimes = [...crashTimes.filter((time) => now - time < CRASH_WINDOW_MS), now]
      // A document that keeps crashing the renderer is dropped; the reload then shows the welcome screen.
      if (crashTimes.length >= MAX_CRASHES_PER_WINDOW) session.clear()
      window.webContents.reload()
    })
  }
}
