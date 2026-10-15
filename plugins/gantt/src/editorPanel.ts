import type { CustomPluginConfigOptions } from '@sigmacomputing/plugin'

export const SOURCE = 'source'
export const SOURCE_B = 'sourceB'

// Sigma's `type: 'group'` can ONLY contain `type: 'text'` children (via the
// child's own `source` pointing at the group's `name`) — confirmed against
// the plugin-development docs after this panel's `plannedDatesGroup`/
// `actualDatesGroup`/`otherFieldsGroup` headers (an earlier attempt to
// section off the column/variable/action-trigger fields below) rendered as
// permanently empty in a live workbook. There's no API-level way to visually
// group a `column`, `variable`, or `action-trigger` field at all, so those
// fields below are organized by order and label alone; `MENU_LABELS_GROUP`
// further down is the one place grouping actually works, since its two
// fields are genuinely `type: 'text'`.
const MENU_LABELS_GROUP = 'menuLabelsGroup'

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
    label: 'Planned start date',
    source: SOURCE,
    allowedTypes: ['datetime'],
    allowMultiple: false,
  },

  {
    name: 'endDate',
    type: 'column',
    label: 'Planned end date',
    source: SOURCE,
    allowedTypes: ['datetime'],
    allowMultiple: false,
  },

  {
    name: 'projectedEndColumn',
    type: 'column',
    label: 'Projected end date (optional)',
    source: SOURCE,
    allowedTypes: ['datetime'],
    allowMultiple: false,
  },

  // Optional — surfaces when a child ticket actually started/is projected to
  // finish, independent of the planned dates above. Both columns must be set
  // for the overlay to render; see buildItems.ts's resolveActualOverlay.
  // "Actual" is in both labels since there's no group header to carry that
  // context anymore (see the note on MENU_LABELS_GROUP above).
  {
    name: 'actualStartColumn',
    type: 'column',
    label: 'Actual start date (optional)',
    source: SOURCE,
    allowedTypes: ['datetime'],
    allowMultiple: false,
  },

  {
    name: 'projectedActualEndColumn',
    type: 'column',
    label: 'Actual projected end date (optional)',
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

  // Edit pair and select pair are each two fields (a variable + the action
  // that fires after it's set) — can't be real Sigma groups (both are
  // `variable`/`action-trigger`, not `type: 'text'`; see the note on
  // MENU_LABELS_GROUP above), so the "Edit:"/"On select:" label prefixes and
  // keeping each pair adjacent are the only tools available to signal that
  // relationship.
  {
    name: 'editPayloadVariable',
    type: 'variable',
    label:
      'Edit: payload variable (JSON keyed by your source column names: id, start, end, and each Group-by column)',
    allowedTypes: ['text'],
  },

  {
    name: 'editAction',
    type: 'action-trigger',
    label: 'Edit: action (fires after the payload variable is set)',
  },

  {
    name: 'recordIdVariable',
    type: 'variable',
    label: 'On select: record id control (single-select)',
  },

  {
    name: 'selectAction',
    type: 'action-trigger',
    label: 'On select: action (fires after the record id is set)',
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

  // The one real group in this panel — both fields are genuinely `type:
  // 'text'`, which is the only child type Sigma's group mechanism supports
  // (see the note above MENU_LABELS_GROUP). Purely cosmetic: relabels "Show
  // Source A"/"Show Source B" in the plugin's own rendered show/hide menu
  // (e.g. "Show Roadmap"/"Show On-Call"). Sigma's editor-panel field labels
  // are static, so this can't relabel anything in THIS panel — "Data
  // source"/"Second source" above always just say that.
  { name: MENU_LABELS_GROUP, type: 'group', label: 'Show/hide menu labels (optional)' },

  {
    name: 'sourceAName',
    type: 'text',
    source: MENU_LABELS_GROUP,
    label: 'Source A name',
    placeholder: 'Source A',
  },

  {
    name: 'sourceBName',
    type: 'text',
    source: MENU_LABELS_GROUP,
    label: 'Source B name',
    placeholder: 'Source B',
  },
]
