import { useCallback, useState } from 'react'

interface HistoryState<T> {
  entries: T[]
  index: number
}

/** Undo/redo stack for immutable snapshots. */
export function useHistoryStack<T>(initial: T, limit = 60) {
  const [state, setState] = useState<HistoryState<T>>({
    entries: [initial],
    index: 0,
  })

  const present = state.entries[state.index] as T

  const reset = useCallback((value: T) => {
    setState({ entries: [value], index: 0 })
  }, [])

  const push = useCallback(
    (value: T) => {
      setState((prev) => {
        const nextEntries = [...prev.entries.slice(0, prev.index + 1), value]
        const trimmed =
          nextEntries.length > limit ? nextEntries.slice(nextEntries.length - limit) : nextEntries
        return { entries: trimmed, index: trimmed.length - 1 }
      })
    },
    [limit],
  )

  const undo = useCallback(() => {
    setState((prev) => ({ ...prev, index: Math.max(0, prev.index - 1) }))
  }, [])

  const redo = useCallback(() => {
    setState((prev) => ({
      ...prev,
      index: Math.min(prev.entries.length - 1, prev.index + 1),
    }))
  }, [])

  return {
    present,
    push,
    undo,
    redo,
    reset,
    canUndo: state.index > 0,
    canRedo: state.index < state.entries.length - 1,
  }
}
