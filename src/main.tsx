import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MESSAGES } from '../shared/i18n'
import { App } from './App'
import { DocumentStore } from './lib/document-store'
import { MessagesContext } from './lib/i18n'
import { MarkdownWorkerClient } from './markdown/client'
import './styles/tokens.css'
import './styles/base.css'

const worker = new MarkdownWorkerClient()
worker.warmUp()
const store = new DocumentStore(worker)

// Subscribe before asking for the initial state so no document/file-state event slips in between.
window.mdv.onDocument((message) => store.receive(message))
window.mdv.onFileState((state) => store.handleFileState(state))
const initial = await window.mdv.getInitialState()
if (initial.pending) store.receive(initial.pending)

document.documentElement.lang = initial.locale

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

createRoot(root).render(
  <StrictMode>
    <MessagesContext value={MESSAGES[initial.locale]}>
      <App
        store={store}
        platform={initial.platform}
        initialTocVisible={initial.tocVisible}
        initialCustomCss={initial.customCss}
      />
    </MessagesContext>
  </StrictMode>,
)
