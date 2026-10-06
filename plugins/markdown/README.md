# markdown

A Sigma plugin that renders a Markdown column as a list of cards: one
required Body column, plus four optional columns anchored to each corner
(top left, top right, bottom left, bottom right) for metadata like an
author, a tag, a date, a status.

Bind it directly to your table — it renders **every row**, not just one.
It is not meant to go inside a Repeated Container: Sigma's per-row scoping
("Source column" input type) is a formula-binding mechanism available only
to native elements. A plugin's `column` config always resolves to the
*entire* bound table, in every card, so one instance inside a repeater would
just show the same full dataset in every card (confirmed against Sigma's own
docs — see
[Use repeated containers to generate layouts from data](https://help.sigmacomputing.com/docs/use-repeated-containers-to-generate-layouts-from-data)).
This plugin sidesteps that by doing the list rendering itself.

One plugin in the [sigma-plugins](../../README.md) monorepo.

## Dev

```bash
npm install                       # from the repo root, once
npm run dev --workspace=markdown  # from the repo root
# or, from this directory:
npm install && npm run dev
```

Then in Sigma, drop a "Plugin Dev Playground" element on a workbook page and
point it at `http://localhost:3031`.

## Editor-panel config

| Slot | Type | Purpose |
|---|---|---|
| `source` | element | The data source (worksheet / table). |
| `bodyColumn` | column (text only) | Required. The column holding Markdown text. |
| `topLeftColumn` | column (any type) | Optional. Rendered as plain text, anchored to the top-left corner. |
| `topRightColumn` | column (any type) | Optional. Rendered as plain text, anchored to the top-right corner. |
| `bottomLeftColumn` | column (any type) | Optional. Rendered as plain text, anchored to the bottom-left corner. |
| `bottomRightColumn` | column (any type) | Optional. Rendered as plain text, anchored to the bottom-right corner. |

The four corner columns deliberately accept any column type (text, number,
date, a calculated field, etc.) and are coerced to a string for display —
they're metadata labels, not Markdown, so there's no reason to restrict them
the way the Body column is restricted. Any of these can be a raw stored
column or a calculated column — the plugin just renders whatever value
Sigma resolves for it. No edit payload, no actions, no select wiring — this
plugin only reads and renders.

Renaming or removing a field here orphans any value already stored under
its old name in a workbook — Sigma doesn't migrate it, it just stops
showing up. Expect to re-pick columns after a config shape change.

## Behavior

- Until a data source and Body column are both picked, the plugin shows an
  example row (dashed border, placeholder labels in each of the five slots)
  so an author can see where each field will land before wiring up data.
- Once configured, renders every row of the Body column, each in its own
  card separated by a divider, with any configured corner columns overlaid
  at their position.
- Only the Body column is parsed as Markdown — the four corner columns
  render as plain text.
- Supports core Markdown (headings, emphasis, links, lists, code blocks,
  blockquotes) via [react-markdown](https://github.com/remarkjs/react-markdown),
  plus GitHub-flavored extensions (tables, strikethrough, task lists) via
  [`remark-gfm`](https://github.com/remarkjs/remark-gfm), and single newlines
  rendered as line breaks via
  [`remark-breaks`](https://github.com/remarkjs/remark-breaks) — standard
  CommonMark only starts a new line on a *blank* line, which reads wrong for
  AI-generated or hand-typed text that uses single newlines between list
  items or table rows.
- A GFM table still needs each row on its own line in the source text (just
  not a blank line between them) — if a whole table arrives as one unbroken
  line with no newlines at all, no markdown renderer can recover the row
  boundaries from that.
- Raw HTML embedded in the Markdown source is **not** rendered — `react-markdown`
  treats it as literal text by default, which also means it doesn't execute
  scripts or styles from the Markdown value. Don't add `rehype-raw` to change
  this unless you trust every value that can reach this column.
- A row with an empty or missing Body value is skipped entirely (not
  rendered as an empty card, not an error) — the four corner columns don't
  affect whether a row renders.
- Content taller than the element scrolls within it rather than being
  clipped.
