import { useState, type ImgHTMLAttributes } from 'react'
import { useMessages } from '../../lib/i18n'

interface MarkdownImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  'data-mdv-blocked'?: string
}

/** `src` at this point is either an `mdv-asset:` URL or a plain https:/data: URL (§11.2) —
 * neither is meaningful to show a person, so the fallback label shows a real filesystem
 * path when there's no `alt` text to fall back on instead. */
function readablePath(src: string | undefined): string {
  if (!src) return ''
  try {
    const url = new URL(src)
    return url.protocol === 'mdv-asset:' ? decodeURIComponent(url.pathname) : src
  } catch {
    return src
  }
}

/**
 * Replaces every `img` in the rendered document (§12). Local paths were already rewritten
 * to `mdv-asset:` URLs by the Worker's assets transform; a plain `http:` src was rewritten
 * to nothing and flagged `data-mdv-blocked` instead of being fetched (§11.7).
 */
export function MarkdownImage({ 'data-mdv-blocked': blocked, ...props }: MarkdownImageProps) {
  const [failed, setFailed] = useState(false)
  const t = useMessages()
  const label = props.alt || readablePath(props.src)

  if (blocked === 'insecure') {
    return (
      <span className="markdown-image-fallback">
        <span>{t.image.insecure}</span>
        {label && <span className="markdown-image-fallback__path">{label}</span>}
      </span>
    )
  }
  if (failed || !props.src) {
    return (
      <span className="markdown-image-fallback">
        <span>{t.image.notFound}</span>
        {label && <span className="markdown-image-fallback__path">{label}</span>}
      </span>
    )
  }
  return <img {...props} loading="lazy" onError={() => setFailed(true)} />
}
