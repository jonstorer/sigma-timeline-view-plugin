import type { DataGroup, DataItem } from 'vis-timeline/esnext'
import { buildItemsAndGroups } from './buildItems'
import { colorForKey } from './colorHash'
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

const WORK_SUBGROUP = 'work'
const ONCALL_SUBGROUP = 'oncall'

/** Every source-B item's id is prefixed with this, both to keep it from
 * colliding with a primary-source item id and so callers (e.g. the
 * show/hide-source toggles in LiveTimeline) can tell which source an item
 * in the merged array came from without re-deriving it. */
export const SOURCE_B_ID_PREFIX = 'b|'

export function isSourceBItemId(id: unknown): boolean {
  return typeof id === 'string' && id.startsWith(SOURCE_B_ID_PREFIX)
}

/**
 * Pins the on-call subgroup to the top band of every row, regardless of how
 * many work items stack beneath it — see vis-timeline's DataGroup.subgroupOrder.
 *
 * vis-timeline calls this with each subgroup's first raw item **data object**,
 * not the subgroup name itself (confirmed by reading its source — the type
 * declares `(a: any, b: any) => number` without documenting the shape). An
 * earlier version of this compared `a`/`b` directly to the subgroup name
 * string, which is never true for an object, so the comparator silently
 * always returned 0 and subgroups fell back to insertion order.
 */
function subgroupOrder(a: DataItem, b: DataItem): number {
  if (a.subgroup === ONCALL_SUBGROUP) return -1
  if (b.subgroup === ONCALL_SUBGROUP) return 1
  return 0
}

/**
 * Source B's default color, when `highlightColorColumnB` wasn't configured
 * (or was blank for this row): a consistent color per person, so distinct
 * on-call shifts are visually distinguishable without anyone having to wire
 * up a color column. An explicit `--item-color` already in `item.style`
 * (from a configured highlight column) always wins — this only fills the gap.
 *
 * Hashed on the item's own label (content), not its group: the group a
 * source-B row lands on can be shared by many different people (e.g.
 * grouped by team, not by individual), which would otherwise hash everyone
 * on that row to the same color.
 */
function withDefaultColor(item: DataItem): DataItem {
  if (item.style?.includes('--item-color:')) return item
  const { background, text } = colorForKey(item.content)
  const colorVars = `--item-color: ${background}; --item-text-color: ${text};`
  return { ...item, style: item.style ? `${item.style} ${colorVars}` : colorVars }
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

  // Source B is on-call-schedule-shaped data: shifts change down to the
  // minute, not the day, so its items must sit at their exact instant rather
  // than being floored to midnight like the primary source's week/day-
  // granular items.
  const {
    items: itemsB,
    groups: groupsB,
    visuals: visualsB,
  } = buildItemsAndGroups(configB, dataB, { exactTime: true })

  const prefixedItemsB = itemsB.map((item) =>
    withDefaultColor({
      ...item,
      id: `${SOURCE_B_ID_PREFIX}${item.id}`,
      editable: false,
      className: [item.className, 'ts-source-b'].filter(Boolean).join(' '),
      subgroup: ONCALL_SUBGROUP,
    }),
  )

  // Reserve a dedicated top band for source B, separate from however many
  // work items are stacked in a row — without this, vis-timeline would just
  // pack on-call bars in wherever they fit among the work items, instead of
  // always showing as one consistent strip at the top of every swimlane.
  const primaryItems = primary.items.map((item) => ({
    ...item,
    subgroup: WORK_SUBGROUP,
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

  const groups = Array.from(groupsById.values()).map((g) => ({
    ...g,
    subgroupOrder,
    // subgroupOrder alone only controls ordering when something already
    // needs separate lines — it doesn't force separation on its own. Without
    // subgroupStack, an on-call bar that happens not to overlap any work
    // item in time gets packed onto that item's own line by the generic
    // stacking algorithm, so the "always a dedicated top band" effect only
    // showed up on rows busy enough to need it anyway. This forces the
    // oncall subgroup onto its own line(s) unconditionally.
    //
    // Both subgroups must be listed, not just oncall: per vis-timeline's own
    // source (confirmed by reading it), once subgroupStack is an object at
    // all it becomes a per-subgroup whitelist — any subgroup left out
    // defaults to no stacking (direct overlay) rather than falling back to
    // the top-level `stack: true` option. Omitting `work` here silently
    // turned off work items' own stacking among themselves.
    subgroupStack: { [ONCALL_SUBGROUP]: true, [WORK_SUBGROUP]: true },
  }))

  return {
    items: [...primaryItems, ...prefixedItemsB],
    groups,
    visuals,
  }
}
