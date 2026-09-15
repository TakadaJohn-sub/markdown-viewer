import type { Root } from 'mdast'
import type { VFile } from 'vfile'
import { SKIP, visit } from 'unist-util-visit'

interface InlineMathNode {
  type: 'inlineMath'
  value: string
  position?: { start: { offset?: number }; end: { offset?: number } }
}

/**
 * remark-math's own single-dollar detection is more permissive than Pandoc's, and turns
 * everyday README prose like `Costs $5 or $10.` and `$HOME and $PATH` into broken math
 * (§3.3). Applies Pandoc's rule instead: a `$…$` span is only math if its content doesn't
 * start/end with whitespace, and the closing `$` isn't immediately followed by a digit.
 * `$$…$$` used inline is always math and is left alone.
 */
export function remarkStrictDollar() {
  return (tree: Root, file: VFile) => {
    const source = String(file)
    visit(tree, 'inlineMath', (rawNode, index, parent) => {
      const node = rawNode as unknown as InlineMathNode
      if (index === undefined || !parent) return
      const start = node.position?.start.offset
      const end = node.position?.end.offset
      if (start == null || end == null) return
      const raw = source.slice(start, end)
      if (raw.startsWith('$$')) return
      const bad = /^\s/.test(node.value) || /\s$/.test(node.value) || /^\d/.test(source.slice(end, end + 1))
      if (!bad) return
      parent.children.splice(index, 1, { type: 'text', value: raw })
      return [SKIP, index + 1]
    })
  }
}
