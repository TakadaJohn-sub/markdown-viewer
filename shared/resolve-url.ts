/**
 * Resolves a Markdown-relative href/src against the document. A root-relative path
 * ("/docs/a.md", GitHub's convention for repo-root-relative links) resolves against
 * `rootUrl` instead of the filesystem root that plain URL resolution against a
 * `file:` URL would otherwise imply. Uses only the global `URL`, so it works
 * unchanged in the Worker, the renderer, and the main process.
 */
export function resolveDocumentUrl(href: string, fileUrl: string, rootUrl: string): URL | null {
  const trimmed = href.trim()
  if (trimmed === '') return null
  try {
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
      return new URL(trimmed.slice(1), rootUrl)
    }
    return new URL(trimmed, fileUrl)
  } catch {
    return null
  }
}
