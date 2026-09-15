import { useEffect, useState } from 'react'
import type { HeadingItem } from './useHeadings'

/**
 * Which heading the reader is "in", for the table of contents to highlight (§8.4). A
 * heading counts as current while it's in the top 30% of the viewport; among several at
 * once (a short section whose next heading has already scrolled into that band too), the
 * earliest in document order wins — that's the section still being read.
 */
export function useActiveHeading(headings: HeadingItem[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    if (headings.length === 0) return
    const elements = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((element): element is HTMLElement => element !== null)
    if (elements.length === 0) return

    const visible = new Set<string>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id)
          else visible.delete(entry.target.id)
        }
        const current = headings.find((heading) => visible.has(heading.id))
        if (current) setActiveId(current.id)
      },
      { rootMargin: '0px 0px -70% 0px', threshold: 0 },
    )
    for (const element of elements) observer.observe(element)
    return () => observer.disconnect()
  }, [headings])

  // Derived rather than reset via a second effect: a new document's headings won't
  // contain the previous one's activeId, so this alone drops a stale highlight.
  return headings.some((heading) => heading.id === activeId) ? activeId : null
}
