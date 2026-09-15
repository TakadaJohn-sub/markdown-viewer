import type { IpcMainInvokeEvent } from 'electron'
import path from 'node:path'
import { APP_HOST, APP_SCHEME } from './paths'

export const MAX_PATHS_PER_REQUEST = 100
export const MAX_PATH_LENGTH = 4096

/** Matches the design doc's 8 KB cap on an IPC href (§2.3). */
export const MAX_HREF_LENGTH = 8 * 1024

/** The renderer is either the bundled UI (`app://bundle`) or, in development, the Vite dev server. */
export function isTrustedRendererUrl(rawUrl: string, devServerUrl: string | undefined): boolean {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return false
  }
  if (devServerUrl) {
    const dev = new URL(devServerUrl)
    return url.protocol === dev.protocol && url.host === dev.host
  }
  return url.protocol === `${APP_SCHEME}:` && url.host === APP_HOST
}

export function assertTrustedSender(
  event: IpcMainInvokeEvent,
  devServerUrl: string | undefined,
  isManagedWebContents: (webContentsId: number) => boolean,
): void {
  const frame = event.senderFrame
  const trusted =
    frame !== null &&
    frame.parent === null &&
    isTrustedRendererUrl(frame.url, devServerUrl) &&
    isManagedWebContents(event.sender.id)
  if (!trusted) throw new Error(`Rejected IPC from an untrusted sender: ${frame?.url ?? 'unknown frame'}`)
}

export function parsePathList(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > MAX_PATHS_PER_REQUEST) {
    throw new TypeError('Expected a list of file paths')
  }
  return value.map((item) => {
    if (
      typeof item !== 'string' ||
      item.length === 0 ||
      item.length > MAX_PATH_LENGTH ||
      item.includes('\0') ||
      !path.isAbsolute(item)
    ) {
      throw new TypeError('Expected an absolute file path')
    }
    return item
  })
}

export function parseHref(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_HREF_LENGTH) {
    throw new TypeError('Expected a non-empty href')
  }
  return value
}
