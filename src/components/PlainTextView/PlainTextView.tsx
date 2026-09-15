import './PlainTextView.css'

interface PlainTextViewProps {
  text: string
  /** Attached to the `<pre>` — the single searchable block for this view. */
  contentRef?: (node: HTMLElement | null) => void
}

/** Shows the source as-is: the fallback for huge files and documents that fail to render.
 * Any banner (lossy encoding, render failure) is rendered by the App, above this. */
export function PlainTextView({ text, contentRef }: PlainTextViewProps) {
  return (
    <main className="document" data-testid="document">
      <pre className="plain-text" ref={contentRef}>
        {text}
      </pre>
    </main>
  )
}
