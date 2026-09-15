import { toHtml } from 'hast-util-to-html'
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../../src/markdown/parser'

const fileUrl = 'file:///Users/me/repo/docs/guide.md'
const rootUrl = 'file:///Users/me/repo/'

async function render(source: string, skipHighlight = false): Promise<string> {
  const tree = await renderMarkdown(source, { fileUrl, rootUrl, skipHighlight })
  return toHtml(tree)
}

describe('renderMarkdown — CommonMark & GFM', () => {
  it('renders headings, emphasis, and inline code', async () => {
    const html = await render('# Title\n\n**bold** and *em* and `code`\n')
    expect(html).toContain('<h1')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>em</em>')
    expect(html).toContain('<code>code</code>')
  })

  it('renders a GFM table', async () => {
    const html = await render('| A | B |\n|---|--:|\n| 1 | 2 |\n')
    expect(html).toMatch(/<table[ >]/)
    expect(html).toContain('<th')
  })

  it('renders a task list with disabled checkboxes', async () => {
    const html = await render('- [x] done\n- [ ] todo\n')
    expect(html).toMatch(/<input[^>]*type="checkbox"[^>]*checked[^>]*disabled/)
    expect(html).toMatch(/<input[^>]*type="checkbox"[^>]*disabled/)
  })

  it('renders strikethrough', async () => {
    expect(await render('~~gone~~\n')).toContain('<del>gone</del>')
  })

  it('turns a bare URL into a link', async () => {
    expect(await render('See https://example.com for more.\n')).toContain('href="https://example.com"')
  })

  it('renders a footnote with a working (prefixed) backref pair', async () => {
    const html = await render('Ref[^1].\n\n[^1]: Note text.\n')
    const refMatch = /<a href="#([^"]+)"[^>]*data-footnote-ref/.exec(html)
    const targetId = refMatch?.[1]
    expect(targetId).toBeTruthy()
    // The href isn't clobber-prefixed (clobberPrefix: '' on remark-rehype) but the actual
    // id is (sanitize's own default clobberPrefix) — the renderer's fragment lookup (§5.2)
    // is what bridges this gap, not the HTML itself.
    expect(html).toContain(`id="user-content-${targetId}"`)
  })
})

describe('renderMarkdown — frontmatter (§3.4)', () => {
  it('folds YAML front matter into a details block instead of rendering it as a heading/hr', async () => {
    const html = await render('---\ntitle: Hello\n---\n\n# Body\n')
    expect(html).not.toContain('<hr')
    expect(html).toContain('class="mdv-frontmatter"')
    expect(html).toContain('<summary>YAML Front Matter</summary>')
    expect(html).toContain('title: Hello')
  })
})

describe('renderMarkdown — sanitize (§3.2/§11)', () => {
  it('strips scripts, event handlers, javascript: URLs, and dangerous elements', async () => {
    const html = await render(
      [
        '<img src=x onerror="alert(1)">',
        '<a href="javascript:alert(1)">js</a>',
        '<a href="JaVaScRiPt&#58;alert(1)">js2</a>',
        '<iframe src="https://evil"></iframe>',
        '<script>alert(1)</script>',
        '<svg><script>alert(1)</script></svg>',
        '<object data="x"></object><embed src="x">',
        '<form action="x"><input type="text"></form>',
        '<div style="background:url(javascript:alert(1))" onclick="alert(1)">styled</div>',
        '<meta http-equiv="refresh" content="0;url=https://evil">',
        '<base href="https://evil/">',
        '<style>body{display:none}</style>',
      ].join('\n'),
    )
    expect(html).not.toMatch(/\son[a-z]+=/i)
    expect(html).not.toMatch(/javascript:/i)
    expect(html).not.toMatch(/<(script|iframe|object|embed|form|meta|base|style)\b/i)
  })

  it('keeps details/summary/kbd/mark/sub/sup', async () => {
    const html = await render('<details><summary>More</summary><kbd>Cmd</kbd> <mark>hi</mark> H<sub>2</sub>O x<sup>2</sup></details>\n')
    for (const tag of ['details', 'summary', 'kbd', 'mark', 'sub', 'sup']) expect(html).toMatch(new RegExp(`<${tag}[ >]`))
  })

  it('keeps the GitHub dark/light image class pair but drops other classes', async () => {
    const html = await render('<img src="./a.png" class="gh-dark-mode-only sneaky" alt="a">\n')
    expect(html).toContain('class="gh-dark-mode-only"')
    expect(html).not.toContain('sneaky')
  })

  it('prefixes a raw HTML id to avoid DOM clobbering', async () => {
    expect(await render('<div id="custom">raw id</div>\n')).toContain('id="user-content-custom"')
  })
})

