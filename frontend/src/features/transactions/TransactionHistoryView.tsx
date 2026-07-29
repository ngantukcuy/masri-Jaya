import React, { useState } from 'react';
import { History, Search, Receipt, X, Printer, Truck } from 'lucide-react';
import { SalesInvoice } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import InvoicePrintModal from './components/InvoicePrintModal';

interface StoreProfileLite {
  storeName: string;
  address?: string;
  phone?: string;
  receiptNote?: string;
  taxId?: string;
}

interface TransactionHistoryViewProps {
  salesInvoices: SalesInvoice[];
  storeProfile?: StoreProfileLite;
  cashierName?: string;
}

export default function TransactionHistoryView({ salesInvoices, storeProfile, cashierName }: TransactionHistoryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<SalesInvoice | null>(null);
  // Which invoice + document type is currently being (re-)printed. Lets a
  // cashier who forgot to print in POS catch up straight from history,
  // for either the struk pembelian (purchase receipt) or struk surat jalan
  // (delivery note).
  const [printTarget, setPrintTarget] = useState<{ invoice: SalesInvoice; docType: 'invoice' | 'delivery' } | null>(null);

  const filtered = salesInvoices.filter(inv =>
    inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.customerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalOmzet = salesInvoices.reduce((acc, inv) => acc + inv.total, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
          <History className="w-5 h-5 text-blue-600" />
          Riwayat Transaksi
        </h2>
        <p className="text-xs text-gray-500 font-medium mt-0.5">Daftar seluruh transaksi penjualan yang tercatat.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-xl">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] text-gray-400 font-bold uppercase">Jumlah Invoice</p>
          <p className="text-lg font-black text-gray-900">{salesInvoices.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] text-gray-400 font-bold uppercase">Total Omzet</p>
          <p className="text-lg font-black text-emerald-600">Rp {totalOmzet.toLocaleString('id-ID')}</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari no. invoice atau nama pelanggan..."
          className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:border-blue-500"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-xs min-w-[560px]">
          <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 font-bold">
            <tr>
              <th className="text-left p-3">No. Invoice</th>
              <th className="text-left p-3">Tanggal</th>
              <th className="text-left p-3">Pelanggan</th>
              <th className="text-left p-3">Metode</th>
              <th className="text-right p-3">Total</th>
              <th className="text-center p-3">Cetak</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-gray-400">Belum ada transaksi tercatat.</td></tr>
            ) : (
              filtered.map((inv) => (
                <tr key={inv.invoiceNumber} className="hover:bg-gray-50">
                  <td className="p-3 font-bold text-gray-800 cursor-pointer" onClick={() => setSelected(inv)}>{inv.invoiceNumber}</td>
                  <td className="p-3 text-gray-500 cursor-pointer" onClick={() => setSelected(inv)}>{inv.date}</td>
                  <td className="p-3 text-gray-700 cursor-pointer" onClick={() => setSelected(inv)}>{inv.customerName}</td>
                  <td className="p-3 text-gray-500 cursor-pointer" onClick={() => setSelected(inv)}>{inv.paymentMethod}</td>
                  <td className="p-3 text-right font-bold text-gray-900 cursor-pointer" onClick={() => setSelected(inv)}>Rp {inv.total.toLocaleString('id-ID')}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); setPrintTarget({ invoice: inv, docType: 'invoice' }); }}
                        title="Cetak Struk Pembelian"
                        className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setPrintTarget({ invoice: inv, docType: 'delivery' }); }}
                        title="Cetak Struk Surat Jalan"
                        className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 cursor-pointer"
                      >
                        <Truck className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h4 className="font-extrabold text-sm text-gray-900 flex items-center gap-1.5"><Receipt className="w-4 h-4 text-blue-600" /> {selected.invoiceNumber}</h4>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="text-xs space-y-1 text-gray-600">
                <p><span className="text-gray-400">Tanggal:</span> {selected.date}</p>
                <p><span className="text-gray-400">Pelanggan:</span> {selected.customerName}</p>
                <p><span className="text-gray-400">Metode Bayar:</span> {selected.paymentMethod}</p>
              </div>
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden text-xs">
                {selected.items.map((it, i) => (
                  <div key={i} className="flex justify-between p-2.5">
                    <span className="text-gray-700">{it.name} x{it.quantity}</span>
                    <span className="font-bold text-gray-800">Rp {(it.price * it.quantity).toLocaleString('id-ID')}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-100 font-black text-sm">
                <span>Grand Total</span>
                <span className="text-blue-600">Rp {selected.total.toLocaleString('id-ID')}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => setPrintTarget({ invoice: selected, docType: 'invoice' })}
                  className="w-full flex items-center justify-center gap-1.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-bold cursor-pointer"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  Struk Pembelian
                </button>
                <button
                  onClick={() => setPrintTarget({ invoice: selected, docType: 'delivery' })}
                  className="w-full flex items-center justify-center gap-1.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg text-xs font-bold cursor-pointer"
                >
                  <Truck className="w-3.5 h-3.5" />
                  Surat Jalan
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {printTarget && (
        <InvoicePrintModal
          invoice={printTarget.invoice}
          docType={printTarget.docType}
          onClose={() => setPrintTarget(null)}
          storeProfile={storeProfile}
          cashierName={cashierName}
        />
      )}
    </div>
  );
}
