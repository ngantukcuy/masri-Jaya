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
  // ReceiptModal is a browser DOM surface and can be hidden behind the dialog
  // portal when html2canvas runs, which produces a valid but white PDF. Use
  // the deterministic invoice renderer for the downloadable receipt instead.
  const invoice: SalesInvoice = {
    invoiceNumber: orderDetails.invoice,
    customerName: orderDetails.customerName,
    date: orderDetails.date,
    items: orderDetails.items.map((item: any) => {
      const originalPrice = item.customPrice || (item.selectedPriceType === 'retail'
        ? item.product.retailPrice
        : item.selectedPriceType === 'wholesale' ? item.product.wholesalePrice : item.product.projectPrice);
      return {
        sku: item.product.sku,
        name: item.product.name,
        quantity: item.quantity,
        price: item.bonus ? 0 : originalPrice,
        originalPrice,
        unit: item.product.unit,
        bonus: item.bonus,
      };
    }),
    total: orderDetails.total,
    paymentMethod: orderDetails.paymentMethod,
    subtotal: orderDetails.subtotal,
    discountAmount: orderDetails.discount,
    discountType: orderDetails.discountType,
    discountValue: orderDetails.discountValue,
    additionalFees: orderDetails.additionalFees,
    additionalFeeName: orderDetails.additionalFeeName,
    additionalFee: orderDetails.additionalFee,
    fulfillmentMethod: orderDetails.fulfillmentMethod,
    deliveryAddress: orderDetails.deliveryAddress,
    cashReceived: orderDetails.cashReceived,
    changeAmount: orderDetails.changeAmount,
    splitPaidAmount: orderDetails.splitPaidAmount,
    splitRemainingDebt: orderDetails.splitRemainingDebt,
    paymentAccountName: orderDetails.transferAccount?.name,
    paymentAccountNumber: orderDetails.transferAccount?.accountNumber,
    paymentAccountHolder: orderDetails.transferAccount?.holderName,
  };
  await generateInvoiceReceiptPDF(invoice, storeProfile, cashierName);
  return;

  const receiptElement = document.querySelector<HTMLElement>('[data-receipt-content="true"]') as HTMLElement;
  if (!receiptElement) {
    throw new Error('Tampilan struk belum tersedia untuk dibuat menjadi PDF.');
  }

  if (document.fonts?.ready) await document.fonts.ready;
  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(receiptElement, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
    });
  } catch (standardRenderError) {
    console.warn('[receiptPdf] Snapshot standar gagal, mencoba renderer browser:', standardRenderError);
    try {
      canvas = await html2canvas(receiptElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        foreignObjectRendering: true,
        logging: false,
      });
    } catch (browserRenderError) {
      console.error('[receiptPdf] Snapshot modal gagal, memakai fallback PDF teks:', browserRenderError);
      const fallbackInvoice: SalesInvoice = {
        invoiceNumber: orderDetails.invoice,
        customerName: orderDetails.customerName,
        date: orderDetails.date,
        items: orderDetails.items.map((item: any) => ({
          sku: item.product.sku,
          name: item.product.name,
          quantity: item.quantity,
          price: item.bonus ? 0 : (item.customPrice || (item.selectedPriceType === 'retail' ? item.product.retailPrice : item.selectedPriceType === 'wholesale' ? item.product.wholesalePrice : item.product.projectPrice)),
          originalPrice: item.customPrice || (item.selectedPriceType === 'retail' ? item.product.retailPrice : item.selectedPriceType === 'wholesale' ? item.product.wholesalePrice : item.product.projectPrice),
          unit: item.product.unit,
          bonus: item.bonus,
        })),
        total: orderDetails.total,
        paymentMethod: orderDetails.paymentMethod,
        subtotal: orderDetails.subtotal,
        discountAmount: orderDetails.discount,
        discountType: orderDetails.discountType,
        discountValue: orderDetails.discountValue,
        additionalFees: orderDetails.additionalFees,
        additionalFeeName: orderDetails.additionalFeeName,
        additionalFee: orderDetails.additionalFee,
        fulfillmentMethod: orderDetails.fulfillmentMethod,
        deliveryAddress: orderDetails.deliveryAddress,
        cashReceived: orderDetails.cashReceived,
        changeAmount: orderDetails.changeAmount,
        splitPaidAmount: orderDetails.splitPaidAmount,
        splitRemainingDebt: orderDetails.splitRemainingDebt,
        paymentAccountName: orderDetails.transferAccount?.name,
        paymentAccountNumber: orderDetails.transferAccount?.accountNumber,
        paymentAccountHolder: orderDetails.transferAccount?.holderName,
      };
      await generateInvoiceReceiptPDF(fallbackInvoice, storeProfile, cashierName);
      return;
    }
  }
  const pageWidth = 80;
  const pixelData = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data;
  const pixels = pixelData ?? new Uint8ClampedArray();
  const hasVisibleContent = pixels.length > 0 && Array.from({ length: Math.floor(pixels.length / 4) }, (_, index) => index * 4)
    .some((index) => pixels[index] < 245 || pixels[index + 1] < 245 || pixels[index + 2] < 245);
  if (!hasVisibleContent) {
    console.warn('[receiptPdf] Snapshot struk kosong, memakai fallback PDF teks.');
    const fallbackInvoice: SalesInvoice = {
      invoiceNumber: orderDetails.invoice,
      customerName: orderDetails.customerName,
      date: orderDetails.date,
      items: orderDetails.items.map((item: any) => ({
        sku: item.product.sku,
        name: item.product.name,
        quantity: item.quantity,
        price: item.bonus ? 0 : (item.customPrice || (item.selectedPriceType === 'retail' ? item.product.retailPrice : item.selectedPriceType === 'wholesale' ? item.product.wholesalePrice : item.product.projectPrice)),
        originalPrice: item.customPrice || (item.selectedPriceType === 'retail' ? item.product.retailPrice : item.selectedPriceType === 'wholesale' ? item.product.wholesalePrice : item.product.projectPrice),
        unit: item.product.unit,
        bonus: item.bonus,
      })),
      total: orderDetails.total,
      paymentMethod: orderDetails.paymentMethod,
      subtotal: orderDetails.subtotal,
      discountAmount: orderDetails.discount,
      discountType: orderDetails.discountType,
      discountValue: orderDetails.discountValue,
      additionalFees: orderDetails.additionalFees,
      additionalFeeName: orderDetails.additionalFeeName,
      additionalFee: orderDetails.additionalFee,
      fulfillmentMethod: orderDetails.fulfillmentMethod,
      deliveryAddress: orderDetails.deliveryAddress,
      cashReceived: orderDetails.cashReceived,
      changeAmount: orderDetails.changeAmount,
      splitPaidAmount: orderDetails.splitPaidAmount,
      splitRemainingDebt: orderDetails.splitRemainingDebt,
      paymentAccountName: orderDetails.transferAccount?.name,
      paymentAccountNumber: orderDetails.transferAccount?.accountNumber,
      paymentAccountHolder: orderDetails.transferAccount?.holderName,
    };
    await generateInvoiceReceiptPDF(fallbackInvoice, storeProfile, cashierName);
    return;
  }
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

