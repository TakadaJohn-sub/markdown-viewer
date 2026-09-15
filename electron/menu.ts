import { BrowserWindow, Menu, app, nativeTheme, type BaseWindow, type MenuItemConstructorOptions } from 'electron'
import { IpcChannel, type MenuCommand } from '../shared/ipc'
import { MESSAGES, type Locale } from '../shared/i18n'
import { THEME_SOURCES, type ThemeSource } from '../shared/theme'
import { ZOOM_LEVEL_RANGE, type SettingsStore } from './settings'
import type { WindowManager } from './windows'

/** Same step as Chromium's built-in zoom commands. */
const ZOOM_STEP = 0.5

interface MenuContext {
  locale: Locale
  settings: SettingsStore
  windows: WindowManager
}

function setTheme(settings: SettingsStore, theme: ThemeSource): void {
  settings.update({ theme })
  nativeTheme.themeSource = theme
}

function setZoomLevel(settings: SettingsStore, level: number): void {
  const clamped = Math.min(ZOOM_LEVEL_RANGE.max, Math.max(ZOOM_LEVEL_RANGE.min, level))
  settings.update({ zoomLevel: clamped })
  for (const window of BrowserWindow.getAllWindows()) window.webContents.setZoomLevel(clamped)
}

export function installApplicationMenu({ locale, settings, windows }: MenuContext): void {
  const t = MESSAGES[locale].menu
  const isMac = process.platform === 'darwin'
  // Electron passes the window the command applies to (the focused one).
  const target = (window: BaseWindow | undefined): BrowserWindow | null =>
    window instanceof BrowserWindow ? window : BrowserWindow.getFocusedWindow()
  const zoomBy = (delta: number) => () => setZoomLevel(settings, settings.get().zoomLevel + delta)
  const sendMenuCommand = (window: BaseWindow | undefined, command: MenuCommand): void => {
    target(window)?.webContents.send(IpcChannel.menuCommand, command)
  }

  const developmentItems: MenuItemConstructorOptions[] = app.isPackaged
    ? []
    : [
        { type: 'separator' },
        { role: 'toggleDevTools' },
        {
          label: t.reloadUi,
          accelerator: 'CmdOrCtrl+Shift+R',
          click: (_item, window) => target(window)?.webContents.reloadIgnoringCache(),
        },
      ]

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' } as const] : []),
    {
      label: t.file,
      submenu: [
        {
          id: 'open',
          label: t.open,
          accelerator: 'CmdOrCtrl+O',
          click: (_item, window) => void windows.showOpenDialog(target(window)),
        },
        ...(isMac ? [{ role: 'recentDocuments' as const, label: t.openRecent }] : []),
        { type: 'separator' },
        { role: 'close' },
        ...(isMac ? [] : [{ role: 'quit' } as const]),
      ],
    },
    {
      // Built by hand (rather than `role: 'editMenu'`) so Find/Find Next/Find Previous can
      // live alongside the standard Cut/Copy/Paste roles, which still auto-localize.
      label: t.edit,
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          id: 'find',
          label: t.find,
          accelerator: 'CmdOrCtrl+F',
          click: (_item, window) => sendMenuCommand(window, 'find'),
        },
        {
          id: 'find-next',
          label: t.findNext,
          accelerator: 'CmdOrCtrl+G',
          click: (_item, window) => sendMenuCommand(window, 'find-next'),
        },
        {
          id: 'find-previous',
          label: t.findPrevious,
          accelerator: 'Shift+CmdOrCtrl+G',
          click: (_item, window) => sendMenuCommand(window, 'find-previous'),
        },
      ],
    },
    {
      label: t.view,
      submenu: [
        {
          id: 'reload',
          label: t.reload,
          accelerator: 'CmdOrCtrl+R',
          click: (_item, window) => {
            const browserWindow = target(window)
            if (browserWindow) void windows.sessionFor(browserWindow.webContents.id)?.reload()
          },
        },
        {
          id: 'go-back',
          label: t.goBack,
          accelerator: 'CmdOrCtrl+[',
          click: (_item, window) => {
            const browserWindow = target(window)
            if (browserWindow) void windows.sessionFor(browserWindow.webContents.id)?.back()
          },
        },
        {
          id: 'go-forward',
          label: t.goForward,
          accelerator: 'CmdOrCtrl+]',
          click: (_item, window) => {
            const browserWindow = target(window)
            if (browserWindow) void windows.sessionFor(browserWindow.webContents.id)?.forward()
          },
        },
        { type: 'separator' },
        {
          id: 'toggle-toc',
          label: t.toggleToc,
          click: (_item, window) => sendMenuCommand(window, 'toggle-toc'),
        },
        {
          id: 'toggle-custom-css',
          label: t.customCss,
          accelerator: 'CmdOrCtrl+,',
          click: (_item, window) => sendMenuCommand(window, 'toggle-custom-css'),
        },
        { type: 'separator' },
        {
          label: t.appearance,
          submenu: THEME_SOURCES.map((theme) => ({
            id: `theme-${theme}`,
            label: t.theme[theme],
            type: 'radio' as const,
            checked: settings.get().theme === theme,
            click: () => setTheme(settings, theme),
          })),
        },
        { type: 'separator' },
        { id: 'zoom-reset', label: t.actualSize, accelerator: 'CmdOrCtrl+0', click: () => setZoomLevel(settings, 0) },
        { id: 'zoom-in', label: t.zoomIn, accelerator: 'CmdOrCtrl+Plus', click: zoomBy(ZOOM_STEP) },
        // "+" needs Shift on US keyboards; also accept Cmd+= like browsers do.
        { label: t.zoomIn, accelerator: 'CmdOrCtrl+=', visible: false, acceleratorWorksWhenHidden: true, click: zoomBy(ZOOM_STEP) },
        { id: 'zoom-out', label: t.zoomOut, accelerator: 'CmdOrCtrl+-', click: zoomBy(-ZOOM_STEP) },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...developmentItems,
      ],
    },
    { role: 'windowMenu' },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
