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

  test('prompts for a data source, and shows the example layout, when none configured', () => {
    vi.mocked(useConfig).mockReturnValue({})
    const { getByText, container } = render(<App />)
    expect(getByText(/Pick a data source/i)).toBeInTheDocument()
    expect(container.querySelector('.md-row-example')).toBeInTheDocument()
  })

  test('prompts for a Body column, and still shows the example layout, when source is set but column is not', () => {
    vi.mocked(useConfig).mockReturnValue({ source: 'element-1' })
    const { getByText, container } = render(<App />)
    expect(getByText(/Pick a Body column/i)).toBeInTheDocument()
    expect(container.querySelector('.md-row-example')).toBeInTheDocument()
  })

  test('renders the body markdown plus all four corners for each row', () => {
    vi.mocked(useConfig).mockReturnValue({
      source: 'element-1',
      bodyColumn: 'body',
      topLeftColumn: 'tl',
      topRightColumn: 'tr',
      bottomLeftColumn: 'bl',
      bottomRightColumn: 'br',
    })
    vi.mocked(useElementData).mockReturnValue({
      body: ['**bold**'],
      tl: ['Author: Jon'],
      tr: ['v1.2'],
      bl: ['Draft'],
      br: ['2026-10-06'],
    })
    const { container, getByText } = render(<App />)
    expect(container.querySelector('strong')?.textContent).toBe('bold')
    expect(getByText('Author: Jon')).toBeInTheDocument()
    expect(getByText('v1.2')).toBeInTheDocument()
    expect(getByText('Draft')).toBeInTheDocument()
    expect(getByText('2026-10-06')).toBeInTheDocument()
  })

  test('corners are optional — omitting them renders only the body, no example layout', () => {
    vi.mocked(useConfig).mockReturnValue({
      source: 'element-1',
      bodyColumn: 'body',
    })
    vi.mocked(useElementData).mockReturnValue({ body: ['plain text'] })
    const { container, getByText } = render(<App />)
    expect(container.querySelectorAll('.md-corner')).toHaveLength(0)
    expect(container.querySelector('.md-row-example')).not.toBeInTheDocument()
    expect(getByText('plain text')).toBeInTheDocument()
  })

  test('skips rows with an empty or missing body', () => {
    vi.mocked(useConfig).mockReturnValue({
      source: 'element-1',
      bodyColumn: 'body',
    })
    vi.mocked(useElementData).mockReturnValue({
      body: ['first', null, 'third'],
    })
    const { container } = render(<App />)
    expect(container.querySelectorAll('.md-row')).toHaveLength(2)
  })

  test('reads the element id from the resolved config value, not the literal "source" key', () => {
    vi.mocked(useConfig).mockReturnValue({
      source: 'element-xyz',
      bodyColumn: 'body',
    })
    render(<App />)
    expect(vi.mocked(useElementData)).toHaveBeenCalledWith('element-xyz')
    expect(vi.mocked(useElementData)).not.toHaveBeenCalledWith('source')
  })
})
