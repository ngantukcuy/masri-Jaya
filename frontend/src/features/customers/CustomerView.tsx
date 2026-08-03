import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Sparkles, 
  CreditCard, 
  CheckCircle2, 
  Edit3,
  Trash2,
  Wallet
} from 'lucide-react';
import { Customer } from '../../types';
import { addMutation } from '../../lib/cashSession';
import { useDialog } from '../../components/shared/DialogProvider';
import { CurrentUser, hasPermission } from '../../lib/permissions';
import NumberInput from '../../components/shared/NumberInput';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';

const numberInputClass =
  'flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-bold outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/20';

interface CustomerViewProps {
  customers: Customer[];
  onUpdateCustomers: (updatedCustomers: Customer[]) => void;
  onAddActivity: (title: string, subtitle: string, amount: number, type: 'sale' | 'arrival' | 'overdue' | 'quote', audience?: 'all' | 'approvers') => void;
  currentUser?: CurrentUser;
}

export default function CustomerView({ customers, onUpdateCustomers, onAddActivity, currentUser }: CustomerViewProps) {
  const dialog = useDialog();
  const can = (key: string) => hasPermission(currentUser, key);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedLoyalty, setSelectedLoyalty] = useState<string>('Semua');

  // New Customer states
  const [newName, setNewName] = useState('');
  const [newLoyalty, setNewLoyalty] = useState('Pelanggan Retail');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newPaymentTerms, setNewPaymentTerms] = useState<'Tunai' | 'Kredit' | 'Tempo'>('Tunai');
  const [newTempoDays, setNewTempoDays] = useState<number>(30);
  const [newCreditLimit, setNewCreditLimit] = useState<number>(10000000);
  const [newDepositBalance, setNewDepositBalance] = useState<number>(0);

  // Edit Customer states
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState('');
  const [editLoyalty, setEditLoyalty] = useState('Pelanggan Retail');
  const [editPoints, setEditPoints] = useState(0);

  // Deposit Top Up / Withdraw modal states
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositCustomer, setDepositCustomer] = useState<Customer | null>(null);
  const [depositAction, setDepositAction] = useState<'topup' | 'withdraw'>('topup');
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [depositMethod, setDepositMethod] = useState<'Tunai' | 'Transfer'>('Tunai');
  const [editDebt, setEditDebt] = useState(0);
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPaymentTerms, setEditPaymentTerms] = useState<'Tunai' | 'Kredit' | 'Tempo'>('Tunai');
  const [editTempoDays, setEditTempoDays] = useState<number>(30);
  const [editCreditLimit, setEditCreditLimit] = useState<number>(10000000);
  const [editDepositBalance, setEditDepositBalance] = useState<number>(0);

  // Map loyalty tiers to Indonesian displays
  const tierTranslationMap: Record<string, string> = {
    'Platinum Member': 'Anggota Platinum (VIP)',
    'Premium Builder': 'Kontraktor Utama (Premium)',
    'Loyal General Contractor': 'Kontraktor Umum Loyal',
    'Local Retail Builder': 'Pembangun Retail Lokal',
    'Pelanggan Retail': 'Pelanggan Retail Eceran'
  };

  const filteredCustomers = customers.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLoyalty = selectedLoyalty === 'Semua' || c.loyaltyTier.includes(selectedLoyalty);
    return matchesSearch && matchesLoyalty;
  });

  const totalOutstandingDebt = customers.reduce((acc, c) => acc + (c.currentDebt || 0), 0);

  const handleOpenDepositModal = (customer: Customer) => {
    setDepositCustomer(customer);
    setDepositAction('topup');
    setDepositAmount(0);
    setDepositMethod('Tunai');
    setShowDepositModal(true);
  };

  const handleSubmitDeposit = () => {
    if (!depositCustomer || depositAmount <= 0) {
      dialog.alert('Masukkan nominal yang valid.');
      return;
    }
    const currentBalance = depositCustomer.depositBalance || 0;
    if (depositAction === 'withdraw' && depositAmount > currentBalance) {
      dialog.alert('Nominal penarikan melebihi saldo deposit pelanggan.');
      return;
    }

    const nextBalance = depositAction === 'topup' ? currentBalance + depositAmount : currentBalance - depositAmount;
    const updated = customers.map((c) => c.id === depositCustomer.id ? { ...c, depositBalance: nextBalance } : c);
    onUpdateCustomers(updated);

    if (depositMethod === 'Tunai') {
      addMutation(
        depositAction === 'topup' ? 'in' : 'out',
        depositAction === 'topup' ? 'Top Up Deposit' : 'Withdraw Deposit',
        depositAmount,
        depositCustomer.name
      );
    }

    onAddActivity(
      depositAction === 'topup' ? 'Top Up Deposit Pelanggan' : 'Penarikan Deposit Pelanggan',
      `${depositCustomer.name}: Rp ${depositAmount.toLocaleString('id-ID')} (${depositMethod})`,
      depositAmount,
      'quote'
    );

    setShowDepositModal(false);
    setDepositCustomer(null);
    setDepositAmount(0);
  };

  const handleSettleDebt = async (customer: Customer) => {
    if (customer.currentDebt <= 0) return;

    const paymentInput = await dialog.prompt(`Selesaikan pembayaran piutang untuk ${customer.name}:`, customer.currentDebt.toString());
    const payment = Number(paymentInput);
    if (paymentInput !== null && payment && !isNaN(payment)) {
      const remaining = Math.max(0, customer.currentDebt - payment);
      
      const updated = customers.map((c) => {
        if (c.id === customer.id) {
          return {
            ...c,
            currentDebt: remaining,
            debtStatus: remaining === 0 ? ('Cleared' as const) : c.debtStatus
          };
        }
        return c;
      });

      onUpdateCustomers(updated);
      addMutation('in', 'Pembayaran Piutang', payment, `Piutang ${customer.name}`);
      onAddActivity(
        `Pembayaran Piutang: ${customer.name}`,
        `Menerima pembayaran piutang sebesar Rp ${payment.toLocaleString('id-ID')} ke kas toko`,
        payment,
        'sale'
      );

      dialog.alert(`Berhasil melunasi pembayaran piutang sebesar Rp ${payment.toLocaleString('id-ID')} untuk ${customer.name}!`);
    }
  };

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;

    const nextId = `CUST-${Math.floor(10000 + Math.random() * 90000)}`;
    const newCust: Customer = {
      id: nextId,
      name: newName,
      loyaltyTier: newLoyalty,
      points: 250, // default gift
      currentDebt: 0.00,
      totalPurchases: 0.00,
      debtStatus: "Cleared",
      logoLetters: newName.slice(0, 2).toUpperCase(),
      lastTransactions: [],
      phone: newPhone || "",
      address: newAddress || "",
      paymentTerms: newPaymentTerms,
      tempoDays: Number(newTempoDays),
      creditLimit: Number(newCreditLimit),
      depositBalance: Number(newDepositBalance)
    };

    onUpdateCustomers([newCust, ...customers]);
    setShowAddModal(false);
    setNewName('');
    setNewPhone('');
    setNewAddress('');
    setNewPaymentTerms('Tunai');
    setNewTempoDays(30);
    setNewCreditLimit(10000000);
    setNewDepositBalance(0);

    onAddActivity(
      `Pendaftaran Pelanggan Baru`,
      `Mendaftarkan akun ${nextId} atas nama ${newName}`,
      0,
      'quote'
    );

    dialog.alert(`Pelanggan baru ${newName} berhasil terdaftar! Paket sambutan gratis +250 poin loyalitas diberikan.`);
  };

  const handleOpenEditModal = (cust: Customer) => {
    setSelectedCustomer(cust);
    setEditName(cust.name);
    setEditLoyalty(cust.loyaltyTier);
    setEditPoints(cust.points);
    setEditDebt(cust.currentDebt);
    setEditPhone(cust.phone || '');
    setEditAddress(cust.address || '');
    setEditPaymentTerms(cust.paymentTerms || 'Tunai');
    setEditTempoDays(cust.tempoDays || 30);
    setEditCreditLimit(cust.creditLimit || 10000000);
    setEditDepositBalance(cust.depositBalance || 0);
    setShowEditModal(true);
  };

  const handleDeleteCustomer = async (cust: Customer) => {
    const ok = await dialog.confirm(`Apakah Anda yakin ingin menghapus akun pelanggan "${cust.name}"?`);
    if (!ok) return;

    const updated = customers.filter(c => c.id !== cust.id);
    onUpdateCustomers(updated);

    onAddActivity(
      `Pelanggan Dihapus`,
      `Menghapus akun ${cust.id} - ${cust.name} dari sistem`,
      0,
      'overdue'
    );

    dialog.alert(`Pelanggan "${cust.name}" berhasil dihapus.`);
  };

  const handleEditCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !editName.trim()) {
      dialog.alert("Nama lengkap pelanggan wajib diisi!");
      return;
    }

    const updated = customers.map((c) => {
      if (c.id === selectedCustomer.id) {
        return {
          ...c,
          name: editName.trim(),
          loyaltyTier: editLoyalty,
          points: Number(editPoints),
          currentDebt: Number(editDebt),
          debtStatus: Number(editDebt) === 0 ? ('Cleared' as const) : (c.debtStatus === 'Cleared' ? 'Pending' as const : c.debtStatus),
          logoLetters: editName.trim().slice(0, 2).toUpperCase(),
          phone: editPhone,
          address: editAddress,
          paymentTerms: editPaymentTerms,
          tempoDays: Number(editTempoDays),
          creditLimit: Number(editCreditLimit),
          depositBalance: Number(editDepositBalance)
        };
      }
      return c;
    });

    onUpdateCustomers(updated);
    setShowEditModal(false);

    onAddActivity(
      `Pembaruan Informasi Pelanggan`,
      `Akun ${selectedCustomer.id} - ${editName.trim()} berhasil diperbarui`,
      0,
      'quote'
    );

    dialog.alert(`Informasi pelanggan "${editName}" berhasil diperbarui!`);
  };

  return (
    <div className="space-y-6">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Pelanggan &amp; Piutang Usaha</h2>
          <p className="text-gray-500 text-sm">Pantau saldo piutang pembeli, tingkat loyalitas pelanggan, dan riwayat cicilan kredit kontraktor.</p>
        </div>
        {can('manage_customer_add') && (
        <Button onClick={() => setShowAddModal(true)} className="bg-gray-900 hover:bg-gray-800 shadow-md">
          <Plus className="w-4 h-4" />
          <span>Tambah Pelanggan Baru</span>
        </Button>
        )}
      </div>

      {/* Debt and Loyalty KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase">TOTAL REGISTER PELANGGAN</p>
            <h4 className="text-lg font-black text-gray-800 mt-0.5">{customers.length} Akun Aktif</h4>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase">TOTAL OUTSTANDING PIUTANG</p>
            <h4 className="text-lg font-black text-red-600 mt-0.5">Rp {totalOutstandingDebt.toLocaleString('id-ID')}</h4>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase">PELANGGAN TIER LOYAL</p>
            <h4 className="text-lg font-black text-emerald-600 mt-0.5">
              {customers.filter(c => c.loyaltyTier.includes("Platinum") || c.loyaltyTier.includes("Premium")).length} Kontraktor Utama
            </h4>
          </div>
        </div>
      </div>

      {/* Search Filter Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white border border-gray-200 p-3 rounded-xl shadow-xs">
        <div className="relative w-full sm:max-w-xs group">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors z-10" />
          <Input
            type="text"
            placeholder="Cari ID pembeli atau nama lengkap..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-gray-50 border-none"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 w-full sm:w-auto scrollbar-none">
          {['Semua', 'Platinum', 'Premium', 'General', 'Retail'].map((tier) => (
            <Button
              key={tier}
              size="sm"
              variant={selectedLoyalty === tier ? 'default' : 'secondary'}
              onClick={() => setSelectedLoyalty(tier)}
              className={selectedLoyalty === tier ? 'bg-blue-100 text-blue-800 hover:bg-blue-100 shadow-none whitespace-nowrap' : 'whitespace-nowrap'}
            >
              {tier === 'Semua' ? 'Semua Tingkatan' : tier}
            </Button>
          ))}
        </div>
      </div>

      {/* Customers Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredCustomers.length === 0 ? (
          <p className="col-span-full text-center text-gray-400 py-8 font-bold">Tidak ada akun pelanggan yang ditemukan.</p>
        ) : (
          filteredCustomers.map((cust) => (
            <div 
              key={cust.id}
              className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs hover:border-blue-600 transition-all flex flex-col justify-between space-y-4"
            >
              {/* Header profile cards */}
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-extrabold flex items-center justify-center text-sm shadow-xs shrink-0">
                    {cust.logoLetters}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-gray-900 leading-snug">{cust.name}</h4>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">{cust.id}</p>
                    {cust.phone && <p className="text-[10px] text-gray-500 font-semibold mt-0.5">📞 {cust.phone}</p>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-black uppercase">
                    {tierTranslationMap[cust.loyaltyTier] || cust.loyaltyTier}
                  </span>
                  <div className="flex gap-1.5">
                    {can('manage_customer_update') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEditModal(cust)}
                        className="w-6 h-6 text-amber-600 hover:bg-amber-50"
                        title="Edit Pelanggan"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {can('manage_customer_delete') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteCustomer(cust)}
                        className="w-6 h-6 text-red-600 hover:bg-red-50"
                        title="Hapus Pelanggan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {cust.address && (
                <p className="text-[10px] text-gray-500 bg-gray-50 p-2 rounded border border-gray-100/50 line-clamp-1">
                  📍 {cust.address}
                </p>
              )}

              {/* Central stats */}
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-150 text-xs">
                <div>
                  <span className="text-gray-400 text-[10px] block mb-0.5">TOTAL BELANJA</span>
                  <span className="font-black text-gray-800">Rp {cust.totalPurchases.toLocaleString('id-ID')}</span>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] block mb-0.5">POIN LOYALITAS</span>
                  <span className="font-black text-blue-600 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> {cust.points} Poin
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] block mb-0.5">SALDO DEPOSIT</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-emerald-600">
                      Rp {(cust.depositBalance || 0).toLocaleString('id-ID')}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDepositModal(cust)}
                      className="w-5 h-5 text-emerald-600 hover:bg-emerald-50"
                      title="Top Up / Tarik Deposit"
                    >
                      <Wallet className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] block mb-0.5">KREDIT / TEMPO</span>
                  <span className="font-black text-purple-700">
                    {cust.paymentTerms === 'Tempo' ? `Tempo ${cust.tempoDays || 30} Hari` : cust.paymentTerms || 'Tunai'}
                  </span>
                </div>
              </div>

              {/* Debt Credit balances */}
              <div className="pt-2 flex justify-between items-center text-xs">
                <div>
                  <span className="text-gray-400 text-[10px] block mb-0.5">SALDO PIUTANG</span>
                  <span className={`font-black ${cust.currentDebt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    Rp {cust.currentDebt.toLocaleString('id-ID')}
                  </span>
                  {cust.creditLimit !== undefined && (
                    <span className="text-[9px] text-gray-400 block">Limit: Rp {cust.creditLimit.toLocaleString('id-ID')}</span>
                  )}
                </div>

                {cust.currentDebt > 0 ? (
                  <Button
                    size="sm"
                    onClick={() => handleSettleDebt(cust)}
                    className="bg-red-600 hover:bg-red-700 text-[10px] shadow-sm"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Bayar Piutang</span>
                  </Button>
                ) : (
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-black flex items-center gap-1 uppercase">
                    <CheckCircle2 className="w-3 h-3" /> Lunas
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Customer Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              <Users className="w-4 h-4" /> Daftarkan Pelanggan Baru
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateCustomer} className="space-y-4 text-xs">
            <div className="space-y-4 text-xs max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin">
              <div>
                <Label>Nama Lengkap Pelanggan / Kontraktor</Label>
                <Input
                  type="text"
                  required
                  placeholder="Contoh: PT Bangun Persada Utama..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nomor Telepon</Label>
                  <Input
                    type="text"
                    placeholder="Contoh: 08123456789"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Level Loyalitas</Label>
                  <Select value={newLoyalty} onValueChange={setNewLoyalty}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pelanggan Retail">Pelanggan Eceran Biasa (Retail)</SelectItem>
                      <SelectItem value="Local Retail Builder">Pembangun Retail Lokal</SelectItem>
                      <SelectItem value="Loyal General Contractor">Kontraktor Umum Loyal</SelectItem>
                      <SelectItem value="Premium Builder">Kontraktor Utama (Premium)</SelectItem>
                      <SelectItem value="Platinum Member">Anggota Platinum (VIP)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Alamat Lengkap</Label>
                <Textarea
                  placeholder="Masukkan alamat pengiriman utama / kantor..."
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="h-16 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Syarat Pembayaran Default</Label>
                  <Select value={newPaymentTerms} onValueChange={(v) => setNewPaymentTerms(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Tunai">Tunai Langsung</SelectItem>
                      <SelectItem value="Kredit">Kredit Limit</SelectItem>
                      <SelectItem value="Tempo">Tempo (TOP)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newPaymentTerms === 'Tempo' ? (
                  <div>
                    <Label>Masa Tempo (Hari)</Label>
                    <NumberInput
                      value={newTempoDays}
                      onChange={setNewTempoDays}
                      placeholder="0"
                      className={numberInputClass}
                    />
                  </div>
                ) : (
                  <div>
                    <Label>Limit Kredit (IDR)</Label>
                    <NumberInput
                      value={newCreditLimit}
                      onChange={setNewCreditLimit}
                      placeholder="0"
                      className={numberInputClass}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Setor Deposit Awal (IDR)</Label>
                  <NumberInput
                    placeholder="0"
                    value={newDepositBalance}
                    onChange={setNewDepositBalance}
                    className={numberInputClass}
                  />
                </div>
              </div>
            </div>

            <p className="text-[10px] text-gray-400 leading-relaxed bg-blue-50/40 p-3 rounded-lg border border-blue-100">
              Pembeli baru akan otomatis mendapatkan bonus pendaftaran sebesar <b>250 poin loyalitas</b>. Poin dapat ditukarkan di masa mendatang untuk potongan diskon kasir.
            </p>

            <div className="pt-3 border-t border-gray-100 flex gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)} className="w-full">
                Batal
              </Button>
              <Button type="submit" className="w-full shadow-md shadow-blue-500/15">
                Simpan Pelanggan
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-amber-600">
              <Edit3 className="w-4 h-4" /> Edit Data Pelanggan / Kontraktor
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditCustomerSubmit} className="space-y-4 text-xs">
            <div className="space-y-4 text-xs max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin">
              <div>
                <Label>Nama Lengkap Pelanggan / Kontraktor</Label>
                <Input
                  type="text"
                  required
                  placeholder="Contoh: PT Bangun Persada Utama..."
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nomor Telepon</Label>
                  <Input
                    type="text"
                    placeholder="Contoh: 08123456789"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Kategori Level Loyalitas</Label>
                  <Select value={editLoyalty} onValueChange={setEditLoyalty}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pelanggan Retail">Pelanggan Eceran Biasa (Retail)</SelectItem>
                      <SelectItem value="Local Retail Builder">Pembangun Retail Lokal</SelectItem>
                      <SelectItem value="Loyal General Contractor">Kontraktor Umum Loyal</SelectItem>
                      <SelectItem value="Premium Builder">Kontraktor Utama (Premium)</SelectItem>
                      <SelectItem value="Platinum Member">Anggota Platinum (VIP)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Alamat Lengkap</Label>
                <Textarea
                  placeholder="Masukkan alamat pengiriman utama / kantor..."
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="h-16 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Syarat Pembayaran Default</Label>
                  <Select value={editPaymentTerms} onValueChange={(v) => setEditPaymentTerms(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Tunai">Tunai Langsung</SelectItem>
                      <SelectItem value="Kredit">Kredit Limit</SelectItem>
                      <SelectItem value="Tempo">Tempo (TOP)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editPaymentTerms === 'Tempo' ? (
                  <div>
                    <Label>Masa Tempo (Hari)</Label>
                    <NumberInput
                      value={editTempoDays}
                      onChange={setEditTempoDays}
                      placeholder="0"
                      className={numberInputClass}
                    />
                  </div>
                ) : (
                  <div>
                    <Label>Limit Kredit (IDR)</Label>
                    <NumberInput
                      value={editCreditLimit}
                      onChange={setEditCreditLimit}
                      placeholder="0"
                      className={numberInputClass}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Poin Loyalitas</Label>
                  <NumberInput
                    required
                    value={editPoints}
                    onChange={setEditPoints}
                    placeholder="0"
                    className={numberInputClass}
                  />
                </div>

                <div>
                  <Label>Saldo Piutang (IDR)</Label>
                  <NumberInput
                    required
                    value={editDebt}
                    onChange={setEditDebt}
                    placeholder="0"
                    className={numberInputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Saldo Deposit (IDR)</Label>
                  <NumberInput
                    required
                    value={editDepositBalance}
                    onChange={setEditDepositBalance}
                    placeholder="0"
                    className={numberInputClass}
                  />
                </div>
              </div>
            </div>

            <p className="text-[10px] text-gray-400 leading-relaxed bg-blue-50/40 p-3 rounded-lg border border-blue-100">
              Mengubah saldo piutang secara manual di sini akan otomatis meng-update status piutang (Lunas / Tertunda) dan nominal akumulasi piutang pada laporan keuangan.
            </p>

            <div className="pt-3 border-t border-gray-100 flex gap-2">
              <Button type="button" variant="outline" onClick={() => setShowEditModal(false)} className="w-full">
                Batal
              </Button>
              <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-500/15">
                Simpan Perubahan
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Deposit Top Up / Withdraw Modal */}
      <Dialog open={showDepositModal} onOpenChange={setShowDepositModal}>
        <DialogContent className="max-w-sm">
          {depositCustomer && (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm normal-case tracking-normal">Deposit: {depositCustomer.name}</DialogTitle>
              </DialogHeader>

              <div className="bg-gray-50 rounded-xl p-3 text-xs flex justify-between">
                <span className="text-gray-500">Saldo Saat Ini</span>
                <span className="font-bold text-emerald-600">Rp {(depositCustomer.depositBalance || 0).toLocaleString('id-ID')}</span>
              </div>

              <Tabs value={depositAction} onValueChange={(v) => setDepositAction(v as 'topup' | 'withdraw')}>
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
                  value={depositAmount}
                  onChange={setDepositAmount}
                  className={numberInputClass.replace('text-xs', 'text-sm')}
                  placeholder="0"
                />
              </div>

              <div>
                <Label>Metode</Label>
                <Select value={depositMethod} onValueChange={(v) => setDepositMethod(v as 'Tunai' | 'Transfer')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tunai">Tunai</SelectItem>
                    <SelectItem value="Transfer">Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleSubmitDeposit}
                className={`w-full ${depositAction === 'topup' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {depositAction === 'topup' ? 'Simpan Top Up' : 'Simpan Penarikan'}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
