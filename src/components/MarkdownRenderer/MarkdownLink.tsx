import { useCallback, type AnchorHTMLAttributes, type MouseEvent } from 'react'
import { useLinkOutcome } from '../../lib/link-outcome'
import { scrollToFragment } from '../../lib/scroll-to-fragment'

/**
 * Replaces every `a` in the rendered document (§5). `#fragment` links are resolved
 * entirely in the renderer; everything else is handed to Main, which decides whether to
 * open it externally, open it as a document, reveal it in Finder, or refuse it (§5.1) —
 * the renderer never resolves a path or decides what's safe to open on its own.
 */
export function MarkdownLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const reportOutcome = useLinkOutcome()
  const { href, onClick, ...rest } = props

  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event)
      if (event.defaultPrevented || !href) return
      event.preventDefault()
      if (href.startsWith('#')) {
        scrollToFragment(href.slice(1))
        return
      }
      void window.mdv.followLink(href).then((outcome) => reportOutcome(outcome, href))
    },
    [href, onClick, reportOutcome],
  )

  return <a {...rest} href={href} onClick={href ? handleClick : onClick} />
}
