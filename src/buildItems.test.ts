import { describe, expect, test } from 'vitest'
import {
  buildColorByStatus,
  buildItemsAndGroups,
  buildPathsForRow,
  parseGroupCell,
  pathToGroupId,
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
    expect(result.rowIdByItemId.get('r1|Alice')).toBe('r1')
  })

  test('rowIdByItemId maps every fanned-out item back to the source row', () => {
    const data = {
      start_col: ['2026-05-01'],
      end_col: ['2026-05-08'],
      group_col: [['Alice', 'Bob']],
      label_col: ['Task'],
      id_col: ['r1'],
    }
    const result = buildItemsAndGroups(baseConfig, data, new Map())
    expect(result.items).toHaveLength(2)
    for (const item of result.items) {
      expect(result.rowIdByItemId.get(String(item.id))).toBe('r1')
    }
  })

  test('rowIdByItemId is empty when no idColumn is configured', () => {
    const cfg = { ...baseConfig, idColumn: undefined }
    const data = {
      start_col: ['2026-05-01'],
      end_col: ['2026-05-08'],
      group_col: ['Alice'],
      label_col: ['T'],
    }
    const result = buildItemsAndGroups(cfg, data, new Map())
    expect(result.items).toHaveLength(1)
    expect(result.rowIdByItemId.size).toBe(0)
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

  test('no group column → items render ungrouped, no groups emitted', () => {
    const data = {
      start_col: ['2026-05-01', '2026-05-08'],
      end_col: ['2026-05-08', '2026-05-15'],
      label_col: ['T1', 'T2'],
      id_col: ['r1', 'r2'],
    }
    const result = buildItemsAndGroups(
      {
        start: 'start_col',
        end: 'end_col',
        label: 'label_col',
        idColumn: 'id_col',
      },
      data,
      new Map(),
    )
    expect(result.groups).toEqual([])
    expect(result.items).toHaveLength(2)
    // Items must not carry a `group` field — vis-timeline renders them flat.
    expect(result.items[0]).not.toHaveProperty('group')
    expect(result.items[0].id).toBe('r1')
    expect(result.items[1].id).toBe('r2')
  })

  test('empty group array also renders ungrouped', () => {
    const data = {
      start_col: ['2026-05-01'],
      end_col: ['2026-05-08'],
      label_col: ['T'],
      id_col: ['r1'],
    }
    const result = buildItemsAndGroups(
      { ...baseConfig, group: [] },
      data,
      new Map(),
    )
    expect(result.groups).toEqual([])
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).not.toHaveProperty('group')
  })

  test('ungrouped items still carry status visuals', () => {
    const data = {
      start_col: ['2026-05-01'],
      end_col: ['2026-05-08'],
      label_col: ['T'],
      id_col: ['r1'],
      status_col: ['On Track'],
    }
    const result = buildItemsAndGroups(
      {
        start: 'start_col',
        end: 'end_col',
        label: 'label_col',
        idColumn: 'id_col',
        statusColumn: 'status_col',
      },
      data,
      new Map([['On Track', '#22c55e']]),
    )
    expect(result.items[0].style).toBe('box-shadow: inset 5px 0 0 #22c55e;')
    expect(result.visuals.get('r1')).toEqual({ chipColor: '#22c55e' })
  })

  test('group column may be passed as a single-element array', () => {
    // Sigma's allowMultiple:true returns an array even with one selection.
    const data = {
      start_col: ['2026-05-01'],
      end_col: ['2026-05-08'],
      group_col: ['Alice'],
      label_col: ['T'],
      id_col: ['r1'],
    }
    const result = buildItemsAndGroups(
      { ...baseConfig, group: ['group_col'] },
      data,
      new Map(),
    )
    expect(result.items).toHaveLength(1)
    expect(result.groups).toEqual([{ id: 'Alice', content: 'Alice' }])
  })
})

describe('pathToGroupId', () => {
  test('joins path segments with pipe', () => {
    expect(pathToGroupId(['NA', 'Team Alpha', 'Alice'], 2)).toBe(
      'NA|Team Alpha|Alice',
    )
  })

  test('slices to the requested level', () => {
    const path = ['NA', 'Team Alpha', 'Alice']
    expect(pathToGroupId(path, 0)).toBe('NA')
    expect(pathToGroupId(path, 1)).toBe('NA|Team Alpha')
  })

  test('escapes pipes in segments', () => {
    expect(pathToGroupId(['a|b', 'c'], 1)).toBe('a\\|b|c')
  })
})

