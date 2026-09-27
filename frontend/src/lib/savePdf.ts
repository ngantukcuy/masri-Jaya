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

/**
 * Send a jsPDF document straight to a printer, instead of just saving it.
 *
 * This exists specifically for iPad/iPhone Safari (and any browser without
 * Web Bluetooth/WebUSB support): there is no way to open a raw socket to a
 * thermal printer from a web page there, so the only path to that printer
 * is the OS's own print pipeline — AirPrint on iOS. Printing the *live DOM*
 * via `window.print()` + `@page` CSS is what used to be used for this, but
 * mobile print pipelines frequently ignore `@page { size }` and fall back
 * to a default page (landscape Letter/A4), which is exactly why receipts
 * were coming out sideways with huge margins/blank tails. A PDF's page
 * size is embedded in the file itself, so it survives that pipeline
 * correctly — printing a 58mm-tall-as-needed PDF prints as a 58mm receipt.
 *
 * - Web (regular browser, incl. iPad/iPhone Safari): open the PDF in a new
 *   tab with `autoPrint()` set. Chromium-based browsers honor `autoPrint()`
 *   and pop the print dialog immediately; Safari's built-in PDF viewer does
 *   not run it, but the user can still tap Share → Print from there, and
 *   the AirPrint job will use the PDF's exact embedded page size.
 * - Native app (Capacitor): there's no direct "print" API without a native
 *   plugin, so fall back to the Share sheet, which offers "Print" as one of
 *   its options (also AirPrint-backed on iOS).
 */
export async function printPdfDoc(doc: jsPDF, filename: string): Promise<void> {
  doc.autoPrint();

  if (!Capacitor.isNativePlatform()) {
    window.open(doc.output('bloburl'), '_blank');
    return;
  }

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
        dialogTitle: `Cetak ${filename}`,
      });
      return;
    }
  } catch {
    // fall through to opening the file below
  }
  window.open(written.uri, '_blank');
}
