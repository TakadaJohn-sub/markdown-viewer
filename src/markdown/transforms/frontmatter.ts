import type { Element } from 'hast'
import type { Handler } from 'mdast-util-to-hast'

/**
 * remark-rehype has no built-in idea what to do with the `yaml`/`toml` nodes
 * remark-frontmatter produces (unknown node types are dropped), so front matter gets its
 * own handlers here rather than a separate transform: a folded `<details>` holding the
 * raw front matter as a code block (§3.4). Runs before sanitize, so it must not include
 * anything sanitize would need to strip.
 */
// `Handlers` (mdast-util-to-hast) only lists node types it ships ambient types for,
// which doesn't include 'toml' (from remark-frontmatter) — a plain record still works,
// since remark-rehype just looks handlers up by node.type at runtime.
export const frontmatterHandlers: Record<string, Handler> = {
  yaml: makeFrontmatterHandler('YAML Front Matter', 'language-yaml'),
  toml: makeFrontmatterHandler('TOML Front Matter', 'language-toml'),
}

function makeFrontmatterHandler(label: string, languageClass: string): Handler {
  return (_state, node) => {
    const value = typeof (node as { value?: unknown }).value === 'string' ? (node as { value: string }).value : ''
    const details: Element = {
      type: 'element',
      tagName: 'details',
      properties: { className: ['mdv-frontmatter'] },
      children: [
        { type: 'element', tagName: 'summary', properties: {}, children: [{ type: 'text', value: label }] },
        {
          type: 'element',
          tagName: 'pre',
          properties: {},
          children: [
            { type: 'element', tagName: 'code', properties: { className: [languageClass] }, children: [{ type: 'text', value }] },
          ],
        },
      ],
    }
    return details
  }
}
