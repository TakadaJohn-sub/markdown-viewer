export interface MatchRange {
  start: number
  end: number
}

/**
 * Finds up to `maxMatches` non-overlapping occurrences of `query` in `text`, in order.
 * Plain substring search (no regex), so nothing in the query can be misread as a pattern.
 */
export function findMatches(text: string, query: string, caseSensitive: boolean, maxMatches: number): MatchRange[] {
  if (query === '' || maxMatches <= 0) return []
  const haystack = caseSensitive ? text : text.toLowerCase()
  const needle = caseSensitive ? query : query.toLowerCase()
  const matches: MatchRange[] = []
  let fromIndex = 0
  while (matches.length < maxMatches) {
    const index = haystack.indexOf(needle, fromIndex)
    if (index === -1) break
    matches.push({ start: index, end: index + needle.length })
    fromIndex = index + needle.length
  }
  return matches
}
