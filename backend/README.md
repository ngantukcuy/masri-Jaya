# Backend

Backend app ini adalah Supabase (Postgres) — tidak ada server/API custom yang
perlu di-hosting sendiri; frontend bicara langsung ke Supabase pakai
`@supabase/supabase-js`.

- `supabase/schema.sql` — satu-satunya file yang perlu dijalankan. Berisi
  semua tabel per-entitas dan tabel singleton, RLS policy, grant Data API, setup Realtime, dan
  storage bucket `product-images`. Lihat `../SUPABASE_SETUP.md` untuk
  langkah lengkapnya.

