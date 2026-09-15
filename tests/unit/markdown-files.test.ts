import { describe, expect, it } from 'vitest'
import { extensionOf, isMarkdownPath } from '../../shared/markdown-files'

describe('isMarkdownPath', () => {
  it.each(['README.md', '/a/b/notes.markdown', 'x.MDOWN', 'C:\\docs\\a.mkd', 'a.b.mkdn'])('accepts %s', (name) => {
    expect(isMarkdownPath(name)).toBe(true)
  })

  it.each(['README', 'a.mdx', 'a.txt', '/dir.md/file', '.md', 'a.md.png'])('rejects %s', (name) => {
    expect(isMarkdownPath(name)).toBe(false)
  })
})

describe('extensionOf', () => {
  it('ignores dots in directory names', () => {
    expect(extensionOf('/some.dir/README')).toBe('')
  })

  it('lowercases the extension', () => {
    expect(extensionOf('Photo.PNG')).toBe('png')
  })
})
