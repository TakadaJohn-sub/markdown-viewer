import { type RefObject } from 'react'
import { useActiveHeading } from '../../hooks/useActiveHeading'
import { useHeadings } from '../../hooks/useHeadings'
import { useMessages } from '../../lib/i18n'
import { scrollToFragment } from '../../lib/scroll-to-fragment'
import './TableOfContents.css'

interface TableOfContentsProps {
  containerRef: RefObject<HTMLElement | null>
  documentVersion: number
  onClose: () => void
}

/** h1–h3 for the current document, with the section being read highlighted (§8.4). */
export function TableOfContents({ containerRef, documentVersion, onClose }: TableOfContentsProps) {
  const t = useMessages()
  const headings = useHeadings(containerRef, documentVersion)
  const activeId = useActiveHeading(headings)

  return (
    <nav className="toc" aria-label={t.toc.title}>
      <div className="toc__header">
        <span className="toc__title">{t.toc.title}</span>
        <button type="button" className="toc__close" aria-label={t.search.close} onClick={onClose}>
          ×
        </button>
      </div>
      {headings.length === 0 ? (
        <p className="toc__empty">{t.toc.empty}</p>
      ) : (
        <ul className="toc__list">
          {headings.map((heading) => (
            <li key={heading.id} className={`toc__item toc__item--depth-${heading.depth}`}>
              <a
                href={`#${heading.id}`}
                className={heading.id === activeId ? 'toc__link toc__link--active' : 'toc__link'}
                onClick={(event) => {
                  event.preventDefault()
                  scrollToFragment(heading.id)
                }}
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ul>
      )}
    </nav>
  )
}
