import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ASSET_HOST, ASSET_SCHEME } from '../../shared/asset-url'
import { extensionOf } from '../../shared/markdown-files'

export const APP_SCHEME = 'app'
export const APP_HOST = 'bundle'
export const APP_ENTRY_URL = `${APP_SCHEME}://${APP_HOST}/index.html`

export const MAX_ASSET_BYTES = 50 * 1024 * 1024

const BUNDLE_MIME_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json',
  map: 'application/json',
  svg: 'image/svg+xml',
  png: 'image/png',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  wasm: 'application/wasm',
}

const IMAGE_MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
}

export function bundleMimeType(filePath: string): string {
  return BUNDLE_MIME_TYPES[extensionOf(filePath)] ?? 'application/octet-stream'
}

/** Content type for an image the asset scheme may serve; undefined for anything else. */
export function imageMimeType(filePath: string): string | undefined {
  return IMAGE_MIME_TYPES[extensionOf(filePath)]
}

/** Maps an `app://bundle/...` path to a file inside the renderer bundle, or null if it escapes it. */
export function resolveBundlePath(bundleRoot: string, urlPathname: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(urlPathname)
  } catch {
    return null
  }
  if (decoded.includes('\0')) return null
  const root = path.resolve(bundleRoot)
  const resolved = path.resolve(root, decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, ''))
  return resolved.startsWith(root + path.sep) ? resolved : null
}

/** Inverse of `toAssetUrl()`; null when the URL is not a well-formed asset URL. */
export function assetUrlToPath(rawUrl: string): string | null {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }
  if (url.protocol !== `${ASSET_SCHEME}:` || url.host !== ASSET_HOST) return null
  try {
    return fileURLToPath(`file://${url.pathname}`)
  } catch {
    return null
  }
}
