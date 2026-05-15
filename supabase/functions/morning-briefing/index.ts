import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent'
const MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = 5000

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  let lastError = ''
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) await new Promise(r => setTimeout(r, RETRY_DELAY_MS))

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1024, temperature: 0.4 },
      }),
    })

    if (res.ok) {
      const data = await res.json()
      const candidate = data?.candidates?.[0]
      const rawText: string = (candidate?.content?.parts?.[0]?.text ?? '').trim()
      const finishReason: string = candidate?.finishReason ?? ''
      if (rawText) {
        if (finishReason === 'MAX_TOKENS') {
          const lastBullet = rawText.lastIndexOf('\n•')
          return lastBullet > 0 ? rawText.slice(0, lastBullet).trim() : rawText
        }
        return rawText
      }
      lastError = 'Empty response from Gemini'
    } else {
      const errText = await res.text()
      lastError = `Gemini error ${res.status}: ${errText}`
      console.warn(`Attempt ${attempt}/${MAX_ATTEMPTS} failed: ${res.status}`)
      // Only retry on 503/429 (overload/rate-limit), not on 4xx auth errors
      if (res.status !== 503 && res.status !== 429) break
    }
  }
  throw new Error(lastError)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const geminiKey   = Deno.env.get('GEMINI_API_KEY')!

    const db = createClient(supabaseUrl, supabaseKey)

    const { data: articles, error: fetchErr } = await db
      .from('news_articles')
      .select('headline, source, category, published_at')
      .order('published_at', { ascending: false })
      .limit(20)

    if (fetchErr) throw fetchErr

    const articleList = (articles ?? []).map((a, i) =>
      `${i + 1}. [${a.category}] ${a.headline} — ${a.source}`
    ).join('\n')

    const prompt =
      'Du är en personlig nyhetsassistent. Sammanfatta dessa nyheter på svenska i 4–5 korta punkter. ' +
      'Fokusera på det viktigaste och mest relevanta. Skriv koncist och informativt. Avsluta alltid varje punkt med en fullständig mening. ' +
      'Använd • som listpunkt och skriv varje punkt på en ny rad.\n\n' +
      `Artiklar:\n${articleList}\n\nSammanfattning:`

    const content = await callGemini(prompt, geminiKey)

    const today = new Date().toISOString().slice(0, 10)
    const { error: saveErr } = await db
      .from('briefings')
      .upsert({ date: today, content, created_at: new Date().toISOString() }, { onConflict: 'date' })

    if (saveErr) throw saveErr

    return new Response(
      JSON.stringify({ ok: true, date: today, chars: content.length }),
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
