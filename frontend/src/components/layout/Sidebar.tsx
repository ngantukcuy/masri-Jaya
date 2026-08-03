import React, { useState } from 'react';
import {
  LayoutDashboard,
  Calculator,
  PlusCircle,
  ShoppingCart,
  Boxes,
  FileBarChart2,
  Users,
  Settings,
  LogOut,
  HelpCircle,
  CreditCard,
  X,
  Receipt,
  Wallet,
  CornerUpLeft,
  Store,
  Tags,
  History,
  ChevronDown,
  PackageSearch,
  Award,
  Ruler,
  Truck,
  UserCircle2
} from 'lucide-react';
import { useDialog } from '../shared/DialogProvider';
import { CurrentUser, canAccessTab } from '../../lib/permissions';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface NavChild {
  id: string;
  label: string;
  icon: any;
}

interface NavItem {
  id: string;
  label: string;
  icon: any;
  children?: NavChild[];
}

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onNewTransaction: () => void;
  onLogout: () => void;
  currentUser?: CurrentUser;
  isMobile?: boolean;
  onClose?: () => void;
}

export default function Sidebar({
  currentTab,
  onTabChange,
  onNewTransaction,
  onLogout,
  currentUser,
  isMobile = false,
  onClose
}: SidebarProps) {
  const dialog = useDialog();
  // Urutan menu sesuai PRD:
  // Dashboard, Kas Harian, Pos Kasir, Riwayat Transaksi, Stok,
  // Products (Sku Master, Kategori, Brand, Unit), Relasi (Pelanggan, Pemasok),
  // Deposit, Utang & Piutang, Pembayaran
  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
    { id: 'kas-harian', label: 'KAS HARIAN', icon: Wallet },
    { id: 'pos', label: 'POS KASIR', icon: Calculator },
    { id: 'riwayat-transaksi', label: 'RIWAYAT TRANSAKSI', icon: History },
    { id: 'products', label: 'STOK', icon: Boxes },
    {
      id: 'master-data',
      label: 'PRODUCTS',
      icon: Tags,
      children: [
        { id: 'master-data:sku-master', label: 'Sku Master', icon: PackageSearch },
        { id: 'master-data:kategori', label: 'Kategori', icon: Tags },
        { id: 'master-data:brand', label: 'Brand', icon: Award },
        { id: 'master-data:unit', label: 'Unit', icon: Ruler },
      ]
    },
    {
      id: 'relasi',
      label: 'RELASI',
      icon: Users,
      children: [
        { id: 'customer', label: 'Pelanggan', icon: UserCircle2 },
        { id: 'pemasok', label: 'Pemasok', icon: Truck },
      ]
    },
    { id: 'deposit', label: 'DEPOSIT', icon: Wallet },
    { id: 'debts', label: 'UTANG & PIUTANG', icon: Receipt },
    { id: 'finance', label: 'PEMBAYARAN', icon: CreditCard },
  ];

  // Fitur tambahan (di luar daftar utama PRD) tetap disediakan agar tidak hilang
  const extraItems: NavItem[] = [
    { id: 'purchase', label: 'PESANAN BARANG', icon: ShoppingCart },
    { id: 'retur', label: 'RETUR', icon: CornerUpLeft },
    { id: 'toko-digital', label: 'TOKO DIGITAL', icon: Store },
    { id: 'reports', label: 'LAPORAN', icon: FileBarChart2 },
  ];

  // Only show tabs/groups the logged-in staff account actually has access
  // to (see src/lib/permissions.ts). A group (e.g. "Relasi") is shown only
  // if at least one of its children is accessible; the group's own child
  // list is filtered down to just the accessible ones.
  const visibleNavItems = navItems
    .map((item) => {
      if (item.children) {
        const children = item.children.filter((c) => canAccessTab(currentUser, c.id));
        if (children.length === 0 && !canAccessTab(currentUser, item.id)) return null;
        return { ...item, children };
      }
      return canAccessTab(currentUser, item.id) ? item : null;
    })
    .filter((item): item is NavItem => item !== null);

  const visibleExtraItems = extraItems.filter((item) => canAccessTab(currentUser, item.id));
  const canOpenSettings = canAccessTab(currentUser, 'settings');
  const canStartNewTransaction = canAccessTab(currentUser, 'pos');

  const baseTab = currentTab.split(':')[0];

  const [openGroups, setOpenGroups] = useState<string[]>(() => {
    const initiallyOpen: string[] = [];
    [...visibleNavItems].forEach((item) => {
      if (item.children && (item.id === baseTab || item.children.some(c => c.id === currentTab || c.id.split(':')[0] === baseTab))) {
        initiallyOpen.push(item.id);
      }
    });
    return initiallyOpen;
  });

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
  };

  const isGroupActive = (item: NavItem) => {
    if (!item.children) return false;
    return item.id === baseTab || item.children.some(c => c.id === currentTab);
  };

  const navButtonCls = (isActive: boolean, isChild = false) =>
    cn(
      'w-full justify-start gap-3 h-auto px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl',
      isChild && 'pl-9 py-2',
      isActive
        ? 'neu-pill-active text-primary border border-slate-200/60 hover:bg-transparent'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50 bg-transparent shadow-none'
    );

  const renderNavButton = (item: NavItem | NavChild, isActive: boolean, isChild = false) => {
    const Icon = item.icon;
    return (
      <Button
        key={item.id}
        variant="ghost"
        onClick={() => onTabChange(item.id)}
        className={navButtonCls(isActive, isChild)}
      >
        <Icon className={`${isChild ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${isActive ? 'text-primary' : 'text-slate-400'}`} />
        <span>{item.label}</span>
      </Button>
    );
  };

  return (
    <aside
      className={`h-screen flex flex-col py-6 px-4 shrink-0 z-50 ${
        isMobile
          ? 'w-full bg-white/95 border-r border-slate-200 shadow-2xl'
          : 'w-64 sticky left-0 top-0 bg-white/70 backdrop-blur-xl border-r border-slate-200/50 shadow-sm'
      }`}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between mb-8 px-2 border-b border-slate-100 pb-5">
        <div className="flex flex-col">
          <div className="text-2xl font-black tracking-tighter italic uppercase text-slate-900 flex items-center gap-1.5">
            <span>Masri</span>
            <span className="text-primary">/ jaya</span>
          </div>
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.3em] mt-1.5">SISTEM ERP MATERIAL / v{__APP_VERSION__}</p>
        </div>
        {isMobile && onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-500">
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* New Transaction CTA Button (Tasteful Neumorphic Button in Moderation) */}
      {canStartNewTransaction && (
        <Button
          onClick={onNewTransaction}
          className="mb-6 w-full h-auto neu-btn text-primary py-3 px-4 font-extrabold uppercase tracking-widest text-xs rounded-xl bg-transparent shadow-none hover:bg-transparent"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Transaksi Baru</span>
        </Button>
      )}

      {/* Nav Menu */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1">
        <span className="block text-[10px] font-bold text-slate-400 mb-3 px-3 uppercase tracking-[0.2em]">MENU UTAMA</span>
        {visibleNavItems.map((item) => {
          if (!item.children) {
            const isActive = currentTab === item.id;
            return renderNavButton(item, isActive);
          }

          const groupActive = isGroupActive(item);
          const isOpen = openGroups.includes(item.id) || groupActive;
          const Icon = item.icon;

          return (
            <div key={item.id}>
              <Button
                variant="ghost"
                onClick={() => toggleGroup(item.id)}
                className={cn(
                  'w-full justify-between gap-2 h-auto px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl',
                  groupActive
                    ? 'neu-pill-active text-primary border border-slate-200/60 hover:bg-transparent'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50 bg-transparent shadow-none'
                )}
              >
                <span className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${groupActive ? 'text-primary' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </span>
                <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''} ${groupActive ? 'text-primary' : 'text-slate-400'}`} />
              </Button>
              {isOpen && (
                <div className="mt-1 space-y-1">
                  {item.children.map((child) => renderNavButton(child, currentTab === child.id, true))}
                </div>
              )}
            </div>
          );
        })}

        <span className="block text-[10px] font-bold text-slate-400 mb-1.5 mt-4 px-3 uppercase tracking-[0.2em]">LAINNYA</span>
        {visibleExtraItems.map((item) => renderNavButton(item, currentTab === item.id))}
      </nav>

      {/* Bottom Actions */}
      <div className="mt-auto pt-5 border-t border-slate-100 space-y-1.5">
        {canOpenSettings && renderNavButton({ id: 'settings', label: 'Pengaturan', icon: Settings }, currentTab === 'settings')}
        <Button
          variant="ghost"
          onClick={() => dialog.alert("Pusat bantuan siap melayani! Hubungi dukungan Masri Jaya.")}
          className="w-full justify-start gap-3 h-auto px-3.5 py-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100/50 bg-transparent shadow-none rounded-xl text-xs font-bold uppercase tracking-wider"
        >
          <HelpCircle className="w-4 h-4 text-slate-400" />
          <span>Bantuan</span>
        </Button>
        <Button
          variant="ghost"
          onClick={async () => {
            const confirmed = await dialog.confirm("Apakah Anda yakin ingin keluar dari akun?");
            if (confirmed) {
              onLogout();
            }
          }}
          className="w-full justify-start gap-3 h-auto px-3.5 py-2.5 text-red-600 hover:bg-red-50 hover:text-red-700 bg-transparent shadow-none rounded-xl text-xs font-bold uppercase tracking-wider"
        >
          <LogOut className="w-4 h-4 text-red-500" />
          <span>Keluar</span>
        </Button>
      </div>
    </aside>
  );
}
