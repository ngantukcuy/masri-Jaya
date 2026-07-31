# Update tokku — Panduan Pasang

Isi zip ini CUMA file yang berubah/baru, dengan struktur folder yang sama
persis kayak project Anda. Tinggal copy-timpa (overwrite) ke folder
project `tokku` yang asli sesuai path masing-masing.

## Daftar perubahan

### 1. Filter tanggal di Riwayat Transaksi
`frontend/src/features/transactions/TransactionHistoryView.tsx`
Ada 2 input tanggal "Dari" – "Sampai" + tombol Reset. Kartu jumlah
invoice & omzet otomatis ikut angka yang sudah difilter.

### 2. Fix "Cetak PDF" gagal total di Android
`frontend/src/features/pos/lib/receiptPdf.ts`,
`frontend/src/features/pos/POSView.tsx`,
`frontend/src/features/transactions/components/InvoicePrintModal.tsx`

Akar masalahnya: `doc.save()` bawaan jsPDF cuma nyoba klik link
`<a download>` yang di-generate lewat blob URL — trik ini WAJAR gagal
total di WebView Android karena gak ada download manager yang
nangkepnya. Fix-nya: PDF ditulis ke folder cache HP lewat
`@capacitor/filesystem`, terus dibuka lewat share sheet asli Android
(`@capacitor/share`) — dari situ user bisa buka di PDF viewer, print,
atau kirim lewat WhatsApp dsb. Utility-nya (`savePdfDoc`) sebenarnya
sudah ada dari sebelumnya tapi belum pernah dipanggil di mana-mana —
sekarang sudah disambungkan.

**Wajib:** setelah copy file, jalankan:
```bash
cd frontend
npm install
npm run android:sync
```

### 3. Push Notification (FCM, notif tetap muncul walau app ditutup)
File baru:
- `frontend/src/lib/push/pushNotifications.ts` — daftarin device ke FCM +
  simpan token-nya ke Supabase
- `frontend/src/components/shared/PushToastListener.tsx` — nampilin toast
  kecil kalau notif masuk pas app lagi kebuka
- `backend/supabase/functions/send-push/` — Edge Function yang ngirim
  notifnya (trigger: transaksi baru masuk & stok menipis/habis)

File yang diubah: `frontend/src/App.tsx` (manggil `initPushNotifications`
begitu user login), `backend/supabase/schema.sql` (nambah tabel
`push_tokens`), `frontend/android/app/src/main/AndroidManifest.xml`
(izin `POST_NOTIFICATIONS`).

**Wajib — ini fitur yang butuh setup paling banyak, ikuti step-by-step**
di `backend/supabase/functions/send-push/README.md`. Ringkasnya:
1. Buat project Firebase → download `google-services.json` → taruh di
   `frontend/android/app/google-services.json`
2. Generate Service Account key dari Firebase → jadi Supabase secret
3. `supabase functions deploy send-push`
4. Bikin 2 Database Webhook di Supabase Dashboard (transaksi baru & stok
   menipis)
5. Jalankan ulang `backend/supabase/schema.sql` di SQL Editor Supabase
   (aman dijalankan ulang, idempotent) supaya tabel `push_tokens`
   kebuat.

### 4. SKU alfanumerik + tombol Generate & Scan
`frontend/src/lib/generateSku.ts` (baru),
`frontend/src/features/products/ProductsView.tsx`,
`frontend/src/features/product-master/ProductMasterView.tsx`

Kode SKU baru sekarang formatnya `SKU-7K2F9A` (huruf+angka acak, bukan
`SKU-483920` yang full angka lagi). Di halaman **Kelola Produk → Tambah
Produk**, field Kode SKU sekarang punya 2 tombol di sampingnya:
- ⟳ **Generate** — bikin kode acak baru
- 📷 **Scan** — buka kamera buat scan barcode/kode yang sudah ada
  (pakai scanner yang sama dengan fitur barcode yang sudah ada
  sebelumnya)

## Bonus: perbaikan kecil
`frontend/package.json` juga menambahkan `@types/react` dan
`@types/react-dom` yang ternyata selama ini belum terpasang — ini akar
penyebab banyak error TypeScript di `App.tsx` dan file lain yang selama
ini "flagged but not addressed". Setelah `npm install`, error-error itu
otomatis hilang (sudah dicoba build & type-check, semuanya beres kecuali
error lama yang memang gak berhubungan sama Firebase — itu wajar karena
project ini sekarang pakai Supabase, bukan Firebase, jadi file
`firebase.ts`, `firestoreCache.ts`, dst memang legacy/tidak dipakai).

## Ringkasan langkah pemasangan

```bash
# 1. Copy semua file dari zip ini ke project asli (timpa yang lama)

cd frontend
npm install                 # ambil dependency baru
npx tsc --noEmit             # opsional: cek gak ada error
npm run build                # opsional: cek build sukses

# 2. Jalankan ulang backend/supabase/schema.sql di Supabase SQL Editor
#    (buat tabel push_tokens)

# 3. Kalau mau aktifkan push notification, ikuti
#    backend/supabase/functions/send-push/README.md

# 4. Sync & build ulang APK Android
npm run android:sync
npx cap open android
```
