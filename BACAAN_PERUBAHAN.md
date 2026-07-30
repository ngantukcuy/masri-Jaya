# Ringkasan Perubahan

Zip ini HANYA berisi file yang diubah/ditambah — timpa (overwrite) ke folder
project kamu di lokasi yang sama (struktur foldernya sama persis).

## 1. Versi aplikasi tidak muncul
Sebelumnya teks versi di sidebar di-hardcode "v1.0" dan tidak pernah diperbarui
(padahal versi Android sudah 1.0.1). Sekarang versi diambil otomatis dari
`frontend/package.json` ("version": "1.0.1") lewat `vite.config.ts`, dan
ditampilkan di:
- Sidebar (setelah login)
- Halaman Login (sebelum login)

Kalau rilis versi baru, cukup update angka di `frontend/package.json` —
tampilan di app akan otomatis ikut berubah, tidak perlu edit UI lagi.
File terkait: `frontend/package.json`, `frontend/vite.config.ts`,
`frontend/src/vite-env.d.ts`, `frontend/src/components/layout/Sidebar.tsx`,
`frontend/src/features/auth/LoginView.tsx`

## 2. Surat Jalan sekarang landscape (miring kesamping)
`generateDeliveryNotePDF` di `frontend/src/features/pos/lib/receiptPdf.ts`
diubah dari `orientation: 'portrait'` ke `orientation: 'landscape'` (ukuran
kertas A5). Struk pembelian/invoice biasa (thermal 80mm) tidak diubah, hanya
surat jalan.

## 3. Halaman POS Kasir — harga per barang
Dropdown "Harga Standard / Harga Minimum" diganti dengan:
- Info "Harga Minimum: Rp ..." ditampilkan langsung (tidak perlu buka dropdown)
- Field harga yang bisa diedit langsung oleh kasir
- Harga otomatis dibatasi: tidak bisa kurang dari Harga Minimum barang
  tersebut, dan tidak bisa lebih dari Harga Standard barang tersebut
- Subtotal, total, struk cetak (PDF & modal di layar) semua sudah memakai
  harga yang diedit kasir ini

File terkait: `frontend/src/features/pos/POSView.tsx`,
`frontend/src/features/pos/lib/posCartStorage.ts`,
`frontend/src/features/pos/lib/receiptPdf.ts`,
`frontend/src/features/pos/components/ReceiptModal.tsx`

## 4. Field angka: mulai kosong + pemisah ribuan otomatis
Dibuat komponen baru `frontend/src/components/shared/NumberInput.tsx` yang
dipakai untuk mengganti SEMUA `<input type="number">` untuk nominal harga /
stok / hari / poin di seluruh aplikasi (POS Kasir, Tambah Barang, Stok/Produk,
Sku Master, Pelanggan, Pemasok, Pembelian, Utang-Piutang, Deposit, Kas Harian,
Pembayaran/Finance, Retur). Perilakunya:
- Field kosong dari awal (tidak menampilkan angka 0 yang mengganggu)
- Otomatis kasih titik pemisah ribuan SAAT mengetik (misal langsung jadi
  "12.500" begitu ketik digit ke-3), bukan cuma setelah selesai
- Kalau field itu punya batas minimum (misalnya Harga Minimum), batas itu
  diterapkan begitu kamu pindah dari field (blur), supaya kamu tetap bisa
  mengetik angka bertahap tanpa terpotong di tengah jalan
- Kalau field itu punya batas maksimum (misalnya Harga Standard, atau %
  diskon maksimal 100), batas itu langsung dicegah saat mengetik

File terkait: 12 file di `frontend/src/features/*/*.tsx` (semua form yang
sebelumnya pakai `type="number"`), lihat daftar file yang disertakan di zip
ini.

---

Catatan: Perubahan ini sudah dicek dengan TypeScript compiler (`tsc --noEmit`)
dan tidak menimbulkan error baru pada file yang diedit.
