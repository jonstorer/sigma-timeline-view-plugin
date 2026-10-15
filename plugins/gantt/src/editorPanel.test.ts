import { describe, expect, test } from 'vitest'
import { editorPanelConfig, SOURCE } from './editorPanel'

describe('editorPanelConfig', () => {
  test('exposes a non-empty array', () => {
    expect(Array.isArray(editorPanelConfig)).toBe(true)
    expect(editorPanelConfig.length).toBeGreaterThan(0)
  })

  test('every entry has a name and type', () => {
    for (const entry of editorPanelConfig) {
      expect(typeof entry.name).toBe('string')
      expect(typeof entry.type).toBe('string')
    }
  })

  test('all entry names are unique', () => {
    const names = editorPanelConfig.map((e) => e.name)
    expect(new Set(names).size).toBe(names.length)
  })

  test('required data slots are present', () => {
    const names = editorPanelConfig.map((e) => e.name)
    for (const required of [
      SOURCE,
      'startDate',
      'endDate',
      'group',
      'label',
      'idColumn',
    ]) {
      expect(names).toContain(required)
    }
  })

  test('column slots have a `source` referencing a known element', () => {
    const elementNames = new Set(
      editorPanelConfig
        .filter((e) => e.type === 'element')
        .map((e) => e.name),
    )
    expect(elementNames.has(SOURCE)).toBe(true)

    for (const entry of editorPanelConfig) {
      if (entry.type === 'column') {
        expect(elementNames.has(entry.source)).toBe(true)
      }
    }
  })

  test('highlight and pill color columns source from the main SOURCE', () => {
    const byName = Object.fromEntries(editorPanelConfig.map((e) => [e.name, e]))
    expect(byName.highlightColorColumn).toMatchObject({ source: SOURCE })
    expect(byName.pillColorColumn).toMatchObject({ source: SOURCE })
  })

  test('progress column sources from SOURCE and accepts numeric columns', () => {
    const byName = Object.fromEntries(editorPanelConfig.map((e) => [e.name, e]))
    expect(byName.progressColumn).toMatchObject({
      source: SOURCE,
      allowedTypes: ['number', 'integer'],
    })
  })

  test('link column sources from SOURCE', () => {
    const byName = Object.fromEntries(editorPanelConfig.map((e) => [e.name, e]))
    expect(byName.linkColumn).toMatchObject({ source: SOURCE })
  })

  test('actual-dates columns source from SOURCE and accept datetime columns', () => {
    const byName = Object.fromEntries(editorPanelConfig.map((e) => [e.name, e]))
    expect(byName.actualStartColumn).toMatchObject({
      type: 'column',
      source: SOURCE,
      allowedTypes: ['datetime'],
    })
    expect(byName.projectedActualEndColumn).toMatchObject({
      type: 'column',
      source: SOURCE,
      allowedTypes: ['datetime'],
    })
  })

  // Sigma's `type: 'group'` can only contain `type: 'text'` children (via
  // the child's `source` pointing at the group's `name`) — this panel used
  // to have three group headings trying to section off `column`/`variable`/
  // `action-trigger` fields, which rendered as permanently empty in a live
  // workbook since there's no API-level way to nest those types under a
  // group at all. Encoding the actual constraint here (rather than just a
  // comment) so a future group addition can't silently reintroduce an empty
  // section the same way.
  test('every group only has type:text children sourced from it (Sigma cannot nest other types in a group)', () => {
    const groupNames = editorPanelConfig
      .filter((e) => e.type === 'group')
      .map((e) => e.name)
    expect(groupNames.length).toBeGreaterThan(0)
    for (const groupName of groupNames) {
      const children = editorPanelConfig.filter(
        (e) => 'source' in e && e.source === groupName,
      )
      expect(children.length).toBeGreaterThan(0)
      for (const child of children) {
        expect(child.type).toBe('text')
      }
    }
    // No column/variable/action-trigger field should ever point its `source`
    // at a group name — that's the exact, now-fixed mistake (a `source`
    // meant for an `element` name was instead pointing at a group).
    const groupNameSet = new Set(groupNames)
    for (const entry of editorPanelConfig) {
      if (entry.type === 'column' && groupNameSet.has(entry.source)) {
        throw new Error(`${entry.name} sources from a group, not an element`)
      }
    }
  })

  test('planned and actual date columns are adjacent and clearly labeled, with no group header needed', () => {
    const names = editorPanelConfig.map((e) => e.name)
    const byName = Object.fromEntries(editorPanelConfig.map((e) => [e.name, e]))
    const indexOf = (name: string) => names.indexOf(name)

    // Order alone carries the grouping now (see the test above for why a
    // group heading can't): planned dates together, then actual dates.
    expect(indexOf('startDate')).toBeLessThan(indexOf('endDate'))
    expect(indexOf('endDate')).toBeLessThan(indexOf('projectedEndColumn'))
    expect(indexOf('projectedEndColumn')).toBeLessThan(indexOf('actualStartColumn'))
    expect(indexOf('actualStartColumn')).toBeLessThan(
      indexOf('projectedActualEndColumn'),
    )

    // Labels carry the "actual" distinction instead of a group heading.
    expect(byName.actualStartColumn).toMatchObject({
      label: expect.stringMatching(/actual/i),
    })
    expect(byName.projectedActualEndColumn).toMatchObject({
      label: expect.stringMatching(/actual/i),
    })
  })

  test('sourceAName/sourceBName are grouped together under menuLabelsGroup', () => {
    const byName = Object.fromEntries(editorPanelConfig.map((e) => [e.name, e]))
    expect(byName.sourceAName).toMatchObject({
      type: 'text',
      source: 'menuLabelsGroup',
    })
    expect(byName.sourceBName).toMatchObject({
      type: 'text',
      source: 'menuLabelsGroup',
    })
  })

  test('edit slots are present: text variable + action trigger', () => {
    const byName = Object.fromEntries(editorPanelConfig.map((e) => [e.name, e]))
    expect(byName.editPayloadVariable).toMatchObject({
      type: 'variable',
      allowedTypes: ['text'],
    })
    expect(byName.editAction).toMatchObject({ type: 'action-trigger' })
  })

  test('select slots are present: record id variable + action trigger (no column picker)', () => {
    const byName = Object.fromEntries(editorPanelConfig.map((e) => [e.name, e]))
    expect(byName.passthroughColumns).toBeUndefined()
    expect(byName.recordIdVariable).toMatchObject({ type: 'variable' })
    expect(byName.selectAction).toMatchObject({ type: 'action-trigger' })
  })
})
