import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

// /labs/* holds small experiments for Little Big Questions; everything else is the bedroom viewer.
// Both are lazy so the labs pages don't download three.js and the viewer doesn't download the labs.
const App = lazy(() => import('./App.jsx'))
const Labs = lazy(() => import('./labs/Labs.jsx'))
const isLabs = window.location.pathname.startsWith('/labs')
const Page = isLabs ? Labs : App
// the loading screen in index.html is the viewer's; the viewer hides it once the room is ready
if (isLabs) document.getElementById('boot')?.remove()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  </StrictMode>,
)
