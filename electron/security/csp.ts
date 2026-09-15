import { ASSET_SCHEME } from '../../shared/asset-url'

const PRODUCTION_DIRECTIVES: Record<string, string> = {
  'default-src': "'none'",
  'script-src': "'self'",
  'worker-src': "'self'",
  // KaTeX and Shiki emit inline styles and Mermaid SVGs carry <style>. User-authored
  // style attributes and <style> elements are removed by rehype-sanitize beforehand.
  'style-src': "'self' 'unsafe-inline'",
  // https: keeps README badges working; local images go through the image-only scheme.
  'img-src': `'self' ${ASSET_SCHEME}: https: data:`,
  'font-src': "'self'",
  'connect-src': "'self'",
  'object-src': "'none'",
  'base-uri': "'none'",
  'form-action': "'none'",
  'frame-src': "'none'",
  'frame-ancestors': "'none'",
}

function serialize(directives: Record<string, string>): string {
  return Object.entries(directives)
    .map(([name, value]) => `${name} ${value}`)
    .join('; ')
}

export const PRODUCTION_CSP = serialize(PRODUCTION_DIRECTIVES)

/** Vite's dev server needs an inline React Refresh preamble and an HMR websocket. */
export function developmentCsp(devServerUrl: string): string {
  const { origin } = new URL(devServerUrl)
  return serialize({
    ...PRODUCTION_DIRECTIVES,
    'script-src': "'self' 'unsafe-inline'",
    'connect-src': `'self' ${origin.replace(/^http/, 'ws')}`,
  })
}
