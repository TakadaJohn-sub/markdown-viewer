import { useEffect, useRef, useState } from 'react'
import { useDarkMode } from '../../hooks/useDarkMode'
import { useInViewport } from '../../hooks/useInViewport'
import { renderMermaidDiagram } from '../../lib/mermaid-client'
import { useMessages } from '../../lib/i18n'
import './MermaidBlock.css'

type RenderState = { kind: 'pending' } | { kind: 'rendered'; svg: string } | { kind: 'error'; message: string }

/**
 * Replaces a fenced ` ```mermaid ` block (§4.3/§9). Renders lazily — only once the block
 * is about to enter the viewport — and only the resulting SVG ever goes through
 * `dangerouslySetInnerHTML`; this is the one deliberate exception to "no innerHTML" (§4.1),
 * since Mermaid's own output is what needs to land in the DOM as real markup.
 */
export function MermaidBlock({ code }: { code: string }) {
  const t = useMessages()
  const containerRef = useRef<HTMLDivElement>(null)
  const inViewport = useInViewport(containerRef)
  const dark = useDarkMode()
  const [state, setState] = useState<RenderState>({ kind: 'pending' })

  useEffect(() => {
    if (!inViewport) return
    let cancelled = false
    renderMermaidDiagram(code, dark ? 'dark' : 'default').then(
      (svg) => {
        if (!cancelled) setState({ kind: 'rendered', svg })
      },
      (error: unknown) => {
        if (!cancelled) setState({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
      },
    )
    return () => {
      cancelled = true
    }
  }, [inViewport, code, dark])

  if (state.kind === 'error') {
    return (
      <div ref={containerRef} className="mermaid-block mermaid-block--error">
        <p className="mermaid-block__error-message">{t.mermaid.renderFailed}</p>
        <p className="mermaid-block__error-detail">{state.message}</p>
        <pre className="mermaid-block__source">
          <code>{code}</code>
        </pre>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-block"
      data-testid="mermaid-block"
      data-mermaid-state={state.kind}
      dangerouslySetInnerHTML={state.kind === 'rendered' ? { __html: state.svg } : undefined}
    />
  )
}
