# markdown

A Sigma plugin that renders a text column's value as Markdown. Deliberately
minimal — no editing, no toolbar, no live preview, just rendering. Built for
use inside a **Repeated Container**: bind it to the same data source as the
repeater, and Sigma scopes the bound column to each card's row automatically
(the same mechanism native elements use — see
[Use repeated containers to generate layouts from data](https://help.sigmacomputing.com/docs/use-repeated-containers-to-generate-layouts-from-data)).
Works the same way in a Single Row Container, or standalone against a
single-row element.

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
| `source` | element | The data source (worksheet / table / repeater's own source). |
| `markdownColumn` | column (text) | The column holding Markdown text. Can be a raw stored column or a calculated column — the plugin just renders whatever string Sigma resolves for it. |

That's the whole config. No edit payload, no actions, no select wiring — this
plugin only reads and renders.

## Behavior

- Renders row 0 of the bound column only. Outside a repeater/single-row
  context this means only the first row of a multi-row element is shown —
  intentional; this plugin displays one value, not a list.
- Supports core Markdown (headings, emphasis, links, lists, code blocks,
  blockquotes) via [react-markdown](https://github.com/remarkjs/react-markdown).
  No GitHub-flavored extensions (tables, strikethrough, task lists) by
  default — add [`remark-gfm`](https://github.com/remarkjs/remark-gfm) as a
  plugin to `<ReactMarkdown remarkPlugins={[remarkGfm]}>` in `src/App.tsx` if
  you need those.
- Raw HTML embedded in the Markdown source is **not** rendered — `react-markdown`
  treats it as literal text by default, which also means it doesn't execute
  scripts or styles from the Markdown value. Don't add `rehype-raw` to change
  this unless you trust every value that can reach this column.
- An empty or missing cell renders nothing (not an error) — expected for
  repeater rows that don't have a value yet.
- Content taller than the card scrolls within it rather than being clipped or
  forcing every card in the repeater to match the tallest row's height.
