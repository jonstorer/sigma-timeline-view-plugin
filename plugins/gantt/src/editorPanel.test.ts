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
