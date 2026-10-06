import { describe, expect, test } from 'vitest'
import { extractMarkdown } from './markdownData'

describe('extractMarkdown', () => {
  test('returns row 0 of the bound column as a string', () => {
    expect(extractMarkdown({ md: ['# Hi'] }, 'md')).toBe('# Hi')
  })

  test('ignores rows after 0 — this plugin renders one value, not a list', () => {
    expect(extractMarkdown({ md: ['first', 'second'] }, 'md')).toBe('first')
  })

  test('coerces a non-string cell (e.g. a number) to a string', () => {
    expect(extractMarkdown({ md: [42] }, 'md')).toBe('42')
  })

  test('no column configured yields empty string', () => {
    expect(extractMarkdown({ md: ['x'] }, undefined)).toBe('')
  })

  test('no data yields empty string', () => {
    expect(extractMarkdown(undefined, 'md')).toBe('')
  })

  test('column configured but missing from data yields empty string', () => {
    expect(extractMarkdown({ other: ['x'] }, 'md')).toBe('')
  })

  test('a null or empty-array cell yields empty string, not "null"', () => {
    expect(extractMarkdown({ md: [null] }, 'md')).toBe('')
    expect(extractMarkdown({ md: [] }, 'md')).toBe('')
  })
})
