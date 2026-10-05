import type { SalesInvoice } from '../types';

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

export function generateInvoiceNumber(invoices: SalesInvoice[], now = new Date()): string {
  const dateKey = localDateKey(now);
  const prefix = `inv-${dateKey}-`;
  const invoicesToday = invoices.filter((invoice) => {
    if (!invoice.createdAt) return false;
    const createdAt = new Date(invoice.createdAt);
    return !Number.isNaN(createdAt.getTime()) && localDateKey(createdAt) === dateKey;
  });

  const lastNumberToday = invoices.reduce((highest, invoice) => {
    const match = invoice.invoiceNumber.match(/^inv-(\d{8})-(\d+)$/i);
    return match?.[1] === dateKey ? Math.max(highest, Number(match[2])) : highest;
  }, 0);
  const nextNumber = Math.max(lastNumberToday, invoicesToday.length) + 1;

  return `${prefix}${String(nextNumber).padStart(4, '0')}`;
}
