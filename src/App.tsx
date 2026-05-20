import { useEffect, useMemo, useRef } from 'react'
import {
  useConfig,
  useEditorPanelConfig,
  useElementData,
  usePlugin,
} from '@sigmacomputing/plugin'
import { DataSet } from 'vis-data'
import {
  Timeline,
  type DataGroup,
  type DataItem,
  type TimelineItem,
  type TimelineOptions,
} from 'vis-timeline/esnext'
import moment from 'moment'
import './App.css'

// ISO week: Monday start (dow=1), week 1 contains the first Thursday (doy=4)
moment.updateLocale('en', { week: { dow: 1, doy: 4 } })

const SOURCE = 'source'
const STATUS_LEGEND = 'statusLegend'

function App() {
  useEditorPanelConfig([
    { name: 'data', type: 'group', label: 'Data' },
    { name: SOURCE, type: 'element', label: 'Data source' },
    {
      name: 'start',
      type: 'column',
      label: 'Start date',
      source: SOURCE,
      allowedTypes: ['datetime'],
      allowMultiple: false,
    },
    {
      name: 'end',
      type: 'column',
      label: 'End date',
      source: SOURCE,
      allowedTypes: ['datetime'],
      allowMultiple: false,
    },
    {
      name: 'label',
      type: 'column',
      label: 'Item label',
      source: SOURCE,
      allowedTypes: ['text', 'number', 'integer'],
      allowMultiple: false,
    },
    {
      name: 'group',
      type: 'column',
      label: 'Group by (assignee / project)',
      source: SOURCE,
      allowMultiple: false,
    },
    {
      name: 'idColumn',
      type: 'column',
      label: 'Row id column (required for editing)',
      source: SOURCE,
      allowMultiple: false,
    },

    { name: 'editGroup', type: 'group', label: 'Edit existing item (optional)' },
    {
      name: 'editIdVariable',
      type: 'variable',
      label: 'Workbook variable: edited row id',
      allowedTypes: ['text', 'number'],
    },
    {
      name: 'editStartVariable',
      type: 'variable',
      label: 'Workbook variable: new start',
      allowedTypes: ['date'],
    },
    {
      name: 'editEndVariable',
      type: 'variable',
      label: 'Workbook variable: new end',
      allowedTypes: ['date'],
    },
    {
      name: 'editGroupVariable',
      type: 'variable',
      label: 'Workbook variable: new group (bare value if cell was single, JSON array if cell held multiple)',
      allowedTypes: ['text'],
    },
    {
      name: 'editAction',
      type: 'action-trigger',
      label: 'On move/resize/reassign: trigger this action',
    },
    {
      name: 'confirmGroupChange',
      type: 'checkbox',
      label: 'Confirm before reassigning (drag between lanes)',
      defaultValue: false,
    },

    { name: 'addGroup', type: 'group', label: 'Add new item (optional)' },
    {
      name: 'addGroupVariable',
      type: 'variable',
      label: 'Workbook variable: new row group',
      allowedTypes: ['text'],
    },
    {
      name: 'addStartVariable',
      type: 'variable',
      label: 'Workbook variable: new row start',
      allowedTypes: ['date'],
    },
    {
      name: 'addEndVariable',
      type: 'variable',
      label: 'Workbook variable: new row end',
      allowedTypes: ['date'],
    },
    {
      name: 'addLabelVariable',
      type: 'variable',
      label: 'Workbook variable: new row label',
      allowedTypes: ['text'],
    },
    {
      name: 'addAction',
      type: 'action-trigger',
      label: 'On create: trigger this action',
    },

    { name: 'styleGroup', type: 'group', label: 'Visual styling (optional)' },
    {
      name: 'statusColumn',
      type: 'column',
      label: 'Status column (enum value per row)',
      source: SOURCE,
      allowMultiple: false,
    },
    { name: STATUS_LEGEND, type: 'element', label: 'Status legend table' },
    {
      name: 'statusLegendName',
      type: 'column',
      label: 'Legend: status value column',
      source: STATUS_LEGEND,
      allowMultiple: false,
    },
    {
      name: 'statusLegendColor',
      type: 'column',
      label: 'Legend: status color column (#hex)',
      source: STATUS_LEGEND,
      allowedTypes: ['text'],
      allowMultiple: false,
    },
    {
      name: 'featureStatusColumn',
      type: 'column',
      label: 'Feature-status column (colored chip next to label)',
      source: SOURCE,
      allowMultiple: false,
    },
    {
      name: 'pillLabelColumn',
      type: 'column',
      label: 'Pill label column (left side text, optional)',
      source: SOURCE,
      allowMultiple: false,
    },
    {
      name: 'groupSubtitle',
      type: 'text',
      label: 'Group subtitle (e.g. "Objective", "Project", "Assignee")',
      placeholder: 'Objective',
    },

    {
      name: 'lazyLoadGroup',
      type: 'group',
      label: 'Lazy load by visible window (optional)',
    },
    {
      name: 'visibleStartVariable',
      type: 'variable',
      label: 'Workbook variable: visible window start (filter by date)',
      allowedTypes: ['date'],
    },
    {
      name: 'visibleEndVariable',
      type: 'variable',
      label: 'Workbook variable: visible window end',
      allowedTypes: ['date'],
    },
  ])

  const config = useConfig()
  const data = useElementData(config?.[SOURCE])
  const legendData = useElementData(config?.[STATUS_LEGEND])

  return <LiveTimeline config={config} data={data} legendData={legendData} />
}

