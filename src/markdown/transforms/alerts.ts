import type { Element, Properties, Root } from 'hast'
import { visit } from 'unist-util-visit'

type AlertType = 'note' | 'tip' | 'important' | 'warning' | 'caution'

/** GitHub's marker: a blockquote whose first line is exactly `[!TYPE]` (case-insensitive). */
const MARKER = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*\r?\n?/i

const LABELS: Record<AlertType, string> = {
  note: 'Note',
  tip: 'Tip',
  important: 'Important',
  warning: 'Warning',
  caution: 'Caution',
}

interface Shape {
  tag: 'circle' | 'rect' | 'path'
  attrs: Properties
}

// Small, self-drawn icons (not exact GitHub octicons) rather than risking subtly wrong
// paths reproduced from memory — distinct enough per type, and they inherit currentColor
// via `stroke`/`fill` left unset on the coloured strokes/dots. hast's Properties type
// requires SVG geometry as strings (matching real parsed attribute values), not numbers.
const STROKE = { fill: 'none', stroke: 'currentColor', strokeWidth: '1.5' }
const OUTLINE = { fill: 'none', stroke: 'currentColor', strokeWidth: '1.3', strokeLineJoin: 'round' } as const

const ICONS: Record<AlertType, Shape[]> = {
  note: [
    { tag: 'circle', attrs: { cx: '8', cy: '8', r: '7', ...STROKE } },
    { tag: 'circle', attrs: { cx: '8', cy: '4.8', r: '1' } },
    { tag: 'rect', attrs: { x: '7.25', y: '7', width: '1.5', height: '5', rx: '0.5' } },
  ],
  tip: [
    { tag: 'path', attrs: { d: 'M8 1a4.5 4.5 0 0 0-2.5 8.25c.4.3.7.8.7 1.35v.4h3.6v-.4c0-.55.3-1.05.7-1.35A4.5 4.5 0 0 0 8 1Z', ...OUTLINE } },
    { tag: 'rect', attrs: { x: '6', y: '12.5', width: '4', height: '1.2', rx: '0.4' } },
    { tag: 'rect', attrs: { x: '6.4', y: '14', width: '3.2', height: '1', rx: '0.4' } },
  ],
  important: [
    { tag: 'circle', attrs: { cx: '8', cy: '8', r: '7', ...STROKE } },
    { tag: 'rect', attrs: { x: '7.25', y: '3.5', width: '1.5', height: '6', rx: '0.75' } },
    { tag: 'circle', attrs: { cx: '8', cy: '11.5', r: '1' } },
  ],
  warning: [
    { tag: 'path', attrs: { d: 'M8 1.5 15 13.5H1Z', ...OUTLINE } },
    { tag: 'rect', attrs: { x: '7.25', y: '6', width: '1.5', height: '4', rx: '0.5' } },
    { tag: 'circle', attrs: { cx: '8', cy: '11.5', r: '0.9' } },
  ],
  caution: [
    { tag: 'path', attrs: { d: 'M5 1h6l4 4v6l-4 4H5l-4-4V5Z', ...OUTLINE } },
    { tag: 'rect', attrs: { x: '7.25', y: '4.5', width: '1.5', height: '5', rx: '0.5' } },
    { tag: 'circle', attrs: { cx: '8', cy: '11.2', r: '0.9' } },
  ],
}

function shapeToElement({ tag, attrs }: Shape): Element {
  return { type: 'element', tagName: tag, properties: attrs, children: [] }
}

function iconElement(type: AlertType): Element {
  return {
    type: 'element',
    tagName: 'svg',
    properties: { viewBox: '0 0 16 16', width: '16', height: '16', className: ['markdown-alert-icon'], ariaHidden: 'true' },
    children: ICONS[type].map(shapeToElement),
  }
}

function findChild<T extends Element['children'][number]['type']>(
  node: Element,
  type: T,
): Extract<Element['children'][number], { type: T }> | undefined {
  return node.children.find((child): child is Extract<Element['children'][number], { type: T }> => child.type === type)
}

/**
 * Turns a `> [!NOTE]`-style blockquote into a GitHub-style alert card (§3.5). Runs after
 * sanitize, on trusted output; mutates the blockquote in place (tagName/properties only)
 * rather than replacing it, so attributes added by other trusted transforms — `data-line`
 * (§6.5) in particular — survive untouched.
 */
export function rehypeAlerts() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'blockquote') return
      const firstParagraph = findChild(node, 'element')
      if (!firstParagraph || firstParagraph.tagName !== 'p') return
      const firstText = findChild(firstParagraph, 'text')
      if (!firstText) return
      const match = MARKER.exec(firstText.value)
      const marker = match?.[1]
      if (!marker) return
      const type = marker.toLowerCase() as AlertType

      firstText.value = firstText.value.slice(match[0].length)
      // The marker was the paragraph's only content — drop the now-empty paragraph.
      if (firstText.value === '' && firstParagraph.children.length === 1) {
        node.children = node.children.filter((child) => child !== firstParagraph)
      }

      node.tagName = 'div'
      node.properties = { ...node.properties, className: ['markdown-alert', `markdown-alert-${type}`] }

      const title: Element = {
        type: 'element',
        tagName: 'p',
        properties: { className: ['markdown-alert-title'] },
        children: [iconElement(type), { type: 'text', value: LABELS[type] }],
      }
      node.children = [title, ...node.children]
    })
  }
}
