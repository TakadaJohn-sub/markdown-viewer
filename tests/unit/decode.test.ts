import { describe, expect, it } from 'vitest'
import { decodeText } from '../../src/markdown/decode'

const bytes = (...values: number[]) => new Uint8Array(values)
const utf8 = (text: string) => new TextEncoder().encode(text)

describe('decodeText', () => {
  it('decodes UTF-8', () => {
    expect(decodeText(utf8('# こんにちは'))).toEqual({ text: '# こんにちは', encoding: 'utf-8', lossy: false })
  })

  it('strips a UTF-8 BOM', () => {
    expect(decodeText(bytes(0xef, 0xbb, 0xbf, 0x41)).text).toBe('A')
  })

  it('decodes UTF-16 with a BOM', () => {
    expect(decodeText(bytes(0xff, 0xfe, 0x41, 0x00, 0x42, 0x00))).toEqual({ text: 'AB', encoding: 'utf-16le', lossy: false })
    expect(decodeText(bytes(0xfe, 0xff, 0x00, 0x41))).toEqual({ text: 'A', encoding: 'utf-16be', lossy: false })
  })

  it('falls back to Shift_JIS for invalid UTF-8', () => {
    // "日本語" in Shift_JIS
    expect(decodeText(bytes(0x93, 0xfa, 0x96, 0x7b, 0x8c, 0xea))).toEqual({
      text: '日本語',
      encoding: 'shift_jis',
      lossy: false,
    })
  })

  it('replaces invalid sequences when nothing fits', () => {
    const result = decodeText(bytes(0x41, 0xff, 0xff, 0x42))
    expect(result).toMatchObject({ encoding: 'utf-8', lossy: true })
    expect(result.text).toContain('�')
  })
})
