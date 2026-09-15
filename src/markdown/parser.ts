import type { Root } from 'hast'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import rehypeSlug from 'rehype-slug'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { buildSanitizeSchema } from './sanitize'
import { rehypeAlerts } from './transforms/alerts'
import { rehypeAssets } from './transforms/assets'
import { frontmatterHandlers } from './transforms/frontmatter'
import { rehypeHighlight } from './transforms/highlight'
import { rehypeSourcepos } from './transforms/sourcepos'
import { remarkStrictDollar } from './transforms/strict-dollar'

// Built once; hast-util-sanitize's schema is plain data, safe to share across documents.
const sanitizeSchema = buildSanitizeSchema()

export interface RenderOptions {
  /** `file:` URL of the document, the base relative links/images resolve against. */
  fileUrl: string
  /** `file:` URL that root-relative paths ("/docs/a.md") resolve against. */
  rootUrl: string
  /** True for files above `HIGHLIGHT_SKIP_BYTES` (§12) — parse and render, skip Shiki. */
  skipHighlight: boolean
}

/**
 * The Markdown → HAST pipeline (§3 of the design doc). Order matters: sanitize is the
 * trust boundary, so it runs immediately after the (dangerous) raw HTML is parsed back
 * into the tree, and everything after it — sourcepos, slug, alerts, assets, KaTeX,
 * highlight — only ever adds attributes or replaces nodes with markup our own code (or
 * KaTeX/Shiki, on trusted-by-construction input) controls. sourcepos runs early in that
 * second half so a later wholesale node replacement (KaTeX's, mainly) can't discard the
 * `data-line` it stamped — Shiki's own replacement explicitly carries it across instead.
 */
export async function renderMarkdown(source: string, options: RenderOptions): Promise<Root> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml', 'toml'])
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkStrictDollar)
    .use(remarkRehype, { allowDangerousHtml: true, clobberPrefix: '', handlers: frontmatterHandlers })
    .use(rehypeRaw)
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeSourcepos)
    .use(rehypeSlug)
    .use(rehypeAlerts)
    .use(rehypeAssets, { fileUrl: options.fileUrl, rootUrl: options.rootUrl })
    .use(rehypeKatex, { strict: false, trust: false, errorColor: 'var(--mdv-danger)' })
    .use(rehypeHighlight, { skip: options.skipHighlight })

  // The second argument matters: remarkStrictDollar reads the original source text via
  // `String(file)` to recover the exact `$…$` span it's deciding whether to keep as math.
  // Without it, `.run()` uses an empty synthetic file and that span silently becomes ''.
  return processor.run(processor.parse(source), source)
}
