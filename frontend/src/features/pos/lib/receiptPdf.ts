import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { SalesInvoice } from '../../../types';
import { savePdfDoc } from '../../../lib/savePdf';

interface StoreProfileLite {
  storeName: string;
  address?: string;
  phone?: string;
  receiptNote?: string;
  taxId?: string;
}

interface StoreProfileFull extends StoreProfileLite {
  taxId?: string;
}

// The PDF uses the same rendered receipt content as ReceiptModal so the
// downloaded/printed PDF cannot drift from the on-screen receipt styling.
export async function generateReceiptPDF(orderDetails: any, storeProfile: StoreProfileLite | undefined, cashierName: string | undefined) {
  const receiptElement = document.querySelector<HTMLElement>('[data-receipt-content="true"]');
  if (!receiptElement) {
    throw new Error('Tampilan struk belum tersedia untuk dibuat menjadi PDF.');
  }

  if (document.fonts?.ready) await document.fonts.ready;
  const canvas = await html2canvas(receiptElement, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
  });
  const pageWidth = 80;
  const pageHeight = Math.max(40, (canvas.height / canvas.width) * pageWidth);
  const doc = new jsPDF({ unit: 'mm', format: [pageWidth, pageHeight] });
  doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, pageHeight);
  await savePdfDoc(doc, `Struk_${orderDetails.invoice}.pdf`);
}

// ---------------------------------------------------------------------------
// Re-print from Riwayat Transaksi (Transaction History)
//
// Unlike generateReceiptPDF above — which reads the POS cart shape
// (item.product + item.selectedPriceType) right after checkout — these two
// work off a persisted SalesInvoice record, whose items are already flat
// ({ name, price, quantity, unit }). Kept separate so the POS checkout flow
// above isn't touched.
// ---------------------------------------------------------------------------

