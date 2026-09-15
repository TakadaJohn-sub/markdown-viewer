import { useMessages } from '../../lib/i18n'
import './Welcome.css'

export function Welcome({ platform }: { platform: string }) {
  const t = useMessages()
  return (
    <main className="welcome" data-testid="welcome">
      <div className="welcome__dropzone">
        <h1 className="welcome__title">{t.appName}</h1>
        <p className="welcome__hint">{t.welcome.dropHint}</p>
        <button type="button" className="button button--primary" onClick={() => void window.mdv.openDialog()}>
          {t.welcome.openButton}
        </button>
      </div>
      {platform === 'darwin' && <p className="welcome__footnote">{t.welcome.defaultAppHint}</p>}
    </main>
  )
}
