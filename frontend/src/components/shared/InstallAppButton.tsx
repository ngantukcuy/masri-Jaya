import { useState } from 'react';
import { Download, Share, X, SquarePlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useInstallPrompt } from '../../lib/useInstallPrompt';

/**
 * Small "Instal Aplikasi" affordance for the header. Renders nothing once
 * the app is already installed/running standalone. On Chrome/Edge/Android
 * it triggers the real native install prompt; on iOS (which never fires
 * beforeinstallprompt) it shows a quick how-to instead, since that's the
 * only way to install a PWA there.
 */
export default function InstallAppButton({ compact = false }: { compact?: boolean }) {
  const { canInstall, promptInstall, isIOS, isInstalled } = useInstallPrompt();
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  if (isInstalled || (!canInstall && !isIOS)) return null;

  const handleClick = () => {
    if (canInstall) {
      promptInstall();
    } else if (isIOS) {
      setShowIOSHelp(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        title="Instal Aplikasi"
        className={`flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all cursor-pointer font-bold ${
          compact ? 'p-2' : 'px-3 py-2 text-xs'
        }`}
      >
        <Download className="w-4 h-4" />
        {!compact && <span>Instal Aplikasi</span>}
      </button>

      <AnimatePresence>
        {showIOSHelp && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowIOSHelp(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-10 bg-white rounded-2xl max-w-xs w-full p-5 border border-gray-200 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-black text-sm text-gray-900">Instal ke Layar Utama</h3>
                <button onClick={() => setShowIOSHelp(false)} className="p-1 hover:bg-gray-100 rounded-lg cursor-pointer">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <p className="text-xs text-gray-500">Safari di iPhone/iPad tidak punya tombol instal otomatis. Ikuti langkah ini:</p>
              <ol className="space-y-3 text-xs text-gray-700">
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">1</span>
                  <span className="flex items-center gap-1.5">Ketuk tombol <Share className="w-3.5 h-3.5 inline text-blue-600" /> <b>Share/Bagikan</b> di Safari</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">2</span>
                  <span className="flex items-center gap-1.5">Pilih <SquarePlus className="w-3.5 h-3.5 inline text-blue-600" /> <b>"Tambah ke Layar Utama"</b></span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">3</span>
                  <span>Ketuk <b>"Tambah"</b> — ikon aplikasi akan muncul di layar utama</span>
                </li>
              </ol>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
