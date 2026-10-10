// Kecilkan foto produk LAMA yang sudah terlanjur diunggah sebesar aslinya.
// (Foto baru sudah otomatis dikecilkan di uploadProductImage.)
//
// Per produk: unduh foto -> kecilkan -> unggah sebagai file baru -> ganti URL
// foto di produk. File lama di Storage sengaja TIDAK dihapus (bisa dipakai
// produk lain); aman dibersihkan manual dari dashboard Supabase kalau perlu.

import { db } from './db/repos';
import { compressImage } from './compressImage';
import { uploadProductImage } from './uploadProductImage';

// Hanya foto produk di bucket kita; QRIS & bukti (subfolder) tidak disentuh.
const PRODUCT_PHOTO_MARKER = '/storage/v1/object/public/product-images/';
const SKIP_FOLDERS = ['qris/', 'bukti-'];
// Foto yang sudah di bawah ukuran ini dianggap cukup ringan.
const MIN_SIZE_TO_OPTIMIZE = 150 * 1024;

export interface OptimizeResult {
  total: number;
  optimized: number;
  skipped: number;
  failed: number;
  savedBytes: number;
}

function isOurProductPhoto(url: string | undefined): url is string {
  if (!url) return false;
  const idx = url.indexOf(PRODUCT_PHOTO_MARKER);
  if (idx === -1) return false;
  const path = url.slice(idx + PRODUCT_PHOTO_MARKER.length);
  return !SKIP_FOLDERS.some((folder) => path.startsWith(folder));
}

export async function optimizeProductPhotos(
  onProgress: (done: number, total: number) => void
): Promise<OptimizeResult> {
  const candidates = db.products.snapshot().filter((p) => isOurProductPhoto(p.image));
  const result: OptimizeResult = { total: candidates.length, optimized: 0, skipped: 0, failed: 0, savedBytes: 0 };

  for (let i = 0; i < candidates.length; i++) {
    const product = candidates[i];
    try {
      const response = await fetch(product.image);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();

      if (blob.size <= MIN_SIZE_TO_OPTIMIZE) {
        result.skipped++;
      } else {
        const original = new File([blob], `${product.sku}.jpg`, { type: blob.type || 'image/jpeg' });
        const compressed = await compressImage(original, { maxDimension: 800, quality: 0.8 });

        // Tidak lebih kecil secara berarti -> biarkan.
        if (compressed === original || compressed.size > blob.size * 0.8) {
          result.skipped++;
        } else {
          const newUrl = await uploadProductImage(compressed);

          // Baca ulang produk TEPAT sebelum menulis: stok/harga bisa berubah
          // karena ada penjualan selama proses ini berjalan. Hanya foto yang diganti.
          const latest = db.products.snapshot().find((p) => p.sku === product.sku);
          if (!latest || latest.image !== product.image) {
            result.skipped++;
          } else {
            await db.products.upsert([{ ...latest, image: newUrl }]);
            result.optimized++;
            result.savedBytes += blob.size - compressed.size;
          }
        }
      }
    } catch {
      result.failed++;
    }
    onProgress(i + 1, candidates.length);
  }
  return result;
}
