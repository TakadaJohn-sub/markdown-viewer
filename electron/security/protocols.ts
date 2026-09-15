import { protocol } from 'electron'
import fs from 'node:fs/promises'
import { ASSET_SCHEME } from '../../shared/asset-url'
import { PRODUCTION_CSP } from './csp'
import {
  APP_HOST,
  APP_SCHEME,
  MAX_ASSET_BYTES,
  assetUrlToPath,
  bundleMimeType,
  imageMimeType,
  resolveBundlePath,
} from './paths'

/** Must run before the app is ready. */
export function registerPrivilegedSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true } },
    { scheme: ASSET_SCHEME, privileges: { standard: true, secure: true } },
  ])
}

const notFound = (): Response => new Response(null, { status: 404 })

export function registerProtocolHandlers(bundleRoot: string): void {
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url)
    const filePath = url.host === APP_HOST ? resolveBundlePath(bundleRoot, url.pathname) : null
    if (!filePath) return notFound()
    try {
      const body = await fs.readFile(filePath)
      return new Response(body, {
        headers: {
          'Content-Type': bundleMimeType(filePath),
          // Sent with every file: a Worker takes its policy from its own script response.
          'Content-Security-Policy': PRODUCTION_CSP,
          'X-Content-Type-Options': 'nosniff',
        },
      })
    } catch {
      return notFound()
    }
  })

  protocol.handle(ASSET_SCHEME, async (request) => {
    if (request.method !== 'GET') return new Response(null, { status: 405 })
    const requestedPath = assetUrlToPath(request.url)
    if (!requestedPath) return notFound()
    try {
      // Check the real target so a symlink named "x.png" cannot expose another kind of file.
      const realPath = await fs.realpath(requestedPath)
      const mimeType = imageMimeType(realPath)
      if (!mimeType) return notFound()
      const stat = await fs.stat(realPath)
      if (!stat.isFile() || stat.size > MAX_ASSET_BYTES) return notFound()
      const body = await fs.readFile(realPath)
      // No CORS headers: the page can display these images but cannot read their pixels back.
      return new Response(body, { headers: { 'Content-Type': mimeType, 'X-Content-Type-Options': 'nosniff' } })
    } catch {
      return notFound()
    }
  })
}