describe('buildPathsForRow', () => {
  test('all single values → one path', () => {
    const paths = buildPathsForRow([
      { values: ['NA'], wasMulti: false },
      { values: ['Alpha'], wasMulti: false },
      { values: ['Alice'], wasMulti: false },
    ])
    expect(paths).toEqual([['NA', 'Alpha', 'Alice']])
  })

  test('single × multi produces one path per value in the multi cell', () => {
    // team=A (single), assignee=[alice,bob] (multi) → 2 paths, both under A
    const paths = buildPathsForRow([
      { values: ['Team A'], wasMulti: false },
      { values: ['Alice', 'Bob'], wasMulti: true },
    ])
    expect(paths).toEqual([
      ['Team A', 'Alice'],
      ['Team A', 'Bob'],
    ])
  })

  test('multi × multi produces the full cartesian product', () => {
    // team=[A,B], assignee=[alice,bob] → 4 paths
    const paths = buildPathsForRow([
      { values: ['Team A', 'Team B'], wasMulti: true },
      { values: ['Alice', 'Bob'], wasMulti: true },
    ])
    expect(paths).toEqual([
      ['Team A', 'Alice'],
      ['Team A', 'Bob'],
      ['Team B', 'Alice'],
      ['Team B', 'Bob'],
    ])
  })

  test('uneven multi lengths still produce the full cartesian product', () => {
    // team=[A,B,C], assignee=[alice,bob] → 3×2 = 6 paths, nothing dropped
    const paths = buildPathsForRow([
      { values: ['A', 'B', 'C'], wasMulti: true },
      { values: ['alice', 'bob'], wasMulti: true },
    ])
    expect(paths).toHaveLength(6)
    expect(paths).toEqual([
      ['A', 'alice'],
      ['A', 'bob'],
      ['B', 'alice'],
      ['B', 'bob'],
      ['C', 'alice'],
      ['C', 'bob'],
    ])
  })

  test('three levels of multi-values expand correctly', () => {
    // region=[NA,EU] × team=[A,B] × person=[alice,bob] → 8 paths
    const paths = buildPathsForRow([
      { values: ['NA', 'EU'], wasMulti: true },
      { values: ['A', 'B'], wasMulti: true },
      { values: ['alice', 'bob'], wasMulti: true },
    ])
    expect(paths).toHaveLength(8)
  })

  test('any empty cell drops the row', () => {
    const paths = buildPathsForRow([
      { values: ['A'], wasMulti: false },
      { values: [], wasMulti: false },
    ])
    expect(paths).toEqual([])
  })

  test('empty input yields no paths', () => {
    expect(buildPathsForRow([])).toEqual([])
  })
})

