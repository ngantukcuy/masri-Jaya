import { jsPDF } from 'jspdf';

interface StoreProfileLite {
  storeName: string;
  address?: string;
  phone?: string;
  receiptNote?: string;
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
    const price = item.selectedPriceType === 'retail' ? item.product.retailPrice :
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

  if (orderDetails.pointsEarned) {
    center(`+${orderDetails.pointsEarned} Poin Loyalitas`, 7.5, true);
  }

  y += 1;
  dashedLine();
  center(storeProfile?.receiptNote || `Terima kasih telah berbelanja di ${storeName}!`, 7);
  center(`Kasir: ${cashierName || 'Staff Aktif'}`, 7);

  doc.save(`Struk_${orderDetails.invoice}.pdf`);
}
