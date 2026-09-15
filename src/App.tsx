import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { DocumentErrorCode, LinkResult } from '../shared/ipc'
import { Banner } from './components/Banner/Banner'
import { ConfirmLarge } from './components/ConfirmLarge/ConfirmLarge'
import { CustomCssPanel } from './components/CustomCssPanel/CustomCssPanel'
import { ErrorView } from './components/ErrorView/ErrorView'
import { MarkdownRenderer } from './components/MarkdownRenderer/MarkdownRenderer'
import { OpenFileButton } from './components/OpenFileButton/OpenFileButton'
import { PlainTextView } from './components/PlainTextView/PlainTextView'
import { Search } from './components/Search/Search'
import { TableOfContents } from './components/TableOfContents/TableOfContents'
import { Welcome } from './components/Welcome/Welcome'
import { useFileDrop } from './hooks/useFileDrop'
import { useScrollRestoration, type ScrollTarget } from './hooks/useScrollRestoration'
import { useSearch } from './hooks/useSearch'
import type { DocumentStore } from './lib/document-store'
import { useMessages } from './lib/i18n'
import { LinkOutcomeContext, type LinkOutcomeHandler } from './lib/link-outcome'
import './App.css'

/** Errors that may go away on their own (the file appears, permissions change). */
const RETRYABLE_ERRORS: readonly DocumentErrorCode[] = ['not-found', 'permission-denied', 'read-failed']
const BANNER_DISPLAY_MS = 5000

const openDroppedFiles = (files: File[]): void => void window.mdv.openDroppedFiles(files)

/** True while an Alt+←/→ press should be left to whatever's focused (§10) instead of
 * being read as "go back"/"go forward" — a text input's own Option+Arrow word-navigation. */
function isTextInputFocused(): boolean {
  const active = document.activeElement
  return active instanceof HTMLElement && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')
}

