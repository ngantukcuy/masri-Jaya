import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** 'app' = layar penuh (dipakai di paling luar); 'page' = hanya area konten, sidebar/menu tetap bisa dipakai. */
  scope?: 'app' | 'page';
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Tanpa ini, error saat render komponen mana pun membuat React membuang
 * seluruh tampilan sehingga yang terlihat cuma layar putih. Sekarang pesan
 * errornya ditampilkan (bisa difoto/di-screenshot untuk diagnosa) dan ada
 * tombol untuk memuat ulang / membersihkan cache aplikasi.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private reload = () => {
    window.location.reload();
  };

  // Hapus service worker + cache lama lalu muat ulang — menyelesaikan kasus
  // HP masih memegang file versi lama setelah aplikasi diperbarui.
  private clearCacheAndReload = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } catch {
      // abaikan — tetap lanjut muat ulang
    }
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const fullScreen = this.props.scope !== 'page';
    return (
      <div
        className={`${fullScreen ? 'min-h-screen' : 'py-16'} w-full flex items-center justify-center bg-slate-50 p-5`}
        role="alert"
      >
        <div className="w-full max-w-md bg-white border border-red-200 rounded-2xl shadow-lg p-5 space-y-3 text-left">
          <h2 className="text-sm font-black text-gray-900">
            {fullScreen ? 'Aplikasi gagal ditampilkan' : 'Halaman ini gagal ditampilkan'}
          </h2>
          <p className="text-xs text-gray-600">
            Terjadi error saat memuat tampilan. Coba muat ulang. Kalau tetap begini, kirim pesan error di bawah ke pengembang.
          </p>
          <pre className="text-[11px] leading-snug bg-red-50 text-red-800 rounded-lg p-3 max-h-40 overflow-auto whitespace-pre-wrap break-words">
            {error.name}: {error.message}
          </pre>
          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={this.reload} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold cursor-pointer">
              Muat Ulang
            </button>
            <button onClick={this.clearCacheAndReload} className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-xs font-bold cursor-pointer">
              Bersihkan Cache &amp; Muat Ulang
            </button>
          </div>
        </div>
      </div>
    );
  }
}
