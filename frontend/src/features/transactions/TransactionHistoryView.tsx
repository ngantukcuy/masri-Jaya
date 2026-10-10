import { useMemo, useState } from 'react';
import { Search, Receipt, Printer, Truck, CornerUpLeft, CalendarRange, CheckCircle2, Trash2, Clock, XCircle } from 'lucide-react';
import { Customer, Product, SalesInvoice, ReturnRecord } from '../../types';
import InvoicePrintModal from './components/InvoicePrintModal';
import { reverseSale } from '../../lib/cashSession';
import { CurrentUser, hasPermission } from '../../lib/permissions';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import Pagination, { PAGE_SIZE } from '../../components/shared/Pagination';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { formatQty, lineAmount, roundQty } from '../../lib/quantity';
import NumberInput from '../../components/shared/NumberInput';
import { uploadProductImage } from '../../lib/uploadProductImage';
import { getDeliveryState, deliveryStateStyle, receivedQty, inTransitQty, notYetSentQty, printedQty } from '../../lib/delivery';

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

type DebtPaymentStatus = 'Belum dibayar' | 'Dibayar sebagian' | 'Lunas' | 'Menunggu transfer';

function getDebtPaymentStatus(invoice: SalesInvoice): DebtPaymentStatus | null {
  // Transfer: hanya invoice yang punya status (dibuat setelah fitur konfirmasi
  // transfer ada) yang ditampilkan; invoice lama tetap "—" seperti sebelumnya.
  if (invoice.paymentMethod === 'Transfer') {
    if (invoice.transferStatus === 'Menunggu') return 'Menunggu transfer';
    if (invoice.transferStatus === 'Dikonfirmasi') return 'Lunas';
    return null;
  }
  if (invoice.paymentMethod !== 'Piutang' && invoice.paymentMethod !== 'Split') return null;

  const remainingDebt = Math.max(
    0,
    invoice.splitRemainingDebt ?? (
      invoice.paymentMethod === 'Piutang'
        ? invoice.total
        : invoice.total - (invoice.splitPaidAmount || 0)
    )
  );

  if (remainingDebt <= 0) return 'Lunas';
  if (remainingDebt >= invoice.total) return 'Belum dibayar';
  return 'Dibayar sebagian';
}

