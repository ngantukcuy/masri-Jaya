# Cara pakai

Zip ini cuma berisi file-file yang saya ubah/tambah (bukan seluruh project,
biar kecil & cepat). Cara pasangnya: salin folder `frontend/src/...` di zip
ini ke lokasi yang sama persis di project kamu, timpa file yang sudah ada.

File baru (ditambahkan):
- frontend/src/lib/fonts/jetbrainsMonoBase64.ts
- frontend/src/lib/fonts/registerReceiptFont.ts
- frontend/src/components/shared/SearchableSelect.tsx

File yang diubah:
- frontend/src/features/pos/lib/receiptPdf.ts
- frontend/src/features/pos/components/AddCustomerModal.tsx
- frontend/src/features/pos/POSView.tsx
- frontend/src/features/pos/components/AddProductModal.tsx
- frontend/src/features/products/ProductsView.tsx
- frontend/src/features/product-master/ProductMasterView.tsx
- frontend/src/features/purchasing/PurchaseView.tsx

Setelah ditimpa, jalankan seperti biasa (`npm run dev` / `npm run build`) —
tidak ada paket npm baru yang perlu diinstall, font JetBrains Mono sudah
di-embed langsung sebagai base64 di dalam kode.

## Ringkasan perubahan

1. **Font struk PDF jadi JetBrains Mono** — sebelumnya `doc.setFont('JetBrains
   Mono', ...)` di jsPDF diam-diam fallback ke Helvetica karena fontnya tidak
   pernah didaftarkan ke jsPDF. Sekarang font di-embed (regular + bold) dan
   didaftarkan otomatis tiap bikin PDF struk/nota. Juga ditambahkan ikon
   truk/toko kecil di baris "Pengambilan" biar tampilannya mendekati struk
   on-screen di gambar referensi kamu.

2. **Nomor HP saat tambah pelanggan baru (POS)** — ada field baru "Nomor HP
   (opsional)" di modal tambah pelanggan, boleh dikosongin.

3. **Jarak tombol Filter/Download/Cetak dari search bar (halaman Stok)** —
   penyebabnya container-nya kelupaan class `flex` jadi `gap` tidak berlaku
   sama sekali. Sudah diperbaiki.

4. **Dropdown Produk/Kategori/Supplier: kosong di awal + bisa disearch** —
   dibikin komponen baru `SearchableSelect` (kotak pencarian + daftar
   filter-ketik), dipasang di semua dropdown pemilihan produk, kategori
   produk, dan supplier (form tambah/edit produk, produk masuk, transfer
   stok, penyesuaian stok, produk retail/bundle, dan Purchase Order). Semua
   default value yang tadinya otomatis ke-pilih item pertama juga sudah
   dihapus, jadi sekarang benar-benar kosong sampai dipilih manual — dan
   ditambahkan validasi "wajib dipilih" biar tidak submit dengan kosong.

   Dropdown lain yang isinya cuma sedikit pilihan tetap (level loyalitas,
   satuan unit, metode bayar, kategori anggaran biaya, dll) sengaja saya
   biarkan seperti semula sesuai konfirmasi kamu.
