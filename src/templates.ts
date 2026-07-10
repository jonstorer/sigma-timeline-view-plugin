import type { TimelineItem } from 'vis-timeline/esnext'
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
  if (visual.linkUrl) {
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
  return wrapper
}
