import type { DataGroup, DataItem } from 'vis-timeline/esnext'

/**
 * Drop any group that has no visible item left in it — directly or, for a
 * multi-level hierarchy, through any of its descendants. Items only ever
 * attach to leaf groups (see buildItems.ts), so a parent group's own
 * visibility is entirely derived from whether any descendant still has
 * content; a parent with every child now empty disappears too, rather than
 * leaving a header row over nothing.
 *
 * Surviving parent groups have their own `nestedGroups` pruned to just the
 * children that survived, so nothing references a group id that's no longer
 * in the returned array.
 */
export function pruneEmptyGroups(
  groups: DataGroup[],
  visibleItems: DataItem[],
): DataGroup[] {
  const groupsById = new Map(groups.map((g) => [String(g.id), g]))
  const leafIdsWithItems = new Set(
    visibleItems.map((item) => String(item.group)),
  )

  const hasContent = new Map<string, boolean>()
  function computeHasContent(id: string): boolean {
    const cached = hasContent.get(id)
    if (cached != null) return cached
    const group = groupsById.get(id)
    let result = leafIdsWithItems.has(id)
    if (!result && group?.nestedGroups) {
      result = group.nestedGroups.some((childId) =>
        computeHasContent(String(childId)),
      )
    }
    hasContent.set(id, result)
    return result
  }

  return groups
    .filter((g) => computeHasContent(String(g.id)))
    .map((g) => {
      if (!g.nestedGroups) return g
      const survivingChildren = g.nestedGroups.filter((childId) =>
        computeHasContent(String(childId)),
      )
      return { ...g, nestedGroups: survivingChildren }
    })
}
