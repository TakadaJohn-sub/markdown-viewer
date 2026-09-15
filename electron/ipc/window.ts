import type { Locale } from '../../shared/i18n'
import { IpcChannel, type InitialState } from '../../shared/ipc'
import { CUSTOM_CSS_MAX_LENGTH, type SettingsStore } from '../settings'
import type { WindowManager } from '../windows'
import type { TrustedHandle } from './trusted'

export function registerWindowIpc(handle: TrustedHandle, windows: WindowManager, settings: SettingsStore, locale: Locale): void {
  handle(
    IpcChannel.getInitialState,
    (event): InitialState => ({
      locale,
      platform: process.platform,
      tocVisible: settings.get().tocVisible,
      customCss: settings.get().customCss,
      pending: windows.sessionFor(event.sender.id)?.takePending() ?? null,
    }),
  )

  handle(IpcChannel.setTocVisible, (_event, visible) => {
    if (typeof visible !== 'boolean') throw new TypeError('Expected a boolean')
    settings.update({ tocVisible: visible })
  })

  handle(IpcChannel.setCustomCss, (_event, css) => {
    if (typeof css !== 'string' || css.length > CUSTOM_CSS_MAX_LENGTH) throw new TypeError('Expected a short string')
    settings.update({ customCss: css })
  })
}
