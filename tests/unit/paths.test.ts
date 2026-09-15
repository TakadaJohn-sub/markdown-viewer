import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { toAssetUrl } from '../../shared/asset-url'
import { assetUrlToPath, bundleMimeType, imageMimeType, resolveBundlePath } from '../../electron/security/paths'

const root = '/app/dist'

describe('resolveBundlePath', () => {
  it('serves index.html for the root', () => {
    expect(resolveBundlePath(root, '/')).toBe('/app/dist/index.html')
  })

  it('maps paths inside the bundle', () => {
    expect(resolveBundlePath(root, '/assets/index-abc.js')).toBe('/app/dist/assets/index-abc.js')
    expect(resolveBundlePath(root, '/assets/a%20b.js')).toBe('/app/dist/assets/a b.js')
  })

  it.each(['/../secret.txt', '/%2e%2e/%2e%2e/etc/passwd', '/assets/..%2F..%2Fx', '/%00', '/%E0%A4%A'])(
    'rejects %s',
    (pathname) => {
      expect(resolveBundlePath(root, pathname)).toBeNull()
    },
  )

  it('rejects the bundle directory itself', () => {
    expect(resolveBundlePath(root, '/.')).toBeNull()
  })
})

describe('asset URLs', () => {
  it('round-trips paths with spaces and Japanese characters', () => {
    const filePath = path.resolve('/Users/me/My Docs/画像/logo.png')
    const assetUrl = toAssetUrl(pathToFileURL(filePath).href)
    expect(assetUrl.startsWith('mdv-asset://local/')).toBe(true)
    expect(assetUrlToPath(assetUrl)).toBe(filePath)
  })

  it('rejects other schemes, hosts and encoded separators', () => {
    expect(assetUrlToPath('file:///etc/passwd')).toBeNull()
    expect(assetUrlToPath('mdv-asset://other/etc/passwd')).toBeNull()
    expect(assetUrlToPath('mdv-asset://local/a%2Fb.png')).toBeNull()
  })

  it('refuses to convert non-file URLs', () => {
    expect(() => toAssetUrl('https://example.com/a.png')).toThrow(TypeError)
  })
})

describe('MIME types', () => {
  it('serves only known image types as assets', () => {
    expect(imageMimeType('/a/logo.SVG')).toBe('image/svg+xml')
    expect(imageMimeType('/a/photo.jpeg')).toBe('image/jpeg')
    expect(imageMimeType('/a/notes.md')).toBeUndefined()
    expect(imageMimeType('/a/page.html')).toBeUndefined()
  })

  it('labels bundle scripts so module scripts load', () => {
    expect(bundleMimeType('/dist/assets/index.js')).toBe('text/javascript; charset=utf-8')
    expect(bundleMimeType('/dist/unknown.bin')).toBe('application/octet-stream')
  })
})
