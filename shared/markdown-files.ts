export const MARKDOWN_EXTENSIONS = ['md', 'markdown', 'mdown', 'mkd', 'mkdn'] as const

/** Files larger than this are never opened. */
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024

/** Above this, Shiki syntax highlighting is skipped (still renders Markdown normally). */
export const HIGHLIGHT_SKIP_BYTES = 500 * 1024

/** Above this, rendering waits for the user to choose plain text or "render anyway". */
export const CONFIRM_RENDER_BYTES = 5 * 1024 * 1024

/** A NUL byte within this many leading bytes marks the file as binary. */
export const BINARY_SNIFF_BYTES = 8 * 1024

export function extensionOf(filePath: string): string {
  const name = filePath.slice(Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\')) + 1)
  const dot = name.lastIndexOf('.')
  // A leading dot marks a hidden file (".md"), not an extension.
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

export function isMarkdownPath(filePath: string): boolean {
  return (MARKDOWN_EXTENSIONS as readonly string[]).includes(extensionOf(filePath))
}
