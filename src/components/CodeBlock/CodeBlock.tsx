import { useEffect, useRef, useState, type HTMLAttributes } from 'react'
import { MermaidBlock } from '../MermaidBlock/MermaidBlock'
import { useMessages } from '../../lib/i18n'
import './CodeBlock.css'

interface CodeBlockProps extends HTMLAttributes<HTMLPreElement> {
  'data-language'?: string
  'data-language-name'?: string
  'data-code'?: string
}

const COPIED_DISPLAY_MS = 1500

/**
 * Replaces every `pre` in the rendered document (§8.1). `data-code` (the untouched
 * source, set by the highlight transform whether or not it highlighted the block) is
 * what Copy writes out — not the DOM text, which Shiki splits across many token spans.
 * A `language-mermaid` block is never highlighted (§3.6) and is handed to `MermaidBlock`
 * instead of getting the usual header-and-Copy chrome (§4.1's `pre` → component table).
 */
export function CodeBlock({
  children,
  'data-language': language,
  'data-language-name': languageName,
  'data-code': code,
  ...rest
}: CodeBlockProps) {
  const t = useMessages()
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  if (language === 'mermaid') return <MermaidBlock code={code ?? ''} />

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code ?? '')
      setCopied(true)
      window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => setCopied(false), COPIED_DISPLAY_MS)
    } catch {
      // Clipboard permission denied or unavailable; nothing more we can do.
    }
  }

  return (
    <div className="code-block">
      <div className="code-block__header">
        <span className="code-block__language">{languageName ?? ''}</span>
        <button type="button" className="code-block__copy" onClick={() => void handleCopy()}>
          {copied ? t.codeBlock.copied : t.codeBlock.copy}
        </button>
      </div>
      {/* data-language was pulled out above to check for "mermaid" — put it back here. */}
      <pre {...rest} data-language={language}>
        {children}
      </pre>
    </div>
  )
}
