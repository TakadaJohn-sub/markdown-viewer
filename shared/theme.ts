export type ThemeSource = 'system' | 'light' | 'dark'

export const THEME_SOURCES: readonly ThemeSource[] = ['system', 'light', 'dark']

/** Window background painted before the page loads. Keep in sync with --mdv-bg in src/styles/tokens.css. */
export const WINDOW_BACKGROUND = { light: '#ffffff', dark: '#1b1c1f' } as const
