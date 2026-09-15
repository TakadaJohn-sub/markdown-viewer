import { useEffect, useRef } from 'react'
import { useMessages } from '../../lib/i18n'
import './CustomCssPanel.css'

const PERSIST_DEBOUNCE_MS = 300

interface CustomCssPanelProps {
  css: string
  onChange: (css: string) => void
  onClose: () => void
}

/**
 * A textarea that edits the CSS injected app-wide (§17 Phase 3). Every keystroke updates
 * `css` immediately so the live `<style>` tag in `App.tsx` reflects it right away; writing
 * the value to disk is debounced so typing doesn't hammer `settings.json`.
 */
export function CustomCssPanel({ css, onChange, onClose }: CustomCssPanelProps) {
  const t = useMessages()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const persistTimerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  useEffect(() => () => window.clearTimeout(persistTimerRef.current), [])

  function handleChange(value: string) {
    onChange(value)
    window.clearTimeout(persistTimerRef.current)
    persistTimerRef.current = window.setTimeout(() => void window.mdv.setCustomCss(value), PERSIST_DEBOUNCE_MS)
  }

  return (
    <div className="custom-css-panel">
      <div className="custom-css-panel__header">
        <span className="custom-css-panel__title">{t.customCssPanel.title}</span>
        <button type="button" className="custom-css-panel__close" aria-label={t.customCssPanel.close} onClick={onClose}>
          ×
        </button>
      </div>
      <textarea
        ref={textareaRef}
        className="custom-css-panel__textarea"
        spellCheck={false}
        placeholder={t.customCssPanel.placeholder}
        value={css}
        onChange={(event) => handleChange(event.target.value)}
      />
    </div>
  )
}