export function App({
  store,
  platform,
  initialTocVisible,
  initialCustomCss,
}: {
  store: DocumentStore
  platform: string
  initialTocVisible: boolean
  initialCustomCss: string
}) {
  const view = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const dropActive = useFileDrop(openDroppedFiles)
  const t = useMessages()

  const [linkBanner, setLinkBanner] = useState<string | null>(null)
  const bannerTimerRef = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(bannerTimerRef.current), [])

  const showLinkBanner = useCallback((message: string) => {
    setLinkBanner(message)
    window.clearTimeout(bannerTimerRef.current)
    bannerTimerRef.current = window.setTimeout(() => setLinkBanner(null), BANNER_DISPLAY_MS)
  }, [])

  const reportLinkOutcome = useCallback<LinkOutcomeHandler>(
    (outcome: LinkResult) => {
      if (outcome === 'not-found') showLinkBanner(t.banner.linkNotFound)
      else if (outcome === 'unsupported') showLinkBanner(t.banner.linkUnsupported)
    },
    [showLinkBanner, t],
  )

  // A single ref reused across whichever content view is currently mounted; search and the
  // table of contents both read its `.current` directly, so they always see what's on screen.
  const containerRef = useRef<HTMLElement | null>(null)
  const contentRef = useCallback((node: HTMLElement | null) => {
    containerRef.current = node
  }, [])

  const hasSearchableContent = view.kind === 'document' || view.kind === 'plain-text'
  const search = useSearch(containerRef, view.version, hasSearchableContent)
  const { isOpen: searchOpen, close: closeSearch, open: openSearch, next: nextMatch, previous: previousMatch } = search

  const scrollTarget: ScrollTarget | null =
    view.kind === 'document' || view.kind === 'plain-text'
      ? { entryId: view.document.entryId, reason: view.document.reason, fragment: view.document.fragment, version: view.version }
      : null
  useScrollRestoration(containerRef, scrollTarget)

  const [tocVisible, setTocVisible] = useState(initialTocVisible)
  const closeToc = useCallback(() => {
    setTocVisible(false)
    void window.mdv.setTocVisible(false)
  }, [])

  const [customCss, setCustomCss] = useState(initialCustomCss)
  const [customCssPanelOpen, setCustomCssPanelOpen] = useState(false)

  useEffect(
    () =>
      window.mdv.onMenuCommand((command) => {
        if (command === 'find') openSearch()
        else if (command === 'find-next') nextMatch()
        else if (command === 'find-previous') previousMatch()
        else if (command === 'toggle-toc') {
          setTocVisible((visible) => {
            const next = !visible
            void window.mdv.setTocVisible(next)
            return next
          })
        } else if (command === 'toggle-custom-css') {
          setCustomCssPanelOpen((open) => !open)
        }
      }),
    [openSearch, nextMatch, previousMatch],
  )

  // Global, not just on the input, so Escape closes the bar no matter where focus is.
  useEffect(() => {
    if (!searchOpen) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeSearch()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [searchOpen, closeSearch])

  // Alt+←/→ (§10) — handled here rather than as a menu accelerator, which can't be
  // disabled on macOS and would otherwise swallow Option+←/→ word-navigation in the
  // search input.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
      if (isTextInputFocused()) return
      event.preventDefault()
      void (event.key === 'ArrowLeft' ? window.mdv.goBack() : window.mdv.goForward())
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Unified per §8.5: every banner — link outcome, encoding, size, render failure, the
  // watched file disappearing — is a thin bar stacked above the content, never a modal.
  const banners: { message: string; tone: 'info' | 'warning' }[] = []
  if (linkBanner) banners.push({ message: linkBanner, tone: 'info' })
  if (view.fileDeleted) banners.push({ message: t.banner.fileDeleted, tone: 'warning' })
  if (view.kind === 'document') {
    if (view.sizeWarning) banners.push({ message: t.banner.largeFileSkipHighlight, tone: 'warning' })
    if (view.lossy) banners.push({ message: t.lossyEncoding, tone: 'warning' })
  }
  if (view.kind === 'plain-text') {
    if (view.renderFailed) banners.push({ message: t.error.renderFailed, tone: 'warning' })
    if (view.lossy) banners.push({ message: t.lossyEncoding, tone: 'warning' })
  }

  let content
  switch (view.kind) {
    case 'welcome':
      content = <Welcome platform={platform} />
      break
    case 'document':
      content = <MarkdownRenderer hast={view.hast} contentRef={contentRef} />
      break
    case 'confirm-large':
      content = (
        <ConfirmLarge
          byteLength={view.byteLength}
          onShowPlainText={() => store.showAsPlainText()}
          onRenderAnyway={() => store.renderAnyway()}
        />
      )
      break
    case 'plain-text':
      content = <PlainTextView text={view.text} contentRef={contentRef} />
      break
    case 'failed':
      content = <ErrorView message={view.message} path={view.document.name} canRetry />
      break
    case 'error':
      content = (
        <ErrorView
          message={t.error.codes[view.error.code]}
          path={view.error.path}
          canRetry={RETRYABLE_ERRORS.includes(view.error.code)}
        />
      )
      break
  }

  return (
    <LinkOutcomeContext value={reportLinkOutcome}>
      {customCss && <style>{customCss}</style>}
      <OpenFileButton />
      {banners.length > 0 && (
        <div className="banner-stack">
          {banners.map((banner) => (
            <Banner key={banner.message} tone={banner.tone}>
              {banner.message}
            </Banner>
          ))}
        </div>
      )}
      {content}
      {tocVisible && hasSearchableContent && (
        <TableOfContents containerRef={containerRef} documentVersion={view.version} onClose={closeToc} />
      )}
      {search.isOpen && <Search api={search} />}
      {customCssPanelOpen && (
        <CustomCssPanel css={customCss} onChange={setCustomCss} onClose={() => setCustomCssPanelOpen(false)} />
      )}
      {dropActive && (
        <div className="drop-overlay" aria-hidden="true">
          <span className="drop-overlay__label">{t.dropOverlay}</span>
        </div>
      )}
    </LinkOutcomeContext>
  )
}
