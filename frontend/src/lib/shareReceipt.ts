// Bagikan struk sebagai GAMBAR (PNG) — tampilannya diambil langsung dari
// struk on-screen di ReceiptModal, jadi hasilnya sama persis dengan yang
// terlihat di layar (nama toko tidak terpotong, tata letak rapi), tidak
// lewat PDF 58mm yang dirender ulang terpisah.
//
// Jalur per platform:
// - APK (Capacitor): gambar ditulis ke cache lalu dibuka lewat share sheet
//   Android — tinggal pilih WhatsApp, lalu pilih kontak pelanggan.
// - HP/tablet (browser): Web Share API dengan file gambar, hasilnya juga
//   share sheet yang menawarkan WhatsApp.
// - Desktop/browser tanpa dukungan share file: gambar diunduh, lalu WhatsApp
//   Web dibuka (ke nomor pelanggan kalau ada) untuk dilampirkan manual.

import { toBlob } from 'html-to-image';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export type ShareResult = 'shared' | 'downloaded' | 'cancelled';

/** Nomor WA Indonesia: buang karakter non-angka, 08xx -> 628xx. */
export function normalizeWhatsAppNumber(raw?: string): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith('8')) digits = `62${digits}`;
  return digits.length >= 9 ? digits : null;
}

async function renderReceiptBlob(node: HTMLElement): Promise<Blob> {
  // Ambil warna latar dialog yang sebenarnya supaya teks tidak "hilang"
  // kalau tema aplikasi bukan putih.
  const dialog = node.closest('[role="dialog"]') as HTMLElement | null;
  const bg = dialog ? getComputedStyle(dialog).backgroundColor : '#ffffff';
  const options = {
    pixelRatio: 3, // tajam saat dibuka di WhatsApp
    backgroundColor: bg && bg !== 'rgba(0, 0, 0, 0)' ? bg : '#ffffff',
    style: { padding: '20px', margin: '0', animation: 'none', transform: 'none' },
    cacheBust: true,
  };
  let blob: Blob | null = null;
  try {
    blob = await toBlob(node, options);
  } catch {
    // Kadang gagal saat menyematkan font eksternal — ulangi tanpa font embed.
    blob = await toBlob(node, { ...options, skipFonts: true });
  }
  if (!blob) throw new Error('Gagal membuat gambar struk.');
  return blob;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function shareReceiptImage(
  node: HTMLElement,
  opts: { filename: string; message: string; phone?: string }
): Promise<ShareResult> {
  const blob = await renderReceiptBlob(node);

  // --- APK ---
  if (Capacitor.isNativePlatform()) {
    const written = await Filesystem.writeFile({
      path: opts.filename,
      data: await blobToBase64(blob),
      directory: Directory.Cache,
    });
    try {
      await Share.share({
        title: opts.filename,
        text: opts.message,
        files: [written.uri],
        dialogTitle: 'Bagikan struk ke WhatsApp',
      });
      return 'shared';
    } catch (err: any) {
      // User menutup share sheet tanpa memilih apa pun.
      if (/cancel/i.test(String(err?.message))) return 'cancelled';
      throw err;
    }
  }

  const file = new File([blob], opts.filename, { type: 'image/png' });

  // --- Browser HP/tablet: Web Share API dengan file ---
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text: opts.message });
      return 'shared';
    } catch (err: any) {
      if (err?.name === 'AbortError') return 'cancelled';
      // Gagal untuk alasan lain -> lanjut ke jalur unduh di bawah.
    }
  }

  // --- Fallback desktop: unduh gambar + buka WhatsApp Web ---
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = opts.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);

  const number = normalizeWhatsAppNumber(opts.phone);
  const waUrl = `https://wa.me/${number ?? ''}?text=${encodeURIComponent(opts.message)}`;
  window.open(waUrl, '_blank', 'noopener');
  return 'downloaded';
}
