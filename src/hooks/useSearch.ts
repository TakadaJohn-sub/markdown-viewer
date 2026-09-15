import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { findMatches } from '../lib/search-match'

const DEBOUNCE_MS = 120
const MAX_MATCHES = 10_000
const HIGHLIGHT_ALL = 'mdv-search'
const HIGHLIGHT_CURRENT = 'mdv-search-current'

function highlightApiAvailable(): boolean {
  return typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined'
}

interface TextSpan {
  node: Text
  start: number
  end: number
}

function collectTextSpans(root: Element): { text: string; spans: TextSpan[] } {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let text = ''
  const spans: TextSpan[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const value = node.textContent
    if (!value) continue
    spans.push({ node: node as Text, start: text.length, end: text.length + value.length })
    text += value
  }
  return { text, spans }
}

function spanAt(spans: TextSpan[], offset: number): TextSpan | undefined {
  return spans.find((span) => offset >= span.start && offset <= span.end)
}

/**
 * Ranges for one "block" — a container within which a match may span several text nodes
 * (Shiki splits code into many spans) but never crosses into another block (§16).
 */
function rangesForBlock(block: Element, query: string, caseSensitive: boolean, budget: number): Range[] {
  const { text, spans } = collectTextSpans(block)
  if (spans.length === 0) return []
  const ranges: Range[] = []
  for (const match of findMatches(text, query, caseSensitive, budget)) {
    const startSpan = spanAt(spans, match.start)
    const endSpan = spanAt(spans, match.end)
    if (!startSpan || !endSpan) continue
    const range = document.createRange()
    range.setStart(startSpan.node, match.start - startSpan.start)
    range.setEnd(endSpan.node, match.end - endSpan.start)
    ranges.push(range)
  }
  return ranges
}

function openAncestorDetails(node: Node): void {
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
  for (let details = element?.closest('details'); details; details = details.parentElement?.closest('details') ?? null) {
    details.open = true
  }
}

export interface SearchApi {
  isOpen: boolean
  query: string
  setQuery: (value: string) => void
  caseSensitive: boolean
  toggleCaseSensitive: () => void
  matchCount: number
  matchCountLabel: string
  currentIndex: number
  /** Bumped on every `open()` call, even if already open, so the input can refocus. */
  focusToken: number
  next: () => void
  previous: () => void
  open: () => void
  close: () => void
}

/**
 * CSS Custom Highlight API search (§16) over whatever `containerRef` currently holds.
 * Deliberately not `webContents.findInPage`: that can't be scoped to just the document body.
 */
export function useSearch(containerRef: RefObject<HTMLElement | null>, documentVersion: number, hasContent: boolean): SearchApi {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [matchCount, setMatchCount] = useState(0)
  const [truncated, setTruncated] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [focusToken, setFocusToken] = useState(0)
  const rangesRef = useRef<Range[]>([])

  const clearHighlights = useCallback(() => {
    if (!highlightApiAvailable()) return
    CSS.highlights.delete(HIGHLIGHT_ALL)
    CSS.highlights.delete(HIGHLIGHT_CURRENT)
  }, [])

  const rebuild = useCallback(() => {
    const container = containerRef.current
    if (!container || query === '') {
      rangesRef.current = []
      setMatchCount(0)
      setTruncated(false)
      setCurrentIndex(0)
      clearHighlights()
      return
    }
    // One "block" per top-level child keeps matches from spanning unrelated paragraphs;
    // a container with no element children (e.g. <pre>) is itself the only block.
    const blocks = container.children.length > 0 ? Array.from(container.children) : [container]
    const ranges: Range[] = []
    for (const block of blocks) {
      if (ranges.length >= MAX_MATCHES) break
      ranges.push(...rangesForBlock(block, query, caseSensitive, MAX_MATCHES - ranges.length))
    }
    rangesRef.current = ranges
    setTruncated(ranges.length >= MAX_MATCHES)
    setMatchCount(ranges.length)
    setCurrentIndex((index) => (ranges.length === 0 ? 0 : Math.min(index, ranges.length - 1)))
  }, [containerRef, query, caseSensitive, clearHighlights])

  // Typing is debounced; a document swap underneath (reload, render finishing) re-searches
  // immediately so stale highlights never linger on the wrong content.
  useEffect(() => {
    if (!isOpen) return
    const timer = window.setTimeout(rebuild, DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [isOpen, rebuild])

  useEffect(() => {
    if (isOpen) rebuild()
    // Only the document's identity should force an immediate (non-debounced) re-search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentVersion])

  useEffect(() => {
    if (!highlightApiAvailable()) return
    const ranges = rangesRef.current
    if (ranges.length === 0) {
      clearHighlights()
      return
    }
    CSS.highlights.set(HIGHLIGHT_ALL, new Highlight(...ranges))
    const current = ranges[currentIndex]
    if (current) CSS.highlights.set(HIGHLIGHT_CURRENT, new Highlight(current))
  }, [matchCount, currentIndex, clearHighlights])

  useEffect(() => {
    if (!isOpen) return
    const current = rangesRef.current[currentIndex]
    if (!current) return
    openAncestorDetails(current.startContainer)
    const element =
      current.startContainer.nodeType === Node.ELEMENT_NODE
        ? (current.startContainer as Element)
        : current.startContainer.parentElement
    element?.scrollIntoView({ block: 'center' })
  }, [currentIndex, matchCount, isOpen])

  useEffect(() => clearHighlights, [clearHighlights])

  const move = useCallback((delta: number) => {
    setCurrentIndex((index) => {
      const count = rangesRef.current.length
      return count === 0 ? 0 : (index + delta + count) % count
    })
  }, [])

  const open = useCallback(() => {
    if (!hasContent) return
    setIsOpen(true)
    setFocusToken((token) => token + 1)
  }, [hasContent])

  const close = useCallback(() => {
    setIsOpen(false)
    clearHighlights()
  }, [clearHighlights])

  return {
    isOpen,
    query,
    setQuery,
    caseSensitive,
    toggleCaseSensitive: () => setCaseSensitive((value) => !value),
    matchCount,
    matchCountLabel: truncated ? '10000+' : String(matchCount),
    currentIndex,
    focusToken,
    next: () => move(1),
    previous: () => move(-1),
    open,
    close,
  }
}
