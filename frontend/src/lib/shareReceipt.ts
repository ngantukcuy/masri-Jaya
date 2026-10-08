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
// - Desktop: gambar disalin ke clipboard (atau diunduh kalau clipboard
//   ditolak), lalu WhatsApp Web dibuka ke nomor pelanggan kalau ada.

import { toBlob } from 'html-to-image';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export type ShareResult = 'shared' | 'copied' | 'downloaded' | 'cancelled';

/** HP/tablet (termasuk iPad yang menyamar sebagai Mac). Desktop = false. */
function isMobileDevice(): boolean {
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

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
  const PAD = 20;

  // Ambil warna latar dialog yang sebenarnya supaya teks tidak "hilang"
  // kalau tema aplikasi bukan putih.
  const dialog = node.closest('[role="dialog"]') as HTMLElement | null;
  const bgRaw = dialog ? getComputedStyle(dialog).backgroundColor : '#ffffff';
  const bg = bgRaw && bgRaw !== 'rgba(0, 0, 0, 0)' ? bgRaw : '#ffffff';

  // Jangan menangkap node aslinya langsung: node itu ada di dalam dialog
  // yang punya animasi/transform dan ukurannya dihitung tanpa padding,
  // akibatnya isi struk terpotong di kanan dan bawah. Sebagai gantinya,
  // salin struk ke wadah di luar layar yang ukurannya sudah termasuk
  // padding, lalu tangkap wadah itu.
  const width = Math.ceil(node.getBoundingClientRect().width);
  const cs = getComputedStyle(node);
  const wrapper = document.createElement('div');
  Object.assign(wrapper.style, {
    position: 'fixed',
    top: '0',
    left: '-100000px',
    boxSizing: 'border-box',
    width: `${width + PAD * 2}px`,
    padding: `${PAD}px`,
    background: bg,
    // Sifat teks yang tadinya diwarisi dari dialog harus disalin manual.
    fontFamily: cs.fontFamily,
    fontSize: cs.fontSize,
    lineHeight: cs.lineHeight,
    letterSpacing: cs.letterSpacing,
    color: cs.color,
  } as Partial<CSSStyleDeclaration>);

  const clone = node.cloneNode(true) as HTMLElement;
  clone.classList.remove('animate-pulse', 'scale-[0.99]', 'border-t-4');
  clone.style.width = '100%';
  clone.style.transform = 'none';
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    // Tunggu font & layout selesai sebelum difoto.
    if ('fonts' in document) await (document as Document & { fonts: FontFaceSet }).fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

    const options = { pixelRatio: 3, backgroundColor: bg, cacheBust: true };
    let blob: Blob | null = null;
    try {
      blob = await toBlob(wrapper, options);
    } catch {
      // Kadang gagal saat menyematkan font eksternal — ulangi tanpa font embed.
      blob = await toBlob(wrapper, { ...options, skipFonts: true });
    }
    if (!blob) throw new Error('Gagal membuat gambar struk.');
    return blob;
  } finally {
    wrapper.remove();
  }
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
  // Sengaja HANYA di HP/tablet. Di desktop (Windows/Mac) Web Share API akan
  // membuka dialog berbagi milik sistem operasi, yang biasanya tidak
  // menawarkan WhatsApp Web — padahal itu yang dibutuhkan di sini.
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (isMobileDevice() && typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text: opts.message });
      return 'shared';
    } catch (err: any) {
      if (err?.name === 'AbortError') return 'cancelled';
      // Gagal untuk alasan lain -> lanjut ke jalur desktop di bawah.
    }
  }

  // --- Desktop: salin gambar ke clipboard + buka WhatsApp Web ---
  // WhatsApp Web tidak punya link untuk melampirkan gambar otomatis, jadi
  // gambar disalin dulu; di chat tinggal tekan Ctrl+V lalu kirim.
  const number = normalizeWhatsAppNumber(opts.phone);
  const waUrl = `https://web.whatsapp.com/send?${number ? `phone=${number}&` : ''}text=${encodeURIComponent(opts.message)}`;

  let copied = false;
  try {
    const ClipboardItemCtor = (window as any).ClipboardItem;
    if (ClipboardItemCtor && navigator.clipboard?.write) {
      await navigator.clipboard.write([new ClipboardItemCtor({ 'image/png': blob })]);
      copied = true;
    }
  } catch {
    // Clipboard ditolak browser — jatuh ke unduh file di bawah.
  }

  if (!copied) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = opts.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  window.open(waUrl, '_blank', 'noopener');
  return copied ? 'copied' : 'downloaded';
}
