import type { DataGroup, DataItem } from 'vis-timeline/esnext'
import { buildItemsAndGroups } from './buildItems'
import type { BuildResult, ItemVisual, TimelineConfig } from './types'

/**
 * Remaps the "B"-suffixed config fields onto the plain field names
 * `buildItemsAndGroups` expects, so source B can reuse the exact same
 * item/group-building logic as the primary source rather than a second,
 * parallel implementation.
 */
function configForSourceB(
  config: TimelineConfig | null | undefined,
): TimelineConfig {
  if (!config) return {}
  return {
    source: config.sourceB,
    label: config.labelB,
    group: config.groupB,
    startDate: config.startDateB,
    endDate: config.endDateB,
    highlightColorColumn: config.highlightColorColumnB,
    progressColumn: config.progressColumnB,
    pillLabelColumn: config.pillLabelColumnB,
    pillColorColumn: config.pillColorColumnB,
    linkColumn: config.linkColumnB,
    descriptionColumn: config.descriptionColumnB,
  }
}

export interface MergedItemsAndGroups {
  items: DataItem[]
  groups: DataGroup[]
  visuals: Map<string, ItemVisual>
}

/**
 * Second-source support: build source B's items/groups through the exact
 * same pipeline as the primary source, then merge the two result sets onto
 * one chart.
 *
 * Source B is read-only here — there's no id/edit/select wiring for it, so a
 * drag on one of its items has nowhere correct to write back (the edit
 * payload is keyed by the primary source's id/column shape). Prefixing B's
 * item ids keeps them from colliding with A's; forcing `editable: false`
 * keeps them from being dragged at all.
 *
 * Groups are NOT prefixed — a group with the same id (i.e. the same value at
 * the same position in the hierarchy) from both sources merges into one row.
 * That's the whole point of a second source: two independently-configured
 * tables that happen to reference the same person/value land on the same
 * row, and vis-timeline's own stacking makes any time overlap between them
 * visible without either source needing to know about the other.
 */
export function mergeSecondarySource(
  primary: Pick<BuildResult, 'items' | 'groups' | 'visuals'>,
  config: TimelineConfig | null | undefined,
  dataB: Record<string, unknown[]> | undefined,
): MergedItemsAndGroups {
  const configB = configForSourceB(config)
  if (!configB.source) {
    return { items: primary.items, groups: primary.groups, visuals: primary.visuals }
  }

  const {
    items: itemsB,
    groups: groupsB,
    visuals: visualsB,
  } = buildItemsAndGroups(configB, dataB)

  const prefixedItemsB = itemsB.map((item) => ({
    ...item,
    id: `b|${item.id}`,
    editable: false,
    className: [item.className, 'ts-source-b'].filter(Boolean).join(' '),
  }))

  // visualsB is keyed by source B's own (unprefixed) item ids — remap to the
  // prefixed ids above so the link/pill/hover-description lookups (keyed by
  // rendered item id) actually find them. This is the piece that was missing
  // before: source B's pill/link/description were computed but never
  // reachable, since they lived under a key nothing ever looked up.
  const visuals = new Map(primary.visuals)
  for (const [id, visual] of visualsB) {
    visuals.set(`b|${id}`, visual)
  }

  const groupsById = new Map(primary.groups.map((g) => [String(g.id), g]))
  for (const g of groupsB) {
    const id = String(g.id)
    const existing = groupsById.get(id)
    if (!existing) {
      groupsById.set(id, g)
      continue
    }
    // The same group id from both sources: keep the primary's own
    // content/className, but union nestedGroups so either source's children
    // still show up under it.
    const mergedNested = Array.from(
      new Set([...(existing.nestedGroups ?? []), ...(g.nestedGroups ?? [])]),
    )
    groupsById.set(id, {
      ...existing,
      ...(mergedNested.length > 0 ? { nestedGroups: mergedNested } : {}),
    })
  }

  return {
    items: [...primary.items, ...prefixedItemsB],
    groups: Array.from(groupsById.values()),
    visuals,
  }
}
