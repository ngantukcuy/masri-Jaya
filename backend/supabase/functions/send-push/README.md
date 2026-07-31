# Push Notification (FCM) — Cara Setup

Fitur ini bikin notif otomatis muncul di HP Android (walau app-nya lagi
ditutup total, kayak notif Instagram) setiap ada **transaksi baru** atau
**stok produk menipis/habis**. Kode klien (app) dan Edge Function-nya
sudah dibuatkan — tinggal 4 langkah setup di bawah ini, semuanya cuma
sekali dilakukan.

## 1. Buat/ambil project Firebase, aktifkan Cloud Messaging

1. Buka https://console.firebase.google.com → buat project baru (atau
   pakai yang sudah ada).
2. Di project itu, klik ⚙️ **Project settings** → tab **General** →
   **Add app** → pilih **Android**.
3. Isi **Android package name** persis: `com.masrijaya.pos`
   (lihat `frontend/capacitor.config.ts` field `appId` kalau mau
   dicocokkan/diganti).
4. Download file **`google-services.json`** yang ditawarkan, lalu taruh
   di:
   ```
   frontend/android/app/google-services.json
   ```
   (Gradle project ini sudah otomatis mendeteksi & memasang plugin
   `google-services` kalau file ini ada — gak perlu edit gradle lagi.)

## 2. Buat Service Account key (buat Edge Function ngirim push)

1. Masih di Firebase Console project yang sama → ⚙️ **Project settings**
   → tab **Service accounts** → **Generate new private key**. Ini akan
   download 1 file JSON (isinya `project_id`, `client_email`,
   `private_key`, dst).
2. **Jangan commit file ini ke git.** Simpan isinya sebagai secret di
   Supabase (langkah berikutnya).

## 3. Deploy Edge Function `send-push` ke Supabase

Dari root project, pakai Supabase CLI (`npm i -g supabase` kalau belum
ada):

```bash
supabase login
supabase link --project-ref <PROJECT_REF_ANDA>

# Set service account Firebase sebagai secret (paste seluruh isi file
# JSON dari langkah 2 sebagai satu baris, atau pakai --env-file)
supabase secrets set FCM_SERVICE_ACCOUNT_JSON='<ISI FILE JSON DARI LANGKAH 2>'

# Deploy function-nya
supabase functions deploy send-push --project-ref <PROJECT_REF_ANDA> --no-verify-jwt
```

`--no-verify-jwt` dipakai karena yang manggil function ini nanti adalah
Database Webhook internal Supabase, bukan user dari app.

## 4. Buat Database Webhook di Supabase Dashboard

Ulangi langkah ini 2x (satu untuk transaksi baru, satu untuk stok
menipis):

1. Buka **Supabase Dashboard → Database → Webhooks → Create a new hook**.
2. **Webhook #1 — Transaksi baru:**
   - Table: `sales_invoices`
   - Events: centang **Insert** saja
   - Type: **HTTP Request** → method `POST`
   - URL: `https://<PROJECT_REF>.supabase.co/functions/v1/send-push`
   - Header tambahan: `Authorization: Bearer <SERVICE_ROLE_KEY_ANDA>`
3. **Webhook #2 — Stok menipis:**
   - Table: `products`
   - Events: centang **Update** saja
   - Type & URL & Header: sama persis seperti di atas.

Selesai — dari titik ini, tiap ada transaksi baru masuk atau stok produk
berubah jadi "Low Stock"/"Out of Stock", semua HP yang pernah login ke
app (dan sudah kasih izin notifikasi) langsung dapat notif, walau app-nya
lagi ditutup.

## 5. Build ulang aplikasi Android

```bash
cd frontend
npm install
npm run android:sync      # vite build + npx cap sync android
npx cap open android      # buka di Android Studio, lalu Run/Build APK
```

Saat app dibuka pertama kali setelah login, akan muncul minta izin
notifikasi (wajib di-Izinkan supaya token device-nya kesimpan).

## Menambah jenis notif baru

Semua logic "kejadian apa -> notif apa" ada di satu tempat:
`buildNotificationPayload()` di `index.ts`. Tinggal tambah
`else if (table === '...')` baru + (kalau tabelnya belum ada webhook-nya)
buat 1 Database Webhook baru seperti langkah 4 di atas.
