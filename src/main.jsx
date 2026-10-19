import React from 'react'
import ReactDOM from 'react-dom/client'
import App, { ErrorBoundary } from './App.jsx'
import '../styles.css'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'

// Gamla adresser (?view=artiklar&slug=X) leder till de statiska artikelsidorna.
// vercel.json gör samma omdirigering på servern; detta täcker övriga miljöer.
function legacyRedirect() {
  const p = new URLSearchParams(window.location.search)
  if (p.get('view') !== 'artiklar') return null
  const slug = p.get('slug')
  return slug && /^[a-z0-9-]+$/.test(slug) ? `/artiklar/${slug}` : '/artiklar'
}

const redirect = legacyRedirect()
if (redirect) {
  window.location.replace(redirect)
} else {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <ErrorBoundary>
      <App />
      <Analytics />
      <SpeedInsights />
    </ErrorBoundary>
  )
}
