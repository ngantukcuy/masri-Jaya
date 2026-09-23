# Ringkasan Perbaikan — Kasirku (Tokku)

Zip ini cuma berisi 4 file yang berubah (bukan seluruh project, karena
`node_modules` terlalu besar). Tinggal timpa file dengan path yang sama
di project aslinya.

## 1. Error PDF struk (`setAutoPageBreak is not a function`)
File: `frontend/src/features/pos/lib/receiptPdf.ts`

`setAutoPageBreak` ternyata BUKAN method asli jsPDF (sudah dicek ke
seluruh package jsPDF versi yang dipakai — method itu memang tidak
pernah ada). Ini bug lama dari kode yang salah nebak nama API. Dua
pemanggilan itu dihapus; aman karena jsPDF tidak auto-page-break untuk
`doc.text()`/`doc.rect()` manual, dan tinggi kertas struk memang sudah
dihitung pas lewat `estimatedHeight`.

## 2. Halaman Relasi > Supplier disamakan dengan Pelanggan
File: `frontend/src/features/suppliers/PemasokView.tsx`

Ditata ulang mengikuti pola `CustomerView.tsx`: 3 kartu KPI di atas
(total pemasok, total utang, jumlah pemasok tempo), search bar + filter
chip (Semua/Cash/Tempo) dalam wrapper putih, kartu avatar bulat dengan
hover border biru, kotak stat abu-abu (Total Utang & Sales Pemasok),
badge metode bayar di kanan atas.

## 3. Metode Bayar Bon ke Supplier — Tunai jadi 2 opsi
File: `frontend/src/features/finance/FinanceView.tsx` +
`frontend/src/types/purchasing.ts`

Di dialog "Bayar Bon", metode Tunai sekarang dipecah jadi:
- **Tunai Kas** — mengurangi saldo Kas Harian toko (memanggil `addMutation`)
- **Tunai Luar** — tetap tunai tapi bukan dari kas toko (mis. uang
  pribadi), TIDAK memengaruhi Kas Harian
- **Transfer** — tetap seperti semula, tidak memengaruhi kas

Pola ini sama seperti yang sudah dipakai di form "Catat Pengeluaran"
(Tunai Kas / Tunai Luar / Transfer / Giro), jadi sekarang konsisten.

## 4. Kas Harian > Ringkasan Lengkap "belum semua terkoneksi"
Sudah ditelusuri sampai ke akar: dua kategori di situ —
**"Pembelian Stok Lokasi SKU"** dan **"Pembelian Stok di Pemasok"** —
sebenarnya SUDAH terhubung ke kas kalau dicatat manual lewat tombol
"Catat Mutasi" di Kas Harian. Tapi keduanya TIDAK PERNAH otomatis
terisi dari fitur lain, karena:
- Fitur "Lokasi SKU" belum pernah dibangun sama sekali di build ini.
- Form bikin PO di `PurchaseView.tsx` tidak pernah memberi opsi
  bayar tunai langsung saat barang diterima — semua PO selalu jadi
  utang, dan baru masuk kas lewat kategori "Pembayaran Hutang" (yang
  sudah benar) saat dibayar lewat menu Bayar Bon.

Jadi itu bukan bug perhitungan, tapi memang belum ada fitur "beli stok
tunai langsung saat terima barang" yang mengisi kategori itu secara
otomatis. Membangun fitur itu berarti mengubah alur utang/pembayaran PO
(kapan PO dianggap lunas, kapan nambah utang supplier) — saya belum
sentuh karena ini menyangkut logika keuangan yang sebaiknya
dikonfirmasi dulu skema yang diinginkan: misalnya, apakah PO perlu
pilihan "Bayar Tunai Langsung / Tempo" saat dibuat?
