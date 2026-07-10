import type { CustomPluginConfigOptions } from '@sigmacomputing/plugin'

export const SOURCE = 'source'

export const editorPanelConfig: CustomPluginConfigOptions[] = [
  { name: SOURCE, type: 'element', label: 'Data source' },

  {
    name: 'idColumn',
    type: 'column',
    label: 'Row id column (required for editing)',
    source: SOURCE,
    allowMultiple: false,
  },

  {
    name: 'label',
    type: 'column',
    label: 'Item label',
    source: SOURCE,
    allowedTypes: ['text', 'number', 'integer'],
    allowMultiple: false,
  },

  {
    name: 'group',
    type: 'column',
    label: 'Group by (top → bottom of hierarchy)',
    source: SOURCE,
    allowMultiple: true,
  },

  {
    name: 'startDate',
    type: 'column',
    label: 'Start date',
    source: SOURCE,
    allowedTypes: ['datetime'],
    allowMultiple: false,
  },

  {
    name: 'endDate',
    type: 'column',
    label: 'End date',
    source: SOURCE,
    allowedTypes: ['datetime'],
    allowMultiple: false,
  },

  {
    name: 'highlightColorColumn',
    type: 'column',
    label: 'Highlight color column (#hex, optional)',
    source: SOURCE,
    allowedTypes: ['text'],
    allowMultiple: false,
  },

  {
    name: 'progressColumn',
    type: 'column',
    label: 'Progress column (0–1 fraction, fills the bar, optional)',
    source: SOURCE,
    allowedTypes: ['number', 'integer'],
    allowMultiple: false,
  },

  {
    name: 'pillLabelColumn',
    type: 'column',
    label: 'Pill label column (left side text, optional)',
    source: SOURCE,
    allowMultiple: false,
  },

  {
    name: 'pillColorColumn',
    type: 'column',
    label: 'Pill color column (#hex, optional)',
    source: SOURCE,
    allowedTypes: ['text'],
    allowMultiple: false,
  },

  {
    name: 'linkColumn',
    type: 'column',
    label: 'Link URL column (opens in a new tab from the right of the item, optional)',
    source: SOURCE,
    allowMultiple: false,
  },

  {
    name: 'descriptionColumn',
    type: 'column',
    label: 'Hover description column (shown on item hover, optional)',
    source: SOURCE,
    allowMultiple: false,
  },

  {
    name: 'editPayloadVariable',
    type: 'variable',
    label:
      'Edit payload variable (text; JSON keyed by your source column names: id, start, end, and each Group-by column)',
    allowedTypes: ['text'],
  },

  {
    name: 'recordIdVariable',
    type: 'variable',
    label: 'On select: record id control (single-select)',
  },

  {
    name: 'editAction',
    type: 'action-trigger',
    label: 'Edit action',
  },

  {
    name: 'selectAction',
    type: 'action-trigger',
    label: 'On select action (fires after the JSON is set)',
  },
]
