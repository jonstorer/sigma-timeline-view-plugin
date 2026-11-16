import { describe, expect, test } from 'vitest'
import { extractRows } from './markdownData'

describe('extractRows', () => {
  const emptyCorners = {
    topLeft: '',
    topLeftUrl: '',
    topRight: '',
    topRightUrl: '',
    bottomLeft: '',
    bottomLeftUrl: '',
    bottomRight: '',
    bottomRightUrl: '',
  }

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
      { ...emptyCorners, body: '# One', topLeft: 'a1', topRight: 'b1', bottomLeft: 'c1', bottomRight: 'd1' },
      { ...emptyCorners, body: '# Two', topLeft: 'a2', topRight: 'b2', bottomLeft: 'c2', bottomRight: 'd2' },
    ])
  })

  test('zips each corner URL column alongside its label column', () => {
    const data = {
      body: ['# One'],
      tl: ['Author: Jon'],
      tlUrl: ['https://example.com/jon'],
      tr: ['v1.2'],
      trUrl: ['https://example.com/release'],
      bl: ['Draft'],
      blUrl: ['https://example.com/draft'],
      br: ['SIG-1'],
      brUrl: ['https://example.com/SIG-1'],
    }
    expect(
      extractRows(data, {
        body: 'body',
        topLeft: 'tl',
        topLeftUrl: 'tlUrl',
        topRight: 'tr',
        topRightUrl: 'trUrl',
        bottomLeft: 'bl',
        bottomLeftUrl: 'blUrl',
        bottomRight: 'br',
        bottomRightUrl: 'brUrl',
      }),
    ).toEqual([
      {
        body: '# One',
        topLeft: 'Author: Jon',
        topLeftUrl: 'https://example.com/jon',
        topRight: 'v1.2',
        topRightUrl: 'https://example.com/release',
        bottomLeft: 'Draft',
        bottomLeftUrl: 'https://example.com/draft',
        bottomRight: 'SIG-1',
        bottomRightUrl: 'https://example.com/SIG-1',
      },
    ])
  })

  test('unconfigured corner columns resolve to "" for every row', () => {
    const data = { body: ['a', 'b'] }
    expect(extractRows(data, { body: 'body' })).toEqual([
      { ...emptyCorners, body: 'a' },
      { ...emptyCorners, body: 'b' },
    ])
  })

  test('row count follows the body column — a longer corner column is truncated to it', () => {
    const data = { body: ['only'], tl: ['x', 'extra'] }
    expect(extractRows(data, { body: 'body', topLeft: 'tl' })).toEqual([
      { ...emptyCorners, body: 'only', topLeft: 'x' },
    ])
  })

  test('a shorter corner column yields "" past its own length', () => {
    const data = { body: ['a', 'b', 'c'], tl: ['x'] }
    expect(extractRows(data, { body: 'body', topLeft: 'tl' })).toEqual([
      { ...emptyCorners, body: 'a', topLeft: 'x' },
      { ...emptyCorners, body: 'b' },
      { ...emptyCorners, body: 'c' },
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
      { ...emptyCorners, body: 'a' },
    ])
  })
})
