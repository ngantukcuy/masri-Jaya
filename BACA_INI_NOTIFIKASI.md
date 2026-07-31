# Push Notification — Diagnosis Android & Fitur Web Push Baru

Paket ini **cuma berisi file yang berubah/baru**, struktur foldernya sama
persis seperti project kamu. Tinggal timpa (overwrite) 6 file ini:

```
frontend/src/lib/push/pushNotifications.ts   (diubah)
frontend/src/lib/push/webPush.ts             (BARU)
frontend/public/sw.js                        (diubah)
frontend/package.json                        (diubah — tambah dependency "firebase")
backend/supabase/functions/send-push/fcm.ts  (diubah)
backend/supabase/functions/send-push/README.md (diubah — tambah bagian setup web push)
```

---

## 1. Kenapa notif Android masih belum muncul — hasil cek ulang

Aku cek ulang dari nol seluruh alurnya: `pushNotifications.ts` -> `App.tsx`
-> tabel `push_tokens` & RLS-nya -> `send-push/index.ts` -> `fcm.ts`. Semua
kode **masih benar** persis seperti perbaikan sesi-sesi sebelumnya (role
`'Owner'|'Admin'|'Kasir'|'Stoker'` sudah match, query token sudah baca dari
`data` bukan kolom yang tidak ada, `Deno.serve` sudah ada). Tidak ada bug
kode baru yang aku temukan — jadi kemungkinan besar ini soal **setup** atau
**role**, bukan kode. Urutan yang paling mungkin, dari yang paling sering
kejadian:

### a) HP yang dipakai testing login sebagai role apa?
Ini yang paling perlu dicek duluan. Aturan filter saat ini
(`rolesForTable` di `index.ts`):

| Kejadian | Yang dapat notif |
|---|---|
| Transaksi baru (`sales_invoices`) | **Owner, Admin** saja |
| Stok menipis/habis (`products`) | **Owner, Admin, Stoker** |
| Lainnya (customer/supplier/expense baru, dll) | **Owner, Admin** (default: Owner saja) |

**Kasir TIDAK ada di daftar manapun** — kalau HP yang kamu pakai testing
login-nya sebagai Kasir (yang notabene sering pegang HP kasir buat coba
transaksi), ya otomatis tidak akan pernah dapat notif apa pun, walau semua
langkah setup lain sudah 100% benar. Ini bukan bug, tapi mungkin bukan
juga yang kamu mau — kalau kamu mau Kasir juga dapat notif jenis
tertentu, bilang aja jenis notif & role-nya, nanti aku sesuaikan
`rolesForTable`.

### b) Checklist 4 langkah setup (`send-push/README.md`)
Kalau HP testing-nya sudah benar login sebagai Owner/Admin, cek 4 ini:
1. **Edge Function `send-push` sudah di-deploy ulang** dengan kode yang
   sudah ada `Deno.serve`? (`supabase functions deploy send-push
   --project-ref <REF> --no-verify-jwt`)
2. **Secret `FCM_SERVICE_ACCOUNT_JSON`** sudah di-set di Supabase, dan
   isinya masih valid (belum di-revoke di Firebase Console)?
3. **2 Database Webhook** (`sales_invoices` Insert, `products` Update)
   sudah dibuat di Supabase Dashboard, mengarah ke URL function yang benar?
4. **APK sudah di-build ulang, di-install ulang, dan staff logout-login
   lagi** di versi APK terbaru? Token lama (sebelum perbaikan role) tidak
   akan pernah dapat notif.

### c) Pengaturan HP Android itu sendiri
Kalau (a) dan (b) sudah oke tapi tetap tidak muncul — banyak HP Android
(terutama Xiaomi/MIUI, Oppo/ColorOS, Vivo/FuntouchOS, dan sebagian
Samsung) **mematikan notifikasi app secara default lewat pengaturan
sendiri** di luar kendali kode, kecuali di-izinkan manual:
- Battery/App settings -> cari app-nya -> pastikan **Notifikasi**
  diizinkan, **Autostart/Background activity** dinyalakan, dan **battery
  optimization** untuk app ini di-set "Tidak dibatasi/Unrestricted".
- Pastikan HP tidak dalam mode **Do Not Disturb**.
- Coba dulu **matikan APK sepenuhnya** (bukan cuma minimize) baru bikin
  transaksi baru dari device/browser lain, supaya benar-benar menguji
  skenario "notif walau app ditutup".

### Kalau masih belum muncul juga setelah cek (a)-(c)
Yang paling kebantu buat aku diagnosis lebih lanjut: buka **Supabase
Dashboard -> Edge Functions -> send-push -> Logs**, bikin 1 transaksi baru
dari device Owner/Admin, terus kabari aku:
- Ada log baru yang muncul sama sekali gak (berarti Database Webhook-nya
  yang belum terpasang/salah)?
