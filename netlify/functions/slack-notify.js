// Envía un DM de Slack a una persona puntual, disparado desde el Panel HR.
// El SLACK_BOT_TOKEN vive solo acá (variable de entorno de Netlify) — nunca
// llega al navegador. Antes de mandar nada, valida que quien llama tenga una
// sesión de Supabase real y sea una de las cuentas de HR.

const HR_EMAILS = ['georgina@picallex.com', 'zoe@picallex.com'];

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { SUPABASE_URL, SUPABASE_ANON_KEY, SLACK_BOT_TOKEN } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SLACK_BOT_TOKEN) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Faltan env vars en el servidor (SUPABASE_URL / SUPABASE_ANON_KEY / SLACK_BOT_TOKEN).' }) };
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

  if (!HR_EMAILS.includes(email)) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Tu cuenta no tiene permiso para enviar mensajes de Slack.' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body inválido.' }) };
  }
  const { slackId, text } = payload;
  if (!slackId || typeof slackId !== 'string' || !/^[UW][A-Z0-9]{6,}$/.test(slackId) || !text) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Falta slackId (Slack member ID) o text.' }) };
  }

  try {
    const openRes = await fetch('https://slack.com/api/conversations.open', {
      method: 'POST',
      headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ users: slackId }),
    });
    const openData = await openRes.json();
    if (!openData.ok) {
      return { statusCode: 502, body: JSON.stringify({ error: 'Slack conversations.open: ' + openData.error }) };
    }

    const msgRes = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: openData.channel.id, text }),
    });
    const msgData = await msgRes.json();
    if (!msgData.ok) {
      return { statusCode: 502, body: JSON.stringify({ error: 'Slack chat.postMessage: ' + msgData.error }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: 'Fallo de red hablando con Slack: ' + e.message }) };
  }
};
