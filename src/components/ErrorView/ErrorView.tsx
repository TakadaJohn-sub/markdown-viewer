import { useMessages } from '../../lib/i18n'
import './ErrorView.css'

interface ErrorViewProps {
  message: string
  path?: string
  canRetry: boolean
}

export function ErrorView({ message, path, canRetry }: ErrorViewProps) {
  const t = useMessages()
  return (
    <main className="error-view" data-testid="error">
      <h1 className="error-view__title">{t.error.title}</h1>
      <p className="error-view__message">{message}</p>
      {path && <p className="error-view__path">{path}</p>}
      <div className="error-view__actions">
        {canRetry && (
          <button type="button" className="button" onClick={() => void window.mdv.reload()}>
            {t.error.retry}
          </button>
        )}
        <button type="button" className="button button--primary" onClick={() => void window.mdv.openDialog()}>
          {t.error.openAnother}
        </button>
      </div>
    </main>
  )
}
