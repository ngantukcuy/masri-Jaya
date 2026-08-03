import React, { useEffect, useMemo, useState } from 'react';
import { Search, MapPin, RotateCw, Bell, Menu, LogOut, Clock, Coins, Shield, X, AlertTriangle, PackageX, ShoppingBag, Wallet, Sun, Moon } from 'lucide-react';
import { getCurrentSession, getMutationTotals } from '../../lib/cashSession';
import { useTheme } from '../../lib/ThemeContext';
import InstallAppButton from '../shared/InstallAppButton';
import { CurrentUser, canSeeApproverNotifications } from '../../lib/permissions';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { cn } from '../../lib/utils';

interface SearchResultItem {
  id: string;
  label: string;
  sublabel: string;
  category: string;
  tab: string;
}

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
  /** True = this is a "waiting for approval" notification (owner/admin-only audience). Shown with a distinct badge. */
  pending?: boolean;
}

interface HeaderProps {
  currentTab: string;
  searchValue?: string;
  onSearch: (query: string) => void;
  searchResults?: SearchResultItem[];
  onSearchResultSelect?: (tab: string) => void;
  onTabChange: (tab: string) => void;
  searchPlaceholder?: string;
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

/** Deterministic initials + background color from a name — no stock photo, no real avatar upload feature (yet) to pull from. */
function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-blue-600', 'bg-emerald-600', 'bg-violet-600', 'bg-amber-600', 'bg-rose-600', 'bg-cyan-600',
];

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function formatUptime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatRupiah(n: number): string {
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`;
}

export default function Header({
  currentTab,
  searchValue,
  onSearch,
  searchResults = [],
  onSearchResultSelect,
  onTabChange,
  searchPlaceholder,
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
  const { theme, toggleTheme } = useTheme();
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [uptimeMs, setUptimeMs] = useState(0);
  const [kasLaci, setKasLaci] = useState<number | null>(null);

  const roleLabels: Record<string, string> = {
    Owner: 'Pemilik Toko',
    Admin: 'Admin',
    Kasir: 'Staf Kasir',
    Stoker: 'Staf Gudang',
  };
  const profile = {
    name: currentUser?.name ?? 'Pengguna',
    role: (currentUser?.role && roleLabels[currentUser.role]) || currentUser?.role || '—',
  };

  // Live-ticking session uptime, only while it's actually visible.
  useEffect(() => {
    if (!loginAt) return;
    const tick = () => setUptimeMs(Date.now() - loginAt);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [loginAt]);

  // Real cash-drawer balance from the currently open kas harian session, refreshed each time the modal opens.
  useEffect(() => {
    if (!showProfileModal) return;
    const session = getCurrentSession();
    setKasLaci(session ? getMutationTotals(session).systemTotal : null);
  }, [showProfileModal]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearch(e.target.value);
  };

  const handleResultClick = (tab: string) => {
    setIsSearchFocused(false);
    onSearchResultSelect?.(tab);
  };

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
          level: isPending ? 'warning' : (a.type === 'overdue' ? 'error' : 'success'),
          text: `${a.title} — ${a.subtitle}`,
          pending: isPending,
        });
      });

    return list;
  }, [products, customers, activities, currentUser]);

  const defaultPlaceholder = "Cari pesanan, stok bahan, atau pemasok...";
  const actualPlaceholder = searchPlaceholder || defaultPlaceholder;

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
      {/* Menu Hamburger for mobile & Search Input */}
      <div className="flex items-center gap-2 md:gap-6 flex-1 mr-4">
        {onMenuToggle && (
          <Button variant="ghost" size="icon" onClick={onMenuToggle} className="md:hidden text-slate-700 mr-1" aria-label="Buka Menu">
            <Menu className="w-5 h-5" />
          </Button>
        )}

        <div className="relative w-full max-w-xs md:max-w-md group">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors z-10" />
          <Input
            type="text"
            value={searchValue || ''}
            onChange={handleSearchChange}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 150)}
            placeholder={actualPlaceholder}
            className="glass-input rounded-xl pl-11 pr-4 py-2 h-9 text-xs text-slate-900 placeholder-slate-400 border-none"
          />

          {isSearchFocused && searchValue && (
            <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1.5 max-h-80 overflow-y-auto">
              {searchResults.length === 0 ? (
                <p className="px-4 py-3 text-[11px] text-slate-400">Tidak ada hasil untuk "{searchValue}"</p>
              ) : (
                searchResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onMouseDown={() => handleResultClick(result.tab)}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{result.label}</p>
                      <p className="text-[10px] text-slate-400 truncate">{result.sublabel}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 bg-primary/10 text-primary normal-case">{result.category}</Badge>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <nav className="hidden lg:flex items-center gap-6 ml-4">
          <Button variant="ghost" onClick={() => onTabChange('pos')} className={navTabCls(currentTab === 'pos')}>
            KASIR POS
          </Button>
          <Button variant="ghost" onClick={() => onTabChange('products')} className={navTabCls(currentTab === 'products')}>
            INVENTORI
          </Button>
          <Button variant="ghost" onClick={() => onTabChange('reports')} className={navTabCls(currentTab === 'reports')}>
            LAPORAN
          </Button>
        </nav>
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

        {/* Dark / Light Theme Toggle */}
        <Button
          variant="outline"
          size="icon"
          onClick={toggleTheme}
          className="text-slate-600 bg-white"
          title={theme === 'dark' ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
          aria-label="Ganti Tema"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        {/* Install App (PWA) — hides itself once installed or unsupported */}
        <InstallAppButton compact />

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
                    <div key={notif.id} className="p-3 text-xs text-slate-600 hover:bg-slate-50/50 transition-colors flex gap-2">
                      {notifIcon(notif)}
                      <div className="min-w-0 flex-1">
                        <p className="tracking-wide text-[10px] leading-relaxed">{notif.text}</p>
                        {notif.pending && (
                          <Badge variant="warning" className="mt-1 normal-case">Menunggu Persetujuan</Badge>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Avatar */}
        <div 
          onClick={() => setShowProfileModal(true)}
          className="flex items-center gap-2 md:gap-3 pl-2 md:pl-4 border-l border-slate-200 cursor-pointer hover:opacity-85 select-none transition-all active:scale-95"
          title="Buka Info Sesi"
        >
          <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-white text-[10px] font-extrabold ${colorFor(profile.name)}`}>
            {initialsFor(profile.name)}
          </div>
          <div className="hidden md:block text-left">
            <p className="text-xs font-bold text-slate-800 leading-none">{profile.name}</p>
            <p className="text-[9px] text-slate-400 mt-1 uppercase tracking-widest font-bold">{profile.role}</p>
          </div>
        </div>
      </div>

      {/* USER PROFILE MODAL */}
      <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm text-foreground normal-case tracking-normal">
              <Shield className="w-5 h-5 animate-pulse" /> Sesi &amp; Informasi Akun
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Profile Detail Card */}
            <div className="flex items-center gap-4 p-3 bg-muted border border-border rounded-xl">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-base font-extrabold border-2 border-white shadow-sm ${colorFor(profile.name)}`}>
                {initialsFor(profile.name)}
              </div>
              <div className="text-left">
                <h4 className="font-bold text-foreground text-sm">{profile.name}</h4>
                <p className="text-[10px] text-muted-foreground font-semibold">{profile.role}</p>
                {storeName && <p className="text-[10px] text-muted-foreground">{storeName}</p>}
                <Badge variant="success" className="mt-1 normal-case">Status: Online</Badge>
              </div>
            </div>

            {/* System Info & Stats */}
            <div className="space-y-2 border-t border-border pt-3">
              <h5 className="font-bold text-[10px] text-muted-foreground uppercase tracking-wider text-left">Metrik Operasional Sesi</h5>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="p-2 border border-border rounded-lg flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <div className="text-left">
                    <span className="text-[8px] text-muted-foreground block uppercase">Uptime Sesi</span>
                    <span className="font-bold text-foreground/80">{loginAt ? formatUptime(uptimeMs) : '—'}</span>
                  </div>
                </div>
                <div className="p-2 border border-border rounded-lg flex items-center gap-2">
                  {kasLaci === null ? <Wallet className="w-4 h-4 text-muted-foreground" /> : <Coins className="w-4 h-4 text-emerald-600" />}
                  <div className="text-left">
                    <span className="text-[8px] text-muted-foreground block uppercase">Kas Laci</span>
                    <span className="font-bold text-foreground/80">{kasLaci === null ? 'Sesi belum dibuka' : formatRupiah(kasLaci)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-2 border-t border-border">
              <Button variant="outline" className="flex-1 uppercase" onClick={() => setShowProfileModal(false)}>
                Tutup
              </Button>
              {onLogout && (
                <Button
                  variant="destructive"
                  className="flex-1 uppercase bg-red-50 hover:bg-red-600 hover:text-white text-red-600 shadow-sm"
                  onClick={() => {
                    onLogout();
                    setShowProfileModal(false);
                  }}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
