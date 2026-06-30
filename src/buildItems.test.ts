import { describe, expect, test } from 'vitest'
import {
  applyLaneMove,
  buildItemsAndGroups,
  buildPathsForRow,
  parseGroupCell,
  parseGroupId,
  pathToGroupId,
  safeId,
} from './buildItems'

describe('buildItemsAndGroups rowIdByItemId', () => {
  test('maps each item id to its source row id', () => {
    const config = { startDate: 'start', endDate: 'end', idColumn: 'id' }
    const data = {
      start: ['2026-01-01', '2026-02-01'],
      end: ['2026-01-05', '2026-02-05'],
      id: ['r1', 'r2'],
    }
    const { rowIdByItemId } = buildItemsAndGroups(config, data)
    expect(rowIdByItemId.get('r1')).toBe('r1')
    expect(rowIdByItemId.get('r2')).toBe('r2')
  })
})

describe('buildItemsAndGroups description', () => {
  test('carries the description column value verbatim into visuals', () => {
    const config = {
      startDate: 'start',
      endDate: 'end',
      idColumn: 'id',
      descriptionColumn: 'desc',
    }
    const data = {
      start: ['2026-01-01', '2026-02-01'],
      end: ['2026-01-05', '2026-02-05'],
      id: ['r1', 'r2'],
      desc: ['Kickoff meeting\nwith client', ''],
    }
    const { visuals } = buildItemsAndGroups(config, data)
    expect(visuals.get('r1')?.description).toBe('Kickoff meeting\nwith client')
    // Blank cells leave no description (and no visual at all here).
    expect(visuals.has('r2')).toBe(false)
  })

  test('no description column means no description on visuals', () => {
    const config = { startDate: 'start', endDate: 'end', idColumn: 'id' }
    const data = {
      start: ['2026-01-01'],
      end: ['2026-01-05'],
      id: ['r1'],
    }
    const { visuals } = buildItemsAndGroups(config, data)
    expect(visuals.get('r1')?.description).toBeUndefined()
  })
})

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

