export interface MarkdownRow {
  body: string
  topLeft: string
  topRight: string
  bottomLeft: string
  bottomRight: string
}

interface ColumnSelection {
  body?: string
  topLeft?: string
  topRight?: string
  bottomLeft?: string
  bottomRight?: string
}

function columnValues(
  data: Record<string, unknown[]> | undefined,
  column: string | undefined,
): string[] {
  if (!column || !data) return []
  return (data[column] ?? []).map((value) => (value == null ? '' : String(value)))
}

/**
 * Zip the body column with the four optional corner columns by row index.
 * Row count follows the body column — a corner column is read up to that
 * length and padded with '' past its own, since a corner with no value for
 * a given row just means that row has nothing to show in that spot.
 */
export function extractRows(
  data: Record<string, unknown[]> | undefined,
  columns: ColumnSelection,
): MarkdownRow[] {
  const bodies = columnValues(data, columns.body)
  const topLefts = columnValues(data, columns.topLeft)
  const topRights = columnValues(data, columns.topRight)
  const bottomLefts = columnValues(data, columns.bottomLeft)
  const bottomRights = columnValues(data, columns.bottomRight)

  return bodies.map((body, i) => ({
    body,
    topLeft: topLefts[i] ?? '',
    topRight: topRights[i] ?? '',
    bottomLeft: bottomLefts[i] ?? '',
    bottomRight: bottomRights[i] ?? '',
  }))
}
