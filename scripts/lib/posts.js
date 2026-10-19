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
// (text eller URL) eller { titel, url }.
function normalizeSources(data) {
  return (data.kallor ?? []).map(item => {
    if (typeof item === 'string') {
      return /^https?:\/\//.test(item) ? { title: item, url: item } : { title: item, url: '' }
    }
    const url = String(item?.url ?? '')
    return { title: String(item?.titel ?? url), url }
  }).filter(src => src.title)
}

// Gör om en länk till en TikTok- eller YouTube-video till en inbäddningsadress.
export function parseVideo(url) {
  let u
  try { u = new URL(url) } catch { return null }
  const host = u.hostname.replace(/^(www|m)\./, '')
  if (host === 'tiktok.com') {
    const id = u.pathname.match(/\/video\/(\d+)/)?.[1]
    return id ? { platform: 'TikTok', url, embed: `https://www.tiktok.com/player/v1/${id}?autoplay=1&rel=0` } : null
  }
  let id = null
  if (host === 'youtu.be') id = u.pathname.slice(1)
  else if (host === 'youtube.com') id = u.pathname.match(/^\/(?:shorts|embed)\/([\w-]+)/)?.[1] ?? u.searchParams.get('v')
  if (id && /^[\w-]{6,}$/.test(id)) {
    return { platform: 'YouTube', url, embed: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0` }
  }
  return null
}

function normalize(file, text) {
  const { data, body } = splitFrontmatter(text, file)
  const slug = String(data.slug || path.basename(file, '.md'))
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`${file}: ogiltig slug "${slug}" (använd a–z, 0–9 och bindestreck)`)
  }
  const datum = toDate(data.datum)
  return {
    file,
    slug,
    titel: String(data.titel ?? '').trim(),
    beskrivning: String(data.beskrivning ?? '').trim(),
    datum,
    senastGranskad: toDate(data.senastGranskad) || datum,
    publicerad: toBool(data.publicerad),
    video: data.video ? String(data.video).trim() : '',
    affiliate: toBool(data.affiliate),
    kallor: normalizeSources(data),
    bild: String(data.bild ?? '').trim(),
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
      if (!post.beskrivning) throw new Error(`${post.file}: beskrivning saknas`)
      if (post.video && !parseVideo(post.video)) {
        throw new Error(`${post.file}: video måste vara en fullständig TikTok-länk (…/video/<id>) eller YouTube-länk`)
      }
    }
  }

  return posts.sort((a, b) => b.datum.localeCompare(a.datum) || a.slug.localeCompare(b.slug))
}

// Endast artiklar med `publicerad: true` visas, byggs och hamnar i sitemap.
export function publishedPosts(dir = POSTS_DIR) {
  return loadPosts(dir).filter(post => post.publicerad)
}