/** Struk Pembelian (purchase receipt) re-printed from a saved SalesInvoice. */
export async function generateInvoiceReceiptPDF(invoice: SalesInvoice, storeProfile: StoreProfileFull | undefined, cashierName: string | undefined) {
  const storeName = storeProfile?.storeName || 'Toko Saya';
  const pageWidth = 80;
  const marginX = 5;
  const contentWidth = pageWidth - marginX * 2;

  const lineHeight = 4.2;
  const itemLines = invoice.items.length * 2;
  const baseLines = 24;
  const estimatedHeight = Math.max(120, (baseLines + itemLines) * lineHeight);

  const doc = new jsPDF({ unit: 'mm', format: [pageWidth, estimatedHeight] });
  let y = 8;

  const center = (text: string, size: number, bold = false) => {
    doc.setFontSize(size);
    doc.setFont('courier', bold ? 'bold' : 'normal');
    doc.text(text, pageWidth / 2, y, { align: 'center' });
    y += lineHeight;
  };

  const row = (left: string, right: string, bold = false, size = 8) => {
    doc.setFontSize(size);
    doc.setFont('courier', bold ? 'bold' : 'normal');
    doc.text(left, marginX, y);
    doc.text(right, pageWidth - marginX, y, { align: 'right' });
    y += lineHeight;
  };

  const dashedLine = () => {
    doc.setLineDashPattern([1, 1], 0);
    doc.line(marginX, y, pageWidth - marginX, y);
    doc.setLineDashPattern([], 0);
    y += lineHeight;
  };

  const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

  center(storeName, 12, true);
  if (storeProfile?.address) center(storeProfile.address, 7);
  if (storeProfile?.phone) center(`Tel: ${storeProfile.phone}`, 7);
  y += 1;
  dashedLine();
  dashedLine();

  row('INVOICE:', invoice.invoiceNumber, true, 7.5);
  row('TANGGAL:', invoice.date, false, 7.5);
  row('KASIR:', cashierName || 'Staff Aktif', false, 7.5);
  dashedLine();

  row('PELANGGAN:', invoice.customerName, false, 7.5);
  row('METODE:', invoice.paymentMethod === 'Cash' ? 'TUNAI' : invoice.paymentMethod === 'Split' ? 'BAYAR SEBAGIAN' : invoice.paymentMethod, false, 7.5);
  if (invoice.paymentMethod === 'Transfer' && invoice.paymentAccountName) {
    row('REKENING:', invoice.paymentAccountName, true, 7.5);
    row('NOMOR:', invoice.paymentAccountNumber || '-', false, 7.5);
    if (invoice.paymentAccountHolder) row('PEMILIK:', invoice.paymentAccountHolder, false, 7.5);
  }
  if (invoice.fulfillmentMethod) {
    row('PENGAMBILAN:', invoice.fulfillmentMethod === 'Delivery' ? 'DIANTAR' : 'AMBIL SENDIRI', false, 7.5);
    if (invoice.fulfillmentMethod === 'Delivery' && invoice.deliveryAddress) {
      doc.setFontSize(7);
      doc.setFont('courier', 'normal');
      const wrapped = doc.splitTextToSize(`Alamat: ${invoice.deliveryAddress}`, contentWidth);
      doc.text(wrapped, marginX, y);
      y += wrapped.length * lineHeight;
    }
  }
  dashedLine();

  invoice.items.forEach((item) => {
    doc.setFontSize(7.5);
    doc.setFont('courier', 'bold');
    const nameLines = doc.splitTextToSize(item.name, contentWidth);
    doc.text(nameLines, marginX, y);
    y += nameLines.length * lineHeight;
    row(`  ${item.quantity} x ${item.bonus ? `${rupiah(item.originalPrice || 0)} BONUS` : rupiah(item.price)}${item.unit ? ` (${item.unit})` : ''}`, rupiah(item.price * item.quantity), false, 7);
  });
  dashedLine();

  const subtotal = invoice.subtotal ?? invoice.items.reduce((acc, it) => acc + it.price * it.quantity, 0);
  row('SUBTOTAL:', rupiah(subtotal), false, 7.5);
  if (invoice.discountAmount) {
    const label = invoice.discountType === 'fixed'
      ? 'DISKON (Rp):'
      : `DISKON (${invoice.discountValue || 0}%):`;
    row(label, `-${rupiah(invoice.discountAmount)}`, false, 7.5);
  }
  const invoiceFees = invoice.additionalFees?.length
    ? invoice.additionalFees
    : [{ name: invoice.additionalFeeName || 'BIAYA TAMBAHAN', amount: invoice.additionalFee ?? 0 }];
  invoiceFees.forEach((fee) => {
    if (fee.amount > 0) row(`${fee.name || 'BIAYA TAMBAHAN'}:`, rupiah(fee.amount), false, 7.5);
  });
  y += 0.5;
  doc.setLineWidth(0.3);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += lineHeight;
  row('TOTAL AKHIR:', rupiah(invoice.total), true, 9);

  if (invoice.paymentMethod === 'Cash' && typeof invoice.cashReceived === 'number') {
    row('TUNAI DITERIMA:', rupiah(invoice.cashReceived), false, 7.5);
    row('KEMBALIAN:', rupiah(invoice.changeAmount || 0), true, 7.5);
  }
  if (invoice.paymentMethod === 'Split' && typeof invoice.splitPaidAmount === 'number') {
    row('DIBAYAR SEKARANG:', rupiah(invoice.splitPaidAmount), false, 7.5);
    row('SISA (PIUTANG):', rupiah(invoice.splitRemainingDebt || 0), true, 7.5);
  }
  y += 2;

  y += 1;
  dashedLine();
  center(storeProfile?.receiptNote || `Terima kasih telah berbelanja di ${storeName}!`, 7);
  center('(Cetak ulang dari Riwayat Transaksi)', 6.5);

  await savePdfDoc(doc, `Struk_${invoice.invoiceNumber}.pdf`);
}

