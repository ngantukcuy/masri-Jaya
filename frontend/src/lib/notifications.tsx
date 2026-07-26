import React, { createContext, useContext, useState, ReactNode } from 'react';

type Toast = { id: number; message: string };

type NotificationsContextType = {
  showToast: (message: string) => void;
  showConfirm: (message: string) => Promise<boolean>;
  showPrompt: (message: string, defaultValue?: string) => Promise<string | null>;
};

const NotificationsContext = createContext<NotificationsContextType | null>(null);

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<{ open: boolean; message: string; resolver?: (v: boolean) => void }>({ open: false, message: '' });
  const [promptState, setPromptState] = useState<{ open: boolean; message: string; defaultValue?: string; resolver?: (v: string | null) => void; value?: string }>({ open: false, message: '' });

  const showToast = (message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((s) => [...s, { id, message }]);
    setTimeout(() => {
      setToasts((s) => s.filter((t) => t.id !== id));
    }, 3000);
  };

  const showConfirm = (message: string) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ open: true, message, resolver: resolve });
    });
  };

  const showPrompt = (message: string, defaultValue = '') => {
    return new Promise<string | null>((resolve) => {
      setPromptState({ open: true, message, defaultValue, resolver: resolve, value: defaultValue });
    });
  };

  const handleConfirm = (value: boolean) => {
    if (confirmState.resolver) confirmState.resolver(value);
    setConfirmState({ open: false, message: '' });
  };

  const handlePromptSubmit = (val: string | null) => {
    if (promptState.resolver) promptState.resolver(val);
    setPromptState({ open: false, message: '' });
  };

  return (
    <NotificationsContext.Provider value={{ showToast, showConfirm, showPrompt }}>
      {children}

      {/* Toast container */}
      <div className="fixed right-4 bottom-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{t.message}</div>
        ))}
      </div>

      {/* Confirm modal */}
      {confirmState.open && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <p className="text-sm text-gray-800 mb-4">{confirmState.message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => handleConfirm(false)} className="px-4 py-2 rounded-lg border">Batal</button>
              <button onClick={() => handleConfirm(true)} className="px-4 py-2 rounded-lg bg-blue-600 text-white">Ya</button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt modal */}
      {promptState.open && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <p className="text-sm text-gray-800 mb-3">{promptState.message}</p>
            <input value={promptState.value} onChange={(e) => setPromptState((s) => ({ ...s, value: e.target.value }))} className="w-full border rounded px-3 py-2 mb-3" />
            <div className="flex justify-end gap-3">
              <button onClick={() => handlePromptSubmit(null)} className="px-4 py-2 rounded-lg border">Batal</button>
              <button onClick={() => handlePromptSubmit(promptState.value ?? '')} className="px-4 py-2 rounded-lg bg-blue-600 text-white">Kirim</button>
            </div>
          </div>
        </div>
      )}
    </NotificationsContext.Provider>
  );
}
