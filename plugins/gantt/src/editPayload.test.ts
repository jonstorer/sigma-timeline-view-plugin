import { describe, expect, test } from 'vitest'
import { withColumnLabels } from './editPayload'

describe('withColumnLabels', () => {
  const columns = {
    aSYh30RydG: { id: 'aSYh30RydG', name: 'ID', columnType: 'text' },
    W3sgUzHi4C: { id: 'W3sgUzHi4C', name: 'Start Date', columnType: 'datetime' },
    dwmJtzm3mx: { id: 'dwmJtzm3mx', name: 'Assignees', columnType: 'text' },
  } as unknown as Parameters<typeof withColumnLabels>[1]

  test('re-keys the payload from column ids to their labels', () => {
    expect(
      withColumnLabels(
        {
          aSYh30RydG: 'row-1',
          W3sgUzHi4C: '2026-07-12T04:00:00.000Z',
          dwmJtzm3mx: ['Benjamin Zhao'],
        },
        columns,
      ),
    ).toEqual({
      ID: 'row-1',
      'Start Date': '2026-07-12T04:00:00.000Z',
      Assignees: ['Benjamin Zhao'],
    })
  })

  test('falls back to the column id when no label is known', () => {
    expect(withColumnLabels({ unknownCol: 5 }, columns)).toEqual({
      unknownCol: 5,
    })
  })
})
