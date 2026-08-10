import { useEffect, useState } from 'react';

/** Live `navigator.onLine` status, updated on the browser's online/offline events. */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return isOnline;
}

/** Live count of writes waiting in the offline queue (lib/offlineQueue.ts), no polling needed. */
export function usePendingSyncCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const { countOps } = await import('./offlineQueue');
      const n = await countOps();
      if (active) setCount(n);
    };
    refresh();
    window.addEventListener('tokku:offline-queue-changed', refresh);
    window.addEventListener('online', refresh);
    return () => {
      active = false;
      window.removeEventListener('tokku:offline-queue-changed', refresh);
      window.removeEventListener('online', refresh);
    };
  }, []);

  return count;
}
