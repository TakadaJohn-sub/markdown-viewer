import fs from 'node:fs/promises'
import path from 'node:path'
import type { DocumentErrorCode } from '../shared/ipc'
import { BINARY_SNIFF_BYTES, MAX_DOCUMENT_BYTES, isMarkdownPath } from '../shared/markdown-files'

export type ReadResult = { ok: true; bytes: Uint8Array } | { ok: false; code: DocumentErrorCode }

/** UTF-16 text is full of NUL bytes, so it must not be mistaken for a binary file. */
function hasUtf16Bom(bytes: Uint8Array): boolean {
  return (bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff)
}

function codeFromError(error: unknown): DocumentErrorCode {
  const code = (error as NodeJS.ErrnoException | undefined)?.code
  if (code === 'ENOENT' || code === 'ENOTDIR') return 'not-found'
  if (code === 'EACCES' || code === 'EPERM') return 'permission-denied'
  if (code === 'EISDIR') return 'not-a-file'
  return 'read-failed'
}

export async function readDocument(filePath: string): Promise<ReadResult> {
  if (!path.isAbsolute(filePath)) return { ok: false, code: 'not-found' }
  if (!isMarkdownPath(filePath)) return { ok: false, code: 'not-markdown' }

  let buffer: Buffer
  try {
    const stat = await fs.stat(filePath)
    if (!stat.isFile()) return { ok: false, code: 'not-a-file' }
    if (stat.size > MAX_DOCUMENT_BYTES) return { ok: false, code: 'too-large' }
    buffer = await fs.readFile(filePath)
  } catch (error) {
    return { ok: false, code: codeFromError(error) }
  }

  // The file may have grown between stat and read.
  if (buffer.byteLength > MAX_DOCUMENT_BYTES) return { ok: false, code: 'too-large' }
  if (!hasUtf16Bom(buffer) && buffer.subarray(0, BINARY_SNIFF_BYTES).includes(0)) return { ok: false, code: 'binary' }

  // Structured clone copies the whole backing ArrayBuffer, so hand over an exact-size copy
  // when the Buffer is a view into a larger allocation.
  const exact = buffer.byteOffset === 0 && buffer.byteLength === buffer.buffer.byteLength
  return { ok: true, bytes: exact ? new Uint8Array(buffer.buffer) : new Uint8Array(buffer) }
}

/**
 * Nearest ancestor directory containing `.git` (a directory, or a file for worktrees
 * and submodules). GitHub resolves root-relative links ("/docs/a.md") against it.
 */
export async function findRepositoryRoot(filePath: string): Promise<string | null> {
  let dir = path.dirname(filePath)
  for (;;) {
    try {
      await fs.stat(path.join(dir, '.git'))
      return dir
    } catch {
      const parent = path.dirname(dir)
      if (parent === dir) return null
      dir = parent
    }
  }
}
