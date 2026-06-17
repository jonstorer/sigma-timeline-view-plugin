import { useCallback } from 'react'
import {
  useConfig,
  useEditorPanelConfig,
  useElementColumns,
  useElementData,
} from '@sigmacomputing/plugin'
import { editorPanelConfig, SOURCE, STATUS_LEGEND } from './editorPanel'
import { LiveTimeline, type ItemEditPayload } from './LiveTimeline'
import { useTriggerWithValue } from './useTriggerWithValue'
import type { TimelineConfig } from './types'
import './App.css'

function App() {
  useEditorPanelConfig(editorPanelConfig)

  // useConfig() is typed `any` by the SDK; narrow it to our known shape.
  const config = useConfig() as TimelineConfig | undefined
  // The SDK's element/variable/action hooks type their id as `string` but
  // treat undefined/'' as "unconfigured" (no-op). Default to '' so a partial
  // config stays type-clean without changing behavior.
  const data = useElementData(config?.[SOURCE] ?? '')
  const columns = useElementColumns(config?.[SOURCE] ?? '')
  const legendData = useElementData(config?.[STATUS_LEGEND] ?? '')

  // Drag-edit: write the {id,startDate,endDate} payload, then fire the edit action.
  const fireEdit = useTriggerWithValue(
    config?.editPayloadVariable ?? '',
    config?.editAction ?? '',
  )
  // Select: write the selected row as a JSON payload of the pass-through
  // columns, then fire the action. Re-selecting the same row produces the same
  // JSON, so the default no-refire-on-same-value applies.
  const fireSelect = useTriggerWithValue(
    config?.passthroughVariable ?? '',
    config?.selectAction ?? '',
  )

  const editEnabled = Boolean(
    config?.idColumn && config?.editPayloadVariable && config?.editAction,
  )
  const selectEnabled = Boolean(
    config?.passthroughVariable && config?.selectAction,
  )

  const onItemEdit = useCallback(
    (payload: ItemEditPayload) => {
      fireEdit(JSON.stringify(payload))
    },
    [fireEdit],
  )

  const onItemSelect = useCallback(
    (rowJson: string) => {
      fireSelect(rowJson)
    },
    [fireSelect],
  )

  return (
    <LiveTimeline
      config={config}
      data={data}
      columns={columns}
      legendData={legendData}
      onItemEdit={editEnabled ? onItemEdit : undefined}
      onItemSelect={selectEnabled ? onItemSelect : undefined}
    />
  )
}

export default App
