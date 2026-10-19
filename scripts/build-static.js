// Körs efter `vite build`. Skriver statiska HTML-sidor till dist/ så att
// artiklarna går att läsa och indexera utan JavaScript:
//   dist/artiklar/index.html          artikellistan
//   dist/artiklar/<slug>/index.html   en sida per publicerad artikel
//   dist/404.html, dist/sitemap.xml
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { publishedPosts } from './lib/posts.js'
import { articleUrl, renderArticlePage, renderArticlesIndex, renderNotFound, renderSitemap } from './lib/render.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')

// CSS-filen får ett hashat namn av Vite; hämta länken från den byggda startsidan.
function headAssetsFrom(indexHtml) {
  const links = indexHtml.match(/<link rel="stylesheet"[^>]*href="\/assets\/[^"]+\.css"[^>]*>/g)
  if (!links) throw new Error('Hittade ingen CSS-länk i dist/index.html')
  return links.join('\n  ')
}

// Korta länkar i vercel.json (t.ex. /flyg) ska peka på en publicerad artikel.
function checkShortLinks(posts) {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf-8'))
  const slugs = new Set(posts.map(post => post.slug))
  for (const { source, destination, has } of config.redirects ?? []) {
    const slug = !has && destination.match(/^\/artiklar\/([a-z0-9-]+)$/)?.[1]
    if (slug && !slugs.has(slug)) {
      console.warn(`Varning: kortlänken ${source} pekar på /artiklar/${slug}, som inte är en publicerad artikel.`)
    }
  }
}

function write(relPath, content) {
  const file = path.join(DIST, relPath)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

function build() {
  const indexHtml = fs.readFileSync(path.join(DIST, 'index.html'), 'utf-8')
  const headAssets = headAssetsFrom(indexHtml)
  const posts = publishedPosts()
  checkShortLinks(posts)

  write('artiklar/index.html', renderArticlesIndex(posts, { headAssets }))
  for (const post of posts) {
    write(`artiklar/${post.slug}/index.html`, renderArticlePage(post, { headAssets }))
  }
  write('404.html', renderNotFound({ headAssets }))

  const today = new Date().toISOString().slice(0, 10)
  write('sitemap.xml', renderSitemap([
    { path: '/', lastmod: today },
    { path: '/artiklar', lastmod: posts[0]?.senastGranskad },
    ...posts.map(post => ({ path: articleUrl(post.slug), lastmod: post.senastGranskad })),
  ]))

  console.log(`Statiska sidor: ${posts.length} artiklar, artikellista, 404 och sitemap.xml`)
}

build()
