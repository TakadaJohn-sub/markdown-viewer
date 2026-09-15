import type { Element, Root } from 'hast'
import { toString as hastToString } from 'hast-util-to-string'
import { bundledLanguages, bundledLanguagesInfo, createHighlighterCore, type HighlighterCore } from 'shiki'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import { visit } from 'unist-util-visit'

/** Individual lines longer than this are left untokenized (§3.6/§12). */
const MAX_LINE_LENGTH = 2000
/** Blocks with more lines than this are left untokenized entirely. */
const MAX_LINES_PER_BLOCK = 5000

// Keyed by every id AND alias ("ts" as well as "typescript") — that's what fence info
// strings actually use, and `lang in bundledLanguages` below accepts both too.
const languageDisplayNames = new Map<string, string>()
for (const info of bundledLanguagesInfo) {
  languageDisplayNames.set(info.id, info.name)
  for (const alias of info.aliases ?? []) languageDisplayNames.set(alias, info.name)
}

// One highlighter per Worker, reused across every document it renders — loaded languages
// stay cached for the Worker's lifetime, matching the design doc's "warm" Worker model.
let highlighterPromise: Promise<HighlighterCore> | null = null

function getHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= createHighlighterCore({
    engine: createJavaScriptRegexEngine(),
    themes: [import('shiki/themes/github-light.mjs'), import('shiki/themes/github-dark.mjs')],
    langs: [],
  })
  return highlighterPromise
}

function findCodeChild(node: Element): Element | undefined {
  return node.children.find((child): child is Element => child.type === 'element' && child.tagName === 'code')
}

function languageOf(code: Element): string | undefined {
  const classNames = code.properties.className
  const names = Array.isArray(classNames) ? classNames.map(String) : []
  return names.find((name) => name.startsWith('language-'))?.slice('language-'.length)
}

interface HighlightJob {
  pre: Element
  lang: string
  text: string
}

/**
 * Syntax-highlights fenced code blocks with Shiki (§3.6). Always annotates `pre` with
 * `data-language`/`data-language-name` (for `CodeBlock`'s header) and `data-code` (the
 * raw text, for its Copy button) — cheap, so it happens even when `skip` is set for a
 * large file (§12). Mermaid/math blocks and unknown languages are left as plain text.
 */
export function rehypeHighlight({ skip }: { skip: boolean }) {
  return async (tree: Root) => {
    const jobs: HighlightJob[] = []

    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'pre') return
      const code = findCodeChild(node)
      if (!code) return
      // Fenced code always ends with a newline before the closing fence; Copy shouldn't.
      node.properties['data-code'] = hastToString(code).replace(/\n$/, '')

      const lang = languageOf(code)
      if (!lang) return
      node.properties['data-language'] = lang
      const displayName = languageDisplayNames.get(lang)
      if (displayName) node.properties['data-language-name'] = displayName

      if (skip || lang === 'mermaid' || lang === 'math' || !(lang in bundledLanguages)) return
      const text = hastToString(code)
      if (text.split('\n').length > MAX_LINES_PER_BLOCK) return
      jobs.push({ pre: node, lang, text })
    })

    if (jobs.length === 0) return
    const highlighter = await getHighlighter()
    for (const job of jobs) {
      await highlighter.loadLanguage(bundledLanguages[job.lang as keyof typeof bundledLanguages])
      const out = highlighter.codeToHast(job.text.replace(/\n$/, ''), {
        lang: job.lang,
        themes: { light: 'github-light', dark: 'github-dark' },
        defaultColor: false,
        tokenizeMaxLineLength: MAX_LINE_LENGTH,
      })
      const highlightedPre = out.children[0]
      if (highlightedPre?.type !== 'element') continue
      // codeToHast's own <pre> replaces ours wholesale — carry every existing property
      // back over (not just data-language/-code: also data-line, §6.5, if this block is a
      // top-level one sourcepos already stamped).
      const { properties } = job.pre
      Object.assign(job.pre, highlightedPre)
      job.pre.properties = { ...job.pre.properties, ...properties }
    }
  }
}
