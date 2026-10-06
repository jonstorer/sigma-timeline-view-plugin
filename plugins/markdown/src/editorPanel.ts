import type { CustomPluginConfigOptions } from '@sigmacomputing/plugin'

export const SOURCE = 'source'

export const editorPanelConfig: CustomPluginConfigOptions[] = [
  { name: SOURCE, type: 'element', label: 'Data source' },

  {
    name: 'markdownColumn',
    type: 'column',
    label: 'Markdown column',
    source: SOURCE,
    allowedTypes: ['text'],
    allowMultiple: false,
  },
]
