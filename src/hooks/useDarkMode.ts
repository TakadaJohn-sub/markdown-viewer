import { useEffect, useState } from 'react'

const QUERY = '(prefers-color-scheme: dark)'

/** Tracks the same signal the app's CSS themes off (§7.1) for the rare component — Mermaid
 * chief among them — that needs to know Light/Dark in JS, not just in a stylesheet. */
export function useDarkMode(): boolean {
  const [dark, setDark] = useState(() => matchMedia(QUERY).matches)
  useEffect(() => {
    const media = matchMedia(QUERY)
    const handleChange = (event: MediaQueryListEvent) => setDark(event.matches)
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])
  return dark
}
