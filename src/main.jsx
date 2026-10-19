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

// Tidigare versioner sparade cookiesamtycke, cachad data och en Supabase-session
// i webbläsaren. Inget av det används längre, så det tas bort vid besök.
function removeLegacyStorage() {
  try {
    const legacy = ['gdpr_ok', 'cached_feeds', 'cached_categories', 'sb-juzqqvhupgvojdeuihok-auth-token']
    for (const key of Object.keys(localStorage)) {
      if (legacy.includes(key) || key.startsWith('cached_news_')) localStorage.removeItem(key)
    }
  } catch {}
}

const redirect = legacyRedirect()
removeLegacyStorage()
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
