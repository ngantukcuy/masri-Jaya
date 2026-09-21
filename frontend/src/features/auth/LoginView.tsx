import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building, 
  User, 
  Mail, 
  KeyRound, 
  ChevronRight, 
  Delete, 
  X, 
  Store,
  Users,
  ShieldAlert
} from 'lucide-react';
import { useSupabaseState } from '../../lib/useSupabaseState';
import { useSupabaseTable } from '../../lib/useSupabaseTable';
import { useDialog } from '../../components/shared/DialogProvider';
import { StaffMember } from '../../types';
import { ROLE_DEFAULT_PERMISSIONS, CurrentUser } from '../../lib/permissions';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

interface LoginViewProps {
  onLoginSuccess: (user: CurrentUser) => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const dialog = useDialog();
  const [registeredOwner, setRegisteredOwner, ownerReady] = useSupabaseState<{ storeName: string; ownerName: string; email: string; pin: string } | null>('store_owner', null);
  const [staffList, setStaffList, staffListReady] = useSupabaseTable<StaffMember>('staff_list', [], (s) => s.id);

  const [isRegistered, setIsRegistered] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [ownerPin, setOwnerPin] = useState('');
  
  // Login states
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // Brute-force throttle: after MAX_ATTEMPTS wrong PINs in a row for a given
  // staff account, lock that account out for LOCKOUT_MS. Persisted to
  // localStorage (keyed per staff id) so it survives switching accounts,
  // reloading the page, or trying again after closing the tab — a 6-digit
  // PIN is otherwise trivially brute-forceable by someone with physical
  // access to the device.
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MS = 60_000;
  const lockoutKey = (staffId: string) => `tokku_pin_lockout_${staffId}`;
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const readLockout = (staffId: string): { attempts: number; lockedUntil: number | null } => {
    try {
      const raw = localStorage.getItem(lockoutKey(staffId));
      if (!raw) return { attempts: 0, lockedUntil: null };
      const parsed = JSON.parse(raw);
      return { attempts: parsed.attempts || 0, lockedUntil: parsed.lockedUntil || null };
    } catch {
      return { attempts: 0, lockedUntil: null };
    }
  };

  const writeLockout = (staffId: string, attempts: number, until: number | null) => {
    try {
      if (attempts === 0 && !until) {
        localStorage.removeItem(lockoutKey(staffId));
      } else {
        localStorage.setItem(lockoutKey(staffId), JSON.stringify({ attempts, lockedUntil: until }));
      }
    } catch {
      // Ignore storage failures — worst case the throttle just doesn't persist.
    }
  };

