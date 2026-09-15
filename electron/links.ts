import { fileURLToPath } from 'node:url'
import { resolveDocumentUrl } from '../shared/resolve-url'

export type LinkTarget =
  | { kind: 'external'; url: string }
  | { kind: 'path'; path: string; fragment?: string }
  | { kind: 'unsupported'; scheme: string }
  | { kind: 'malformed' }

/** Handed straight to `shell.openExternal`; everything else that resolves to a URL with a
 * scheme Chromium/Node doesn't turn into a filesystem path is 'unsupported' instead. */
const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

/**
 * Classifies a Markdown link's href relative to the current document. Pure and
 * side-effect-free — no filesystem access, so it is unit-testable without Electron.
 * `#fragment`-only links never reach here: the renderer resolves those itself (§5.2). A
 * cross-document link with a trailing fragment (`./guide.md#usage`) carries it through so
 * the target document can scroll to that heading once it loads (§5.1/§5.3).
 */
export function resolveLinkTarget(href: string, fileUrl: string, rootUrl: string): LinkTarget {
  const url = resolveDocumentUrl(href, fileUrl, rootUrl)
  if (!url) return { kind: 'malformed' }
  if (EXTERNAL_PROTOCOLS.has(url.protocol)) return { kind: 'external', url: url.href }
  if (url.protocol !== 'file:') return { kind: 'unsupported', scheme: url.protocol.replace(/:$/, '') }
  try {
    const path = fileURLToPath(url)
    const fragment = url.hash ? decodeURIComponent(url.hash.slice(1)) : undefined
    return fragment ? { kind: 'path', path, fragment } : { kind: 'path', path }
  } catch {
    return { kind: 'malformed' }
  }
}
