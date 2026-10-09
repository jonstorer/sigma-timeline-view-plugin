import { describe, expect, test } from 'vitest'
import { colorForKey } from './colorHash'

describe('colorForKey', () => {
  test('the same key always returns the same pair', () => {
    expect(colorForKey('Dinkar Khattar')).toEqual(colorForKey('Dinkar Khattar'))
  })

  test('a realistic roster of distinct names mostly gets distinct colors', () => {
    // Not a strict guarantee (hash collisions are still possible with any
    // finite hue count), but the whole point of hashing to a hue directly
    // (360 options) instead of indexing a small fixed palette (~8) is that
    // collisions become the exception, not the norm, for a realistic roster.
    const names = [
      'Dinkar Khattar', 'Ray Chen', 'Anushant Singh', 'Andy Leo', 'Don Huang',
      'David Max', 'Eric Bannatyne', 'Vandit Patel', 'Eric Zimanyi',
      'Ash Zahlen', 'Ayman Elkfrawy', 'Wren Ward', 'Purvil Mehta',
      'Vivek Gupta', 'Sinan Unan', 'Abhinav Ved',
    ]
    const backgrounds = new Set(names.map((n) => colorForKey(n).background))
    expect(backgrounds.size).toBeGreaterThanOrEqual(names.length - 1)
  })

  test('background and text share the same hue, for a matching pair', () => {
    const { background, text } = colorForKey('Someone')
    const hueOf = (hsl: string) => hsl.match(/hsl\((\d+)/)?.[1]
    expect(hueOf(background)).toBe(hueOf(text))
  })

  test('an empty key falls back to a fixed pair rather than throwing', () => {
    expect(() => colorForKey('')).not.toThrow()
    expect(colorForKey('')).toEqual(colorForKey(''))
  })

  test('background stays pastel (high lightness) and text stays dark, regardless of hue', () => {
    const pair = colorForKey('Someone')
    expect(pair.background).toMatch(/^hsl\(\d+, \d+%, 90%\)$/)
    expect(pair.text).toMatch(/^hsl\(\d+, \d+%, 30%\)$/)
  })
})
