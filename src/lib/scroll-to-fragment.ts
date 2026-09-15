/**
 * Resolves a Markdown `#fragment` the way GitHub does (§5.2): most ids in our sanitized
 * output are exactly what the fragment says, but ones sanitize clobber-prefixed (raw HTML
 * ids, footnote refs — §3.2) need the `user-content-` prefix added back on to be found.
 */
export function resolveFragment(rawFragment: string): HTMLElement | null {
  let id: string
  try {
    id = decodeURIComponent(rawFragment)
  } catch {
    id = rawFragment
  }
  return document.getElementById(id) ?? document.getElementById(`user-content-${id}`)
}

/** Opens any closed `<details>` ancestor so the target isn't hidden, then scrolls to it. */
export function scrollToFragment(rawFragment: string): boolean {
  const element = resolveFragment(rawFragment)
  if (!element) return false
  for (let ancestor = element.closest('details'); ancestor; ancestor = ancestor.parentElement?.closest('details') ?? null) {
    ancestor.open = true
  }
  element.scrollIntoView({ block: 'start' })
  return true
}
