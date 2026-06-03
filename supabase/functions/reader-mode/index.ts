import { Readability } from 'https://esm.sh/@mozilla/readability@0.5.0'
import { DOMParser } from 'https://deno.land/x/deno_dom@v0.1.48/deno-dom-wasm.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

// ----- In-memory rate limiter (per user, per function instance) -----
// Gräns: 30 anrop / minut per användare
const RATE_LIMIT    = 30
const WINDOW_MS     = 60_000
const rateMap       = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(userId: string): boolean {
  const now   = Date.now()
  const entry = rateMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateMap.set(userId, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  if (entry.count >= RATE_LIMIT) return true
  entry.count++
  return false
}

// ----- SSRF-skydd: blockera interna adresser -----
function isPrivateUrl(url: URL): boolean {
  const h = url.hostname
  return (
    h === 'localhost' ||
    h === '0.0.0.0' ||
    h.endsWith('.local') ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^169\.254\./.test(h) || // link-local
    h === '::1'
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // ----- JWT-validering: kräver giltig Supabase-session -----
  const authHeader = req.headers.get('Authorization') ?? ''
  const token      = authHeader.replace('Bearer ', '').trim()
  if (!token) return json({ error: 'Unauthorized' }, 401)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

  // ----- Rate limiting -----
  if (isRateLimited(user.id)) {
    return json({ error: 'För många anrop – försök igen om en minut' }, 429)
  }

  // ----- URL-validering & SSRF-skydd -----
  const rawUrl = new URL(req.url).searchParams.get('url')
  if (!rawUrl) return json({ error: 'Saknad url-parameter' }, 400)

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return json({ error: 'Ogiltig URL-format' }, 400)
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return json({ error: 'Endast http/https tillåtet' }, 400)
  }
  if (isPrivateUrl(parsed)) {
    return json({ error: 'Intern URL ej tillåten' }, 400)
  }

  // ----- Hämta och tolka artikel -----
  let html: string
  try {
    const resp = await fetch(parsed.toString(), {
      signal: AbortSignal.timeout(10_000),
      headers: {
        'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'sv,en;q=0.9',
      },
    })
    if (!resp.ok) return json({ error: `Servern svarade med ${resp.status}`, blocked: true })
    html = await resp.text()
  } catch (err) {
    return json({ error: String(err), blocked: true })
  }

  try {
    const doc     = new DOMParser().parseFromString(html, 'text/html')
    const reader  = new Readability(doc as unknown as Document)
    const article = reader.parse()
    if (!article) return json({ error: 'Kunde inte extrahera artikelinnehåll', blocked: false })
    return json({ title: article.title, byline: article.byline, content: article.content })
  } catch (err) {
    return json({ error: String(err), blocked: false })
  }
})
