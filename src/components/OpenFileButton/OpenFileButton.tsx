import { useMessages } from '../../lib/i18n'
import './OpenFileButton.css'

/**
 * Persistent top-left affordance for opening another file (§8.1) — a mouse-accessible
 * equivalent of Cmd+O/File > Open, always on screen regardless of what's currently shown.
 */
export function OpenFileButton() {
  const t = useMessages()
  return (
    <button
      type="button"
      className="open-file-button"
      aria-label={t.menu.open}
      title={t.menu.open}
      onClick={() => void window.mdv.openDialog()}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          d="M7 3h6l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M13 3v4h4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M9 13h6M9 16.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  )
}
