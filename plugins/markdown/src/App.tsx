import {
  useConfig,
  useEditorPanelConfig,
  useElementData,
} from '@sigmacomputing/plugin'
import ReactMarkdown from 'react-markdown'
import { editorPanelConfig, SOURCE } from './editorPanel'
import { extractMarkdown } from './markdownData'
import type { MarkdownConfig } from './types'
import './App.css'

function App() {
  useEditorPanelConfig(editorPanelConfig)

  // useConfig() is typed `any` by the SDK; narrow it to our known shape.
  const config = useConfig() as MarkdownConfig | undefined
  // The SDK's element hook types its id as `string` but treats undefined/''
  // as "unconfigured" (no-op). Default to '' so a partial config stays
  // type-clean without changing behavior.
  const data = useElementData(config?.[SOURCE] ?? '')

  if (!config?.[SOURCE]) {
    return <p className="md-placeholder">Pick a data source in the editor panel.</p>
  }
  if (!config.markdownColumn) {
    return <p className="md-placeholder">Pick a Markdown column in the editor panel.</p>
  }

  return (
    <div className="md-root">
      <ReactMarkdown>{extractMarkdown(data, config.markdownColumn)}</ReactMarkdown>
    </div>
  )
}

export default App