- Ada log tapi error (kabari isi error-nya — biasanya soal secret/auth)?
- Log-nya sukses dengan `{"sent": 0}` (berarti tidak ada token yang cocok
  role-nya) atau `{"sent": 1+}` (berarti FCM-nya sukses terkirim, jadi
  masalahnya ada di sisi HP/OS, bukan di backend)?

---

## 2. Fitur baru: Push Notification di Web/Browser

Sekarang push notification juga jalan di browser (Chrome/Edge di HP atau
komputer) — **bukan cuma APK Android**. Login/logic-nya reuse total:
- Tabel Supabase `push_tokens` **sama persis** dengan Android (dibedakan
  `data.platform: 'web'` vs `'android'`) — jadi `send-push` Edge Function
  **tidak perlu diubah/dideploy ulang secara struktural**, otomatis juga
  ngirim ke browser.
- `PushToastListener.tsx` (toast kecil pas app lagi kebuka) **tidak
  diubah sama sekali** — dipakai bareng oleh Android & Web lewat event
  yang sama (`tokku:push-received`).
- `App.tsx` **juga tidak perlu diubah** — `initPushNotifications(...)`
  yang sudah dipanggil di sana sekarang otomatis mendeteksi platform
  (Capacitor asli vs browser) dan pilih jalur yang sesuai sendiri.

### Yang perlu kamu lakukan supaya web push aktif
File kodenya sudah lengkap, tinggal isi konfigurasi (bukan rahasia, aman
ditulis di kode client) di **2 tempat** — cari komentar `GANTI_DENGAN_...`
di masing-masing:
- `frontend/src/lib/push/webPush.ts`
- `frontend/public/sw.js`

Langkah lengkap cara ambil nilainya (Firebase Console -> Add app Web +
generate VAPID key) ada di **bagian 6, `backend/supabase/functions/
send-push/README.md`** (baru ditambahkan). Setelah diisi:
```bash
cd frontend
npm install          # ambil dependency baru "firebase"
npm run build         # atau langsung deploy (Vercel dsb)
```
Lalu deploy ulang sekali lagi Edge Function `send-push` (supaya perubahan
kecil di `fcm.ts` — nambahin icon buat notif web — ikut aktif):
```bash
cd backend
supabase functions deploy send-push --project-ref <PROJECT_REF> --no-verify-jwt
```

Tidak perlu bikin Database Webhook baru ataupun ubah schema — yang sudah
ada dipakai bersama Android.

### Yang perlu kamu tahu soal web push
- **HTTPS wajib** (kecuali `localhost`). Aman kalau deploy ke Vercel.
- **iPhone/iPad**: notif web cuma jalan kalau situsnya di-"Add to Home
  Screen" dulu (batasan Apple, bukan bug kode) — di Android/desktop tidak
  perlu ini.
- Sama seperti native: kalau device browser itu **belum pernah dapat
  role staff** (login duluan setelah update ini), dia juga kena aturan
  filter role yang sama (lihat bagian 1a di atas).
- Saat ini permintaan izin notifikasi jalan otomatis begitu selesai
  login (sama seperti APK) — belum ada tombol manual "Aktifkan Notifikasi"
  terpisah di halaman Pengaturan. Kalau browser sempat kamu klik "Block",
  JS tidak bisa minta izin ulang otomatis (batasan browser) — kabari aku
  kalau mau ditambahin tombol manual buat kasus ini (retry / re-enable),
  gampang nambahnya.

---

## 3. Pengingat (masih dari sesi sebelumnya, belum keliatan sudah dibereskan)

File kredensial Firebase Admin SDK yang bocor
(`frontend/panglong-af0b8-firebase-adminsdk-fbsvc-8ab5b390e7.json`) dan
`backend/supabase/.env` **masih ada** di project yang kamu upload. Kalau
key ini belum di-revoke & diganti di Firebase Console (lihat
`BACA_DULU_PENTING.md`), ini masih risiko keamanan aktif — siapa pun yang
pernah pegang salinan zip/commit lama bisa akses penuh project Firebase
kamu. Bukan bagian dari perbaikan notifikasi kali ini, tapi tetap penting.

Kalau semua perubahan di `BACA_DULU_PENTING.md`, `PANDUAN.md`, dan
`BACAAN_PERUBAHAN.md` sudah kamu terapkan, file-file itu (plus `BACA_INI.md`
yang lama) boleh dihapus dari root project — cuma numpuk, tidak
mempengaruhi aplikasi.