describe('buildItemsAndGroups — multi-level', () => {
  const config = {
    start: 'start_col',
    end: 'end_col',
    group: ['team_col', 'person_col'],
    label: 'label_col',
    idColumn: 'id_col',
  }

  test('two levels emit parent + leaf groups with nestedGroups wired up', () => {
    const data = {
      start_col: ['2026-05-01', '2026-05-01'],
      end_col: ['2026-05-08', '2026-05-08'],
      team_col: ['Alpha', 'Beta'],
      person_col: ['Alice', 'Bob'],
      label_col: ['T1', 'T2'],
      id_col: ['r1', 'r2'],
    }
    const result = buildItemsAndGroups(config, data, new Map())

    // Two items, each placed in its leaf group
    expect(result.items.map((i) => i.group).sort()).toEqual([
      'Alpha|Alice',
      'Beta|Bob',
    ])

    // Four groups: two parents (Alpha, Beta) + two leaves
    expect(result.groups.map((g) => g.id).sort()).toEqual([
      'Alpha',
      'Alpha|Alice',
      'Beta',
      'Beta|Bob',
    ])

    const alpha = result.groups.find((g) => g.id === 'Alpha')!
    expect(alpha.content).toBe('Alpha')
    expect(alpha.nestedGroups).toEqual(['Alpha|Alice'])

    const alphaAlice = result.groups.find((g) => g.id === 'Alpha|Alice')!
    expect(alphaAlice.content).toBe('Alice')
    expect(alphaAlice.nestedGroups).toBeUndefined()
  })

  test('siblings sharing a parent share one parent row', () => {
    const data = {
      start_col: ['2026-05-01', '2026-05-01'],
      end_col: ['2026-05-08', '2026-05-08'],
      team_col: ['Alpha', 'Alpha'],
      person_col: ['Alice', 'Bob'],
      label_col: ['T1', 'T2'],
      id_col: ['r1', 'r2'],
    }
    const result = buildItemsAndGroups(config, data, new Map())
    const alpha = result.groups.find((g) => g.id === 'Alpha')!
    expect(alpha.nestedGroups).toEqual(['Alpha|Alice', 'Alpha|Bob'])
  })

  test('multi-value cells at multiple levels fan out cartesian-style', () => {
    // Item with two teams and two assignees: one row, four leaf lanes.
    // The item appears under every combination of team × assignee.
    const data = {
      start_col: ['2026-05-01'],
      end_col: ['2026-05-08'],
      team_col: [['Alpha', 'Beta']],
      person_col: [['Alice', 'Bob']],
      label_col: ['Cross-team'],
      id_col: ['r1'],
    }
    const result = buildItemsAndGroups(config, data, new Map())
    expect(result.items).toHaveLength(4)
    expect(result.items.map((i) => i.group).sort()).toEqual([
      'Alpha|Alice',
      'Alpha|Bob',
      'Beta|Alice',
      'Beta|Bob',
    ])
  })

  test('nested children are sorted alphabetically by content', () => {
    const data = {
      start_col: ['2026-05-01', '2026-05-01', '2026-05-01'],
      end_col: ['2026-05-08', '2026-05-08', '2026-05-08'],
      team_col: ['Alpha', 'Alpha', 'Alpha'],
      person_col: ['Zach', 'Alice', 'Mike'],
      label_col: ['', '', ''],
      id_col: ['r1', 'r2', 'r3'],
    }
    const result = buildItemsAndGroups(config, data, new Map())
    const alpha = result.groups.find((g) => g.id === 'Alpha')!
    expect(alpha.nestedGroups).toEqual([
      'Alpha|Alice',
      'Alpha|Mike',
      'Alpha|Zach',
    ])
  })

  test('three levels of nesting build a full chain', () => {
    const data = {
      start_col: ['2026-05-01'],
      end_col: ['2026-05-08'],
      region_col: ['NA'],
      team_col: ['Alpha'],
      person_col: ['Alice'],
      label_col: ['T'],
      id_col: ['r1'],
    }
    const result = buildItemsAndGroups(
      {
        start: 'start_col',
        end: 'end_col',
        group: ['region_col', 'team_col', 'person_col'],
        label: 'label_col',
        idColumn: 'id_col',
      },
      data,
      new Map(),
    )
    expect(result.groups.map((g) => g.id).sort()).toEqual([
      'NA',
      'NA|Alpha',
      'NA|Alpha|Alice',
    ])
    const na = result.groups.find((g) => g.id === 'NA')!
    expect(na.nestedGroups).toEqual(['NA|Alpha'])
    const naAlpha = result.groups.find((g) => g.id === 'NA|Alpha')!
    expect(naAlpha.nestedGroups).toEqual(['NA|Alpha|Alice'])
    // Parents emitted before leaves (stable order for debugging).
    const ids = result.groups.map((g) => g.id)
    expect(ids.indexOf('NA')).toBeLessThan(ids.indexOf('NA|Alpha'))
    expect(ids.indexOf('NA|Alpha')).toBeLessThan(ids.indexOf('NA|Alpha|Alice'))
  })

  test('item id encodes the full leaf path so siblings are unique per parent', () => {
    // Same person under different teams must not collide.
    const data = {
      start_col: ['2026-05-01', '2026-05-01'],
      end_col: ['2026-05-08', '2026-05-08'],
      team_col: ['Alpha', 'Beta'],
      person_col: ['Alice', 'Alice'],
      label_col: ['A1', 'A2'],
      id_col: ['r1', 'r2'],
    }
    const result = buildItemsAndGroups(config, data, new Map())
    expect(result.items.map((i) => i.id).sort()).toEqual([
      'r1|Alpha|Alice',
      'r2|Beta|Alice',
    ])
  })
})
