import { afterEach, describe, expect, test, vi } from 'vitest'
import { render } from '@testing-library/react'
import {
  useActionTrigger,
  useConfig,
  useEditorPanelConfig,
  useVariable,
} from '@sigmacomputing/plugin'

vi.mock('@sigmacomputing/plugin', () => ({
  useEditorPanelConfig: vi.fn(),
  useConfig: vi.fn(() => ({})),
  useElementData: vi.fn(() => ({})),
  useVariable: vi.fn(() => [undefined, vi.fn()]),
  useActionTrigger: vi.fn(() => vi.fn()),
}))

vi.mock('./LiveTimeline', () => ({
  LiveTimeline: ({
    config,
  }: {
    config: unknown
    data: unknown
    legendData: unknown
  }) => (
    <div data-testid="live-timeline-stub">{JSON.stringify(config ?? {})}</div>
  ),
}))

// Imports below the vi.mock calls resolve to the mocks.
import App from './App'
import { editorPanelConfig } from './editorPanel'

describe('App', () => {
  test('registers the editor panel config on mount', () => {
    render(<App />)
    expect(vi.mocked(useEditorPanelConfig)).toHaveBeenCalledWith(
      editorPanelConfig,
    )
  })

  test('renders the LiveTimeline child', () => {
    const { getByTestId } = render(<App />)
    expect(getByTestId('live-timeline-stub')).toBeInTheDocument()
  })
})

describe('App edit-slot wiring', () => {
  afterEach(() => {
    vi.mocked(useConfig).mockReturnValue({})
  })

  test('passes the resolved control id and action id (config values), not the literal config keys, to the SDK hooks', () => {
    vi.mocked(useVariable).mockClear()
    vi.mocked(useActionTrigger).mockClear()
    vi.mocked(useConfig).mockReturnValue({
      idColumn: 'row_id',
      editPayloadVariable: 'Payload',
      editAction: 'action-abc-123',
    })

    render(<App />)

    expect(vi.mocked(useVariable)).toHaveBeenCalledWith('Payload')
    expect(vi.mocked(useVariable)).not.toHaveBeenCalledWith('editPayloadVariable')
    expect(vi.mocked(useActionTrigger)).toHaveBeenCalledWith('action-abc-123')
    expect(vi.mocked(useActionTrigger)).not.toHaveBeenCalledWith('editAction')
  })

  test('wires the record id variable and select action to the SDK hooks by their resolved ids', () => {
    vi.mocked(useVariable).mockClear()
    vi.mocked(useActionTrigger).mockClear()
    vi.mocked(useConfig).mockReturnValue({
      recordIdVariable: 'RecordId',
      selectAction: 'select-action-9',
    })

    render(<App />)

    expect(vi.mocked(useVariable)).toHaveBeenCalledWith('RecordId')
    expect(vi.mocked(useActionTrigger)).toHaveBeenCalledWith('select-action-9')
    expect(vi.mocked(useActionTrigger)).not.toHaveBeenCalledWith('selectAction')
  })
})
