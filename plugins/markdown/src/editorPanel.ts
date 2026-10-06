import type { CustomPluginConfigOptions } from '@sigmacomputing/plugin'

export const SOURCE = 'source'

export const editorPanelConfig: CustomPluginConfigOptions[] = [
  { name: SOURCE, type: 'element', label: 'Data source' },
  {
    name: 'bodyColumn',
    type: 'column',
    label: 'Body (Markdown)',
    source: SOURCE,
    allowedTypes: ['text'],
    allowMultiple: false,
  },
  {
    name: 'topLeftColumn',
    type: 'column',
    label: 'Top left (optional)',
    source: SOURCE,
    allowMultiple: false,
  },
  {
    name: 'topRightColumn',
    type: 'column',
    label: 'Top right (optional)',
    source: SOURCE,
    allowMultiple: false,
  },
  {
    name: 'bottomLeftColumn',
    type: 'column',
    label: 'Bottom left (optional)',
    source: SOURCE,
    allowMultiple: false,
  },
  {
    name: 'bottomRightColumn',
    type: 'column',
    label: 'Bottom right (optional)',
    source: SOURCE,
    allowMultiple: false,
  },
]
