import { describe, expect, it } from 'vitest'
import { markdownPathsFromArgv } from '../../electron/argv'

describe('markdownPathsFromArgv', () => {
  it('resolves Markdown paths against the working directory', () => {
    const argv = ['/Applications/Electron', '.', 'README.md', '/abs/notes.markdown']
    expect(markdownPathsFromArgv(argv, '/work')).toEqual(['/work/README.md', '/abs/notes.markdown'])
  })

  it('skips flags, the executable and non-Markdown arguments', () => {
    const argv = ['/usr/bin/x.md', '--inspect=0', '-psn_0_12345', 'image.png', 'docs/a.md']
    expect(markdownPathsFromArgv(argv, '/work')).toEqual(['/work/docs/a.md'])
  })
})