describe('renderMarkdown — assets (§11.2/§11.7)', () => {
  it('rewrites a relative local image to the mdv-asset: scheme', async () => {
    const html = await render('![alt](./images/example.png)\n')
    expect(html).toContain('src="mdv-asset://local/Users/me/repo/docs/images/example.png"')
  })

  it('resolves a root-relative image against the repository root', async () => {
    const html = await render('![alt](/assets/logo.png)\n')
    expect(html).toContain('src="mdv-asset://local/Users/me/repo/assets/logo.png"')
  })

  it('blocks a plain http: image instead of fetching it', async () => {
    const html = await render('![alt](http://example.com/a.png)\n')
    expect(html).toContain('data-mdv-blocked="insecure"')
    expect(html).not.toContain('src="http://')
  })

  it('leaves https: and data: images untouched', async () => {
    const html = await render('![alt](https://example.com/a.png)\n')
    expect(html).toContain('src="https://example.com/a.png"')

    const dataHtml = await render('<img src="data:image/png;base64,AAAA">\n')
    expect(dataHtml).toContain('src="data:image/png;base64,AAAA"')
  })

  it('rewrites a dark-mode <picture><source srcset> the same way', async () => {
    const html = await render('<picture><source media="(prefers-color-scheme: dark)" srcset="./dark.png"><img src="./light.png"></picture>\n')
    expect(html).toContain('srcset="mdv-asset://local/Users/me/repo/docs/dark.png"')
    expect(html).toContain('src="mdv-asset://local/Users/me/repo/docs/light.png"')
  })
})

describe('renderMarkdown — heading slugs (§5.2 depends on these)', () => {
  it('gives a Japanese heading an id built from its own text', async () => {
    expect(await render('# インストール\n')).toContain('id="インストール"')
  })
})

describe('renderMarkdown — syntax highlighting (§3.6/§8)', () => {
  it('highlights a fenced block with a known language and annotates it', async () => {
    const html = await render('```ts\nconst x: number = 1\n```\n')
    expect(html).toContain('data-language="ts"')
    expect(html).toContain('data-language-name="TypeScript"')
    expect(html).toContain('data-code="const x: number = 1"')
    expect(html).toContain('--shiki-light')
    expect(html).toContain('--shiki-dark')
  })

  it('leaves an untyped code block as plain text with no language annotation', async () => {
    const html = await render('```\nplain\n```\n')
    expect(html).not.toContain('data-language=')
    expect(html).toContain('data-code="plain"')
  })

  it('never highlights a mermaid block, but still annotates it for MermaidBlock to find', async () => {
    const html = await render('```mermaid\ngraph TD; A-->B\n```\n')
    expect(html).toContain('class="language-mermaid"')
    expect(html).toContain('data-language="mermaid"')
    expect(html).toContain('data-code="graph TD; A-->B"')
    expect(html).not.toContain('--shiki-light')
  })

  it('skips highlighting (but keeps annotations) when skipHighlight is set', async () => {
    const html = await render('```ts\nconst x = 1\n```\n', true)
    expect(html).toContain('data-language="ts"')
    expect(html).toContain('data-code="const x = 1"')
    expect(html).not.toContain('--shiki-light')
  })
})

describe('renderMarkdown — math (§3.3/§10)', () => {
  it('renders inline, display, and fenced math with KaTeX', async () => {
    const html = await render('Inline $E=mc^2$ ok.\n\n$$\nx^2\n$$\n\n```math\na^2+b^2=c^2\n```\n')
    expect(html.match(/class="katex"/g) ?? []).toHaveLength(3)
    expect(html).toContain('katex-display')
  })

  it('does not treat everyday dollar amounts or env vars as math (Pandoc rule)', async () => {
    const html = await render('Costs $5 or $10. Also $HOME and $PATH. Between $20,000 and $30,000.\n')
    expect(html).not.toContain('class="katex"')
    expect(html).toContain('Costs $5 or $10')
    expect(html).toContain('$HOME and $PATH')
    expect(html).toContain('$20,000 and $30,000')
  })

  it('shows the original source in the error colour instead of crashing on invalid TeX', async () => {
    const html = await render('$\\frac{1}$\n')
    expect(html).toContain('katex-error')
    expect(html).toContain('color:var(--mdv-danger)')
    expect(html).toContain('\\frac{1}')
  })
})

describe('renderMarkdown — GitHub Alerts (§3.5)', () => {
  it.each(['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION', 'note'])('converts a %s blockquote into a card', async (marker) => {
    const html = await render(`> [!${marker}]\n> Body text.\n`)
    const type = marker.toLowerCase()
    expect(html).toContain(`class="markdown-alert markdown-alert-${type}"`)
    expect(html).toContain('markdown-alert-title')
    expect(html).toContain('<svg')
    expect(html).toContain('Body text.')
    expect(html).not.toContain('<blockquote')
  })

  it('leaves an ordinary blockquote alone', async () => {
    const html = await render('> Just a quote.\n')
    expect(html).toMatch(/<blockquote[ >]/)
    expect(html).not.toContain('markdown-alert')
  })
})

describe('renderMarkdown — scroll anchors (§6.5)', () => {
  it('marks top-level blocks with their source line but not nested inline content', async () => {
    const html = await render('# Heading\n\nA paragraph with **bold** text.\n')
    expect(html).toContain('<h1 data-line="1"')
    expect(html).toContain('<p data-line="3">')
    expect(html).not.toContain('<strong data-line')
  })
})
