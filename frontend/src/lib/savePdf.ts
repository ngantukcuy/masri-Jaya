import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { jsPDF } from 'jspdf';

/**
 * Save a jsPDF document to a file, using whichever mechanism actually works
 * on the current platform:
 * - Web (regular browser): jsPDF's own `.save()` triggers a normal browser
 *   download — no extra plugins needed.
 * - Native app (Android/iOS via Capacitor): plain browser downloads don't
 *   exist there, so instead we write the PDF into the app's cache
 *   directory and open the native Share sheet, letting the user save it to
 *   Downloads, send it via WhatsApp, print it, etc.
 */
export async function savePdfDoc(doc: jsPDF, filename: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    doc.save(filename);
    return;
  }

  // jsPDF's data URI is always in the form
  // `data:application/pdf;filename=...;base64,<data>` — everything after
  // the single comma is the base64 payload Filesystem.writeFile wants.
  const dataUri = doc.output('datauristring');
  const base64 = dataUri.split(',')[1] ?? '';

  const written = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Cache,
  });

  try {
    const { value: canShare } = await Share.canShare();
    if (canShare) {
      await Share.share({
        title: filename,
        url: written.uri,
        dialogTitle: `Simpan atau bagikan ${filename}`,
      });
    }
  } catch {
    // Sharing isn't available on this device — the file is still safely
    // written to the app's cache directory even without a share sheet.
  }
}
