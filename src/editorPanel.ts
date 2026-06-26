import type { CustomPluginConfigOptions } from '@sigmacomputing/plugin'

export const SOURCE = 'source'
export const STATUS_LEGEND = 'statusLegend'

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
    name: 'pillLabelColumn',
    type: 'column',
    label: 'Pill label column (left side text, optional)',
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
    name: 'statusColumn',
    type: 'column',
    label: 'Status column (enum value per row)',
    source: SOURCE,
    allowMultiple: false,
  },

  {
    name: 'editPayloadVariable',
    type: 'variable',
    label: 'Edit payload variable (text, holds JSON: {id,startDate,endDate})',
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

  { name: STATUS_LEGEND, type: 'element', label: 'Status legend table' },

  {
    name: 'statusLegendName',
    type: 'column',
    label: 'Legend: status value column',
    source: STATUS_LEGEND,
    allowMultiple: false,
  },

  {
    name: 'statusLegendColor',
    type: 'column',
    label: 'Legend: status color column (#hex)',
    source: STATUS_LEGEND,
    allowedTypes: ['text'],
    allowMultiple: false,
  },
]
