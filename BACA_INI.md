# File yang diperbaiki — cara pakai

Paket ini **cuma berisi file yang berubah**, struktur foldernya sama persis
seperti project kamu. Tinggal timpa (overwrite) 2 file ini ke project:

```
frontend/src/features/pos/POSView.tsx                        (diubah)
frontend/src/features/pos/components/PaymentMethodModal.tsx  (baru)
```

---

## 1. Metode pembayaran POS — sudah diperbaiki

**Yang saya ubah:**
- Baris tombol toggle metode pembayaran (Tunai/QRIS/Kartu-Cicil/Deposit)
  yang dulu selalu tampil di atas tombol "Bayar & Cetak Struk" — **sudah
  dihapus**.
- Sekarang klik **"Bayar & Cetak Struk"** akan memunculkan pop-up
  **"Pilih Metode Pembayaran"** dulu (file baru `PaymentMethodModal.tsx`).
- Setelah kasir pilih metode, baru lanjut ke alur masing-masing:
  - **Tunai** → muncul `CashPaymentModal` (sudah ada di project kamu tapi
    ternyata belum pernah dipasang/dipakai) — kasir masukkan uang yang
    diterima, sistem hitung kembalian otomatis. Tidak bisa lanjut kalau
    uangnya kurang dari total belanja.
  - **QRIS** → tetap seperti sebelumnya.
  - **Kartu / Cicil** → muncul `SplitPaymentModal` (juga sudah ada di
    project tapi belum pernah dipasang) — kasir masukkan jumlah yang
    dibayar sekarang, sisanya otomatis tercatat sebagai **piutang**
    pelanggan (masuk ke halaman Utang & Piutang, lengkap dengan tanggal
    jatuh tempo dari `tempoDays` pelanggan tsb).
  - **Deposit** → tetap seperti sebelumnya (potong saldo deposit
    pelanggan), langsung jalan tanpa input tambahan.

Struk (`ReceiptModal`) sebenarnya sudah lama siap menampilkan "Tunai
Diterima / Kembalian" dan "Dibayar Sekarang / Sisa Piutang" — cuma
datanya belum pernah dikirim dari POSView karena dua modal itu belum
dipasang. Sekarang sudah kekirim.

**Yang TIDAK saya ubah:** `CashPaymentModal.tsx`, `SplitPaymentModal.tsx`,
`QRISModal.tsx`, `ReceiptModal.tsx` — semuanya sudah ada & sudah benar,
saya cuma menyambungkannya dari `POSView.tsx`.

---

## 2. Push notifikasi belum muncul — ini BUKAN bug kode lagi

Saya cek ulang `backend/supabase/functions/send-push/`,
`frontend/src/lib/push/pushNotifications.ts`, dan `App.tsx` — semuanya
**sudah benar** (perbaikan dari sesi sebelumnya, lihat
`BACA_DULU_PENTING.md` di project kamu, sudah masuk ke paket ini). Saya
tidak menemukan bug kode baru di bagian ini, jadi tidak ada file yang
perlu ditimpa untuk fitur ini.

Kalau notifnya masih belum muncul juga, kemungkinan besar salah satu dari
4 langkah setup di `backend/supabase/functions/send-push/README.md`
ini belum dilakukan — checklist cepatnya:

1. **Function `send-push` sudah di-deploy ulang?** Kode lama (tanpa
   `Deno.serve`) yang mungkin masih ter-deploy di Supabase kamu sekarang
   — perbaikannya cuma ada di source code lokal sampai kamu jalankan:
   ```
   supabase functions deploy send-push --project-ref <PROJECT_REF> --no-verify-jwt
   ```
2. **Secret `FCM_SERVICE_ACCOUNT_JSON` sudah di-set di Supabase?** (dan
   sudah pakai key yang baru, bukan yang bocor — lihat bagian 1 di
   `BACA_DULU_PENTING.md`).
3. **Database Webhook sudah dibuat di Supabase Dashboard?** Ada 2:
   satu untuk tabel `sales_invoices` (event Insert), satu untuk
   `products` (event Update). Tanpa ini, transaksi baru tidak pernah
   "memberi tahu" function-nya sama sekali.
4. **APK Android sudah di-build ulang & di-install ulang di HP** setelah
   perbaikan `pushNotifications.ts`/`App.tsx`? Device yang login sebelum
   perbaikan ini nyimpan token tanpa `role`, dan token itu tidak akan
   pernah dapat notif sampai staff logout-login lagi di APK versi baru.

Kalau ke-4 langkah itu sudah dilakukan tapi masih belum muncul juga,
kabari saya bagian mana yang sudah/belum — supaya saya bisa bantu cari
di titik yang tepat (bisa jadi errornya ada di log Edge Function atau di
Firebase Console, bukan di kode client).
