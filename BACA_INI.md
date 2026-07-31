# Perubahan yang Dikirim

Isi zip ini HANYA file yang berubah — struktur foldernya sama seperti project
kamu, jadi tinggal timpa (overwrite) file yang namanya sama di project asli.

## 1. Cetak Struk Jalan — pilih barang dulu sebelum cetak
- `frontend/src/features/transactions/components/InvoicePrintModal.tsx`
- `frontend/src/features/pos/lib/receiptPdf.ts`

Sekarang, sebelum preview Surat Jalan muncul, ada langkah pemilihan barang
(checklist, default semua tercentang). Berguna kalau satu transaksi diantar
bertahap — cuma barang yang dicentang yang masuk ke cetakan (thermal maupun
PDF). Ada tombol "Ubah Pilihan Barang" untuk balik ganti pilihan.

## 2. Push Notif — tidak spam lagi tiap transaksi
- `backend/supabase/functions/send-push/index.ts`

Sebelumnya: tiap 1 transaksi POS, tabel `customers` ikut ke-update (poin,
total belanja, dll) dan itu memicu notif terpisah "Pelanggan diperbarui" —
padahal transaksinya sendiri sudah dinotif lewat "Transaksi Baru". Sekarang
notif update pelanggan cuma dikirim kalau ada perubahan data identitas
(nama, telepon, alamat, dll), bukan tiap field finansial rutin berubah.

**Perlu deploy ulang Edge Function ini** (lewat Supabase CLI atau paste
manual ke Dashboard > Edge Functions > send-push) supaya perubahannya aktif.

## 3. Pelanggan Default POS — "Customer", tapi bisa diganti
- `frontend/src/App.tsx`
- `frontend/src/features/pos/POSView.tsx`
- `frontend/src/features/settings/SettingsView.tsx`
- `backend/supabase/schema.sql`

Sekarang default pelanggan di POS selalu "Customer" (pelanggan umum/walk-in)
walaupun ada banyak data pelanggan lain — sebelumnya POS asal ambil baris
pertama di database. Default ini bisa diganti kapan saja lewat
**Pengaturan > Profil Toko > "Pelanggan Default di POS"**, pilih dari daftar
pelanggan yang ada, dan akan langsung dipakai di semua device.

**Perlu jalankan ulang `schema.sql`** di Supabase (SQL Editor) — bagian yang
relevan aman dijalankan ulang (idempotent, pakai `create table if not
exists`), cuma menambahkan 1 tabel singleton baru bernama
`default_customer_id`.

## Ringkasan langkah setelah menimpa file
1. Timpa ke-7 file di atas ke project kamu sesuai path-nya.
2. Jalankan ulang `backend/supabase/schema.sql` di Supabase SQL Editor
   (untuk membuat tabel `default_customer_id`).
3. Deploy ulang Edge Function `send-push`.
4. Build & deploy ulang frontend seperti biasa.
