import type { Root } from 'hast'
import type { TextEncodingName } from './decode'

export interface RenderRequest {
  id: number
  type: 'render'
  bytes: Uint8Array
  fileUrl: string
  rootUrl: string
  skipHighlight: boolean
}

export interface DecodeRequest {
  id: number
  type: 'decode'
  bytes: Uint8Array
}

export type WorkerRequest = RenderRequest | DecodeRequest

export type WorkerResponse =
  | { id: number; type: 'rendered'; hast: Root; encoding: TextEncodingName; lossy: boolean }
  // Decoding succeeded but turning the text into HAST failed; the caller falls back to
  // showing `text` as plain source instead of making a second round trip for it.
  | { id: number; type: 'render-failed'; text: string; encoding: TextEncodingName; lossy: boolean; message: string }
  | { id: number; type: 'decoded'; text: string; encoding: TextEncodingName; lossy: boolean }
  | { id: number; type: 'failed'; message: string }
