import React, { useMemo, useState } from 'react';
import { History, Search, Receipt, Printer, Truck, CornerUpLeft, CalendarRange, CheckCircle2, Trash2, Clock, XCircle } from 'lucide-react';
import { Customer, Product, SalesInvoice, ReturnRecord } from '../../types';
import InvoicePrintModal from './components/InvoicePrintModal';
import { reverseSale } from '../../lib/cashSession';
import { CurrentUser, hasPermission } from '../../lib/permissions';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';

interface StoreProfileLite {
  storeName: string;
  address?: string;
  phone?: string;
  receiptNote?: string;
  taxId?: string;
}

interface TransactionHistoryViewProps {
  salesInvoices: SalesInvoice[];
  returns?: ReturnRecord[];
  onUpdateSalesInvoice: (invoice: SalesInvoice) => void;
  onDeleteSalesInvoice: (invoiceNumber: string) => void;
  products: Product[];
  onUpdateProducts: (products: Product[]) => void;
  customers: Customer[];
  onUpdateCustomers: (customers: Customer[]) => void;
  onAddActivity: (title: string, subtitle: string, amount: number, type: 'sale' | 'arrival' | 'overdue' | 'quote', audience?: 'all' | 'approvers') => void;
  currentUser?: CurrentUser | null;
  storeProfile?: StoreProfileLite;
  cashierName?: string;
}

const returStatusStyle: Record<ReturnRecord['status'], string> = {
  Pending: 'bg-amber-50 text-amber-700',
  Approved: 'bg-emerald-50 text-emerald-700',
  Rejected: 'bg-red-50 text-red-700',
};

const returStatusLabel: Record<ReturnRecord['status'], string> = {
  Pending: 'Retur Menunggu',
  Approved: 'Retur Disetujui',
  Rejected: 'Retur Ditolak',
};

// Nama bulan versi Indonesia -> index (0-11), dipakai buat parsing
// fallback kalau invoice lama gak punya field `createdAt` (ISO timestamp)
// dan cuma punya `date` dalam bentuk teks "31 Juli 2026".
const INDO_MONTHS: Record<string, number> = {
  januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
  juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11,
};

function parseInvoiceDate(inv: SalesInvoice): Date | null {
  if (inv.createdAt) {
    const d = new Date(inv.createdAt);
    if (!isNaN(d.getTime())) return d;
  }
  const match = inv.date.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = INDO_MONTHS[match[2].toLowerCase()];
    const year = parseInt(match[3], 10);
    if (month !== undefined && !isNaN(day) && !isNaN(year)) return new Date(year, month, day);
  }
  return null;
}

