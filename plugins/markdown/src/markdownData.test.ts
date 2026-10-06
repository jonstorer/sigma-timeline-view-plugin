import { describe, expect, test } from 'vitest'
import { extractRows } from './markdownData'

describe('extractRows', () => {
  test('zips the body column with all four corner columns by row index', () => {
    const data = {
      body: ['# One', '# Two'],
      tl: ['a1', 'a2'],
      tr: ['b1', 'b2'],
      bl: ['c1', 'c2'],
      br: ['d1', 'd2'],
    }
    expect(
      extractRows(data, {
        body: 'body',
        topLeft: 'tl',
        topRight: 'tr',
        bottomLeft: 'bl',
        bottomRight: 'br',
      }),
    ).toEqual([
      { body: '# One', topLeft: 'a1', topRight: 'b1', bottomLeft: 'c1', bottomRight: 'd1' },
      { body: '# Two', topLeft: 'a2', topRight: 'b2', bottomLeft: 'c2', bottomRight: 'd2' },
    ])
  })

  test('unconfigured corner columns resolve to "" for every row', () => {
    const data = { body: ['a', 'b'] }
    expect(extractRows(data, { body: 'body' })).toEqual([
      { body: 'a', topLeft: '', topRight: '', bottomLeft: '', bottomRight: '' },
      { body: 'b', topLeft: '', topRight: '', bottomLeft: '', bottomRight: '' },
    ])
  })

  test('row count follows the body column — a longer corner column is truncated to it', () => {
    const data = { body: ['only'], tl: ['x', 'extra'] }
    expect(extractRows(data, { body: 'body', topLeft: 'tl' })).toEqual([
      { body: 'only', topLeft: 'x', topRight: '', bottomLeft: '', bottomRight: '' },
    ])
  })

  test('a shorter corner column yields "" past its own length', () => {
    const data = { body: ['a', 'b', 'c'], tl: ['x'] }
    expect(extractRows(data, { body: 'body', topLeft: 'tl' })).toEqual([
      { body: 'a', topLeft: 'x', topRight: '', bottomLeft: '', bottomRight: '' },
      { body: 'b', topLeft: '', topRight: '', bottomLeft: '', bottomRight: '' },
      { body: 'c', topLeft: '', topRight: '', bottomLeft: '', bottomRight: '' },
    ])
  })

  test('no body column configured yields no rows', () => {
    expect(extractRows({ body: ['a'] }, {})).toEqual([])
  })

  test('no data yields no rows', () => {
    expect(extractRows(undefined, { body: 'body' })).toEqual([])
  })

  test('a null cell becomes "" rather than "null"', () => {
    const data = { body: ['a'], tl: [null] }
    expect(extractRows(data, { body: 'body', topLeft: 'tl' })).toEqual([
      { body: 'a', topLeft: '', topRight: '', bottomLeft: '', bottomRight: '' },
    ])
  })
})