// ---- Item / group building ---------------------------------------------

type GroupValue = string

interface ItemMeta {
  rowId: unknown
  oldGroup: GroupValue
  groupArray: GroupValue[]
  wasMulti: boolean
}

interface ItemVisual {
  pill?: string
  featureColor?: string
}

interface BuildResult {
  items: DataItem[]
  groups: DataGroup[]
  meta: Map<string, ItemMeta>
  visuals: Map<string, ItemVisual>
  errors: string[]
}

function buildColorByStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any,
  legendData: Record<string, unknown[]> | undefined,
): Map<string, string> {
  const map = new Map<string, string>()
  if (!config || !legendData) return map
  const nameCol = config.statusLegendName
  const colorCol = config.statusLegendColor
  if (!nameCol || !colorCol) return map
  const names = legendData[nameCol] ?? []
  const colors = legendData[colorCol] ?? []
  for (let i = 0; i < names.length; i++) {
    const n = names[i]
    const c = colors[i]
    if (n != null && c != null && String(c).trim() !== '') {
      map.set(String(n), String(c))
    }
  }
  return map
}

interface ParsedGroupCell {
  values: GroupValue[]
  wasMulti: boolean
}

function parseGroupCell(raw: unknown): ParsedGroupCell {
  if (raw == null) return { values: [], wasMulti: false }
  if (Array.isArray(raw)) {
    return {
      values: raw.map(String).filter((v) => v !== ''),
      wasMulti: true,
    }
  }
  const s = String(raw).trim()
  if (s === '') return { values: [], wasMulti: false }
  if (s.startsWith('[')) {
    try {
      const parsed = JSON.parse(s)
      if (Array.isArray(parsed)) {
        return {
          values: parsed.map(String).filter((v) => v !== ''),
          wasMulti: true,
        }
      }
    } catch {
      // fall through
    }
  }
  if (s.includes(',')) {
    return {
      values: s
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v !== ''),
      wasMulti: true,
    }
  }
  return { values: [s], wasMulti: false }
}

function safeId(value: unknown): string {
  // vis-timeline DataSet keys items by id. Encode to a stable string.
  return String(value).replace(/\|/g, '\\|')
}