export default function TransactionHistoryView({ salesInvoices, returns = [], onUpdateSalesInvoice, onDeleteSalesInvoice, products, onUpdateProducts, customers, onUpdateCustomers, onAddActivity, currentUser, storeProfile, cashierName }: TransactionHistoryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<SalesInvoice | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // Which invoice + document type is currently being (re-)printed. Lets a
  // cashier who forgot to print in POS catch up straight from history,
  // for either the struk pembelian (purchase receipt) or struk surat jalan
  // (delivery note).
  const [printTarget, setPrintTarget] = useState<{ invoice: SalesInvoice; docType: 'invoice' | 'delivery' } | null>(null);
  const canApproveDeletion = hasPermission(currentUser, 'manage_sales_delete_approve');

  const handleInvoiceUpdate = (updatedInvoice: SalesInvoice) => {
    onUpdateSalesInvoice(updatedInvoice);
    setSelected((current) => current?.invoiceNumber === updatedInvoice.invoiceNumber ? updatedInvoice : current);
    setPrintTarget((current) => current?.invoice.invoiceNumber === updatedInvoice.invoiceNumber
      ? { ...current, invoice: updatedInvoice }
      : current);
  };

  const requestDelete = async (invoice: SalesInvoice) => {
    if (invoice.deletionStatus === 'Pending') {
      window.alert('Pengajuan hapus transaksi ini masih menunggu persetujuan.');
      return;
    }
    const ok = window.confirm(`Ajukan penghapusan transaksi ${invoice.invoiceNumber}? Stok dan uang akan dikembalikan setelah disetujui.`);
    if (!ok) return;
    const updatedInvoice = {
      ...invoice,
      deletionStatus: 'Pending' as const,
      deletionRequestedAt: new Date().toISOString(),
    };
    onUpdateSalesInvoice(updatedInvoice);
    onAddActivity('Pengajuan Hapus Transaksi', invoice.invoiceNumber, invoice.total, 'quote', 'approvers');
  };

  const approveDelete = async (invoice: SalesInvoice) => {
    if (!canApproveDeletion || invoice.deletionStatus !== 'Pending') return;
    const ok = window.confirm(`Setujui hapus ${invoice.invoiceNumber}? Stok dan pembayaran akan dikembalikan.`);
    if (!ok) return;

    const updatedProducts = products.map((product) => {
      const soldItem = invoice.items.find((item) => item.sku === product.sku);
      if (!soldItem) return product;
      const nextStock = product.stock + soldItem.quantity;
      const nextStatus: Product['stockStatus'] = nextStock <= 0 ? 'Out of Stock' : nextStock <= 15 ? 'Low Stock' : 'Healthy';
      return {
        ...product,
        stock: nextStock,
        stockStatus: nextStatus,
      };
    });
    onUpdateProducts(updatedProducts);

    const customerId = invoice.customerId;
    if (customerId) {
      onUpdateCustomers(customers.map((customer) => {
        if (customer.id !== customerId) return customer;
        const refundedDebt = invoice.splitRemainingDebt || 0;
        const nextDebt = Math.max(0, customer.currentDebt - refundedDebt);
        return {
          ...customer,
          points: Math.max(0, customer.points - Math.floor(invoice.total / 10000)),
          totalPurchases: Math.max(0, customer.totalPurchases - invoice.total),
          depositBalance: (customer.depositBalance || 0) + (invoice.paymentMethod === 'Deposit' ? invoice.total : 0),
          currentDebt: nextDebt,
          pendingAmount: Math.max(0, (customer.pendingAmount || 0) - refundedDebt),
          debtStatus: nextDebt > 0 ? customer.debtStatus : 'Cleared' as const,
          lastTransactions: customer.lastTransactions.filter((transaction) => !transaction.orderName.includes(invoice.invoiceNumber)),
        };
      }));
    }

    reverseSale(
      invoice.paymentMethod,
      invoice.total,
      invoice.items.reduce((sum, item) => sum + item.quantity, 0),
      invoice.invoiceNumber,
      invoice.splitPaidAmount || 0
    );

    onDeleteSalesInvoice(invoice.invoiceNumber);
    setSelected(null);
    setPrintTarget(null);
    onAddActivity('Transaksi Dihapus', `${invoice.invoiceNumber} · stok dan pembayaran dikembalikan`, invoice.total, 'quote');
  };

  const rejectDelete = async (invoice: SalesInvoice) => {
    if (!canApproveDeletion || invoice.deletionStatus !== 'Pending') return;
    const ok = window.confirm(`Tolak penghapusan transaksi ${invoice.invoiceNumber}?`);
    if (!ok) return;
    handleInvoiceUpdate({ ...invoice, deletionStatus: 'Rejected' });
    onAddActivity('Penghapusan Transaksi Ditolak', invoice.invoiceNumber, 0, 'quote');
  };

  // Sales-side returns keyed by the invoice number they were filed against
  // (ReturnRecord.refNumber), so the history table can flag which invoices
  // had items returned instead of showing that information nowhere at all.
  const returnsByInvoice = useMemo(() => {
    const map = new Map<string, ReturnRecord[]>();
    returns
      .filter((r) => r.type === 'Penjualan')
      .forEach((r) => {
        const list = map.get(r.refNumber) || [];
        list.push(r);
        map.set(r.refNumber, list);
      });
    return map;
  }, [returns]);

  const getRemainingItems = (invoice: SalesInvoice, invoiceReturns: ReturnRecord[]) => {
    const returnedQtyBySku = new Map<string, number>();
    invoiceReturns
      .filter((record) => record.status === 'Approved')
      .flatMap((record) => record.items)
      .forEach((item) => {
        returnedQtyBySku.set(item.sku, (returnedQtyBySku.get(item.sku) || 0) + item.quantity);
      });

    return invoice.items
      .map((item) => ({
        ...item,
        quantity: Math.max(0, item.quantity - (returnedQtyBySku.get(item.sku) || 0)),
      }))
      .filter((item) => item.quantity > 0);
  };

  const getRemainingTotal = (invoice: SalesInvoice, invoiceReturns: ReturnRecord[]) =>
    Math.max(
      0,
      invoice.total
        - invoiceReturns
          .filter((record) => record.status === 'Approved')
          .reduce((sum, record) => sum + record.totalRefund, 0)
    );

  const filtered = [...salesInvoices].filter(inv => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (dateFrom || dateTo) {
      const invDate = parseInvoiceDate(inv);
      if (!invDate) return false;
      if (dateFrom && invDate < new Date(`${dateFrom}T00:00:00`)) return false;
      if (dateTo && invDate > new Date(`${dateTo}T23:59:59`)) return false;
    }
    return true;
  }).sort((a, b) => (parseInvoiceDate(b)?.getTime() || 0) - (parseInvoiceDate(a)?.getTime() || 0));

  const isFiltered = Boolean(dateFrom || dateTo || searchQuery);
  const totalOmzet = filtered.reduce(
    (acc, inv) => acc + getRemainingTotal(inv, returnsByInvoice.get(inv.invoiceNumber) || []),
    0
  );
  const selectedReturns = selected ? (returnsByInvoice.get(selected.invoiceNumber) || []) : [];
  const selectedItems = selected ? getRemainingItems(selected, selectedReturns) : [];
  const selectedTotal = selected ? getRemainingTotal(selected, selectedReturns) : 0;

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-xl">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] text-gray-400 font-bold uppercase">{isFiltered ? 'Invoice Sesuai Filter' : 'Jumlah Invoice'}</p>
          <p className="text-lg font-black text-gray-900">{filtered.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] text-gray-400 font-bold uppercase">{isFiltered ? 'Omzet Sesuai Filter' : 'Total Omzet'}</p>
          <p className="text-lg font-black text-emerald-600">Rp {totalOmzet.toLocaleString('id-ID')}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative max-w-sm w-full sm:w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 z-10" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari no. invoice atau nama pelanggan..."
            className="pl-9"
          />
        </div>

        <div className="flex items-end gap-2">
          <div>
            <Label className="flex items-center gap-1">
              <CalendarRange className="w-3 h-3" /> Dari Tanggal
            </Label>
            <Input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-auto"
            />
          </div>
          <div>
            <Label>Sampai Tanggal</Label>
            <Input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-auto"
            />
          </div>
          {(dateFrom || dateTo) && (
            <Button
              variant="secondary"
              onClick={() => { setDateFrom(''); setDateTo(''); }}
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
        <Table className="min-w-[560px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-gray-50">
              <TableHead>No. Invoice</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Pelanggan</TableHead>
              <TableHead>Metode</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-center">Retur</TableHead>
              <TableHead className="text-center">Cetak</TableHead>
              <TableHead className="text-center">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="p-6 text-center text-gray-400">{isFiltered ? 'Tidak ada transaksi yang cocok dengan pencarian/filter tanggal.' : 'Belum ada transaksi tercatat.'}</TableCell></TableRow>
            ) : (
              filtered.map((inv) => (
                <TableRow key={inv.invoiceNumber}>
                  <TableCell className="font-bold text-gray-800 cursor-pointer" onClick={() => setSelected(inv)}>{inv.invoiceNumber}</TableCell>
                  <TableCell className="text-gray-500 cursor-pointer" onClick={() => setSelected(inv)}>{inv.date}</TableCell>
                  <TableCell className="text-gray-700 cursor-pointer" onClick={() => setSelected(inv)}>{inv.customerName}</TableCell>
                  <TableCell className="text-gray-500 cursor-pointer" onClick={() => setSelected(inv)}>{inv.paymentMethod}</TableCell>
                  <TableCell className="text-right font-bold text-gray-900 cursor-pointer" onClick={() => setSelected(inv)}>Rp {getRemainingTotal(inv, returnsByInvoice.get(inv.invoiceNumber) || []).toLocaleString('id-ID')}</TableCell>
                  <TableCell className="text-center">
                    {(() => {
                      const invReturns = returnsByInvoice.get(inv.invoiceNumber)?.filter((r) => r.status === 'Pending' || r.status === 'Approved');
                      if (!invReturns || invReturns.length === 0) return <span className="text-gray-300 text-[10px]">—</span>;
                      // Show only the approval state in the table; item details stay in the invoice dialog.
                      const priority = invReturns.find((r) => r.status === 'Pending') || invReturns[0];
                      return (
                        <div className="flex items-center justify-center">
                          <Badge className={`border-transparent gap-1 ${returStatusStyle[priority.status]}`}>
                            <CornerUpLeft className="w-2.5 h-2.5" />
                            {returStatusLabel[priority.status]}
                          </Badge>
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); setPrintTarget({ invoice: inv, docType: 'invoice' }); }}
                        title="Cetak Struk Pembelian"
                        className="w-7 h-7 bg-blue-50 hover:bg-blue-100 text-blue-600"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </Button>
                      {inv.fulfillmentMethod === 'Delivery' && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); setPrintTarget({ invoice: inv, docType: 'delivery' }); }}
                            title="Cetak Struk Surat Jalan"
                            className="w-7 h-7 bg-amber-50 text-amber-600 hover:bg-amber-100"
                          >
                            <Truck className="w-3.5 h-3.5" />
                          </Button>
                          {inv.items.every((item) => (item.deliveredQuantity || 0) >= item.quantity) && (
                            <span title="Semua barang sudah diantar" className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-50">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1.5">
                      {inv.deletionStatus === 'Pending' && canApproveDeletion ? (
                        <>
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); void approveDelete(inv); }} title="Setujui hapus transaksi" className="w-7 h-7 bg-emerald-50 text-emerald-600 hover:bg-emerald-100">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); void rejectDelete(inv); }} title="Tolak hapus transaksi" className="w-7 h-7 bg-red-50 text-red-600 hover:bg-red-100">
                            <XCircle className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      ) : (
                        <Button variant="ghost" size="icon" disabled={inv.deletionStatus === 'Pending'} onClick={(e) => { e.stopPropagation(); void requestDelete(inv); }} title={inv.deletionStatus === 'Pending' ? 'Menunggu persetujuan hapus' : 'Ajukan hapus transaksi'} className="w-7 h-7 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-60">
                          {inv.deletionStatus === 'Pending' ? <Clock className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </Button>
                      )}
                    </div>
                    {inv.deletionStatus === 'Pending' && <p className="text-[9px] text-amber-600 text-center mt-1">Menunggu persetujuan</p>}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-md">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm normal-case tracking-normal">
                  <Receipt className="w-4 h-4" /> {selected.invoiceNumber}
                </DialogTitle>
              </DialogHeader>

              <div className="text-xs space-y-1 text-gray-600">
                <p><span className="text-gray-400">Tanggal:</span> {selected.date}</p>
                <p><span className="text-gray-400">Pelanggan:</span> {selected.customerName}</p>
                <p><span className="text-gray-400">Metode Bayar:</span> {selected.paymentMethod}</p>
                {selected.deletionStatus === 'Pending' && <p className="font-bold text-amber-600">Penghapusan menunggu persetujuan.</p>}
                {selected.deletionStatus === 'Rejected' && <p className="font-bold text-red-600">Pengajuan hapus sebelumnya ditolak.</p>}
              </div>
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden text-xs">
                {selectedItems.map((it, i) => (
                  <div key={i} className="flex justify-between p-2.5">
                    <span className="text-gray-700">{it.name} x{it.quantity}</span>
                    <span className="font-bold text-gray-800">Rp {(it.price * it.quantity).toLocaleString('id-ID')}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-100 font-black text-sm">
                <span>Grand Total</span>
                <span className="text-blue-600">Rp {selectedTotal.toLocaleString('id-ID')}</span>
              </div>

              {selectedReturns.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <h5 className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                    <CornerUpLeft className="w-3.5 h-3.5 text-amber-600" /> Riwayat Retur
                  </h5>
                  {selectedReturns.map((r) => (
                    <div key={r.id} className="p-2.5 bg-gray-50 border border-gray-100 rounded-lg space-y-1">
                      <div className="flex justify-between items-center">
                        <Badge className={`border-transparent ${returStatusStyle[r.status]}`}>
                          {returStatusLabel[r.status]}
                        </Badge>
                        <span className="text-[10px] text-gray-400">{r.createdAt}</span>
                      </div>
                      <div className="text-[11px] text-gray-600 space-y-0.5">
                        {r.items.map((it, i) => (
                          <div key={i} className="flex justify-between">
                            <span>{it.name} x{it.quantity} <span className="text-gray-400">({it.condition})</span></span>
                            <span className="font-semibold text-gray-700">Rp {(it.price * it.quantity).toLocaleString('id-ID')}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between text-[11px] font-bold pt-1 border-t border-gray-200">
                        <span className="text-gray-500">Refund ({r.refundMethod})</span>
                        <span className="text-amber-700">Rp {r.totalRefund.toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  variant="secondary"
                  onClick={() => setPrintTarget({ invoice: selected, docType: 'invoice' })}
                  className="w-full bg-blue-50 hover:bg-blue-100 text-blue-600"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  Struk Pembelian
                </Button>
                {selected.fulfillmentMethod === 'Delivery' && (
                  <Button
                    variant="secondary"
                    onClick={() => setPrintTarget({ invoice: selected, docType: 'delivery' })}
                    className="w-full bg-amber-50 hover:bg-amber-100 text-amber-600"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    Surat Jalan
                  </Button>
                )}
              </div>
              <div className="flex gap-2 pt-1">
                {selected.deletionStatus === 'Pending' && canApproveDeletion ? (
                  <>
                    <Button onClick={() => void approveDelete(selected)} className="flex-1 bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" /> Setujui Hapus</Button>
                    <Button onClick={() => void rejectDelete(selected)} variant="secondary" className="flex-1 text-red-600"><XCircle className="w-3.5 h-3.5" /> Tolak</Button>
                  </>
                ) : (
                  <Button disabled={selected.deletionStatus === 'Pending'} onClick={() => void requestDelete(selected)} variant="secondary" className="w-full text-red-600"><Trash2 className="w-3.5 h-3.5" /> {selected.deletionStatus === 'Pending' ? 'Menunggu Persetujuan' : 'Ajukan Hapus Transaksi'}</Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {printTarget && (
        <InvoicePrintModal
          invoice={printTarget.invoice}
          docType={printTarget.docType}
          onClose={() => setPrintTarget(null)}
            onDriverAssigned={handleInvoiceUpdate}
            onDeliveryComplete={handleInvoiceUpdate}
          storeProfile={storeProfile}
          cashierName={cashierName}
        />
      )}
    </div>
  );
}
