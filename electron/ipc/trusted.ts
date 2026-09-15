import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { assertTrustedSender } from '../security/validate'
import type { WindowManager } from '../windows'

export type TrustedHandle = (
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown,
) => void

/** `ipcMain.handle` that rejects anything not sent by the top frame of one of our windows. */
export function createTrustedHandle(windows: WindowManager, devServerUrl: string | undefined): TrustedHandle {
  return (channel, handler) => {
    ipcMain.handle(channel, (event, ...args: unknown[]) => {
      assertTrustedSender(event, devServerUrl, (id) => windows.isManaged(id))
      return handler(event, ...args)
    })
  }
}
