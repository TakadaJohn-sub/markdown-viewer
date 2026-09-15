import { app, type BrowserWindow } from 'electron'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { IpcChannel, type DocumentMessage, type FileWatchEvent, type LoadReason } from '../shared/ipc'
import { findRepositoryRoot, readDocument } from './document-reader'
import { FileWatcher } from './file-watcher'
import type { CurrentDocument } from './link-router'

/** §5.3: capped so a very long browsing session in one window can't grow this unboundedly. */
const MAX_HISTORY_ENTRIES = 100

interface HistoryEntry {
  entryId: number
  path: string
}

/**
 * Owns what one window displays: its navigation history (§5.3) and the live watch on
 * whichever file is currently on screen (§6.4). The renderer never decides which file is
 * read — it can only ask to reload/go back/go forward, or hand over paths the user
 * explicitly picked, dropped, or clicked a link to.
 */
export class DocumentSession {
  private history: HistoryEntry[] = []
  private historyIndex = -1
  private nextEntryId = 1
  private currentDocument: CurrentDocument | null = null
  private loadSequence = 0
  private loading = false
  private rendererReady = false
  private pending: DocumentMessage | null = null
  private readonly watcher = new FileWatcher((event) => this.onFileEvent(event))

  constructor(private readonly window: BrowserWindow) {
    // A page that (re)loads must ask for its initial state before it can receive documents.
    window.webContents.on('did-start-loading', () => {
      this.rendererReady = false
    })
  }

  /** True for a window still showing the welcome screen. */
  get isEmpty(): boolean {
    return this.history.length === 0 && !this.loading
  }

  /** The document links/images resolve against; null until something has loaded. */
  getCurrentDocument(): CurrentDocument | null {
    return this.currentDocument
  }

  /** A fresh open — Cmd+O, drag-and-drop, Finder, a second launch. Pushes history (§5.3).
   * Registered with the OS's own "recent documents" list (§17 Phase 3) — `navigate`
   * (following a Markdown link) deliberately does not, so browsing within a document
   * doesn't flood Recent Items with every page it happened to link to. */
  open(filePath: string): Promise<void> {
    app.addRecentDocument(filePath)
    return this.pushAndLoad(filePath, 'open')
  }

  /** Following a Markdown link, in this same window (§5.1). Pushes history like `open`. */
  navigate(filePath: string, fragment?: string): Promise<void> {
    return this.pushAndLoad(filePath, 'navigate', fragment)
  }

  back(): Promise<void> {
    if (this.historyIndex <= 0) return Promise.resolve()
    this.historyIndex -= 1
    return this.loadHistoryEntry('back')
  }

  forward(): Promise<void> {
    if (this.historyIndex >= this.history.length - 1) return Promise.resolve()
    this.historyIndex += 1
    return this.loadHistoryEntry('forward')
  }

  get canGoBack(): boolean {
    return this.historyIndex > 0
  }

  get canGoForward(): boolean {
    return this.historyIndex < this.history.length - 1
  }

  reload(): Promise<void> {
    return this.loadHistoryEntry('reload')
  }

  /** Called when the window regains focus — a safety net for watchers that miss events. */
  recheckFile(): void {
    this.watcher.recheck()
  }

  /** Forgets the document so the next page load shows the welcome screen. */
  clear(): void {
    this.loadSequence += 1
    this.history = []
    this.historyIndex = -1
    this.currentDocument = null
    this.loading = false
    this.pending = null
    this.watcher.stop()
  }

  /** Called when the window itself is closing. */
  dispose(): void {
    this.watcher.stop()
  }

  /** Called when the renderer asks for its initial state. */
  takePending(): DocumentMessage | null {
    this.rendererReady = true
    const pending = this.pending
    this.pending = null
    // After a renderer reload the page lost what it displayed, so send it again.
    if (!pending && !this.loading && this.history.length > 0) void this.reload()
    return pending
  }

  private pushAndLoad(filePath: string, reason: 'open' | 'navigate', fragment?: string): Promise<void> {
    // Clicking a link (or opening a new file) after going back drops the abandoned "forward" entries.
    this.history = this.history.slice(0, this.historyIndex + 1)
    this.history.push({ entryId: this.nextEntryId++, path: filePath })
    if (this.history.length > MAX_HISTORY_ENTRIES) this.history.shift()
    this.historyIndex = this.history.length - 1
    return this.load(filePath, reason, fragment)
  }

  private loadHistoryEntry(reason: Extract<LoadReason, 'back' | 'forward' | 'reload' | 'watch'>): Promise<void> {
    const entry = this.history[this.historyIndex]
    return entry ? this.load(entry.path, reason) : Promise.resolve()
  }

  private onFileEvent(event: FileWatchEvent): void {
    if (this.window.isDestroyed()) return
    this.window.webContents.send(IpcChannel.fileState, event)
    // 'deleted' has nothing to load — the renderer keeps showing the last content with a
    // banner instead (§13). 'changed'/'restored' both mean "the same file is readable
    // again with (possibly) new bytes", so re-deliver it the same way Reload does.
    if (event === 'changed' || event === 'restored') void this.loadHistoryEntry('watch')
  }

  private async load(filePath: string, reason: LoadReason, fragment?: string): Promise<void> {
    const sequence = ++this.loadSequence
    this.loading = true
    const [result, repositoryRoot] = await Promise.all([readDocument(filePath), findRepositoryRoot(filePath)])
    if (sequence !== this.loadSequence || this.window.isDestroyed()) return
    this.loading = false

    const name = path.basename(filePath)
    this.window.setTitle(name)
    if (process.platform === 'darwin') this.window.setRepresentedFilename(result.ok ? filePath : '')

    if (!result.ok) {
      this.currentDocument = null
      this.watcher.stop()
      this.deliver({ type: 'error', error: { code: result.code, path: filePath, name } })
      return
    }

    void this.watcher.watch(filePath)
    // A trailing separator makes the root usable as a URL base.
    const root = repositoryRoot === null ? path.parse(filePath).root : repositoryRoot + path.sep
    const fileUrl = pathToFileURL(filePath).href
    const rootUrl = pathToFileURL(root).href
    this.currentDocument = { fileUrl, rootUrl }
    const entryId = this.history[this.historyIndex]?.entryId ?? this.nextEntryId++
    this.deliver({
      type: 'loaded',
      document: {
        entryId,
        fileUrl,
        rootUrl,
        name,
        bytes: result.bytes,
        fragment,
        reason,
        canGoBack: this.canGoBack,
        canGoForward: this.canGoForward,
      },
    })
  }

  private deliver(message: DocumentMessage): void {
    if (this.rendererReady) this.window.webContents.send(IpcChannel.document, message)
    else this.pending = message
  }
}
