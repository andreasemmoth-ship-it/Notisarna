import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent'
const MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = 2000

async function callGeminiForHero(articles: Array<any>, apiKey: string): Promise<string> {
  const prompt = `Här är en lista med de 30 senaste nyhetsartiklarna. Välj ut den enskilt viktigaste, mest intressanta eller mest relevanta nyheten för en svensk läsare. Din uppgift är att fatta beslut baserat på nyhetens tyngd och allmänintresse (t.ex. viktiga skatteregelförändringar, stora ekonomiska händelser, stora tekniknyheter framför mindre lokala notiser).

Artiklar:
${JSON.stringify(articles, null, 2)}

Välj ut den viktigaste nyheten och returnera dess exakta "id".`

  let lastError = ''
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) await new Promise(r => setTimeout(r, RETRY_DELAY_MS))

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              featured_id: {
                type: 'STRING',
                description: 'Det exakta ID:t på den valda artikeln.'
              }
            },
            required: ['featured_id']
          },
          temperature: 0.1,
        },
      }),
    })

    if (res.ok) {
      const data = await res.json()
      const rawText: string = (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim()
      if (rawText) {
        try {
          const parsed = JSON.parse(rawText)
          if (parsed?.featured_id) {
            return parsed.featured_id.trim()
          }
        } catch (e) {
          lastError = `Failed to parse JSON response from Gemini: ${rawText}`
        }
      } else {
        lastError = 'Empty response from Gemini'
      }
    } else {
      const errText = await res.text()
      lastError = `Gemini error ${res.status}: ${errText}`
      console.warn(`Attempt ${attempt}/${MAX_ATTEMPTS} failed: ${res.status}`)
      if (res.status !== 503 && res.status !== 429) break
    }
  }
  throw new Error(lastError)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    // ----- Authorization check -----
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '').trim()
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const fallbackAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1enFxdmh1cGd2b2pkZXVpaG9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNDM1OTksImV4cCI6MjA5MzcxOTU5OX0.xwJik8yUoCbntl9X0_Ces0y4A_FDJyi9Ah3sOZy7FNQ'
    if (token !== anonKey && token !== serviceKey && token !== fallbackAnonKey) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const geminiKey   = Deno.env.get('GEMINI_API_KEY')!

    const db = createClient(supabaseUrl, supabaseKey)

    // Hämta 30 senaste artiklarna sorterat efter publiceringsdatum
    const { data: articles, error: fetchErr } = await db
      .from('news_articles')
      .select('id, headline, summary, source, category')
      .order('published_at', { ascending: false })
      .limit(30)

    if (fetchErr) throw fetchErr

    if (!articles || articles.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: 'No articles found in database' }),
        { headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // Skapa en kompakt lista för Gemini (max 150 tecken för sammanfattningar för att spara tokens)
    const compactArticles = articles.map(a => ({
      id: a.id,
      headline: a.headline,
      source: a.source,
      category: a.category,
      summary: (a.summary ?? '').slice(0, 150)
    }))

    // Anropa Gemini för att välja ut viktigaste ID:t
    const featuredId = await callGeminiForHero(compactArticles, geminiKey)

    // Validera att ID:t faktiskt matchar en artikel i vår lista
    const selectedArticleExists = articles.some(a => a.id === featuredId)
    if (!selectedArticleExists) {
      throw new Error(`Gemini returned a non-existent article ID: ${featuredId}`)
    }

    // Uppdatera databasen
    // 1. Nollställ befintliga featured
    const { error: resetErr } = await db
      .from('news_articles')
      .update({ featured: false })
      .eq('featured', true)

    if (resetErr) throw resetErr

    // 2. Sätt den utvalda artikeln till featured = true
    const { error: updateErr } = await db
      .from('news_articles')
      .update({ featured: true })
      .eq('id', featuredId)

    if (updateErr) throw updateErr

    // Hämta den valda artikelns rubrik för logg/response
    const selectedTitle = articles.find(a => a.id === featuredId)?.headline ?? ''

    console.log(`Successfully selected new hero: [${featuredId}] ${selectedTitle}`)

    return new Response(
      JSON.stringify({ ok: true, featured_id: featuredId, headline: selectedTitle }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error(err)
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
