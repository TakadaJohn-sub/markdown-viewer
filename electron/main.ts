import { BrowserWindow, app, nativeTheme, session } from 'electron'
import path from 'node:path'
import { resolveLocale } from '../shared/i18n'
import { markdownPathsFromArgv } from './argv'
import { createTrustedHandle } from './ipc/trusted'
import { registerFileIpc } from './ipc/file'
import { registerWindowIpc } from './ipc/window'
import { installApplicationMenu } from './menu'
import { applyDevelopmentCsp, hardenSession, hardenWebContents } from './security/guards'
import { registerPrivilegedSchemes, registerProtocolHandlers } from './security/protocols'
import { SettingsStore } from './settings'
import { WindowManager } from './windows'

/** Set by vite-plugin-electron while `npm run dev` is running. */
const devServerUrl = process.env.VITE_DEV_SERVER_URL

// Tests and local experiments run against a throwaway profile (settings, single-instance lock).
if (!app.isPackaged && process.env.MDV_USER_DATA_DIR) {
  app.setPath('userData', process.env.MDV_USER_DATA_DIR)
}

app.enableSandbox()
registerPrivilegedSchemes()

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  start()
}

function start(): void {
  // macOS delivers files from Finder before `ready`; queue them until windows can exist.
  const queuedPaths = markdownPathsFromArgv(process.argv, process.cwd())
  let windows: WindowManager | null = null

  app.on('open-file', (event, filePath) => {
    event.preventDefault()
    if (windows) windows.openFromSystem([filePath])
    else queuedPaths.push(filePath)
  })

  app.on('second-instance', (_event, argv, workingDirectory) => {
    const paths = markdownPathsFromArgv(argv, workingDirectory)
    if (paths.length > 0) windows?.openFromSystem(paths)
    else BrowserWindow.getAllWindows()[0]?.focus()
  })

  app.on('web-contents-created', (_event, contents) => hardenWebContents(contents, devServerUrl))

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) windows?.createWindow()
  })

  void app.whenReady().then(() => {
    const settings = SettingsStore.load(path.join(app.getPath('userData'), 'settings.json'))
    app.on('will-quit', () => settings.flush())
    nativeTheme.themeSource = settings.get().theme

    const locale = resolveLocale(app.getPreferredSystemLanguages()[0] ?? app.getLocale())

    hardenSession(session.defaultSession, devServerUrl)
    if (devServerUrl) applyDevelopmentCsp(session.defaultSession, devServerUrl)
    registerProtocolHandlers(path.join(__dirname, '../dist'))

    windows = new WindowManager({
      preloadPath: path.join(__dirname, 'preload.js'),
      devServerUrl,
      settings,
      locale,
    })
    const handle = createTrustedHandle(windows, devServerUrl)
    registerFileIpc(handle, windows)
    registerWindowIpc(handle, windows, settings, locale)
    installApplicationMenu({ locale, settings, windows })

    if (queuedPaths.length > 0) windows.openFromSystem(queuedPaths)
    else windows.createWindow()
  })
}
