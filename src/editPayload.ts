import type { WorkbookElementColumns } from '@sigmacomputing/plugin'
import type { ItemEditPayload } from './LiveTimeline'

/**
 * Re-key the edit payload from source column ids to their human labels, so the
 * JSON the action receives reads `{"Start Date": ...}` not `{"W3sgUzHi4C":
 * ...}`. Columns the metadata doesn't know fall back to their id. Note: if two
 * columns share a label the later one wins — labels aren't guaranteed unique.
 */
export function withColumnLabels(
  payload: ItemEditPayload,
  columns: WorkbookElementColumns,
): Record<string, unknown> {
  const labeled: Record<string, unknown> = {}
  for (const [colId, value] of Object.entries(payload)) {
    labeled[columns[colId]?.name ?? colId] = value
  }
  return labeled
}
