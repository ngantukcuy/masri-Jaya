# Setup Supabase (dari Nol)

Panduan ini buat nyambungin project Tokku ke Supabase (Postgres), gantiin
Firestore yang dipakai sebelumnya. Struktur datanya sengaja dibikin mirip
biar migrasinya simpel dan gak perlu nulis ulang semua fungsi CRUD yang
sudah ada.

## 1. Bikin Project Supabase

1. Buka https://supabase.com/dashboard
2. Klik **"New project"**
3. Pilih organisasi (atau bikin baru), isi:
   - **Name**: misal `tokku-pos`
   - **Database Password**: generate & simpan baik-baik (dibutuhkan kalau nanti connect langsung ke Postgres-nya)
   - **Region**: pilih yang paling deket, misal `Southeast Asia (Singapore)`
4. Klik **Create new project**, tunggu ~2 menit sampai provisioning selesai

## 2. Jalankan SQL Schema

1. Di sidebar kiri, klik **SQL Editor**
2. Klik **New query**
3. Copy seluruh isi file [`backend/supabase/schema.sql`](backend/supabase/schema.sql) dari project ini, paste ke editor
4. Klik **Run** (atau `Ctrl`/`Cmd` + `Enter`)
5. Harusnya muncul **"Success. No rows returned"** — ini otomatis bikin tabel `tokku_state`, storage bucket `product-images`, plus semua RLS policy, grant, dan Realtime publication yang dibutuhkan sekaligus.

> **Catatan:** per pertengahan 2026, project Supabase baru tidak lagi otomatis
> mengekspos tabel baru ke Data API (yang dipakai `supabase-js`) — walaupun
> RLS-nya sudah benar, tanpa `GRANT` eksplisit request bakal ditolak dengan
> error `permission denied for table tokku_state`. `schema.sql` udah nanganin
> ini otomatis, jadi gak perlu action tambahan apapun di dashboard soal ini.

## 3. Aktifkan Anonymous Sign-in

App ini belum punya sistem login penuh (login masih PIN lokal), tapi RLS
tetap butuh user yang "signed-in". Makanya app-nya otomatis sign-in anonim
di background (lihat `frontend/src/lib/supabase.ts`).

1. Sidebar kiri, klik **Authentication > Sign In / Providers**
2. Cari **"Anonymous Sign-Ins"**, aktifkan togglenya, save

> Kalau langkah ini kelewat, nanti muncul error permission di console pas
> app dibuka, dan data gak bakal kesimpen.

## 4. Ambil API URL & Key

1. Sidebar kiri, klik ikon gear ⚙️ **Project Settings > API Keys**
2. Copy **Project URL**
3. Di bagian key, copy **Publishable key** (formatnya `sb_publishable_...`).
   Kalau project kamu masih nunjukkin tampilan lama (**Legacy API Keys**),
   pakai key **`anon` `public`** di situ — dua-duanya sama-sama valid buat
   dipakai di frontend, `createClient()` menerima keduanya tanpa perbedaan.
4. **Jangan pernah** pakai **Secret key** / `service_role key` di frontend —
   itu buat kode server aja, soalnya bisa bypass semua RLS policy.

## 5. Isi File `.env`

