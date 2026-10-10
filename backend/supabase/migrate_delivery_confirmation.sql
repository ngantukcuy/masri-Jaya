-- Konfirmasi pengiriman barang (fitur "Dalam pengiriman" / "Perlu Diantar").
--
-- JALANKAN FILE INI DI SUPABASE (SQL Editor) SEBELUM memasang versi aplikasi
-- yang baru. Kalau belum dijalankan, jumlah "sudah sampai" tidak bisa tersimpan
-- dan semua barang akan terbaca seperti sebelumnya (dianggap sampai begitu
-- surat jalan dicetak).
--
-- Aman dijalankan berulang kali. Invoice lama tidak diubah: kolom kosong
-- dianggap sama dengan jumlah yang tercetak di surat jalan.
alter table public."sales_invoice_items" add column if not exists "received_quantity" numeric;

-- Foto bukti terima barang yang dilampirkan saat Konfirmasi Pengiriman.
alter table public."sales_invoices" add column if not exists "delivery_proof_urls" text[];

-- Minta PostgREST membaca ulang skema supaya kolom baru langsung dikenali.
notify pgrst, 'reload schema';
