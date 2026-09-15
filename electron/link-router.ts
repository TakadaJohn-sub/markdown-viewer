import { shell } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { LinkResult } from '../shared/ipc'
import { isMarkdownPath } from '../shared/markdown-files'
import { resolveLinkTarget } from './links'
import type { DocumentSession } from './session'

/** Checked in order; the first one that exists as a file wins, matching GitHub's own rule. */
const DIRECTORY_INDEX_CANDIDATES = ['README.md', 'readme.md', 'Readme.md', 'index.md']

export interface CurrentDocument {
  fileUrl: string
  rootUrl: string
}

/**
 * Follows a link clicked in a rendered document (§5.1 of the design doc). A Markdown file
 * — including a directory's README/index — navigates within `session`'s own window (§5.3,
 * with back/forward); everything else is hard-refused: no `shell.openPath`, so a link can
 * never launch a script or application.
 */
export async function followLink(session: DocumentSession, current: CurrentDocument, href: string): Promise<LinkResult> {
  const target = resolveLinkTarget(href, current.fileUrl, current.rootUrl)
  switch (target.kind) {
    case 'malformed':
      return 'not-found'
    case 'unsupported':
      return 'unsupported'
    case 'external':
      await shell.openExternal(target.url)
      return 'external'
    case 'path':
      return followPath(session, target.path, target.fragment)
  }
}

async function followPath(session: DocumentSession, targetPath: string, fragment: string | undefined): Promise<LinkResult> {
  let stat
  try {
    stat = await fs.stat(targetPath)
  } catch {
    return 'not-found'
  }

  if (stat.isDirectory()) {
    const indexPath = await findDirectoryIndex(targetPath)
    if (indexPath) {
      await session.navigate(indexPath, fragment)
      return 'opened'
    }
    shell.showItemInFolder(targetPath)
    return 'revealed'
  }

  if (isMarkdownPath(targetPath)) {
    await session.navigate(targetPath, fragment)
    return 'opened'
  }
  shell.showItemInFolder(targetPath)
  return 'revealed'
}

async function findDirectoryIndex(directoryPath: string): Promise<string | null> {
  for (const name of DIRECTORY_INDEX_CANDIDATES) {
    const candidate = path.join(directoryPath, name)
    try {
      if ((await fs.stat(candidate)).isFile()) return candidate
    } catch {
      // Try the next candidate.
    }
  }
  return null
}
