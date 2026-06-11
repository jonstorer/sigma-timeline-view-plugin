import { useCallback, useEffect, useRef } from 'react'
import {
  useActionTrigger,
  useConfig,
  useEditorPanelConfig,
  useElementData,
  useVariable,
} from '@sigmacomputing/plugin'
import { editorPanelConfig, SOURCE, STATUS_LEGEND } from './editorPanel'
import { LiveTimeline, type ItemEditPayload } from './LiveTimeline'
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
  const legendData = useElementData(config?.[STATUS_LEGEND] ?? '')

  const payloadVariableId = config?.editPayloadVariable ?? ''
  const [editPayloadVar, setEditPayload] = useVariable(payloadVariableId)
  const triggerEditAction = useActionTrigger(config?.editAction ?? '')

  const editEnabled = Boolean(
    config?.idColumn && config?.editPayloadVariable && config?.editAction,
  )

  const currentValueRef = useRef<unknown>(undefined)
  useEffect(() => {
    currentValueRef.current = editPayloadVar?.defaultValue?.value
  }, [editPayloadVar])

  const pendingPayloadRef = useRef<string | null>(null)
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fireAction = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current)
      fallbackTimerRef.current = null
    }
    pendingPayloadRef.current = null
    triggerEditAction()
  }, [triggerEditAction])

  const onItemEdit = useCallback(
    (payload: ItemEditPayload) => {
      const json = JSON.stringify(payload)

      const current = currentValueRef.current
      if (current != null && String(current) === json) return

      pendingPayloadRef.current = json

      setEditPayload(json)

      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current)
      fallbackTimerRef.current = setTimeout(() => {
        if (pendingPayloadRef.current === json) {
          fireAction()
        }
      }, 3000)
    },
    [setEditPayload, fireAction],
  )

  useEffect(() => {
    const pending = pendingPayloadRef.current
    if (pending == null) return
    const current = editPayloadVar?.defaultValue?.value
    if (current != null && String(current) === pending) {
      fireAction()
    }
  }, [editPayloadVar, fireAction])

  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current)
    }
  }, [])

  return (
    <LiveTimeline
      config={config}
      data={data}
      legendData={legendData}
      onItemEdit={editEnabled ? onItemEdit : undefined}
    />
  )
}

export default App
