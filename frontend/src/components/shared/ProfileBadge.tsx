import React, { useEffect, useState } from 'react';
import { Shield, Clock, Coins, Wallet, LogOut } from 'lucide-react';
import { getCurrentSession, getMutationTotals } from '../../lib/cashSession';
import { CurrentUser } from '../../lib/permissions';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

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

const ROLE_LABELS: Record<string, string> = {
  Owner: 'Pemilik Toko',
  Admin: 'Admin',
  Kasir: 'Staf Kasir',
  Stoker: 'Staf Gudang',
};

interface ProfileBadgeProps {
  currentUser: CurrentUser | null;
  storeName?: string;
  /** Timestamp (Date.now()) captured when this session logged in — powers the real "Uptime Sesi" stat. */
  loginAt?: number;
  onLogout?: () => void;
  /** Hides the name/role text next to the avatar circle, showing only the round icon — used on the full-screen POS top bar where space is tight. */
  iconOnly?: boolean;
  className?: string;
}

/**
 * The round avatar shown at the top-right of the app — same control used in
 * the main Header and in the full-screen POS top bar, so clicking it always
 * opens the identical "Sesi & Informasi Akun" modal (session uptime, live
 * kas laci balance, logout) no matter which screen it's opened from.
 */
export default function ProfileBadge({ currentUser, storeName, loginAt, onLogout, iconOnly, className }: ProfileBadgeProps) {
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [uptimeMs, setUptimeMs] = useState(0);
  const [kasLaci, setKasLaci] = useState<number | null>(null);

  const profile = {
    name: currentUser?.name ?? 'Pengguna',
    role: (currentUser?.role && ROLE_LABELS[currentUser.role]) || currentUser?.role || '—',
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

  return (
    <>
      <div
        onClick={() => setShowProfileModal(true)}
        className={`flex items-center gap-2 md:gap-3 cursor-pointer hover:opacity-85 select-none transition-all active:scale-95 ${className ?? ''}`}
        title="Buka Info Sesi"
      >
        <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-white text-[10px] font-extrabold shrink-0 ${colorFor(profile.name)}`}>
          {initialsFor(profile.name)}
        </div>
        {!iconOnly && (
          <div className="hidden md:block text-left">
            <p className="text-xs font-bold text-slate-800 leading-none">{profile.name}</p>
            <p className="text-[9px] text-slate-400 mt-1 uppercase tracking-widest font-bold">{profile.role}</p>
          </div>
        )}
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
    </>
  );
}
