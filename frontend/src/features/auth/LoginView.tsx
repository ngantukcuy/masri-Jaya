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

interface LoginViewProps {
  onLoginSuccess: (user: CurrentUser) => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const dialog = useDialog();
  const [registeredOwner, setRegisteredOwner] = useSupabaseState<{ storeName: string; ownerName: string; email: string; pin: string } | null>('store_owner', null);
  const [staffList, setStaffList] = useSupabaseTable<StaffMember>('staff_list', [], (s) => s.id);

  const [isRegistered, setIsRegistered] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [ownerPin, setOwnerPin] = useState('');
  
  // Login states
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // React to the registered-owner / staff-list Supabase rows as they load or change
  useEffect(() => {
    if (registeredOwner) {
      setIsRegistered(true);
      setStoreName(registeredOwner.storeName);
      setOwnerName(registeredOwner.ownerName);

      if (staffList.length === 0) {
        // Registered but no staff yet (shouldn't normally happen) — seed owner as first staff
        const initialList: StaffMember[] = [
          { id: 'owner-01', name: registeredOwner.ownerName + ' (Owner)', pin: registeredOwner.pin, role: 'Owner', permissions: ROLE_DEFAULT_PERMISSIONS.Owner }
        ];
        setStaffList(initialList);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registeredOwner]);

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
    if (pinInput.length < 6) {
      const nextPin = pinInput + digit;
      setPinInput(nextPin);
      setPinError(false);

      if (nextPin.length === 6 && selectedStaff) {
        if (nextPin === selectedStaff.pin) {
          // Success login — carry the staff's saved permissions (or the
          // role's default set, for older records saved before per-staff
          // permissions existed) so the rest of the app can gate menus
          // and actions accordingly.
          const role = selectedStaff.role;
          const permissions = selectedStaff.permissions && selectedStaff.permissions.length > 0
            ? selectedStaff.permissions
            : (ROLE_DEFAULT_PERMISSIONS[role] || []);
          onLoginSuccess({ name: selectedStaff.name, role, permissions });
        } else {
          // Wrong PIN
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

  return (
    <main className="min-h-screen bg-[#E0E5EC] flex flex-col items-center justify-center p-4 font-sans select-none">
      
      {/* Animated container */}
      <AnimatePresence mode="wait">
        {!isRegistered ? (
          /* Form Pendaftaran Pemilik Toko (First time flow) */
          <motion.div
            key="register"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="w-full max-w-md nm-card rounded-3xl p-8 space-y-6"
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full nm-inset flex items-center justify-center text-blue-600 mb-3">
                <Store className="w-8 h-8" />
              </div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight uppercase">REGISTRASI TOKO BARU</h1>
              <p className="text-xs text-gray-600 mt-1 uppercase tracking-wider">Langkah awal setup Tokku Build Material ERP</p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] text-gray-600 font-bold uppercase mb-1.5 ml-1">Nama Toko / Bisnis</label>
                <div className="relative">
                  <Building className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input
                    type="text"
                    required
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Contoh: TB Sinar Maju"
                    className="w-full nm-input rounded-xl pl-10 pr-4 py-3 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-gray-600 font-bold uppercase mb-1.5 ml-1">Nama Pemilik (Owner)</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Nama Lengkap Anda"
                    className="w-full nm-input rounded-xl pl-10 pr-4 py-3 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-gray-600 font-bold uppercase mb-1.5 ml-1">Email Pemilik</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="owner@sinarmaju.com"
                    className="w-full nm-input rounded-xl pl-10 pr-4 py-3 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-gray-600 font-bold uppercase mb-1.5 ml-1">PIN Keamanan (6 Digit)</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input
                    type="password"
                    maxLength={6}
                    required
                    value={ownerPin}
                    onChange={(e) => setOwnerPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Masukkan 6 angka rahasia"
                    className="w-full nm-input rounded-xl pl-10 pr-4 py-3 font-mono text-center text-lg font-bold tracking-widest"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-4 rounded-xl nm-btn font-black uppercase text-xs tracking-widest text-blue-600 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Daftarkan &amp; Mulai ERP</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
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
            className="w-full max-w-md nm-card rounded-3xl p-8 space-y-6"
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
                        }}
                        className="w-full flex items-center justify-between p-4 rounded-2xl nm-btn text-left group cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full nm-inset flex items-center justify-center text-gray-600">
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
                    <button
                      onClick={async () => {
                        const conf = await dialog.confirm("Apakah Anda yakin ingin mereset data registrasi toko? Ini akan menghapus semua kredensial.");
                        if (conf) {
                          setRegisteredOwner(null);
                          setStaffList([]);
                          setIsRegistered(false);
                          setStoreName('');
                          setOwnerName('');
                          setEmail('');
                          setOwnerPin('');
                        }
                      }}
                      className="text-[9px] font-bold text-red-700 uppercase tracking-widest hover:underline"
                    >
                      Reset Registrasi Toko
                    </button>
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
                    <button
                      onClick={() => setSelectedStaff(null)}
                      className="text-[10px] text-gray-600 hover:text-gray-900 font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" /> Ganti Akun
                    </button>
                  </div>

                  {/* PIN Display Indicators */}
                  <div className="text-center space-y-2">
                    <span className="block text-[10px] font-bold text-gray-600 uppercase tracking-widest">Masukkan 6-Digit PIN</span>
                    <div className="flex justify-center gap-3 py-4">
                      {[0, 1, 2, 3, 4, 5].map((index) => (
                        <div
                          key={index}
                          className={`w-4 h-4 rounded-full transition-all duration-150 ${
                            pinInput.length > index
                              ? 'bg-blue-600 scale-110 shadow-md shadow-blue-400'
                              : 'nm-inset'
                          }`}
                        />
                      ))}
                    </div>
                    
                    {pinError && (
                      <motion.div 
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-[10px] font-extrabold text-red-700 uppercase tracking-wider flex items-center justify-center gap-1.5"
                      >
                        <ShieldAlert className="w-4 h-4" /> PIN Salah! Silakan coba lagi.
                      </motion.div>
                    )}
                  </div>

                  {/* Keypad Grid */}
                  <div className="grid grid-cols-3 gap-4 max-w-[280px] mx-auto">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                      <button
                        key={digit}
                        type="button"
                        onClick={() => handlePinDigit(digit)}
                        className="w-16 h-16 rounded-full nm-btn font-extrabold text-lg text-gray-800 flex items-center justify-center active:nm-btn-active cursor-pointer"
                      >
                        {digit}
                      </button>
                    ))}
                    
                    <button
                      type="button"
                      onClick={() => setPinInput('')}
                      className="w-16 h-16 rounded-full nm-btn font-bold text-xs text-gray-600 flex items-center justify-center active:nm-btn-active cursor-pointer"
                    >
                      C
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => handlePinDigit('0')}
                      className="w-16 h-16 rounded-full nm-btn font-extrabold text-lg text-gray-800 flex items-center justify-center active:nm-btn-active cursor-pointer"
                    >
                      0
                    </button>
                    
                    <button
                      type="button"
                      onClick={handleBackspace}
                      className="w-16 h-16 rounded-full nm-btn font-bold text-gray-600 flex items-center justify-center active:nm-btn-active cursor-pointer"
                    >
                      <Delete className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-[10px] text-gray-600 mt-8 font-mono text-center uppercase tracking-[0.2em]">
        TOKKU BUILD MATERIAL ERP • SECURE ACCESS CONTROL
      </p>
    </main>
  );
}
