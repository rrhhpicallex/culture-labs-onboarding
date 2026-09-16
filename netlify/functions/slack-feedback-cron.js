// Corre solo una vez por día (ver schedule en netlify.toml). Busca a quién le
// cae hoy exactamente el día 15 desde su fecha de ingreso, le manda un DM de
// Slack avisándole que ya puede completar la encuesta de feedback de la
// primera semana, y marca la fila para no volver a mandarle el mismo aviso.
//
// Usa el SERVICE ROLE key de Supabase (no la anon key): esta función corre en
// el servidor sin una sesión de usuario detrás, así que necesita saltarse RLS
// para poder leer/actualizar el perfil de cualquier persona. El service role
// key nunca debe usarse en index.html ni en ningún código que llegue al navegador.

const { findSlackIdByName } = require('./_slackDirectory');

const FEEDBACK_UNLOCK_DAYS = 15;

function todayMinusDays(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

exports.handler = async () => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SLACK_BOT_TOKEN, SUPABASE_SCHEMA } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SLACK_BOT_TOKEN) {
    console.error('[slack-feedback-cron] Faltan env vars: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SLACK_BOT_TOKEN');
    return { statusCode: 500, body: 'Faltan env vars' };
  }
  const schema = SUPABASE_SCHEMA || 'onboarding';
  const targetDate = todayMinusDays(FEEDBACK_UNLOCK_DAYS);

  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };

  let rows = [];
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/onboarding_profiles?start_date=eq.${targetDate}&feedback_reminder_sent_at=is.null&select=device_id,name,start_date`,
      { headers: { ...headers, 'Accept-Profile': schema } }
    );
    if (!res.ok) {
      console.error('[slack-feedback-cron] Error consultando profiles:', res.status, await res.text());
      return { statusCode: 502, body: 'Error consultando Supabase' };
    }
    rows = await res.json();
  } catch (e) {
    console.error('[slack-feedback-cron] Fallo de red consultando Supabase:', e.message);
    return { statusCode: 502, body: 'Fallo de red' };
  }

  console.log(`[slack-feedback-cron] ${rows.length} persona(s) cumplen 15 días hoy (${targetDate}).`);

  const results = [];
  for (const p of rows) {
    if (!p.name) { results.push({ device_id: p.device_id, skipped: 'sin nombre' }); continue; }
    const slackId = findSlackIdByName(p.name);
    if (!slackId) { results.push({ name: p.name, skipped: 'sin slack id en el organigrama' }); continue; }

    const firstName = p.name.split(' ')[0];
    const text = `¡Hola ${firstName}! 👋 Ya se habilitó tu encuesta de feedback de tus primeros 15 días en Culture Labs — entrá a la plataforma y buscá el módulo "Feedback de tu primera semana": https://culturelab-pcx.netlify.app ¡Gracias por completarla! 💌`;

    try {
      const openRes = await fetch('https://slack.com/api/conversations.open', {
        method: 'POST',
        headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: slackId }),
      });
      const openData = await openRes.json();
      if (!openData.ok) { results.push({ name: p.name, error: 'conversations.open: ' + openData.error }); continue; }

      const msgRes = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: openData.channel.id, text }),
      });
      const msgData = await msgRes.json();
      if (!msgData.ok) { results.push({ name: p.name, error: 'chat.postMessage: ' + msgData.error }); continue; }

      await fetch(`${SUPABASE_URL}/rest/v1/onboarding_profiles?device_id=eq.${p.device_id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Profile': schema, Prefer: 'return=minimal' },
        body: JSON.stringify({ feedback_reminder_sent_at: new Date().toISOString() }),
      });

      results.push({ name: p.name, sent: true });
    } catch (e) {
      results.push({ name: p.name, error: e.message });
    }
  }

  console.log('[slack-feedback-cron] Resultado:', JSON.stringify(results));
  return { statusCode: 200, body: JSON.stringify({ targetDate, results }) };
};
