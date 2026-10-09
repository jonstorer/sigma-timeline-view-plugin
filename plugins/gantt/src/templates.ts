import type { TimelineItem } from 'vis-timeline/esnext'
import { isSourceBItemId } from './secondarySource'
import type { ItemVisual } from './types'

export function renderItemContent(
  item: TimelineItem,
  visualsByItemId: Map<string, ItemVisual>,
): HTMLElement | string {
  const id = String(item.id)
  const visual = visualsByItemId.get(id)
  const text = typeof item.content === 'string' ? item.content : ''
  if (!visual) return text

  const wrapper = document.createElement('span')
  wrapper.className = 'ts-item-wrapper'

  // Source A items are draggable, so wrapping the whole pill in a link isn't
  // safe there — in practice that swallows the click a drag-to-edit gesture
  // starts with, so the item just starts dragging instead of navigating.
  // It gets a small separate glyph instead (left of the pill), whose own
  // small hit-box intercepts the click without affecting the rest of the
  // pill. Source B is never draggable (always editable: false), so there's
  // no such conflict — the whole pill is safely the link there instead.
  const isSourceB = isSourceBItemId(id)

  if (visual.linkUrl && !isSourceB) {
    const link = document.createElement('a')
    link.className = 'ts-item-link'
    link.href = visual.linkUrl
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.title = 'Open link in a new tab'
    link.textContent = '↗'
    // Stop the pointer/click from reaching vis-timeline so the anchor opens
    // instead of starting an item drag or firing the select action; the
    // anchor's own default click still navigates (in a new tab).
    for (const type of ['pointerdown', 'mousedown', 'click']) {
      link.addEventListener(type, (e) => e.stopPropagation())
    }
    wrapper.appendChild(link)
  }

  if (visual.pill) {
    const pillEl = document.createElement('span')
    pillEl.className = 'ts-pill'
    pillEl.textContent = visual.pill
    if (visual.pillColor) pillEl.style.backgroundColor = visual.pillColor
    wrapper.appendChild(pillEl)
  }
  const textEl = document.createElement('span')
  textEl.className = 'ts-item-text'
  textEl.textContent = text
  wrapper.appendChild(textEl)

  if (!visual.linkUrl || !isSourceB) return wrapper

  // Source B only: the whole item is the link, not a separate glyph. Only
  // `click` is stopped from reaching vis-timeline (so it doesn't also
  // register as a selection) — there's no drag gesture to protect here.
  const link = document.createElement('a')
  link.className = 'ts-item-link-wrap'
  link.href = visual.linkUrl
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.title = 'Open link in a new tab'
  link.appendChild(wrapper)
  link.addEventListener('click', (e) => e.stopPropagation())
  return link
}
