import { defaultSchema, type Options as Schema } from 'rehype-sanitize'

const GITHUB_MODE_CLASSES = ['gh-dark-mode-only', 'gh-light-mode-only'] as const
/** Marks the folded front-matter block (§3.4) so it can be styled distinctly from a
 * regular `<details>` — a value this specific carries no risk even on raw user HTML. */
const FRONTMATTER_CLASS = 'mdv-frontmatter'

/**
 * Starts from hast-util-sanitize's GitHub-style default (already permits `details`,
 * `summary`, `kbd`, `sub`, `sup`, safe table markup, `code` classNames matching
 * `language-*`, `source[media]` via its wildcard attributes, and prefixes raw-HTML
 * `id`/`name` with `user-content-`) and narrows or extends only where the design doc's
 * §3.2/§7.1/§11 call for something different.
 */
export function buildSanitizeSchema(): Schema {
  const schema = structuredClone(defaultSchema)

  // `mark` isn't in the default allowlist; §11 asks for it alongside kbd/sub/sup.
  schema.tagNames = [...(schema.tagNames ?? []), 'mark']

  schema.attributes = {
    ...schema.attributes,
    // The default schema strips `className` from `img`/`source` entirely; README authors
    // rely on these two GitHub classes to pick a light/dark variant per §7.1's CSS.
    img: [...(schema.attributes?.img ?? []), ['className', ...GITHUB_MODE_CLASSES]],
    source: [...(schema.attributes?.source ?? []), ['className', ...GITHUB_MODE_CLASSES]],
    details: [...(schema.attributes?.details ?? []), ['className', FRONTMATTER_CLASS]],
    // The default already allows `language-*` (Shiki); rehype-katex additionally looks for
    // `math-inline`/`math-display` on the `code` it's about to replace (§3.3) — both must
    // survive sanitize, which runs before it does.
    code: [['className', /^language-./, 'math-inline', 'math-display']],
  }

  schema.protocols = {
    ...schema.protocols,
    // Narrower than the default (which also allows irc:/ircs:/xmpp:) — only what §5.1 opens.
    href: ['http', 'https', 'mailto'],
    // The default only allows http/https; `data:` images (inlined diagrams, etc.) are safe
    // to display since they can't smuggle a script, only pixels.
    src: [...(schema.protocols?.src ?? []), 'data'],
  }

  return schema
}
