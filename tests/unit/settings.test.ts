import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CUSTOM_CSS_MAX_LENGTH, DEFAULT_SETTINGS, SettingsStore, parseSettings } from '../../electron/settings'

describe('parseSettings', () => {
  it('returns defaults for missing or malformed input', () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('nonsense')).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps valid fields and replaces invalid ones individually', () => {
    expect(
      parseSettings({ theme: 'dark', zoomLevel: 99, windowSize: { width: 1200, height: 'tall' }, tocVisible: 'yes' }),
    ).toEqual({
      theme: 'dark',
      zoomLevel: DEFAULT_SETTINGS.zoomLevel,
      windowSize: DEFAULT_SETTINGS.windowSize,
      tocVisible: DEFAULT_SETTINGS.tocVisible,
      customCss: DEFAULT_SETTINGS.customCss,
    })
  })

  it('keeps a valid tocVisible value', () => {
    expect(parseSettings({ tocVisible: true }).tocVisible).toBe(true)
  })

  it('rejects unknown themes', () => {
    expect(parseSettings({ theme: 'sepia' }).theme).toBe('system')
  })

  it('keeps a valid customCss value', () => {
    expect(parseSettings({ customCss: 'body { color: red; }' }).customCss).toBe('body { color: red; }')
  })

  it('rejects a non-string customCss value', () => {
    expect(parseSettings({ customCss: 123 }).customCss).toBe(DEFAULT_SETTINGS.customCss)
  })

  it('rejects a customCss value over the length limit', () => {
    const tooLong = 'a'.repeat(CUSTOM_CSS_MAX_LENGTH + 1)
    expect(parseSettings({ customCss: tooLong }).customCss).toBe(DEFAULT_SETTINGS.customCss)
  })
})

describe('SettingsStore', () => {
  const dirs: string[] = []
  const tempFile = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdv-settings-'))
    dirs.push(dir)
    return path.join(dir, 'settings.json')
  }

  afterEach(() => {
    for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
  })

  it('persists updates and reads them back', () => {
    const file = tempFile()
    const store = SettingsStore.load(file)
    store.update({ theme: 'light', zoomLevel: 1.5 })
    store.flush()
    expect(SettingsStore.load(file).get()).toMatchObject({ theme: 'light', zoomLevel: 1.5 })
    expect(fs.existsSync(`${file}.tmp`)).toBe(false)
  })

  it('falls back to defaults when the file is corrupt', () => {
    const file = tempFile()
    fs.writeFileSync(file, '{ not json')
    expect(SettingsStore.load(file).get()).toEqual(DEFAULT_SETTINGS)
  })
})
