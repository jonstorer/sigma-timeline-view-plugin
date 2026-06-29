import { describe, expect, test } from 'vitest'
import type { TimelineItem } from 'vis-timeline/esnext'
import { renderItemContent } from './templates'
import type { ItemVisual } from './types'

function makeItem(id: string, content = 'Hello'): TimelineItem {
  return { id, content, start: new Date() } as TimelineItem
}

describe('renderItemContent', () => {
  test('returns plain content string when item has no visual entry', () => {
    const visuals = new Map<string, ItemVisual>()
    const out = renderItemContent(makeItem('x'), visuals)
    expect(out).toBe('Hello')
  })

  test('returns empty string when content is not a string and no visual', () => {
    const visuals = new Map<string, ItemVisual>()
    const item = { id: 'x', content: document.createElement('span') }
    const out = renderItemContent(item as TimelineItem, visuals)
    expect(out).toBe('')
  })

  test('renders wrapper with text node when only label exists in visuals', () => {
    // Visual entry exists but has no pill — wrapper should still render with
    // the text. (Note: visuals isn't set in current build for label-only, but
    // the renderer handles this defensively.)
    const visuals = new Map<string, ItemVisual>([['x', { pill: '' }]])
    const out = renderItemContent(makeItem('x', 'Hello'), visuals)
    expect(out).toBeInstanceOf(HTMLElement)
    if (out instanceof HTMLElement) {
      expect(out.className).toBe('ts-item-wrapper')
      expect(out.querySelector('.ts-item-text')?.textContent).toBe('Hello')
    }
  })

  test('renders pill element with text when pill is set', () => {
    const visuals = new Map<string, ItemVisual>([['x', { pill: 'P1' }]])
    const out = renderItemContent(makeItem('x', 'Task'), visuals)
    expect(out).toBeInstanceOf(HTMLElement)
    if (out instanceof HTMLElement) {
      const pill = out.querySelector('.ts-pill')
      expect(pill?.textContent).toBe('P1')
    }
  })

  test('fills the pill background from pillColor when set', () => {
    const visuals = new Map<string, ItemVisual>([
      ['x', { pill: 'HIGH', pillColor: '#ef4444' }],
    ])
    const out = renderItemContent(makeItem('x', 'Task'), visuals)
    expect(out).toBeInstanceOf(HTMLElement)
    if (out instanceof HTMLElement) {
      const pill = out.querySelector<HTMLElement>('.ts-pill')
      expect(pill!.style.backgroundColor).toBe('rgb(239, 68, 68)')
    }
  })

  test('pill with no pillColor leaves the inline background unset (CSS default applies)', () => {
    const visuals = new Map<string, ItemVisual>([['x', { pill: 'P1' }]])
    const out = renderItemContent(makeItem('x', 'Task'), visuals)
    if (out instanceof HTMLElement) {
      const pill = out.querySelector<HTMLElement>('.ts-pill')
      expect(pill!.style.backgroundColor).toBe('')
    }
  })

  test('renders pill + text together in order', () => {
    const visuals = new Map<string, ItemVisual>([['x', { pill: 'TAG' }]])
    const out = renderItemContent(makeItem('x', 'Body'), visuals)
    expect(out).toBeInstanceOf(HTMLElement)
    if (out instanceof HTMLElement) {
      const children = Array.from(out.children) as HTMLElement[]
      expect(children).toHaveLength(2)
      expect(children[0].className).toBe('ts-pill')
      expect(children[1].className).toBe('ts-item-text')
      expect(children[1].textContent).toBe('Body')
    }
  })

  test('pill text is set via textContent, preventing HTML injection', () => {
    const visuals = new Map<string, ItemVisual>([
      ['x', { pill: '<script>alert(1)</script>' }],
    ])
    const out = renderItemContent(makeItem('x', 'T'), visuals)
    expect(out).toBeInstanceOf(HTMLElement)
    if (out instanceof HTMLElement) {
      const pill = out.querySelector('.ts-pill') as HTMLElement
      // textContent escapes — no <script> child is created
      expect(pill.querySelector('script')).toBeNull()
      expect(pill.textContent).toBe('<script>alert(1)</script>')
    }
  })

  test('item id is coerced to string for visuals lookup', () => {
    const visuals = new Map<string, ItemVisual>([['42', { pill: 'X' }]])
    const item = { id: 42 as unknown as string, content: 'X', start: new Date() }
    const out = renderItemContent(item as TimelineItem, visuals)
    expect(out).toBeInstanceOf(HTMLElement)
  })
})
