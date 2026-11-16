export interface MarkdownRow {
  body: string
  topLeft: string
  topLeftUrl: string
  topRight: string
  topRightUrl: string
  bottomLeft: string
  bottomLeftUrl: string
  bottomRight: string
  bottomRightUrl: string
}

interface ColumnSelection {
  body?: string
  topLeft?: string
  topLeftUrl?: string
  topRight?: string
  topRightUrl?: string
  bottomLeft?: string
  bottomLeftUrl?: string
  bottomRight?: string
  bottomRightUrl?: string
}

function columnValues(
  data: Record<string, unknown[]> | undefined,
  column: string | undefined,
): string[] {
  if (!column || !data) return []
  return (data[column] ?? []).map((value) => (value == null ? '' : String(value)))
}

/**
 * Zip the body column with the four optional corner columns (and each
 * corner's optional URL column) by row index. Row count follows the body
 * column — a corner column is read up to that length and padded with ''
 * past its own, since a corner with no value for a given row just means
 * that row has nothing to show in that spot.
 */
export function extractRows(
  data: Record<string, unknown[]> | undefined,
  columns: ColumnSelection,
): MarkdownRow[] {
  const bodies = columnValues(data, columns.body)
  const topLefts = columnValues(data, columns.topLeft)
  const topLeftUrls = columnValues(data, columns.topLeftUrl)
  const topRights = columnValues(data, columns.topRight)
  const topRightUrls = columnValues(data, columns.topRightUrl)
  const bottomLefts = columnValues(data, columns.bottomLeft)
  const bottomLeftUrls = columnValues(data, columns.bottomLeftUrl)
  const bottomRights = columnValues(data, columns.bottomRight)
  const bottomRightUrls = columnValues(data, columns.bottomRightUrl)

  return bodies.map((body, i) => ({
    body,
    topLeft: topLefts[i] ?? '',
    topLeftUrl: topLeftUrls[i] ?? '',
    topRight: topRights[i] ?? '',
    topRightUrl: topRightUrls[i] ?? '',
    bottomLeft: bottomLefts[i] ?? '',
    bottomLeftUrl: bottomLeftUrls[i] ?? '',
    bottomRight: bottomRights[i] ?? '',
    bottomRightUrl: bottomRightUrls[i] ?? '',
  }))
}
