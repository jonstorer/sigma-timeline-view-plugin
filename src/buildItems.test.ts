import { describe, expect, test } from 'vitest'
import {
  buildColorByStatus,
  buildItemsAndGroups,
  parseGroupCell,
  safeId,
} from './buildItems'

describe('parseGroupCell', () => {
  test('null and undefined return empty', () => {
    expect(parseGroupCell(null)).toEqual({ values: [], wasMulti: false })
    expect(parseGroupCell(undefined)).toEqual({ values: [], wasMulti: false })
  })

  test('empty string returns empty', () => {
    expect(parseGroupCell('')).toEqual({ values: [], wasMulti: false })
    expect(parseGroupCell('   ')).toEqual({ values: [], wasMulti: false })
  })

  test('single string returns one value, not multi', () => {
    expect(parseGroupCell('Alice')).toEqual({
      values: ['Alice'],
      wasMulti: false,
    })
  })

  test('single string with surrounding whitespace is trimmed', () => {
    expect(parseGroupCell('  Alice  ')).toEqual({
      values: ['Alice'],
      wasMulti: false,
    })
  })

  test('array input is multi', () => {
    expect(parseGroupCell(['Alice', 'Bob'])).toEqual({
      values: ['Alice', 'Bob'],
      wasMulti: true,
    })
  })

  test('JSON-array string is parsed and multi', () => {
    expect(parseGroupCell('["Alice","Bob","Carol"]')).toEqual({
      values: ['Alice', 'Bob', 'Carol'],
      wasMulti: true,
    })
  })

  test('comma-separated string is split and multi', () => {
    expect(parseGroupCell('Alice, Bob, Carol')).toEqual({
      values: ['Alice', 'Bob', 'Carol'],
      wasMulti: true,
    })
  })

  test('array filters empty strings', () => {
    expect(parseGroupCell(['Alice', '', 'Bob'])).toEqual({
      values: ['Alice', 'Bob'],
      wasMulti: true,
    })
  })

  test('comma list filters empty entries', () => {
    expect(parseGroupCell('Alice,,Bob,')).toEqual({
      values: ['Alice', 'Bob'],
      wasMulti: true,
    })
  })

  test('malformed JSON-array string falls back to comma split', () => {
    // String looks like JSON but doesn't parse — should still split on comma.
    expect(parseGroupCell('[Alice, Bob')).toEqual({
      values: ['[Alice', 'Bob'],
      wasMulti: true,
    })
  })

  test('JSON-array string with one element is still multi', () => {
    expect(parseGroupCell('["Alice"]')).toEqual({
      values: ['Alice'],
      wasMulti: true,
    })
  })

  test('numbers in array are coerced to strings', () => {
    expect(parseGroupCell([1, 2, 3])).toEqual({
      values: ['1', '2', '3'],
      wasMulti: true,
    })
  })
})

describe('safeId', () => {
  test('passes through strings without pipes', () => {
    expect(safeId('Alice')).toBe('Alice')
    expect(safeId('row-123')).toBe('row-123')
  })

  test('escapes pipe characters', () => {
    expect(safeId('foo|bar')).toBe('foo\\|bar')
    expect(safeId('a|b|c')).toBe('a\\|b\\|c')
  })

  test('coerces non-strings', () => {
    expect(safeId(42)).toBe('42')
    expect(safeId(null)).toBe('null')
  })
})

describe('buildColorByStatus', () => {
  test('empty when config or legendData is missing', () => {
    expect(buildColorByStatus(null, undefined).size).toBe(0)
    expect(buildColorByStatus({}, undefined).size).toBe(0)
    expect(buildColorByStatus(null, {})).toEqual(new Map())
  })

  test('empty when legend column names are not configured', () => {
    expect(buildColorByStatus({}, { x: ['a'] }).size).toBe(0)
  })

  test('builds map from legend columns', () => {
    const config = {
      statusLegendName: 'name_col',
      statusLegendColor: 'color_col',
    }
    const legendData = {
      name_col: ['On Track', 'Open', 'Done'],
      color_col: ['#22c55e', '#3b82f6', '#a3a3a3'],
    }
    const result = buildColorByStatus(config, legendData)
    expect(result.get('On Track')).toBe('#22c55e')
    expect(result.get('Open')).toBe('#3b82f6')
    expect(result.get('Done')).toBe('#a3a3a3')
    expect(result.size).toBe(3)
  })

  test('skips rows with null name or color', () => {
    const config = {
      statusLegendName: 'name_col',
      statusLegendColor: 'color_col',
    }
    const legendData = {
      name_col: ['A', null, 'C'],
      color_col: ['#111', '#222', null],
    }
    const result = buildColorByStatus(config, legendData)
    expect(result.get('A')).toBe('#111')
    expect(result.has('C')).toBe(false)
    expect(result.size).toBe(1)
  })

  test('skips rows with whitespace-only color', () => {
    const config = {
      statusLegendName: 'name_col',
      statusLegendColor: 'color_col',
    }
    const legendData = {
      name_col: ['A', 'B'],
      color_col: ['#aaa', '   '],
    }
    const result = buildColorByStatus(config, legendData)
    expect(result.size).toBe(1)
    expect(result.get('A')).toBe('#aaa')
  })
})

