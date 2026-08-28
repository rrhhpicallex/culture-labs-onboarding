# Culture Labs PCX — Onboarding & AI Diagnostic

## Stack & Despliegue
- **Tecnología:** Vanilla JS (HTML5, CSS3, JS nativo) — todo vive en `index.html`.
- **Repo:** GitHub (`rrhhpicallex/culture-labs-onboarding`).
- **Deploy:** Netlify (`culturelab-pcx.netlify.app`).

## Estándar ED 2026 & Diagnóstico IA
- **Pesos ED:** 30% Hard, 35% Soft, 35% Strategic.
- **Escala N:** N1 (Reactivo / Perfil Tradicional, `N < 2.6`), N2 (Integrado / Perfil Eficiente, `2.6 ≤ N ≤ 3.5`), N3 (Impacto Colectivo / Perfil Innovador, `N > 3.5`). Ver `aiProfileFromScore()` en `index.html`.
- **Diagnóstico:** 5 preguntas (`AI_DIAGNOSTIC_QUESTIONS`) + 5 evidencias obligatorias (`textarea`). Una vez enviado (`submitAiDiagnostic()`), queda bloqueado — no editable.
- **Base de datos:** Tabla `ai_diagnostics` en Supabase — columnas `user_id`, `score_n`, `n_level`, `profile_label`, `tooltip_text`, `responses` (JSONB), `avatar_config` (JSONB), `created_at`. Se escribe vía `handleSaveToSupabase()` (API REST nativa de Supabase, sin SDK).
- **Config Supabase:** constantes `SUPABASE_URL` / `SUPABASE_ANON_KEY` al inicio del bloque de diagnóstico en `index.html` — deben tener la URL y anon key reales del proyecto para que el insert funcione.
