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
  if (visual.chipColor) {
    const chip = document.createElement('span')
    chip.className = 'ts-status-chip'
    chip.style.backgroundColor = visual.chipColor
    wrapper.appendChild(chip)
  }
  if (visual.pill) {
    const pillEl = document.createElement('span')
    pillEl.className = 'ts-pill'
    pillEl.textContent = visual.pill
    wrapper.appendChild(pillEl)
  }
  const textEl = document.createElement('span')
  textEl.className = 'ts-item-text'
  textEl.textContent = text
  wrapper.appendChild(textEl)
  return wrapper
}
