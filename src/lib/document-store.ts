import type { Root } from 'hast'
import type { DocumentError, DocumentMessage, FileWatchEvent, LoadedDocument } from '../../shared/ipc'
import { CONFIRM_RENDER_BYTES, HIGHLIGHT_SKIP_BYTES } from '../../shared/markdown-files'
import type { MarkdownWorkerClient } from '../markdown/client'

export type DocumentInfo = Omit<LoadedDocument, 'bytes'>

/**
 * `version` increments every time the displayed content actually changes (a new
 * document, a reload with different bytes, a user choice on the confirm-large screen).
 * Search and scroll restoration use it to know when to act — `entryId` alone doesn't
 * change on Reload/a watch-triggered refresh, since it names the history entry, not the
 * content (§5.3/§6.5). `fileDeleted` is independent of `kind`: the file being watched
 * (§6.4) can disappear while any of these is on screen, and the content underneath stays
 * exactly as it was — only a banner is added.
 */
export type ViewState =
  | { kind: 'welcome'; version: number; fileDeleted: boolean }
  | {
      kind: 'document'
      version: number
      document: DocumentInfo
      hast: Root
      lossy: boolean
      sizeWarning: boolean
      fileDeleted: boolean
    }
  | { kind: 'confirm-large'; version: number; document: DocumentInfo; byteLength: number; fileDeleted: boolean }
  | {
      kind: 'plain-text'
      version: number
      document: DocumentInfo
      text: string
      lossy: boolean
      renderFailed: boolean
      fileDeleted: boolean
    }
  // The Worker itself timed out or crashed: no content survived to fall back to.
  | { kind: 'failed'; version: number; document: DocumentInfo; message: string; fileDeleted: boolean }
  | { kind: 'error'; version: number; error: DocumentError; fileDeleted: boolean }

/** Turns documents pushed by the main process into what the window shows. */
export class DocumentStore {
  private state: ViewState = { kind: 'welcome', version: 0, fileDeleted: false }
  private readonly listeners = new Set<() => void>()
  private latestRequest = 0
  private nextVersion = 1
  /** Bytes held between `confirm-large` and the user's choice; cleared once consumed. */
  private pendingBytes: Uint8Array | null = null

  constructor(private readonly worker: MarkdownWorkerClient) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): ViewState => this.state

  receive(message: DocumentMessage): void {
    const request = ++this.latestRequest
    this.pendingBytes = null
    if (message.type === 'error') {
      this.set({ kind: 'error', version: this.nextVersion++, error: message.error, fileDeleted: false })
      return
    }
    const { bytes, ...document } = message.document
    if (bytes.byteLength > CONFIRM_RENDER_BYTES) {
      this.pendingBytes = bytes
      this.set({ kind: 'confirm-large', version: this.nextVersion++, document, byteLength: bytes.byteLength, fileDeleted: false })
      return
    }
    this.startRender(request, document, bytes, bytes.byteLength > HIGHLIGHT_SKIP_BYTES)
  }

  /** A file-watch notification (§6.4) arrived. 'deleted' shows a banner over whatever is
   * already on screen; 'changed'/'restored' are followed by a fresh `receive()` with the
   * reloaded content, so clearing the flag here just avoids it flashing in between. */
  handleFileState(event: FileWatchEvent): void {
    this.set({ ...this.state, fileDeleted: event === 'deleted' })
  }

  /** The user chose "render anyway" on the confirm-large screen. */
  renderAnyway(): void {
    if (this.state.kind !== 'confirm-large' || !this.pendingBytes) return
    const { document } = this.state
    const bytes = this.pendingBytes
    this.pendingBytes = null
    this.startRender(++this.latestRequest, document, bytes, true)
  }

  /** The user chose "show as plain text" on the confirm-large screen. */
  showAsPlainText(): void {
    if (this.state.kind !== 'confirm-large' || !this.pendingBytes) return
    const { document } = this.state
    const bytes = this.pendingBytes
    this.pendingBytes = null
    const request = ++this.latestRequest
    this.worker.decode(bytes).then(
      ({ text, lossy }) => {
        if (request === this.latestRequest) {
          this.set({ kind: 'plain-text', version: this.nextVersion++, document, text, lossy, renderFailed: false, fileDeleted: false })
        }
      },
      (error: unknown) => {
        if (request === this.latestRequest) this.setFailed(document, error)
      },
    )
  }

  private startRender(request: number, document: DocumentInfo, bytes: Uint8Array, skipHighlight: boolean): void {
    this.worker.render(bytes, document.fileUrl, document.rootUrl, skipHighlight).then(
      (result) => {
        if (request !== this.latestRequest) return
        if (result.ok) {
          this.set({
            kind: 'document',
            version: this.nextVersion++,
            document,
            hast: result.hast,
            lossy: result.lossy,
            sizeWarning: skipHighlight,
            fileDeleted: false,
          })
        } else {
          this.set({
            kind: 'plain-text',
            version: this.nextVersion++,
            document,
            text: result.text,
            lossy: result.lossy,
            renderFailed: true,
            fileDeleted: false,
          })
        }
      },
      (error: unknown) => {
        if (request === this.latestRequest) this.setFailed(document, error)
      },
    )
  }

  private setFailed(document: DocumentInfo, error: unknown): void {
    this.set({
      kind: 'failed',
      version: this.nextVersion++,
      document,
      message: error instanceof Error ? error.message : String(error),
      fileDeleted: false,
    })
  }

  private set(state: ViewState): void {
    this.state = state
    for (const listener of this.listeners) listener()
  }
}
