import { supabase } from './supabase';

const BUCKET = 'product-images';
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB, ditegakkan juga di level bucket (lihat backend/supabase/schema.sql)

/**
 * Uploads a product image file to Supabase Storage and returns its public
 * URL. Used by the "upload dari perangkat" option on the product image
 * field (as an alternative to pasting an image URL directly).
 *
 * Files are stored under `<timestamp>-<sanitized-filename>` inside the
 * `product-images` bucket so re-uploads never collide.
 */
export async function uploadProductImage(file: File): Promise<string> {
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error('Ukuran gambar maksimal 5MB.');
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('File yang dipilih bukan gambar.');
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${Date.now()}-${safeName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    throw new Error(`Upload gagal: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