1. Copy `frontend/.env.example` jadi `frontend/.env`
2. Isi:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxx
```

`.env` udah ada di `.gitignore`, jadi aman gak ke-commit / gak ke-share pas
kamu push ke GitHub.

## 6. Storage buat Foto Produk (otomatis)

Bucket `product-images` udah dibikin otomatis sama `schema.sql` di langkah 2
(public read, upload wajib login, maksimal 5MB, cuma nerima file gambar).
Gak ada setup manual tambahan.

## 7. Install & Jalanin

```bash
cd frontend
npm install
npm run dev
```

Buka app-nya — begitu load, otomatis sign-in anonim, lalu tiap "tabel"
(produk, pelanggan, dst) di-seed otomatis dengan nilai kosong/default saat
pertama kali dibuka. Setelah itu, semua perubahan (tambah produk, transaksi
POS, dll) langsung kesimpen ke Supabase dan gak ilang lagi walau di-refresh
— termasuk bagian-bagian yang tadinya cuma di memori/localStorage:
login/registrasi toko, daftar staff, rekening bank, printer, hasil stock
opname, kategori/brand/satuan/bundle produk, sesi kas harian, dan draft
keranjang POS.

## 8. Build untuk Production / Deploy

```bash
npm run build    # hasilnya di frontend/dist
npm run preview  # buat cek hasil build itu secara lokal
```

**Penting soal `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`:** beda
dengan `npm run dev` (yang baca ulang `frontend/.env` setiap kali dev server
di-start), `npm run build` men-"bake" nilai env var itu langsung jadi teks di
dalam file JS hasil build — bukan dibaca ulang oleh browser tiap halaman
dibuka. Dua akibatnya:

- Kalau kamu ubah `.env` **setelah** build terakhir, hasil build yang lama
  tetap pakai nilai lama (atau kosong). Harus `npm run build` ulang.
- Kalau kamu deploy ke hosting (Vercel, Netlify, cPanel, dst) langsung dari
  Git, `.env` **tidak ikut ter-upload** (memang sengaja di-`.gitignore`).
  Env var-nya harus diisi manual di dashboard hosting itu (biasanya di
  bagian *Environment Variables* pengaturan project), baru trigger build di
  sana — bukan cukup ada di `.env` lokal kamu.

### Deploy ke Vercel

1. Buka project-nya di vercel.com → **Settings > Environment Variables**
2. Tambahkan dua variable ini (Key lalu Value), masing-masing centang
   ketiga environment-nya (**Production**, **Preview**, **Development**)
   biar sama-sama jalan baik di domain utama maupun di preview URL:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. **Save**
4. Kalau project ini `frontend/`-nya bukan root repo (misal kamu push
   folder `build-fixed-restructured` apa adanya), set **Root Directory** ke
   `frontend` juga di **Settings > General**, dan pastikan **Build
   Command**-nya `npm run build`, **Output Directory**-nya `dist`.
5. **Wajib redeploy** — nambah/ubah Environment Variable TIDAK otomatis
   nge-build ulang deployment yang sudah ada. Buka tab **Deployments**,
   klik menu **⋯** di deployment paling atas, pilih **Redeploy**.
6. Setelah build-nya selesai (biasanya <1 menit), buka lagi URL-nya. Kalau
   masih ada bekas cache Chrome, hard refresh dulu (`Ctrl+Shift+R`).

## Struktur Data

Setiap "tabel" (products, customers, salesInvoices, dst) disimpan sebagai
**satu baris** di tabel Postgres `tokku_state`, isinya kolom `value` berupa
`jsonb` (array atau objek) — bukan satu baris per item. Ini sengaja biar
migrasinya simpel: satu hook generik (`useSupabaseState`, di
`frontend/src/lib/useSupabaseState.ts`) dipakai buat baca/tulis semua
"tabel", persis seperti sebelumnya. Kalau nanti butuh multi-kasir yang nulis
bersamaan ke "tabel" yang sama (misal `products`), best next step adalah
pecah jadi satu baris per item — tapi itu refactor terpisah.

Realtime sync antar tab/device jalan lewat **Supabase Realtime** (Postgres
Changes), pengganti langsung dari `onSnapshot` Firestore.

## Troubleshooting

- **Console muncul `permission denied for table tokku_state`** → cek
  langkah 3 (Anonymous sign-in belum aktif) atau pastikan `schema.sql` di
  langkah 2 udah selesai jalan tanpa error (termasuk bagian `grant` di
  paling bawah).
- **`VITE_SUPABASE_URL kosong`** di console pas `npm run dev` → file `.env`
  belum dibuat/diisi, atau lupa restart `npm run dev` setelah bikin/ubah
  `.env`.
- **Muncul error "Konfigurasi Supabase belum lengkap" di Chrome, padahal
  `npm run dev` di lokal baik-baik saja** → itu tandanya kamu lagi buka hasil
  `npm run build` (lewat `npm run preview`, atau lewat hosting) yang
  di-build SEBELUM `.env` terisi. `.env` cuma dipakai saat proses build
  jalan, bukan dibaca lagi setelahnya — lihat bagian "Build untuk
  Production / Deploy" di atas buat cara betulinnya.
- **Data gak muncul-muncul** → di dashboard, buka **Table Editor >
  tokku_state**, harusnya ada baris dengan `key` = `products`, `customers`,
  dst. Kalau kosong total, kemungkinan step 2 belum jalan atau anonymous
  auth belum aktif (lihat 2 poin di atas).
- **Upload foto produk gagal** → buka **Storage** di dashboard, pastikan
  bucket `product-images` ada. Kalau belum, jalankan ulang `schema.sql`.
- **Error `Invalid API key`** → pastikan yang dipakai di `.env` itu
  Publishable/anon key, bukan Secret/service_role key, dan gak ada spasi
  atau tanda kutip nyangkut pas copy-paste.