describe('buildItemsAndGroups', () => {
  const baseConfig = {
    start: 'start_col',
    end: 'end_col',
    group: 'group_col',
    label: 'label_col',
    idColumn: 'id_col',
  }

  test('returns empty when config is missing', () => {
    const result = buildItemsAndGroups(null, undefined, new Map())
    expect(result.items).toEqual([])
    expect(result.groups).toEqual([])
  })

  test('returns empty when required cols are not configured', () => {
    const result = buildItemsAndGroups(
      { label: 'x' },
      { x: [1] },
      new Map(),
    )
    expect(result.items).toEqual([])
    expect(result.groups).toEqual([])
  })

  test('one row, one group → one item in one lane', () => {
    const data = {
      start_col: ['2026-05-01'],
      end_col: ['2026-05-08'],
      group_col: ['Alice'],
      label_col: ['Task A'],
      id_col: ['r1'],
    }
    const result = buildItemsAndGroups(baseConfig, data, new Map())
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      id: 'r1|Alice',
      group: 'Alice',
      content: 'Task A',
      type: 'range',
    })
    expect(result.groups).toEqual([{ id: 'Alice', content: 'Alice' }])
  })

  test('one row with multi-value group → one item per group', () => {
    const data = {
      start_col: ['2026-05-01'],
      end_col: ['2026-05-08'],
      group_col: [['Alice', 'Bob']],
      label_col: ['Task'],
      id_col: ['r1'],
    }
    const result = buildItemsAndGroups(baseConfig, data, new Map())
    expect(result.items).toHaveLength(2)
    expect(result.items.map((i) => i.group).sort()).toEqual(['Alice', 'Bob'])
    expect(result.groups.map((g) => g.id).sort()).toEqual(['Alice', 'Bob'])
  })

  test('groups are sorted alphabetically by id', () => {
    const data = {
      start_col: ['2026-05-01', '2026-05-01', '2026-05-01'],
      end_col: ['2026-05-08', '2026-05-08', '2026-05-08'],
      group_col: ['Zach', 'Alice', 'Mike'],
      label_col: ['', '', ''],
      id_col: ['r1', 'r2', 'r3'],
    }
    const result = buildItemsAndGroups(baseConfig, data, new Map())
    expect(result.groups.map((g) => g.id)).toEqual(['Alice', 'Mike', 'Zach'])
  })

  test('rows with null start or end are skipped', () => {
    const data = {
      start_col: ['2026-05-01', null, '2026-05-01'],
      end_col: ['2026-05-08', '2026-05-08', null],
      group_col: ['A', 'B', 'C'],
      label_col: ['', '', ''],
      id_col: ['r1', 'r2', 'r3'],
    }
    const result = buildItemsAndGroups(baseConfig, data, new Map())
    expect(result.items).toHaveLength(1)
    expect(result.items[0].group).toBe('A')
  })

  test('rows with empty group cell are skipped', () => {
    const data = {
      start_col: ['2026-05-01', '2026-05-01'],
      end_col: ['2026-05-08', '2026-05-08'],
      group_col: ['Alice', null],
      label_col: ['', ''],
      id_col: ['r1', 'r2'],
    }
    const result = buildItemsAndGroups(baseConfig, data, new Map())
    expect(result.items).toHaveLength(1)
  })

  test('status color is applied as inline box-shadow style', () => {
    const data = {
      start_col: ['2026-05-01'],
      end_col: ['2026-05-08'],
      group_col: ['Alice'],
      label_col: ['T'],
      id_col: ['r1'],
      status_col: ['On Track'],
    }
    const colorMap = new Map([['On Track', '#22c55e']])
    const result = buildItemsAndGroups(
      { ...baseConfig, statusColumn: 'status_col' },
      data,
      colorMap,
    )
    expect(result.items[0].style).toBe(
      'box-shadow: inset 5px 0 0 #22c55e;',
    )
    expect(result.visuals.get('r1|Alice')).toEqual({ chipColor: '#22c55e' })
  })

  test('status without legend match leaves item un-styled', () => {
    const data = {
      start_col: ['2026-05-01'],
      end_col: ['2026-05-08'],
      group_col: ['Alice'],
      label_col: ['T'],
      id_col: ['r1'],
      status_col: ['Unknown'],
    }
    const result = buildItemsAndGroups(
      { ...baseConfig, statusColumn: 'status_col' },
      data,
      new Map([['On Track', '#22c55e']]),
    )
    expect(result.items[0].style).toBeUndefined()
    expect(result.visuals.has('r1|Alice')).toBe(false)
  })

  test('pill text populates visuals map but not style', () => {
    const data = {
      start_col: ['2026-05-01'],
      end_col: ['2026-05-08'],
      group_col: ['Alice'],
      label_col: ['T'],
      id_col: ['r1'],
      pill_col: ['P1'],
    }
    const result = buildItemsAndGroups(
      { ...baseConfig, pillLabelColumn: 'pill_col' },
      data,
      new Map(),
    )
    expect(result.visuals.get('r1|Alice')).toEqual({ pill: 'P1' })
    expect(result.items[0].style).toBeUndefined()
  })

  test('row ids fall back to row index when idColumn is not configured', () => {
    const config = {
      start: 'start_col',
      end: 'end_col',
      group: 'group_col',
    }
    const data = {
      start_col: ['2026-05-01'],
      end_col: ['2026-05-08'],
      group_col: ['Alice'],
    }
    const result = buildItemsAndGroups(config, data, new Map())
    expect(result.items[0].id).toBe('__row_0|Alice')
  })

  test('row id with pipe is escaped in item id', () => {
    const data = {
      start_col: ['2026-05-01'],
      end_col: ['2026-05-08'],
      group_col: ['Alice'],
      label_col: ['T'],
      id_col: ['weird|id'],
    }
    const result = buildItemsAndGroups(baseConfig, data, new Map())
    expect(result.items[0].id).toBe('weird\\|id|Alice')
  })
})
