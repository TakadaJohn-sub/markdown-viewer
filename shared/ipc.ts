import type { Locale } from './i18n'

export const IpcChannel = {
  getInitialState: 'mdv:get-initial-state',
  openDialog: 'mdv:open-dialog',
  openPaths: 'mdv:open-paths',
  reload: 'mdv:reload',
  followLink: 'mdv:follow-link',
  goBack: 'mdv:go-back',
  goForward: 'mdv:go-forward',
  setTocVisible: 'mdv:set-toc-visible',
  setCustomCss: 'mdv:set-custom-css',
  document: 'mdv:document',
  menuCommand: 'mdv:menu-command',
  fileState: 'mdv:file-state',
} as const

export type LoadReason = 'open' | 'navigate' | 'back' | 'forward' | 'reload' | 'watch'

export interface LoadedDocument {
  /** History entry id. Stays the same across `reload`/`watch`; a new one for every other reason. */
  entryId: number
  /** `file:` URL of the document, the base for relative links and images. */
  fileUrl: string
  /** `file:` URL that root-relative paths ("/docs/a.md") resolve against. */
  rootUrl: string
  name: string
  bytes: Uint8Array
  /** A heading to scroll to, from the link that was followed (`navigate` only). */
  fragment?: string
  reason: LoadReason
  canGoBack: boolean
  canGoForward: boolean
}

export type DocumentErrorCode =
  | 'not-found'
  | 'permission-denied'
  | 'not-a-file'
  | 'not-markdown'
  | 'too-large'
  | 'binary'
  | 'read-failed'

export interface DocumentError {
  code: DocumentErrorCode
  path: string
  name: string
}

export type DocumentMessage =
  | { type: 'loaded'; document: LoadedDocument }
  | { type: 'error'; error: DocumentError }

export interface InitialState {
  locale: Locale
  platform: string
  /** Table of contents panel visibility, saved across launches (§8.4). */
  tocVisible: boolean
  /** User-authored CSS applied to every window, saved across launches (§17 Phase 3). */
  customCss: string
  /** A document that finished loading before the renderer was ready. */
  pending: DocumentMessage | null
}

/**
 * What happened when the renderer asked Main to follow a link (§5.1 of the design doc).
 * 'external' — handed to the OS browser/mail client. 'opened' — a Markdown file (or a
 * directory's README/index) was navigated to in this window. 'revealed' — a non-Markdown
 * file was shown in Finder. 'not-found' / 'unsupported' — nothing happened; the renderer
 * shows a banner.
 */
export type LinkResult = 'external' | 'opened' | 'revealed' | 'not-found' | 'unsupported'

/** Commands the application menu sends to the focused window's renderer. */
export type MenuCommand = 'find' | 'find-next' | 'find-previous' | 'toggle-toc' | 'toggle-custom-css'

/**
 * Pushed when the file being watched (§6.4) changes on disk. 'changed'/'restored' are
 * followed by a fresh `onDocument` delivery (the actual reload); 'deleted' is not — there is
 * nothing to load, so the renderer keeps showing the last content with a banner instead.
 */
export type FileWatchEvent = 'changed' | 'deleted' | 'restored'

/** The whole API exposed to the renderer as `window.mdv`. */
export interface MdvApi {
  getInitialState(): Promise<InitialState>
  openDialog(): Promise<void>
  openDroppedFiles(files: File[]): Promise<void>
  reload(): Promise<void>
  followLink(href: string): Promise<LinkResult>
  goBack(): Promise<void>
  goForward(): Promise<void>
  setTocVisible(visible: boolean): Promise<void>
  setCustomCss(css: string): Promise<void>
  onDocument(listener: (message: DocumentMessage) => void): () => void
  onMenuCommand(listener: (command: MenuCommand) => void): () => void
  onFileState(listener: (state: FileWatchEvent) => void): () => void
}
