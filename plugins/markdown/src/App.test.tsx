import { describe, expect, test, vi } from 'vitest'
import { render } from '@testing-library/react'
import { useConfig, useEditorPanelConfig } from '@sigmacomputing/plugin'

vi.mock('@sigmacomputing/plugin', () => ({
  useEditorPanelConfig: vi.fn(),
  useConfig: vi.fn(() => ({})),
  useElementData: vi.fn(() => ({})),
}))

// Imports below the vi.mock calls resolve to the mocks.
import App from './App'
import { editorPanelConfig } from './editorPanel'
import { useElementData } from '@sigmacomputing/plugin'

describe('App', () => {
  test('registers the editor panel config on mount', () => {
    render(<App />)
    expect(vi.mocked(useEditorPanelConfig)).toHaveBeenCalledWith(
      editorPanelConfig,
    )
  })

  test('prompts for a data source when none configured', () => {
    vi.mocked(useConfig).mockReturnValue({})
    const { getByText } = render(<App />)
    expect(getByText(/Pick a data source/i)).toBeInTheDocument()
  })

  test('prompts for a markdown column when source is set but column is not', () => {
    vi.mocked(useConfig).mockReturnValue({ source: 'element-1' })
    const { getByText } = render(<App />)
    expect(getByText(/Pick a Markdown column/i)).toBeInTheDocument()
  })

  test('renders the markdown column\'s value as HTML', () => {
    vi.mocked(useConfig).mockReturnValue({
      source: 'element-1',
      markdownColumn: 'md_col',
    })
    vi.mocked(useElementData).mockReturnValue({ md_col: ['**bold**'] })
    const { container } = render(<App />)
    expect(container.querySelector('strong')?.textContent).toBe('bold')
  })

  test('reads the element id from the resolved config value, not the literal "source" key', () => {
    vi.mocked(useConfig).mockReturnValue({
      source: 'element-xyz',
      markdownColumn: 'md_col',
    })
    render(<App />)
    expect(vi.mocked(useElementData)).toHaveBeenCalledWith('element-xyz')
    expect(vi.mocked(useElementData)).not.toHaveBeenCalledWith('source')
  })
})
