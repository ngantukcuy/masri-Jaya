import { useState } from 'react';
import { Search, Plus, Minus, PiggyBank } from 'lucide-react';
import { Customer } from '../../types';
import { addMutation } from '../../lib/cashSession';
import { useDialog } from '../../components/shared/DialogProvider';
import NumberInput from '../../components/shared/NumberInput';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';

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
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 z-10" />
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari nama pelanggan..."
          className="pl-9"
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
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openModal(c, 'topup')}
                  className="w-8 h-8 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openModal(c, 'withdraw')}
                  className="w-8 h-8 bg-red-50 text-red-500 hover:bg-red-100"
                >
                  <Minus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-sm">
          {target && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm normal-case tracking-normal">Deposit: {target.name}</DialogTitle>
              </DialogHeader>

              <div className="bg-gray-50 rounded-xl p-3 text-xs flex justify-between">
                <span className="text-gray-500">Saldo Saat Ini</span>
                <span className="font-bold text-emerald-600">Rp {(target.depositBalance || 0).toLocaleString('id-ID')}</span>
              </div>

              <Tabs value={action} onValueChange={(v) => setAction(v as 'topup' | 'withdraw')}>
                <TabsList className="bg-gray-100 p-1 rounded-xl w-full gap-0">
                  <TabsTrigger
                    value="topup"
                    className="flex-1 rounded-lg border-0 data-[state=active]:bg-white data-[state=active]:shadow data-[state=active]:text-emerald-600 text-gray-500"
                  >
                    Top Up
                  </TabsTrigger>
                  <TabsTrigger
                    value="withdraw"
                    className="flex-1 rounded-lg border-0 data-[state=active]:bg-white data-[state=active]:shadow data-[state=active]:text-red-600 text-gray-500"
                  >
                    Tarik / Withdraw
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div>
                <Label>Nominal (IDR)</Label>
                <NumberInput
                  value={amount}
                  onChange={setAmount}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-bold outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/20"
                  placeholder="0"
                />
              </div>

              <div>
                <Label>Metode</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as 'Tunai' | 'Transfer')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tunai">Tunai</SelectItem>
                    <SelectItem value="Transfer">Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleSubmit}
                className={`w-full ${action === 'topup' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {action === 'topup' ? 'Simpan Top Up' : 'Simpan Penarikan'}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