function buildItemsAndGroups(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any,
  data: Record<string, unknown[]> | undefined,
  colorByStatus: Map<string, string>,
): BuildResult {
  const meta = new Map<string, ItemMeta>()
  const visuals = new Map<string, ItemVisual>()
  const errors: string[] = []

  if (!config || !data) {
    return { items: [], groups: [], meta, visuals, errors }
  }

  const startCol = config.start
  const endCol = config.end
  const labelCol = config.label
  const groupCol = config.group
  const idCol = config.idColumn
  const statusCol = config.statusColumn
  const featureStatusCol = config.featureStatusColumn
  const pillCol = config.pillLabelColumn

  if (!startCol || !endCol || !groupCol) {
    return { items: [], groups: [], meta, visuals, errors }
  }

  const starts = data[startCol] ?? []
  const ends = data[endCol] ?? []
  const labels = labelCol ? (data[labelCol] ?? []) : []
  const groupCells = data[groupCol] ?? []
  const ids = idCol ? (data[idCol] ?? []) : []
  const statuses = statusCol ? (data[statusCol] ?? []) : []
  const featureStatuses = featureStatusCol ? (data[featureStatusCol] ?? []) : []
  const pills = pillCol ? (data[pillCol] ?? []) : []

  const rowCount = starts.length
  const groupSet = new Set<GroupValue>()
  const items: DataItem[] = []

  for (let i = 0; i < rowCount; i++) {
    const rawStart = starts[i]
    const rawEnd = ends[i]
    if (rawStart == null || rawEnd == null) continue

    const rowId = idCol ? ids[i] : `__row_${i}`
    const label = labelCol ? String(labels[i] ?? '') : ''
    const { values: groupValues, wasMulti } = parseGroupCell(groupCells[i])

    if (groupValues.length === 0) continue

    const status = statusCol ? String(statuses[i] ?? '') : ''
    const color = status ? colorByStatus.get(status) : undefined
    const style = color
      ? `box-shadow: inset 5px 0 0 ${color};`
      : undefined

    const featureStatus = featureStatusCol
      ? String(featureStatuses[i] ?? '')
      : ''
    const featureColor = featureStatus
      ? colorByStatus.get(featureStatus)
      : undefined

    const pill = pillCol ? String(pills[i] ?? '').trim() : ''

    for (const gv of groupValues) {
      groupSet.add(gv)
      const itemId = `${safeId(rowId)}|${safeId(gv)}`
      meta.set(itemId, {
        rowId,
        oldGroup: gv,
        groupArray: groupValues.slice(),
        wasMulti,
      })
      if (pill || featureColor) {
        visuals.set(itemId, {
          ...(pill ? { pill } : {}),
          ...(featureColor ? { featureColor } : {}),
        })
      }
      items.push({
        id: itemId,
        group: gv,
        content: label,
        start: rawStart as DataItem['start'],
        end: rawEnd as DataItem['end'],
        type: 'range',
        ...(style ? { style } : {}),
      })
    }
  }

  const groups: DataGroup[] = Array.from(groupSet)
    .sort((a, b) => a.localeCompare(b))
    .map((id) => ({ id, content: id }))

  return { items, groups, meta, visuals, errors }
}

// ---- Snap helpers ------------------------------------------------------

function floorToMonday(input: Date | string | number): Date {
  return moment(input).startOf('isoWeek').toDate()
}

// ---- Item content template ---------------------------------------------

function renderItemContent(
  item: TimelineItem,
  visualsByItemId: Map<string, ItemVisual>,
): HTMLElement | string {
  const id = String(item.id)
  const visual = visualsByItemId.get(id)
  const text = typeof item.content === 'string' ? item.content : ''
  if (!visual) return text
  const wrapper = document.createElement('span')
  wrapper.className = 'ts-item-wrapper'
  if (visual.featureColor) {
    const chip = document.createElement('span')
    chip.className = 'ts-status-chip'
    chip.style.backgroundColor = visual.featureColor
    wrapper.appendChild(chip)
  }
  if (visual.pill) {
    const pillEl = document.createElement('span')
    pillEl.className = 'ts-pill'
    pillEl.textContent = visual.pill
    wrapper.appendChild(pillEl)
  }
  const textEl = document.createElement('span')
  textEl.className = 'ts-item-text'
  textEl.textContent = text
  wrapper.appendChild(textEl)
  return wrapper
}

function renderGroupContent(
  group: DataGroup | null | undefined,
  subtitle: string,
): HTMLElement | string {
  if (!group) return ''
  const wrapper = document.createElement('span')
  wrapper.className = 'ts-group-wrapper'
  const name = document.createElement('span')
  name.className = 'ts-group-name'
  name.textContent =
    typeof group.content === 'string' ? group.content : String(group.id ?? '')
  wrapper.appendChild(name)
  if (subtitle) {
    const sub = document.createElement('span')
    sub.className = 'ts-group-subtitle'
    sub.textContent = subtitle
    wrapper.appendChild(sub)
  }
  return wrapper
}

// ---- Live timeline -----------------------------------------------------

interface LiveTimelineProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any
  data: Record<string, unknown[]> | undefined
  legendData: Record<string, unknown[]> | undefined
}

