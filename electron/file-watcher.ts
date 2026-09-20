import crypto from 'node:crypto'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import type { FileWatchEvent } from '../shared/ipc'

/** Coalesces the burst of fs events one save can produce ("write temp file, then rename"). */
const DEBOUNCE_MS = 200

/**
 * Watches the single file currently displayed in a window (§6.4). Watches the *parent
 * directory* rather than the file itself and filters by name — watching a file directly
 * misses the rest of a "write a temp file, then rename over the original" save, which is
 * how VS Code and many other editors save. Content is hashed (not just stat-compared) so a
 * save that rewrites identical bytes doesn't trigger a spurious reload.
 */
export class FileWatcher {
  private watcher: fs.FSWatcher | null = null
  private watchedPath: string | null = null
  private lastHash: string | null = null
  private missing = false
  private debounceTimer: NodeJS.Timeout | undefined
  private generation = 0

  constructor(private readonly onEvent: (event: FileWatchEvent) => void) {}

  /** Starts watching `filePath`, replacing whatever this instance was watching before. */
  async watch(filePath: string): Promise<void> {
    this.stop()
    const generation = ++this.generation
    this.watchedPath = filePath
    this.missing = false
    this.lastHash = await this.hashOf(filePath)

    try {
      const watcher = fs.watch(path.dirname(filePath), (_eventType, changedFilename) => {
        if (changedFilename !== null && changedFilename !== path.basename(filePath)) return
        this.scheduleCheck()
      })
      // A watch() started after an async stat could have been superseded by a newer watch()
      // call while awaiting; drop it rather than leaking a watcher on the wrong file.
      if (generation !== this.generation) {
        watcher.close()
        return
      }
      watcher.on('error', () => this.stop())
      this.watcher = watcher
      // A change made between reading `lastHash` above and the watcher going live is never
      // delivered as an fs event (macOS drops events from before the stream is armed), so
      // check once now rather than leaving it undetected until the next event or refocus.
      this.scheduleCheck()
    } catch {
      // Some mounts (certain network drives) don't support directory watching; window-focus
      // `recheck()` is the fallback safety net (§6.4), so degrade silently rather than throw.
    }
  }

  /** Stops watching; called when the window moves to a different file, or is closed. */
  stop(): void {
    this.generation += 1
    this.watcher?.close()
    this.watcher = null
    this.watchedPath = null
    clearTimeout(this.debounceTimer)
  }

  /** Called when the window regains focus — catches changes on mounts whose watch events
   * don't reliably arrive (§6.4). */
  recheck(): void {
    if (this.watchedPath) this.scheduleCheck()
  }

  private scheduleCheck(): void {
    clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => void this.check(), DEBOUNCE_MS)
  }

  private async hashOf(filePath: string): Promise<string | null> {
    try {
      const data = await fsPromises.readFile(filePath)
      return crypto.createHash('sha1').update(data).digest('hex')
    } catch {
      return null
    }
  }

  private async check(): Promise<void> {
    const filePath = this.watchedPath
    if (!filePath) return
    const hash = await this.hashOf(filePath)
    if (filePath !== this.watchedPath) return // watch() was called again while hashing

    if (hash === null) {
      if (!this.missing) {
        this.missing = true
        this.lastHash = null
        this.onEvent('deleted')
      }
      return
    }
    if (this.missing) {
      this.missing = false
      this.lastHash = hash
      this.onEvent('restored')
      return
    }
    if (hash === this.lastHash) return
    this.lastHash = hash
    this.onEvent('changed')
  }
}
