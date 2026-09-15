import path from 'node:path'
import { isMarkdownPath } from '../shared/markdown-files'

/**
 * Extracts Markdown file paths from a command line (`electron . a.md`, or the argv
 * forwarded by `second-instance`). Flags and the app path itself are skipped.
 */
export function markdownPathsFromArgv(argv: readonly string[], cwd: string): string[] {
  return argv
    .slice(1)
    .filter((arg) => !arg.startsWith('-') && isMarkdownPath(arg))
    .map((arg) => path.resolve(cwd, arg))
}
