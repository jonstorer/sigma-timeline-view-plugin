import { describe, expect, test } from 'vitest'
import type { DataGroup, DataItem } from 'vis-timeline/esnext'
import { pruneEmptyGroups } from './visibility'

function item(id: string, group: string): DataItem {
  return { id, group, content: '', start: new Date() }
}

describe('pruneEmptyGroups', () => {
  test('a flat group with a visible item survives', () => {
    const groups: DataGroup[] = [{ id: 'Alice', content: 'Alice' }]
    const items = [item('i1', 'Alice')]
    expect(pruneEmptyGroups(groups, items)).toHaveLength(1)
  })

  test('a flat group with no visible items is dropped', () => {
    const groups: DataGroup[] = [
      { id: 'Alice', content: 'Alice' },
      { id: 'Bob', content: 'Bob' },
    ]
    const items = [item('i1', 'Alice')]
    const result = pruneEmptyGroups(groups, items)
    expect(result.map((g) => g.id)).toEqual(['Alice'])
  })

  test('a parent group survives if any descendant still has items', () => {
    const groups: DataGroup[] = [
      { id: 'Team', content: 'Team', nestedGroups: ['Team|Alice', 'Team|Bob'] },
      { id: 'Team|Alice', content: 'Alice' },
      { id: 'Team|Bob', content: 'Bob' },
    ]
    const items = [item('i1', 'Team|Alice')]
    const result = pruneEmptyGroups(groups, items)
    expect(result.map((g) => g.id).sort()).toEqual(['Team', 'Team|Alice'])
    // The surviving parent's nestedGroups is pruned to just the surviving child.
    const team = result.find((g) => g.id === 'Team')
    expect(team?.nestedGroups).toEqual(['Team|Alice'])
  })

  test('a parent group is dropped once every child is empty', () => {
    const groups: DataGroup[] = [
      { id: 'Team', content: 'Team', nestedGroups: ['Team|Alice', 'Team|Bob'] },
      { id: 'Team|Alice', content: 'Alice' },
      { id: 'Team|Bob', content: 'Bob' },
    ]
    const result = pruneEmptyGroups(groups, [])
    expect(result).toEqual([])
  })

  test('no items at all drops every group', () => {
    const groups: DataGroup[] = [{ id: 'Alice', content: 'Alice' }]
    expect(pruneEmptyGroups(groups, [])).toEqual([])
  })

  test('no groups at all returns an empty array regardless of items', () => {
    expect(pruneEmptyGroups([], [item('i1', 'Alice')])).toEqual([])
  })
})