function LiveTimeline({ config, data, legendData }: LiveTimelineProps) {
  const plugin = usePlugin()

  const containerRef = useRef<HTMLDivElement | null>(null)
  const timelineRef = useRef<Timeline | null>(null)
  const itemsDsRef = useRef<DataSet<DataItem> | null>(null)
  const groupsDsRef = useRef<DataSet<DataGroup> | null>(null)
  const metaRef = useRef<Map<string, ItemMeta>>(new Map())
  const visualsRef = useRef<Map<string, ItemVisual>>(new Map())

  // Snapshot of the latest config + plugin handle, read by stable callbacks
  // attached at Timeline init time.
  const stateRef = useRef({ config, plugin })
  useEffect(() => {
    stateRef.current = { config, plugin }
  }, [config, plugin])

  const colorByStatus = useMemo(
    () => buildColorByStatus(config, legendData),
    [config, legendData],
  )

  const { items, groups, meta, visuals } = useMemo(
    () => buildItemsAndGroups(config, data, colorByStatus),
    [config, data, colorByStatus],
  )

  // Keep meta + visuals in refs so callbacks always see the latest mapping
  useEffect(() => {
    metaRef.current = meta
  }, [meta])
  useEffect(() => {
    visualsRef.current = visuals
  }, [visuals])

  // One-time Timeline construction
  useEffect(() => {
    if (!containerRef.current) return
    const itemsDs = new DataSet<DataItem>()
    const groupsDs = new DataSet<DataGroup>()
    itemsDsRef.current = itemsDs
    groupsDsRef.current = groupsDs

    const initialStart = moment().subtract(1, 'month').toDate()
    const initialEnd = moment().add(2, 'months').toDate()

    const options: TimelineOptions = {
      stack: true,
      orientation: 'top',
      start: initialStart,
      end: initialEnd,
      zoomMin: 1000 * 60 * 60 * 24 * 28, // 4 weeks
      zoomMax: 1000 * 60 * 60 * 24 * 365 * 5, // 5 years
      timeAxis: { scale: 'week', step: 1 },
      format: {
        minorLabels: { week: 'MMM D' },
        majorLabels: { week: 'MMMM YYYY' },
      },
      margin: {
        item: { vertical: 12, horizontal: 10 },
        axis: 24,
      },
      verticalScroll: true,
      itemsAlwaysDraggable: true,
      editable: {
        add: true,
        updateTime: true,
        updateGroup: true,
        remove: false,
        overrideItems: false,
      },
      moment: (date: moment.MomentInput) => moment(date),
      // vis-timeline calls snap(date, scale, step) per endpoint during drag.
      // For whole-bar moves the library snaps the start then sets
      // end = snappedStart + duration internally — duration is preserved.
      snap: (date: Date) => floorToMonday(date),
      groupOrder: (a: DataGroup, b: DataGroup) =>
        String(a.content ?? a.id).localeCompare(String(b.content ?? b.id)),
      template: (item: TimelineItem) =>
        renderItemContent(item, visualsRef.current),
      groupTemplate: (group: DataGroup) =>
        renderGroupContent(
          group,
          String(stateRef.current.config?.groupSubtitle ?? '').trim(),
        ),
      onMove: (item, callback) => {
        handleMove(item, callback, stateRef.current, metaRef.current)
      },
      onAdd: (item, callback) => {
        handleAdd(item, callback, stateRef.current)
      },
    }

    const tl = new Timeline(containerRef.current, itemsDs, groupsDs, options)
    timelineRef.current = tl

    // Push the visible window to workbook variables (debounced) so a Sigma-side
    // filter can lazy-load only rows that overlap the window.
    let debounceHandle: number | undefined
    const pushVisibleWindow = (start: Date, end: Date) => {
      const { config: cfg, plugin: plg } = stateRef.current
      if (!cfg) return
      if (cfg.visibleStartVariable) {
        plg.config.setVariable(
          cfg.visibleStartVariable,
          moment(start).toISOString(),
        )
      }
      if (cfg.visibleEndVariable) {
        plg.config.setVariable(
          cfg.visibleEndVariable,
          moment(end).toISOString(),
        )
      }
    }
    const handleRangeChanged = (props: { start: Date; end: Date }) => {
      if (debounceHandle !== undefined) window.clearTimeout(debounceHandle)
      debounceHandle = window.setTimeout(() => {
        pushVisibleWindow(props.start, props.end)
      }, 300)
    }
    tl.on('rangechanged', handleRangeChanged)
    // Seed variables with the initial window so the first fetch matches.
    pushVisibleWindow(initialStart, initialEnd)

    return () => {
      if (debounceHandle !== undefined) window.clearTimeout(debounceHandle)
      tl.off('rangechanged', handleRangeChanged)
      tl.destroy()
      timelineRef.current = null
      itemsDsRef.current = null
      groupsDsRef.current = null
    }
  }, [])

  // Push items + groups updates whenever the data builds change
  useEffect(() => {
    const itemsDs = itemsDsRef.current
    const groupsDs = groupsDsRef.current
    if (!itemsDs || !groupsDs) return
    itemsDs.clear()
    groupsDs.clear()
    groupsDs.add(groups)
    itemsDs.add(items)
  }, [items, groups])

  const hasSource = Boolean(config?.[SOURCE])
  const missingCols =
    !config?.start || !config?.end || !config?.group ? true : false

  return (
    <div className="timeline-root">
      <header className="timeline-header">
        <h1>Timeline</h1>
        <p className="timeline-sub">
          {!hasSource
            ? 'Pick a data source in the editor panel.'
            : missingCols
              ? 'Pick Start, End, and Group columns in the editor panel.'
              : `${items.length} item${items.length === 1 ? '' : 's'} across ${groups.length} lane${groups.length === 1 ? '' : 's'}.`}
        </p>
      </header>
      <div ref={containerRef} className="timeline-host" />
    </div>
  )
}

