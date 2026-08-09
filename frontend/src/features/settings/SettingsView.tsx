import React, { useState, useEffect } from 'react';
import { 
  Building, 
  MapPin, 
  ShieldCheck, 
  Printer as PrinterIcon, 
  AlertOctagon, 
  Save, 
  CheckCircle2, 
  Plus, 
  Wifi, 
  WifiOff,
  Trash2,
  Warehouse,
  CreditCard,
  Bluetooth,
  Usb,
  Loader2,
  History,
  Search,
} from 'lucide-react';
import { Branch, StoreProfile, StaffMember, BankAccount, SkuLocation, Printer, Customer } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { useSupabaseState } from '../../lib/useSupabaseState';
import { useSupabaseTable } from '../../lib/useSupabaseTable';
import { uploadProductImage } from '../../lib/uploadProductImage';
import {
  connectBluetoothPrinter,
  connectUsbPrinter,
  isBluetoothSupported,
  isUsbSupported,
  type PrinterConnectionHandle,
} from '../../lib/printing/printerConnection';
import { buildTestPrint } from '../../lib/printing/escpos';
import { useDialog } from '../../components/shared/DialogProvider';
import { TAB_DEFS, FEATURE_PERMISSION_DEFS, ROLE_DEFAULT_PERMISSIONS, CurrentUser, hasPermission } from '../../lib/permissions';
import { resetAllBusinessData, backupAllBusinessData, downloadBackupJson } from '../../lib/resetAllData';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Checkbox } from '../../components/ui/checkbox';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { supabase } from '../../lib/supabase';

interface SettingsViewProps {
  branches: Branch[];
  onUpdateBranches: (updatedBranches: Branch[]) => void;
  skuLocations: SkuLocation[];
  onUpdateSkuLocations: (updatedLocations: SkuLocation[]) => void;
  onAddActivity: (title: string, subtitle: string, amount: number, type: 'sale' | 'arrival' | 'overdue' | 'quote', audience?: 'all' | 'approvers') => void;
  currentUser?: CurrentUser;
  /** Daftar pelanggan, dipakai buat dropdown pemilihan pelanggan default POS. */
  customers?: Customer[];
  /** ID pelanggan default POS saat ini (null = pakai "Customer" umum/walk-in). */
  defaultCustomerId?: string | null;
  onUpdateDefaultCustomerId?: (customerId: string | null) => void;
}

// Checkbox catalog used by the "Tambah Staff" form — "Akses Menu" gates
// whole tabs/pages, "Akses Fitur" gates specific add/edit/delete actions
// inside a page. Both live in src/lib/permissions.ts so Sidebar and every
// feature view read the exact same keys that get checked here.
const PERMISSION_DEFS = FEATURE_PERMISSION_DEFS;

