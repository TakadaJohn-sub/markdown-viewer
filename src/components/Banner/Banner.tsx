import type { ReactNode } from 'react'
import './Banner.css'

/** Thin notice at the top of the document; the app uses these instead of modal dialogs. */
export function Banner({ tone, children }: { tone: 'info' | 'warning'; children: ReactNode }) {
  return (
    <div className={`banner banner--${tone}`} role="status">
      {children}
    </div>
  )
}
