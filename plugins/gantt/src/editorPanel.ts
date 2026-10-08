import type { CustomPluginConfigOptions } from '@sigmacomputing/plugin'

export const SOURCE = 'source'
export const SOURCE_B = 'sourceB'

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
    name: 'projectedEndColumn',
    type: 'column',
    label: 'Projected end date',
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
    label: 'Progress column (0–1 fraction, optional)',
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
    label: 'Link URL column (arrow that opens in a new tab, optional)',
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

  // Second source — read-only, rendered on the same chart as the
  // primary source. A group that matches a primary-source group by value
  // (e.g. the same person's name) lands on the same row. No id/edit/select
  // wiring: items from this source are never draggable. See README.
  {
    name: SOURCE_B,
    type: 'element',
    label: 'Second source (optional, read-only)',
  },

  {
    name: 'labelB',
    type: 'column',
    label: 'Source B: item label',
    source: SOURCE_B,
    allowedTypes: ['text', 'number', 'integer'],
    allowMultiple: false,
  },

  {
    name: 'groupB',
    type: 'column',
    label: 'Source B: group by (top → bottom of hierarchy)',
    source: SOURCE_B,
    allowMultiple: true,
  },

  {
    name: 'startDateB',
    type: 'column',
    label: 'Source B: start date',
    source: SOURCE_B,
    allowedTypes: ['datetime'],
    allowMultiple: false,
  },

  {
    name: 'endDateB',
    type: 'column',
    label: 'Source B: end date',
    source: SOURCE_B,
    allowedTypes: ['datetime'],
    allowMultiple: false,
  },

  {
    name: 'highlightColorColumnB',
    type: 'column',
    label: 'Source B: highlight color column (#hex, optional)',
    source: SOURCE_B,
    allowedTypes: ['text'],
    allowMultiple: false,
  },

  {
    name: 'progressColumnB',
    type: 'column',
    label: 'Source B: progress column (0–1 fraction, optional)',
    source: SOURCE_B,
    allowedTypes: ['number', 'integer'],
    allowMultiple: false,
  },

  {
    name: 'pillLabelColumnB',
    type: 'column',
    label: 'Source B: pill label column (optional)',
    source: SOURCE_B,
    allowMultiple: false,
  },

  {
    name: 'pillColorColumnB',
    type: 'column',
    label: 'Source B: pill color column (#hex, optional)',
    source: SOURCE_B,
    allowedTypes: ['text'],
    allowMultiple: false,
  },

  {
    name: 'linkColumnB',
    type: 'column',
    label: 'Source B: link URL column (optional)',
    source: SOURCE_B,
    allowMultiple: false,
  },

  {
    name: 'descriptionColumnB',
    type: 'column',
    label: 'Source B: hover description column (optional)',
    source: SOURCE_B,
    allowMultiple: false,
  },
]
