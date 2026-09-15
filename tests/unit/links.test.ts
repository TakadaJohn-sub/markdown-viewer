import { describe, expect, it } from 'vitest'
import { resolveLinkTarget } from '../../electron/links'

const fileUrl = 'file:///Users/me/repo/docs/guide.md'
const rootUrl = 'file:///Users/me/repo/'

describe('resolveLinkTarget', () => {
  it.each([
    ['http://example.com', 'http://example.com/'],
    ['https://example.com/a', 'https://example.com/a'],
    ['mailto:a@b.c', 'mailto:a@b.c'],
  ])('classifies %s as external', (href, expectedUrl) => {
    expect(resolveLinkTarget(href, fileUrl, rootUrl)).toEqual({ kind: 'external', url: expectedUrl })
  })

  it('classifies a relative Markdown link as a path', () => {
    expect(resolveLinkTarget('./architecture.md', fileUrl, rootUrl)).toEqual({
      kind: 'path',
      path: '/Users/me/repo/docs/architecture.md',
    })
  })

  it('resolves a root-relative link against the repository root', () => {
    expect(resolveLinkTarget('/docs/other.md', fileUrl, rootUrl)).toEqual({ kind: 'path', path: '/Users/me/repo/docs/other.md' })
  })

  it.each(['vscode://file/x', 'ssh://host/repo.git', 'ftp://host/file'])('classifies %s as unsupported', (href) => {
    expect(resolveLinkTarget(href, fileUrl, rootUrl).kind).toBe('unsupported')
  })

  it('reports the scheme name without the trailing colon for an unsupported link', () => {
    expect(resolveLinkTarget('vscode://file/x', fileUrl, rootUrl)).toEqual({ kind: 'unsupported', scheme: 'vscode' })
  })

  it('treats an empty href as malformed', () => {
    expect(resolveLinkTarget('', fileUrl, rootUrl)).toEqual({ kind: 'malformed' })
  })

  it('resolves a "#..." href against the current document if it reaches path resolution at all (the renderer normally intercepts these itself)', () => {
    expect(resolveLinkTarget('#usage', fileUrl, rootUrl)).toEqual({
      kind: 'path',
      path: '/Users/me/repo/docs/guide.md',
      fragment: 'usage',
    })
  })

  it('carries a cross-document link\'s fragment through so the target can scroll to it (§5.1/§5.3)', () => {
    expect(resolveLinkTarget('./architecture.md#usage', fileUrl, rootUrl)).toEqual({
      kind: 'path',
      path: '/Users/me/repo/docs/architecture.md',
      fragment: 'usage',
    })
  })

  it('decodes a percent-encoded fragment', () => {
    expect(resolveLinkTarget('./guide.md#%E4%BD%BF%E3%81%84%E6%96%B9', fileUrl, rootUrl)).toEqual({
      kind: 'path',
      path: '/Users/me/repo/docs/guide.md',
      fragment: '使い方',
    })
  })

  it('omits the fragment field entirely when there is none', () => {
    const target = resolveLinkTarget('./architecture.md', fileUrl, rootUrl)
    expect(target).not.toHaveProperty('fragment')
  })
})
