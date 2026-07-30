import { useEffect, useState, useCallback } from 'react';

// Chrome/Edge/Android fire this event when the app meets install
// criteria (valid manifest + service worker + HTTPS + some user
// engagement). It does NOT exist on iOS Safari — there is no automatic
// install prompt there, ever; the only way in is Share ▸ Add to Home
// Screen, done manually by the person.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari's own flag for "opened from home screen"
    (window.navigator as any).standalone === true
  );
}

function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOSDevice = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as "Macintosh" but has touch support, unlike a real Mac.
  const isIPadOS13Plus = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return isIOSDevice || isIPadOS13Plus;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(isStandaloneDisplay());
  const isIOS = detectIOS();

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return outcome === 'accepted';
  }, [deferredPrompt]);

  return {
    // True on Chrome/Edge/Android once the browser has actually offered
    // the native prompt — this is when a custom "Instal Aplikasi" button
    // should appear and be clickable.
    canInstall: !!deferredPrompt && !isInstalled,
    promptInstall,
    // True on iOS Safari/Chrome, where there's no automatic prompt at
    // all — show manual "Share ▸ Add to Home Screen" instructions instead.
    isIOS: isIOS && !isInstalled,
    isInstalled,
  };
}
