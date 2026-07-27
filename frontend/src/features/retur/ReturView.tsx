import React, { useState } from 'react';
import {
  CornerUpLeft,
  Search,
  Package,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  X
} from 'lucide-react';
import { Product, SalesInvoice, PO, ReturnRecord, ReturnItem } from '../../types';
import { addMutation } from '../../lib/cashSession';
import { useDialog } from '../../components/shared/DialogProvider';
import { CurrentUser, hasPermission } from '../../lib/permissions';

interface ReturViewProps {
  products: Product[];
  onUpdateProducts: (updatedProducts: Product[]) => void;
  salesInvoices: SalesInvoice[];
  pos: PO[];
  returns: ReturnRecord[];
  onUpdateReturns: (updatedReturns: ReturnRecord[]) => void;
  onAddActivity: (title: string, subtitle: string, amount: number, type: 'sale' | 'arrival' | 'overdue' | 'quote') => void;
  onNavigateToPOS?: () => void;
  currentUser?: CurrentUser | null;
}

export default function ReturView({ products, onUpdateProducts, salesInvoices, pos, returns, onUpdateReturns, onAddActivity, onNavigateToPOS, currentUser }: ReturViewProps) {
  const dialog = useDialog();
  const canApproveRetur = hasPermission(currentUser, 'manage_retur_approve');

  // Qty per SKU that's already been returned (Pending OR Approved — Pending
  // still reserves the qty so it can't be double-submitted while awaiting
  // approval) for a given reference number, so the same invoice/PO can't be
  // returned over and over and keep nudging stock in the same direction
  // indefinitely.
  const getAlreadyReturnedQty = (refNumber: string, sku: string) =>
    returns
      .filter(r => r.refNumber === refNumber && r.status !== 'Rejected')
      .flatMap(r => r.items)
      .filter(it => it.sku === sku)
      .reduce((sum, it) => sum + it.quantity, 0);

  const getRemainingQty = (refNumber: string, originalQty: number, sku: string) =>
    Math.max(0, originalQty - getAlreadyReturnedQty(refNumber, sku));
  const [activeTab, setActiveTab] = useState<'penjualan' | 'pembelian'>('penjualan');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(null);
  const [selectedPO, setSelectedPO] = useState<PO | null>(null);

  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [conditions, setConditions] = useState<Record<string, 'Baik' | 'Rusak'>>({});
  const [discount, setDiscount] = useState<number>(0);
  const [refundMethod, setRefundMethod] = useState<'Tunai' | 'Transfer'>('Tunai');

  const receivedPOs = pos.filter(p => p.status === 'Received');

  const hasReturnableQty = (refNumber: string, items: { sku: string; quantity: number }[]) =>
    items.some(it => getRemainingQty(refNumber, it.quantity, it.sku) > 0);

  const filteredInvoices = salesInvoices
    .filter(inv => hasReturnableQty(inv.invoiceNumber, inv.items))
    .filter(inv =>
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const filteredPOs = receivedPOs
    .filter(po => hasReturnableQty(po.poNumber, po.items))
    .filter(po =>
      po.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.supplier.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const resetForm = () => {
    setSelectedInvoice(null);
    setSelectedPO(null);
    setReturnQtys({});
    setConditions({});
    setDiscount(0);
    setRefundMethod('Tunai');
  };

  const activeRefNumber = selectedInvoice ? selectedInvoice.invoiceNumber : selectedPO ? selectedPO.poNumber : null;
  const rawItems = selectedInvoice ? selectedInvoice.items : selectedPO ? selectedPO.items : [];
  const currentItems = activeRefNumber
    ? rawItems
        .map(item => ({ ...item, quantity: getRemainingQty(activeRefNumber, item.quantity, item.sku) }))
        .filter(item => item.quantity > 0)
    : [];

  const computeSubtotal = () => {
    return currentItems.reduce((acc, item) => {
      const qty = returnQtys[item.sku] || 0;
      return acc + qty * item.price;
    }, 0);
  };

  const subtotal = computeSubtotal();
  const totalRefund = Math.max(0, subtotal - discount);

  const handleSubmitReturn = () => {
    const itemsToReturn: ReturnItem[] = currentItems
      .filter(item => (returnQtys[item.sku] || 0) > 0)
      .map(item => ({
        sku: item.sku,
        name: item.name,
        quantity: returnQtys[item.sku],
        condition: conditions[item.sku] || 'Baik',
        price: item.price
      }));

    if (itemsToReturn.length === 0) {
      dialog.alert('Masukkan minimal 1 jumlah barang yang ingin diretur.');
      return;
    }

    const record: ReturnRecord = {
      id: `RTN-${Math.floor(1000 + Math.random() * 9000)}`,
      type: activeTab === 'penjualan' ? 'Penjualan' : 'Pembelian',
      refNumber: selectedInvoice ? selectedInvoice.invoiceNumber : selectedPO!.poNumber,
      partyName: selectedInvoice ? selectedInvoice.customerName : selectedPO!.supplier,
      items: itemsToReturn,
      discount,
      totalRefund,
      refundMethod,
      status: 'Pending',
      createdAt: new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    };

    onUpdateReturns([record, ...returns]);
    onAddActivity(
      `Pengajuan Retur ${record.type}`,
      `${record.refNumber} · ${record.partyName}`,
      totalRefund,
      'quote'
    );
    dialog.alert(`Pengajuan retur ${record.refNumber} berhasil dibuat dan menunggu persetujuan.`);
    resetForm();
  };

  const handleApprove = async (id: string) => {
    if (!canApproveRetur) {
      dialog.alert('Akun Anda tidak memiliki izin untuk menyetujui retur.');
      return;
    }
    const record = returns.find(r => r.id === id);
    if (!record) return;
    const ok = await dialog.confirm(`Setujui retur ${record.refNumber} senilai Rp ${record.totalRefund.toLocaleString('id-ID')}?`);
    if (!ok) return;

    // Adjust stock
    let updatedProducts = [...products];
    record.items.forEach(item => {
      const idx = updatedProducts.findIndex(p => p.sku === item.sku);
      if (idx === -1) return;

      if (record.type === 'Penjualan') {
        // Goods came back from customer: only restock if condition is good
        if (item.condition === 'Baik') {
          const nextStock = updatedProducts[idx].stock + item.quantity;
          updatedProducts[idx] = {
            ...updatedProducts[idx],
            stock: nextStock,
            stockStatus: nextStock === 0 ? 'Out of Stock' : nextStock <= 15 ? 'Low Stock' : 'Healthy'
          };
        }
        // Rusak items go to the "Gudang Barang Rusak" location conceptually; not added back to sellable stock
      } else {
        // Goods sent back to supplier: reduce our stock either way
        const nextStock = Math.max(0, updatedProducts[idx].stock - item.quantity);
        updatedProducts[idx] = {
          ...updatedProducts[idx],
          stock: nextStock,
          stockStatus: nextStock === 0 ? 'Out of Stock' : nextStock <= 15 ? 'Low Stock' : 'Healthy'
        };
      }
    });
    onUpdateProducts(updatedProducts);

    // Cash impact
    if (record.refundMethod === 'Tunai' && record.totalRefund > 0) {
      if (record.type === 'Penjualan') {
        addMutation('out', 'Retur Penjualan', record.totalRefund, `Retur ${record.refNumber}`);
      } else {
        addMutation('in', 'Retur Pembelian', record.totalRefund, `Retur ${record.refNumber}`);
      }
    }

    const updatedReturns = returns.map(r => r.id === id ? { ...r, status: 'Approved' as const } : r);
    onUpdateReturns(updatedReturns);
    onAddActivity(`Retur ${record.type} Disetujui`, record.refNumber, record.totalRefund, 'quote');
  };

  const handleReject = async (id: string) => {
    if (!canApproveRetur) {
      dialog.alert('Akun Anda tidak memiliki izin untuk menolak retur.');
      return;
    }
    const record = returns.find(r => r.id === id);
    if (!record) return;
    const ok = await dialog.confirm(`Tolak pengajuan retur ${record.refNumber}?`);
    if (!ok) return;
    const updatedReturns = returns.map(r => r.id === id ? { ...r, status: 'Rejected' as const } : r);
    onUpdateReturns(updatedReturns);
  };

  const pendingReturns = returns.filter(r => r.status === 'Pending');
  const historyReturns = returns.filter(r => r.status !== 'Pending');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
          <CornerUpLeft className="w-5 h-5 text-blue-600" />
          Retur
        </h2>
        <p className="text-xs text-gray-500 font-medium mt-0.5">Proses pengembalian barang dari pelanggan (retur penjualan) atau ke pemasok (retur pembelian).</p>
      </div>

      <div className="flex gap-2 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => { setActiveTab('penjualan'); resetForm(); setSearchQuery(''); }}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all ${activeTab === 'penjualan' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
        >
          Retur Penjualan
        </button>
        <button
          onClick={() => { setActiveTab('pembelian'); resetForm(); setSearchQuery(''); }}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all ${activeTab === 'pembelian' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
        >
          Retur Pembelian
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: search & form */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          {!selectedInvoice && !selectedPO ? (
            <>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={activeTab === 'penjualan' ? 'Cari nomor invoice atau nama pelanggan...' : 'Cari nomor PO atau nama pemasok...'}
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-xs outline-none focus:border-blue-400"
                />
              </div>

              <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                {activeTab === 'penjualan' ? (
                  filteredInvoices.length === 0 ? (
                    salesInvoices.length === 0 ? (
                      <div className="p-6 text-center space-y-3">
                        <p className="text-xs text-gray-400">Belum ada transaksi penjualan yang tercatat. Retur hanya bisa diajukan dari transaksi yang sudah ada.</p>
                        {onNavigateToPOS && (
                          <button
                            onClick={onNavigateToPOS}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                          >
                            Buat Transaksi di Kasir (POS)
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="p-6 text-center text-xs text-gray-400">Tidak ada invoice yang cocok.</p>
                    )
                  ) : (
                    filteredInvoices.map((inv) => (
                      <button
                        key={inv.invoiceNumber}
                        onClick={() => { setSelectedInvoice(inv); setReturnQtys({}); setConditions({}); setDiscount(0); }}
                        className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 rounded-lg cursor-pointer"
                      >
                        <div>
                          <p className="font-bold text-xs text-gray-800">{inv.invoiceNumber}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{inv.customerName} · {inv.date}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-gray-700">Rp {inv.total.toLocaleString('id-ID')}</span>
                          <ChevronRight className="w-4 h-4 text-gray-300" />
                        </div>
                      </button>
                    ))
                  )
                ) : (
                  filteredPOs.length === 0 ? (
                    <p className="p-6 text-center text-xs text-gray-400">
                      {receivedPOs.length === 0 ? 'Belum ada pembelian berstatus Received.' : 'Tidak ada PO yang cocok.'}
                    </p>
                  ) : (
                    filteredPOs.map((po) => (
                      <button
                        key={po.poNumber}
                        onClick={() => { setSelectedPO(po); setReturnQtys({}); setConditions({}); setDiscount(0); }}
                        className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 rounded-lg cursor-pointer"
                      >
                        <div>
                          <p className="font-bold text-xs text-gray-800">{po.poNumber}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{po.supplier} · {po.createdDate}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-gray-700">Rp {po.total.toLocaleString('id-ID')}</span>
                          <ChevronRight className="w-4 h-4 text-gray-300" />
                        </div>
                      </button>
                    ))
                  )
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-extrabold text-sm text-gray-900">{selectedInvoice ? selectedInvoice.invoiceNumber : selectedPO!.poNumber}</p>
                  <p className="text-[10px] text-gray-400">{selectedInvoice ? selectedInvoice.customerName : selectedPO!.supplier}</p>
                </div>
                <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {currentItems.map((item) => (
                  <div key={item.sku} className="border border-gray-100 rounded-xl p-3 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-xs text-gray-800">{item.name}</p>
                        <p className="text-[10px] text-gray-400">Sisa bisa diretur: {item.quantity} · Rp {item.price.toLocaleString('id-ID')}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] text-gray-400 font-bold uppercase mb-1">Jumlah Retur</label>
                        <input
                          type="number"
                          min={0}
                          max={item.quantity}
                          value={returnQtys[item.sku] || 0}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(item.quantity, Number(e.target.value)));
                            setReturnQtys({ ...returnQtys, [item.sku]: val });
                          }}
                          className="w-full border border-gray-200 rounded-lg p-2 text-xs font-bold outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-gray-400 font-bold uppercase mb-1">Kondisi Barang</label>
                        <select
                          value={conditions[item.sku] || 'Baik'}
                          onChange={(e) => setConditions({ ...conditions, [item.sku]: e.target.value as 'Baik' | 'Rusak' })}
                          className="w-full border border-gray-200 rounded-lg p-2 text-xs font-bold outline-none"
                        >
                          <option value="Baik">Baik</option>
                          <option value="Rusak">Rusak</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                <div>
                  <label className="block text-[9px] text-gray-400 font-bold uppercase mb-1">Diskon Nilai Retur (IDR)</label>
                  <input
                    type="number"
                    value={discount || ''}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg p-2 text-xs font-bold outline-none"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-gray-400 font-bold uppercase mb-1">Metode Pengembalian</label>
                  <select
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value as 'Tunai' | 'Transfer')}
                    className="w-full border border-gray-200 rounded-lg p-2 text-xs font-bold outline-none"
                  >
                    <option value="Tunai">Tunai</option>
                    <option value="Transfer">Transfer</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-gray-100 text-sm">
                <span className="font-bold text-gray-500">Total Pengembalian</span>
                <span className="font-black text-gray-900">Rp {totalRefund.toLocaleString('id-ID')}</span>
              </div>

              <button
                onClick={handleSubmitReturn}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-extrabold text-xs cursor-pointer"
              >
                Ajukan Retur & Konfirmasi
              </button>
            </>
          )}
        </div>

        {/* Right: Pending & History */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <h4 className="font-extrabold text-sm text-gray-800">Menunggu Persetujuan ({pendingReturns.length})</h4>
            </div>
            <div className="divide-y divide-gray-100 max-h-[260px] overflow-y-auto">
              {pendingReturns.length === 0 ? (
                <p className="p-5 text-center text-xs text-gray-400">Tidak ada pengajuan retur yang pending.</p>
              ) : (
                pendingReturns.map((r) => (
                  <div key={r.id} className="p-3.5">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-xs text-gray-800">{r.refNumber} <span className="text-[10px] font-normal text-gray-400">({r.type})</span></p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{r.partyName} · {r.items.length} item</p>
                      </div>
                      <span className="font-bold text-xs text-gray-700">Rp {r.totalRefund.toLocaleString('id-ID')}</span>
                    </div>
                    {canApproveRetur ? (
                      <div className="flex gap-2 mt-2.5">
                        <button
                          onClick={() => handleApprove(r.id)}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => handleReject(r.id)}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[10px] font-bold cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    ) : (
                      <p className="mt-2.5 text-[10px] text-gray-400 italic">Menunggu persetujuan Owner/Admin.</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-400" />
              <h4 className="font-extrabold text-sm text-gray-800">Riwayat Retur</h4>
            </div>
            <div className="divide-y divide-gray-100 max-h-[260px] overflow-y-auto">
              {historyReturns.length === 0 ? (
                <p className="p-5 text-center text-xs text-gray-400">Belum ada riwayat retur.</p>
              ) : (
                historyReturns.map((r) => (
                  <div key={r.id} className="flex justify-between items-center p-3 text-xs">
                    <div>
                      <p className="font-bold text-gray-800">{r.refNumber} <span className="font-normal text-gray-400">({r.type})</span></p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{r.partyName}</p>
                    </div>
                    <span className={`font-bold text-[10px] uppercase ${r.status === 'Approved' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {r.status === 'Approved' ? 'Success' : 'Rejected'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
