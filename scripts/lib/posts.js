// Läser artiklar (Markdown med YAML-frontmatter) från src/content/posts/.
// Används av byggskriptet, llms.txt-skriptet och Vite-pluginet i vite.config.js.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const POSTS_DIR = path.join(ROOT, 'src', 'content', 'posts')

function splitFrontmatter(text, file) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) throw new Error(`${file}: saknar frontmatter (--- … ---)`)
  return { data: parseYaml(match[1]) ?? {}, body: match[2] }
}

// YAML läser 2026-10-19 som sträng (core-schema), men säkra upp ändå.
function toDate(value) {
  if (!value) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).trim()
}

function toBool(value) {
  return value === true || value === 'true'
}

// Källor anges som lista under `kallor`. Varje post är antingen en sträng
// (text eller URL) eller { titel, url }. Äldre artiklar använder
// source_title_N/source_url_N och source_title/source_url.
function normalizeSources(data) {
  const sources = []
  for (const item of data.kallor ?? []) {
    if (typeof item === 'string') {
      sources.push(/^https?:\/\//.test(item) ? { title: item, url: item } : { title: item, url: '' })
    } else if (item && typeof item === 'object') {
      const url = item.url ?? ''
      sources.push({ title: item.titel ?? item.title ?? url, url })
    }
  }
  for (let i = 1; data[`source_url_${i}`]; i++) {
    sources.push({ title: data[`source_title_${i}`] || data[`source_url_${i}`], url: data[`source_url_${i}`] })
  }
  if (data.source_url) sources.push({ title: data.source_title || data.source_url, url: data.source_url })
  return sources
}

function normalize(file, text) {
  const { data, body } = splitFrontmatter(text, file)
  const slug = String(data.slug || path.basename(file, '.md'))
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`${file}: ogiltig slug "${slug}" (använd a–z, 0–9 och bindestreck)`)
  }
  const datum = toDate(data.datum ?? data.date)
  return {
    file,
    slug,
    titel: String(data.titel ?? data.title ?? '').trim(),
    beskrivning: String(data.beskrivning ?? data.description ?? '').trim(),
    datum,
    senastGranskad: toDate(data.senastGranskad) || datum,
    publicerad: toBool(data.publicerad),
    video: data.video ? String(data.video).trim() : '',
    affiliate: toBool(data.affiliate),
    kallor: normalizeSources(data),
    bild: String(data.bild ?? data.image ?? '').trim(),
    body,
  }
}

// Alla artiklar, senaste först. Opublicerade ingår; filtrera med publishedPosts().
export function loadPosts(dir = POSTS_DIR) {
  const posts = fs.readdirSync(dir)
    .filter(file => file.endsWith('.md'))
    .map(file => normalize(file, fs.readFileSync(path.join(dir, file), 'utf-8')))

  const seen = new Map()
  for (const post of posts) {
    if (seen.has(post.slug)) throw new Error(`Dubblett av slug "${post.slug}" i ${seen.get(post.slug)} och ${post.file}`)
    seen.set(post.slug, post.file)
    if (post.publicerad) {
      if (!post.titel) throw new Error(`${post.file}: titel saknas`)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(post.datum)) throw new Error(`${post.file}: datum måste vara ÅÅÅÅ-MM-DD`)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(post.senastGranskad)) throw new Error(`${post.file}: senastGranskad måste vara ÅÅÅÅ-MM-DD`)
    }
  }

  return posts.sort((a, b) => b.datum.localeCompare(a.datum) || a.slug.localeCompare(b.slug))
}

// Endast artiklar med `publicerad: true` visas, byggs och hamnar i sitemap.
export function publishedPosts(dir = POSTS_DIR) {
  return loadPosts(dir).filter(post => post.publicerad)
}
