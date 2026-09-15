import { describe, expect, it } from 'vitest'
import { MAX_PATHS_PER_REQUEST, isTrustedRendererUrl, parsePathList } from '../../electron/security/validate'

describe('isTrustedRendererUrl', () => {
  it('trusts only the bundled UI in production', () => {
    expect(isTrustedRendererUrl('app://bundle/index.html', undefined)).toBe(true)
    expect(isTrustedRendererUrl('app://bundle', undefined)).toBe(true)
    expect(isTrustedRendererUrl('app://other/index.html', undefined)).toBe(false)
    expect(isTrustedRendererUrl('file:///index.html', undefined)).toBe(false)
    expect(isTrustedRendererUrl('https://example.com', undefined)).toBe(false)
    expect(isTrustedRendererUrl('not a url', undefined)).toBe(false)
  })

  it('trusts only the dev server origin in development', () => {
    const dev = 'http://localhost:5173/'
    expect(isTrustedRendererUrl('http://localhost:5173/src/main.tsx', dev)).toBe(true)
    expect(isTrustedRendererUrl('http://localhost:5174/', dev)).toBe(false)
    expect(isTrustedRendererUrl('app://bundle/index.html', dev)).toBe(false)
  })
})

describe('parsePathList', () => {
  it('accepts absolute paths', () => {
    expect(parsePathList(['/a/b.md', '/c.md'])).toEqual(['/a/b.md', '/c.md'])
  })

  it.each([
    ['a non-array', '/a.md'],
    ['a relative path', ['a.md']],
    ['an empty path', ['']],
    ['a non-string', [42]],
    ['a NUL byte', ['/a\0.md']],
    ['a path that is too long', [`/${'a'.repeat(5000)}`]],
    ['too many paths', Array.from({ length: MAX_PATHS_PER_REQUEST + 1 }, (_, i) => `/${i}.md`)],
  ])('rejects %s', (_label, value) => {
    expect(() => parsePathList(value)).toThrow(TypeError)
  })
})
