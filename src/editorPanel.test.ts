import { describe, expect, test } from 'vitest'
import { editorPanelConfig, SOURCE, STATUS_LEGEND } from './editorPanel'

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
    expect(elementNames.has(STATUS_LEGEND)).toBe(true)

    for (const entry of editorPanelConfig) {
      if (entry.type === 'column') {
        expect(elementNames.has(entry.source)).toBe(true)
      }
    }
  })

  test('legend columns source from STATUS_LEGEND', () => {
    const byName = Object.fromEntries(editorPanelConfig.map((e) => [e.name, e]))
    expect(byName.statusLegendName).toMatchObject({ source: STATUS_LEGEND })
    expect(byName.statusLegendColor).toMatchObject({ source: STATUS_LEGEND })
  })

  test('statusColumn sources from main SOURCE (not legend)', () => {
    const byName = Object.fromEntries(editorPanelConfig.map((e) => [e.name, e]))
    expect(byName.statusColumn).toMatchObject({ source: SOURCE })
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
