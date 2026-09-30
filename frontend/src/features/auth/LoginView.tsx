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
  ShieldAlert,
  Lock
} from 'lucide-react';
import { db, saveStoreProfile } from '../../lib/db/repos';
import { supabase } from '../../lib/supabase';
import { verifyLogin, setPin, getLockedStaff, sendPinResetEmail, resetPinViaEmail, maskEmail } from '../../lib/pinAuth';
import { useRows, useRepoReady } from '../../lib/db/react';
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
  // Profil toko (tabel store_profile) & akun staf (tabel staff_list) — cuma dua tabel ini yang dibaca di layar login.
  const registeredOwner = useRows(db.storeProfile)[0] ?? null;
  const ownerReady = useRepoReady(db.storeProfile);
  const staffList = useRows(db.staff);
  const staffListReady = useRepoReady(db.staff);

  const [isRegistered, setIsRegistered] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [ownerPin, setOwnerPin] = useState('');
  
  // Login states
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // Kunci login SEPENUHNYA di database (lib/pinAuth.ts): 5x PIN salah berturut-turut
  // -> akun terkunci PERMANEN, tanpa hitungan mundur. Hanya Owner yang bisa
  // membukanya (Pengaturan > Staf), dan akun Owner sendiri lewat link reset di email.
  const [lockedIds, setLockedIds] = useState<string[]>([]);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [checkingPin, setCheckingPin] = useState(false);
  const [resetMailState, setResetMailState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [resetMailError, setResetMailError] = useState('');
  const refreshLocked = () => { void getLockedStaff().then(setLockedIds); };
  useEffect(() => { refreshLocked(); }, [staffListReady]);
  const isLockedOut = !!selectedStaff && lockedIds.includes(selectedStaff.id || '');

  const handleSendResetMail = async () => {
    if (!registeredOwner?.email || !selectedStaff?.id) return;
    setResetMailState('sending');
    const res = await sendPinResetEmail(registeredOwner.email, selectedStaff.id);
    setResetMailState(res.ok ? 'sent' : 'error');
    setResetMailError(res.message || '');
  };

  // ---- Atur PIN baru setelah Owner klik link reset di email ----
  const [resetPinMode, setResetPinMode] = useState(false);
  const [newPinA, setNewPinA] = useState('');
  const [newPinB, setNewPinB] = useState('');
  const [newPinMsg, setNewPinMsg] = useState('');
  const [resetTargetId, setResetTargetId] = useState('owner-01');
  const resetTargetName = staffList.find((st) => st.id === resetTargetId)?.name;
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('reset-pin')) return;
    setResetTargetId(params.get('staff') || 'owner-01');
    void supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (user?.email && !user.is_anonymous) setResetPinMode(true);
    });
  }, []);
  const handleSetNewOwnerPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPinA.length !== 6 || newPinA !== newPinB) {
      setNewPinMsg('PIN harus 6 digit dan kedua isian harus sama.');
      return;
    }
    const res = await resetPinViaEmail(resetTargetId, newPinA);
    if (res.status === 'ok') {
      await supabase.auth.signOut();
      await dialog.alert('PIN berhasil diganti dan akun dibuka. Silakan login dengan PIN baru.');
      window.location.replace(window.location.pathname);
    } else if (res.status === 'forbidden') {
      setNewPinMsg('Link ini tidak valid untuk email Owner toko. Minta link baru.');
    } else {
      setNewPinMsg('Gagal mengganti PIN. Coba minta link baru.');
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
          { id: 'owner-01', name: registeredOwner.ownerName + ' (Owner)', role: 'Owner', permissions: ROLE_DEFAULT_PERMISSIONS.Owner }
        ];
        void db.staff.save(initialList);
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
      email
    };

    const initialList: StaffMember[] = [
      {
        id: 'owner-01',
        name: ownerName + ' (Owner)',
        role: 'Owner',
        permissions: ROLE_DEFAULT_PERMISSIONS.Owner,
      }
    ];

    // Simpan profil & akun Owner dulu, baru pasang PIN-nya (di-hash di database).
    void (async () => {
      await saveStoreProfile(ownerData);
      await db.staff.save(initialList);
      const res = await setPin(null, 'owner-01', ownerPin);
      if (res.status !== 'ok') {
        dialog.alert("Toko terdaftar, tapi PIN gagal disimpan. Cek koneksi lalu coba daftar ulang.");
        return;
      }
      setIsRegistered(true);
      dialog.alert("Registrasi Toko Berhasil! Silakan pilih akun dan masukkan PIN Anda.");
    })();
  };

  // PIN keyboard digit handler
  const handlePinDigit = (digit: string) => {
    if (isLockedOut || checkingPin) return;
    if (pinInput.length < 6) {
      const nextPin = pinInput + digit;
      setPinInput(nextPin);
      setPinError(false);

      if (nextPin.length === 6 && selectedStaff?.id) {
        setCheckingPin(true);
        void verifyLogin(selectedStaff.id, nextPin).then((res) => {
          setCheckingPin(false);
          if (res.status === 'ok') {
            // Login berhasil — bawa izin tersimpan staf (atau izin default
            // role, untuk data lama) supaya menu & aksi bisa dibatasi.
            const role = selectedStaff.role;
            const permissions = selectedStaff.permissions && selectedStaff.permissions.length > 0
              ? selectedStaff.permissions
              : (ROLE_DEFAULT_PERMISSIONS[role] || []);
            onLoginSuccess({ name: selectedStaff.name, role, permissions });
            return;
          }
          setPinInput('');
          if (res.status === 'locked') {
            setAttemptsLeft(0);
            setPinError(false);
            refreshLocked();
          } else {
            setAttemptsLeft(typeof res.attemptsLeft === 'number' ? res.attemptsLeft : null);
            setPinError(true);
          }
          if (navigator.vibrate) navigator.vibrate(100);
        });
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


  if (resetPinMode) {
    return (
      <main className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 font-sans">
        <form onSubmit={handleSetNewOwnerPin} className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4">
          <div>
            <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide">Atur PIN Baru</h2>
            <p className="text-xs text-gray-600 mt-1">Email Owner sudah terverifikasi. Buat PIN 6 digit baru untuk akun <b>{resetTargetName || 'yang dipilih'}</b>.</p>
          </div>
          <Input type="password" inputMode="numeric" maxLength={6} autoFocus value={newPinA}
            onChange={(e) => { setNewPinA(e.target.value.replace(/\D/g, '').slice(0, 6)); setNewPinMsg(''); }}
            placeholder="PIN baru 6 digit" className="h-11 font-mono text-center text-lg tracking-widest" />
          <Input type="password" inputMode="numeric" maxLength={6} value={newPinB}
            onChange={(e) => { setNewPinB(e.target.value.replace(/\D/g, '').slice(0, 6)); setNewPinMsg(''); }}
            placeholder="Ulangi PIN baru" className="h-11 font-mono text-center text-lg tracking-widest" />
          {newPinMsg && <p className="text-[11px] font-bold text-red-700 text-center">{newPinMsg}</p>}
          <Button type="submit" className="w-full">Simpan PIN Baru</Button>
        </form>
      </main>
    );
  }

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
                          setAttemptsLeft(null);
                          setResetMailState('idle');
                          refreshLocked();
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
                        {lockedIds.includes(staff.id || '') ? (
                          <span className="flex items-center gap-1 text-[10px] font-extrabold text-red-700 uppercase tracking-wider"><Lock className="w-3.5 h-3.5" /> Terkunci</span>
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-blue-600 transition-transform group-hover:translate-x-1" />
                        )}
                      </button>
                    ))}
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
                        <ShieldAlert className="w-4 h-4" /> PIN salah!{attemptsLeft !== null ? ` Sisa ${attemptsLeft} percobaan sebelum akun terkunci.` : ' Silakan coba lagi.'}
                      </motion.div>
                    )}

                    {isLockedOut && (
                      <motion.div 
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3 text-left normal-case"
                      >
                        <p className="text-xs font-extrabold text-red-700 flex items-center gap-1.5"><Lock className="w-4 h-4" /> Akun ini terkunci</p>
                        <p className="text-[11px] text-red-800 font-medium">
                          PIN salah 5 kali berturut-turut. Demi keamanan, akun tidak bisa dicoba lagi sampai dibuka oleh Owner (lewat "Lupa PIN?" di bawah atau Pengaturan &gt; Staf).
                        </p>
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

                  {/* Lupa PIN — link ganti PIN dikirim ke email Owner, bukan ke staf */}
                  <div className="text-center space-y-1">
                    {resetMailState === 'sent' && registeredOwner?.email ? (
                      <p className="text-[11px] font-bold text-green-700 normal-case">
                        Link ganti PIN sudah dikirim ke email Owner ({maskEmail(registeredOwner.email)}). Minta Owner membuka emailnya.
                      </p>
                    ) : registeredOwner?.email ? (
                      <Button type="button" variant="link" disabled={resetMailState === 'sending'} onClick={handleSendResetMail}
                        className="h-auto p-0 text-[11px] text-blue-700 uppercase tracking-widest">
                        {resetMailState === 'sending' ? 'Mengirim...' : 'Lupa PIN?'}
                      </Button>
                    ) : (
                      <p className="text-[11px] text-gray-600 normal-case">Lupa PIN? Hubungi Owner toko.</p>
                    )}
                    {resetMailState === 'error' && <p className="text-[11px] text-red-700 normal-case">Gagal mengirim email{resetMailError ? `: ${resetMailError}` : ''}.</p>}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-[10px] text-gray-600 mt-8 font-mono text-center uppercase tracking-[0.2em]">
        MASRI JAYA • SECURE ACCESS CONTROL • v{__APP_VERSION__}
      </p>
    </main>
  );
}