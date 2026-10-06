import { useCallback } from 'react'
import {
  useConfig,
  useEditorPanelConfig,
  useElementColumns,
  useElementData,
} from '@sigmacomputing/plugin'
import { editorPanelConfig, SOURCE } from './editorPanel'
import { LiveTimeline, type ItemEditPayload } from './LiveTimeline'
import { withColumnLabels } from './editPayload'
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
  // Column metadata for the source element — used to label the edit payload's
  // keys with the human column names instead of opaque column ids.
  const columns = useElementColumns(config?.[SOURCE] ?? '')

  // Drag-edit: relabel the payload keys (source column id → human name) and
  // write it, then fire the edit action. Keys are the id, start, end, and each
  // Group-by column; the Group-by keys carry the row's new lane membership
  // after a between-swimlane drag.
  const fireEdit = useTriggerWithValue(
    config?.editPayloadVariable ?? '',
    config?.editAction ?? '',
  )
  // Double-click: write the activated row's record id into the bound control,
  // then fire the action. Double-click is an explicit "open this record"
  // gesture, so re-activating the same row re-fires (refireOnSameValue) even
  // though the id is unchanged.
  const fireSelect = useTriggerWithValue(
    config?.recordIdVariable ?? '',
    config?.selectAction ?? '',
    { refireOnSameValue: true },
  )

  const editEnabled = Boolean(
    config?.idColumn && config?.editPayloadVariable && config?.editAction,
  )
  const selectEnabled = Boolean(
    config?.idColumn && config?.recordIdVariable && config?.selectAction,
  )

  const onItemEdit = useCallback(
    (payload: ItemEditPayload) => {
      fireEdit(JSON.stringify(withColumnLabels(payload, columns)))
    },
    [fireEdit, columns],
  )

  const onItemSelect = useCallback(
    (recordId: string) => {
      fireSelect(recordId)
    },
    [fireSelect],
  )

  return (
    <LiveTimeline
      config={config}
      data={data}
      onItemEdit={editEnabled ? onItemEdit : undefined}
      onItemSelect={selectEnabled ? onItemSelect : undefined}
    />
  )
}

export default App
