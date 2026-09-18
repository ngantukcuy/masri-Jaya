import React, { useEffect, useMemo, useState } from 'react';
import { MapPin, RotateCw, Bell, Menu, Clock, X, AlertTriangle, PackageX, ShoppingBag, WifiOff, CloudUpload, Search } from 'lucide-react';
import { useOnlineStatus, usePendingSyncCount } from '../../lib/useOnlineStatus';
import InstallAppButton from '../shared/InstallAppButton';
import ProfileBadge from '../shared/ProfileBadge';
import { CurrentUser, canSeeApproverNotifications } from '../../lib/permissions';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';



interface HeaderProductLite {
  sku: string;
  name: string;
  stock: number;
  stockStatus: 'Healthy' | 'Low Stock' | 'Out of Stock';
}

interface HeaderCustomerLite {
  id: string;
  name: string;
  debtStatus: 'Cleared' | 'Overdue' | 'Pending';
  overdueAmount?: number;
}

interface HeaderActivityLite {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  type: 'sale' | 'arrival' | 'overdue' | 'quote';
  audience?: 'all' | 'approvers';
}

interface HeaderNotification {
  id: string;
  text: string;
  level: 'warning' | 'error' | 'success' | 'info';
  targetTab: string;
  /** True = this is a "waiting for approval" notification (owner/admin-only audience). Shown with a distinct badge. */
  pending?: boolean;
}

interface HeaderSearchResult {
  id: string;
  label: string;
  sublabel: string;
  category: string;
  tab: string;
}

interface HeaderProps {
  currentTab: string;
  searchValue?: string;
  onSearch?: (value: string) => void;
  searchResults?: HeaderSearchResult[];
  onSearchResultSelect?: (tab: string) => void;
  searchPlaceholder?: string;
  onTabChange: (tab: string) => void;
  onSync: () => void;
  currentUser: CurrentUser | null;
  onMenuToggle?: () => void;
  onLogout?: () => void;
  storeName?: string;
  /** Timestamp (Date.now()) captured when this session logged in — powers the real "Uptime Sesi" stat. */
  loginAt?: number;
  products?: HeaderProductLite[];
  customers?: HeaderCustomerLite[];
  activities?: HeaderActivityLite[];
}

