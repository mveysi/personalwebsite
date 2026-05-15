import OpenAI from 'openai';
import { chunks } from './kb.mjs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

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
    return new Response(JSON.stringify({ error: 'Geçersiz istek.' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: 'Mesaj boş olamaz.' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Sunucu yapılandırma hatası.' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const client = new OpenAI({ apiKey });

  // Determine which chunks to use as context
  let contextChunks;
  const hasEmbeddings = chunks.every((c) => Array.isArray(c.embedding));

  if (hasEmbeddings) {
    // Embed the query and find the 3 most similar chunks
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
    // Fallback: use all chunks (knowledge base is small enough)
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

  const reply = completion.choices[0].message.content;

  return new Response(JSON.stringify({ reply }), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

export const config = { path: '/api/chat' };
