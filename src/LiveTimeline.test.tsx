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
      setGroups: vi.fn(),
      setOptions: vi.fn(),
      on: vi.fn(),
    })),
  }
})

import { DataSet } from 'vis-data'
import { Timeline } from 'vis-timeline/esnext'
import { LiveTimeline } from './LiveTimeline'
import { snapToDay, formatDragTooltip } from './dragHelpers'
import { SOURCE } from './editorPanel'

type CapturedOptions = {
  editable: { updateTime: boolean }
  itemsAlwaysDraggable: { item: boolean; range: boolean }
  onMove: (
    item: { id: unknown; start: Date; end: Date | null },
    callback: (item: unknown) => void,
  ) => void
}

// LiveTimeline calls `new Timeline(container, items, groups, options)`, but
// vis-timeline's constructor type only declares 3 params, so the options live
// at index 3 of an untyped-length tuple — widen to unknown[] to read it.
const lastTimelineOptions = () =>
  (vi.mocked(Timeline).mock.calls.at(-1)! as unknown[])[3] as CapturedOptions

const lastTimelineInstance = () =>
  vi.mocked(Timeline).mock.results.at(-1)!.value as {
    setOptions: ReturnType<typeof vi.fn>
    setGroups: ReturnType<typeof vi.fn>
    on: ReturnType<typeof vi.fn>
  }

// Pull the callback LiveTimeline registered for a given Timeline event.
const lastEventHandler = (event: string) => {
  const call = lastTimelineInstance()
    .on.mock.calls.find((c) => c[0] === event)
  return call?.[1] as
    | ((props: { items?: unknown[]; item?: unknown }) => void)
    | undefined
}

const oneRowConfig = {
  [SOURCE]: 'element-1',
  startDate: 'start_col',
  endDate: 'end_col',
  label: 'label_col',
  idColumn: 'id_col',
}
const oneRowData = {
  start_col: ['2026-05-01'],
  end_col: ['2026-05-08'],
  label_col: ['T'],
  id_col: ['r1'],
}

describe('snapToDay', () => {
  // Built and compared in local time so the assertions are timezone-independent.
  test('snaps a morning time down to the start of that day', () => {
    const result = snapToDay(new Date(2026, 5, 16, 3, 0))
    expect(result.getTime()).toBe(new Date(2026, 5, 16, 0, 0, 0, 0).getTime())
  })

  test('snaps an evening time up to the next day', () => {
    const result = snapToDay(new Date(2026, 5, 16, 20, 0))
    expect(result.getTime()).toBe(new Date(2026, 5, 17, 0, 0, 0, 0).getTime())
  })

  test('leaves a value already at midnight unchanged', () => {
    const midnight = new Date(2026, 5, 16, 0, 0, 0, 0)
    expect(snapToDay(midnight).getTime()).toBe(midnight.getTime())
  })
})

