import type { Root } from 'hast'
import type { DecodedText, TextEncodingName } from './decode'
import type { DecodeRequest, RenderRequest, WorkerResponse } from './protocol'

/** A request running longer than this is treated as hung; the Worker is replaced. */
const TIMEOUT_MS = 15_000

export type RenderOutcome =
  | { ok: true; hast: Root; encoding: TextEncodingName; lossy: boolean }
  // Decoded fine but Markdown → HAST failed; the caller falls back to showing `text`.
  | { ok: false; text: string; encoding: TextEncodingName; lossy: boolean; message: string }

/** `Omit` over the whole union collapses to the fields shared by every member (just
 * `type`/`bytes`); omitting `id` from each member individually keeps the rest. */
type RequestPayload = Omit<RenderRequest, 'id'> | Omit<DecodeRequest, 'id'>

interface PendingRequest {
  resolve: (response: WorkerResponse) => void
  reject: (error: Error) => void
  timer: number
}

/** One long-lived Worker per window, so parsing never blocks the UI thread. */
export class MarkdownWorkerClient {
  private worker: Worker | null = null
  private nextId = 1
  private readonly pending = new Map<number, PendingRequest>()

  /** Starts the Worker early so the first document does not pay for its startup. */
  warmUp(): void {
    this.ensureWorker()
  }

  /** Takes ownership of `bytes`: its buffer is transferred to the Worker. */
  async decode(bytes: Uint8Array): Promise<DecodedText> {
    const response = await this.send({ type: 'decode', bytes })
    if (response.type !== 'decoded') throw new Error(response.type === 'failed' ? response.message : 'Unexpected response')
    return { text: response.text, encoding: response.encoding, lossy: response.lossy }
  }

  /** Takes ownership of `bytes`: its buffer is transferred to the Worker. */
  async render(bytes: Uint8Array, fileUrl: string, rootUrl: string, skipHighlight: boolean): Promise<RenderOutcome> {
    const response = await this.send({ type: 'render', bytes, fileUrl, rootUrl, skipHighlight })
    switch (response.type) {
      case 'rendered':
        return { ok: true, hast: response.hast, encoding: response.encoding, lossy: response.lossy }
      case 'render-failed':
        return { ok: false, text: response.text, encoding: response.encoding, lossy: response.lossy, message: response.message }
      default:
        throw new Error(response.type === 'failed' ? response.message : 'Unexpected response')
    }
  }

  private send(request: RequestPayload): Promise<WorkerResponse> {
    const worker = this.ensureWorker()
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => this.restart(new Error('The document took too long to process.')), TIMEOUT_MS)
      this.pending.set(id, { resolve, reject, timer })
      worker.postMessage({ ...request, id }, [request.bytes.buffer])
    })
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'markdown' })
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.settle(event.data)
    worker.onerror = (event) => {
      event.preventDefault()
      this.restart(new Error(event.message || 'The Markdown worker stopped unexpectedly.'))
    }
    this.worker = worker
    return worker
  }

  private settle(response: WorkerResponse): void {
    const request = this.pending.get(response.id)
    if (!request) return
    this.pending.delete(response.id)
    window.clearTimeout(request.timer)
    request.resolve(response)
  }

  /** Terminates a hung or crashed Worker; the next request starts a fresh one. */
  private restart(reason: Error): void {
    this.worker?.terminate()
    this.worker = null
    for (const request of this.pending.values()) {
      window.clearTimeout(request.timer)
      request.reject(reason)
    }
    this.pending.clear()
  }
}
