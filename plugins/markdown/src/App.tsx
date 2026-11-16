import { useConfig, useEditorPanelConfig, useElementData } from '@sigmacomputing/plugin'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import { editorPanelConfig, SOURCE } from './editorPanel'
import { extractRows } from './markdownData'
import type { MarkdownConfig } from './types'
import './App.css'

// Shown while the plugin is still being configured, so an author can see
// where each field lands before any data is wired up.
function ExampleRow() {
  return (
    <div className="md-row md-row-example">
      <span className="md-corner md-corner-tl">Top left</span>
      <span className="md-corner md-corner-tr">Top right</span>
      <div className="md-body">
        <p>Body (Markdown)</p>
      </div>
      <span className="md-corner md-corner-bl">Bottom left</span>
      <span className="md-corner md-corner-br">Bottom right</span>
    </div>
  )
}

// A label with no URL renders as plain text; a URL with no label renders
// nothing, since there's no text to show as a link.
function Corner({
  label,
  url,
  position,
}: {
  label: string
  url: string
  position: 'tl' | 'tr' | 'bl' | 'br'
}) {
  if (!label) return null
  const className = `md-corner md-corner-${position}`
  return url ? (
    <a className={className} href={url} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  ) : (
    <span className={className}>{label}</span>
  )
}

function App() {
  useEditorPanelConfig(editorPanelConfig)

  // useConfig() is typed `any` by the SDK; narrow it to our known shape.
  const config = useConfig() as MarkdownConfig | undefined
  // The SDK's element hook types its id as `string` but treats undefined/''
  // as "unconfigured" (no-op). Default to '' so a partial config stays
  // type-clean without changing behavior.
  const data = useElementData(config?.[SOURCE] ?? '')

  if (!config?.[SOURCE] || !config.bodyColumn) {
    return (
      <div className="md-root">
        <p className="md-placeholder">
          {config?.[SOURCE]
            ? 'Pick a Body column in the editor panel.'
            : 'Pick a data source in the editor panel.'}
        </p>
        <ExampleRow />
      </div>
    )
  }

  const rows = extractRows(data, {
    body: config.bodyColumn,
    topLeft: config.topLeftColumn,
    topLeftUrl: config.topLeftUrlColumn,
    topRight: config.topRightColumn,
    topRightUrl: config.topRightUrlColumn,
    bottomLeft: config.bottomLeftColumn,
    bottomLeftUrl: config.bottomLeftUrlColumn,
    bottomRight: config.bottomRightColumn,
    bottomRightUrl: config.bottomRightUrlColumn,
  })

  return (
    <div className="md-root">
      {rows.map((row, i) =>
        row.body === '' ? null : (
          <div className="md-row" key={i}>
            <Corner label={row.topLeft} url={row.topLeftUrl} position="tl" />
            <Corner label={row.topRight} url={row.topRightUrl} position="tr" />
            <div className="md-body">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                {row.body}
              </ReactMarkdown>
            </div>
            <Corner label={row.bottomLeft} url={row.bottomLeftUrl} position="bl" />
            <Corner label={row.bottomRight} url={row.bottomRightUrl} position="br" />
          </div>
        ),
      )}
    </div>
  )
}

export default App
