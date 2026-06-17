import { useCallback, useEffect, useRef } from 'react'
import { useActionTrigger, useVariable } from '@sigmacomputing/plugin'

export interface TriggerWithValueOptions {
  /**
   * What to do when `fire(value)` is called with a value that already matches
   * the variable's current value:
   * - `false` (default): do nothing. Used where re-issuing the same value is
   *   meaningless — re-dropping a drag-edit where it already sits, or
   *   re-selecting the row a detail panel already shows.
   * - `true`: fire the action immediately, so re-issuing the same value
   *   re-triggers (e.g. an action that re-opens the record).
   */
  refireOnSameValue?: boolean
  /**
   * If the workbook never echoes the new value back, fire the action anyway
   * after this many milliseconds so a dropped echo can't strand it.
   */
  fallbackMs?: number
}

/**
 * Binds a Sigma text variable to an action trigger. Calling the returned
 * `fire(value)` sets the variable, waits for the workbook to echo the new
 * value back, then triggers the action — so the action always reads the value
 * we just set rather than a stale one.
 */
export function useTriggerWithValue(
  variableId: string,
  actionId: string,
  { refireOnSameValue = false, fallbackMs = 3000 }: TriggerWithValueOptions = {},
): (value: string) => void {
  const [variable, setVariable] = useVariable(variableId)
  const triggerAction = useActionTrigger(actionId)

  const currentValueRef = useRef<unknown>(undefined)
  useEffect(() => {
    currentValueRef.current = variable?.defaultValue?.value
  }, [variable])

  const pendingRef = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fire = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    pendingRef.current = null
    triggerAction()
  }, [triggerAction])

  // Fire as soon as the workbook echoes back the value we set.
  useEffect(() => {
    const pending = pendingRef.current
    if (pending == null) return
    const current = variable?.defaultValue?.value
    if (current != null && String(current) === pending) {
      fire()
    }
  }, [variable, fire])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return useCallback(
    (value: string) => {
      const current = currentValueRef.current
      if (current != null && String(current) === value) {
        if (refireOnSameValue) fire()
        return
      }
      pendingRef.current = value
      setVariable(value)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        if (pendingRef.current === value) fire()
      }, fallbackMs)
    },
    [setVariable, fire, refireOnSameValue, fallbackMs],
  )
}