// ---- Action API writers ------------------------------------------------

interface CallbackState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugin: any
}

function setIfBound(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugin: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any,
  optionName: string,
  value: unknown,
) {
  if (config?.[optionName]) {
    plugin.config.setVariable(optionName, value)
  }
}

function handleMove(
  item: TimelineItem,
  callback: (item: TimelineItem | null) => void,
  state: CallbackState,
  meta: Map<string, ItemMeta>,
) {
  const { config, plugin } = state
  const recorded = meta.get(item.id as string)
  if (!recorded) {
    callback(item)
    return
  }

  const newGroup = String(item.group ?? '')
  const groupChanged = newGroup !== recorded.oldGroup

  if (groupChanged && config?.confirmGroupChange) {
    const ok = window.confirm(
      `Reassign this item from "${recorded.oldGroup}" to "${newGroup}"?`,
    )
    if (!ok) {
      callback(null)
      return
    }
  }

  if (!config?.editAction || !config?.editIdVariable) {
    // Editing not wired in Sigma yet. Confirm visually but warn once.
    if (!handleMove._warned) {
      console.warn(
        '[sigma-timeline] Edit action / id variable not configured. Move accepted visually but not persisted.',
      )
      handleMove._warned = true
    }
    callback(item)
    return
  }

  setIfBound(plugin, config, 'editIdVariable', recorded.rowId)
  if (item.start) {
    setIfBound(
      plugin,
      config,
      'editStartVariable',
      moment(item.start as Date).toISOString(),
    )
  }
  if (item.end) {
    setIfBound(
      plugin,
      config,
      'editEndVariable',
      moment(item.end as Date).toISOString(),
    )
  }

  if (groupChanged) {
    const next = recorded.groupArray.filter((v) => v !== recorded.oldGroup)
    if (!next.includes(newGroup)) next.push(newGroup)
    const encoded = recorded.wasMulti ? JSON.stringify(next) : (next[0] ?? '')
    setIfBound(plugin, config, 'editGroupVariable', encoded)
  }

  plugin.config.triggerAction(config.editAction)

  // Optimistic: keep the new position on screen. The next Sigma data refresh
  // is the source of truth; if the action fails the item will snap back.
  callback(item)
}
handleMove._warned = false as boolean

function handleAdd(
  item: TimelineItem,
  callback: (item: TimelineItem | null) => void,
  state: CallbackState,
) {
  const { config, plugin } = state

  const groupValue = item.group != null ? String(item.group) : ''
  const start = item.start ? floorToMonday(item.start as Date) : floorToMonday(new Date())
  const end = new Date(+start + 7 * 24 * 60 * 60 * 1000)

  if (!config?.addAction) {
    if (!handleAdd._warned) {
      console.warn(
        '[sigma-timeline] Create action not configured. Add ignored.',
      )
      handleAdd._warned = true
    }
    callback(null)
    return
  }

  setIfBound(plugin, config, 'addGroupVariable', groupValue)
  setIfBound(plugin, config, 'addStartVariable', start.toISOString())
  setIfBound(plugin, config, 'addEndVariable', end.toISOString())
  setIfBound(plugin, config, 'addLabelVariable', '')

  plugin.config.triggerAction(config.addAction)

  // Don't add locally — wait for Sigma to round-trip the new row.
  callback(null)
}
handleAdd._warned = false as boolean

export default App
