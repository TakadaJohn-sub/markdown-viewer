import { useEffect, useState, type RefObject } from 'react'

export interface HeadingItem {
  id: string
  text: string
  depth: 1 | 2 | 3
}

function extractHeadings(container: Element): HeadingItem[] {
  return Array.from(container.querySelectorAll('h1, h2, h3'))
    .filter((element): element is HTMLHeadingElement => element.id !== '')
    .map((element) => ({ id: element.id, text: element.textContent ?? '', depth: Number(element.tagName[1]) as 1 | 2 | 3 }))
}

/** h1–h3 in the current document, for the table of contents (§8.4). Re-scans whenever the
 * displayed content changes; a heading without an id (rehype-slug should give every one
 * an id, but a duplicate-title edge case could theoretically fail to) is left out, since
 * there'd be nothing to scroll to or highlight. */
export function useHeadings(containerRef: RefObject<HTMLElement | null>, documentVersion: number): HeadingItem[] {
  const [headings, setHeadings] = useState<HeadingItem[]>([])

  useEffect(() => {
    const container = containerRef.current
    setHeadings(container ? extractHeadings(container) : [])
  }, [containerRef, documentVersion])

  return headings
}