describe('formatDragTooltip', () => {
  test('shows start → end for a range', () => {
    expect(
      formatDragTooltip({
        start: new Date(2026, 5, 16),
        end: new Date(2026, 6, 16),
      }),
    ).toBe('Jun 16, 2026 → Jul 16, 2026')
  })

  test('shows just the start when there is no end', () => {
    expect(formatDragTooltip({ start: new Date(2026, 5, 16) })).toBe(
      'Jun 16, 2026',
    )
  })
})

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
    expect(getByText(/Pick Start and End columns/i)).toBeInTheDocument()
  })

  test('reports just an item count when no group columns configured', () => {
    const config = {
      [SOURCE]: 'element-1',
      startDate: 'start_col',
      endDate: 'end_col',
      label: 'label_col',
      idColumn: 'id_col',
    }
    const data = {
      start_col: ['2026-05-01', '2026-05-08'],
      end_col: ['2026-05-08', '2026-05-15'],
      label_col: ['T1', 'T2'],
      id_col: ['r1', 'r2'],
    }
    const { getByText } = render(
      <LiveTimeline config={config} data={data} legendData={undefined} />,
    )
    expect(getByText(/^2 items\.$/)).toBeInTheDocument()
  })

  test('reports item and lane counts when fully configured', () => {
    const config = {
      [SOURCE]: 'element-1',
      startDate: 'start_col',
      endDate: 'end_col',
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
      startDate: 'start_col',
      endDate: 'end_col',
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

describe('LiveTimeline drag editing', () => {
  test('constructs read-only when no edit handler is provided', () => {
    render(
      <LiveTimeline
        config={oneRowConfig}
        data={oneRowData}
        legendData={undefined}
      />,
    )
    expect(lastTimelineOptions().editable.updateTime).toBe(false)
  })

  test('constructs draggable when an edit handler is provided at mount', () => {
    render(
      <LiveTimeline
        config={oneRowConfig}
        data={oneRowData}
        legendData={undefined}
        onItemEdit={vi.fn()}
      />,
    )
    expect(lastTimelineOptions().editable.updateTime).toBe(true)
  })

  test('makes items always draggable so the whole item moves on a body drag (not just edge resize)', () => {
    render(
      <LiveTimeline
        config={oneRowConfig}
        data={oneRowData}
        legendData={undefined}
        onItemEdit={vi.fn()}
      />,
    )
    expect(lastTimelineOptions().itemsAlwaysDraggable).toEqual({
      item: true,
      range: true,
    })
  })

  test('enables editing and re-issues items when the edit handler is wired after mount', () => {
    const { rerender } = render(
      <LiveTimeline
        config={oneRowConfig}
        data={oneRowData}
        legendData={undefined}
      />,
    )

    const instance = lastTimelineInstance()
    instance.setOptions.mockClear()
    const updateSpy = vi.spyOn(DataSet.prototype, 'update')

    rerender(
      <LiveTimeline
        config={oneRowConfig}
        data={oneRowData}
        legendData={undefined}
        onItemEdit={vi.fn()}
      />,
    )

    expect(instance.setOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        editable: expect.objectContaining({ updateTime: true }),
      }),
    )
    expect(updateSpy).toHaveBeenCalled()

    updateSpy.mockRestore()
  })

  test('onMove maps the dragged item to a payload and accepts the move', () => {
    const onItemEdit = vi.fn()
    render(
      <LiveTimeline
        config={oneRowConfig}
        data={oneRowData}
        legendData={undefined}
        onItemEdit={onItemEdit}
      />,
    )

    const callback = vi.fn()
    const moved = {
      id: 'r1',
      start: new Date('2026-05-02T00:00:00.000Z'),
      end: new Date('2026-05-09T00:00:00.000Z'),
    }
    lastTimelineOptions().onMove(moved, callback)

    expect(onItemEdit).toHaveBeenCalledWith({
      id: 'r1',
      startDate: '2026-05-02T00:00:00.000Z',
      endDate: '2026-05-09T00:00:00.000Z',
    })
    expect(callback).toHaveBeenCalledWith(moved)
  })

  test('onMove cancels the move when no edit handler is wired', () => {
    render(
      <LiveTimeline
        config={oneRowConfig}
        data={oneRowData}
        legendData={undefined}
      />,
    )

    const callback = vi.fn()
    lastTimelineOptions().onMove(
      { id: 'r1', start: new Date('2026-05-02'), end: new Date('2026-05-09') },
      callback,
    )

    expect(callback).toHaveBeenCalledWith(null)
  })

  test('switches the Timeline to ungrouped mode with setGroups(undefined) when no group columns', () => {
    render(
      <LiveTimeline
        config={oneRowConfig}
        data={oneRowData}
        legendData={undefined}
      />,
    )
    expect(lastTimelineInstance().setGroups).toHaveBeenCalledWith(undefined)
  })

  test('passes a groups DataSet to setGroups when group columns are configured', () => {
    render(
      <LiveTimeline
        config={{ ...oneRowConfig, group: 'group_col' }}
        data={{ ...oneRowData, group_col: ['Alice'] }}
        legendData={undefined}
      />,
    )
    expect(lastTimelineInstance().setGroups).toHaveBeenCalledWith(
      expect.any(DataSet),
    )
    expect(lastTimelineInstance().setGroups).not.toHaveBeenCalledWith(undefined)
  })
})

describe('LiveTimeline double-click select', () => {
  test('emits the double-clicked row id (from the id column)', () => {
    const onItemSelect = vi.fn()
    render(
      <LiveTimeline
        config={oneRowConfig}
        data={oneRowData}
        legendData={undefined}
        onItemSelect={onItemSelect}
      />,
    )

    lastEventHandler('doubleClick')!({ item: 'r1' })

    expect(onItemSelect).toHaveBeenCalledWith('r1')
  })

  test('ignores double-clicks that miss an item (no item)', () => {
    const onItemSelect = vi.fn()
    render(
      <LiveTimeline
        config={oneRowConfig}
        data={oneRowData}
        legendData={undefined}
        onItemSelect={onItemSelect}
      />,
    )

    lastEventHandler('doubleClick')!({ item: null })

    expect(onItemSelect).not.toHaveBeenCalled()
  })

  test('does nothing when no select handler is wired', () => {
    render(
      <LiveTimeline
        config={oneRowConfig}
        data={oneRowData}
        legendData={undefined}
      />,
    )

    expect(() =>
      lastEventHandler('doubleClick')!({ item: 'r1' }),
    ).not.toThrow()
  })
})
