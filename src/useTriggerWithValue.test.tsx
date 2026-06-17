import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useActionTrigger, useVariable } from '@sigmacomputing/plugin'
import { useTriggerWithValue } from './useTriggerWithValue'

vi.mock('@sigmacomputing/plugin', () => ({
  useVariable: vi.fn(),
  useActionTrigger: vi.fn(),
}))

const setVariable = vi.fn()
const triggerAction = vi.fn()
// Stand-in for the workbook's current variable value. Tests mutate this and
// rerender to simulate the workbook echoing a set back to the plugin.
let variableValue: unknown

const asWorkbookVariable = (value: unknown) =>
  value == null ? undefined : { name: 'v', defaultValue: { type: 'text', value } }

beforeEach(() => {
  variableValue = undefined
  setVariable.mockReset()
  triggerAction.mockReset()
  vi.mocked(useVariable).mockImplementation(() => [
    asWorkbookVariable(variableValue),
    setVariable,
  ])
  vi.mocked(useActionTrigger).mockReturnValue(triggerAction)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useTriggerWithValue', () => {
  test('sets the variable but waits for the echo before firing the action', () => {
    const { result } = renderHook(() => useTriggerWithValue('v', 'a'))

    act(() => result.current('hello'))

    expect(setVariable).toHaveBeenCalledWith('hello')
    expect(triggerAction).not.toHaveBeenCalled()
  })

  test('fires the action once the workbook echoes the new value back', () => {
    const { result, rerender } = renderHook(() => useTriggerWithValue('v', 'a'))

    act(() => result.current('hello'))
    expect(triggerAction).not.toHaveBeenCalled()

    variableValue = 'hello'
    rerender()

    expect(triggerAction).toHaveBeenCalledTimes(1)
  })

  test('fires via the fallback timer when the echo never arrives', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() =>
      useTriggerWithValue('v', 'a', { fallbackMs: 3000 }),
    )

    act(() => result.current('hello'))
    expect(triggerAction).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(3000))
    expect(triggerAction).toHaveBeenCalledTimes(1)
  })

  test('does nothing when the value already matches and refire is off', () => {
    variableValue = 'X'
    const { result } = renderHook(() => useTriggerWithValue('v', 'a'))

    act(() => result.current('X'))

    expect(setVariable).not.toHaveBeenCalled()
    expect(triggerAction).not.toHaveBeenCalled()
  })

  test('refires immediately when the value matches and refire is on', () => {
    variableValue = 'X'
    const { result } = renderHook(() =>
      useTriggerWithValue('v', 'a', { refireOnSameValue: true }),
    )

    act(() => result.current('X'))

    expect(triggerAction).toHaveBeenCalledTimes(1)
    expect(setVariable).not.toHaveBeenCalled()
  })
})
