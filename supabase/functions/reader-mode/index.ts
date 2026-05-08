import { Readability } from 'https://esm.sh/@mozilla/readability@0.5.0'
import { DOMParser } from 'https://deno.land/x/deno_dom@v0.1.48/deno-dom-wasm.ts'

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const url = new URL(req.url).searchParams.get('url')
  if (!url) return json({ error: 'Saknad url-parameter' }, 400)

  let html: string
  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'sv,en;q=0.9',
      },
    })
    if (!resp.ok) {
      return json({ error: `Servern svarade med ${resp.status}`, blocked: true })
    }
    html = await resp.text()
  } catch (err) {
    return json({ error: String(err), blocked: true })
  }

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const reader = new Readability(doc as unknown as Document)
    const article = reader.parse()
    if (!article) {
      return json({ error: 'Kunde inte extrahera artikelinnehåll', blocked: false })
    }
    return json({ title: article.title, byline: article.byline, content: article.content })
  } catch (err) {
    return json({ error: String(err), blocked: false })
  }
})
