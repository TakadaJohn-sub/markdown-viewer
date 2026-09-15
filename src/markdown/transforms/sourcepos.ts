import type { Root } from 'hast'

/**
 * Marks each top-level block with the Markdown source line it started on (§6.5) — used to
 * restore the reader's scroll position across a file-watch reload or Cmd+R. Deliberately
 * shallow (only `tree.children`, not every nested node): the goal is "which block was at
 * the top of the screen", not a full source map. Runs right after sanitize, since
 * `position` is a structural AST field sanitize doesn't touch, and before Shiki/KaTeX,
 * which can replace a top-level node outright and would otherwise carry it away — Shiki's
 * transform re-applies it across that replacement, but a top-level display-math block
 * loses it (a documented, minor limitation, not a crash).
 */
export function rehypeSourcepos() {
  return (tree: Root) => {
    for (const child of tree.children) {
      if (child.type !== 'element') continue
      const line = child.position?.start.line
      if (line !== undefined) child.properties['data-line'] = line
    }
  }
}
