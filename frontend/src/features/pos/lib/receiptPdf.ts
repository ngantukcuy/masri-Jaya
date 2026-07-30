import { jsPDF } from 'jspdf';
import { SalesInvoice } from '../../../types';

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

// Kept loose (any) to match the shape POSView builds lastOrderDetails in —
// see executeFinalCheckout in POSView.tsx.
export function generateReceiptPDF(orderDetails: any, storeProfile: StoreProfileLite | undefined, cashierName: string | undefined) {
  const storeName = storeProfile?.storeName || 'Toko Saya';
  const pageWidth = 80; // mm — matches common 80mm thermal paper width
  const marginX = 5;
  const contentWidth = pageWidth - marginX * 2;

  // Estimate page height from content so the PDF isn't mostly blank space,
  // then create the doc once we know it.
  const lineHeight = 4.2;
  const itemLines = orderDetails.items.length * 2; // name line + qty/price line
  const baseLines = 26; // header, meta rows, totals, footer, spacing
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

  // Header
  center(storeName, 12, true);
  if (storeProfile?.address) center(storeProfile.address, 7);
  if (storeProfile?.phone) center(`Tel: ${storeProfile.phone}`, 7);
  if (storeProfile?.taxId) center(`NPWP: ${storeProfile.taxId}`, 7);
  y += 1;
  dashedLine();

  // Meta
  row('INVOICE:', orderDetails.invoice, true, 7.5);
  row('TANGGAL:', orderDetails.date, false, 7.5);
  row('PELANGGAN:', orderDetails.customerName, false, 7.5);
  row('METODE:', orderDetails.paymentMethod === 'Cash' ? 'TUNAI' : orderDetails.paymentMethod, false, 7.5);
  if (orderDetails.fulfillmentMethod) {
    row('PENGAMBILAN:', orderDetails.fulfillmentMethod === 'Delivery' ? 'DIANTAR' : 'AMBIL SENDIRI', false, 7.5);
    if (orderDetails.fulfillmentMethod === 'Delivery' && orderDetails.deliveryAddress) {
      doc.setFontSize(7);
      doc.setFont('courier', 'normal');
      const wrapped = doc.splitTextToSize(`Alamat: ${orderDetails.deliveryAddress}`, contentWidth);
      doc.text(wrapped, marginX, y);
      y += wrapped.length * lineHeight;
    }
  }
  dashedLine();

  // Items
  orderDetails.items.forEach((item: any) => {
    const price = typeof item.customPrice === 'number' && item.customPrice > 0
      ? item.customPrice
      : item.selectedPriceType === 'retail' ? item.product.retailPrice :
        item.selectedPriceType === 'wholesale' ? item.product.wholesalePrice :
        item.product.projectPrice;
    doc.setFontSize(7.5);
    doc.setFont('courier', 'bold');
    const nameLines = doc.splitTextToSize(item.product.name, contentWidth);
    doc.text(nameLines, marginX, y);
    y += nameLines.length * lineHeight;
    row(`  ${item.quantity} x ${rupiah(price)} (${item.product.unit})`, rupiah(price * item.quantity), false, 7);
  });
  dashedLine();

  // Totals
  row('SUBTOTAL:', rupiah(orderDetails.subtotal), false, 7.5);
  if (orderDetails.discount > 0) {
    const label = orderDetails.discountType === 'fixed'
      ? 'DISKON (Rp):'
      : `DISKON (${orderDetails.discountValue || 0}%):`;
    row(label, `-${rupiah(orderDetails.discount)}`, false, 7.5);
  }
  y += 0.5;
  doc.setLineWidth(0.3);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += lineHeight;
  row('TOTAL AKHIR:', rupiah(orderDetails.total), true, 9);
  y += 2;

  // if (orderDetails.pointsEarned) {
  //   center(`+${orderDetails.pointsEarned} Poin Loyalitas`, 7.5, true);
  // }

  y += 1;
  dashedLine();
  center(storeProfile?.receiptNote || `Terima kasih telah berbelanja di ${storeName}!`, 7);
  center(`Kasir: ${cashierName || 'Staff Aktif'}`, 7);

  doc.save(`Struk_${orderDetails.invoice}.pdf`);
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
export function generateInvoiceReceiptPDF(invoice: SalesInvoice, storeProfile: StoreProfileFull | undefined, cashierName: string | undefined) {
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
  if (storeProfile?.taxId) center(`NPWP: ${storeProfile.taxId}`, 7);
  y += 1;
  dashedLine();

  row('INVOICE:', invoice.invoiceNumber, true, 7.5);
  row('TANGGAL:', invoice.date, false, 7.5);
  row('PELANGGAN:', invoice.customerName, false, 7.5);
  row('METODE:', invoice.paymentMethod === 'Cash' ? 'TUNAI' : invoice.paymentMethod, false, 7.5);
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
    row(`  ${item.quantity} x ${rupiah(item.price)}${item.unit ? ` (${item.unit})` : ''}`, rupiah(item.price * item.quantity), false, 7);
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
  y += 0.5;
  doc.setLineWidth(0.3);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += lineHeight;
  row('TOTAL AKHIR:', rupiah(invoice.total), true, 9);
  y += 2;

  y += 1;
  dashedLine();
  center(storeProfile?.receiptNote || `Terima kasih telah berbelanja di ${storeName}!`, 7);
  center(`Kasir: ${cashierName || 'Staff Aktif'}`, 7);
  center('(Cetak ulang dari Riwayat Transaksi)', 6.5);

  doc.save(`Struk_${invoice.invoiceNumber}.pdf`);
}

/** Struk Surat Jalan (delivery note) — no prices, includes signature boxes. */
export function generateDeliveryNotePDF(invoice: SalesInvoice, storeProfile: StoreProfileFull | undefined, itemsOverride?: SalesInvoice['items']) {
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
  doc.text('( Nama & Tanggal )', marginX, y);
  doc.text('( Nama & Tanggal )', marginX + boxWidth + 8, y);

  doc.save(`SuratJalan_${invoice.invoiceNumber}.pdf`);
}
