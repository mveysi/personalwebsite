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

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  let message;
  try {
    ({ message } = await req.json());
  } catch {
    return jsonResponse({ error: 'Geçersiz istek.' }, 400);
  }

  if (!message?.trim()) {
    return jsonResponse({ error: 'Mesaj boş olamaz.' }, 400);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: 'API anahtarı eksik. Netlify ortam değişkenlerini kontrol edin.' }, 500);
  }

  try {
    const client = new OpenAI({ apiKey });

    const hasEmbeddings = chunks.every((c) => Array.isArray(c.embedding));
    let contextChunks;

    if (hasEmbeddings) {
      const embedRes = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: message.trim(),
      });
      const queryVec = embedRes.data[0].embedding;

      contextChunks = [...chunks]
        .map((c) => ({ ...c, score: cosineSimilarity(queryVec, c.embedding) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
    } else {
      contextChunks = chunks;
    }

    const contextText = contextChunks
      .map((c) => `### ${c.title}\n${c.content}`)
      .join('\n\n');

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Sen Muhammet Veysi Kahraman'ın kişisel web sitesindeki yardımcı bir asistansın. Ziyaretçilerin sorularını Türkçe ve samimi bir dille yanıtlıyorsun. Yanıtlarını yalnızca aşağıdaki bilgilere dayandır. Bilgi tabanında olmayan sorular için "Bu konuda bilgim yok, Muhammet Veysi ile doğrudan iletişime geçebilirsiniz." de.\n\n${contextText}`,
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
