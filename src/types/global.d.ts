import type { MdvApi } from '../../shared/ipc'

declare global {
  interface Window {
    /** Exposed by electron/preload.ts; the renderer's only way to reach the main process. */
    mdv: MdvApi
  }
}

export {}
