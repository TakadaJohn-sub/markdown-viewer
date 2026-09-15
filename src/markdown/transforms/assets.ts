import type { Element, Root } from 'hast'
import { visit } from 'unist-util-visit'
import { toAssetUrl } from '../../../shared/asset-url'
import { resolveDocumentUrl } from '../../../shared/resolve-url'

export interface AssetContext {
  fileUrl: string
  rootUrl: string
}

interface RewrittenUrl {
  url: string
  /** True for a plain `http:` image — displayed as blocked rather than fetched (§11.7). */
  blocked: boolean
}

function rewriteUrl(raw: string, ctx: AssetContext): RewrittenUrl {
  const resolved = resolveDocumentUrl(raw, ctx.fileUrl, ctx.rootUrl)
  if (!resolved) return { url: raw, blocked: false }
  if (resolved.protocol === 'file:') return { url: toAssetUrl(resolved.href), blocked: false }
  if (resolved.protocol === 'http:') return { url: '', blocked: true }
  // https: and data: are left as the browser would resolve them; CSP's img-src allows both.
  return { url: resolved.href, blocked: false }
}

function rewriteSrcSet(value: string, ctx: AssetContext): string {
  return value
    .split(',')
    .map((entry) => {
      const trimmed = entry.trim()
      if (trimmed === '') return null
      const spaceIndex = trimmed.indexOf(' ')
      const url = spaceIndex === -1 ? trimmed : trimmed.slice(0, spaceIndex)
      const descriptor = spaceIndex === -1 ? '' : trimmed.slice(spaceIndex)
      const rewritten = rewriteUrl(url, ctx)
      return rewritten.blocked ? null : `${rewritten.url}${descriptor}`
    })
    .filter((entry): entry is string => entry !== null)
    .join(', ')
}

/**
 * Rewrites image URLs to the image-only `mdv-asset:` scheme (§11.2) and flags plain
 * `http:` images as blocked so `MarkdownImage` can show a message instead of fetching
 * them (§11.7). Runs after sanitize, on trusted output only.
 */
export function rehypeAssets(context: AssetContext) {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName === 'img' && typeof node.properties.src === 'string') {
        const rewritten = rewriteUrl(node.properties.src, context)
        if (rewritten.blocked) {
          node.properties.src = ''
          node.properties['data-mdv-blocked'] = 'insecure'
        } else {
          node.properties.src = rewritten.url
        }
      }
      if (node.tagName === 'source' && typeof node.properties.srcSet === 'string') {
        node.properties.srcSet = rewriteSrcSet(node.properties.srcSet, context)
      }
    })
  }
}
