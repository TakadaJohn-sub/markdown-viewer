import { useMessages } from '../../lib/i18n'
import './ConfirmLarge.css'

function formatMegabytes(byteLength: number): string {
  return `${(byteLength / (1024 * 1024)).toFixed(1)} MB`
}

/** Shown for the 5 MB–20 MB tier (§12.1) — asks before spending CPU on a huge parse. */
export function ConfirmLarge({
  byteLength,
  onShowPlainText,
  onRenderAnyway,
}: {
  byteLength: number
  onShowPlainText: () => void
  onRenderAnyway: () => void
}) {
  const t = useMessages()
  return (
    <main className="confirm-large" data-testid="confirm-large">
      <h1 className="confirm-large__title">{t.confirmLarge.title}</h1>
      <p className="confirm-large__message">{t.confirmLarge.message}</p>
      <p className="confirm-large__size">{formatMegabytes(byteLength)}</p>
      <div className="confirm-large__actions">
        <button type="button" className="button" onClick={onShowPlainText}>
          {t.confirmLarge.showPlainText}
        </button>
        <button type="button" className="button button--primary" onClick={onRenderAnyway}>
          {t.confirmLarge.renderAnyway}
        </button>
      </div>
    </main>
  )
}
