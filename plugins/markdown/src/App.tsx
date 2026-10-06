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
    topRight: config.topRightColumn,
    bottomLeft: config.bottomLeftColumn,
    bottomRight: config.bottomRightColumn,
  })

  return (
    <div className="md-root">
      {rows.map((row, i) =>
        row.body === '' ? null : (
          <div className="md-row" key={i}>
            {row.topLeft && (
              <span className="md-corner md-corner-tl">{row.topLeft}</span>
            )}
            {row.topRight && (
              <span className="md-corner md-corner-tr">{row.topRight}</span>
            )}
            <div className="md-body">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                {row.body}
              </ReactMarkdown>
            </div>
            {row.bottomLeft && (
              <span className="md-corner md-corner-bl">{row.bottomLeft}</span>
            )}
            {row.bottomRight && (
              <span className="md-corner md-corner-br">{row.bottomRight}</span>
            )}
          </div>
        ),
      )}
    </div>
  )
}

export default App