function formatRupiah(n: number): string {
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`;
}

function activityTargetTab(title: string, subtitle: string): string {
  const text = `${title} ${subtitle}`.toLowerCase();
  if (text.includes('retur')) return 'retur';
  if (text.includes('hapus transaksi') || text.includes('penghapusan transaksi') || text.includes('penjualan pos')) return 'riwayat-transaksi';
  if (text.includes('kas harian') || text.includes('kas masuk') || text.includes('kas keluar')) return 'kas-harian';
  if (text.includes('pembelian') || text.includes('po ') || text.includes('purchase')) return 'purchase';
  if (text.includes('pelanggan') || text.includes('customer')) return 'customer';
  if (text.includes('utang') || text.includes('piutang')) return 'debts';
  if (text.includes('reimbursement') || text.includes('klaim') || text.includes('pembayaran')) return 'finance';
  if (text.includes('stok') || text.includes('opname')) return 'products';
  return 'dashboard';
}

export default function Header({
  currentTab,
  searchValue = '',
  onSearch,
  searchResults = [],
  onSearchResultSelect,
  searchPlaceholder = 'Cari...',
  onTabChange,
  onSync,
  currentUser,
  onMenuToggle,
  onLogout,
  storeName,
  loginAt,
  products = [],
  customers = [],
  activities = [],
}: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const isOnline = useOnlineStatus();
  const pendingSyncCount = usePendingSyncCount();

  
  const handleSyncClick = () => {
    setSyncing(true);
    onSync();
    setTimeout(() => {
      setSyncing(false);
    }, 800);
  };

  // Real notifications, derived from live data instead of a hardcoded list:
  // critical stock, overdue customer debts, and the most recent activity feed entries.
  const notifications = useMemo<HeaderNotification[]>(() => {
    const list: HeaderNotification[] = [];

    // Stock/debt alerts reflect current business state (not an ever-growing
    // log), so there's no need to cap these — a shop rarely has dozens of
    // simultaneously low-stock SKUs or overdue customers at once.
    products
      .filter((p) => p.stockStatus !== 'Healthy')
      .forEach((p) => {
        list.push({
          id: `stock-${p.sku}`,
          targetTab: 'products',
          level: p.stockStatus === 'Out of Stock' ? 'error' : 'warning',
          text: p.stockStatus === 'Out of Stock'
            ? `Stok habis: ${p.name} (${p.sku})`
            : `Stok menipis: ${p.name} — tersisa ${p.stock}`,
        });
      });

    customers
      .filter((c) => c.debtStatus === 'Overdue')
      .forEach((c) => {
        list.push({
          id: `debt-${c.id}`,
          targetTab: 'debts',
          level: 'error',
          text: c.overdueAmount
            ? `Utang jatuh tempo: ${c.name} — ${formatRupiah(c.overdueAmount)}`
            : `Utang jatuh tempo: ${c.name}`,
        });
      });

    // Every recorded activity becomes a notification — CRUD or otherwise —
    // except entries tagged 'approvers' (a retur/PO/opname submission, a
    // reimbursement claim) which only show up for accounts that actually
    // hold an approve permission; everyone else sees it once it's resolved
    // (the approve/reject action logs its own 'all'-audience activity).
    // Capped to the most recent 30 since, unlike stock/debt above, this log
    // grows forever — 30 is generous for a notification dropdown while
    // keeping it from rendering the store's entire history at once.
    const canSeeApprovals = canSeeApproverNotifications(currentUser);
    activities
      .filter((a) => a.audience !== 'approvers' || canSeeApprovals)
      .slice(0, 30)
      .forEach((a) => {
        const isPending = a.audience === 'approvers';
        list.push({
          id: `activity-${a.id}`,
          targetTab: activityTargetTab(a.title, a.subtitle),
          level: isPending ? 'warning' : (a.type === 'overdue' ? 'error' : 'success'),
          text: `${a.title} — ${a.subtitle}`,
          pending: isPending,
        });
      });

    return list;
  }, [products, customers, activities, currentUser]);



  const notifIcon = (notif: HeaderNotification) => {
    if (notif.pending) return <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />;
    switch (notif.level) {
      case 'error': return <PackageX className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />;
      case 'warning': return <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />;
      default: return <ShoppingBag className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />;
    }
  };

  const navTabCls = (active: boolean) =>
    cn(
      'h-auto px-0 pb-1 rounded-none text-xs font-bold uppercase tracking-wider bg-transparent shadow-none border-b-2',
      active ? 'text-primary border-primary hover:bg-transparent' : 'text-slate-500 border-transparent hover:text-primary hover:bg-transparent'
    );

  return (
    <header className="h-16 w-full bg-white/70 backdrop-blur-md border-b border-slate-200/50 sticky top-0 z-40 flex items-center justify-between px-4 md:px-8 shadow-sm">
      {/* Menu Hamburger for mobile */}
      <div className="flex items-center gap-2 md:gap-6 flex-1 mr-4">
        {onMenuToggle && (
          <Button variant="ghost" size="icon" onClick={onMenuToggle} className="md:hidden text-slate-700 mr-1" aria-label="Buka Menu">
            <Menu className="w-5 h-5" />
          </Button>
        )}

        <Button
          onClick={() => onTabChange('pos')}
          size="lg"
          className="w-full sm:w-auto shadow-md shadow-blue-500/15 active:scale-[0.98]"
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Kasir</span>
        </Button>
      </div>

      {/* Right Tools (Branch, Sync, Notify, Profile) */}
      <div className="flex items-center gap-2 md:gap-4 shrink-0">
        {/* Store name (real registered store, not a fixed dummy branch label) */}
        {storeName && (
          <div className="hidden sm:flex flex-col items-end mr-1">
            <span className="text-[9px] text-slate-400 uppercase tracking-widest font-bold flex items-center gap-1">
              <MapPin className="w-3 h-3 text-primary" /> Toko
            </span>
            <span className="text-xs font-extrabold text-primary mt-0.5">{storeName}</span>
          </div>
        )}

        {/* Install App (PWA) — hides itself once installed or unsupported */}
        <InstallAppButton compact />

        {/* Offline / pending-sync indicator — only shows up when relevant */}
        {(!isOnline || pendingSyncCount > 0) && (
          <div
            className={cn(
              'hidden sm:flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold',
              !isOnline ? 'border-red-200 bg-red-50 text-red-600' : 'border-amber-200 bg-amber-50 text-amber-600'
            )}
            title={!isOnline ? 'Tidak ada koneksi internet — transaksi tetap disimpan di perangkat ini' : `${pendingSyncCount} perubahan menunggu disinkronkan ke server`}
          >
            {!isOnline ? <WifiOff className="w-3.5 h-3.5" /> : <CloudUpload className="w-3.5 h-3.5 animate-pulse" />}
            <span>{!isOnline ? 'Offline' : `Sync ${pendingSyncCount}`}</span>
          </div>
        )}

        {/* Sync Button (Moderate Neumorphic Feel) */}
        <Button
          variant="outline"
          size="icon"
          onClick={handleSyncClick}
          className={cn('text-slate-600', syncing && 'bg-slate-100 text-primary')}
          title="Sinkronisasi Data ERP"
        >
          <RotateCw className={`w-4 h-4 ${syncing ? 'animate-spin text-primary' : 'text-slate-500'}`} />
        </Button>

        {/* Notifications Button */}
        <div className="relative">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative text-slate-600 bg-white"
            aria-label="Notifikasi"
          >
            <Bell className="w-4 h-4" />
            {notifications.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
            )}
          </Button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-3 w-72 md:w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-2">
              <div className="px-4 py-2 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <span className="font-extrabold text-xs text-slate-700 uppercase tracking-wider">Notifikasi Terbaru</span>
                {notifications.length > 0 && (
                  <Badge variant="destructive" className="normal-case">{notifications.length} Aktif</Badge>
                )}
              </div>
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-6 text-[10px] text-slate-400 text-center uppercase tracking-wide">Tidak ada notifikasi baru</p>
                ) : (
                  notifications.map((notif) => (
                    <button
                      type="button"
                      key={notif.id}
                      onClick={() => { onTabChange(notif.targetTab); setShowNotifications(false); }}
                      className="w-full text-left p-3 text-xs text-slate-600 hover:bg-slate-50/50 transition-colors flex gap-2 cursor-pointer"
                    >
                      {notifIcon(notif)}
                      <div className="min-w-0 flex-1">
                        <p className="tracking-wide text-[10px] leading-relaxed">{notif.text}</p>
                        {notif.pending && (
                          <Badge variant="warning" className="mt-1 normal-case">Menunggu Persetujuan</Badge>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Avatar — shared control, also used on the POS full-screen top bar */}
        <ProfileBadge
          currentUser={currentUser}
          storeName={storeName}
          loginAt={loginAt}
          onLogout={onLogout}
          className="pl-2 md:pl-4 border-l border-slate-200"
        />
      </div>
    </header>
  );
}
