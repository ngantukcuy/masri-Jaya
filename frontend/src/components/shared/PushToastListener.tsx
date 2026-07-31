import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface PushToast {
  id: number;
  title: string;
  body: string;
}

/**
 * Menampilkan toast kecil di pojok layar setiap kali ada push notification
 * yang masuk SAAT app lagi dibuka (foreground). Kalau app lagi di
 * background/ditutup, Android sendiri yang otomatis menampilkan notif di
 * status bar (tray) — komponen ini cuma menangani kasus foreground, yang
 * mana sistem operasi TIDAK menampilkan apa-apa secara otomatis.
 *
 * Dengar event `tokku:push-received` yang di-dispatch dari
 * src/lib/push/pushNotifications.ts.
 */
export default function PushToastListener() {
  const [toasts, setToasts] = useState<PushToast[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((prev) => [
        ...prev,
        {
          id,
          title: detail?.title || 'Notifikasi Baru',
          body: detail?.body || '',
        },
      ]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    };
    window.addEventListener('tokku:push-received', handler);
    return () => window.removeEventListener('tokku:push-received', handler);
  }, []);

  return (
    <div className="fixed top-4 right-4 z-[999] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-xs pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            className="pointer-events-auto bg-white border border-gray-200 shadow-xl rounded-2xl p-3.5 flex items-start gap-2.5"
          >
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-gray-900 truncate">{t.title}</p>
              {t.body && <p className="text-[11px] text-gray-500 leading-snug mt-0.5">{t.body}</p>}
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="text-gray-300 hover:text-gray-500 cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
