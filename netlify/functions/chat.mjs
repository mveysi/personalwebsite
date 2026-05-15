import OpenAI from 'openai';
import { chunks } from './kb.mjs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// Keyword-based retrieval: score each chunk by how many query words it contains.
// Works without an embeddings API call and is sufficient for a small knowledge base.
function retrieveChunks(query, topK = 4) {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  if (words.length === 0) return chunks;

  const scored = chunks.map((c) => {
    const text = (c.title + ' ' + c.content).toLowerCase();
    const score = words.reduce((acc, w) => acc + (text.includes(w) ? 1 : 0), 0);
    return { chunk: c, score };
  });

  const top = scored.sort((a, b) => b.score - a.score).slice(0, topK);
  // If none matched, return all chunks (fallback)
  return top.some((t) => t.score > 0) ? top.map((t) => t.chunk) : chunks;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  let message, lang;
  try {
    ({ message, lang } = await req.json());
  } catch {
    return jsonResponse({ error: 'Geçersiz istek.' }, 400);
  }

  if (!message?.trim()) {
    return jsonResponse({ error: 'Mesaj boş olamaz.' }, 400);
  }

  const isEn = lang === 'en';

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: 'API anahtarı eksik. Netlify ortam değişkenlerini kontrol edin.' }, 500);
  }

  try {
    const contextChunks = retrieveChunks(message.trim());
    const contextText = contextChunks
      .map((c) => `### ${c.title}\n${c.content}`)
      .join('\n\n');

    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: isEn
            ? `You are a helpful assistant on Muhammet Veysi Kahraman's personal website. Answer visitors' questions in English with a friendly tone. Base your answers only on the information below. For questions not covered in the knowledge base, say "I don't have information on that. You can contact Muhammet Veysi directly."\n\n${contextText}`
            : `Sen Muhammet Veysi Kahraman'ın kişisel web sitesindeki yardımcı bir asistansın. Ziyaretçilerin sorularını Türkçe ve samimi bir dille yanıtlıyorsun. Yanıtlarını yalnızca aşağıdaki bilgilere dayandır. Bilgi tabanında olmayan sorular için "Bu konuda bilgim yok, Muhammet Veysi ile doğrudan iletişime geçebilirsiniz." de.\n\n${contextText}`,
        },
        { role: 'user', content: message.trim() },
      ],
      max_tokens: 512,
      temperature: 0.7,
    });

    return jsonResponse({ reply: completion.choices[0].message.content });
  } catch (err) {
    console.error('[chat] error:', err?.message ?? err);
    const msg = err?.status === 401
      ? 'API anahtarı geçersiz. Netlify ortam değişkenlerini kontrol edin.'
      : `Sunucu hatası: ${err?.message ?? 'Bilinmeyen hata'}`;
    return jsonResponse({ error: msg }, 500);
  }
}
