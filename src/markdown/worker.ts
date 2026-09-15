import { decodeText } from './decode'
import { renderMarkdown } from './parser'
import type { WorkerRequest, WorkerResponse } from './protocol'

const scope = self as unknown as DedicatedWorkerGlobalScope

scope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data

  if (request.type === 'decode') {
    let response: WorkerResponse
    try {
      response = { id: request.id, type: 'decoded', ...decodeText(request.bytes) }
    } catch (error) {
      response = { id: request.id, type: 'failed', message: error instanceof Error ? error.message : String(error) }
    }
    scope.postMessage(response)
    return
  }

  // decodeText never throws (worst case it falls back to lossy replacement), so only the
  // Markdown → HAST stage can fail here.
  const decoded = decodeText(request.bytes)
  renderMarkdown(decoded.text, { fileUrl: request.fileUrl, rootUrl: request.rootUrl, skipHighlight: request.skipHighlight })
    .then((hast) => {
      const response: WorkerResponse = { id: request.id, type: 'rendered', hast, ...decoded }
      scope.postMessage(response)
    })
    .catch((error: unknown) => {
      const response: WorkerResponse = {
        id: request.id,
        type: 'render-failed',
        text: decoded.text,
        encoding: decoded.encoding,
        lossy: decoded.lossy,
        message: error instanceof Error ? error.message : String(error),
      }
      scope.postMessage(response)
    })
}