  // Live countdown while locked out
  useEffect(() => {
    if (!lockedUntil) return;
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  const secondsLeft = lockedUntil ? Math.max(0, Math.ceil((lockedUntil - nowTick) / 1000)) : 0;
  const isLockedOut = !!lockedUntil && secondsLeft > 0;

  // Lockout naturally expires once its countdown hits zero
  useEffect(() => {
    if (lockedUntil && secondsLeft === 0 && selectedStaff) {
      setLockedUntil(null);
      writeLockout(selectedStaff.id || selectedStaff.name, 0, null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  // ---- Reset Registrasi Toko: dilindungi PIN Owner ----
  // Tombol reset terlihat di halaman awal (sebelum login), jadi siapa pun yang
  // memegang perangkat bisa menekannya. Karena itu reset hanya jalan setelah
  // PIN Owner yang benar dimasukkan. Percobaan salah dibatasi seperti login
  // (MAX_ATTEMPTS kali, lalu terkunci LOCKOUT_MS) dan disimpan di localStorage.
  const RESET_LOCK_KEY = '__reset_registration__';
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPinInput, setResetPinInput] = useState('');
  const [resetPinError, setResetPinError] = useState(false);
  const [resetLockedUntil, setResetLockedUntil] = useState<number | null>(null);
  const resetSecondsLeft = resetLockedUntil ? Math.max(0, Math.ceil((resetLockedUntil - nowTick) / 1000)) : 0;
  const isResetLocked = !!resetLockedUntil && resetSecondsLeft > 0;

  useEffect(() => {
    if (!resetLockedUntil) return;
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [resetLockedUntil]);

  useEffect(() => {
    if (resetLockedUntil && resetSecondsLeft === 0) {
      setResetLockedUntil(null);
      writeLockout(RESET_LOCK_KEY, 0, null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSecondsLeft]);

  const openResetModal = () => {
    const { lockedUntil: storedUntil } = readLockout(RESET_LOCK_KEY);
    setResetLockedUntil(storedUntil && storedUntil > Date.now() ? storedUntil : null);
    setNowTick(Date.now());
    setResetPinInput('');
    setResetPinError(false);
    setShowResetModal(true);
  };

  const closeResetModal = () => {
    setShowResetModal(false);
    setResetPinInput('');
    setResetPinError(false);
  };

  const handleVerifyResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isResetLocked || resetPinInput.length !== 6) return;

    // PIN Owner tersimpan di store_owner dan di akun Owner pada daftar staf
    const ownerPins = [
      registeredOwner?.pin,
      ...staffList.filter((s) => s.role === 'Owner').map((s) => s.pin),
    ].filter(Boolean);

    if (!ownerPins.includes(resetPinInput)) {
      const { attempts } = readLockout(RESET_LOCK_KEY);
      const nextAttempts = attempts + 1;
      if (nextAttempts >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_MS;
        writeLockout(RESET_LOCK_KEY, nextAttempts, until);
        setResetLockedUntil(until);
        setNowTick(Date.now());
      } else {
        writeLockout(RESET_LOCK_KEY, nextAttempts, null);
      }
      setResetPinError(true);
      setResetPinInput('');
      if (navigator.vibrate) navigator.vibrate(100);
      return;
    }

    writeLockout(RESET_LOCK_KEY, 0, null);
    closeResetModal();
    const conf = await dialog.confirm(
      "Apakah Anda yakin ingin mereset data registrasi toko? Ini akan menghapus semua kredensial (Owner dan seluruh akun staf).",
      { title: 'Reset Registrasi Toko', confirmLabel: 'Ya, Reset', danger: true }
    );
    if (conf) {
      setRegisteredOwner(null);
      setStaffList([]);
      setIsRegistered(false);
      setStoreName('');
      setOwnerName('');
      setEmail('');
      setOwnerPin('');
    }
  };

  // React to the registered-owner / staff-list Supabase rows as they load or change
  useEffect(() => {
    if (registeredOwner) {
      setIsRegistered(true);
      setStoreName(registeredOwner.storeName);
      setOwnerName(registeredOwner.ownerName);

      // IMPORTANT: only decide "no staff yet" once BOTH the owner row and
      // the staff_list table have actually finished their initial fetch.
      // Right after this component (re)mounts — which happens every time
      // a user logs out and lands back here — staffList starts out as []
      // purely because its Supabase query hasn't resolved yet, not
      // because the store genuinely has no staff. store_owner is a
      // single-row fetch and almost always resolves first, so checking
      // staffList.length === 0 alone used to fire this "first-time seed"
      // path on nearly every logout, overwriting the real staff list with
      // just the owner. Waiting for staffListReady fixes that.
      if (staffListReady && ownerReady && staffList.length === 0) {
        // Genuinely registered but no staff yet — seed owner as first staff
        const initialList: StaffMember[] = [
          { id: 'owner-01', name: registeredOwner.ownerName + ' (Owner)', pin: registeredOwner.pin, role: 'Owner', permissions: ROLE_DEFAULT_PERMISSIONS.Owner }
        ];
        setStaffList(initialList);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registeredOwner, staffListReady, ownerReady]);

  // Handle first-time registration
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName || !ownerName || !email || ownerPin.length !== 6) {
      dialog.alert("Harap isi semua kolom dengan benar. PIN harus 6 digit angka.");
      return;
    }

    const ownerData = {
      storeName,
      ownerName,
      email,
      pin: ownerPin
    };

    const initialList: StaffMember[] = [
      {
        id: 'owner-01',
        name: ownerName + ' (Owner)',
        pin: ownerPin,
        role: 'Owner',
        permissions: ROLE_DEFAULT_PERMISSIONS.Owner,
      }
    ];

    setRegisteredOwner(ownerData);
    setStaffList(initialList);
    
    setIsRegistered(true);
    dialog.alert("Registrasi Toko Berhasil! Silakan pilih akun dan masukkan PIN Anda.");
  };

  // PIN keyboard digit handler
  const handlePinDigit = (digit: string) => {
    if (isLockedOut) return;
    if (pinInput.length < 6) {
      const nextPin = pinInput + digit;
      setPinInput(nextPin);
      setPinError(false);

      if (nextPin.length === 6 && selectedStaff) {
        if (nextPin === selectedStaff.pin) {
          // Success login — reset this account's throttle, and carry the
          // staff's saved permissions (or the role's default set, for
          // older records saved before per-staff permissions existed) so
          // the rest of the app can gate menus and actions accordingly.
          writeLockout(selectedStaff.id || selectedStaff.name, 0, null);
          const role = selectedStaff.role;
          const permissions = selectedStaff.permissions && selectedStaff.permissions.length > 0
            ? selectedStaff.permissions
            : (ROLE_DEFAULT_PERMISSIONS[role] || []);
          onLoginSuccess({ name: selectedStaff.name, role, permissions });
        } else {
          // Wrong PIN — count the attempt and lock the account out once
          // MAX_ATTEMPTS is hit.
          const { attempts } = readLockout(selectedStaff.id || selectedStaff.name);
          const nextAttempts = attempts + 1;
          if (nextAttempts >= MAX_ATTEMPTS) {
            const until = Date.now() + LOCKOUT_MS;
            writeLockout(selectedStaff.id || selectedStaff.name, nextAttempts, until);
            setLockedUntil(until);
            setNowTick(Date.now());
          } else {
            writeLockout(selectedStaff.id || selectedStaff.name, nextAttempts, null);
          }
          setPinError(true);
          setPinInput('');
          // Play a small rumble vibration
          if (navigator.vibrate) navigator.vibrate(100);
        }
      }
    }
  };

  const handleBackspace = () => {
    setPinInput(pinInput.slice(0, -1));
    setPinError(false);
  };

  // Allow entering the PIN using a physical keyboard (number row + numpad),
  // not just tapping the on-screen keypad. Only active once a staff account
  // has been picked, mirroring the on-screen keypad's own availability.
  useEffect(() => {
    if (!selectedStaff) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handlePinDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setPinInput('');
        setPinError(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStaff, pinInput]);


  return (
    <main className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 font-sans select-none">
      
      {/* Animated container */}
      <AnimatePresence mode="wait">
        {!isRegistered ? (
          /* Form Pendaftaran Pemilik Toko (First time flow) */
          <motion.div
            key="register"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl p-8 space-y-6"
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-3">
                <Store className="w-8 h-8" />
              </div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight uppercase">REGISTRASI AKUN OWNER </h1>
              <p className="text-xs text-gray-600 mt-1 uppercase tracking-wider">Langkah awal setup kasir pos</p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4 text-xs">
              <div>
                <Label>Nama Toko / Bisnis</Label>
                <div className="relative">
                  <Building className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                  <Input
                    type="text"
                    required
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Contoh: TB Sinar Maju"
                    className="pl-10 h-11"
                  />
                </div>
              </div>

              <div>
                <Label>Nama Pemilik (Owner)</Label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                  <Input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Nama Lengkap Anda"
                    className="pl-10 h-11"
                  />
                </div>
              </div>

              <div>
                <Label>Email Pemilik</Label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="owner@sinarmaju.com"
                    className="pl-10 h-11"
                  />
                </div>
              </div>

              <div>
                <Label>PIN Keamanan (6 Digit)</Label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
                  <Input
                    type="password"
                    maxLength={6}
                    required
                    value={ownerPin}
                    onChange={(e) => setOwnerPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Masukkan 6 angka rahasia"
                    className="pl-10 h-11 font-mono text-center text-lg tracking-widest"
                  />
                </div>
              </div>

              <div className="pt-4">
                <Button type="submit" size="lg" className="w-full">
                  <span>Daftarkan &amp; Mulai ERP</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </form>
          </motion.div>
        ) : (
          /* Profile & PIN Authentication Flow */
          <motion.div
            key="login"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl p-8 space-y-6"
          >
            <div className="text-center">
              <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-black uppercase tracking-wider">
                {storeName}
              </span>
              <h1 className="text-xl font-black text-gray-900 tracking-tight uppercase mt-3">MASUK KE SISTEM</h1>
              <p className="text-xs text-gray-600 mt-1 uppercase tracking-wider">Silakan pilih akun staff Anda</p>
            </div>

            <AnimatePresence mode="wait">
              {!selectedStaff ? (
                /* Selection list of staff accounts */
                <motion.div
                  key="staff-selection"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-3"
                >
                  <span className="block text-[10px] font-bold text-gray-600 uppercase tracking-widest">Daftar Anggota Staff</span>
                  <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto pr-1">
                    {staffList.map((staff) => (
                      <button
                        key={staff.id}
                        onClick={() => {
                          setSelectedStaff(staff);
                          setPinInput('');
                          setPinError(false);
                          const { lockedUntil: storedUntil } = readLockout(staff.id || staff.name);
                          const stillLocked = storedUntil && storedUntil > Date.now();
                          setLockedUntil(stillLocked ? storedUntil : null);
                          setNowTick(Date.now());
                        }}
                        className="w-full flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-white hover:border-blue-600 hover:bg-blue-50/30 text-left group cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-gray-600">
                            {staff.role === 'Owner' ? <Store className="w-5 h-5 text-blue-600" /> : <Users className="w-5 h-5 text-gray-600" />}
                          </div>
                          <div>
                            <p className="font-extrabold text-sm text-gray-800 group-hover:text-blue-600 transition-colors">{staff.name}</p>
                            <p className="text-[10px] text-gray-600 uppercase tracking-wider mt-0.5">{staff.role === 'Owner' ? 'Pemilik Toko' : 'Kasir / Staf Toko'}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-blue-600 transition-transform group-hover:translate-x-1" />
                      </button>
                    ))}
                  </div>

                  {/* Reset store data option */}
                  <div className="pt-6 border-t border-gray-200 text-center">
                    <Button
                      variant="link"
                      onClick={openResetModal}
                      className="h-auto p-0 text-[9px] text-red-700 uppercase tracking-widest"
                    >
                      Reset Registrasi Toko
                    </Button>
                  </div>
                </motion.div>
              ) : (
                /* Interactive numerical PIN keyboard */
                <motion.div
                  key="pin-keypad"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <div className="flex justify-between items-center bg-gray-100/40 p-2.5 rounded-xl border border-gray-200/50">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600">
                        {selectedStaff.role === 'Owner' ? 'O' : 'S'}
                      </div>
                      <span className="font-bold text-xs text-gray-800 uppercase tracking-wide">{selectedStaff.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedStaff(null)}
                      className="h-auto p-0 text-[10px] text-gray-600 hover:text-gray-900 uppercase tracking-wider"
                    >
                      <X className="w-3.5 h-3.5" /> Ganti Akun
                    </Button>
                  </div>

                  {/* PIN Display Indicators */}
                  <div className="text-center space-y-2">
                    <span className="block text-[10px] font-bold text-gray-600 uppercase tracking-widest">Masukkan 6-Digit PIN</span>
                    <span className="block text-[9px] text-gray-400 font-medium normal-case">Bisa ketik langsung dari keyboard</span>
                    <div className="flex justify-center gap-3 py-4">
                      {[0, 1, 2, 3, 4, 5].map((index) => (
                        <div
                          key={index}
                          className={`w-4 h-4 rounded-full transition-all duration-150 ${
                            pinInput.length > index
                              ? 'bg-blue-600 scale-110 shadow-md shadow-blue-400'
                              : 'bg-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                    
                    {pinError && !isLockedOut && (
                      <motion.div 
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-[10px] font-extrabold text-red-700 uppercase tracking-wider flex items-center justify-center gap-1.5"
                      >
                        <ShieldAlert className="w-4 h-4" /> PIN Salah! Silakan coba lagi.
                      </motion.div>
                    )}

                    {isLockedOut && (
                      <motion.div 
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-[10px] font-extrabold text-red-700 uppercase tracking-wider flex items-center justify-center gap-1.5"
                      >
                        <ShieldAlert className="w-4 h-4" /> Terlalu banyak percobaan. Coba lagi dalam {secondsLeft} detik.
                      </motion.div>
                    )}
                  </div>

                  {/* Keypad Grid */}
                  <div className={`grid grid-cols-3 gap-4 max-w-[280px] mx-auto ${isLockedOut ? 'opacity-40 pointer-events-none' : ''}`}>
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                      <Button
                        key={digit}
                        type="button"
                        variant="secondary"
                        onClick={() => handlePinDigit(digit)}
                        className="w-16 h-16 rounded-full font-extrabold text-lg text-gray-800"
                      >
                        {digit}
                      </Button>
                    ))}

                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setPinInput('')}
                      className="w-16 h-16 rounded-full font-bold text-xs text-gray-600"
                    >
                      C
                    </Button>

                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handlePinDigit('0')}
                      className="w-16 h-16 rounded-full font-extrabold text-lg text-gray-800"
                    >
                      0
                    </Button>

                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleBackspace}
                      className="w-16 h-16 rounded-full text-gray-600"
                    >
                      <Delete className="w-5 h-5" />
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Verifikasi PIN Owner sebelum reset registrasi */}
      {showResetModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm px-4">
          <form
            onSubmit={handleVerifyResetPin}
            className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4 select-text"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide">Khusus Owner</h2>
                <p className="text-xs text-gray-600 mt-0.5">Masukkan PIN Owner untuk melanjutkan reset registrasi toko.</p>
              </div>
            </div>

            <Input
              type="password"
              inputMode="numeric"
              autoFocus
              maxLength={6}
              value={resetPinInput}
              disabled={isResetLocked}
              onChange={(e) => {
                setResetPinInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                setResetPinError(false);
              }}
              placeholder="PIN Owner 6 digit"
              className="h-11 font-mono text-center text-lg tracking-widest"
            />

            {resetPinError && !isResetLocked && (
              <p className="text-[10px] font-extrabold text-red-700 uppercase tracking-wider text-center">PIN salah. Reset dibatalkan.</p>
            )}
            {isResetLocked && (
              <p className="text-[10px] font-extrabold text-red-700 uppercase tracking-wider text-center">Terlalu banyak percobaan. Coba lagi dalam {resetSecondsLeft} detik.</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={closeResetModal}>Batal</Button>
              <Button type="submit" size="sm" disabled={isResetLocked || resetPinInput.length !== 6} className="bg-red-600 hover:bg-red-700">Lanjutkan</Button>
            </div>
          </form>
        </div>
      )}

      <p className="text-[10px] text-gray-600 mt-8 font-mono text-center uppercase tracking-[0.2em]">
        MASRI JAYA • SECURE ACCESS CONTROL • v{__APP_VERSION__}
      </p>
    </main>
  );
}
