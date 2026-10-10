-- Status konfirmasi pembayaran Transfer (fitur "Menunggu Transfer").
--
-- JALANKAN FILE INI DI SUPABASE (SQL Editor) SEBELUM memasang versi aplikasi
-- yang baru. Kalau urutannya terbalik, penyimpanan transaksi dari aplikasi
-- baru akan ditolak database karena kolomnya belum ada.
--
-- Aman dijalankan berulang kali. Invoice lama tidak diubah: kolom kosong
-- berarti "tidak ada status" dan diperlakukan seperti sebelumnya.
alter table public."sales_invoices" add column if not exists "transfer_status" text;
alter table public."sales_invoices" add column if not exists "transfer_confirmed_at" text;

-- Minta PostgREST membaca ulang skema supaya kolom baru langsung dikenali.
notify pgrst, 'reload schema';
