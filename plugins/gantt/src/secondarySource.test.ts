import { describe, expect, test } from 'vitest'
import { buildItemsAndGroups } from './buildItems'
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
