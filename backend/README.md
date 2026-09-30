# Backend

Backend app ini adalah Supabase (Postgres) — tidak ada server/API custom yang
perlu di-hosting sendiri; frontend bicara langsung ke Supabase pakai
`@supabase/supabase-js`.

## Database: tabel per kolom

Setiap data bisnis = tabel sungguhan dengan kolom sungguhan (bukan JSON
`key/data`). Item bersarang (item invoice, item PO, mutasi kas, dst.) = tabel
anak sendiri. Definisi tabel ada di **satu file**:
`../frontend/src/lib/db/spec.json` — dipakai frontend (mapping baris ⇄ objek)
sekaligus generator SQL.

Urutan menjalankan di Supabase Dashboard → SQL Editor:

1. `supabase/schema.sql` — buat tabel, RLS, realtime, storage bucket, fungsi
   `replace_children`. Aman diulang. Kalau ada tabel skema lama (key/data),
   otomatis diganti nama jadi `legacy_<nama>` (tidak dihapus).
2. `supabase/migrate_from_legacy.sql` — (opsional) pindahkan data dari tabel
   `legacy_*` ke tabel baru. Aman diulang.
3. `supabase/audit_log.sql` — jejak perubahan (PIN tersamarkan).
4. Deploy ulang edge function: `supabase functions deploy send-push`
   (sekarang membaca kolom biasa, bukan JSON).

Mau nambah/ubah kolom? Edit `frontend/src/lib/db/spec.json`, lalu:

```
node backend/supabase/generate-schema.mjs   # tulis ulang schema.sql & migrate_from_legacy.sql
```

dan jalankan `schema.sql` lagi (menambah kolom yang belum ada, tidak menghapus data).
