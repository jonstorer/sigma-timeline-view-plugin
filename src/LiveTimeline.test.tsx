import { describe, expect, test, vi } from 'vitest'
import { render } from '@testing-library/react'

// Mock vis-timeline's Timeline constructor so we don't drive heavy DOM work
// in jsdom. We just need the LiveTimeline component to render and the empty-
// state branches to show the right header copy.
vi.mock('vis-timeline/esnext', async () => {
  const actual =
    await vi.importActual<typeof import('vis-timeline/esnext')>(
      'vis-timeline/esnext',
    )
  return {
    ...actual,
    Timeline: vi.fn().mockImplementation(() => ({
      destroy: vi.fn(),
    })),
  }
})

import { LiveTimeline } from './LiveTimeline'
import { SOURCE } from './editorPanel'

describe('LiveTimeline', () => {
  test('prompts for a data source when none configured', () => {
    const { getByText } = render(
      <LiveTimeline config={null} data={undefined} legendData={undefined} />,
    )
    expect(getByText(/Pick a data source/i)).toBeInTheDocument()
  })

  test('prompts for required columns when source is set but cols are not', () => {
    const { getByText } = render(
      <LiveTimeline
        config={{ [SOURCE]: 'element-1' }}
        data={undefined}
        legendData={undefined}
      />,
    )
    expect(
      getByText(/Pick Start, End, and Group columns/i),
    ).toBeInTheDocument()
  })

  test('reports item and lane counts when fully configured', () => {
    const config = {
      [SOURCE]: 'element-1',
      start: 'start_col',
      end: 'end_col',
      group: 'group_col',
      label: 'label_col',
      idColumn: 'id_col',
    }
    const data = {
      start_col: ['2026-05-01', '2026-05-01', '2026-05-15'],
      end_col: ['2026-05-08', '2026-05-08', '2026-05-22'],
      group_col: ['Alice', 'Bob', 'Alice'],
      label_col: ['T1', 'T2', 'T3'],
      id_col: ['r1', 'r2', 'r3'],
    }
    const { getByText } = render(
      <LiveTimeline config={config} data={data} legendData={undefined} />,
    )
    expect(getByText(/3 items across 2 lanes/i)).toBeInTheDocument()
  })

  test('uses singular wording for one item / one lane', () => {
    const config = {
      [SOURCE]: 'element-1',
      start: 'start_col',
      end: 'end_col',
      group: 'group_col',
      label: 'label_col',
      idColumn: 'id_col',
    }
    const data = {
      start_col: ['2026-05-01'],
      end_col: ['2026-05-08'],
      group_col: ['Alice'],
      label_col: ['T'],
      id_col: ['r1'],
    }
    const { getByText } = render(
      <LiveTimeline config={config} data={data} legendData={undefined} />,
    )
    expect(getByText(/1 item across 1 lane\./i)).toBeInTheDocument()
  })
})
