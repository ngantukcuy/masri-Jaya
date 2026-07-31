import React, { useState } from 'react';
import { Search, Plus, Minus, X, PiggyBank } from 'lucide-react';
import { Customer } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { addMutation } from '../../lib/cashSession';
import { useDialog } from '../../components/shared/DialogProvider';
import NumberInput from '../../components/shared/NumberInput';

interface DepositViewProps {
  customers: Customer[];
  onUpdateCustomers: (updatedCustomers: Customer[]) => void;
  onAddActivity: (title: string, subtitle: string, amount: number, type: 'sale' | 'arrival' | 'overdue' | 'quote', audience?: 'all' | 'approvers') => void;
}

export default function DepositView({ customers, onUpdateCustomers, onAddActivity }: DepositViewProps) {
  const dialog = useDialog();
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [target, setTarget] = useState<Customer | null>(null);
  const [action, setAction] = useState<'topup' | 'withdraw'>('topup');
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState<'Tunai' | 'Transfer'>('Tunai');

  const filtered = customers.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const totalDeposit = customers.reduce((acc, c) => acc + (c.depositBalance || 0), 0);

  const openModal = (c: Customer, act: 'topup' | 'withdraw') => {
    setTarget(c);
    setAction(act);
    setAmount(0);
    setMethod('Tunai');
    setShowModal(true);
  };

  const handleSubmit = () => {
    if (!target || amount <= 0) {
      dialog.alert('Masukkan nominal yang valid.');
      return;
    }
    const currentBalance = target.depositBalance || 0;
    if (action === 'withdraw' && amount > currentBalance) {
      dialog.alert('Nominal penarikan melebihi saldo deposit pelanggan.');
      return;
    }

    const nextBalance = action === 'topup' ? currentBalance + amount : currentBalance - amount;
    onUpdateCustomers(customers.map(c => c.id === target.id ? { ...c, depositBalance: nextBalance } : c));

    if (method === 'Tunai') {
      addMutation(action === 'topup' ? 'in' : 'out', action === 'topup' ? 'Top Up Deposit' : 'Withdraw Deposit', amount, target.name);
    }

    onAddActivity(
      action === 'topup' ? 'Top Up Deposit Pelanggan' : 'Penarikan Deposit Pelanggan',
      `${target.name}: Rp ${amount.toLocaleString('id-ID')} (${method})`,
      amount,
      'quote'
    );

    setShowModal(false);
    setTarget(null);
    setAmount(0);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
          <PiggyBank className="w-5 h-5 text-blue-600" />
          Deposit
        </h2>
        <p className="text-xs text-gray-500 font-medium mt-0.5">Kelola saldo deposit pelanggan (top up &amp; penarikan).</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between max-w-sm">
        <span className="text-xs font-bold text-gray-500 uppercase">Total Saldo Deposit</span>
        <span className="text-lg font-black text-emerald-600">Rp {totalDeposit.toLocaleString('id-ID')}</span>
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari nama pelanggan..."
          className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:border-blue-500"
        />
      </div>

      <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden bg-white">
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-xs text-gray-400">Belum ada data pelanggan.</p>
        ) : (
          filtered.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-4 text-xs">
              <div>
                <p className="font-bold text-gray-800">{c.name}</p>
                <p className="text-[10px] text-gray-400">{c.id}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-black text-emerald-600">Rp {(c.depositBalance || 0).toLocaleString('id-ID')}</span>
                <button onClick={() => openModal(c, 'topup')} className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg cursor-pointer">
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => openModal(c, 'withdraw')} className="p-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg cursor-pointer">
                  <Minus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <AnimatePresence>
        {showModal && target && (
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
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-sm text-gray-900">Deposit: {target.name}</h4>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-gray-50 rounded-xl p-3 text-xs flex justify-between">
                <span className="text-gray-500">Saldo Saat Ini</span>
                <span className="font-bold text-emerald-600">Rp {(target.depositBalance || 0).toLocaleString('id-ID')}</span>
              </div>

              <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
                <button onClick={() => setAction('topup')} className={`flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all ${action === 'topup' ? 'bg-white shadow text-emerald-600' : 'text-gray-500'}`}>Top Up</button>
                <button onClick={() => setAction('withdraw')} className={`flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all ${action === 'withdraw' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>Tarik / Withdraw</button>
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Nominal (IDR)</label>
                <NumberInput value={amount} onChange={setAmount} className="w-full border border-gray-200 rounded-lg p-2.5 text-sm font-bold outline-none" placeholder="0" />
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1.5">Metode</label>
                <select value={method} onChange={(e) => setMethod(e.target.value as 'Tunai' | 'Transfer')} className="w-full border border-gray-200 rounded-lg p-2.5 text-xs font-bold outline-none">
                  <option value="Tunai">Tunai</option>
                  <option value="Transfer">Transfer</option>
                </select>
              </div>

              <button onClick={handleSubmit} className={`w-full py-2.5 rounded-xl font-extrabold text-xs text-white cursor-pointer ${action === 'topup' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>
                {action === 'topup' ? 'Simpan Top Up' : 'Simpan Penarikan'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
