import { useEffect, useRef, type KeyboardEvent } from 'react'
import type { SearchApi } from '../../hooks/useSearch'
import { useMessages } from '../../lib/i18n'
import './Search.css'

export function Search({ api }: { api: SearchApi }) {
  const t = useMessages()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [api.focusToken])

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // While composing (IME), Enter confirms the conversion — it must not also move search.
    // Escape is handled globally (App) so it closes the bar from anywhere, not just this input.
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Enter') {
      event.preventDefault()
      if (event.shiftKey) api.previous()
      else api.next()
    }
  }

  const noMatches = api.query !== '' && api.matchCount === 0

  return (
    <div className="search-bar" role="search">
      <input
        ref={inputRef}
        type="text"
        className={noMatches ? 'search-bar__input search-bar__input--empty' : 'search-bar__input'}
        placeholder={t.search.placeholder}
        value={api.query}
        onChange={(event) => api.setQuery(event.target.value)}
        onKeyDown={handleKeyDown}
        aria-label={t.search.placeholder}
      />
      <span className="search-bar__count" aria-live="polite">
        {api.query === '' ? '' : noMatches ? t.search.noMatches : `${api.currentIndex + 1} / ${api.matchCountLabel}`}
      </span>
      <button
        type="button"
        className={api.caseSensitive ? 'search-bar__button search-bar__button--active' : 'search-bar__button'}
        title={t.search.caseSensitive}
        aria-label={t.search.caseSensitive}
        aria-pressed={api.caseSensitive}
        onClick={api.toggleCaseSensitive}
      >
        Aa
      </button>
      <button
        type="button"
        className="search-bar__button"
        title={t.search.previous}
        aria-label={t.search.previous}
        onClick={api.previous}
        disabled={api.matchCount === 0}
      >
        ↑
      </button>
      <button
        type="button"
        className="search-bar__button"
        title={t.search.next}
        aria-label={t.search.next}
        onClick={api.next}
        disabled={api.matchCount === 0}
      >
        ↓
      </button>
      <button type="button" className="search-bar__button" title={t.search.close} aria-label={t.search.close} onClick={api.close}>
        ×
      </button>
    </div>
  )
}
