import { describe, expect, it } from 'vitest'
import { resolveDocumentUrl } from '../../shared/resolve-url'

const fileUrl = 'file:///Users/me/repo/docs/guide.md'
const rootUrl = 'file:///Users/me/repo/'

describe('resolveDocumentUrl', () => {
  it('resolves a relative path against the document', () => {
    expect(resolveDocumentUrl('./images/a.png', fileUrl, rootUrl)?.href).toBe('file:///Users/me/repo/docs/images/a.png')
    expect(resolveDocumentUrl('../README.md', fileUrl, rootUrl)?.href).toBe('file:///Users/me/repo/README.md')
  })

  it('resolves a root-relative path against the repository root, not the filesystem root', () => {
    expect(resolveDocumentUrl('/docs/other.md', fileUrl, rootUrl)?.href).toBe('file:///Users/me/repo/docs/other.md')
  })

  it('leaves an absolute URL as-is regardless of scheme', () => {
    expect(resolveDocumentUrl('https://example.com/a.png', fileUrl, rootUrl)?.href).toBe('https://example.com/a.png')
    expect(resolveDocumentUrl('mailto:a@b.c', fileUrl, rootUrl)?.href).toBe('mailto:a@b.c')
  })

  it('does not treat a protocol-relative "//" URL as root-relative', () => {
    expect(resolveDocumentUrl('//example.com/a.png', fileUrl, rootUrl)?.href).toBe('file://example.com/a.png')
  })

  it('returns null for an empty or unresolvable href', () => {
    expect(resolveDocumentUrl('', fileUrl, rootUrl)).toBeNull()
    expect(resolveDocumentUrl('   ', fileUrl, rootUrl)).toBeNull()
  })
})