describe('buildItemsAndGroups', () => {
  const baseConfig = {
    startDate: 'start_col',
    endDate: 'end_col',
    group: 'group_col',
    label: 'label_col',
    idColumn: 'id_col',
  }

  test('returns empty when config is missing', () => {
    const result = buildItemsAndGroups(null, undefined)
    expect(result.items).toEqual([])
    expect(result.groups).toEqual([])
  })

  test('returns empty when required cols are not configured', () => {
    const result = buildItemsAndGroups({ label: 'x' }, { x: [1] })
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
    const result = buildItemsAndGroups(baseConfig, data)
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
    const result = buildItemsAndGroups(baseConfig, data)
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
    const result = buildItemsAndGroups(cfg, data)
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
    const result = buildItemsAndGroups(baseConfig, data)
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
    const result = buildItemsAndGroups(baseConfig, data)
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
    const result = buildItemsAndGroups(baseConfig, data)
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
    const result = buildItemsAndGroups(baseConfig, data)
    expect(result.items).toHaveLength(1)
  })

  test('highlight color column drives the inline box-shadow style (no visual on its own)', () => {
    const data = {
      start_col: ['2026-05-01'],
      end_col: ['2026-05-08'],
      group_col: ['Alice'],
      label_col: ['T'],
      id_col: ['r1'],
      color_col: ['#22c55e'],
    }
    const result = buildItemsAndGroups(
      { ...baseConfig, highlightColorColumn: 'color_col' },
      data,
    )
    expect(result.items[0].style).toBe('box-shadow: inset 6px 0 0 #22c55e;')
    // The bar lives in the item style, not the visuals map — a row with only a
    // highlight color has nothing to render inside the item.
    expect(result.visuals.has('r1|Alice')).toBe(false)
  })

  test('blank highlight color leaves the item un-styled with no visual', () => {
    const data = {
      start_col: ['2026-05-01'],
      end_col: ['2026-05-08'],
      group_col: ['Alice'],
      label_col: ['T'],
      id_col: ['r1'],
      color_col: ['   '],
    }
    const result = buildItemsAndGroups(
      { ...baseConfig, highlightColorColumn: 'color_col' },
      data,
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
    )
    expect(result.visuals.get('r1|Alice')).toEqual({ pill: 'P1' })
    expect(result.items[0].style).toBeUndefined()
  })

  test('pill color column rides into visuals alongside the pill text', () => {
    const data = {
      start_col: ['2026-05-01'],
      end_col: ['2026-05-08'],
      group_col: ['Alice'],
      label_col: ['T'],
      id_col: ['r1'],
      pill_col: ['HIGH'],
      pillcolor_col: ['#ef4444'],
    }
    const result = buildItemsAndGroups(
      {
        ...baseConfig,
        pillLabelColumn: 'pill_col',
        pillColorColumn: 'pillcolor_col',
      },
      data,
    )
    expect(result.visuals.get('r1|Alice')).toEqual({
      pill: 'HIGH',
      pillColor: '#ef4444',
    })
    expect(result.items[0].style).toBeUndefined()
  })

  test('highlight and pill colors are independent — both can appear on one item', () => {
    const data = {
      start_col: ['2026-05-01'],
      end_col: ['2026-05-08'],
      group_col: ['Alice'],
      label_col: ['T'],
      id_col: ['r1'],
      color_col: ['#22c55e'],
      pill_col: ['HIGH'],
      pillcolor_col: ['#ef4444'],
    }
    const result = buildItemsAndGroups(
      {
        ...baseConfig,
        highlightColorColumn: 'color_col',
        pillLabelColumn: 'pill_col',
        pillColorColumn: 'pillcolor_col',
      },
      data,
    )
    expect(result.items[0].style).toBe('box-shadow: inset 6px 0 0 #22c55e;')
    expect(result.visuals.get('r1|Alice')).toEqual({
      pill: 'HIGH',
      pillColor: '#ef4444',
    })
  })

  test('row ids fall back to row index when idColumn is not configured', () => {
    const config = {
      startDate: 'start_col',
      endDate: 'end_col',
      group: 'group_col',
    }
    const data = {
      start_col: ['2026-05-01'],
      end_col: ['2026-05-08'],
      group_col: ['Alice'],
    }
    const result = buildItemsAndGroups(config, data)
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
    const result = buildItemsAndGroups(baseConfig, data)
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
        startDate: 'start_col',
        endDate: 'end_col',
        label: 'label_col',
        idColumn: 'id_col',
      },
      data,
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
    const result = buildItemsAndGroups({ ...baseConfig, group: [] }, data)
    expect(result.groups).toEqual([])
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).not.toHaveProperty('group')
  })

  test('ungrouped items still carry the highlight bar style', () => {
    const data = {
      start_col: ['2026-05-01'],
      end_col: ['2026-05-08'],
      label_col: ['T'],
      id_col: ['r1'],
      color_col: ['#22c55e'],
    }
    const result = buildItemsAndGroups(
      {
        startDate: 'start_col',
        endDate: 'end_col',
        label: 'label_col',
        idColumn: 'id_col',
        highlightColorColumn: 'color_col',
      },
      data,
    )
    expect(result.items[0].style).toBe('box-shadow: inset 6px 0 0 #22c55e;')
    expect(result.visuals.has('r1')).toBe(false)
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

describe('parseGroupId', () => {
  test('splits a pipe-joined group id into ordered segments', () => {
    expect(parseGroupId('NA|Team Alpha|Alice')).toEqual([
      'NA',
      'Team Alpha',
      'Alice',
    ])
  })

  test('a single segment with no pipe is one value', () => {
    expect(parseGroupId('Alice')).toEqual(['Alice'])
  })

  test('unescapes \\| inside a segment (does not split on it)', () => {
    expect(parseGroupId('a\\|b|c')).toEqual(['a|b', 'c'])
  })

  test('round-trips with pathToGroupId for a full path', () => {
    const path = ['NA', 'Team|X', 'Alice']
    const id = pathToGroupId(path, path.length - 1)
    expect(parseGroupId(id)).toEqual(path)
  })
})

describe('applyLaneMove', () => {
  test('single column, single value → swaps to the new lane', () => {
    expect(applyLaneMove([['Alice']], ['Alice'], ['Carol'])).toEqual([
      ['Carol'],
    ])
  })

  test('single column, multi-value → swaps the dragged value, preserves the rest', () => {
    expect(applyLaneMove([['Alice', 'Bob']], ['Alice'], ['Carol'])).toEqual([
      ['Carol', 'Bob'],
    ])
  })

  test('unchanged column (old === new) is returned as-is', () => {
    expect(applyLaneMove([['Alice', 'Bob']], ['Alice'], ['Alice'])).toEqual([
      ['Alice', 'Bob'],
    ])
  })

  test('dropping onto a lane the row already occupies dedupes (merge)', () => {
    expect(applyLaneMove([['Alice', 'Bob']], ['Alice'], ['Bob'])).toEqual([
      ['Bob'],
    ])
  })

  test('multi-level: each column swaps independently, preserving other lanes', () => {
    // Team [Alpha, Beta] × Person [Alice]; drag Alpha|Alice → Gamma|Alice.
    expect(
      applyLaneMove(
        [
          ['Alpha', 'Beta'],
          ['Alice'],
        ],
        ['Alpha', 'Alice'],
        ['Gamma', 'Alice'],
      ),
    ).toEqual([
      ['Gamma', 'Beta'],
      ['Alice'],
    ])
  })

  test('a level missing from the dropped path leaves that column unchanged', () => {
    // Dropped on a parent lane → only the parent level is in newPath.
    expect(
      applyLaneMove(
        [
          ['Alpha'],
          ['Alice', 'Bob'],
        ],
        ['Alpha', 'Alice'],
        ['Beta'],
      ),
    ).toEqual([
      ['Beta'],
      ['Alice', 'Bob'],
    ])
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
    startDate: 'start_col',
    endDate: 'end_col',
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
    const result = buildItemsAndGroups(config, data)

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
    const result = buildItemsAndGroups(config, data)
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
    const result = buildItemsAndGroups(config, data)
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
    const result = buildItemsAndGroups(config, data)
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
        startDate: 'start_col',
        endDate: 'end_col',
        group: ['region_col', 'team_col', 'person_col'],
        label: 'label_col',
        idColumn: 'id_col',
      },
      data,
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
    const result = buildItemsAndGroups(config, data)
    expect(result.items.map((i) => i.id).sort()).toEqual([
      'r1|Alpha|Alice',
      'r2|Beta|Alice',
    ])
  })
})
