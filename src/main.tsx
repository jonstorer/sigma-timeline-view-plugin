import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { client, SigmaClientProvider } from '@sigmacomputing/plugin'
import moment from 'moment'
import 'vis-timeline/styles/vis-timeline-graph2d.css'
import './index.css'
import App from './App.tsx'

// ISO week: Monday start (dow=1), week 1 contains the first Thursday (doy=4).
// Affects vis-timeline week-tick alignment.
moment.updateLocale('en', { week: { dow: 1, doy: 4 } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SigmaClientProvider client={client}>
      <App />
    </SigmaClientProvider>
  </StrictMode>,
)
