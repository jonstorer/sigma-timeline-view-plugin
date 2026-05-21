import {
  useConfig,
  useEditorPanelConfig,
  useElementData,
} from '@sigmacomputing/plugin'
import { editorPanelConfig, SOURCE, STATUS_LEGEND } from './editorPanel'
import { LiveTimeline } from './LiveTimeline'
import './App.css'

function App() {
  useEditorPanelConfig(editorPanelConfig)

  const config = useConfig()
  const data = useElementData(config?.[SOURCE])
  const legendData = useElementData(config?.[STATUS_LEGEND])

  return <LiveTimeline config={config} data={data} legendData={legendData} />
}

export default App