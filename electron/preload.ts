import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import {
  IpcChannel,
  type DocumentMessage,
  type FileWatchEvent,
  type InitialState,
  type LinkResult,
  type MdvApi,
  type MenuCommand,
} from '../shared/ipc'

const api: MdvApi = {
  getInitialState: () => ipcRenderer.invoke(IpcChannel.getInitialState) as Promise<InitialState>,

  openDialog: () => ipcRenderer.invoke(IpcChannel.openDialog) as Promise<void>,

  openDroppedFiles: (files) => {
    // File objects cannot cross IPC; resolve them to paths here, in the isolated world.
    const paths = files.map((file) => webUtils.getPathForFile(file)).filter((filePath) => filePath !== '')
    return ipcRenderer.invoke(IpcChannel.openPaths, paths) as Promise<void>
  },

  reload: () => ipcRenderer.invoke(IpcChannel.reload) as Promise<void>,

  followLink: (href) => ipcRenderer.invoke(IpcChannel.followLink, href) as Promise<LinkResult>,

  goBack: () => ipcRenderer.invoke(IpcChannel.goBack) as Promise<void>,
  goForward: () => ipcRenderer.invoke(IpcChannel.goForward) as Promise<void>,
  setTocVisible: (visible) => ipcRenderer.invoke(IpcChannel.setTocVisible, visible) as Promise<void>,
  setCustomCss: (css) => ipcRenderer.invoke(IpcChannel.setCustomCss, css) as Promise<void>,

  onDocument: (listener) => {
    const handler = (_event: IpcRendererEvent, message: DocumentMessage): void => listener(message)
    ipcRenderer.on(IpcChannel.document, handler)
    return () => {
      ipcRenderer.removeListener(IpcChannel.document, handler)
    }
  },

  onMenuCommand: (listener) => {
    const handler = (_event: IpcRendererEvent, command: MenuCommand): void => listener(command)
    ipcRenderer.on(IpcChannel.menuCommand, handler)
    return () => {
      ipcRenderer.removeListener(IpcChannel.menuCommand, handler)
    }
  },

  onFileState: (listener) => {
    const handler = (_event: IpcRendererEvent, state: FileWatchEvent): void => listener(state)
    ipcRenderer.on(IpcChannel.fileState, handler)
    return () => {
      ipcRenderer.removeListener(IpcChannel.fileState, handler)
    }
  },
}

contextBridge.exposeInMainWorld('mdv', api)
