import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabaseUrl  = Deno.env.get('SUPABASE_URL')!
    const supabaseKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const geminiKey    = Deno.env.get('GEMINI_API_KEY')!

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
      'Fokusera på det viktigaste och mest relevanta. Skriv koncist och informativt. ' +
      'Använd • som listpunkt och skriv varje punkt på en ny rad.\n\n' +
      `Artiklar:\n${articleList}\n\nSammanfattning:`

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1024, temperature: 0.4 },
        }),
      }
    )

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      throw new Error(`Gemini error ${geminiRes.status}: ${errText}`)
    }

    const geminiData = await geminiRes.json()
    const content: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    if (!content) throw new Error('Empty response from Gemini')

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
