export type TextEncodingName = 'utf-8' | 'utf-16le' | 'utf-16be' | 'shift_jis'

export interface DecodedText {
  text: string
  encoding: TextEncodingName
  /** True when no encoding fit and invalid sequences were replaced. */
  lossy: boolean
}

function decodeStrict(encoding: TextEncodingName, bytes: Uint8Array): string | null {
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

/**
 * UTF-16 only with a BOM; otherwise UTF-8, then Shift_JIS for older Japanese documents,
 * and finally UTF-8 with replacement characters. TextDecoder strips a matching BOM.
 */
export function decodeText(bytes: Uint8Array): DecodedText {
  const candidates: TextEncodingName[] =
    bytes[0] === 0xff && bytes[1] === 0xfe
      ? ['utf-16le']
      : bytes[0] === 0xfe && bytes[1] === 0xff
        ? ['utf-16be']
        : ['utf-8', 'shift_jis']

  for (const encoding of candidates) {
    const text = decodeStrict(encoding, bytes)
    if (text !== null) return { text, encoding, lossy: false }
  }
  const [fallback = 'utf-8'] = candidates
  return { text: new TextDecoder(fallback).decode(bytes), encoding: fallback, lossy: true }
}
