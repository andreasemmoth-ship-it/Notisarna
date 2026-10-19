import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { POSTS_DIR, publishedPosts } from './scripts/lib/posts.js'
import { renderArticlePage, renderArticlesIndex } from './scripts/lib/render.js'

// Statiska sidor som byggs till <sökväg>/index.html. Samma lista finns som
// rewrites i vercel.json.
const STATIC_PAGE = /^\/(artiklar(\/[a-z0-9-]+)?)$/

const VIRTUAL_POSTS = 'virtual:posts'
const RESOLVED_VIRTUAL_POSTS = '\0' + VIRTUAL_POSTS

// Artiklarna byggs till statisk HTML av scripts/build-static.js.
// Pluginet ger React-appen en lista över publicerade artiklar (utan brödtext)
// och visar artikelsidorna även i `npm run dev`.
function posts() {
  let outDir
  return {
    name: 'notiserna-posts',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    resolveId(id) {
      if (id === VIRTUAL_POSTS) return RESOLVED_VIRTUAL_POSTS
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL_POSTS) return
      const list = publishedPosts().map(({ slug, titel, beskrivning, datum }) => ({ slug, titel, beskrivning, datum }))
      return `export default ${JSON.stringify(list)}`
    },
    handleHotUpdate({ file, server }) {
      if (!file.startsWith(POSTS_DIR)) return
      const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_POSTS)
      if (mod) server.moduleGraph.invalidateModule(mod)
      server.ws.send({ type: 'full-reload' })
    },
    configureServer(server) {
      const headAssets = '<link rel="stylesheet" href="/styles.css">'
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url ?? '').split('?')[0].replace(/\/$/, '')
        let html = null
        if (pathname === '/artiklar') {
          html = renderArticlesIndex(publishedPosts(), { headAssets })
        } else {
          const match = pathname.match(/^\/artiklar\/([a-z0-9-]+)$/)
          const post = match && publishedPosts().find(p => p.slug === match[1])
          if (post) html = renderArticlePage(post, { headAssets })
        }
        if (!html) return next()
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(html)
      })
    },
    // `vite preview` ska bete sig som Vercel: statiska sidor utan avslutande
    // snedstreck och 404 för okända artiklar i stället för SPA-fallback.
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const [pathname, search = ''] = (req.url ?? '').split('?')
        const clean = pathname.replace(/\/$/, '')
        if (!STATIC_PAGE.test(clean)) return next()
        if (fs.existsSync(path.join(outDir, clean, 'index.html'))) {
          req.url = `${clean}/index.html${search ? `?${search}` : ''}`
          return next()
        }
        res.statusCode = 404
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(fs.readFileSync(path.join(outDir, '404.html')))
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), posts()],
})
