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

Halaman yang sama juga sekarang menampilkan rincian pembayaran (tunai
diterima/kembalian untuk metode Cash, dan dibayar-sekarang/sisa piutang
untuk metode Split) — sebelumnya cuma ada di struk pas-baru-checkout, nggak
muncul lagi kalau dicetak ulang dari Riwayat Transaksi.

## 2. Push Notif — sekarang cuma yang penting-penting
- `backend/supabase/functions/send-push/index.ts`

Dirombak jadi allow-list ketat: **cuma 2 jenis event yang push** —
"Transaksi Baru" (tiap ada penjualan) dan "Stok Menipis/Habis" (tiap produk
turun ke Low Stock/Out of Stock). Semua event lain (customer baru/diedit,
produk diedit tanpa nyentuh stok kritis, supplier, PO, expense, delete di
tabel manapun) **tidak lagi memicu push** — masih tercatat normal di
Aktivitas dalam app, cuma nggak nongol sebagai notif interupsi. Ini juga
otomatis nutup celah kalau kamu (atau siapa pun) pernah nambah Database
Webhook lain di Supabase Dashboard selain 2 yang didokumentasikan di
README fitur ini (`sales_invoices` INSERT & `products` UPDATE) — sebelumnya
webhook tambahan itu bakal jatuh ke notif generik yang bikin spam.

**Perlu deploy ulang Edge Function ini.**

## 3. Pelanggan Default POS — "Customer", tapi bisa diganti
- `frontend/src/App.tsx`
- `frontend/src/features/pos/POSView.tsx`
- `frontend/src/features/settings/SettingsView.tsx`
- `backend/supabase/schema.sql`

Default pelanggan di POS selalu "Customer" (pelanggan umum/walk-in) walaupun
ada banyak data pelanggan lain, bisa diganti lewat **Pengaturan > Profil
Toko > "Pelanggan Default di POS"**. (Perbaikan tambahan: dropdown
pelanggan di halaman POS sebelumnya salah nampilin nama — sudah dibetulkan
juga di file ini.)

Karena "Customer" bukan baris pelanggan asli di database, dia **tidak bisa
dipakai buat metode bayar Split (bayar sebagian/cicil)** — sisa hutangnya
kan nggak ada pelanggan tujuannya. Opsi Split otomatis abu-abu/nonaktif di
halaman pilih metode bayar kalau yang aktif masih "Customer"; kasir harus
pilih/tambah pelanggan asli dulu.

**Perlu jalankan ulang `schema.sql`** di Supabase (SQL Editor) — bagian yang
relevan aman dijalankan ulang (idempotent, pakai `create table if not
exists`), cuma menambahkan 1 tabel singleton baru bernama
`default_customer_id`.

## Ringkasan langkah setelah menimpa file
1. Timpa semua file di atas ke project kamu sesuai path-nya.
2. Jalankan ulang `backend/supabase/schema.sql` di Supabase SQL Editor
   (untuk membuat tabel `default_customer_id`).
3. Deploy ulang Edge Function `send-push` (jalankan dari folder `backend/`:
   `npx supabase functions deploy send-push`).
4. Build & deploy ulang frontend seperti biasa.

## 4. Kamera scan, form Tambah Produk, generate barcode, redesign Produk Eceran
- `frontend/android/app/src/main/AndroidManifest.xml`
- `frontend/src/features/products/ProductsView.tsx`
- `frontend/src/features/product-master/ProductMasterView.tsx`

**Kamera nggak nyala buat scan (APK Android):** ternyata `AndroidManifest.xml`
kamu nggak pernah mendeklarasikan izin `CAMERA` sama sekali — bukan bug di
kode scan-nya. Tanpa baris itu di Manifest, WebView di dalam APK **selalu**
ditolak akses kamera oleh Android, apapun yang terjadi di JS. Sudah
ditambahkan `<uses-permission android:name="android.permission.CAMERA" />`
+ `<uses-feature>` kamera (optional, biar app tetap bisa diinstall di HP
tanpa kamera). **Perlu rebuild APK** — jalankan `npx cap sync android` lalu
build ulang dari Android Studio, bukan cuma redeploy web.

**Halaman Stok — Tambah Produk langsung keisi semua:** form-nya ternyata
diisi data CONTOH bawaan (Rp50.000, stok 100, lokasi "Section B - Row 01",
foto placeholder unsplash) tiap dibuka, bukan form kosong. Sekarang beneran
kosong/nol — cuma Kode SKU yang tetap auto-generate karena memang harus
unik.

**Generate barcode di SKU Master masih angka random:** sekarang barcode-nya
dibangun dari Kode SKU produknya sebagai awalan + angka acak di belakang
(mis. SKU `SKU-7K2F9A` → barcode `SKU7K2F9A482913`), bukan 13 digit acak
yang sama sekali nggak nyambung ke SKU-nya. Kode SKU-nya sekarang juga
digenerate lebih awal (pas form dibuka, bukan pas submit) dan ditampilkan di
form sebagai field "Kode SKU (otomatis)" — sebelumnya SKU-nya nggak
kelihatan sama sekali sampai setelah disimpan.

**Redesign tab Produk Eceran:** disusun ulang jadi 2 kolom "Produk Induk |
Produk Eceran" dengan panah penghubung di tengah, mengikuti referensi
gambar yang dikasih:
- Kolom kiri (Produk Induk): pilih produk induk, lalu langsung muncul
  preview-nya (foto, satuan, spesifikasi, nama alias) buat konfirmasi visual
  sebelum lanjut.
- Kolom kanan (Produk Eceran): "Nilai konversi" + "Pilih Satuan" sekarang di
  sini (sebelumnya nyampur di kolom induk), ditambah upload foto sendiri
  buat produk eceran (**baru** — sebelumnya produk eceran selalu ikut foto
  produk induknya tanpa bisa diganti; sekarang optional, kosongkan aja kalau
  mau tetap ikut foto induk).

Catatan: teks "maksimal 256kb" di gambar referensi saya ganti jadi "maksimal
5MB" karena itu limit asli yang ditegakkan `uploadProductImage` di project
ini — biar teksnya nggak bohong ke user.


