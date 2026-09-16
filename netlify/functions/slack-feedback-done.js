// Avisa por Slack a Zoé y Georgina cuando alguien marca "Ya la completé" en
// la encuesta de feedback de sus primeros 15 días.
//
// A diferencia de slack-notify.js (que solo puede usar HR), acá quien llama
// es la persona que acaba de completar la encuesta — por eso el destino y el
// texto del mensaje están fijos en el servidor: cualquier cuenta @picallex.com
// autenticada puede disparar este aviso, pero nunca puede elegir a quién le
// llega ni qué texto lleva.

const HR_SLACK_IDS = {
  'Zoé Natera': 'U04URJBBZ8F',
  'Georgina Zunino': 'U018S9LBF47',
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { SUPABASE_URL, SUPABASE_ANON_KEY, SLACK_BOT_TOKEN } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SLACK_BOT_TOKEN) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Faltan env vars en el servidor.' }) };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Falta el token de sesión.' }) };
  }

  let email = '';
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    });
    if (!userRes.ok) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Sesión inválida o expirada.' }) };
    }
    const user = await userRes.json();
    email = (user.email || '').toLowerCase();
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: 'No se pudo validar la sesión con Supabase.' }) };
  }

  if (!email.endsWith('@picallex.com')) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Solo cuentas @picallex.com pueden usar esto.' }) };
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    // body vacío o inválido: seguimos igual, usamos el email como respaldo del nombre.
  }
  const name = (payload.name || email.split('@')[0] || 'Alguien').toString().slice(0, 80);
  const text = `✅ *${name}* completó la encuesta de feedback de sus primeros 15 días en Culture Labs.`;

  const results = [];
  for (const [hrName, slackId] of Object.entries(HR_SLACK_IDS)) {
    try {
      const openRes = await fetch('https://slack.com/api/conversations.open', {
        method: 'POST',
        headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: slackId }),
      });
      const openData = await openRes.json();
      if (!openData.ok) { results.push({ hrName, error: openData.error }); continue; }

      const msgRes = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: openData.channel.id, text }),
      });
      const msgData = await msgRes.json();
      results.push({ hrName, ok: msgData.ok, error: msgData.ok ? undefined : msgData.error });
    } catch (e) {
      results.push({ hrName, error: e.message });
    }
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true, results }) };
};
