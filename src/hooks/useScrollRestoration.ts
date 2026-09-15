import { useLayoutEffect, useRef, type RefObject } from 'react'
import type { LoadReason } from '../../shared/ipc'
import { scrollToFragment } from '../lib/scroll-to-fragment'

export interface ScrollTarget {
  entryId: number
  reason: LoadReason
  fragment?: string
  /** Bumped on every content swap — the effect's real dependency (§6.5's "displayed content
   * changed", not the history entry, which `reload`/`watch` reuse). */
  version: number
}

interface TopAnchor {
  line: number
  offsetPx: number
}

/** How long after a swap an image finishing its own load can still nudge the scroll
 * position back to the anchor (§6.5) — long enough for most above-the-fold images. */
const REALIGN_WINDOW_MS = 500

function readLine(element: Element): number | null {
  const line = Number(element.getAttribute('data-line'))
  return Number.isFinite(line) ? line : null
}

/** The top-level block currently at (or just above) the viewport's top edge, and how far
 * past its own top the viewport already is — the anchor to restore after a reload. */
function captureTopAnchor(container: HTMLElement | null): TopAnchor | null {
  if (!container) return null
  let target: Element | null = null
  for (const block of container.children) {
    if (block.getBoundingClientRect().top > 0) break
    target = block
  }
  target ??= container.children[0] ?? null
  if (!target) return null
  const line = readLine(target)
  if (line === null) return null
  return { line, offsetPx: -target.getBoundingClientRect().top }
}

/** Scrolls so the block at (or just before) `anchor.line` sits at the same offset it did
 * when the anchor was captured — even if the reload shifted exactly which block that is. */
function applyTopAnchor(container: HTMLElement | null, anchor: TopAnchor | null): void {
  if (!container || !anchor) return
  let best: Element | null = null
  let bestLine = Number.NEGATIVE_INFINITY
  for (const block of container.children) {
    const line = readLine(block)
    if (line !== null && line <= anchor.line && line > bestLine) {
      best = block
      bestLine = line
    }
  }
  if (!best) return
  const delta = best.getBoundingClientRect().top + anchor.offsetPx
  window.scrollBy(0, delta)
}

/**
 * Keeps the reader's place across a document swap (§5.3/§6.5): back/forward restore the
 * exact scroll position last seen for that history entry; a reload or a file-watch refresh
 * instead re-anchors to the same *content* (§6.5), which stays right even if the file
 * changed slightly above the fold; a fresh open/navigate goes to the top, or to `fragment`.
 *
 * The scroll listener that records "current position" is set up fresh, bound to this
 * render's own `entryId`, every time the displayed content changes (rather than reading a
 * separately-updated "which entry is current" ref) — that ordering is what makes it
 * impossible for a scroll event to land against the wrong entry around the moment of a swap.
 */
export function useScrollRestoration(containerRef: RefObject<HTMLElement | null>, target: ScrollTarget | null): void {
  const entryScrollY = useRef(new Map<number, number>())
  const topAnchor = useRef<TopAnchor | null>(null)

  useLayoutEffect(() => {
    if (!target) return
    // Bound once per effect run so the nested closures below don't need to re-check it —
    // and so TypeScript can see it's non-null without an assertion.
    const current = target
    // Whatever the previous entry's listener last recorded — untouched by this render yet.
    const anchorBeforeSwap = topAnchor.current

    function restore() {
      switch (current.reason) {
        case 'open':
        case 'navigate':
          if (current.fragment) scrollToFragment(current.fragment)
          else window.scrollTo(0, 0)
          break
        case 'back':
        case 'forward':
          window.scrollTo(0, entryScrollY.current.get(current.entryId) ?? 0)
          break
        case 'reload':
        case 'watch':
          applyTopAnchor(containerRef.current, anchorBeforeSwap)
          break
      }
    }
    restore()

    function trackScroll() {
      entryScrollY.current.set(current.entryId, window.scrollY)
      topAnchor.current = captureTopAnchor(containerRef.current)
    }
    trackScroll() // a baseline for this entry immediately, even if the reader never scrolls
    window.addEventListener('scroll', trackScroll, { passive: true })

    // Only reload/watch re-anchor to content rather than an absolute position, so only
    // those are worth re-running as images shift the layout underneath the target block.
    let onImageLoad: (() => void) | undefined
    let realignTimer: number | undefined
    const container = containerRef.current
    if ((current.reason === 'reload' || current.reason === 'watch') && container) {
      const deadline = Date.now() + REALIGN_WINDOW_MS
      onImageLoad = () => {
        if (Date.now() <= deadline) restore()
      }
      container.addEventListener('load', onImageLoad, true)
      realignTimer = window.setTimeout(() => {
        if (onImageLoad) container.removeEventListener('load', onImageLoad, true)
      }, REALIGN_WINDOW_MS)
    }

    return () => {
      window.removeEventListener('scroll', trackScroll)
      if (onImageLoad) container?.removeEventListener('load', onImageLoad, true)
      window.clearTimeout(realignTimer)
    }
    // Deliberately field-level, not `target` itself: the caller passes a fresh object
    // literal every render, and re-running this on every render (rather than only when a
    // field actually changes) would re-apply `restore()` while the reader is scrolling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, target?.entryId, target?.reason, target?.fragment, target?.version])
}
