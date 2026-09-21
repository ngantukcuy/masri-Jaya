import type { jsPDF } from 'jspdf';
import { JETBRAINS_MONO_REGULAR_TTF_BASE64, JETBRAINS_MONO_BOLD_TTF_BASE64 } from './jetbrainsMonoBase64';

/**
 * Embeds JetBrains Mono into a jsPDF document so doc.setFont('JetBrainsMono', ...)
 * actually renders in that typeface instead of silently falling back to jsPDF's
 * built-in Helvetica. Must be called once per fresh jsPDF instance, before the
 * first doc.setFont('JetBrainsMono', ...) call.
 */
export function registerReceiptFont(doc: jsPDF): void {
  doc.addFileToVFS('JetBrainsMono-Regular.ttf', JETBRAINS_MONO_REGULAR_TTF_BASE64);
  doc.addFont('JetBrainsMono-Regular.ttf', 'JetBrainsMono', 'normal');
  doc.addFileToVFS('JetBrainsMono-Bold.ttf', JETBRAINS_MONO_BOLD_TTF_BASE64);
  doc.addFont('JetBrainsMono-Bold.ttf', 'JetBrainsMono', 'bold');
}
