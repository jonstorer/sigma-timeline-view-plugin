import { useCallback } from 'react'
import {
  useConfig,
  useEditorPanelConfig,
  useElementData,
} from '@sigmacomputing/plugin'
import { editorPanelConfig, SOURCE } from './editorPanel'
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

  // Drag-edit: write the {id,startDate,endDate} payload, then fire the edit action.
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
      fireEdit(JSON.stringify(payload))
    },
    [fireEdit],
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