const debtPaymentStatusStyle: Record<DebtPaymentStatus, string> = {
  'Menunggu transfer': 'bg-amber-50 text-amber-700',
  'Belum dibayar': 'bg-red-50 text-red-700',
  'Dibayar sebagian': 'bg-amber-50 text-amber-700',
  Lunas: 'bg-emerald-50 text-emerald-700',
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
  const [onlyPendingTransfer, setOnlyPendingTransfer] = useState(false);
  const [onlyNeedDelivery, setOnlyNeedDelivery] = useState(false);
  // Dialog konfirmasi pengiriman: jumlah yang benar-benar sampai per barang.
  const [confirmDelivery, setConfirmDelivery] = useState<{ invoice: SalesInvoice; qtys: Record<number, number> } | null>(null);
  const [deliveryProofFile, setDeliveryProofFile] = useState<File | null>(null);
  const [isSavingDelivery, setIsSavingDelivery] = useState(false);
  const [selected, setSelected] = useState<SalesInvoice | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
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

  const openConfirmDelivery = (invoice: SalesInvoice) => {
    const qtys: Record<number, number> = {};
    invoice.items.forEach((item, idx) => {
      const transit = inTransitQty(item);
      if (transit > 0) qtys[idx] = transit; // default: semua yang di jalan sampai
    });
    setDeliveryProofFile(null);
    setConfirmDelivery({ invoice, qtys });
  };

  // Simpan hasil pengiriman: yang sampai jadi "sudah sampai", yang tidak sampai
  // kembali jadi "belum dikirim" (muncul lagi di Perlu Diantar & bisa dicetak
  // surat jalan baru besok).
  const submitConfirmDelivery = async () => {
    if (!confirmDelivery || isSavingDelivery) return;
    const { invoice, qtys } = confirmDelivery;
    setIsSavingDelivery(true);
    try {
      // Foto bukti terima (opsional) diunggah dulu; kalau gagal, konfirmasi
      // tidak disimpan setengah-setengah.
      const proofUrl = deliveryProofFile ? await uploadProductImage(deliveryProofFile, 'bukti-pengiriman') : undefined;

      const summary: string[] = [];
      const items = invoice.items.map((item, idx) => {
        const transit = inTransitQty(item);
        if (transit <= 0) return item;
        const got = roundQty(Math.min(transit, Math.max(0, qtys[idx] ?? transit)));
        const back = roundQty(transit - got);
        summary.push(`${item.name} ${formatQty(got)}/${formatQty(transit)}`);
        return {
          ...item,
          receivedQuantity: roundQty(receivedQty(item) + got),
          deliveredQuantity: roundQty(printedQty(item) - back),
        };
      });
      handleInvoiceUpdate({
        ...invoice,
        items,
        deliveryProofUrls: proofUrl ? [...(invoice.deliveryProofUrls || []), proofUrl] : invoice.deliveryProofUrls,
      });
      onAddActivity('Pengiriman Dikonfirmasi', `${invoice.invoiceNumber} • ${summary.join(', ')}`, 0, 'arrival');
      setConfirmDelivery(null);
      setDeliveryProofFile(null);
    } catch (err: any) {
      window.alert(`Gagal menyimpan konfirmasi: ${err?.message || 'Terjadi kesalahan tidak diketahui.'}`);
    } finally {
      setIsSavingDelivery(false);
    }
  };

  // Tandai transfer sudah masuk setelah kasir mengecek mutasi/m-banking.
  const confirmTransfer = (invoice: SalesInvoice) => {
    const rekening = invoice.paymentAccountName
      ? `${invoice.paymentAccountName}${invoice.paymentAccountNumber ? ` (${invoice.paymentAccountNumber})` : ''}`
      : 'rekening toko';
    const ok = window.confirm(
      `Pastikan uang Rp ${invoice.total.toLocaleString('id-ID')} dari ${invoice.customerName} SUDAH masuk ke ${rekening}.\n\nTandai transfer ${invoice.invoiceNumber} sebagai sudah masuk?`
    );
    if (!ok) return;
    handleInvoiceUpdate({
      ...invoice,
      transferStatus: 'Dikonfirmasi',
      transferConfirmedAt: new Date().toISOString(),
    });
    onAddActivity('Transfer Dikonfirmasi', invoice.invoiceNumber, invoice.total, 'sale');
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
      const nextStock = roundQty(product.stock + soldItem.quantity);
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
      roundQty(invoice.items.reduce((sum, item) => sum + item.quantity, 0)),
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
    if (onlyPendingTransfer && !(inv.paymentMethod === 'Transfer' && inv.transferStatus === 'Menunggu')) return false;
    if (onlyNeedDelivery && !(inv.fulfillmentMethod === 'Delivery' && getDeliveryState(inv) !== 'Terkirim')) return false;

    if (dateFrom || dateTo) {
      const invDate = parseInvoiceDate(inv);
      if (!invDate) return false;
      if (dateFrom && invDate < new Date(`${dateFrom}T00:00:00`)) return false;
      if (dateTo && invDate > new Date(`${dateTo}T23:59:59`)) return false;
    }
    return true;
  }).sort((a, b) => (parseInvoiceDate(b)?.getTime() || 0) - (parseInvoiceDate(a)?.getTime() || 0));
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const safePage = Math.min(currentPage, Math.max(1, pageCount));
  const paginatedInvoices = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const pendingTransferCount = salesInvoices.filter((inv) => inv.paymentMethod === 'Transfer' && inv.transferStatus === 'Menunggu').length;
  const needDeliveryCount = salesInvoices.filter((inv) => inv.fulfillmentMethod === 'Delivery' && getDeliveryState(inv) !== 'Terkirim').length;
  const isFiltered = Boolean(dateFrom || dateTo || searchQuery || onlyPendingTransfer || onlyNeedDelivery);
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
          <p className="text-[10px] text-gray-400 font-bold uppercase">{isFiltered ? 'Pendapatan Sesuai Filter' : 'Total Penjualan'}</p>
          <p className="text-lg font-black text-emerald-600">Rp {totalOmzet.toLocaleString('id-ID')}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Button
          type="button"
          variant={onlyPendingTransfer ? 'default' : 'secondary'}
          onClick={() => { setOnlyPendingTransfer((v) => !v); setCurrentPage(1); }}
          className={pendingTransferCount > 0 && !onlyPendingTransfer ? 'text-amber-700' : ''}
        >
          <Clock className="w-3.5 h-3.5" />
          Menunggu Transfer{pendingTransferCount > 0 ? ` (${pendingTransferCount})` : ''}
        </Button>
        <Button
          type="button"
          variant={onlyNeedDelivery ? 'default' : 'secondary'}
          onClick={() => { setOnlyNeedDelivery((v) => !v); setCurrentPage(1); }}
          className={needDeliveryCount > 0 && !onlyNeedDelivery ? 'text-amber-700' : ''}
        >
          <Truck className="w-3.5 h-3.5" />
          Perlu Diantar{needDeliveryCount > 0 ? ` (${needDeliveryCount})` : ''}
        </Button>
        <div className="relative max-w-sm w-full sm:w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 z-10" />
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery('')}
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
              <TableHead>Status Bayar</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-center">Retur</TableHead>
              <TableHead className="text-center">Cetak</TableHead>
              <TableHead className="text-center">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="p-6 text-center text-gray-400">{isFiltered ? 'Tidak ada transaksi yang cocok dengan pencarian/filter tanggal.' : 'Belum ada transaksi tercatat.'}</TableCell></TableRow>
            ) : (
              paginatedInvoices.map((inv) => (
                <TableRow key={inv.invoiceNumber}>
                  <TableCell className="font-bold text-gray-800 cursor-pointer" onClick={() => setSelected(inv)}>{inv.invoiceNumber}</TableCell>
                  <TableCell className="text-gray-500 cursor-pointer" onClick={() => setSelected(inv)}>{inv.date}</TableCell>
                  <TableCell className="text-gray-700 cursor-pointer" onClick={() => setSelected(inv)}>{inv.customerName}</TableCell>
                  <TableCell className="text-gray-500 cursor-pointer" onClick={() => setSelected(inv)}>{inv.paymentMethod}</TableCell>
                  <TableCell className="cursor-pointer" onClick={() => setSelected(inv)}>
                    {(() => {
                      const paymentStatus = getDebtPaymentStatus(inv);
                      if (!paymentStatus) return <span className="text-gray-300 text-[10px]">—</span>;
                      return <Badge className={`border-transparent ${debtPaymentStatusStyle[paymentStatus]}`}>{paymentStatus}</Badge>;
                    })()}
                  </TableCell>
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
                    <div className="flex items-center justify-start gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); setPrintTarget({ invoice: inv, docType: 'invoice' }); }}
                        title="Cetak Struk Pembelian"
                        className="w-7 h-7 bg-blue-50 hover:bg-blue-100 text-blue-600"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </Button>
                      {inv.fulfillmentMethod === 'Delivery' && (() => {
                        const deliveryState = getDeliveryState(inv);
                        const deliveryComplete = deliveryState === 'Terkirim';
                        return (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => { e.stopPropagation(); setPrintTarget({ invoice: inv, docType: 'delivery' }); }}
                              title={deliveryComplete ? 'Semua barang sudah sampai - Cetak Surat Jalan' : `Cetak Struk Surat Jalan (${deliveryState})`}
                              className={`w-7 h-7 ${deliveryComplete ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}
                            >
                              <Truck className="w-3.5 h-3.5" />
                            </Button>
                            {deliveryComplete ? (
                              <span title="Semua barang sudah sampai" aria-label="Semua barang sudah sampai">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              </span>
                            ) : (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${deliveryStateStyle[deliveryState]}`}>{deliveryState}</span>
                            )}
                          </>
                        );
                      })()}
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
        <Pagination page={safePage} pageCount={pageCount} onPageChange={setCurrentPage} />
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
                {(() => {
                  const paymentStatus = getDebtPaymentStatus(selected);
                  return paymentStatus ? (
                    <p className="flex items-center gap-1.5"><span className="text-gray-400">Status Pembayaran:</span><Badge className={`border-transparent ${debtPaymentStatusStyle[paymentStatus]}`}>{paymentStatus}</Badge></p>
                  ) : null;
                })()}
                {selected.deletionStatus === 'Pending' && <p className="font-bold text-amber-600">Penghapusan menunggu persetujuan.</p>}
                {selected.deletionStatus === 'Rejected' && <p className="font-bold text-red-600">Pengajuan hapus sebelumnya ditolak.</p>}
              </div>
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden text-xs">
                {selectedItems.map((it, i) => (
                  <div key={i} className="flex justify-between p-2.5">
                    <span className="text-gray-700">{it.name} x{formatQty(it.quantity)}</span>
                    <span className="font-bold text-gray-800">Rp {lineAmount(it.price, it.quantity).toLocaleString('id-ID')}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-100 font-black text-sm">
                <span>Grand Total</span>
                <span className="text-blue-600">Rp {selectedTotal.toLocaleString('id-ID')}</span>
              </div>

              {selected.fulfillmentMethod === 'Delivery' && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <h5 className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-amber-600" /> Status Pengiriman
                    </h5>
                    <Badge className={`border-transparent ${deliveryStateStyle[getDeliveryState(selected)]}`}>{getDeliveryState(selected)}</Badge>
                  </div>
                  <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden text-[11px]">
                    {selected.items.map((it, i) => {
                      const transit = inTransitQty(it);
                      const notSent = notYetSentQty(it);
                      return (
                        <div key={i} className="flex justify-between gap-3 p-2.5">
                          <span className="text-gray-700">{it.name}</span>
                          <span className="text-right shrink-0">
                            <span className="font-bold text-emerald-600">Sampai {formatQty(receivedQty(it))}</span>
                            <span className="text-gray-400"> / {formatQty(it.quantity)}</span>
                            {transit > 0 && <span className="text-amber-600"> • di jalan {formatQty(transit)}</span>}
                            {notSent > 0 && <span className="text-gray-400"> • belum dikirim {formatQty(notSent)}</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {(selected.deliveryProofUrls || []).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {(selected.deliveryProofUrls || []).map((url, i) => (
                        <a key={url} href={url} target="_blank" rel="noopener noreferrer" title={`Bukti terima ${i + 1}`}>
                          <img src={url} alt={`Bukti terima ${i + 1}`} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                        </a>
                      ))}
                    </div>
                  )}
                  {selected.items.some((it) => inTransitQty(it) > 0) && (
                    <Button onClick={() => openConfirmDelivery(selected)} className="w-full bg-emerald-600 hover:bg-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Konfirmasi Pengiriman
                    </Button>
                  )}
                </div>
              )}

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
                            <span>{it.name} x{formatQty(it.quantity)} <span className="text-gray-400">({it.condition})</span></span>
                            <span className="font-semibold text-gray-700">Rp {lineAmount(it.price, it.quantity).toLocaleString('id-ID')}</span>
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
                  onClick={() => {
                    setSelected(null);
                    setPrintTarget({ invoice: selected, docType: 'invoice' });
                  }}
                  className="w-full bg-blue-50 hover:bg-blue-100 text-blue-600"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  Struk Pembelian
                </Button>
                {selected.fulfillmentMethod === 'Delivery' && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSelected(null);
                      setPrintTarget({ invoice: selected, docType: 'delivery' });
                    }}
                    className="w-full bg-amber-50 hover:bg-amber-100 text-amber-600"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    Surat Jalan
                  </Button>
                )}
              </div>
              {selected.paymentMethod === 'Transfer' && selected.transferStatus === 'Menunggu' && (
                <Button onClick={() => confirmTransfer(selected)} className="w-full bg-emerald-600 hover:bg-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Tandai Transfer Sudah Masuk
                </Button>
              )}
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

      <Dialog open={!!confirmDelivery} onOpenChange={(open) => { if (!open) setConfirmDelivery(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Pengiriman</DialogTitle>
          </DialogHeader>
          {confirmDelivery && (
            <div className="space-y-3 text-xs">
              <p className="text-gray-500">
                Isi jumlah yang <b>benar-benar sampai</b> ke pelanggan untuk {confirmDelivery.invoice.invoiceNumber}. Yang tidak sampai
                kembali jadi "belum dikirim" dan bisa dicetak surat jalan baru besok.
              </p>
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                {confirmDelivery.invoice.items.map((it, idx) => {
                  const transit = inTransitQty(it);
                  if (transit <= 0) return null;
                  return (
                    <div key={idx} className="flex items-center justify-between gap-3 p-2.5">
                      <span className="flex-1 min-w-0">
                        <p className="truncate font-semibold text-gray-900">{it.name}</p>
                        <p className="text-[10px] text-gray-400">Di jalan {formatQty(transit)} {it.unit || ''}</p>
                      </span>
                      <NumberInput
                        value={confirmDelivery.qtys[idx] ?? 0}
                        allowDecimal={!Number.isInteger(transit)}
                        max={transit}
                        onChange={(value) => setConfirmDelivery((c) => c ? { ...c, qtys: { ...c.qtys, [idx]: value } } : c)}
                        className="w-24 h-8 text-right font-bold"
                      />
                    </div>
                  );
                })}
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Foto Bukti Terima (opsional)</Label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setDeliveryProofFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-[11px] text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 file:font-bold"
                />
                {deliveryProofFile && <p className="text-[10px] text-gray-400 truncate">{deliveryProofFile.name}</p>}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" disabled={isSavingDelivery} onClick={() => setConfirmDelivery(null)}>Batal</Button>
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={isSavingDelivery} onClick={submitConfirmDelivery}>
                  {isSavingDelivery ? 'Menyimpan...' : 'Simpan'}
                </Button>
              </div>
            </div>
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
