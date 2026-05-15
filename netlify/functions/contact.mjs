import { neon } from '@neondatabase/serverless';

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

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  let name, email, message;
  try {
    ({ name, email, message } = await req.json());
  } catch {
    return jsonResponse({ error: 'Geçersiz istek.' }, 400);
  }

  name    = name?.trim();
  email   = email?.trim();
  message = message?.trim();

  if (!name || !email || !message) {
    return jsonResponse({ error: 'Tüm alanlar zorunludur.' }, 400);
  }
  if (!isValidEmail(email)) {
    return jsonResponse({ error: 'Geçersiz e-posta adresi.' }, 400);
  }
  if (name.length > 255 || email.length > 255 || message.length > 2000) {
    return jsonResponse({ error: 'Girilen değerler çok uzun.' }, 400);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return jsonResponse({ error: 'Veritabanı bağlantısı yapılandırılmamış.' }, 500);
  }

  try {
    const sql = neon(dbUrl);

    await sql`
      CREATE TABLE IF NOT EXISTS contacts (
        id         SERIAL PRIMARY KEY,
        name       VARCHAR(255) NOT NULL,
        email      VARCHAR(255) NOT NULL,
        message    TEXT         NOT NULL,
        created_at TIMESTAMPTZ  DEFAULT NOW()
      )
    `;

    await sql`
      INSERT INTO contacts (name, email, message)
      VALUES (${name}, ${email}, ${message})
    `;

    return jsonResponse({ success: true });
  } catch (err) {
    console.error('[contact] db error:', err?.message ?? err);
    return jsonResponse({ error: 'Mesaj gönderilemedi. Lütfen tekrar deneyin.' }, 500);
  }
}
