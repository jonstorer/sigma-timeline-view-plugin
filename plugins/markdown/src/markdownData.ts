/**
 * Pull the markdown string out of the bound column's data.
 *
 * Only ever reads row 0. This plugin is meant to render one value at a time —
 * either a single-row element, or (the primary use case) one instance per
 * card inside a Sigma Repeated Container, where Sigma itself scopes the
 * element's data to the current row before the plugin ever sees it. If a
 * multi-row element is bound directly (no repeater), later rows are simply
 * not rendered — this plugin doesn't loop over rows.
 */
export function extractMarkdown(
  data: Record<string, unknown[]> | undefined,
  column: string | undefined,
): string {
  if (!column || !data) return ''
  const value = data[column]?.[0]
  return value == null ? '' : String(value)
}
