import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

/**
 * Replaces the browser-native window.alert / window.confirm / window.prompt
 * with in-app modals that match the app's own visual style (glass-card,
 * slate/blue palette) instead of the OS/Chrome popup chrome.
 *
 * Usage inside any component:
 *   const dialog = useDialog();
 *   dialog.alert('Berhasil disimpan!');
 *   const ok = await dialog.confirm('Hapus produk ini?');
 *   const value = await dialog.prompt('Masukkan nominal:', '0');
 */

type AlertItem = { id: number; message: string; title?: string };
type ConfirmRequest = {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  resolve: (value: boolean) => void;
};
type PromptRequest = {
  message: string;
  title?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  resolve: (value: string | null) => void;
};

interface DialogContextValue {
  alert: (message: string, title?: string) => void;
  confirm: (
    message: string,
    opts?: { title?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }
  ) => Promise<boolean>;
  prompt: (
    message: string,
    defaultValue?: string,
    opts?: { title?: string; confirmLabel?: string; cancelLabel?: string }
  ) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used inside <DialogProvider>');
  return ctx;
}

let alertIdCounter = 0;

export function DialogProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  const [promptReq, setPromptReq] = useState<PromptRequest | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const promptInputRef = useRef<HTMLInputElement>(null);

  const dismissAlert = useCallback((id: number) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const alertFn = useCallback((message: string, title?: string) => {
    const id = ++alertIdCounter;
    setAlerts((prev) => [...prev, { id, message, title }]);
    // Auto-dismiss so a stream of success/error notices doesn't pile up
    // forever if the user ignores them.
    window.setTimeout(() => dismissAlert(id), 6000);
  }, [dismissAlert]);

  const confirmFn = useCallback(
    (
      message: string,
      opts?: { title?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }
    ): Promise<boolean> => {
      return new Promise((resolve) => {
        setConfirmReq({ message, resolve, ...opts });
      });
    },
    []
  );

  const promptFn = useCallback(
    (
      message: string,
      defaultValue?: string,
      opts?: { title?: string; confirmLabel?: string; cancelLabel?: string }
    ): Promise<string | null> => {
      setPromptValue(defaultValue ?? '');
      return new Promise((resolve) => {
        setPromptReq({ message, defaultValue, resolve, ...opts });
      });
    },
    []
  );

  const resolveConfirm = (value: boolean) => {
    confirmReq?.resolve(value);
    setConfirmReq(null);
  };

  const resolvePrompt = (value: string | null) => {
    promptReq?.resolve(value);
    setPromptReq(null);
  };

  return (
    <DialogContext.Provider value={{ alert: alertFn, confirm: confirmFn, prompt: promptFn }}>
      {children}

      {/* Alert toasts — stack in the top-right corner, no backdrop */}
      {alerts.length > 0 && (
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[min(92vw,380px)]">
          {alerts.map((a) => (
            <div
              key={a.id}
              className="glass-card rounded-xl px-4 py-3 shadow-lg border border-white/60 animate-[fadeIn_0.15s_ease-out]"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  {a.title && <p className="text-sm font-semibold text-gray-900 mb-0.5">{a.title}</p>}
                  <p className="text-sm text-gray-700 whitespace-pre-line break-words">{a.message}</p>
                </div>
                <button
                  onClick={() => dismissAlert(a.id)}
                  className="shrink-0 text-gray-400 hover:text-gray-700 text-lg leading-none px-1"
                  aria-label="Tutup"
                >
                  &times;
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm modal */}
      {confirmReq && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm px-4">
          <div className="glass-card w-full max-w-sm rounded-2xl p-5 shadow-2xl border border-white/60">
            {confirmReq.title && (
              <p className="text-base font-semibold text-gray-900 mb-1.5">{confirmReq.title}</p>
            )}
            <p className="text-sm text-gray-700 whitespace-pre-line mb-5">{confirmReq.message}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => resolveConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                {confirmReq.cancelLabel ?? 'Batal'}
              </button>
              <button
                onClick={() => resolveConfirm(true)}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${
                  confirmReq.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {confirmReq.confirmLabel ?? 'Ya'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt modal */}
      {promptReq && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm px-4">
          <form
            className="glass-card w-full max-w-sm rounded-2xl p-5 shadow-2xl border border-white/60"
            onSubmit={(e) => {
              e.preventDefault();
              resolvePrompt(promptValue);
            }}
          >
            {promptReq.title && (
              <p className="text-base font-semibold text-gray-900 mb-1.5">{promptReq.title}</p>
            )}
            <p className="text-sm text-gray-700 whitespace-pre-line mb-3">{promptReq.message}</p>
            <input
              ref={promptInputRef}
              autoFocus
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white/80 px-3 py-2 text-sm text-gray-900 mb-5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => resolvePrompt(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                {promptReq.cancelLabel ?? 'Batal'}
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                {promptReq.confirmLabel ?? 'OK'}
              </button>
            </div>
          </form>
        </div>
      )}
    </DialogContext.Provider>
  );
}
