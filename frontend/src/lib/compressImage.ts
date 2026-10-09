// Kecilkan foto sebelum diunggah ke Supabase Storage.
//
// Foto langsung dari kamera HP biasanya 3–5 MB (4000×3000 px), padahal
// kartu produk di Kasir cuma menampilkannya ~150 px. Memuat dan men-decode
// puluhan foto sebesar itu adalah penyebab utama layar Kasir terasa berat
// di HP. Di sini foto diperkecil dulu di perangkat sebelum diunggah.

export interface CompressOptions {
  /** Sisi terpanjang maksimal (px). */
  maxDimension: number;
  /** Kualitas 0–1 untuk WebP/JPEG. */
  quality: number;
}

const SKIP_TYPES = new Set(['image/gif', 'image/svg+xml']);

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Mengembalikan file yang sudah diperkecil. Kalau gagal / tidak ada
 * untungnya, mengembalikan file asli — jadi aman dipakai di jalur upload.
 */
export async function compressImage(file: File, { maxDimension, quality }: CompressOptions): Promise<File> {
  if (SKIP_TYPES.has(file.type) || typeof createImageBitmap !== 'function') return file;

  try {
    // imageOrientation: foto HP yang "miring" lewat EXIF tetap tegak.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));

    // Sudah kecil dan ukuran file sudah ringan -> biarkan apa adanya.
    if (scale === 1 && file.size <= 150 * 1024) {
      bitmap.close?.();
      return file;
    }

    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    // Latar putih supaya PNG transparan tidak jadi hitam saat jadi JPEG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    // WebP lebih kecil; kalau browser tidak mendukung, canvas otomatis
    // menghasilkan PNG dan kita jatuh ke JPEG.
    let blob = await canvasToBlob(canvas, 'image/webp', quality);
    let ext = 'webp';
    if (!blob || blob.type !== 'image/webp') {
      blob = await canvasToBlob(canvas, 'image/jpeg', quality);
      ext = 'jpg';
    }
    if (!blob || blob.size >= file.size) return file; // tidak lebih kecil -> pakai asli

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'foto';
    return new File([blob], `${baseName}.${ext}`, { type: blob.type, lastModified: Date.now() });
  } catch {
    return file;
  }
}
