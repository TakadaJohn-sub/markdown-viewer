import fs from 'node:fs'
import path from 'node:path'
import { THEME_SOURCES, type ThemeSource } from '../shared/theme'

export interface Settings {
  theme: ThemeSource
  zoomLevel: number
  windowSize: { width: number; height: number }
  /** Table of contents panel visibility (§8.4); shared across windows like theme/zoom. */
  tocVisible: boolean
  /** User-authored CSS applied to every window (§17 Phase 3); empty string = none. */
  customCss: string
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  zoomLevel: 0,
  windowSize: { width: 960, height: 800 },
  tocVisible: false,
  customCss: '',
}

export const ZOOM_LEVEL_RANGE = { min: -3, max: 5 } as const
const WINDOW_SIZE_RANGE = { min: 320, max: 16384 } as const
export const CUSTOM_CSS_MAX_LENGTH = 50_000

function isFiniteBetween(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

/** Validates each field independently so one bad value does not reset the rest. */
export function parseSettings(raw: unknown): Settings {
  const input = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const size = (typeof input.windowSize === 'object' && input.windowSize !== null ? input.windowSize : {}) as Record<
    string,
    unknown
  >
  return {
    theme: THEME_SOURCES.includes(input.theme as ThemeSource) ? (input.theme as ThemeSource) : DEFAULT_SETTINGS.theme,
    zoomLevel: isFiniteBetween(input.zoomLevel, ZOOM_LEVEL_RANGE.min, ZOOM_LEVEL_RANGE.max)
      ? input.zoomLevel
      : DEFAULT_SETTINGS.zoomLevel,
    windowSize:
      isFiniteBetween(size.width, WINDOW_SIZE_RANGE.min, WINDOW_SIZE_RANGE.max) &&
      isFiniteBetween(size.height, WINDOW_SIZE_RANGE.min, WINDOW_SIZE_RANGE.max)
        ? { width: Math.round(size.width), height: Math.round(size.height) }
        : DEFAULT_SETTINGS.windowSize,
    tocVisible: typeof input.tocVisible === 'boolean' ? input.tocVisible : DEFAULT_SETTINGS.tocVisible,
    customCss:
      typeof input.customCss === 'string' && input.customCss.length <= CUSTOM_CSS_MAX_LENGTH
        ? input.customCss
        : DEFAULT_SETTINGS.customCss,
  }
}

export class SettingsStore {
  private saveTimer: NodeJS.Timeout | undefined

  private constructor(
    private readonly filePath: string,
    private current: Settings,
  ) {}

  static load(filePath: string): SettingsStore {
    let raw: unknown
    try {
      raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch {
      raw = undefined
    }
    return new SettingsStore(filePath, parseSettings(raw))
  }

  get(): Settings {
    return this.current
  }

  update(patch: Partial<Settings>): void {
    this.current = parseSettings({ ...this.current, ...patch })
    clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => this.flush(), 300)
  }

  /** Writes synchronously via a temp file + rename, so it is safe to call from `will-quit`. */
  flush(): void {
    clearTimeout(this.saveTimer)
    this.saveTimer = undefined
    const tempPath = `${this.filePath}.tmp`
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
      fs.writeFileSync(tempPath, `${JSON.stringify(this.current, null, 2)}\n`)
      fs.renameSync(tempPath, this.filePath)
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  }
}
