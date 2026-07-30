// ---- Sales Invoice (used for lookup on Retur Penjualan) ----
export interface SalesInvoiceItem {
  sku: string;
  name: string;
  quantity: number;
  price: number;
  unit?: string;
}

export interface SalesInvoice {
  invoiceNumber: string;
  customerName: string;
  customerId?: string;
  date: string;
  /** ISO timestamp (new Date().toISOString()), used for accurate reporting/aggregation. */
  createdAt?: string;
  items: SalesInvoiceItem[];
  total: number;
  paymentMethod: string;
  /** Line-item total before discount. Optional for backward compatibility with older records. */
  subtotal?: number;
  /** Rupiah amount actually deducted (already resolved from percent or fixed mode). */
  discountAmount?: number;
  discountType?: 'percent' | 'fixed';
  /** Raw value the cashier entered — a percent (0-100) or a flat Rupiah amount, depending on discountType. */
  discountValue?: number;
  fulfillmentMethod?: 'Pickup' | 'Delivery';
  /** Only meaningful when fulfillmentMethod is 'Delivery'. */
  deliveryAddress?: string;
  /** Only meaningful when paymentMethod is 'Cash': amount of physical cash
   * the cashier received from the customer. */
  cashReceived?: number;
  /** Only meaningful when paymentMethod is 'Cash': change given back
   * (cashReceived - total). */
  changeAmount?: number;
  /** Only meaningful when paymentMethod is 'Split': amount paid at
   * checkout time. */
  splitPaidAmount?: number;
  /** Only meaningful when paymentMethod is 'Split': remaining amount
   * recorded as the customer's receivable/debt (piutang). */
  splitRemainingDebt?: number;
}

// ---- Retur (Sales & Purchase Returns) ----
export interface ReturnItem {
  sku: string;
  name: string;
  quantity: number;
  condition: 'Baik' | 'Rusak';
  price: number;
}

export interface ReturnRecord {
  id: string;
  type: 'Penjualan' | 'Pembelian';
  refNumber: string;
  partyName: string;
  items: ReturnItem[];
  discount: number;
  totalRefund: number;
  refundMethod: 'Tunai' | 'Transfer';
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt: string;
}
