import { BrowserWindow } from 'electron'
import { IpcChannel, type LinkResult } from '../../shared/ipc'
import { followLink } from '../link-router'
import { parseHref, parsePathList } from '../security/validate'
import type { WindowManager } from '../windows'
import type { TrustedHandle } from './trusted'

export function registerFileIpc(handle: TrustedHandle, windows: WindowManager): void {
  handle(IpcChannel.openDialog, (event) => windows.showOpenDialog(BrowserWindow.fromWebContents(event.sender)))

  // Paths come from files the user dropped; the preload converts File objects to paths.
  handle(IpcChannel.openPaths, (event, paths) => {
    windows.openInWindow(BrowserWindow.fromWebContents(event.sender), parsePathList(paths))
  })

  handle(IpcChannel.reload, (event) => windows.sessionFor(event.sender.id)?.reload())
  handle(IpcChannel.goBack, (event) => windows.sessionFor(event.sender.id)?.back())
  handle(IpcChannel.goForward, (event) => windows.sessionFor(event.sender.id)?.forward())

  handle(IpcChannel.followLink, async (event, href): Promise<LinkResult> => {
    const validHref = parseHref(href)
    const session = windows.sessionFor(event.sender.id)
    const current = session?.getCurrentDocument()
    // No current document (a stale click racing a reload, say) — nothing to resolve against.
    if (!session || !current) return 'not-found'
    return followLink(session, current, validHref)
  })
}
