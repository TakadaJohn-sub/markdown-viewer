import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { findRepositoryRoot, readDocument } from '../../electron/document-reader'
import { MAX_DOCUMENT_BYTES } from '../../shared/markdown-files'

let dir: string
const file = (name: string, content?: string | Uint8Array) => {
  const filePath = path.join(dir, name)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  if (content !== undefined) fs.writeFileSync(filePath, content)
  return filePath
}

beforeAll(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mdv-reader-')))
})

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('readDocument', () => {
  it('reads a Markdown file as bytes', async () => {
    const result = await readDocument(file('ok.md', '# Hi'))
    expect(result.ok && new TextDecoder().decode(result.bytes)).toBe('# Hi')
  })

  it.each([
    ['not-found', () => path.join(dir, 'missing.md')],
    ['not-markdown', () => file('notes.txt', 'hi')],
    ['not-a-file', () => (fs.mkdirSync(path.join(dir, 'folder.md'), { recursive: true }), path.join(dir, 'folder.md'))],
    ['binary', () => file('binary.md', new Uint8Array([0x23, 0x00, 0x41]))],
    ['not-found', () => 'relative.md'],
  ])('reports %s', async (code, makePath) => {
    expect(await readDocument(makePath())).toEqual({ ok: false, code })
  })

  it('accepts UTF-16 files even though they contain NUL bytes', async () => {
    const result = await readDocument(file('utf16.md', new Uint8Array([0xff, 0xfe, 0x41, 0x00])))
    expect(result.ok).toBe(true)
  })

  it('refuses files over the size limit without reading them', async () => {
    const big = file('big.md', '')
    fs.truncateSync(big, MAX_DOCUMENT_BYTES + 1)
    expect(await readDocument(big)).toEqual({ ok: false, code: 'too-large' })
  })
})

describe('findRepositoryRoot', () => {
  it('finds the nearest directory containing .git', async () => {
    fs.mkdirSync(path.join(dir, 'repo/.git'), { recursive: true })
    expect(await findRepositoryRoot(file('repo/docs/guide/a.md', ''))).toBe(path.join(dir, 'repo'))
  })

  it('accepts a .git file (worktrees and submodules)', async () => {
    file('worktree/.git', 'gitdir: /elsewhere')
    expect(await findRepositoryRoot(file('worktree/a.md', ''))).toBe(path.join(dir, 'worktree'))
  })
})
