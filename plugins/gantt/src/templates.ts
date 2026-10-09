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

  if (!visual.linkUrl) return wrapper

  // The whole item is the link when a URL is configured — not a separate
  // glyph. Only `click` is stopped from reaching vis-timeline (so it doesn't
  // also register as a selection); pointerdown/pointermove are left alone,
  // so dragging an editable item still works — a drag gesture never fires a
  // plain `click` event, only a genuine no-movement click does.
  const link = document.createElement('a')
  link.className = 'ts-item-link'
  link.href = visual.linkUrl
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.title = 'Open link in a new tab'
  link.appendChild(wrapper)
  link.addEventListener('click', (e) => e.stopPropagation())
  return link
}