/** Struk Pembelian (purchase receipt) rendered from a saved SalesInvoice — used both right after checkout and when re-printing from Riwayat Transaksi (isReprint controls the "Cetak ulang" footer note). */
export async function generateInvoiceReceiptPDF(invoice: SalesInvoice, storeProfile: StoreProfileFull | undefined, cashierName: string | undefined, isReprint = false) {
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

  // Warna aksen sama persis dengan struk on-screen (ReceiptModal): biru
  // untuk info toko/metode bayar, hijau untuk kembalian, hitam untuk sisanya.
  const COLOR_PRIMARY: [number, number, number] = [37, 99, 235]; // #2563eb
  const COLOR_EMERALD: [number, number, number] = [5, 150, 105]; // #059669
  const COLOR_BLACK: [number, number, number] = [17, 24, 39]; // #111827

  const center = (text: string, size: number, bold = false, color: [number, number, number] = COLOR_BLACK) => {
    doc.setFontSize(size);
    doc.setFont('JetBrains Mono', bold ? 'bold' : 'normal');
    doc.setTextColor(...color);
    doc.text(text, pageWidth / 2, y, { align: 'center' });
    y += lineHeight;
  };

  const row = (left: string, right: string, bold = false, size = 8, color: [number, number, number] = COLOR_BLACK) => {
    doc.setFontSize(size);
    doc.setFont('JetBrains Mono', bold ? 'bold' : 'normal');
    doc.setTextColor(...color);
    doc.text(left, marginX, y);
    doc.text(right, pageWidth - marginX, y, { align: 'right' });
    y += lineHeight;
  };

  const dashedLine = () => {
    doc.setDrawColor(150, 150, 150);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(marginX, y, pageWidth - marginX, y);
    doc.setLineDashPattern([], 0);
    doc.setDrawColor(0, 0, 0);
    y += lineHeight;
  };

  const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

  center(storeName, 13, true);
  if (storeProfile?.address) center(storeProfile.address, 7, false, COLOR_PRIMARY);
  if (storeProfile?.phone) center(`Tel: ${storeProfile.phone}`, 7, false, COLOR_PRIMARY);
  y += 0.5;
  center('STRUK PEMBELIAN', 8, true, COLOR_PRIMARY);
  y += 0.5;
  dashedLine();

  row('Invoice:', invoice.invoiceNumber, true, 7.5);
  row('Tanggal:', invoice.date, false, 7.5);
  row('Kasir:', cashierName || 'Staff Aktif', false, 7.5);
  row('Pelanggan:', invoice.customerName, false, 7.5);
  if (invoice.driverName) row('Sopir:', invoice.driverName, false, 7.5);
  row('Metode:', invoice.paymentMethod === 'Cash' ? 'TUNAI' : invoice.paymentMethod === 'Split' ? 'BAYAR SEBAGIAN' : invoice.paymentMethod, true, 7.5, COLOR_PRIMARY);
  if (invoice.paymentMethod === 'Transfer' && invoice.paymentAccountName) {
    row('Rekening:', invoice.paymentAccountName, true, 7.5);
    row('Nomor:', invoice.paymentAccountNumber || '-', false, 7.5);
    if (invoice.paymentAccountHolder) row('PEMILIK:', invoice.paymentAccountHolder, false, 7.5);
  }
  if (invoice.fulfillmentMethod) {
    row('Pengambilan:', invoice.fulfillmentMethod === 'Delivery' ? 'DIANTAR' : 'AMBIL SENDIRI', true, 7.5);
    if (invoice.fulfillmentMethod === 'Delivery' && invoice.deliveryAddress) {
      doc.setFontSize(7.5);
      doc.setFont('JetBrains Mono', 'normal');
      doc.setTextColor(...COLOR_BLACK);
      const wrapped = doc.splitTextToSize(invoice.deliveryAddress, contentWidth - 20);
      doc.text('Alamat:', marginX, y);
      doc.text(wrapped, pageWidth - marginX, y, { align: 'right' });
      y += wrapped.length * lineHeight;
    }
  }
  dashedLine();

  invoice.items.forEach((item) => {
    doc.setFontSize(7.5);
    doc.setFont('JetBrains Mono', 'bold');
    doc.setTextColor(...COLOR_BLACK);
    const nameLines = doc.splitTextToSize(item.name, contentWidth);
    doc.text(nameLines, marginX, y);
    y += nameLines.length * lineHeight;
    row(`  ${item.quantity} x ${item.bonus ? `${rupiah(item.originalPrice || 0)} BONUS` : rupiah(item.price)}${item.unit ? ` (${item.unit})` : ''}`, rupiah(item.price * item.quantity), false, 7);
  });
  dashedLine();

  const subtotal = invoice.subtotal ?? invoice.items.reduce((acc, it) => acc + it.price * it.quantity, 0);
  row('Subtotal:', rupiah(subtotal), false, 7.5);
  if (invoice.discountAmount) {
    const label = invoice.discountType === 'fixed'
      ? 'Diskon (Rp):'
      : `Diskon (${invoice.discountValue || 0}%):`;
    row(label, `-${rupiah(invoice.discountAmount)}`, false, 7.5);
  }
  const invoiceFees = invoice.additionalFees?.length
    ? invoice.additionalFees
    : [{ name: invoice.additionalFeeName || 'Biaya Tambahan', amount: invoice.additionalFee ?? 0 }];
  const namedFees = invoiceFees.filter((fee) => fee.amount > 0);
  if (namedFees.length > 0) {
    namedFees.forEach((fee) => row(`${fee.name || 'Biaya Tambahan'}:`, rupiah(fee.amount), false, 7.5));
  } else {
    // Selalu tampilkan baris ini (walau Rp 0) — sama seperti struk referensi.
    row('Biaya Tambahan:', rupiah(0), false, 7.5);
  }
  y += 0.5;
  doc.setLineWidth(0.3);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += lineHeight;
  row('Total Akhir:', rupiah(invoice.total), true, 9);

  if (invoice.paymentMethod === 'Cash' && typeof invoice.cashReceived === 'number') {
    row('Tunai Diterima:', rupiah(invoice.cashReceived), false, 7.5);
    row('Kembalian:', rupiah(invoice.changeAmount || 0), true, 7.5, COLOR_EMERALD);
  }
  if (invoice.paymentMethod === 'Split' && typeof invoice.splitPaidAmount === 'number') {
    row('Dibayar Sekarang:', rupiah(invoice.splitPaidAmount), false, 7.5);
    row('Sisa (Piutang):', rupiah(invoice.splitRemainingDebt || 0), true, 7.5);
    row('Jatuh Tempo:', invoice.splitDueDate ? new Date(`${invoice.splitDueDate}T00:00:00`).toLocaleDateString('id-ID') : '-', false, 7.5);
  }
  y += 2;

  y += 1;
  dashedLine();
  center(storeProfile?.receiptNote || `Terima kasih telah berbelanja di ${storeName}!`, 7);
  if (isReprint) center('(Cetak ulang dari Riwayat Transaksi)', 6.5);

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
    doc.setFont('JetBrains Mono', bold ? 'bold' : 'normal');
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
  const boxWidth = contentWidth / 3 - 5;
  setFont(9, true);
  const secondBoxX = marginX + boxWidth + 7.5;
  const thirdBoxX = secondBoxX + boxWidth + 7.5;
  doc.text('Sopir,', marginX, y);
  doc.text('Pemeriksa,', secondBoxX, y);
  doc.text('Penerima,', thirdBoxX, y);
  y += 20;
  setFont(8);
  doc.line(marginX, y, marginX + boxWidth, y);
  doc.line(secondBoxX, y, secondBoxX + boxWidth, y);
  doc.line(thirdBoxX, y, thirdBoxX + boxWidth, y);
  y += 8;
  if (invoice.driverName) {
    doc.text(`${invoice.driverName}`, marginX + 24, y);
    y += lineHeight;
  }
  doc.text('( Nama )', secondBoxX, y);
  doc.text('( Nama )', thirdBoxX, y);

  await savePdfDoc(doc, `SuratJalan_${invoice.invoiceNumber}.pdf`);
}
