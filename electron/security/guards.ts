import type { Session, WebContents } from 'electron'
import { developmentCsp } from './csp'
import { isTrustedRendererUrl } from './validate'

export function hardenWebContents(contents: WebContents, devServerUrl: string | undefined): void {
  // The app itself never navigates; only the Vite client reloads the page in development.
  contents.on('will-navigate', (event) => {
    if (!(devServerUrl && isTrustedRendererUrl(event.url, devServerUrl))) event.preventDefault()
  })
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  contents.on('will-attach-webview', (event) => event.preventDefault())
}

export function hardenSession(session: Session, devServerUrl: string | undefined): void {
  const isAllowed = (permission: string, url: string): boolean =>
    permission === 'clipboard-sanitized-write' && isTrustedRendererUrl(url, devServerUrl)

  session.setPermissionRequestHandler((_contents, permission, callback, details) =>
    callback(isAllowed(permission, details.requestingUrl)),
  )
  session.setPermissionCheckHandler((_contents, permission, requestingOrigin) => isAllowed(permission, requestingOrigin))
  session.setDevicePermissionHandler(() => false)
  session.on('will-download', (event) => event.preventDefault())
}

/** In production the `app://` handler sends the CSP; the dev server needs it injected. */
export function applyDevelopmentCsp(session: Session, devServerUrl: string): void {
  const policy = developmentCsp(devServerUrl)
  session.webRequest.onHeadersReceived({ urls: [`${new URL(devServerUrl).origin}/*`] }, (details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [policy] } })
  })
}
