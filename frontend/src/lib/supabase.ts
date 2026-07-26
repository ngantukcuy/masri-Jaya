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
  }
);

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
