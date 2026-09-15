import { describe, expect, it } from 'vitest'
import { findMatches } from '../../src/lib/search-match'

describe('findMatches', () => {
  it('finds non-overlapping occurrences in order', () => {
    expect(findMatches('abcabcabc', 'abc', true, 100)).toEqual([
      { start: 0, end: 3 },
      { start: 3, end: 6 },
      { start: 6, end: 9 },
    ])
  })

  it('is case-insensitive by default', () => {
    expect(findMatches('Hello HELLO hello', 'hello', false, 100)).toHaveLength(3)
  })

  it('respects case sensitivity when requested', () => {
    expect(findMatches('Hello HELLO hello', 'hello', true, 100)).toEqual([{ start: 12, end: 17 }])
  })

  it('does not overlap matches for a repeating pattern', () => {
    expect(findMatches('aaaa', 'aa', true, 100)).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 4 },
    ])
  })

  it('returns nothing for an empty query', () => {
    expect(findMatches('anything', '', true, 100)).toEqual([])
  })

  it('returns nothing when there is no match', () => {
    expect(findMatches('anything', 'xyz', true, 100)).toEqual([])
  })

  it('stops at maxMatches', () => {
    expect(findMatches('aaaaaa', 'a', true, 3)).toHaveLength(3)
  })

  it('handles Japanese text', () => {
    expect(findMatches('こんにちは。こんにちは。', 'こんにちは', true, 100)).toHaveLength(2)
  })
})