/** Struk Surat Jalan (delivery note) — no prices, includes signature boxes. */
export async function generateDeliveryNotePDF(
  invoice: SalesInvoice,
  storeProfile: StoreProfileFull | undefined,
  itemsOverride?: SalesInvoice['items'],
) {
  const deliveryItems = itemsOverride && itemsOverride.length > 0 ? itemsOverride : invoice.items;
  const storeName = storeProfile?.storeName || 'Toko Saya';
  const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 12;
  const contentWidth = pageWidth - marginX * 2;
  const lineHeight = 5.2;
  let y = 14;

  const setFont = (size: number, bold = false) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
  };

  // Header / letterhead
  setFont(13, true);
  doc.text(storeName, marginX, y);
  y += 5.5;
  setFont(8);
  const contactLine = [storeProfile?.address, storeProfile?.phone ? `Telp: ${storeProfile.phone}` : null].filter(Boolean).join(' • ');
  if (contactLine) {
    const wrapped = doc.splitTextToSize(contactLine, contentWidth);
    doc.text(wrapped, marginX, y);
    y += wrapped.length * 4;
  }
  if (storeProfile?.taxId) {
    doc.text(`NPWP: ${storeProfile.taxId}`, marginX, y);
    y += 4;
  }
  y += 1;
  doc.setLineWidth(0.4);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 7;

  // Title
  setFont(13, true);
  doc.text('SURAT JALAN', pageWidth / 2, y, { align: 'center' });
  y += 5.5;
  setFont(8.5);
  doc.text(`No: SJ-${invoice.invoiceNumber}`, pageWidth / 2, y, { align: 'center' });
  y += 8;

  // Meta info
  setFont(9);
  doc.text('Tanggal', marginX, y);
  doc.text(`: ${invoice.date}`, marginX + 24, y);
  y += lineHeight;
  doc.text('No. Invoice', marginX, y);
  doc.text(`: ${invoice.invoiceNumber}`, marginX + 24, y);
  y += lineHeight;
  doc.text('Kepada', marginX, y);
  doc.text(`: ${invoice.customerName}`, marginX + 24, y);
  y += lineHeight;
  const deliveryText = invoice.fulfillmentMethod === 'Delivery' && invoice.deliveryAddress
    ? invoice.deliveryAddress
    : 'Diambil langsung di toko';
  doc.text('Alamat Kirim', marginX, y);
  const wrappedAddr = doc.splitTextToSize(`: ${deliveryText}`, contentWidth - 24);
  doc.text(wrappedAddr, marginX + 24, y);
  y += wrappedAddr.length * lineHeight;
  y += 3;

  // Items table
  const col = { no: marginX, name: marginX + 10, qty: pageWidth - marginX - 28, unit: pageWidth - marginX - 12 };
  setFont(8.5, true);
  doc.setLineWidth(0.3);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 4.5;
  doc.text('No', col.no, y);
  doc.text('Nama Barang', col.name, y);
  doc.text('Jumlah', col.qty, y, { align: 'right' });
  doc.text('Satuan', col.unit, y);
  y += 2;
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 5;

  setFont(8.5);
  deliveryItems.forEach((item, idx) => {
    const nameLines = doc.splitTextToSize(item.name, col.qty - col.name - 20);
    doc.text(String(idx + 1), col.no, y);
    doc.text(nameLines, col.name, y);
    doc.text(String(item.quantity), col.qty, y, { align: 'right' });
    doc.text(item.unit || '-', col.unit, y);
    y += Math.max(nameLines.length, 1) * lineHeight;
  });
  y += 1;
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 8;

  setFont(7.5);
  doc.text('Barang di atas telah diperiksa dan diterima dalam kondisi baik serta sesuai jumlah.', marginX, y);
  y += 14;

  // Signature boxes
  const boxWidth = contentWidth / 2 - 4;
  setFont(9, true);
  doc.text('Pengirim,', marginX, y);
  doc.text('Penerima,', marginX + boxWidth + 8, y);
  y += 20;
  setFont(8);
  doc.line(marginX, y, marginX + boxWidth, y);
  doc.line(marginX + boxWidth + 8, y, marginX + boxWidth + 8 + boxWidth, y);
  y += 4;
  doc.text('( Nama )', marginX, y);
  doc.text('( Nama )', marginX + boxWidth + 8, y);

  await savePdfDoc(doc, `SuratJalan_${invoice.invoiceNumber}.pdf`);
}
