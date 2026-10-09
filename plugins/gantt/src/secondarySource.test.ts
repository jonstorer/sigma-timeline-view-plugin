import { describe, expect, test } from 'vitest'
import type { DataItem } from 'vis-timeline/esnext'
import { buildItemsAndGroups } from './buildItems'
import { colorForKey } from './colorHash'
import { mergeSecondarySource } from './secondarySource'
import type { TimelineConfig } from './types'

const primaryConfig: TimelineConfig = {
  source: 'a',
  startDate: 'start',
  endDate: 'end',
  group: 'who',
  idColumn: 'id',
}

const primaryData = {
  start: ['2026-01-01'],
  end: ['2026-01-05'],
  who: ['Dinkar'],
  id: ['r1'],
}

describe('mergeSecondarySource', () => {
  test('no sourceB configured: passes the primary items/groups/visuals through unchanged', () => {
    const primary = buildItemsAndGroups(primaryConfig, primaryData)
    const merged = mergeSecondarySource(primary, primaryConfig, undefined)
    expect(merged.items).toBe(primary.items)
    expect(merged.groups).toBe(primary.groups)
    expect(merged.visuals).toBe(primary.visuals)
  })

  test("source B's items keep their exact start/end instant, unlike the primary source's day-bound items", () => {
    const primary = buildItemsAndGroups(primaryConfig, primaryData)
    const config: TimelineConfig = {
      ...primaryConfig,
      sourceB: 'b',
      startDateB: 'start',
      endDateB: 'end',
      groupB: 'who',
    }
    const dataB = {
      start: ['2026-01-10T16:30:00Z'],
      end: ['2026-01-10T22:00:00Z'],
      who: ['Dinkar'],
    }
    const merged = mergeSecondarySource(primary, config, dataB)
    const bItem = merged.items.find((i) => String(i.id).startsWith('b|'))
    expect(bItem?.start).toEqual(new Date(Date.UTC(2026, 0, 10, 16, 30, 0)))
    expect(bItem?.end).toEqual(new Date(Date.UTC(2026, 0, 10, 22, 0, 0)))
  })

  test('a shared group value merges onto the same row', () => {
    const primary = buildItemsAndGroups(primaryConfig, primaryData)
    const config: TimelineConfig = {
      ...primaryConfig,
      sourceB: 'b',
      startDateB: 'start',
      endDateB: 'end',
      groupB: 'who',
    }
    const dataB = {
      start: ['2026-01-10'],
      end: ['2026-01-12'],
      who: ['Dinkar'],
    }
    const merged = mergeSecondarySource(primary, config, dataB)
    // One merged group ("Dinkar"), not two.
    expect(merged.groups).toHaveLength(1)
    expect(merged.groups[0].id).toBe('Dinkar')
    // Both the primary item and the source-B item attach to that same group.
    expect(merged.items).toHaveLength(2)
    expect(merged.items.every((i) => i.group === 'Dinkar')).toBe(true)
  })

  test('source B items are prefixed, forced non-editable, and tagged', () => {
    const primary = buildItemsAndGroups(primaryConfig, primaryData)
    const config: TimelineConfig = {
      ...primaryConfig,
      sourceB: 'b',
      startDateB: 'start',
      endDateB: 'end',
      groupB: 'who',
    }
    const dataB = {
      start: ['2026-01-10'],
      end: ['2026-01-12'],
      who: ['Dinkar'],
    }
    const merged = mergeSecondarySource(primary, config, dataB)
    const bItem = merged.items.find((i) => String(i.id).startsWith('b|'))
    expect(bItem).toMatchObject({ editable: false, className: 'ts-source-b' })
    // The primary item's id/editability is untouched.
    const aItem = merged.items.find((i) => !String(i.id).startsWith('b|'))
    expect(aItem?.editable).toBeUndefined()
  })

  test('source B items carry their link/description visuals, reachable under the prefixed item id', () => {
    const primary = buildItemsAndGroups(primaryConfig, primaryData)
    const config: TimelineConfig = {
      ...primaryConfig,
      sourceB: 'b',
      startDateB: 'start',
      endDateB: 'end',
      groupB: 'who',
      linkColumnB: 'link',
      descriptionColumnB: 'desc',
    }
    const dataB = {
      start: ['2026-01-10'],
      end: ['2026-01-12'],
      who: ['Dinkar'],
      link: ['https://example.com/schedule'],
      desc: ['On-call for Metadata Services'],
    }
    const merged = mergeSecondarySource(primary, config, dataB)
    const bItem = merged.items.find((i) => String(i.id).startsWith('b|'))
    expect(bItem).toBeDefined()
    expect(merged.visuals.get(String(bItem!.id))).toMatchObject({
      linkUrl: 'https://example.com/schedule',
      description: 'On-call for Metadata Services',
    })
  })

  test("source B's visuals don't clobber the primary source's visuals for the same key", () => {
    const config: TimelineConfig = {
      ...primaryConfig,
      descriptionColumn: 'descA',
      sourceB: 'b',
      startDateB: 'start',
      endDateB: 'end',
      groupB: 'who',
      descriptionColumnB: 'descB',
    }
    const dataA = { ...primaryData, descA: ['Primary description'] }
    const primary = buildItemsAndGroups(config, dataA)
    const dataB = {
      start: ['2026-01-10'],
      end: ['2026-01-12'],
      who: ['Dinkar'],
      descB: ['Secondary description'],
    }
    const merged = mergeSecondarySource(primary, config, dataB)
    const aItem = merged.items.find((i) => !String(i.id).startsWith('b|'))
    expect(merged.visuals.get(String(aItem!.id))?.description).toBe(
      'Primary description',
    )
  })

  test('primary items get the work subgroup and source B items get the oncall subgroup', () => {
    const primary = buildItemsAndGroups(primaryConfig, primaryData)
    const config: TimelineConfig = {
      ...primaryConfig,
      sourceB: 'b',
      startDateB: 'start',
      endDateB: 'end',
      groupB: 'who',
    }
    const dataB = {
      start: ['2026-01-10'],
      end: ['2026-01-12'],
      who: ['Dinkar'],
    }
    const merged = mergeSecondarySource(primary, config, dataB)
    const bItem = merged.items.find((i) => String(i.id).startsWith('b|'))
    const aItem = merged.items.find((i) => !String(i.id).startsWith('b|'))
    expect(bItem?.subgroup).toBe('oncall')
    expect(aItem?.subgroup).toBe('work')
  })

  test('every merged group gets a subgroupOrder that sorts oncall before work', () => {
    const primary = buildItemsAndGroups(primaryConfig, primaryData)
    const config: TimelineConfig = {
      ...primaryConfig,
      sourceB: 'b',
      startDateB: 'start',
      endDateB: 'end',
      groupB: 'who',
    }
    const dataB = {
      start: ['2026-01-10'],
      end: ['2026-01-12'],
      who: ['Dinkar'],
    }
    const merged = mergeSecondarySource(primary, config, dataB)
    // vis-timeline calls subgroupOrder with each subgroup's first raw item
    // object (not the subgroup name as a bare string) — exercise it the same
    // way, since that mismatch is exactly what made the real bug invisible
    // to a test that passed plain strings instead.
    const oncallItem = { subgroup: 'oncall' } as DataItem
    const workItem = { subgroup: 'work' } as DataItem
    for (const group of merged.groups) {
      expect(typeof group.subgroupOrder).toBe('function')
      const order = group.subgroupOrder as (a: DataItem, b: DataItem) => number
      expect(order(oncallItem, workItem)).toBeLessThan(0)
      expect(order(workItem, oncallItem)).toBeGreaterThan(0)
      expect(order(workItem, workItem)).toBe(0)
    }
  })

  test('every merged group lists both subgroups as stacking, not just oncall', () => {
    // Regression test: vis-timeline treats an object subgroupStack as a
    // per-subgroup whitelist — a subgroup left out defaults to NO stacking
    // (direct overlay), not the top-level `stack: true` default. Listing
    // only oncall previously made work items silently stop stacking among
    // themselves and overlay directly on top of each other.
    const primary = buildItemsAndGroups(primaryConfig, primaryData)
    const config: TimelineConfig = {
      ...primaryConfig,
      sourceB: 'b',
      startDateB: 'start',
      endDateB: 'end',
      groupB: 'who',
    }
    const dataB = {
      start: ['2026-01-10'],
      end: ['2026-01-12'],
      who: ['Dinkar'],
    }
    const merged = mergeSecondarySource(primary, config, dataB)
    for (const group of merged.groups) {
      expect(group.subgroupStack).toEqual({ oncall: true, work: true })
    }
  })

  test("without highlightColorColumnB, source B's items get a hashed default color keyed by label", () => {
    const primary = buildItemsAndGroups(primaryConfig, primaryData)
    const config: TimelineConfig = {
      ...primaryConfig,
      sourceB: 'b',
      startDateB: 'start',
      endDateB: 'end',
      groupB: 'who',
      labelB: 'who',
    }
    const dataB = {
      start: ['2026-01-10'],
      end: ['2026-01-12'],
      who: ['Dinkar'],
    }
    const merged = mergeSecondarySource(primary, config, dataB)
    const bItem = merged.items.find((i) => String(i.id).startsWith('b|'))
    const expected = colorForKey('Dinkar')
    expect(bItem?.style).toContain(`--item-color: ${expected.background};`)
    expect(bItem?.style).toContain(`--item-text-color: ${expected.text};`)
  })

  test('two people sharing one group (e.g. grouped by team, not person) still get different colors', () => {
    const primary = buildItemsAndGroups(primaryConfig, primaryData)
    const config: TimelineConfig = {
      ...primaryConfig,
      sourceB: 'b',
      startDateB: 'start',
      endDateB: 'end',
      groupB: 'team',
      labelB: 'who',
    }
    const dataB = {
      start: ['2026-01-10', '2026-01-13'],
      end: ['2026-01-12', '2026-01-15'],
      team: ['Team A', 'Team A'],
      who: ['Dinkar', 'Ray Chen'],
    }
    const merged = mergeSecondarySource(primary, config, dataB)
    const bItems = merged.items.filter((i) => String(i.id).startsWith('b|'))
    expect(bItems).toHaveLength(2)
    expect(bItems[0].style).toContain(
      `--item-color: ${colorForKey('Dinkar').background};`,
    )
    expect(bItems[1].style).toContain(
      `--item-color: ${colorForKey('Ray Chen').background};`,
    )
  })

  test('an explicit highlightColorColumnB value wins over the hashed default', () => {
    const primary = buildItemsAndGroups(primaryConfig, primaryData)
    const config: TimelineConfig = {
      ...primaryConfig,
      sourceB: 'b',
      startDateB: 'start',
      endDateB: 'end',
      groupB: 'who',
      highlightColorColumnB: 'color',
    }
    const dataB = {
      start: ['2026-01-10'],
      end: ['2026-01-12'],
      who: ['Dinkar'],
      color: ['#123456'],
    }
    const merged = mergeSecondarySource(primary, config, dataB)
    const bItem = merged.items.find((i) => String(i.id).startsWith('b|'))
    expect(bItem?.style).toContain('--item-color: #123456;')
    expect(bItem?.style).not.toContain('--item-text-color:')
  })

  test('a source-B-only group (no matching primary row) is added as its own row', () => {
    const primary = buildItemsAndGroups(primaryConfig, primaryData)
    const config: TimelineConfig = {
      ...primaryConfig,
      sourceB: 'b',
      startDateB: 'start',
      endDateB: 'end',
      groupB: 'who',
    }
    const dataB = {
      start: ['2026-01-10'],
      end: ['2026-01-12'],
      who: ['Someone Else'],
    }
    const merged = mergeSecondarySource(primary, config, dataB)
    expect(merged.groups.map((g) => g.id).sort()).toEqual([
      'Dinkar',
      'Someone Else',
    ])
  })
})
