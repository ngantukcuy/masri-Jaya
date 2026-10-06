# Push Notification (FCM) — Cara Setup

Fitur ini mengirim push notification ke perangkat yang sudah login dan
mengizinkan notifikasi, termasuk saat aplikasi ditutup. Trigger di
`backend/supabase/security_notifications.sql` mencakup transaksi, stok
menipis, dan permintaan approval retur, pengeluaran, stock opname,
penghapusan transaksi, PO, serta pembayaran bon supplier.

## 1. Buat/ambil project Firebase, aktifkan Cloud Messaging

1. Buka https://console.firebase.google.com → buat project baru (atau
   pakai yang sudah ada).
2. Di project itu, klik ⚙️ **Project settings** → tab **General** →
   **Add app** → pilih **Android**.
3. Isi **Android package name** persis: `com.masrijaya.pos`
   (lihat `frontend/capacitor.config.ts` field `appId` kalau mau
   dicocokkan/diganti).
4. Download file **`google-services.json`** yang ditawarkan, lalu taruh
   di `frontend/android/app/google-services.json`.

## 2. Buat Service Account key (buat Edge Function ngirim push)

1. Di Firebase Console → ⚙️ **Project settings** → tab **Service
   accounts** → **Generate new private key**.
2. **Jangan commit file key ini ke git.** Simpan isinya sebagai secret di
   Supabase.

## 3. Deploy Edge Function `send-push` ke Supabase

Dari root project, pakai Supabase CLI:

```bash
supabase login
supabase link --project-ref <PROJECT_REF_ANDA>
supabase secrets set FCM_SERVICE_ACCOUNT_JSON='<ISI FILE JSON DARI LANGKAH 2>'
supabase functions deploy send-push --project-ref <PROJECT_REF_ANDA> --no-verify-jwt
```

`--no-verify-jwt` dipakai karena pemanggil function ini adalah Database
Webhook internal Supabase.

## 4. Pasang trigger dan Database Webhook

1. Jalankan `backend/supabase/security_notifications.sql` di Supabase
   Dashboard → **SQL Editor**. Script ini aman dijalankan ulang.
2. Buat satu Database Webhook di **Database → Webhooks → Create a new
   hook** dengan pengaturan:
   - Table: `notification_events`
   - Events: **Insert**
   - Type: **Supabase Edge Functions** → `send-push`
3. Hapus webhook lama yang menempel di tabel lain (kalau ada), supaya
   notifikasi tidak dobel.

Push approval ditujukan ke Owner/Admin. Perangkat perlu login, mengizinkan
notifikasi, dan memiliki token push yang aktif.

## 5. Build ulang aplikasi Android

```bash
cd frontend
npm install
npm run android:sync
npx cap open android
```

Saat app dibuka pertama kali setelah login, izinkan notifikasi agar token
device tersimpan.

## 6. Push Notification di Web/Browser (opsional)

Push web menggunakan Firebase JS SDK di
`frontend/src/lib/push/webPush.ts` dan `frontend/public/sw.js`.

1. Di Firebase project yang sama, tambahkan app **Web** dan salin nilai
   `firebaseConfig`.
2. Di **Project settings → Cloud Messaging → Web Push certificates**,
   generate/copy VAPID key.
3. Isi `firebaseConfig` dan VAPID key di kedua file tersebut.
4. Build dan deploy ulang web. Push web memerlukan HTTPS (kecuali
   `localhost`); di iPhone/iPad situs harus ditambahkan ke Home Screen.

## Menambah jenis notif baru

Atur kejadian, isi pesan, dan role penerima melalui trigger
`trg_notify_*` di `backend/supabase/security_notifications.sql`. Semua
kejadian akan masuk ke webhook yang sama melalui tabel
`notification_events`.