export default function SettingsView({ branches, onUpdateBranches, skuLocations, onUpdateSkuLocations, onAddActivity, currentUser, customers = [], defaultCustomerId = null, onUpdateDefaultCustomerId }: SettingsViewProps) {
  const dialog = useDialog();
  const can = (key: string) => hasPermission(currentUser, key);
  const [activeTab, setActiveTab] = useState<'profile' | 'branches' | 'locations' | 'printers' | 'security' | 'accounts' | 'audit'>('profile');
  const [storeProfile, setStoreProfile] = useState<StoreProfile>({
    storeName: 'TB Sinar Maju Pusat',
    ownerName: 'Owner',
    email: 'admin@sinarmaju-materials.com',
    phone: '+62 812-0000-0000',
    address: 'Jl. Panglima Sudirman No. 45',
    city: 'Pekanbaru',
    taxId: 'NPWP-99.283.4-X10.000',
    receiptNote: 'Terima kasih telah berbelanja',
    pin: '882100'
  });
  const [branchForm, setBranchForm] = useState({
    name: '',
    address: '',
    city: '',
    branchCode: '',
    phone: '',
    postalCode: '',
    receiptNote: '',
    imageUrl: '',
    allowNegativeStock: false,
    showStockInDigital: true,
    useDailyCash: true,
    openingHours: {
      Senin: { open: '08:00', close: '17:00', status: 'Open' as const },
      Selasa: { open: '08:00', close: '17:00', status: 'Open' as const },
      Rabu: { open: '08:00', close: '17:00', status: 'Open' as const },
      Kamis: { open: '08:00', close: '17:00', status: 'Open' as const },
      Jumat: { open: '08:00', close: '17:00', status: 'Open' as const },
      Sabtu: { open: '08:00', close: '17:00', status: 'Open' as const },
      Minggu: { open: '08:00', close: '17:00', status: 'Open' as const }
    }
  });
  const [bankAccounts, setBankAccounts] = useSupabaseTable<BankAccount>('bank_accounts', [], (b) => b.id);
  const [newBankAccount, setNewBankAccount] = useState({ name: '', type: 'Bank' as BankAccount['type'], accountNumber: '', holderName: '', notes: '', qrisImageUrl: '' });
  const [qrisImageUploading, setQrisImageUploading] = useState(false);
  const [qrisImageUploadError, setQrisImageUploadError] = useState<string | null>(null);
  const handleQrisImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setQrisImageUploadError(null);
    setQrisImageUploading(true);
    try {
      const url = await uploadProductImage(file, 'qris');
      setNewBankAccount((prev) => ({ ...prev, qrisImageUrl: url }));
    } catch (err) {
      setQrisImageUploadError(err instanceof Error ? err.message : 'Gagal mengunggah gambar QRIS.');
    } finally {
      setQrisImageUploading(false);
    }
  };

  // SKU Location (Lokasi Penyimpanan) form state - list itself is lifted to App level
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationCity, setNewLocationCity] = useState('');
  const [newLocationAddress, setNewLocationAddress] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [lockdownActive, setLockdownActive] = useState(false);

  // Profile forms state
  const [companyName, setCompanyName] = useState('TB Sinar Maju Pusat');
  const [taxId, setTaxId] = useState('NPWP-99.283.4-X10.000');
  const [email, setEmail] = useState('admin@sinarmaju-materials.com');

  // Security & Staff states
  const [ownerPin, setOwnerPin] = useState('882100');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'Owner' | 'Admin' | 'Kasir' | 'Stoker'>('Kasir');
  const [newStaffPermissions, setNewStaffPermissions] = useState<string[]>(ROLE_DEFAULT_PERMISSIONS['Kasir']);
  const [staffList, setStaffList] = useSupabaseTable<StaffMember>('staff_list', [], (s) => s.id!);

  // Printers: the saved list (name + connection type) lives in Supabase and
  // is shared across devices; the actual LIVE connection (paired
  // Bluetooth/USB device) only makes sense on whichever computer/tablet is
  // physically near the printer, so that part is local-only React state —
  // see printerConnectionsRef below.
  const [printers, setPrinters] = useSupabaseTable<Printer>('printers', [], (p) => p.id);
  const [printerConnections, setPrinterConnections] = useState<Map<string, PrinterConnectionHandle>>(new Map());
  const [connectingPrinterId, setConnectingPrinterId] = useState<string | null>(null);
  const [showAddPrinterForm, setShowAddPrinterForm] = useState(false);
  const [newPrinterName, setNewPrinterName] = useState('');
  const [newPrinterType, setNewPrinterType] = useState<'bluetooth' | 'usb'>('bluetooth');

  // Registered owner record (same Supabase row used by LoginView for first-time registration)
  const [registeredOwner, setRegisteredOwner] = useSupabaseState<{ storeName: string; ownerName: string; email: string; pin: string; taxId?: string; address?: string; phone?: string; receiptNote?: string } | null>('store_owner', null);

  // Sync derived profile fields whenever the registered-owner record changes
  useEffect(() => {
    if (registeredOwner) {
      if (registeredOwner.storeName) {
        setCompanyName(registeredOwner.storeName);
        setStoreProfile((prev) => ({ ...prev, storeName: registeredOwner.storeName, ownerName: registeredOwner.ownerName || prev.ownerName, email: registeredOwner.email || prev.email, pin: registeredOwner.pin || prev.pin }));
      }
      if (registeredOwner.email) setEmail(registeredOwner.email);
      if (registeredOwner.pin) setOwnerPin(registeredOwner.pin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registeredOwner]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 2500);
  };

  const handleBranchHoursChange = (day: string, field: 'open' | 'close' | 'status', value: string) => {
    setBranchForm((prev) => ({
      ...prev,
      openingHours: {
        ...prev.openingHours,
        [day]: {
          ...prev.openingHours[day as keyof typeof prev.openingHours],
          [field]: field === 'status' ? value : value
        }
      }
    }));
  };

  const handleAddBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchForm.name.trim() || !branchForm.city.trim()) {
      dialog.alert("Nama cabang dan kota wajib diisi!");
      return;
    }

    const newBranch: Branch = {
      name: branchForm.name.trim(),
      location: branchForm.city.trim(),
      manager: '-',
      managerInitials: branchForm.name.trim().slice(0, 2).toUpperCase(),
      hwOk: 0,
      hwError: 0,
      address: branchForm.address.trim(),
      city: branchForm.city.trim(),
      branchCode: branchForm.branchCode.trim(),
      phone: branchForm.phone.trim(),
      postalCode: branchForm.postalCode.trim(),
      receiptNote: branchForm.receiptNote.trim(),
      imageUrl: branchForm.imageUrl.trim(),
      allowNegativeStock: branchForm.allowNegativeStock,
      showStockInDigital: branchForm.showStockInDigital,
      useDailyCash: branchForm.useDailyCash,
      openingHours: branchForm.openingHours
    };

    onUpdateBranches([...branches, newBranch]);

    triggerToast(`Cabang "${newBranch.name}" berhasil ditambahkan!`);
    onAddActivity(
      "Cabang Baru Ditambahkan",
      `Cabang "${newBranch.name}" terdaftar di sistem`,
      0,
      'quote'
    );

    setBranchForm({
      name: '',
      address: '',
      city: '',
      branchCode: '',
      phone: '',
      postalCode: '',
      receiptNote: '',
      imageUrl: '',
      allowNegativeStock: false,
      showStockInDigital: true,
      useDailyCash: true,
      openingHours: {
        Senin: { open: '08:00', close: '17:00', status: 'Open' as const },
        Selasa: { open: '08:00', close: '17:00', status: 'Open' as const },
        Rabu: { open: '08:00', close: '17:00', status: 'Open' as const },
        Kamis: { open: '08:00', close: '17:00', status: 'Open' as const },
        Jumat: { open: '08:00', close: '17:00', status: 'Open' as const },
        Sabtu: { open: '08:00', close: '17:00', status: 'Open' as const },
        Minggu: { open: '08:00', close: '17:00', status: 'Open' as const }
      }
    });
  };

  const handleDeleteBranch = async (branchName: string) => {
    const confirmed = await dialog.confirm(`Hapus cabang "${branchName}"?`);
    if (confirmed) {
      onUpdateBranches(branches.filter((b) => b.name !== branchName));
      onAddActivity('Cabang Dihapus', branchName, 0, 'overdue');
      triggerToast(`Cabang "${branchName}" telah dihapus.`);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {

    e.preventDefault();

    const nextStoreProfile: StoreProfile = {
      ...storeProfile,
      storeName: companyName,
      email,
      pin: ownerPin,
      taxId,
      ownerName: storeProfile.ownerName || 'Owner'
    };
    setStoreProfile(nextStoreProfile);

    setRegisteredOwner((prev) => prev ? {
      ...prev,
      storeName: companyName,
      email,
      pin: ownerPin,
      taxId,
      address: storeProfile.address,
      phone: storeProfile.phone,
      receiptNote: storeProfile.receiptNote
    } : prev);

    triggerToast("Profil Bisnis berhasil disimpan ke database!");
    onAddActivity(
      "Memperbarui Pengaturan Sistem",
      `Mengubah metadata toko atau kontak email`,
      0,
      'quote'
    );
  };

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim()) {
      dialog.alert("Nama staf tidak boleh kosong!");
      return;
    }
    if (newStaffPin.length !== 6 || isNaN(Number(newStaffPin))) {
      dialog.alert("PIN harus berupa 6 digit angka!");
      return;
    }

    const updated = [...staffList, { id: `staff-${Date.now()}`, name: newStaffName.trim(), phone: newStaffPhone.trim(), pin: newStaffPin, role: newStaffRole, permissions: newStaffPermissions }];
    setStaffList(updated);

    triggerToast(`Akun Staf "${newStaffName}" berhasil didaftarkan!`);
    onAddActivity(
      "Pendaftaran Staf Baru",
      `Staf "${newStaffName}" ditambahkan sebagai ${newStaffRole}`,
      0,
      'quote'
    );

    // Reset forms
    setNewStaffName('');
    setNewStaffPhone('');
    setNewStaffPin('');
    setNewStaffRole('Kasir');
    setNewStaffPermissions(ROLE_DEFAULT_PERMISSIONS['Kasir']);
  };

  const handleTogglePermission = (key: string) => {
    setNewStaffPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const handleDeleteStaff = async (idxToDelete: number) => {
    const staffName = staffList[idxToDelete].name;
    const confirmed = await dialog.confirm(`Apakah Anda yakin ingin menghapus akun staf "${staffName}"?`);
    if (confirmed) {
      const updated = staffList.filter((_, idx) => idx !== idxToDelete);
      setStaffList(updated);
      onAddActivity('Akun Staf Dihapus', staffName, 0, 'overdue');
      triggerToast(`Akun Staf "${staffName}" telah dihapus.`);
    }
  };

  const handleAddLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocationName.trim() || !newLocationCity.trim()) {
      dialog.alert("Nama lokasi dan kota wajib diisi!");
      return;
    }
    const updated = [
      ...skuLocations,
      {
        id: `LOC-${Math.floor(100 + Math.random() * 900)}`,
        name: newLocationName.trim(),
        city: newLocationCity.trim(),
        address: newLocationAddress.trim()
      }
    ];
    onUpdateSkuLocations(updated);
    triggerToast(`Lokasi SKU "${newLocationName}" berhasil ditambahkan!`);
    onAddActivity("Lokasi SKU Baru", `Menambahkan lokasi penyimpanan "${newLocationName}"`, 0, 'quote');
    setNewLocationName('');
    setNewLocationCity('');
    setNewLocationAddress('');
  };

  const handleDeleteLocation = async (idToDelete: string) => {
    const loc = skuLocations.find(l => l.id === idToDelete);
    if (!loc) return;
    const confirmed = await dialog.confirm(`Hapus lokasi SKU "${loc.name}"?`);
    if (confirmed) {
      const updated = skuLocations.filter(l => l.id !== idToDelete);
      onUpdateSkuLocations(updated);
      onAddActivity('Lokasi SKU Dihapus', loc.name, 0, 'overdue');
      triggerToast(`Lokasi SKU "${loc.name}" telah dihapus.`);
    }
  };

  const handleAddBankAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBankAccount.name.trim()) {
      dialog.alert('Nama rekening wajib diisi.');
      return;
    }
    const account: BankAccount = {
      id: `acct-${Date.now()}`,
      name: newBankAccount.name.trim(),
      type: newBankAccount.type,
      accountNumber: newBankAccount.accountNumber.trim(),
      holderName: newBankAccount.holderName.trim(),
      notes: newBankAccount.notes.trim(),
      qrisImageUrl: newBankAccount.type === 'QRIS' ? (newBankAccount.qrisImageUrl.trim() || undefined) : undefined
    };
    const updated = [...bankAccounts, account];
    setBankAccounts(updated);
    onAddActivity('Rekening Pembayaran Baru', `${account.name} (${account.type})`, 0, 'quote');
    setNewBankAccount({ name: '', type: 'Bank', accountNumber: '', holderName: '', notes: '', qrisImageUrl: '' });
    setQrisImageUploadError(null);
    triggerToast(`Rekening "${account.name}" berhasil ditambahkan.`);
  };

  const handleDeleteBankAccount = (id: string) => {
    const account = bankAccounts.find((a) => a.id === id);
    const updated = bankAccounts.filter((account) => account.id !== id);
    setBankAccounts(updated);
    onAddActivity('Rekening Pembayaran Dihapus', account?.name || id, 0, 'overdue');
    triggerToast('Rekening berhasil dihapus.');
  };

  const handleConnectPrinter = async (printer: Printer) => {
    if (printerConnections.has(printer.id) || connectingPrinterId) return;
    setConnectingPrinterId(printer.id);
    try {
      const onDisconnect = () => {
        setPrinterConnections((prev) => {
          const next = new Map(prev);
          next.delete(printer.id);
          return next;
        });
        triggerToast(`${printer.name} terputus.`);
      };

      const { handle, deviceName } =
        printer.connectionType === 'bluetooth'
          ? await connectBluetoothPrinter(onDisconnect)
          : await connectUsbPrinter(onDisconnect);

      setPrinterConnections((prev) => new Map(prev).set(printer.id, handle));
      triggerToast(`Terhubung ke ${deviceName}.`);
    } catch (err: any) {
      if (err?.name === 'NotFoundError') {
        // User closed the browser's device picker without choosing anything — not a real error.
        triggerToast('Pemilihan device dibatalkan.');
      } else {
        triggerToast(`Gagal menyambungkan: ${err?.message || 'Terjadi kesalahan tidak diketahui.'}`);
      }
    } finally {
      setConnectingPrinterId(null);
    }
  };

  const handleDisconnectPrinter = (printer: Printer) => {
    printerConnections.get(printer.id)?.disconnect();
    setPrinterConnections((prev) => {
      const next = new Map(prev);
      next.delete(printer.id);
      return next;
    });
    triggerToast(`${printer.name} diputuskan.`);
  };

  const handleTestPrinter = async (printer: Printer) => {
    const handle = printerConnections.get(printer.id);
    if (!handle) {
      triggerToast('Sambungkan printer ini dulu sebelum mencetak.');
      return;
    }
    try {
      await handle.send(buildTestPrint(printer.name, companyName));
      triggerToast(`Test print terkirim ke ${printer.name}.`);
    } catch (err: any) {
      triggerToast(`Gagal mencetak: ${err?.message || 'Terjadi kesalahan tidak diketahui.'}`);
    }
  };

  const handleAddPrinter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrinterName.trim()) {
      dialog.alert('Nama printer tidak boleh kosong!');
      return;
    }
    const newPrinter: Printer = { id: `printer-${Date.now()}`, name: newPrinterName.trim(), connectionType: newPrinterType };
    setPrinters([...printers, newPrinter]);
    onAddActivity('Printer Baru Ditambahkan', newPrinter.name, 0, 'quote');
    triggerToast(`Printer "${newPrinter.name}" ditambahkan — klik "Sambungkan" untuk memasangkannya.`);
    setNewPrinterName('');
    setNewPrinterType('bluetooth');
    setShowAddPrinterForm(false);
  };

  const handleDeletePrinter = async (printer: Printer) => {
    if (!(await dialog.confirm(`Apakah Anda yakin ingin menghapus printer ${printer.name}?`))) return;
    if (printerConnections.has(printer.id)) handleDisconnectPrinter(printer);
    setPrinters(printers.filter((p) => p.id !== printer.id));
    onAddActivity('Printer Dihapus', printer.name, 0, 'overdue');
    triggerToast(`Printer dihapus: ${printer.name}`);
  };

  const handleLockdown = async () => {
    const confirmed = await dialog.confirm("PERINGATAN KRITIS: Aktifkan Protokol Lockdown Darurat?\nTindakan ini akan memutuskan seluruh mesin kasir POS aktif dan mengenkripsi database.");
    if (confirmed) {
      setLockdownActive(true);
      onAddActivity('Protokol Lockdown Diaktifkan', `Diaktifkan oleh ${currentUser?.name || 'Owner'}`, 0, 'overdue');
    }
  };

  const [backingUp, setBackingUp] = useState(false);

  // Audit log viewer state — fetched on demand (only when the Owner opens
  // the tab) rather than kept live/realtime, since this table can grow
  // large and isn't needed for normal app operation.
  interface AuditLogRow {
    id: number;
    table_name: string;
    row_key: string | null;
    action: 'INSERT' | 'UPDATE' | 'DELETE';
    old_data: any;
    new_data: any;
    actor_name: string | null;
    created_at: string;
  }
  const [auditRows, setAuditRows] = useState<AuditLogRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditTableFilter, setAuditTableFilter] = useState('__all__');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditExpandedId, setAuditExpandedId] = useState<number | null>(null);
  const AUDIT_PAGE_SIZE = 50;

  const fetchAuditLog = async (reset: boolean) => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      let query = supabase
        .from('audit_log')
        .select('id, table_name, row_key, action, old_data, new_data, actor_name, created_at')
        .order('created_at', { ascending: false })
        .limit(AUDIT_PAGE_SIZE);

      if (auditTableFilter !== '__all__') query = query.eq('table_name', auditTableFilter);
      if (!reset && auditRows.length > 0) query = query.lt('created_at', auditRows[auditRows.length - 1].created_at);

      const { data, error } = await query;
      if (error) throw error;
      setAuditRows(reset ? (data || []) : [...auditRows, ...(data || [])]);
    } catch (err: any) {
      setAuditError(err?.message || 'Gagal memuat log audit. Pastikan file backend/supabase/audit_log.sql sudah dijalankan di Supabase SQL Editor.');
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLog(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, auditTableFilter]);

  const AUDIT_TABLE_OPTIONS = [
    'products', 'purchase_orders', 'customers', 'suppliers', 'expenses',
    'sales_invoices', 'returns', 'digital_orders', 'banners', 'sku_locations',
    'staff_list', 'bank_accounts', 'printers', 'branches', 'store_owner',
  ];

  const actionBadgeClass: Record<string, string> = {
    INSERT: 'bg-emerald-50 text-emerald-700',
    UPDATE: 'bg-amber-50 text-amber-700',
    DELETE: 'bg-red-50 text-red-700',
  };
  const actionLabel: Record<string, string> = { INSERT: 'Ditambah', UPDATE: 'Diubah', DELETE: 'Dihapus' };

  const filteredAuditRows = auditRows.filter((r) => {
    if (!auditSearch.trim()) return true;
    const q = auditSearch.toLowerCase();
    return (r.actor_name || '').toLowerCase().includes(q) || (r.row_key || '').toLowerCase().includes(q);
  });
  const handleDownloadBackup = async () => {
    setBackingUp(true);
    const result = await backupAllBusinessData();
    setBackingUp(false);

    if (!result.json) {
      dialog.alert('Gagal membuat backup — semua tabel gagal diambil. Cek koneksi internet lalu coba lagi.');
      return;
    }
    downloadBackupJson(result.json);
    if (result.errors.length > 0) {
      dialog.alert(`Backup berhasil diunduh, tapi ada ${result.errors.length} tabel yang gagal diambil (kemungkinan kosong/tidak ada masalah besar):\n\n${result.errors.join('\n')}`);
    } else {
      triggerToast('Backup data berhasil diunduh.');
    }
  };

  const [resettingData, setResettingData] = useState(false);
  const handleResetAllData = async () => {
    // Hard-coded to Owner only (not routed through the customizable
    // permission system) — this is irreversible and shouldn't be something
    // that can end up granted to a lesser role via a Settings checkbox.
    if (currentUser?.role !== 'Owner') {
      dialog.alert("Hanya Owner yang bisa menghapus seluruh data.");
      return;
    }
    const CONFIRM_PHRASE = 'HAPUS SEMUA DATA';
    const typed = await dialog.prompt(
      `Tindakan ini akan MENGHAPUS PERMANEN seluruh data produk, transaksi, pelanggan, pemasok, keuangan, retur, opname, dan sesi kas — TIDAK BISA dibatalkan.\n\nAkun login (Owner & staf) tidak akan terhapus.\n\nBackup JSON akan otomatis diunduh sebelum penghapusan dimulai.\n\nKetik "${CONFIRM_PHRASE}" untuk melanjutkan:`,
      '',
      { title: 'Hapus Seluruh Data', confirmLabel: 'Hapus Permanen' }
    );
    if (typed === null) return; // cancelled
    if (typed.trim().toUpperCase() !== CONFIRM_PHRASE) {
      dialog.alert('Teks konfirmasi tidak cocok. Penghapusan dibatalkan.');
      return;
    }

    setResettingData(true);

    // Always back up first — if this fails outright, stop before touching
    // any data so a broken backup never leads to unrecoverable data loss.
    const backup = await backupAllBusinessData();
    if (!backup.json) {
      setResettingData(false);
      dialog.alert('Backup otomatis GAGAL dibuat, jadi penghapusan DIBATALKAN demi keamanan data. Cek koneksi internet lalu coba lagi.');
      return;
    }
    downloadBackupJson(backup.json);

    const result = await resetAllBusinessData();
    setResettingData(false);

    if (result.ok) {
      dialog.alert('Backup sudah diunduh dan seluruh data berhasil dihapus. Halaman akan dimuat ulang.');
      window.location.reload();
    } else {
      dialog.alert(`Sebagian data gagal dihapus:\n${result.errors.join('\n')}`);
    }
  };

  return (
    <div className="space-y-6 relative overflow-x-hidden">
      {/* Title Header */}
      <div>
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Pengaturan Sistem</h2>
        <p className="text-gray-500 text-sm">Kelola metadata bisnis, pendaftaran staf, printer thermal kasir, dan protokol keamanan internal.</p>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex flex-wrap border-b border-gray-200 gap-x-6 gap-y-2">
        {([
          { key: 'profile', label: 'Profil Bisnis', icon: Building, show: true },
          { key: 'branches', label: 'Cabang', icon: MapPin, show: true },
          { key: 'locations', label: 'Lokasi SKU', icon: Warehouse, show: can('manage_gudang_list') },
          { key: 'printers', label: 'Printer Thermal', icon: PrinterIcon, show: true },
          { key: 'security', label: 'Staff', icon: ShieldCheck, show: can('manage_user_list') },
          { key: 'accounts', label: 'Daftar Rekening', icon: CreditCard, show: can('manage_rekening_list') },
          { key: 'audit', label: 'Log Audit', icon: History, show: currentUser?.role === 'Owner' },
        ] as const).map((tab) => tab.show && (
          <Button
            key={tab.key}
            variant="ghost"
            onClick={() => setActiveTab(tab.key)}
            className={`h-auto pb-3 px-0 rounded-none text-xs uppercase tracking-wider hover:bg-transparent ${
              activeTab === tab.key ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </Button>
        ))}
      </div>

      {/* Tabs Contents Wrapper */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs max-w-2xl">
        
        {/* Tab 1: Profile */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
            <div className="border-b border-gray-100 pb-2 mb-4">
              <h4 className="font-extrabold text-sm text-gray-800">Informasi Bisnis Utama</h4>
              <p className="text-[10px] text-gray-400 mt-0.5">Field di bawah ini persis yang akan tercetak di struk pembeli.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Nama Resmi Perusahaan / Toko</Label>
                <Input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div>
                <Label>Nomor Telepon Toko</Label>
                <Input
                  type="text"
                  value={storeProfile.phone || ''}
                  onChange={(e) => setStoreProfile((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label>Alamat Toko</Label>
              <Input
                type="text"
                value={storeProfile.address || ''}
                onChange={(e) => setStoreProfile((prev) => ({ ...prev, address: e.target.value }))}
              />
            </div>

            <div>
              <Label>Nomor NPWP Terdaftar</Label>
              <Input
                type="text"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                className="font-mono"
              />
            </div>

            <div>
              <Label>Catatan di Struk Penjualan</Label>
              <Textarea
                rows={3}
                value={storeProfile.receiptNote || ''}
                onChange={(e) => setStoreProfile((prev) => ({ ...prev, receiptNote: e.target.value }))}
              />
            </div>

            <div className="pt-2 border-t border-gray-100">
              <Label>Pelanggan Default di POS</Label>
              <p className="text-[10px] text-gray-400 mb-1.5">
                Pelanggan yang otomatis terpilih tiap buka halaman POS. Kalau dikosongkan, POS pakai pelanggan umum "Customer".
              </p>
              <Select
                value={defaultCustomerId || '__none__'}
                onValueChange={(v) => onUpdateDefaultCustomerId?.(v === '__none__' ? null : v)}
                disabled={!onUpdateDefaultCustomerId}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Customer (Pelanggan Umum)</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Account/login field — kept separate since it's used for signing in, not printed on the receipt */}
            <div className="pt-2 border-t border-gray-100">
              <Label>Alamat Email Kontak <span className="normal-case font-medium text-gray-300">(untuk login, tidak tampil di struk)</span></Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <Button type="submit" className="shadow-md shadow-blue-500/10">
                <Save className="w-4 h-4" />
                <span>Simpan Perubahan</span>
              </Button>
            </div>
          </form>
        )}

        {/* Tab 2: Branches */}
        {activeTab === 'branches' && (
          <div className="space-y-6 text-xs">
            <form onSubmit={handleAddBranch} className="space-y-4 rounded-2xl border border-blue-100 bg-blue-50/20 p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-sm text-gray-800">Data Cabang</h4>
                <span className="text-[10px] uppercase tracking-wider text-blue-600">Setting cabang toko</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[9px]">Nama Cabang</Label>
                  <Input type="text" value={branchForm.name} onChange={(e) => setBranchForm((prev) => ({ ...prev, name: e.target.value }))} className="bg-white" />
                </div>
                <div>
                  <Label className="text-[9px]">Kode Cabang</Label>
                  <Input type="text" value={branchForm.branchCode} onChange={(e) => setBranchForm((prev) => ({ ...prev, branchCode: e.target.value }))} className="bg-white" />
                </div>
                <div>
                  <Label className="text-[9px]">Alamat</Label>
                  <Input type="text" value={branchForm.address} onChange={(e) => setBranchForm((prev) => ({ ...prev, address: e.target.value }))} className="bg-white" />
                </div>
                <div>
                  <Label className="text-[9px]">Kota</Label>
                  <Input type="text" value={branchForm.city} onChange={(e) => setBranchForm((prev) => ({ ...prev, city: e.target.value }))} className="bg-white" />
                </div>
                <div>
                  <Label className="text-[9px]">Nomor Telepon</Label>
                  <Input type="text" value={branchForm.phone} onChange={(e) => setBranchForm((prev) => ({ ...prev, phone: e.target.value }))} className="bg-white" />
                </div>
                <div>
                  <Label className="text-[9px]">Kode Pos</Label>
                  <Input type="text" value={branchForm.postalCode} onChange={(e) => setBranchForm((prev) => ({ ...prev, postalCode: e.target.value }))} className="bg-white" />
                </div>
              </div>

              <div>
                <Label className="text-[9px]">Catatan di Struk</Label>
                <Textarea rows={2} value={branchForm.receiptNote} onChange={(e) => setBranchForm((prev) => ({ ...prev, receiptNote: e.target.value }))} className="bg-white" />
              </div>

              <div>
                <Label className="text-[9px]">URL Gambar Cabang (opsional)</Label>
                <Input type="text" value={branchForm.imageUrl} onChange={(e) => setBranchForm((prev) => ({ ...prev, imageUrl: e.target.value }))} className="bg-white" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 text-[10px] font-bold text-gray-700 cursor-pointer">
                  <Checkbox checked={branchForm.allowNegativeStock} onCheckedChange={(v) => setBranchForm((prev) => ({ ...prev, allowNegativeStock: v === true }))} />
                  Izinkan stok minus
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 text-[10px] font-bold text-gray-700 cursor-pointer">
                  <Checkbox checked={branchForm.showStockInDigital} onCheckedChange={(v) => setBranchForm((prev) => ({ ...prev, showStockInDigital: v === true }))} />
                  Tampilkan stok di toko digital
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 text-[10px] font-bold text-gray-700 cursor-pointer">
                  <Checkbox checked={branchForm.useDailyCash} onCheckedChange={(v) => setBranchForm((prev) => ({ ...prev, useDailyCash: v === true }))} />
                  Gunakan fitur kas harian
                </label>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-gray-400">Jam Operasional</p>
                <div className="space-y-2">
                  {(Object.entries(branchForm.openingHours) as [string, { open: string; close: string; status: string }][]).map(([day, value]) => (
                    <div key={day} className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[10px]">
                      <div className="rounded-lg bg-gray-50 p-2 font-bold text-gray-700">{day}</div>
                      <Input type="time" value={value.open} onChange={(e) => handleBranchHoursChange(day, 'open', e.target.value)} className="h-auto p-2 text-[10px]" />
                      <Input type="time" value={value.close} onChange={(e) => handleBranchHoursChange(day, 'close', e.target.value)} className="h-auto p-2 text-[10px]" />
                      <Select value={value.status} onValueChange={(v) => handleBranchHoursChange(day, 'status', v)}>
                        <SelectTrigger className="h-auto p-2 text-[10px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Open">Buka</SelectItem>
                          <SelectItem value="Closed">Tutup</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit">Simpan Cabang</Button>
              </div>
            </form>

            <div className="space-y-2">
              <h4 className="font-extrabold text-sm text-gray-800">Daftar Cabang Tersimpan</h4>
              {branches.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-gray-400">Belum ada cabang terdaftar.</p>
              ) : branches.map((b) => (
                <div key={`${b.name}-${b.location}`} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-800 truncate">{b.name}</p>
                      <p className="text-[10px] text-gray-400 truncate">{b.location}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 whitespace-nowrap">{b.branchCode || 'Kode belum ada'}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteBranch(b.name)}
                        className="w-7 h-7 text-red-500"
                        aria-label={`Hapus cabang ${b.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2b: SKU Locations (Lokasi SKU) */}
        {activeTab === 'locations' && (
          <div className="space-y-6 text-xs">
            <div>
              <h4 className="font-extrabold text-sm text-gray-800 border-b border-gray-100 pb-2 mb-3">Lokasi Penyimpanan Barang (Lokasi SKU)</h4>
              <p className="text-[10px] text-gray-400 leading-relaxed mb-3">Tambahkan lokasi sesuai gudang, rak, atau area penyimpanan barang di bisnis Anda. Hanya nama lokasi dan kota yang wajib diisi.</p>

              {can('manage_gudang_add') && (
                <form onSubmit={handleAddLocation} className="p-4 border border-blue-100 rounded-xl bg-blue-50/20 space-y-3.5">
                  <span className="font-black text-[10px] uppercase text-blue-600 tracking-wider">Tambah Lokasi Baru</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[9px]">Nama Lokasi <span className="text-red-500">*</span></Label>
                      <Input
                        type="text"
                        placeholder="Contoh: Gudang Belakang, Rak Cat..."
                        value={newLocationName}
                        onChange={(e) => setNewLocationName(e.target.value)}
                        className="bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-[9px]">Kota <span className="text-red-500">*</span></Label>
                      <Input
                        type="text"
                        placeholder="Contoh: Pekanbaru"
                        value={newLocationCity}
                        onChange={(e) => setNewLocationCity(e.target.value)}
                        className="bg-white"
                      />
                    </div>
                </div>
                <div>
                  <Label className="text-[9px]">Alamat (opsional)</Label>
                  <Input
                    type="text"
                    placeholder="Alamat lengkap lokasi..."
                    value={newLocationAddress}
                    onChange={(e) => setNewLocationAddress(e.target.value)}
                    className="bg-white"
                  />
                </div>
                <div className="flex justify-end pt-1.5">
                  <Button type="submit" size="sm">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Lokasi</span>
                  </Button>
                </div>
              </form>
              )}
            </div>

            <div className="space-y-2">
              <span className="font-extrabold text-[10px] text-gray-400 uppercase tracking-wider block">Lokasi Terdaftar ({skuLocations.length})</span>
              <div className="border border-gray-100 rounded-xl divide-y divide-gray-100 overflow-hidden bg-white">
                {skuLocations.length === 0 ? (
                  <p className="p-4 text-center text-gray-400">Belum ada lokasi SKU terdaftar.</p>
                ) : (
                  skuLocations.map((loc) => (
                    <div key={loc.id} className="flex justify-between items-center p-3 bg-gray-50/30 hover:bg-gray-100/20 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center">
                          <Warehouse className="w-4 h-4 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">{loc.name}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{loc.city}{loc.address ? ` • ${loc.address}` : ''}</p>
                        </div>
                      </div>
                      {can('manage_gudang_delete') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteLocation(loc.id)}
                          className="w-8 h-8 text-red-400 hover:text-red-600"
                          title="Hapus Lokasi"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Printers */}
        {activeTab === 'printers' && (
          <div className="space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-1">
              <h4 className="font-extrabold text-sm text-gray-800">Integrasi Hardware Pencetakan Struk</h4>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowAddPrinterForm((v) => !v)}
                className="bg-blue-100/70 text-blue-800 hover:bg-blue-600 hover:text-white text-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Printer
              </Button>
            </div>

            {!isBluetoothSupported() && !isUsbSupported() && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
                <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="text-[10px] leading-relaxed">Browser ini tidak mendukung Web Bluetooth maupun WebUSB, jadi printer tidak bisa disambungkan dari sini. Buka halaman ini pakai <strong>Chrome</strong> atau <strong>Edge</strong> terbaru (desktop, atau Android untuk Bluetooth).</p>
              </div>
            )}

            {showAddPrinterForm && (
              <form onSubmit={handleAddPrinter} className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                <div>
                  <Label className="text-[9px]">Nama Printer</Label>
                  <Input
                    type="text"
                    value={newPrinterName}
                    onChange={(e) => setNewPrinterName(e.target.value)}
                    placeholder="Contoh: Printer Kasir Depan"
                    className="bg-white"
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-[9px] mb-1.5">Jenis Koneksi</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setNewPrinterType('bluetooth')}
                      className={newPrinterType === 'bluetooth' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white text-gray-500'}
                    >
                      <Bluetooth className="w-3.5 h-3.5" /> Bluetooth
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setNewPrinterType('usb')}
                      className={newPrinterType === 'usb' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white text-gray-500'}
                    >
                      <Usb className="w-3.5 h-3.5" /> USB
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="submit" className="flex-1">
                    Simpan Printer
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddPrinterForm(false)}
                    className="flex-1"
                  >
                    Batal
                  </Button>
                </div>
              </form>
            )}
            
            <div className="space-y-3">
              {printers.length === 0 && !showAddPrinterForm && (
                <p className="text-center text-gray-400 py-8 uppercase tracking-wide text-[10px]">Belum ada printer terdaftar. Klik "Tambah Printer" untuk mulai.</p>
              )}
              {printers.map((pr) => {
                const isConnected = printerConnections.has(pr.id);
                const isConnecting = connectingPrinterId === pr.id;
                return (
                  <div key={pr.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      {isConnected ? (
                        <Wifi className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <WifiOff className="w-5 h-5 text-gray-400" />
                      )}
                      <div>
                        <h5 className="font-bold text-gray-800">{pr.name}</h5>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5 flex items-center gap-1">
                          {pr.connectionType === 'bluetooth' ? <Bluetooth className="w-3 h-3" /> : <Usb className="w-3 h-3" />}
                          {pr.connectionType === 'bluetooth' ? 'Bluetooth' : 'USB'} • Status: <span className={isConnected ? 'text-emerald-600 font-bold' : 'text-gray-400'}>{isConnected ? 'Terhubung (perangkat ini)' : 'Belum terhubung'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => (isConnected ? handleDisconnectPrinter(pr) : handleConnectPrinter(pr))}
                        disabled={isConnecting}
                        className="text-[10px] bg-white text-gray-700 disabled:cursor-wait"
                      >
                        {isConnecting && <Loader2 className="w-3 h-3 animate-spin" />}
                        {isConnecting ? 'Menyambungkan...' : isConnected ? 'Putuskan' : 'Sambungkan'}
                      </Button>
                      {isConnected && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleTestPrinter(pr)}
                          className="text-[10px] bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white"
                        >
                          Cetak Test Roll
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeletePrinter(pr)}
                        className="w-7 h-7 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white"
                        title="Hapus Printer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-[9px] text-gray-400 leading-relaxed pt-1">
              Koneksi Bluetooth/USB bersifat per-perangkat: setiap kasir/komputer yang ada di dekat printer perlu memasangkannya sendiri lewat browser-nya masing-masing (persis seperti menyambungkan Bluetooth headset). Daftar nama printer di atas tersimpan bersama, tapi status "Terhubung" hanya berlaku untuk perangkat yang sedang kamu pakai sekarang.
            </p>
          </div>
        )}

        {activeTab === 'accounts' && (
          <div className="space-y-6 text-xs">
            {can('manage_rekening_add') && (
            <form onSubmit={handleAddBankAccount} className="space-y-4 rounded-2xl border border-blue-100 bg-blue-50/20 p-4">
              <h4 className="font-extrabold text-sm text-gray-800">Data Rekening Toko</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[9px]">Nama Rekening</Label>
                  <Input type="text" value={newBankAccount.name} onChange={(e) => setNewBankAccount((prev) => ({ ...prev, name: e.target.value }))} className="bg-white" />
                </div>
                <div>
                  <Label className="text-[9px]">Tipe</Label>
                  <Select value={newBankAccount.type} onValueChange={(v) => setNewBankAccount((prev) => ({ ...prev, type: v as BankAccount['type'] }))}>
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bank">Bank</SelectItem>
                      <SelectItem value="E-Wallet">E-Wallet</SelectItem>
                      <SelectItem value="QRIS">QRIS</SelectItem>
                      <SelectItem value="Cash">Tunai</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[9px]">Nomor Rekening / QRIS</Label>
                  <Input type="text" value={newBankAccount.accountNumber} onChange={(e) => setNewBankAccount((prev) => ({ ...prev, accountNumber: e.target.value }))} className="bg-white" />
                </div>
                <div>
                  <Label className="text-[9px]">Nama Pemilik</Label>
                  <Input type="text" value={newBankAccount.holderName} onChange={(e) => setNewBankAccount((prev) => ({ ...prev, holderName: e.target.value }))} className="bg-white" />
                </div>
              </div>
              <div>
                <Label className="text-[9px]">Catatan</Label>
                <Textarea rows={2} value={newBankAccount.notes} onChange={(e) => setNewBankAccount((prev) => ({ ...prev, notes: e.target.value }))} className="bg-white" />
              </div>
              {newBankAccount.type === 'QRIS' && (
                <div>
                  <Label className="text-[9px]">Gambar QRIS</Label>
                  <p className="text-[9px] text-gray-400 mb-2">Unggah gambar kode QRIS toko sekali di sini — kode ini yang akan tampil di halaman Pos Kasir setiap kali pelanggan memilih bayar QRIS.</p>
                  <div className="flex items-center gap-3">
                    {newBankAccount.qrisImageUrl && (
                      <img src={newBankAccount.qrisImageUrl} alt="Preview QRIS" className="w-16 h-16 rounded-lg border border-gray-200 object-contain bg-white" />
                    )}
                    <label className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[11px] font-bold text-gray-700 cursor-pointer hover:bg-gray-50">
                      {qrisImageUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      <span>{qrisImageUploading ? 'Mengunggah...' : newBankAccount.qrisImageUrl ? 'Ganti Gambar' : 'Unggah Gambar QRIS'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleQrisImageFileSelect} disabled={qrisImageUploading} />
                    </label>
                  </div>
                  {qrisImageUploadError && <p className="text-[9px] text-red-500 font-bold mt-1">{qrisImageUploadError}</p>}
                </div>
              )}
              <div className="flex justify-end">
                <Button type="submit">Tambah Rekening</Button>
              </div>
            </form>
            )}

            <div className="space-y-2">
              <h4 className="font-extrabold text-sm text-gray-800">Daftar Rekening Tersimpan</h4>
              {bankAccounts.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-gray-400">Belum ada rekening tersimpan.</p>
              ) : bankAccounts.map((account) => (
                <div key={account.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {account.type === 'QRIS' && account.qrisImageUrl && (
                        <img src={account.qrisImageUrl} alt="QRIS" className="w-10 h-10 rounded-lg border border-gray-200 object-contain bg-white shrink-0" />
                      )}
                      <div>
                        <p className="font-bold text-gray-800">{account.name}</p>
                        <p className="text-[10px] text-gray-400">{account.type} • {account.accountNumber || 'Tidak ada nomor'} • {account.holderName || 'Tanpa pemilik'}</p>
                        {account.type === 'QRIS' && !account.qrisImageUrl && (
                          <p className="text-[9px] text-amber-500 font-bold mt-0.5">Belum ada gambar QRIS diunggah.</p>
                        )}
                      </div>
                    </div>
                    {can('manage_rekening_delete') && (
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteBankAccount(account.id)} className="w-8 h-8 text-red-500"> <Trash2 className="w-4 h-4" /> </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Security & Staff Accounts (NEW requested feature) */}
        {activeTab === 'security' && (
          <div className="space-y-6 text-xs">
            
            {/* Owner PIN Display */}
            <div>
              <h4 className="font-extrabold text-sm text-gray-800 border-b border-gray-100 pb-2 mb-3">Kredensial PIN Owner (Pemilik)</h4>
              <div className="flex justify-between items-center p-3.5 border border-gray-200 rounded-xl bg-gray-50/50">
                <div>
                  <h5 className="font-bold text-gray-800">PIN Utama Pemilik Toko</h5>
                  <p className="text-[10px] text-gray-400 mt-0.5">Digunakan untuk login Owner di halaman awal dan otorisasi menu-menu vital.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="password"
                    value={ownerPin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setOwnerPin(val);
                    }}
                    placeholder="882100"
                    className="w-20 h-9 text-center font-mono"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      if (ownerPin.length !== 6) {
                        dialog.alert("PIN Owner harus berisi 6 digit angka!");
                        return;
                      }
                      setRegisteredOwner((prev) => prev ? { ...prev, pin: ownerPin } : prev);
                      triggerToast("PIN Utama Owner berhasil dimodifikasi.");
                    }}
                    className="text-[10px]"
                  >
                    Simpan PIN
                  </Button>
                </div>
              </div>
            </div>

            {/* Dynamic Staff Creation Forms */}
            <div>
              <h4 className="font-extrabold text-sm text-gray-800 border-b border-gray-100 pb-2 mb-3">Daftarkan &amp; Kelola Akun Staf Kasir</h4>
              
              {can('manage_user_add') && (
              <form onSubmit={handleAddStaff} className="p-4 border border-blue-100 rounded-xl bg-blue-50/20 space-y-3.5">
                <span className="font-black text-[10px] uppercase text-blue-600 tracking-wider">Formulir Tambah Staf Baru</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[9px]">Nama Lengkap Staf</Label>
                    <Input
                      type="text"
                      placeholder="Masukkan nama staf..."
                      value={newStaffName}
                      onChange={(e) => setNewStaffName(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[9px]">6-Digit PIN Kasir (Hanya Angka)</Label>
                    <Input
                      type="password"
                      placeholder="Contoh: 123456"
                      value={newStaffPin}
                      maxLength={6}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setNewStaffPin(val);
                      }}
                      className="bg-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-[9px]">Peran (Role)</Label>
                  <Select
                    value={newStaffRole}
                    onValueChange={(v) => {
                      const role = v as 'Admin' | 'Kasir' | 'Stoker';
                      setNewStaffRole(role);
                      setNewStaffPermissions(ROLE_DEFAULT_PERMISSIONS[role]);
                    }}
                  >
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Admin">Admin</SelectItem>
                      <SelectItem value="Kasir">Kasir</SelectItem>
                      <SelectItem value="Stoker">Stoker</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="mb-1.5">Akses Menu (Tab yang Bisa Dibuka)</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-white border border-gray-200 rounded-lg p-2.5">
                    {TAB_DEFS.map((tab) => (
                      <label key={tab.key} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={newStaffPermissions.includes(tab.key)}
                          onCheckedChange={() => handleTogglePermission(tab.key)}
                        />
                        <span className="text-gray-700 font-medium">{tab.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="mb-1.5">Akses Fitur (Custom Permission)</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-white border border-gray-200 rounded-lg p-2.5">
                    {PERMISSION_DEFS.map((perm) => (
                      <label key={perm.key} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={newStaffPermissions.includes(perm.key)}
                          onCheckedChange={() => handleTogglePermission(perm.key)}
                        />
                        <span className="text-gray-700 font-medium">{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-1.5">
                  <Button type="submit" size="sm">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Daftarkan Akun Staf</span>
                  </Button>
                </div>
              </form>
              )}
            </div>

            {/* Existing Registered Staff List */}
            <div className="space-y-2">
              <span className="font-extrabold text-[10px] text-gray-400 uppercase tracking-wider block">Staf Kasir Terdaftar ({staffList.length})</span>
              
              <div className="border border-gray-100 rounded-xl divide-y divide-gray-100 overflow-hidden bg-white">
                {staffList.length === 0 ? (
                  <p className="p-4 text-center text-gray-400">Belum ada staf kasir terdaftar. Owner dapat mendaftarkan beberapa staf di atas.</p>
                ) : (
                  staffList.map((st, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 text-xs bg-gray-50/30 hover:bg-gray-100/20 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center font-bold text-gray-700">
                          {st.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">{st.name} <span className="ml-1 text-[9px] font-bold uppercase text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{st.role || 'Kasir'}</span></p>
                          <p className="text-[10px] text-gray-400 mt-0.5">PIN: **** (Terenkripsi) · {(st.permissions || []).length} akses fitur khusus</p>
                        </div>
                      </div>

                      {can('manage_user_delete') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteStaff(idx)}
                          className="w-8 h-8 text-red-400 hover:text-red-600"
                          title="Hapus Akun Staf"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Emergency Protocols */}
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2">
              <div className="flex items-start gap-2.5 text-red-900">
                <AlertOctagon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-bold">Protokol Keamanan Lockdown Darurat</h5>
                  <p className="text-[10px] text-red-700 leading-relaxed mt-0.5">
                    Memutus paksa koneksi seluruh tablet kasir kasir yang aktif, mengenkripsi database lokal, serta mengamankan kredensial utama. Gunakan hanya jika terjadi anomali sistem kritis.
                  </p>
                </div>
              </div>
              <div className="pt-2">
                <Button
                  onClick={handleLockdown}
                  className="w-full bg-red-600 hover:bg-red-700 shadow-md"
                >
                  Aktifkan Lockdown Darurat
                </Button>
              </div>
            </div>

            {/* Manual backup — usable any time, not just right before a reset */}
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
              <div className="flex items-start gap-2.5 text-emerald-900">
                <Save className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-bold">Backup Data Sekarang</h5>
                  <p className="text-[10px] text-emerald-700 leading-relaxed mt-0.5">
                    Unduh salinan seluruh data (produk, transaksi, pelanggan, keuangan, dll) sebagai file JSON ke perangkat kamu. Aman dijalankan kapan saja, tidak mengubah data apapun.
                  </p>
                </div>
              </div>
              <div className="pt-1">
                <Button
                  onClick={handleDownloadBackup}
                  disabled={backingUp}
                  variant="outline"
                  className="w-full bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                >
                  {backingUp ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyiapkan Backup...</span>
                    </>
                  ) : (
                    <span>Download Backup (.json)</span>
                  )}
                </Button>
              </div>
            </div>

            {/* Danger Zone: reset all business data (Owner only) */}
            {currentUser?.role === 'Owner' && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2">
                <div className="flex items-start gap-2.5 text-red-900">
                  <AlertOctagon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold">Hapus Seluruh Data (Reset Pabrik)</h5>
                    <p className="text-[10px] text-red-700 leading-relaxed mt-0.5">
                      Menghapus PERMANEN seluruh produk, transaksi penjualan, PO, pelanggan, pemasok, keuangan, retur, opname, dan sesi kas. Backup JSON otomatis diunduh sebelum penghapusan dimulai. Cocok dipakai untuk membersihkan data uji coba sebelum pakai serius. Akun login Owner &amp; staf TIDAK ikut terhapus — tidak akan ada yang ter-lockout.
                    </p>
                  </div>
                </div>
                <div className="pt-2">
                  <Button
                    onClick={handleResetAllData}
                    disabled={resettingData}
                    className="w-full bg-red-600 hover:bg-red-700 shadow-md disabled:opacity-60"
                  >
                    {resettingData ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Menghapus Data...</span>
                      </>
                    ) : (
                      <span>Hapus Seluruh Data</span>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Audit Log */}
        {activeTab === 'audit' && currentUser?.role === 'Owner' && (
          <div className="space-y-4 text-xs">
            <div className="border-b border-gray-100 pb-2 mb-1">
              <h4 className="font-extrabold text-sm text-gray-800">Log Audit — Siapa Mengubah Apa</h4>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Catatan otomatis setiap perubahan data (tambah/ubah/hapus) di seluruh sistem, lengkap dengan nama staf yang melakukannya.
              </p>
            </div>

            {auditError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-[11px] leading-relaxed">
                {auditError}
              </div>
            )}

            <div className="flex flex-wrap items-end gap-2">
              <div className="w-48">
                <Label className="text-[9px]">Filter Tabel</Label>
                <Select value={auditTableFilter} onValueChange={setAuditTableFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Semua Tabel</SelectItem>
                    {AUDIT_TABLE_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative flex-1 min-w-[180px]">
                <Label className="text-[9px]">Cari Nama Staf / ID Baris</Label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 z-10" />
                  <Input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Contoh: Fikri, SKU-001..."
                    className="pl-8 h-9"
                  />
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => fetchAuditLog(true)} disabled={auditLoading}>
                {auditLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <History className="w-3.5 h-3.5" />}
                <span>Muat Ulang</span>
              </Button>
            </div>

            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-gray-50">
                    <TableHead>Waktu</TableHead>
                    <TableHead>Tabel</TableHead>
                    <TableHead>Aksi</TableHead>
                    <TableHead>ID Baris</TableHead>
                    <TableHead>Oleh</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAuditRows.length === 0 && !auditLoading ? (
                    <TableRow><TableCell colSpan={6} className="p-6 text-center text-gray-400">Belum ada log yang cocok.</TableCell></TableRow>
                  ) : (
                    filteredAuditRows.map((row) => (
                      <React.Fragment key={row.id}>
                        <TableRow
                          className="cursor-pointer"
                          onClick={() => setAuditExpandedId(auditExpandedId === row.id ? null : row.id)}
                        >
                          <TableCell className="text-gray-500 whitespace-nowrap">
                            {new Date(row.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </TableCell>
                          <TableCell className="font-mono text-gray-700">{row.table_name}</TableCell>
                          <TableCell>
                            <Badge className={`border-transparent ${actionBadgeClass[row.action]}`}>{actionLabel[row.action] || row.action}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-gray-500 truncate max-w-[140px]">{row.row_key || '-'}</TableCell>
                          <TableCell className="font-bold text-gray-800">{row.actor_name || <span className="text-gray-300 font-normal">Tidak diketahui</span>}</TableCell>
                          <TableCell className="text-gray-400">{auditExpandedId === row.id ? '▲' : '▼'}</TableCell>
                        </TableRow>
                        {auditExpandedId === row.id && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={6} className="bg-gray-50/70">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2">
                                <div>
                                  <p className="text-[9px] font-black uppercase text-gray-400 mb-1">Sebelum</p>
                                  <pre className="text-[10px] bg-white border border-gray-200 rounded-lg p-2 overflow-x-auto max-h-48 overflow-y-auto">{row.old_data ? JSON.stringify(row.old_data, null, 2) : '(tidak ada — baris baru)'}</pre>
                                </div>
                                <div>
                                  <p className="text-[9px] font-black uppercase text-gray-400 mb-1">Sesudah</p>
                                  <pre className="text-[10px] bg-white border border-gray-200 rounded-lg p-2 overflow-x-auto max-h-48 overflow-y-auto">{row.new_data ? JSON.stringify(row.new_data, null, 2) : '(tidak ada — baris dihapus)'}</pre>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {auditRows.length > 0 && auditRows.length % AUDIT_PAGE_SIZE === 0 && (
              <div className="flex justify-center">
                <Button variant="outline" size="sm" onClick={() => fetchAuditLog(false)} disabled={auditLoading}>
                  {auditLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Muat Lebih Banyak</span>
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Security Toast Notifications */}
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 bg-gray-900 text-white rounded-xl py-3 px-4 shadow-2xl z-[150] flex items-center gap-2 border border-gray-800 text-xs"
          >
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
            <span className="font-medium">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lockdown Screen Interstitial Overlay */}
      <AnimatePresence>
        {lockdownActive && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-red-950/95 backdrop-blur-md z-[1000] flex flex-col items-center justify-center text-center p-4 space-y-4"
          >
            <AlertOctagon className="w-16 h-16 text-red-500 animate-bounce" />
            <h2 className="text-2xl font-black text-red-500 tracking-wider">PROTOKOL DARURAT AKTIF</h2>
            <p className="text-xs text-red-200 max-w-md leading-relaxed">
              Seluruh terminal kasir telah diputus secara paksa. Enkripsi data lokal berjalan. Silakan klik tombol verifikasi di bawah untuk memulihkan keadaan semula.
            </p>
            <Button
              onClick={() => {
                setLockdownActive(false);
                triggerToast("Koneksi kasir dipulihkan. Protokol dinonaktifkan.");
              }}
              className="bg-white text-red-950 hover:bg-red-50 shadow-xl"
            >
              Pulihkan Keadaan Sistem
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
