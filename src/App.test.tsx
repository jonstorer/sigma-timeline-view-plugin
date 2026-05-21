import { describe, expect, test, vi } from 'vitest'
import { render } from '@testing-library/react'
import { useEditorPanelConfig } from '@sigmacomputing/plugin'

vi.mock('@sigmacomputing/plugin', () => ({
  useEditorPanelConfig: vi.fn(),
  useConfig: vi.fn(() => ({})),
  useElementData: vi.fn(() => ({})),
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
