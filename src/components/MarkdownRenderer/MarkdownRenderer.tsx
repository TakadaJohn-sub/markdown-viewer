import type { Root } from 'hast'
import { toJsxRuntime, type Components } from 'hast-util-to-jsx-runtime'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import { CodeBlock } from '../CodeBlock/CodeBlock'
import { MarkdownImage } from './MarkdownImage'
import { MarkdownLink } from './MarkdownLink'
// KaTeX's own stylesheet + fonts (§3.3) — the Worker only produces the markup, offline.
import 'katex/dist/katex.css'
import './MarkdownRenderer.css'

const components: Partial<Components> = {
  a: MarkdownLink,
  img: MarkdownImage,
  pre: CodeBlock,
}

interface MarkdownRendererProps {
  hast: Root
  /** Attached to the root `.markdown-body` — its direct children are the searchable blocks. */
  contentRef?: (node: HTMLElement | null) => void
}

/** Converts the Worker's HAST tree straight to React elements — no `innerHTML` involved. */
export function MarkdownRenderer({ hast, contentRef }: MarkdownRendererProps) {
  return (
    <div className="markdown-body" ref={contentRef} data-testid="document">
      {toJsxRuntime(hast, { Fragment, jsx, jsxs, components })}
    </div>
  )
}
