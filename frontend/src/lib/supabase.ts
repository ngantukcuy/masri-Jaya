// Supabase client initialization.
// All values come from environment variables (see .env.example) so real
// credentials never get committed to the repo. Fill in frontend/.env with
// the values from your Supabase project settings (see SUPABASE_SETUP.md).
import { createClient } from '@supabase/supabase-js';

const readEnvValue = (key: string) =>
  String(import.meta.env[key] ?? '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/,$/, '');

const supabaseUrl = readEnvValue('VITE_SUPABASE_URL');
const supabaseKey = readEnvValue('VITE_SUPABASE_PUBLISHABLE_KEY');

const requiredConfigKeys = { supabaseUrl, supabaseKey };
const missingConfig = Object.entries(requiredConfigKeys)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingConfig.length) {
  console.error(
    `[supabase] Konfigurasi Supabase belum lengkap (${missingConfig.join(', ')}). Cek file frontend/.env, pastikan nilainya benar, lalu restart npm run dev.`
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      // Every request carries the name of whoever is currently logged in
      // (see setAuditActorName below). The `audit_log_row_change` trigger
      // (backend/supabase/audit_log.sql) reads this header back out via
      // PostgREST's `request.headers` GUC and stores it as `actor_name` on
      // every row it logs — this is how "siapa mengedit apa" is captured
      // even though every staff member shares the same anonymous Supabase
      // auth session (see SUPABASE_SETUP.md).
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (currentActorName) headers.set('X-Actor-Name', currentActorName);
        return fetch(input, { ...init, headers });
      },
    },
  }
);

// Mutable module-level actor name — updated on login/logout (App.tsx) and
// read fresh on every request by the custom `fetch` above. A plain
// variable (not React state) on purpose: this file has no component
// lifecycle, and every Supabase call anywhere in the app should pick up
// the latest value immediately.
let currentActorName: string | null = null;
export function setAuditActorName(name: string | null) {
  currentActorName = name;
}

// This app doesn't have real user accounts yet (LoginView.tsx does a local
// PIN check, not Supabase Auth). Row Level Security still requires *some*
// signed-in user though, so we sign in anonymously in the background as
// soon as the app loads. See SUPABASE_SETUP.md for how to enable the
// "Anonymous sign-ins" provider in the Supabase dashboard — without that
// step every read/write will fail with a permission error.
if (!missingConfig.length) {
  supabase.auth.getSession().then(({ data }) => {
    if (!data.session) {
      supabase.auth.signInAnonymously().catch((err) => {
        console.error(
          '[supabase] Anonymous sign-in gagal. Pastikan "Allow anonymous sign-ins" sudah diaktifkan di Supabase Dashboard > Authentication > Sign In / Providers.',
          err
        );
      });
    }
  });
}
